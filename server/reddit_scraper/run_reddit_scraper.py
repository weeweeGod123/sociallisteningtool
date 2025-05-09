#!/usr/bin/env python3
"""
Script to run the Reddit scraper with custom search parameters

Key Features:
- Accepts complex search queries with various operators (AND, OR, NOT, exact phrases)
- Searches specified subreddits and/or all of Reddit
- Always searches across all time periods to maximize data collection
- Processes posts in batches with real-time updates
- Creates and updates CSV files in real-time
- Respects Reddit API rate limits
"""
import os
import sys
import argparse
import importlib.util
import json
import csv
from datetime import datetime
import time

# Import the reddit_scraper module
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from reddit_scraper import RedditScraper

print(f"{datetime.now()} - Starting Reddit scraper runner")

def load_search_params(params_file=None):
    """
    Load search parameters from specified file or default reddit_search_params.py
    """
    try:
        print(f"{datetime.now()} - Loading search parameters")
        
        # If a custom parameters file is specified, use that
        if params_file:
            search_params_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), params_file)
        else:
            search_params_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 
                                             'reddit_search_params.py')
        
        if os.path.exists(search_params_file):
            # Load the search_params module
            spec = importlib.util.spec_from_file_location("reddit_search_params", search_params_file)
            reddit_search_params = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(reddit_search_params)
            
            # Return the search parameters
            return reddit_search_params.SEARCH_PARAMS, reddit_search_params.MINIMUM_POSTS
        else:
            print(f"{datetime.now()} - Error: search parameters file {search_params_file} not found!")
            sys.exit(1)
    except Exception as e:
        print(f"{datetime.now()} - Error loading search parameters: {e}")
        sys.exit(1)

