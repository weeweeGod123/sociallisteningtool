import sys
import os
import time
import asyncio
from datetime import datetime, timedelta
import csv
from configparser import ConfigParser
from random import randint, random, choice
import argparse
import re
import json
import subprocess
import requests
from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path

# Load .env from parent directory (server/.env)
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)
print(f"[OK] Loaded DB name: {os.getenv('MONGO_DB_NAME')}")

# MongoDB setup
client = MongoClient(os.getenv("MONGO_URI"))
db = client[os.getenv("MONGO_DB_NAME", "social-listening")]
collection = db["tweets"]

# Print debug information to help with troubleshooting
print(f"{datetime.now()} - Twitter Scraper Starting")
print(f"{datetime.now()} - Python version: {sys.version}")
print(f"{datetime.now()} - Current directory: {os.getcwd()}")
print(f"{datetime.now()} - Arguments: {sys.argv}")

try:
    # Updated import for twikit 2.3.3
    from twikit import Client, errors
    print(f"{datetime.now()} - Successfully imported twikit")
except ImportError as e:
    print(f"{datetime.now()} - ERROR: Failed to import twikit module: {e}")
    print(f"{datetime.now()} - Make sure you've installed all requirements using: pip install -r requirements.txt")
    
    # Only exit if running directly, not when imported for tests
    if __name__ == "__main__":
        sys.exit(1)

# Create argument parser
parser = argparse.ArgumentParser(description='Twitter Scraper')
parser.add_argument('--api-mode', action='store_true', help='Run in API mode')

# Only parse arguments when run directly, not when imported (for tests)
if __name__ == "__main__":
    args = parser.parse_args()
else:
    # When imported (e.g. for testing), use default args
    args = parser.parse_args([])

print(f"{datetime.now()} - API Mode: {args.api_mode}")

# Check if we should import search parameters from API
search_params_file = os.path.join(os.getcwd(), 'search_params.py')
print(f"{datetime.now()} - Looking for search parameters file at: {search_params_file}")
print(f"{datetime.now()} - File exists: {os.path.exists(search_params_file)}")

# Always use search_params.py if it exists, regardless of API mode flag
if os.path.exists(search_params_file):
    try:
        print(f"{datetime.now()} - Importing search parameters from file")
        from search_params import SEARCH_PARAMS, MINIMUM_TWEETS
        print(f"{datetime.now()} - Successfully imported search parameters: {SEARCH_PARAMS}")
    except ImportError as e:
        print(f"{datetime.now()} - Warning: Failed to import search parameters from file: {e}")
        print(f"{datetime.now()} - Falling back to default parameters")
        # Default parameters below will be used
else:
    print(f"{datetime.now()} - Using default search parameters")
    # Default Twitter advanced search parameters
    SEARCH_PARAMS = {
        "all_of_these_words": ["crop"],     # ALL these words must appear (AND)
        "this_exact_phrase": "",      # This exact phrase must appear
        "any_of_these_words": ["wheat", "barley", "canola"],  # ANY of these words (OR)
        "none_of_these_words": ["Washington", "AAgWa"],  # NONE of these words
        "these_hashtags": [],    # These hashtags
        "language": "en",                    # Language
        "from_date": "2018-01-01",           # Start date
        "to_date": "2025-03-19",              # End date
        # New parameters for location-based search
        "location_mentions": ["Western Australia", "WA", "Perth"],  # Locations mentioned in tweets
        "author_locations": ["australia", "western australia", "wa", "perth"]  # User location fields
    }

    MINIMUM_TWEETS = 9  # Reduced from 50 to 5 for testing

# Conservative timing settings
TIMING_SETTINGS = {
    "min_delay_between_requests": 30,    # Increased to 30 seconds for safety
    "max_delay_between_requests": 60,    # Increased to 60 seconds for safety
    "rest_period_chance": 0.15,          # Increased to 15% chance of taking a longer break
    "min_rest_period": 120,              # Increased to 2 minutes
    "max_rest_period": 300,              # Increased to 5 minutes
    "session_limit": 10,                 # Reduced to 10 requests per session
    "session_break_time": 300,           # Increased to 5 minutes between sessions
}

