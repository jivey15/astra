import os
import re
import time
import json
import hashlib
import requests
from datetime import datetime, timezone
from difflib import SequenceMatcher
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


SHORTCODE_URL_REGEX = re.compile(r"instagram\.com/(?:p|reel|tv)/([A-Za-z0-9_-]+)")


def extract_shortcode(post: dict) -> Optional[str]:
    """Extracts the Instagram shortcode from an Apify post object or its URL."""
    for key in ("shortCode", "shortcode", "code"):
        val = post.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()

    for url_key in ("url", "inputUrl", "postUrl", "post_url"):
        url_val = post.get(url_key)
        if isinstance(url_val, str) and url_val.strip():
            match = SHORTCODE_URL_REGEX.search(url_val)
            if match:
                return match.group(1)

    return None


def parse_post_timestamp(raw_ts) -> Optional[float]:
    """Parses an Apify/Instagram post timestamp (ISO-8601 string or Unix epoch) into UTC epoch seconds."""
    if raw_ts is None:
        return None
    if isinstance(raw_ts, (int, float)):
        return float(raw_ts)
    if isinstance(raw_ts, str):
        s = raw_ts.strip()
        if not s:
            return None
        try:
            return float(s)
        except ValueError:
            pass
        try:
            iso = s.replace("Z", "+00:00") if s.endswith("Z") else s
            dt = datetime.fromisoformat(iso)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.timestamp()
        except ValueError:
            pass
    return None


def is_older_pinned_post(post_idx: int, posts: list, max_pinned_age_days: int = 14) -> bool:
    """
    Explicitly evaluates a post's timestamp against the rest of the profile feed
    to identify and ignore older pinned posts at the top of a venue's grid.

    Instagram profile grids are strictly reverse-chronological except for up to 3 pinned
    posts at the top. A post is treated as an older pinned post if:
    1. Its timestamp is older than any subsequent post lower in the profile feed
       (out-of-order top-of-grid post), OR
    2. It is marked as pinned by Apify and its timestamp is older than the newest post
       or older than `max_pinned_age_days`.
    """
    post = posts[post_idx]
    post_ts = parse_post_timestamp(post.get("timestamp"))
    is_pinned_flag = bool(
        post.get("isPinned")
        or post.get("is_pinned")
        or post.get("pinned_for_users")
    )

    if post_ts is None:
        return is_pinned_flag

    subsequent_timestamps = [
        ts
        for p in posts[post_idx + 1 :]
        if (ts := parse_post_timestamp(p.get("timestamp"))) is not None
    ]

    # 1. If any post appearing later in the grid has a newer timestamp, this top post is pinned from the past
    if subsequent_timestamps and post_ts < max(subsequent_timestamps):
        return True

    # 2. If explicitly flagged as pinned and older than the newest post or older than max_pinned_age_days
    all_timestamps = [
        ts
        for p in posts
        if (ts := parse_post_timestamp(p.get("timestamp"))) is not None
    ]
    if is_pinned_flag:
        if all_timestamps and post_ts < max(all_timestamps):
            return True
        age_seconds = datetime.now(timezone.utc).timestamp() - post_ts
        if age_seconds > max_pinned_age_days * 86400:
            return True

    return False