def build_reddit_query(search_params):
    """
    Build a Reddit search query from the search parameters using operator logic from the frontend.
    
    Reddit's search syntax:
    - AND is implied between terms by default (spaces)
    - OR must be explicitly specified in uppercase between terms
    - NOT is specified using the minus sign (-)
    - Exact phrases use double quotes ("")
    - Hashtags use the pound sign (#)
    - Mentions in Reddit would be username searches with u/ prefix
    """
    query_parts = []
    
    # Check if we need to add default agricultural terms
    # Only add them if no search terms are provided at all
    is_empty_search = (
        not search_params.get("and_terms") and 
        not search_params.get("or_terms") and 
        not search_params.get("exact_phrases") and
        not search_params.get("hashtags") and
        not search_params.get("mentions")
    )
    
    if is_empty_search:
        # Add default agriculture/farming-related terms
        print(f"{datetime.now()} - No search terms provided, adding default agriculture terms")
        default_terms = [
            # Core agricultural terms
            "farming", "agriculture", "crops", "harvest",
            
            # Regions
            "Western Australia", "Australia", "Perth", "WA",
            
            # Crop types
            "wheat", "barley", "canola", "lupin", "oats", "legumes",
            
            # Crop management
            "crop rotation", "soil health", "irrigation", "fertilizer",
            
            # Crop diseases and pests
            "rust disease", "powdery mildew", "leaf spot", "blotch", 
            "root rot", "fungal disease", "bacterial disease", "viral disease",
            "aphids", "weevils", "locusts", "nematodes",
            
            # Crop protection
            "pesticide", "fungicide", "herbicide", "insecticide",
            
            # Farming techniques
            "no-till", "regenerative", "sustainable", "precision agriculture",
            
            # Climate and conditions
            "drought", "rainfall", "climate", "soil moisture"
        ]
        # Create a more focused OR query with key terms
        primary_terms = ["crops", "farming", "agriculture", "Western Australia", "pesticide", "fungicide"]
        query_parts.append(f"({' OR '.join(primary_terms)})")
        
        # Add additional agriculture terms with lower priority
        additional_terms = [term for term in default_terms if term not in primary_terms]
        if additional_terms:
            # Limit to 10 additional terms to avoid overly complex queries
            selected_terms = additional_terms[:10]
            query_parts.append(f"({' OR '.join(selected_terms)})")
    else:
        # Process exact phrases first (highest priority)
        if search_params.get("exact_phrases"):
            for phrase in search_params.get("exact_phrases"):
                # Make sure the phrase is properly quoted
                if not phrase.startswith('"') and not phrase.endswith('"'):
                    phrase = f'"{phrase}"'
                query_parts.append(phrase)
        
        # Process and_terms - Filter out "AND" operators and handle "NOT" operators
        if search_params.get("and_terms"):
            cleaned_and_terms = []
            i = 0
            while i < len(search_params["and_terms"]):
                term = search_params["and_terms"][i]
                
                # Skip "AND" operators (they're implied by spaces in Reddit search)
                if term.upper() == "AND":
                    i += 1
                    continue
                    
                # Handle "NOT" operators (convert next term to have a minus prefix)
                elif term.upper() == "NOT" and i + 1 < len(search_params["and_terms"]):
                    next_term = search_params["and_terms"][i + 1]
                    cleaned_and_terms.append(f"-{next_term}")
                    i += 2  # Skip both "NOT" and the term after it
                else:
                    cleaned_and_terms.append(term)
                    i += 1
                    
            if cleaned_and_terms:
                # Join with spaces (implicit AND in Reddit)
                query_parts.append(f"{' '.join(cleaned_and_terms)}")
        
        # Process NOT terms if they weren't part of AND terms
        if search_params.get("not_terms"):
            for term in search_params["not_terms"]:
                query_parts.append(f"-{term}")
        
        # Add OR terms (must use explicit OR operator)
        if search_params.get("or_terms"):
            # Make sure OR terms are formatted correctly
            if len(search_params["or_terms"]) > 1:
                or_terms = " OR ".join(search_params["or_terms"])
                # Always add parentheses to group OR terms
                query_parts.append(f"({or_terms})")
            elif len(search_params["or_terms"]) == 1:
                # Just add the single term without OR
                query_parts.append(search_params["or_terms"][0])
        
        # Process hashtags only if they were explicitly provided in the original query
        # DO NOT add default hashtags to user-provided queries
        if search_params.get("hashtags") and "hashtags" in search_params:
            # Skip hashtags completely - the log shows these are being added automatically
            # and causing the queries to be too restrictive
            print(f"{datetime.now()} - Skipping hashtags to avoid query restrictions")
            pass
        
        # Process mentions only if they were explicitly provided in the original query
        if search_params.get("mentions") and "mentions" in search_params:
            mentions = []
            for mention in search_params["mentions"]:
                # Remove @ if it's already there
                if mention.startswith('@'):
                    mention = mention[1:]
                # For Reddit, we use u/ for user mentions
                mentions.append(f"u/{mention}")
            
            # Add each mention as a separate term
            for mention in mentions:
                query_parts.append(mention)
    
    # Combine all parts into a final query
    combined_query = " ".join(query_parts)
    
    print(f"{datetime.now()} - Constructed Reddit query: {combined_query}")
    return combined_query.strip()

def update_status(search_id, status, post_count=0):
    """
    Update the status file for the current search
    """
    # Ensure output directory exists
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
    os.makedirs(output_dir, exist_ok=True)
    
    # Create status file in output directory with proper naming convention
    status_file = os.path.join(output_dir, f"reddit_status_{search_id}.json")
    
    try:
        status_data = {
            "status": status,
            "post_count": post_count,
            "last_updated": datetime.now().isoformat()
        }
        
        with open(status_file, 'w') as f:
            json.dump(status_data, f)
            
        print(f"{datetime.now()} - Updated status: {status}, post count: {post_count}")
    except Exception as e:
        print(f"{datetime.now()} - Error updating status file: {e}")