# Human-like behavior simulation
def simulate_human_delay():
    # Base delay between requests
    delay = randint(TIMING_SETTINGS["min_delay_between_requests"], 
                   TIMING_SETTINGS["max_delay_between_requests"])
    
    # Sometimes add a small random variation
    if random() < 0.4:  # 40% chance (increased from 30%)
        delay += randint(3, 15)  # More variation (increased from 1-5)
    
    return delay

def take_rest_break():
    if random() < TIMING_SETTINGS["rest_period_chance"]:
        rest_time = randint(TIMING_SETTINGS["min_rest_period"], 
                          TIMING_SETTINGS["max_rest_period"])
        print(f'{datetime.now()} - Taking a short break for {rest_time//60} minutes to avoid rate limits...')
        time.sleep(rest_time)
        return True
    return False

def take_session_break():
    print(f'{datetime.now()} - Taking a session break for {TIMING_SETTINGS["session_break_time"]//60} minutes...')
    time.sleep(TIMING_SETTINGS["session_break_time"])

# Build query based on Twitter's advanced search format
def build_query():
    query_parts = []
    
    # All of these words (AND)
    if SEARCH_PARAMS.get("all_of_these_words"):
        # For each word, add it with a plus sign to ensure it MUST appear
        all_words = " ".join([f"+{word}" for word in SEARCH_PARAMS["all_of_these_words"]])
        query_parts.append(all_words)
    
    # This exact phrase
    if SEARCH_PARAMS.get("this_exact_phrase"):
        # Add + to the exact phrase to ensure it MUST appear
        exact_phrase = f'+"{SEARCH_PARAMS["this_exact_phrase"]}"'
        query_parts.append(exact_phrase)
    
    # Any of these words (OR)
    if SEARCH_PARAMS.get("any_of_these_words"):
        any_words = " OR ".join(SEARCH_PARAMS["any_of_these_words"])
        query_parts.append(f"({any_words})")
        
    # Location mentions (for tweets talking about these locations)
    if SEARCH_PARAMS.get("location_mentions"):
        location_terms = " OR ".join([f'"{loc}"' for loc in SEARCH_PARAMS["location_mentions"]])
        query_parts.append(f"({location_terms})")
    
    # None of these words (NOT)
    if SEARCH_PARAMS.get("none_of_these_words"):
        none_words = " ".join([f'-{word}' for word in SEARCH_PARAMS["none_of_these_words"]])
        query_parts.append(none_words)
    
    # Hashtags
    if SEARCH_PARAMS.get("these_hashtags"):
        hashtags = " ".join([f'#{tag}' for tag in SEARCH_PARAMS["these_hashtags"]])
        query_parts.append(hashtags)
    
    # Language
    if SEARCH_PARAMS.get("language"):
        query_parts.append(f'lang:{SEARCH_PARAMS["language"]}')
    
    # Date range
    if SEARCH_PARAMS.get("from_date") and SEARCH_PARAMS.get("to_date"):
        query_parts.append(f'since:{SEARCH_PARAMS["from_date"]} until:{SEARCH_PARAMS["to_date"]}')
    
    # Combine all parts
    final_query = " ".join(query_parts)
    return final_query

# Check if a user's location matches our criteria
def is_australian_location(location):
    if not location or location == "Unknown":
        return False
    
    location = location.lower()
    return any(loc in location for loc in SEARCH_PARAMS.get("author_locations", []))

# Check if a tweet mentions our locations
def mentions_location(text):
    if not text:
        return False
    
    text = text.lower()
    return any(loc.lower() in text for loc in SEARCH_PARAMS.get("location_mentions", []))

# Get the query
QUERY = build_query()
print(f"Using Twitter Advanced Search equivalent query: {QUERY}")

