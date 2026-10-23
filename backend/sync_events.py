import os
import time
import json
import hashlib
import requests
from datetime import datetime
from pathlib import Path
from typing import Optional, List
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from google.genai.errors import ClientError, ServerError

# Load local .env file if present (for local runs outside GitHub Actions)
_env_path = Path(__file__).resolve().parent.parent / ".env"
if _env_path.exists():
    for _line in _env_path.read_text(encoding="utf-8").splitlines():
        if _line.strip() and not _line.startswith("#") and "=" in _line:
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())

# 1. API & Database Credentials
APIFY_TOKEN = os.environ.get("APIFY_TOKEN", "")
ACTOR_ID = "apify~instagram-profile-scraper"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://pvdzgmglfcmdysyorjhf.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "sb_publishable_-zw9isL2SkCT7r9O0fUwYA_SfmPynKp")

client = genai.Client(api_key=GEMINI_API_KEY)


# 2. AI Studio Structured JSON Schema for Flyer Extraction
class FlyerExtractionSchema(BaseModel):
    is_event: bool = Field(
        description="True if the post/flyer announces a specific upcoming or dated event; False for general promos or memes."
    )
    event_name: Optional[str] = Field(
        default=None,
        description="Name or title of the event (e.g., 'The Den Bear Night', 'BOO! KED')."
    )
    venue_name: str = Field(
        description="Name of the venue hosting the event (e.g., 'The Saloon MN')."
    )
    event_date: Optional[str] = Field(
        default=None,
        description="Normalized event date in YYYY-MM-DD format, calculated from the flyer and post timestamp."
    )
    doors_time: Optional[str] = Field(
        default=None,
        description="Doors open time (e.g., '10:00 PM') or null if not listed."
    )
    show_time: Optional[str] = Field(
        default=None,
        description="Show or music start time (e.g., '10:30 PM') or null if not listed."
    )
    cover_charge: Optional[str] = Field(
        default=None,
        description="Cover charge or ticket info (e.g., 'No cover before 9PM', '$10') or null."
    )
    age_requirement: Optional[str] = Field(
        default=None,
        description="Age requirement (e.g., '21+', '18+') or null."
    )
    performers: List[str] = Field(
        default_factory=list,
        description="List of DJs, drag performers, hosts, or special guests listed on the flyer or caption."
    )
    vibe_tags: List[str] = Field(
        default_factory=list,
        description="2-3 vibe tags describing the event (e.g., 'Nightlife', 'Drag/Show', 'Circuit/DJ', 'Bear Night', 'Watch Party')."
    )
    description: Optional[str] = Field(
        default=None,
        description="1-2 sentence engaging summary of the event combining flyer details and post caption context."
    )
    confidence_score: float = Field(
        default=0.95,
        description="Confidence score between 0.0 and 1.0 for the extracted event details."
    )


# Helper for 24-hr time conversion (Postgres TIME format HH:MM:SS)
def to_24hr_time(time_str: Optional[str]) -> Optional[str]:
    if not time_str:
        return None
    time_str = time_str.strip().upper()
    # If already 24-hr time like "22:00:00", keep it
    if len(time_str) == 8 and time_str.count(":") == 2 and "M" not in time_str:
        return time_str
    for fmt in ("%I:%M %p", "%I:%M%p", "%I %p", "%I%p", "%H:%M"):
        try:
            dt = datetime.strptime(time_str, fmt)
            return dt.strftime("%H:%M:%S")
        except ValueError:
            continue
    return None


# Helper for uploading flyer to Supabase Storage ('flyers' bucket)
def upload_flyer_to_supabase(ig_image_url: str, venue_name: str) -> Optional[str]:
    if not ig_image_url:
        return None
    try:
        img_res = requests.get(ig_image_url, timeout=10)
        if img_res.status_code != 200:
            return ig_image_url

        file_hash = hashlib.md5(ig_image_url.encode()).hexdigest()[:10]
        clean_venue = "".join(c if c.isalnum() else "_" for c in venue_name.lower()).strip("_")
        filename = f"{clean_venue}_{file_hash}.jpg"

        storage_url = f"{SUPABASE_URL}/storage/v1/object/flyers/{filename}"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "image/jpeg",
            "x-upsert": "true",
        }

        up_res = requests.post(storage_url, headers=headers, data=img_res.content)
        if up_res.status_code in [200, 201]:
            return f"{SUPABASE_URL}/storage/v1/object/public/flyers/{filename}"
    except Exception as e:
        print(f"   Storage upload warning: {e}")
    return ig_image_url


