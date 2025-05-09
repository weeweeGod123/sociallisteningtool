import os
import httpx
import pandas as pd
from dotenv import load_dotenv
import time
import random
import re
import json
import argparse
import pymongo

# --- CONFIGURABLE VARIABLES ---
MAX_POSTS = 1000  # Set your maximum number of posts here
PAUSE_EVERY = 300  # Pause after every 500 posts
PAUSE_MIN = 3     # Minimum pause duration in seconds
PAUSE_MAX = 8    # Maximum pause duration in seconds
CSV_FILE = 'bluesky_api_posts.csv'
TOKENS_FILE = 'bsky_tokens.json'

# --- Token management ---
def save_tokens(access_jwt, refresh_jwt):
    with open(TOKENS_FILE, 'w') as f:
        json.dump({'accessJwt': access_jwt, 'refreshJwt': refresh_jwt}, f)

def load_tokens():
    if os.path.exists(TOKENS_FILE):
        with open(TOKENS_FILE, 'r') as f:
            data = json.load(f)
            return data.get('accessJwt'), data.get('refreshJwt')
    return None, None

def authenticate(identifier, password):
    print("Authenticating with Bluesky API...")
    session_url = 'https://bsky.social/xrpc/com.atproto.server.createSession'
    session_data = {'identifier': identifier, 'password': password}
    session_headers = {'Content-Type': 'application/json'}
    resp = httpx.post(session_url, json=session_data, headers=session_headers)
    resp.raise_for_status()
    session = resp.json()
    access_jwt = session['accessJwt']
    refresh_jwt = session['refreshJwt']
    save_tokens(access_jwt, refresh_jwt)
    print("Authentication successful.")
    return access_jwt, refresh_jwt

def refresh_token(refresh_jwt):
    print("Refreshing access token...")
    refresh_url = 'https://bsky.social/xrpc/com.atproto.server.refreshSession'
    headers = {'Authorization': f'Bearer {refresh_jwt}', 'Content-Type': 'application/json'}
    resp = httpx.post(refresh_url, headers=headers)
    if resp.status_code != 200:
        print("Refresh failed with status", resp.status_code)
        return None, None
    session = resp.json()
    access_jwt = session['accessJwt']
    refresh_jwt = session['refreshJwt']
    save_tokens(access_jwt, refresh_jwt)
    print("Token refresh successful.")
    return access_jwt, refresh_jwt

# Load credentials from .env
load_dotenv()
BLUESKY_IDENTIFIER = os.getenv('BLUESKY_IDENTIFIER')
BLUESKY_APP_PASSWORD = os.getenv('BLUESKY_APP_PASSWORD')
MONGO_URI = os.getenv('MONGO_URI')
# Always use 'social-listening' as the database and 'bluesky_posts' as the collection
MONGO_DB_NAME = 'social-listening'

if not BLUESKY_IDENTIFIER or not BLUESKY_APP_PASSWORD:
    print("Please set BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD in your .env file.")
    exit(1)

# --- MongoDB setup ---
mongo_client = None
mongo_collection = None
if MONGO_URI:
    try:
        mongo_client = pymongo.MongoClient(MONGO_URI)
        mongo_db = mongo_client[MONGO_DB_NAME]
        mongo_collection = mongo_db['bluesky_posts']
        print(f"[Bluesky Scraper] Connected to MongoDB: {MONGO_DB_NAME} (collection: bluesky_posts)", flush=True)
    except Exception as e:
        print(f"[Bluesky Scraper] Could not connect to MongoDB: {e}", flush=True)
        mongo_collection = None
else:
    print("[Bluesky Scraper] MONGO_URI not set in .env. Skipping MongoDB storage.", flush=True)

def classify_topic(text):
    text_lower = text.lower()
    topics = {
        "Politics": ["government", "policy", "minister", "parliament", "election", "vote", "president", "chancellor", "prime minister", "albanese", "trump", "biden"],
        "Education": ["university", "school", "student", "education", "academic", "professor", "research", "study", "campus"],
        "Economy": ["money", "economy", "economic", "finance", "market", "investment", "salary", "price", "cost", "business"],
        "Technology": ["tech", "technology", "digital", "software", "computer", "internet", "ai", "artificial intelligence", "app", "elon", "tesla", "spacex", "robot", "twitter", "x.com"],
        "Health": ["health", "medical", "doctor", "hospital", "disease", "treatment", "patient", "covid", "vaccine"],
        "Environment": ["climate", "environment", "sustainability", "renewable", "energy", "green", "pollution", "carbon"],
        "Agriculture": ["farm", "agriculture", "crop", "wheat", "barley", "canola", "harvest", "farming", "farmer", "soil", "plant"]
    }
    topic_scores = {}
    for topic, keywords in topics.items():
        score = sum(1 for keyword in keywords if keyword in text_lower)
        if score > 0:
            topic_scores[topic] = score
    if topic_scores:
        top_topic = max(topic_scores.items(), key=lambda x: x[1])[0]
        return top_topic
    else:
        return "General"