# Function to get tweets - now truly async with twikit 2.3.3 and retry logic
async def get_tweets_async(tweets):
    if tweets is None:
        #* get tweets
        print(f'{datetime.now()} - Getting tweets...')
        # For twikit 2.3.3, search_tweet needs product parameter
        
        # Add retry logic with exponential backoff
        max_retries = 3
        retry_count = 0
        last_error = None
        
        while retry_count < max_retries:
            try:
                tweets = await client.search_tweet(QUERY, product='Top')
                if retry_count > 0:
                    print(f'{datetime.now()} - Successfully retrieved tweets after {retry_count} retries')
                return tweets
            except Exception as e:
                last_error = e
                retry_count += 1
                error_str = str(e)
                
                # If it's a 404 error, likely a temporary API issue
                if "status: 404" in error_str:
                    # Exponential backoff: wait longer with each retry
                    wait_time = 5 * (2 ** retry_count)  # 10s, 20s, 40s
                    print(f'{datetime.now()} - Search error (404): {e}')
                    print(f'{datetime.now()} - Retrying in {wait_time} seconds (attempt {retry_count}/{max_retries})...')
                    time.sleep(wait_time)
                    continue
                # For other errors, raise immediately
                print(f'Search error: {e}')
                raise e
        
        # If we've exhausted all retries
        print(f'{datetime.now()} - Failed to retrieve tweets after {max_retries} attempts. Last error: {last_error}')
        raise last_error
    else:
        # More human-like delay between requests
        wait_time = simulate_human_delay()
        print(f'{datetime.now()} - Getting next tweets after {wait_time} seconds...')
        time.sleep(wait_time)
        
        # Occasionally take a rest break
        take_rest_break()
        
        # For twikit 2.3.3, next() is async and needs to be awaited
        retry_count = 0
        max_retries = 2
        last_error = None
        
        while retry_count < max_retries:
            try:
                tweets = await tweets.next()
                return tweets
            except Exception as e:
                last_error = e
                retry_count += 1
                error_str = str(e)
                
                # If it's a 404 error, likely a temporary API issue
                if "status: 404" in error_str:
                    # Exponential backoff: wait longer with each retry
                    wait_time = 5 * (2 ** retry_count)  # 10s, 20s
                    print(f'{datetime.now()} - Next page error (404): {e}')
                    print(f'{datetime.now()} - Retrying in {wait_time} seconds (attempt {retry_count}/{max_retries})...')
                    time.sleep(wait_time)
                    continue
                # For other errors, raise immediately
                print(f'Next page error: {e}')
                raise e
        
        # If we've exhausted all retries
        print(f'{datetime.now()} - Failed to retrieve next page after {max_retries} attempts. Last error: {last_error}')
        raise last_error

# Non-async wrapper for compatibility
def get_tweets(tweets):
    # Use asyncio.run to run the async function
    return asyncio.run(get_tweets_async(tweets))

#* login credentials
config = ConfigParser()
config.read('config.ini')
username = config['X']['username']
email = config['X']['email']
password = config['X']['password']

#* create a csv file
# Note: datetime values are stored in ISO format (YYYY-MM-DDThh:mm:ss) to match Reddit's CSV format
with open('tweets.csv', 'w', newline='') as file:
    writer = csv.writer(file)
    writer.writerow([
        'post_id', 'username', 'user_location', 'content_text', 'url', 'created_at', 
        'likes', 'comments', 'platform', 'topic_classification'
    ])


#* authenticate to X.com
def authenticate_client():
    client = Client(language='en-US')
    
    # Check if cookies file exists and try to use it
    if os.path.exists('cookies.json'):
        try:
            print(f'{datetime.now()} - Attempting to authenticate with saved cookies...')
            client.load_cookies('cookies.json')
            print(f'{datetime.now()} - Successfully authenticated with cookies')
        except Exception as e:
            print(f'{datetime.now()} - Cookie authentication failed: {e}')
            print(f'{datetime.now()} - Using browser_login.py for interactive authentication...')
            
            # Launch browser login process
            if run_browser_login():
                # Try again with the new cookies
                client = Client(language='en-US')
                client.load_cookies('cookies.json')
                print(f'{datetime.now()} - Successfully authenticated with refreshed cookies')
            else:
                print(f'{datetime.now()} - Browser login failed. Manual intervention required.')
                raise Exception("Authentication failed - manual login required")
    else:
        # No cookies file exists, use browser login directly
        print(f'{datetime.now()} - No cookies.json file found. Using browser_login.py...')
        if run_browser_login():
            # Load the newly created cookies
            client = Client(language='en-US')
            client.load_cookies('cookies.json')
            print(f'{datetime.now()} - Successfully authenticated with browser login')
        else:
            print(f'{datetime.now()} - Browser login failed. Manual intervention required.')
            raise Exception("Authentication failed - manual login required")
            
    return client