# Helper for Gemini structured extraction with 429 & 503 retry protection
def analyze_flyer_with_retry(image_bytes: bytes, prompt: str, mime_type: str = "image/jpeg", max_retries: int = 4):
    for attempt in range(1, max_retries + 1):
        try:
            return client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                    prompt,
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=FlyerExtractionSchema,
                    temperature=0.1,
                ),
            )
        except (ServerError, ClientError) as e:
            status_code = getattr(e, "code", None)
            if attempt == max_retries or (isinstance(e, ClientError) and status_code != 429):
                raise e
            wait_time = attempt * 10 if status_code == 429 else attempt * 5
            print(f"   [{status_code or 'API Busy'}] Retrying in {wait_time}s (Attempt {attempt}/{max_retries})...")
            time.sleep(wait_time)


# Helper to safely extract posts from any Apify profile schema
def extract_posts_from_profile(profile: dict) -> list:
    for key in ["latestPosts", "latest_posts", "posts", "items"]:
        val = profile.get(key)
        if isinstance(val, list) and len(val) > 0:
            return val

    edges = (
        profile.get("edge_owner_to_timeline_media", {}).get("edges")
        or profile.get("graphql", {}).get("user", {}).get("edge_owner_to_timeline_media", {}).get("edges")
        or []
    )
    if edges:
        normalized = []
        for edge in edges:
            node = edge.get("node", {})
            caption_edges = node.get("edge_media_to_caption", {}).get("edges", [])
            caption_text = caption_edges[0].get("node", {}).get("text", "") if caption_edges else ""
            normalized.append({
                "url": f"https://www.instagram.com/p/{node.get('shortcode')}/" if node.get("shortcode") else None,
                "displayUrl": node.get("display_url") or node.get("thumbnail_src"),
                "caption": caption_text,
                "timestamp": node.get("taken_at_timestamp"),
            })
        return normalized

    return []


def fetch_active_usernames() -> List[str]:
    print("1. Fetching active Minneapolis sources from Supabase...")
    try:
        sources_res = requests.get(
            f"{SUPABASE_URL}/rest/v1/sources?is_active=eq.true",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
            timeout=10,
        )
        sources = sources_res.json() if sources_res.status_code == 200 else []
    except Exception as e:
        print(f"   ⚠️ Error fetching sources from Supabase: {e}")
        sources = []

    usernames = [s["ig_handle"].strip().lstrip("@") for s in sources if s.get("ig_handle")]
    # Fix common handle typo in DB ('saloonmn' -> 'thesaloonmn') and deduplicate
    usernames = list(dict.fromkeys("thesaloonmn" if u == "saloonmn" else u for u in usernames))

    if not usernames:
        print("   ⚠️ No active sources found in database. Using core MSP fallback list.")
        usernames = ["thesaloonmn", "eagleboltbar", "lushmpls", "blackhartstp"]

    print(f"   Found {len(usernames)} active venues to scan: {usernames}")
    return usernames


def map_extraction_to_supabase_row(
    extracted: dict,
    default_venue: str,
    permanent_image_url: Optional[str],
    post_url: Optional[str],
) -> dict:
    """Maps the AI Studio flyer extraction schema to the Supabase 'events' table schema."""
    raw_time = extracted.get("doors_time") or extracted.get("show_time")
    vibe_tags = extracted.get("vibe_tags") or ["Nightlife"]

    return {
        "city_code": "MSP",
        "venue_name": extracted.get("venue_name") or default_venue,
        "title": extracted.get("event_name"),
        "event_date": extracted.get("event_date"),
        "start_time": to_24hr_time(raw_time),
        "cover_info": extracted.get("cover_charge") or "Check flyer",
        "age_limit": extracted.get("age_requirement") or "21+",
        "vibe_tags": vibe_tags,
        "talent_names": extracted.get("performers") or [],
        "short_summary": extracted.get("description"),
        "flyer_image_url": permanent_image_url,
        "post_url": post_url,
        "status": "approved",
        "confidence_score": extracted.get("confidence_score", 0.95),
    }