# Helper to safely extract posts from any Apify profile schema
def extract_posts_from_profile(profile: dict) -> list:
    raw_posts = None
    for key in ["latestPosts", "latest_posts", "posts", "items"]:
        val = profile.get(key)
        if isinstance(val, list) and len(val) > 0:
            raw_posts = val
            break

    if raw_posts is not None:
        normalized = []
        for post in raw_posts:
            if not isinstance(post, dict):
                continue
            shortcode = extract_shortcode(post)
            canonical_url = (
                f"https://www.instagram.com/p/{shortcode}/"
                if shortcode
                else (post.get("url") or post.get("inputUrl"))
            )
            enriched = dict(post)
            enriched["shortcode"] = shortcode
            enriched["shortCode"] = shortcode
            enriched["url"] = canonical_url
            normalized.append(enriched)
        return normalized

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
            shortcode = extract_shortcode(node)
            normalized.append({
                "shortcode": shortcode,
                "shortCode": shortcode,
                "url": f"https://www.instagram.com/p/{shortcode}/" if shortcode else None,
                "displayUrl": node.get("display_url") or node.get("thumbnail_src"),
                "caption": caption_text,
                "timestamp": node.get("taken_at_timestamp"),
                "isPinned": bool(node.get("is_pinned") or node.get("pinned_for_users")),
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


def check_shortcode_column_exists() -> bool:
    """Checks whether the Supabase 'events' table has a dedicated 'shortcode' column."""
    try:
        res = requests.get(
            f"{SUPABASE_URL}/rest/v1/events",
            params={"select": "shortcode", "limit": "1"},
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
            },
            timeout=10,
        )
        return res.status_code == 200
    except Exception:
        return False


def map_extraction_to_supabase_row(
    extracted: dict,
    default_venue: str,
    permanent_image_url: Optional[str],
    post_url: Optional[str],
    shortcode: Optional[str] = None,
    include_shortcode_column: bool = False,
) -> dict:
    """Maps the AI Studio flyer extraction schema to the Supabase 'events' table schema.
    Note: 'is_approved' is intentionally omitted from the payload so Postgres automatically
    applies the column default (false) on insert without conflicting with existing rows.
    """
    raw_time = extracted.get("doors_time") or extracted.get("show_time")
    vibe_tags = extracted.get("vibe_tags") or ["Nightlife"]
    canonical_post_url = post_url or (f"https://www.instagram.com/p/{shortcode}/" if shortcode else None)

    row = {
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
        "post_url": canonical_post_url,
        "status": "approved",
        "confidence_score": extracted.get("confidence_score", 0.95),
    }
    if include_shortcode_column and shortcode:
        row["shortcode"] = shortcode
    return row


VENUE_NOISE_WORDS = {
    "the",
    "mn",
    "mpls",
    "minneapolis",
    "stp",
    "st",
    "paul",
    "saint",
    "of",
    "bar",
    "lounge",
    "theater",
    "theatre",
    "nightclub",
    "club",
}


def normalize_venue_name(venue_name: Optional[str], strip_noise: bool = False) -> str:
    """Normalizes a venue name for substring and similarity comparisons."""
    if not venue_name:
        return ""
    cleaned = re.sub(r"[^a-z0-9\s]", " ", venue_name.lower())
    tokens = [t for t in cleaned.split() if t]
    if strip_noise:
        filtered = [t for t in tokens if t not in VENUE_NOISE_WORDS]
        if filtered:
            tokens = filtered
    return " ".join(tokens)


def are_venues_similar(
    venue_a: Optional[str],
    venue_b: Optional[str],
    threshold: float = 0.72,
) -> bool:
    """
    Returns True if two venue names refer to the same venue using substring
    matching, core token normalization (e.g., 'THE SALOON' vs 'THE SALOON MN'),
    or SequenceMatcher string similarity.
    """
    norm_a = normalize_venue_name(venue_a, strip_noise=False)
    norm_b = normalize_venue_name(venue_b, strip_noise=False)
    if not norm_a or not norm_b:
        return False

    # 1. Exact or direct substring check on normalized names
    if norm_a == norm_b:
        return True
    if min(len(norm_a), len(norm_b)) >= 3 and (norm_a in norm_b or norm_b in norm_a):
        return True

    # 2. Core venue name check after stripping common city/article suffixes ('the', 'mn', 'mpls', etc.)
    core_a = normalize_venue_name(venue_a, strip_noise=True)
    core_b = normalize_venue_name(venue_b, strip_noise=True)
    if core_a and core_b:
        if core_a == core_b:
            return True
        compact_a = core_a.replace(" ", "")
        compact_b = core_b.replace(" ", "")
        if min(len(compact_a), len(compact_b)) >= 3 and (
            compact_a in compact_b or compact_b in compact_a
        ):
            return True
        if SequenceMatcher(None, core_a, core_b).ratio() >= threshold:
            return True

    # 3. Full normalized string similarity ratio check
    return SequenceMatcher(None, norm_a, norm_b).ratio() >= threshold


def fetch_existing_events_by_date(event_date: str) -> List[dict]:
    """Queries Supabase for existing events scheduled on the exact same event_date."""
    if not event_date:
        return []
    try:
        res = requests.get(
            f"{SUPABASE_URL}/rest/v1/events",
            params={
                "select": "id,venue_name,title,event_date,post_url",
                "event_date": f"eq.{event_date}",
            },
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
            },
            timeout=10,
        )
        if res.status_code == 200:
            data = res.json()
            return data if isinstance(data, list) else []
    except Exception as e:
        print(f"   ⚠️ Warning querying existing events for {event_date}: {e}")
    return []