# Helper function to run browser_login.py
def run_browser_login():
    try:
        print(f'{datetime.now()} - Starting browser_login.py...')
        # Run browser_login with visible window for interactive login
        result = subprocess.run([sys.executable, 'browser_login.py'], 
                               capture_output=True, 
                               text=True, 
                               cwd=os.getcwd())
        
        if result.returncode == 0:
            print(f'{datetime.now()} - Browser login successful')
            return True
        else:
            print(f'{datetime.now()} - Browser login failed: {result.stderr}')
            return False
    except Exception as e:
        print(f'{datetime.now()} - Error running browser_login: {e}')
        return False

# Main execution function - now using async/await with twikit 2.3.3
async def main_async():
    global client
    
    # Flag to track if we've already tried to refresh authentication
    auth_refresh_attempted = False
    # Flag to track if we've tried to restart the search from scratch
    search_restart_attempted = False
    # Counter for consecutive errors to detect persistent issues
    consecutive_error_count = 0
    
    try:
        client = authenticate_client()
    except Exception as auth_error:
        print(f'{datetime.now()} - Authentication failed: {auth_error}')
        print(f'{datetime.now()} - Manual intervention required')
        exit(1)

    tweet_count = 0
    tweets = None
    additional_keywords_query = None
    requests_in_session = 0

    # Track batch processing
    current_batch_count = 0
    total_batches = 0
    batch_size = MINIMUM_TWEETS  # Use the configured minimum as our batch size
    batch_pause_minutes = 10     # Wait 10 minutes between batches
    
    # Define MAX_BATCHES at module level if not already defined by run_scraper.py
    global MAX_BATCHES
    if 'MAX_BATCHES' not in globals():
        MAX_BATCHES = float('inf')  # Default to unlimited batches
    
    print(f'{datetime.now()} - Starting continuous batch processing with {batch_size} tweets per batch')
    print(f'{datetime.now()} - Will pause for {batch_pause_minutes} minutes between batches')
    if MAX_BATCHES < float('inf'):
        print(f'{datetime.now()} - Maximum batches to collect: {MAX_BATCHES}')
    else:
        print(f'{datetime.now()} - No maximum batch limit - will collect until no more tweets')
    
    # Continue scraping until we run out of tweets
    continue_scraping = True
    
    while continue_scraping:
        try:
            # Check if we need a session break
            if requests_in_session >= TIMING_SETTINGS["session_limit"]:
                take_session_break()
                requests_in_session = 0
            
            if additional_keywords_query is None:
                # Call with await since it's async now
                tweets = await get_tweets_async(tweets)
            else:
                # If we're on the second pass with broader query
                if tweets is None:
                    print(f'{datetime.now()} - Trying broader query: {additional_keywords_query}')
                    # Updated for twikit 2.3.3 - needs product parameter
                    tweets = await client.search_tweet(additional_keywords_query, product='Top')
                else:
                    wait_time = simulate_human_delay()
                    print(f'{datetime.now()} - Getting next tweets with broader query after {wait_time} seconds...')
                    time.sleep(wait_time)
                    
                    # Occasionally take a rest break
                    take_rest_break()
                    
                    # Updated for twikit 2.3.3 - needs await
                    tweets = await tweets.next()
            
            requests_in_session += 1
            # Reset consecutive error count since we succeeded
            consecutive_error_count = 0
            # Reset search restart flag since we succeeded
            search_restart_attempted = False
                    
        except errors.TooManyRequests as e:
            consecutive_error_count += 1
            rate_limit_reset = datetime.fromtimestamp(e.rate_limit_reset)
            print(f'{datetime.now()} - Rate limit reached. Waiting until {rate_limit_reset}')
            wait_time = rate_limit_reset - datetime.now()
            # Add extra random buffer time (1-3 minutes)
            buffer_time = randint(60, 180)
            total_wait = wait_time.total_seconds() + buffer_time
            print(f'Adding {buffer_time} seconds buffer time to be safe')
            time.sleep(total_wait)
            requests_in_session = 0  # Reset session counter after rate limit
            continue
        except Exception as e:
            consecutive_error_count += 1
            error_str = str(e)
            
            # Check for authentication errors (401)
            if ("status: 401" in error_str or "Could not authenticate you" in error_str) and not auth_refresh_attempted:
                print(f'{datetime.now()} - Authentication error detected: {error_str}')
                print(f'{datetime.now()} - Attempting to refresh authentication with browser_login.py...')
                
                # Set flag to prevent infinite retry loop
                auth_refresh_attempted = True
                
                # Run browser_login.py directly
                if run_browser_login():
                    print(f'{datetime.now()} - Successfully refreshed authentication')
                    
                    # Reinitialize client with new cookies
                    client = Client(language='en-US')
                    client.load_cookies('cookies.json')
                    
                    print(f'{datetime.now()} - Continuing search with refreshed authentication')
                    
                    # Reset the tweets object to start fresh
                    tweets = None
                    continue
                else:
                    print(f'{datetime.now()} - Browser login failed. Manual intervention required')
                    break
            
            # Check if it's really a rate limit error misclassified as AccountSuspended
            elif "Rate limit exceeded" in error_str or "status: 429" in error_str:
                total_wait_minutes = randint(16, 20)  # Randomize wait time
                
                # Calculate and display the target reset time
                current_time = datetime.now()
                reset_time = current_time + timedelta(minutes=total_wait_minutes)
                
                print(f'{current_time} - Rate limit reached. Waiting for {total_wait_minutes} minutes before retrying...')
                print(f'Rate limit will reset at approximately: {reset_time}')
                
                # Display countdown timer
                for remaining_minutes in range(total_wait_minutes, 0, -1):
                    print(f'Waiting: {remaining_minutes} minutes remaining until {reset_time}')
                    time.sleep(60)  # Wait 1 minute between updates
                    
                print(f'{datetime.now()} - Resuming after rate limit wait')
                requests_in_session = 0  # Reset session counter after rate limit
                continue
            
            # Handle 404 errors with a more aggressive recovery approach
            elif "status: 404" in error_str:
                print(f'{datetime.now()} - Received 404 error: {error_str}')
                
                # If we've had too many consecutive errors, try a more drastic approach
                if consecutive_error_count >= 3 and not search_restart_attempted:
                    print(f'{datetime.now()} - Too many consecutive errors. Attempting to restart search from scratch')
                    
                    # Take a longer break before restarting
                    wait_time = randint(30, 60)
                    print(f'{datetime.now()} - Waiting {wait_time} seconds before restarting...')
                    time.sleep(wait_time)
                    
                    # Reset everything for a fresh start
                    tweets = None
                    search_restart_attempted = True
                    consecutive_error_count = 0
                    
                    print(f'{datetime.now()} - Restarting search from scratch')
                    continue
                elif consecutive_error_count >= 5:
                    # If we've already tried restarting and still getting errors, give up
                    print(f'{datetime.now()} - Persistent errors even after restart. Terminating search.')
                    break
                else:
                    # Otherwise, just wait a bit and try again
                    wait_time = randint(10, 30)
                    print(f'{datetime.now()} - Waiting {wait_time} seconds before retrying...')
                    time.sleep(wait_time)
                    continue
            else:
                print(f'{datetime.now()} - Error fetching tweets: {e}')
                
                # If we've had too many consecutive errors, stop
                if consecutive_error_count >= 5:
                    print(f'{datetime.now()} - Too many consecutive errors. Terminating search.')
                    break
                
                # Otherwise, wait and try again
                wait_time = randint(10, 30)
                print(f'{datetime.now()} - Waiting {wait_time} seconds before retrying...')
                time.sleep(wait_time)
                continue

        if not tweets:
            # No more tweets found, end the continuous scraping
            print(f'{datetime.now()} - No more tweets found that match all criteria. Terminating search.')
            break

        # Flag to track if we actually got any tweets in this iteration
        found_tweets_in_iteration = False
        
        for tweet in tweets:
            # Get user location
            user_location = getattr(tweet.user, 'location', 'Unknown')
            
            # Determine if this tweet should be included
            # Check if this is a user-specified search or default search
            is_default_search = SEARCH_PARAMS.get("all_of_these_words") == ["crop"] and SEARCH_PARAMS.get("any_of_these_words") == ["wheat", "barley", "canola"]
            
            # Only filter by location for default searches - accept all tweets for custom searches
            if is_default_search:
                # For default search, only include Australian tweets
                user_location_match = is_australian_location(user_location)
                content_location_match = mentions_location(tweet.text)
                
                # Skip tweets that don't match our Australia criteria
                if not (user_location_match or content_location_match):
                    continue
            
            # Add additional content-based filtering to ensure search terms actually appear in the tweet text
            # Only apply this filter for user-specified searches, not default searches
            if not is_default_search:
                text_lower = tweet.text.lower()
                
                # Check if all required words are in the tweet content
                all_words_present = True
                
                # Check for "all_of_these_words"
                if SEARCH_PARAMS.get("all_of_these_words"):
                    for word in SEARCH_PARAMS["all_of_these_words"]:
                        if word.lower() not in text_lower:
                            all_words_present = False
                            break
                
                # Check for exact phrase
                if SEARCH_PARAMS.get("this_exact_phrase") and SEARCH_PARAMS["this_exact_phrase"]:
                    if SEARCH_PARAMS["this_exact_phrase"].lower() not in text_lower:
                        all_words_present = False
                
                # Skip tweets that don't contain all search terms in the content
                if not all_words_present:
                    print(f"{datetime.now()} - Skipping tweet that doesn't contain all search terms in content: {tweet.text[:50]}...")
                    continue
            
            # Extract additional attributes
            follower_count = getattr(tweet.user, 'followers_count', 0)
            quote_count = getattr(tweet, 'quote_count', 0)
            reply_count = getattr(tweet, 'reply_count', 0)
            view_count = getattr(tweet, 'view_count', 0)
            
            # Classify topic
            topic = classify_topic(tweet.text)
            
            # Generate tweet URL
            tweet_id = getattr(tweet, 'id', None)
            username = getattr(tweet.user, 'screen_name', None)
            tweet_url = ''
            if tweet_id and username:
                tweet_url = f"https://twitter.com/{username}/status/{tweet_id}"
                
            # Count the tweet and save it
            tweet_count += 1
            current_batch_count += 1
            found_tweets_in_iteration = True
            
            # Create tweet data array with all attributes
            tweet_data = [
                tweet_id, 
                username,
                user_location, 
                tweet.text,
                tweet_url,
                tweet.created_at, 
                getattr(tweet, 'favorite_count', 0),
                getattr(tweet, 'retweet_count', 0) + getattr(tweet, 'reply_count', 0),
                "Twitter",
                topic
            ]
            
            # Format datetime to match Reddit's ISO format
            # In tweet_data, the created_at is at index 5
            if tweet_data[5]:
                # Handle different possible formats of the date
                if isinstance(tweet_data[5], datetime):
                    # If it's already a datetime object, just convert to ISO format
                    tweet_data[5] = tweet_data[5].isoformat()
                elif isinstance(tweet_data[5], str):
                    try:
                        # Try to parse Twitter's date format: "Tue Mar 04 17:35:50 +0000 2025"
                        parsed_date = datetime.strptime(tweet_data[5], '%a %b %d %H:%M:%S %z %Y')
                        tweet_data[5] = parsed_date.isoformat()
                    except ValueError:
                        # If that fails, try another common Twitter format
                        try:
                            # Handle format without timezone: "Tue Mar 04 17:35:50 2025"
                            parsed_date = datetime.strptime(tweet_data[5], '%a %b %d %H:%M:%S %Y')
                            tweet_data[5] = parsed_date.isoformat()
                        except ValueError:
                            # If all parsing attempts fail, keep original format
                            print(f"{datetime.now()} - Warning: Could not parse date format: {tweet_data[5]}")
            
            with open('tweets.csv', 'a', newline='', encoding='utf-8') as file:
                writer = csv.writer(file)
                writer.writerow(tweet_data)

            #Save to MongoDB
            tweet_doc = {
                "post_id": tweet_data[0],
                "username": tweet_data[1],
                "user_location": tweet_data[2],
                "content_text": tweet_data[3],
                "url": tweet_data[4],
                "created_at": tweet_data[5],
                "likes": tweet_data[6],
                "comments": tweet_data[7],
                "platform": tweet_data[8],
                "topic_classification": tweet_data[9],
                "collected_at": datetime.utcnow()
            }

            try:
                collection.insert_one(tweet_doc)
                print(f"[INFO] {datetime.now()} - Successfully saved tweet to MongoDB")
            except Exception as e:
                print(f"[INFO] {datetime.now()} - Error saving to MongoDB:", e)
            print(f'{datetime.now()} - Got {tweet_count} tweets total (Batch {total_batches+1}: {current_batch_count}/{batch_size})')
            
            # If we've reached our batch size, take a break but don't exit the scraper
            if current_batch_count >= batch_size:
                break

        # If we didn't find any tweets in this iteration, stop scraping
        if not found_tweets_in_iteration:
            print(f'{datetime.now()} - No new tweets found in this iteration. Ending continuous scraping.')
            continue_scraping = False
            break
            
        # If we've collected a full batch, pause before the next batch
        if current_batch_count >= batch_size:
            total_batches += 1
            current_batch_count = 0
            
            print(f'{datetime.now()} - Completed batch {total_batches} with {batch_size} tweets')
            print(f'{datetime.now()} - Total tweets collected so far: {tweet_count}')
            
            # Check if we've reached our max batches limit
            if MAX_BATCHES < float('inf') and total_batches >= MAX_BATCHES:
                print(f'{datetime.now()} - Reached maximum batch limit of {MAX_BATCHES}. Stopping scraper.')
                continue_scraping = False
                break
            
            # Only take a batch pause if we should continue scraping
            if continue_scraping:
                batch_pause_seconds = batch_pause_minutes * 60
                print(f'{datetime.now()} - Taking a {batch_pause_minutes} minute pause before starting batch {total_batches + 1}')
                
                # Display a countdown for the batch pause
                for remaining_minutes in range(batch_pause_minutes, 0, -1):
                    print(f'{datetime.now()} - Batch pause: {remaining_minutes} minutes remaining')
                    time.sleep(60)  # Wait 1 minute between countdown updates
                
                print(f'{datetime.now()} - Resuming scraping for batch {total_batches + 1}')

    print(f'{datetime.now()} - Done! Collected {tweet_count} tweets across {total_batches} batches')