def filter_search_results(posts, search_params, query):
    """
    Apply post-processing filters to ensure search results match the query criteria.
    This helps overcome limitations in Reddit's search API for complex queries.
    
    Parameters:
        posts (list): List of posts retrieved from Reddit
        search_params (dict): The search parameters
        query (str): The original query string
    
    Returns:
        list: Filtered list of posts that match the criteria
    """
    print(f"{datetime.now()} - Post-processing search results to ensure relevance")
    
    # Nothing to filter if no posts
    if not posts:
        return posts
    
    filtered_posts = posts.copy()
    
    # Check for exact phrases first (most strict filter)
    if search_params.get("exact_phrases"):
        exact_phrases_lower = [phrase.lower() for phrase in search_params.get("exact_phrases")]
        phrase_filtered = []
        
        for post in filtered_posts:
            title_lower = post["title"].lower()
            selftext_lower = post["selftext"].lower()
            
            # Post must contain ALL exact phrases to be included
            all_phrases_found = True
            for phrase in exact_phrases_lower:
                if phrase not in title_lower and phrase not in selftext_lower:
                    all_phrases_found = False
                    break
            
            if all_phrases_found:
                phrase_filtered.append(post)
        
        filtered_posts = phrase_filtered
        print(f"{datetime.now()} - Filtered to {len(filtered_posts)} posts based on exact phrases")
    
    # Extract OR terms for filtering
    if search_params.get("or_terms"):
        or_terms_lower = [term.lower() for term in search_params.get("or_terms")]
        or_filtered = []
        
        for post in filtered_posts:
            title_lower = post["title"].lower()
            selftext_lower = post["selftext"].lower()
            
            # Check if any OR term appears in the title or selftext
            found_match = False
            for term in or_terms_lower:
                if term in title_lower or term in selftext_lower:
                    found_match = True
                    break
            
            if found_match:
                or_filtered.append(post)
        
        filtered_posts = or_filtered
        print(f"{datetime.now()} - Filtered to {len(filtered_posts)} posts based on OR terms")
    
    # Filter based on AND terms (if they exist)
    if search_params.get("and_terms"):
        # Filter out operator terms
        and_terms = [term for term in search_params.get("and_terms") 
                    if term.upper() != "AND" and term.upper() != "OR" and term.upper() != "NOT"]
        
        if and_terms:
            and_terms_lower = [term.lower() for term in and_terms]
            and_filtered = []
            
            for post in filtered_posts:
                title_lower = post["title"].lower()
                selftext_lower = post["selftext"].lower()
                
                # Post must contain ALL AND terms to be included
                all_terms_found = True
                for term in and_terms_lower:
                    if term not in title_lower and term not in selftext_lower:
                        all_terms_found = False
                        break
                
                if all_terms_found:
                    and_filtered.append(post)
            
            filtered_posts = and_filtered
            print(f"{datetime.now()} - Filtered to {len(filtered_posts)} posts based on AND terms")
    
    print(f"{datetime.now()} - Final post-filtering: from {len(posts)} to {len(filtered_posts)} posts")
    return filtered_posts

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Reddit Scraper")
    parser.add_argument("--client-id", type=str, help="Reddit API client ID", required=True)
    parser.add_argument("--client-secret", type=str, help="Reddit API client secret", required=True)
    parser.add_argument("--output", type=str, default="reddit_data.csv", help="Output CSV file")
    parser.add_argument("--params-file", type=str, help="Custom parameters file to use")
    parser.add_argument("--search-id", type=str, help="Unique search ID for status tracking")
    parser.add_argument("--search_id", type=str, help="Unique search ID for status tracking (alternative name)")
    parser.add_argument("--search-params-file", type=str, help="Custom parameters file to use (alternative name)")
    parser.add_argument("--from-date", type=str, help="Start date (YYYY-MM-DD) - DISABLED, all posts will be collected")
    parser.add_argument("--to-date", type=str, help="End date (YYYY-MM-DD) - DISABLED, all posts will be collected")
    parser.add_argument("--query", type=str, help="Direct search query to use (overrides params file)")
    parser.add_argument("--max-posts", type=int, default=10000, help="Maximum number of posts to retrieve")
    parser.add_argument("--batch-size", type=int, default=25, help="Number of posts to process in each batch")
    parser.add_argument("--subreddits", type=str, help="Comma-separated list of subreddits to search (overrides params file)")
    parser.add_argument("--agricultural-focus", action="store_true", default=True, help="Enable specialized agricultural focus")
    args = parser.parse_args()
    
    # Print credential info for debugging (safely)
    print(f"{datetime.now()} - Reddit API Credentials:")
    print(f"{datetime.now()} - Client ID: {args.client_id[:5]}..." if args.client_id else "None")
    print(f"{datetime.now()} - Client Secret: {'*' * 10}")  # Don't log the actual secret
    
    # Set search ID if provided (try both naming styles)
    search_id = args.search_id or args.search_params_file or datetime.now().strftime("%Y%m%d%H%M%S")
    
    # Choose the params file (try both naming styles)
    params_file = args.params_file or args.search_params_file
    
    # Ensure output directory exists
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
    os.makedirs(output_dir, exist_ok=True)
    
    try:
        # Update initial status
        update_status(search_id, "running")
        
        # Load search parameters
        search_params, minimum_posts = load_search_params(params_file)
        print(f"{datetime.now()} - Search parameters loaded: {search_params}")
        
        # Always set time_filter to "all" to fetch posts from all time periods
        search_params["time_filter"] = "all"
        print(f"{datetime.now()} - Time filter forced to 'all' to collect posts from all time periods")
        
        # Override subreddits if provided via command line
        if args.subreddits:
            search_params["subreddits"] = args.subreddits.split(',')
            print(f"{datetime.now()} - Overriding subreddits with command line argument: {search_params['subreddits']}")
        
        # Use provided maximum posts or at least the minimum configured
        max_posts = max(args.max_posts, minimum_posts)
        print(f"{datetime.now()} - Will collect up to {max_posts} posts")
        
        # Use direct query if provided
        if args.query:
            query = args.query
            print(f"{datetime.now()} - Using provided query: {query}")
        else:
            # Build the search query from parameters
            query = build_reddit_query(search_params)
            print(f"{datetime.now()} - Built query: {query}")
        
        # Initialize the Reddit scraper with a crop-focused user agent
        user_agent = "python:WA-CropDataCollector:v1.1 (Agricultural research project for Western Australia)"
        try:
            print(f"{datetime.now()} - Initializing Reddit API connection with:")
            print(f"{datetime.now()} - User Agent: {user_agent}")
            scraper = RedditScraper(client_id=args.client_id, client_secret=args.client_secret, user_agent=user_agent)
            print(f"{datetime.now()} - Reddit API connection initialized successfully")
        except Exception as auth_error:
            print(f"{datetime.now()} - ERROR AUTHENTICATING WITH REDDIT API: {auth_error}")
            print(f"{datetime.now()} - This is typically a 401 error due to invalid credentials")
            update_status(search_id, "error", 0)
            raise auth_error
        
        # Apply date filters if provided
        time_filter = search_params.get("time_filter", "all")
        
        # Remove date filtering logic - always use "all" time filter
        # When date filters are provided, use a valid time filter
        # For from_date within the last year, we can use time_filter
        # to get more relevant results
        if args.from_date and args.to_date:
            print(f"{datetime.now()} - Date filtering is disabled - ignoring date range: {args.from_date} to {args.to_date}")
        
        # Always use "all" time filter to get the maximum number of posts
        time_filter = "all"
        print(f"{datetime.now()} - Using time_filter: {time_filter} to retrieve posts from all time periods")
        
        # Prepare the output file path with proper naming convention
        output_file = f"reddit_results_{search_id}"
        output_path = os.path.join(output_dir, output_file)
            
        # Master list of all collected posts
        all_posts = {}  # Use dict for easy deduplication by post_id
        
        # Define a callback function to update the status file
        def update_status_callback(batch, total_posts):
            update_status(search_id, "running", total_posts)
            print(f"{datetime.now()} - Progress: {total_posts} posts collected")
        
        # STEP 1: Start with specific subreddits search (if specified)
        if search_params.get("subreddits"):
            print(f"{datetime.now()} - Searching specified agricultural subreddits first: {search_params['subreddits']}")
            
            for subreddit in search_params["subreddits"]:
                print(f"{datetime.now()} - Searching subreddit: r/{subreddit}")
                try:
                    # For each subreddit, search for posts
                    posts_list = scraper.search_subreddit(
                        subreddit_name=subreddit,
                        query=query,
                        limit=200,  # Increased limit per-subreddit for agriculture data
                        sort_by=search_params.get("sort_by", "relevance"),
                        time_filter="all"  # Always use "all" to get posts from all time periods
                    )
                    
                    # Add posts to master list (with deduplication)
                    for post in posts_list:
                        all_posts[post["post_id"]] = post
                    
                    print(f"{datetime.now()} - Found {len(posts_list)} posts in r/{subreddit}")
                    
                    # Update status
                    update_status(search_id, "running", len(all_posts))
                    
                    # Short delay between subreddit searches to respect API limits
                    time.sleep(1)
                    
                    # If we've reached the max posts, break
                    if len(all_posts) >= max_posts:
                        print(f"{datetime.now()} - Reached max posts limit from subreddit searches")
                        break
                except Exception as e:
                    print(f"{datetime.now()} - Error searching r/{subreddit}: {e}")
        
        # STEP 2: Search all of Reddit using streaming API (if needed and configured)
        if search_params.get("search_all_reddit") and len(all_posts) < max_posts:
            remaining_posts = max_posts - len(all_posts)
            print(f"{datetime.now()} - Streaming search across all of Reddit for {remaining_posts} more posts")
            
            try:
                # We'll collect the posts in batches using streaming
                batch_count = 0
                collected_posts = []
                
                # Track existing post IDs to avoid duplicates from subreddit search
                existing_post_ids = set(all_posts.keys())
                
                # Create the CSV file with posts collected so far
                if all_posts:
                    posts_values = list(all_posts.values())
                    print(f"{datetime.now()} - Exporting {len(posts_values)} posts from subreddit search")
                    scraper.export_to_csv(posts_values, output_path)
                
                # Set up batch size - smaller for first few batches for quick initial results
                adaptive_batch_size = min(args.batch_size, 25)  # Start with smaller batches
                
                # Use streaming search which will create and update the CSV file in real-time
                for batch in scraper.search_all_reddit_stream(
                    query=query,
                    batch_size=adaptive_batch_size,
                    max_posts=remaining_posts,
                    sort_by=search_params.get("sort_by", "relevance"),
                    time_filter="all",  # Always use "all" to get posts from all time periods
                    callback=update_status_callback,
                    output_file=output_path
                ):
                    batch_count += 1
                    
                    # Increase batch size progressively
                    if batch_count <= 3:
                        adaptive_batch_size = min(args.batch_size, 25)  # Small batches at start
                    else:
                        adaptive_batch_size = args.batch_size  # Full size later
                    
                    # Filter out duplicates from previous subreddit search
                    new_posts = []
                    for post in batch:
                        if post["post_id"] not in existing_post_ids:
                            new_posts.append(post)
                            existing_post_ids.add(post["post_id"])
                    
                    if new_posts:
                        collected_posts.extend(new_posts)
                        
                        # Add to master list (with deduplication)
                        for post in new_posts:
                            all_posts[post["post_id"]] = post
                    
                    # Apply date filtering to the batch if needed
                    if args.from_date and args.to_date:
                        # Skip date filtering - keep all posts regardless of date
                        filtered_batch = new_posts
                        print(f"{datetime.now()} - Date filtering disabled - keeping all {len(new_posts)} posts in batch")
                    else:
                        filtered_batch = new_posts
                    
                    # Process all posts in the filtered batch
                    if filtered_batch:
                        # Add filtered posts to the collected_posts list
                        collected_posts.extend(filtered_batch)
                        
                        # Add to master list (with deduplication)
                        for post in filtered_batch:
                            all_posts[post["post_id"]] = post
                    
                    # If we've found enough posts, break
                    if len(all_posts) >= max_posts:
                        print(f"{datetime.now()} - Reached maximum post limit of {max_posts}")
                        break
                
                print(f"{datetime.now()} - Completed streaming search, processed {batch_count} batches")
                print(f"{datetime.now()} - Collected {len(collected_posts)} new posts from global search")
                print(f"{datetime.now()} - Total unique posts collected: {len(all_posts)}")
                
                # Final status update for the streaming search
                update_status(search_id, "completed", len(all_posts))
                
                # No need to export to CSV as the streaming search already did that
                print(f"{datetime.now()} - Data has been exported to {output_path}.csv")
                
                # Return early since we've already written the CSV
                return
                
            except Exception as e:
                print(f"{datetime.now()} - Error in streaming search: {e}")
                import traceback
                traceback.print_exc()
        
        # If we didn't do a streaming search but still have posts, export them
        if all_posts:
            posts_values = list(all_posts.values())
            # Export to CSV
            scraper.export_to_csv(posts_values, output_path)
            print(f"{datetime.now()} - Data exported to {output_path}.csv")
            
            # Final status update
            update_status(search_id, "completed", len(all_posts))
        else:
            print(f"{datetime.now()} - No posts found matching the criteria")
            
            # Update status to completed but with 0 posts
            update_status(search_id, "completed", 0)
    except Exception as e:
        print(f"{datetime.now()} - Error running Reddit scraper: {e}")
        import traceback
        traceback.print_exc()
        
        # Update status to error
        update_status(search_id, "error")
        sys.exit(1)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"{datetime.now()} - Error running Reddit scraper: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1) 