def main():
    usernames = fetch_active_usernames()

    # Trigger Apify Multi-Profile Scraper
    print(f"\n2. Triggering Apify ({ACTOR_ID}) for {len(usernames)} profiles...")
    run_url = f"https://api.apify.com/v2/acts/{ACTOR_ID}/runs?token={APIFY_TOKEN}"
    payload = {
        "usernames": usernames,
        "proxyConfiguration": {
            "useApifyProxy": True
        },
    }

    response = requests.post(run_url, json=payload)
    res_json = response.json()

    if "data" not in res_json:
        print("Error starting Apify actor:", res_json)
        return

    run_data = res_json["data"]
    run_id = run_data["id"]
    dataset_id = run_data["defaultDatasetId"]

    status_url = f"https://api.apify.com/v2/actor-runs/{run_id}?token={APIFY_TOKEN}"
    while True:
        status = requests.get(status_url).json()["data"]["status"]
        print(f"   Apify status: {status}...")
        if status == "SUCCEEDED":
            break
        elif status in ["FAILED", "ABORTED", "TIMED_OUT"]:
            print("Scraper failed.")
            return
        time.sleep(5)

    # Fetch Dataset & Process Posts
    dataset_url = f"https://api.apify.com/v2/datasets/{dataset_id}/items?token={APIFY_TOKEN}"
    items = requests.get(dataset_url).json()

    print(f"\n3. Processing {len(items)} returned profile objects...")

    all_extracted_rows = []

    for profile in items:
        username = profile.get("username") or profile.get("ownerUsername") or "Unknown"
        venue_name = profile.get("fullName") or username

        posts = extract_posts_from_profile(profile)
        if not posts:
            err_msg = profile.get("error") or profile.get("requestErrorMessages")
            is_private = profile.get("private") or profile.get("is_private")
            print(f"-> @{username}: 0 posts found (Private: {is_private} | Error: {err_msg})")
            continue

        print(f"-> @{username}: {len(posts)} posts found")

        # Process up to the 3 most recent posts per profile
        for post in posts[:3]:
            shortcode = post.get("shortCode") or post.get("shortcode")
            post_url = (
                post.get("url")
                or post.get("inputUrl")
                or (f"https://www.instagram.com/p/{shortcode}/" if shortcode else None)
            )
            caption = post.get("caption", "")
            image_url = (
                post.get("displayUrl")
                or post.get("imageUrl")
                or post.get("display_url")
                or (post.get("images")[0] if isinstance(post.get("images"), list) and post.get("images") else None)
            )
            timestamp = post.get("timestamp")

            if not image_url or not post_url:
                continue

            print(f"   - Analyzing flyer from post ({timestamp}) with Gemini Structured Output...")

            img_response = requests.get(image_url, timeout=10)
            if img_response.status_code != 200:
                print("     Failed to download flyer image, skipping...")
                continue

            prompt = f"""
Analyze this nightlife event flyer image along with its Instagram post metadata:
- Venue: {venue_name} (@{username})
- Post Timestamp: {timestamp}
- Post URL: {post_url}
- Post Caption: {caption}

Instructions:
1. Determine if this post is promoting a specific event (`is_event`).
2. Extract all relevant event details from BOTH the flyer image and the caption.
3. Resolve relative dates (e.g., "This Friday", "Tonight") using the Post Timestamp ({timestamp}) into YYYY-MM-DD format.
"""

            try:
                ai_response = analyze_flyer_with_retry(img_response.content, prompt)
                clean_json = ai_response.text.strip().removeprefix("```json").removesuffix("```").strip()
                extracted_data = json.loads(clean_json)

                if not extracted_data.get("is_event", True) or not extracted_data.get("event_date") or not extracted_data.get("event_name"):
                    print("     No concrete event date/name found on post, skipping...")
                else:
                    permanent_url = upload_flyer_to_supabase(image_url, venue_name)
                    supabase_row = map_extraction_to_supabase_row(
                        extracted_data,
                        venue_name,
                        permanent_url,
                        post_url,
                    )

                    all_extracted_rows.append(supabase_row)
                    print(f"     -> Extracted: {supabase_row['title']} ({supabase_row['event_date']})")
            except Exception as e:
                print(f"     -> Skipping post due to error: {e}")

            time.sleep(5)

    # Push all scraped events to Supabase
    if all_extracted_rows:
        # Deduplicate rows by post_url so a single batch upsert never hits self-conflict
        deduped_rows = list({row["post_url"]: row for row in all_extracted_rows if row.get("post_url")}.values())
        print(f"\n4. Pushing {len(deduped_rows)} total events to Supabase...")
        endpoint = f"{SUPABASE_URL}/rest/v1/events?on_conflict=post_url"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=representation",
        }

        db_res = requests.post(endpoint, headers=headers, json=deduped_rows)
        if db_res.status_code in [200, 201]:
            print("SUCCESS! All Minneapolis venue events are now live in Supabase!")
        else:
            print(f"Supabase Error ({db_res.status_code}): {db_res.text}")
    else:
        print("\nNo events extracted across the scanned venues.")


if __name__ == "__main__":
    main()