def classify_topic(text):
    """
    Simple keyword-based topic classification
    """
    text_lower = text.lower()
    
    # Define topics and their keywords
    topics = {
        "Politics": ["government", "policy", "minister", "parliament", "election", "vote", "president", "chancellor"],
        "Education": ["university", "school", "student", "education", "academic", "professor", "research", "study", "campus"],
        "Economy": ["money", "economy", "economic", "finance", "market", "investment", "salary", "price", "cost", "business"],
        "Technology": ["tech", "technology", "digital", "software", "computer", "internet", "ai", "artificial intelligence", "app"],
        "Health": ["health", "medical", "doctor", "hospital", "disease", "treatment", "patient", "covid", "vaccine"],
        "Environment": ["climate", "environment", "sustainability", "renewable", "energy", "green", "pollution", "carbon"],
        "Agriculture": ["farm", "agriculture", "crop", "wheat", "barley", "canola", "harvest", "farming", "farmer"]
    }
    
    # Count keyword matches for each topic
    topic_scores = {}
    for topic, keywords in topics.items():
        score = sum(1 for keyword in keywords if keyword in text_lower)
        if score > 0:
            topic_scores[topic] = score
    
    # Return the topic with the highest score, or "General" if no matches
    if topic_scores:
        top_topic = max(topic_scores.items(), key=lambda x: x[1])[0]
        return top_topic
    else:
        return "General"

# Only run the main code if this is the main script
if __name__ == "__main__":
    asyncio.run(main_async())
else:
    # When imported, don't run the main code automatically
    print(f'{datetime.now()} - main.py imported - not running scraper automatically')