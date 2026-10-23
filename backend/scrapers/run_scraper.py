import os
import time
import json
import requests
from pathlib import Path

_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if _env_path.exists():
    for _line in _env_path.read_text(encoding="utf-8").splitlines():
        if _line.strip() and not _line.startswith("#") and "=" in _line:
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())

API_TOKEN = os.environ.get("APIFY_TOKEN", "")
ACTOR_ID = "apify~instagram-profile-scraper"

run_url = f"https://api.apify.com/v2/acts/{ACTOR_ID}/runs?token={API_TOKEN}"

payload = {
    "usernames": ["thesaloonmn"]
}

print(f"Triggering {ACTOR_ID} for @thesaloonmn...")
response = requests.post(run_url, json=payload)

if response.status_code != 201:
    print("Error starting actor:", response.text)
    exit()

run_data = response.json()["data"]
run_id = run_data["id"]
dataset_id = run_data["defaultDatasetId"]
print(f"Scraper started! Run ID: {run_id}")

status_url = f"https://api.apify.com/v2/actor-runs/{run_id}?token={API_TOKEN}"
while True:
    status_res = requests.get(status_url).json()
    status = status_res["data"]["status"]
    print(f"Current status: {status}...")

    if status == "SUCCEEDED":
        break
    elif status in ["FAILED", "ABORTED", "TIMED_OUT"]:
        print("Scraper run failed.")
        exit()

    time.sleep(5)

dataset_url = f"https://api.apify.com/v2/datasets/{dataset_id}/items?token={API_TOKEN}"
items = requests.get(dataset_url).json()

print(f"\nTotal profiles fetched: {len(items)}")
if items:
    profile = items[0]

    if "error" in profile:
        print("\n--- ERROR RETURNED ---")
        print(json.dumps(profile, indent=2))
    else:
        print(f"\nVenue: {profile.get('fullName')} (@{profile.get('username')})")
        print(f"Bio: {profile.get('biography')}")

        latest_posts = profile.get("latestPosts", [])
        print(f"Latest posts found in profile payload: {len(latest_posts)}\n")

        for i, post in enumerate(latest_posts[:3]):
            print(f"--- POST {i+1} ---")
            print(f"Post URL: {post.get('url')}")
            print(f"Timestamp: {post.get('timestamp')}")
            print(f"Caption: {post.get('caption')}")
            print(f"Clean Flyer Image URL: {post.get('displayUrl')}")
            print("-" * 40)