def main():
    # --- Argument parsing ---
    parser = argparse.ArgumentParser(description='Bluesky API Scraper')
    parser.add_argument('--query', type=str, required=True, help='Search query string')
    parser.add_argument('--max-posts', type=int, default=1000, help='Maximum number of posts to fetch')
    parser.add_argument('--csv-file', type=str, default='bluesky_api_posts.csv', help='CSV file to save results')
    args = parser.parse_args()

    MAX_POSTS = args.max_posts
    CSV_FILE = args.csv_file
    search_query = args.query

    # Preprocess: remove logical operators (AND, OR, AND NOT)
    search_query_cleaned = re.sub(r'\b(AND NOT|AND|OR)\b', '', search_query, flags=re.IGNORECASE)
    search_query_cleaned = re.sub(r'\s+', ' ', search_query_cleaned).strip()

    print(f"[Bluesky Scraper] Original query: {search_query}", flush=True)
    print(f"[Bluesky Scraper] Cleaned query: {search_query_cleaned}", flush=True)

    print(f"[Bluesky Scraper] Starting Bluesky API Scraper", flush=True)

    # Step 1: Get tokens (authenticate or refresh as needed)
    print("[Bluesky Scraper] Loading tokens...", flush=True)
    access_token, refresh_token_val = load_tokens()
    if access_token:
        print("[Bluesky Scraper] Found saved access token. Testing validity...", flush=True)
        # Try a test request to see if access_token is valid
        test_url = 'https://bsky.social/xrpc/app.bsky.feed.searchPosts'
        test_headers = {'Authorization': f'Bearer {access_token}', 'Content-Type': 'application/json'}
        test_params = {'q': 'test', 'limit': 1}
        try:
            resp = httpx.get(test_url, headers=test_headers, params=test_params)
            if resp.status_code == 401 and refresh_token_val:
                print("[Bluesky Scraper] Access token expired, attempting refresh...", flush=True)
                # Try to refresh
                access_token, refresh_token_val = refresh_token(refresh_token_val)
                if not access_token:
                    print("[Bluesky Scraper] Refresh failed, re-authenticating...", flush=True)
                    access_token, refresh_token_val = authenticate(BLUESKY_IDENTIFIER, BLUESKY_APP_PASSWORD)
            elif resp.status_code != 200:
                print("[Bluesky Scraper] Access token invalid, re-authenticating...", flush=True)
                access_token, refresh_token_val = authenticate(BLUESKY_IDENTIFIER, BLUESKY_APP_PASSWORD)
            else:
                print("[Bluesky Scraper] Loaded valid access token from file.", flush=True)
        except Exception as e:
            print(f"[Bluesky Scraper] Error testing access token, re-authenticating... {e}", flush=True)
            access_token, refresh_token_val = authenticate(BLUESKY_IDENTIFIER, BLUESKY_APP_PASSWORD)
    else:
        print("[Bluesky Scraper] No saved tokens found, authenticating...", flush=True)
        access_token, refresh_token_val = authenticate(BLUESKY_IDENTIFIER, BLUESKY_APP_PASSWORD)

    print(f"[Bluesky Scraper] Search query: {search_query}", flush=True)
    print(f"[Bluesky Scraper] Max posts: {MAX_POSTS}", flush=True)
    print(f"[Bluesky Scraper] Output CSV: {CSV_FILE}", flush=True)

    # Step 3: Search for posts using the API
    search_url = 'https://bsky.social/xrpc/app.bsky.feed.searchPosts'
    search_headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
    }

    params = {
        'q': search_query_cleaned,
        'limit': 100,  # max per request
    }

    # Prepare CSV file (write header)
    header = [
        'post_id', 'username', 'user_location', 'content_text', 'url', 'created_at',
        'likes', 'comments', 'platform', 'topic_classification'
    ]
    with open(CSV_FILE, 'w', encoding='utf-8') as f:
        f.write(','.join(header) + '\n')

    cursor = None
    batch_num = 1
    post_count = 0
    saved_count = 0
    print("[Bluesky Scraper] Fetching posts...", flush=True)
    while True:
        if cursor:
            params['cursor'] = cursor
            print(f"[Bluesky Scraper] [Batch {batch_num}] Using cursor: {cursor}", flush=True)
        else:
            print(f"[Bluesky Scraper] [Batch {batch_num}] First request (no cursor)", flush=True)
        resp = httpx.get(search_url, headers=search_headers, params=params)
        # If unauthorized, try to refresh token and retry
        if resp.status_code == 401 and refresh_token_val:
            print("[Bluesky Scraper] Access token expired during fetch, refreshing...", flush=True)
            access_token, refresh_token_val = refresh_token(refresh_token_val)
            if not access_token:
                print("[Bluesky Scraper] Refresh failed, re-authenticating...", flush=True)
                access_token, refresh_token_val = authenticate(BLUESKY_IDENTIFIER, BLUESKY_APP_PASSWORD)
            search_headers['Authorization'] = f'Bearer {access_token}'
            resp = httpx.get(search_url, headers=search_headers, params=params)
        resp.raise_for_status()
        data = resp.json()
        posts = data.get('posts', [])
        if not posts:
            print(f"[Bluesky Scraper] [Batch {batch_num}] No posts found in this batch.", flush=True)
        batch_docs = []
        for post in posts:
            # Extract Bluesky fields
            post_id = post.get('cid', '')
            username = post['author'].get('handle', '')
            user_location = ''  # Not available
            content_text = post['record'].get('text', '').replace('"', '""')
            # Construct Bluesky URL
            author_did = post['author'].get('did', '')
            uri = post.get('uri', '')
            post_tid = uri.split('/')[-1] if uri else ''
            url = f'https://bsky.app/profile/{author_did}/post/{post_tid}' if author_did and post_tid else ''
            created_at = post['record'].get('createdAt', '')
            likes = int(post.get('likeCount', 0))
            comments = int(post.get('replyCount', 0))
            platform = 'Bluesky'
            topic_classification = classify_topic(content_text)
            row = [
                post_id,
                username,
                user_location,
                f'"{content_text}"',
                url,
                created_at,
                str(likes),
                str(comments),
                platform,
                topic_classification
            ]
            with open(CSV_FILE, 'a', encoding='utf-8') as f:
                f.write(','.join(row) + '\n')
            # Prepare document for MongoDB
            doc = {
                'post_id': post_id,
                'username': username,
                'user_location': user_location,
                'content_text': content_text,
                'url': url,
                'created_at': created_at,
                'likes': likes,
                'comments': comments,
                'platform': platform,
                'topic_classification': topic_classification
            }
            batch_docs.append(doc)
            saved_count += 1
            if saved_count % 50 == 0:
                print(f"[Bluesky Scraper] Saved {saved_count} posts so far...", flush=True)
            post_count += 1
            if post_count % PAUSE_EVERY == 0:
                pause_time = random.randint(PAUSE_MIN, PAUSE_MAX)
                print(f"[Bluesky Scraper] Reached {post_count} posts. Pausing for {pause_time} seconds...", flush=True)
                time.sleep(pause_time)
            if saved_count >= MAX_POSTS:
                print(f"[Bluesky Scraper] Reached MAX_POSTS ({MAX_POSTS}) for saved posts. Stopping.", flush=True)
                break
        # Insert batch into MongoDB
        if mongo_collection is not None and batch_docs:
            try:
                result = mongo_collection.insert_many(batch_docs)
                print(f"[Bluesky Scraper] Inserted {len(result.inserted_ids)} posts to MongoDB for batch {batch_num}.", flush=True)
            except Exception as e:
                print(f"[Bluesky Scraper] MongoDB insert error for batch {batch_num}: {e}", flush=True)
        print(f"[Bluesky Scraper] [Batch {batch_num}] Fetched {len(posts)} posts, total fetched: {post_count}, total saved: {saved_count}", flush=True)
        if saved_count >= MAX_POSTS:
            break
        cursor = data.get('cursor')
        if not cursor or not posts:
            print(f"[Bluesky Scraper] [Batch {batch_num}] No more posts or no cursor returned. Stopping.", flush=True)
            break
        batch_num += 1

    print(f"[Bluesky Scraper] Fetched {post_count} posts in total, saved {saved_count} posts.", flush=True)
    print(f"[Bluesky Scraper] Saved posts to {CSV_FILE}", flush=True)

if __name__ == '__main__':
    main() 