def find_matching_venue_event(candidate_venue: str, existing_events: List[dict]) -> Optional[dict]:
    """Checks if any event on the same date already has a matching or similar venue_name."""
    for existing in existing_events:
        existing_venue = existing.get("venue_name") or ""
        if are_venues_similar(candidate_venue, existing_venue):
            return existing
    return None


def is_post_older_than_hours(raw_ts, hours: float = 48.0) -> bool:
    """Returns True if the post timestamp is older than the specified number of hours."""
    post_ts = parse_post_timestamp(raw_ts)
    if post_ts is None:
        return False
    age_seconds = datetime.now(timezone.utc).timestamp() - post_ts
    return age_seconds > (hours * 3600.0)


def post_exists_in_supabase(
    shortcode: Optional[str],
    post_url: Optional[str],
    has_shortcode_col: bool = False,
) -> bool:
    """
    Queries Supabase public.events before calling Gemini to check if a post's
    shortcode or post_url already exists. Saves Gemini API credits on previously scraped posts.
    """
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    try:
        if has_shortcode_col and shortcode and post_url:
            res = requests.get(
                f"{SUPABASE_URL}/rest/v1/events",
                params={
                    "select": "id",
                    "or": f"(shortcode.eq.{shortcode},post_url.eq.{post_url})",
                    "limit": "1",
                },
                headers=headers,
                timeout=10,
            )
            if res.status_code == 200 and isinstance(res.json(), list) and len(res.json()) > 0:
                return True
        elif has_shortcode_col and shortcode:
            res = requests.get(
                f"{SUPABASE_URL}/rest/v1/events",
                params={"select": "id", "shortcode": f"eq.{shortcode}", "limit": "1"},
                headers=headers,
                timeout=10,
            )
            if res.status_code == 200 and isinstance(res.json(), list) and len(res.json()) > 0:
                return True

        if post_url:
            res = requests.get(
                f"{SUPABASE_URL}/rest/v1/events",
                params={"select": "id", "post_url": f"eq.{post_url}", "limit": "1"},
                headers=headers,
                timeout=10,
            )
            if res.status_code == 200 and isinstance(res.json(), list) and len(res.json()) > 0:
                return True
    except Exception as e:
        print(f"   ⚠️ Warning checking existing post in Supabase: {e}")

    return False


def backfill_existing_venue_date_row(
    venue_name: Optional[str],
    event_date: Optional[str],
    shortcode: Optional[str],
    post_url: Optional[str],
    has_shortcode_col: bool = False,
) -> None:
    """
    When a 409 unique_venue_event_date conflict occurs, checks the existing row for that
    venue_name + event_date and updates its shortcode/post_url if they are currently empty.
    """
    if not venue_name or not event_date:
        return
    select_cols = "id,post_url,shortcode" if has_shortcode_col else "id,post_url"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    try:
        res = requests.get(
            f"{SUPABASE_URL}/rest/v1/events",
            params={
                "select": select_cols,
                "venue_name": f"eq.{venue_name}",
                "event_date": f"eq.{event_date}",
                "limit": "1",
            },
            headers=headers,
            timeout=10,
        )
        if res.status_code != 200:
            return
        rows = res.json()
        if not isinstance(rows, list) or not rows:
            return

        existing = rows[0]
        existing_id = existing.get("id")
        if not existing_id:
            return

        patch_payload = {}
        if post_url and not existing.get("post_url"):
            patch_payload["post_url"] = post_url
        if has_shortcode_col and shortcode and not existing.get("shortcode"):
            patch_payload["shortcode"] = shortcode

        if patch_payload:
            patch_res = requests.patch(
                f"{SUPABASE_URL}/rest/v1/events",
                params={"id": f"eq.{existing_id}"},
                headers=headers,
                json=patch_payload,
                timeout=10,
            )
            if patch_res.status_code in (200, 204):
                print(
                    f"     🔄 Backfilled empty shortcode/post_url on existing row (id={existing_id}) "
                    f"for '{venue_name}' on {event_date}."
                )
    except Exception as e:
        print(f"     ⚠️ Warning backfilling shortcode/post_url on existing row: {e}")


def is_unique_constraint_violation(res: Optional[requests.Response]) -> bool:
    """Returns True if the Supabase REST response is a HTTP 409 / Postgres 23505 UNIQUE constraint violation."""
    if res is None:
        return False
    if res.status_code == 409:
        return True
    try:
        err_json = res.json()
        if isinstance(err_json, dict) and str(err_json.get("code")) == "23505":
            return True
    except Exception:
        pass
    text_lower = (res.text or "").lower()
    return "23505" in text_lower or "duplicate key value violates unique constraint" in text_lower


def insert_event_to_supabase(row: dict) -> dict:
    """
    Inserts a single scraped event row into Supabase one-by-one.
    Raises requests.exceptions.HTTPError on non-2xx responses (including HTTP 409 / code 23505).
    """
    clean_row = {k: v for k, v in row.items() if k != "is_approved"}
    endpoint = f"{SUPABASE_URL}/rest/v1/events"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    res = requests.post(endpoint, headers=headers, json=clean_row, timeout=15)
    res.raise_for_status()
    data = res.json() if res.text else {}
    return data[0] if isinstance(data, list) and data else data


def main():
    usernames = fetch_active_usernames()
    has_shortcode_col = check_shortcode_column_exists()
    print(
        f"   Database schema check: dedicated 'shortcode' column present = {has_shortcode_col} "
        "(using pre-Gemini lookup + 409/23505 constraint handling as venue watermark)"
    )

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

    inserted_count = 0

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

        processed_unpinned = 0
        max_unpinned_per_venue = 3

        for post_idx, post in enumerate(posts):
            if processed_unpinned >= max_unpinned_per_venue:
                break

            shortcode = extract_shortcode(post)
            post_url = (
                f"https://www.instagram.com/p/{shortcode}/"
                if shortcode
                else (post.get("url") or post.get("inputUrl"))
            )
            timestamp = post.get("timestamp")

            # CRITICAL: Evaluate timestamp and pinned-post filtering BEFORE any DB check, Gemini call, or DB insert
            # so a previously scraped pinned post is skipped cleanly without triggering the watermark break.
            if is_older_pinned_post(post_idx, posts):
                print(
                    f"   📌 Ignoring older pinned post at index {post_idx} "
                    f"(shortcode={shortcode} | timestamp={timestamp})"
                )
                continue

            # Save Gemini API credits: check if this non-pinned post's shortcode or post_url
            # already exists in public.events before downloading the image or calling Gemini.
            if post_exists_in_supabase(shortcode, post_url, has_shortcode_col):
                print(
                    f"   🛑 Watermark reached before Gemini for @{username}: post '{shortcode}' "
                    "already exists in public.events. Breaking venue loop."
                )
                break

            processed_unpinned += 1

            caption = post.get("caption", "")
            image_url = (
                post.get("displayUrl")
                or post.get("imageUrl")
                or post.get("display_url")
                or (post.get("images")[0] if isinstance(post.get("images"), list) and post.get("images") else None)
            )

            if not image_url or not post_url:
                continue

            print(
                f"   - Analyzing flyer from post (shortcode={shortcode} | timestamp={timestamp}) "
                "with Gemini Structured Output..."
            )

            img_response = requests.get(image_url, timeout=10)
            if img_response.status_code != 200:
                print("     Failed to download flyer image, skipping...")
                continue

            prompt = f"""
Analyze this nightlife event flyer image along with its Instagram post metadata:
- Venue: {venue_name} (@{username})
- Post Shortcode: {shortcode}
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
            except Exception as e:
                print(f"     -> Skipping post due to Gemini extraction error: {e}")
                time.sleep(5)
                continue

            if not extracted_data.get("is_event", True) or not extracted_data.get("event_date") or not extracted_data.get("event_name"):
                print("     No concrete event date/name found on post, skipping...")
                time.sleep(5)
                continue

            permanent_url = upload_flyer_to_supabase(image_url, venue_name)
            supabase_row = map_extraction_to_supabase_row(
                extracted_data,
                venue_name,
                permanent_url,
                post_url,
                shortcode=shortcode,
                include_shortcode_column=has_shortcode_col,
            )

            # Insert event one-by-one immediately after Gemini extraction
            try:
                insert_event_to_supabase(supabase_row)
                inserted_count += 1
                print(
                    f"     -> Inserted: {supabase_row['title']} ({supabase_row['event_date']}) "
                    f"[shortcode={shortcode}]"
                )
            except requests.exceptions.HTTPError as http_err:
                resp = http_err.response
                err_text = (resp.text if resp is not None else str(http_err)) or ""
                if is_unique_constraint_violation(resp):
                    if "events_shortcode_key" in err_text or "post_url" in err_text:
                        print(
                            f"     🛑 Watermark reached for @{username}: 409 (23505) on shortcode/post_url "
                            f"('{shortcode}'). Breaking venue loop."
                        )
                        break
                    elif "unique_venue_event_date" in err_text:
                        backfill_existing_venue_date_row(
                            supabase_row.get("venue_name"),
                            supabase_row.get("event_date"),
                            shortcode,
                            post_url,
                            has_shortcode_col=has_shortcode_col,
                        )
                        print(
                            f"     ⏭️ Duplicate venue+date skipped "
                            f"({supabase_row.get('venue_name')} on {supabase_row.get('event_date')})"
                        )
                        if is_post_older_than_hours(timestamp, hours=48.0):
                            print(
                                f"     🛑 Post timestamp ({timestamp}) is older than 48 hours on duplicate "
                                f"venue+date for @{username}. Breaking venue loop."
                            )
                            break
                        time.sleep(5)
                        continue
                    else:
                        print(
                            f"     🛑 Watermark reached for @{username}: 409 (23505) on post '{shortcode}' "
                            f"({err_text}). Breaking venue loop."
                        )
                        break
                print(
                    f"     -> Supabase HTTP error for @{username} ({shortcode}): "
                    f"{resp.status_code if resp is not None else ''} {err_text}"
                )
            except Exception as db_err:
                err_str = str(db_err)
                if "23505" in err_str or "409" in err_str:
                    if "unique_venue_event_date" in err_str:
                        backfill_existing_venue_date_row(
                            supabase_row.get("venue_name"),
                            supabase_row.get("event_date"),
                            shortcode,
                            post_url,
                            has_shortcode_col=has_shortcode_col,
                        )
                        print(
                            f"     ⏭️ Duplicate venue+date skipped "
                            f"({supabase_row.get('venue_name')} on {supabase_row.get('event_date')})"
                        )
                        if is_post_older_than_hours(timestamp, hours=48.0):
                            print(
                                f"     🛑 Post timestamp ({timestamp}) is older than 48 hours on duplicate "
                                f"venue+date for @{username}. Breaking venue loop."
                            )
                            break
                        time.sleep(5)
                        continue
                    print(
                        f"     🛑 Watermark reached for @{username}: post '{shortcode}' "
                        f"triggered 409 (23505). Breaking venue loop."
                    )
                    break
                print(f"     -> Supabase insert error for @{username} ({shortcode}): {db_err}")

            time.sleep(5)

    print(f"\n4. Sync complete! Inserted {inserted_count} new event(s) into Supabase (is_approved defaults to false).")


if __name__ == "__main__":
    main()
