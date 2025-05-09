#!/usr/bin/env python3
"""
Reddit Scraper - A tool to scrape data from Reddit using PRAW API
"""

import praw
import datetime
import argparse
import os
import csv
import time
import requests
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient

# Load .env from parent directory (server/.env)
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)
print(f"[OK] Loaded DB name: {os.getenv('MONGO_DB_NAME')}")

# Get Reddit API credentials from environment variables
REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET")
REDDIT_USER_AGENT = os.getenv("REDDIT_USER_AGENT")
MONGO_URI = os.getenv("MONGO_URI")

# MongoDB Setup
client = MongoClient(MONGO_URI)
db = client[os.getenv("MONGO_DB_NAME", "social-listening")]
db_collection = db["reddit_posts"]


class RedditScraper:
    """A class to scrape Reddit posts and comments using PRAW"""
    
    def __init__(self, client_id, client_secret, user_agent, username=None, password=None):
        """Initialize the Reddit API connection with PRAW"""
        print(f"Initializing Reddit API connection with client_id: {client_id[:5]}... and user_agent: {user_agent}")
        
        try:
            self.reddit = praw.Reddit(
                client_id=client_id,
                client_secret=client_secret,
                user_agent=user_agent,
                username=username,
                password=password
            )
            
            # Test authentication by trying to get user info or subreddit info
            # This will force an actual API call to verify credentials work
            try:
                # Try to get a simple subreddit (this will test the API access)
                test_subreddit = self.reddit.subreddit("announcements")
                # Just fetch a property to trigger API access
                display_name = test_subreddit.display_name
                print(f"Reddit API authentication successful - test access to r/{display_name}")
            except Exception as e:
                print(f"Reddit API authentication failed during test: {e}")
                raise Exception(f"Reddit API credential test failed: {e}")
                
            print(f"Authenticated as: {self.reddit.user.me() if username and password else 'Read-only mode'}")
        except Exception as e:
            print(f"CRITICAL ERROR: Reddit API authentication failed: {e}")
            print("This is typically due to invalid credentials (401 Unauthorized)")
            raise
    
    def scrape_subreddit(self, subreddit_name, limit=10, sort_by="hot", time_filter="all"):
        """
        Scrape posts from a specific subreddit based on sort method
        
        Parameters:
            subreddit_name (str): Name of the subreddit to scrape
            limit (int): Maximum number of posts to return
            sort_by (str): One of "hot", "new", "top", "rising", "controversial"
            time_filter (str): One of "all", "day", "hour", "month", "week", "year" (only used with "top" or "controversial" sort)
        
        Returns:
            list: List of dictionaries containing the scraped posts
        """
        posts_list = []
        
        print(f"Scraping r/{subreddit_name} sorted by {sort_by}")
        try:
            subreddit = self.reddit.subreddit(subreddit_name)
            
            # Get posts based on the sorting method
            if sort_by == "hot":
                sorted_posts = subreddit.hot(limit=limit)
            elif sort_by == "new":
                sorted_posts = subreddit.new(limit=limit)
            elif sort_by == "top":
                sorted_posts = subreddit.top(time_filter=time_filter, limit=limit)
            elif sort_by == "rising":
                sorted_posts = subreddit.rising(limit=limit)
            elif sort_by == "controversial":
                sorted_posts = subreddit.controversial(time_filter=time_filter, limit=limit)
            else:
                print(f"Invalid sort method: {sort_by}")
                return posts_list
            
            for post in sorted_posts:
                post_dict = {
                    "post_id": post.id,
                    "username": str(post.author),
                    "user_location": "",  # Reddit doesn't provide location
                    "content_text": post.title + "\n\n" + post.selftext,
                    "url": f"https://www.reddit.com{post.permalink}",
                    "created_at": datetime.datetime.fromtimestamp(post.created_utc),
                    "likes": post.score,
                    "comments": post.num_comments,
                    "platform": "Reddit",
                    "topic_classification": self.classify_topic(post.title + " " + post.selftext),
                    "collected_at": datetime.datetime.now(datetime.UTC)
                }
                posts_list.append(post_dict)
            if posts_list:
                try:
                    db_collection.insert_many(posts_list)
                    print(f"Inserted {len(posts_list)} posts into MongoDB")
                except Exception as e:
                    print(f"MongoDB insertion error: {e}")
                
            print(f"Scraped {len(posts_list)} posts from r/{subreddit_name}")
        except Exception as e:
            print(f"Error scraping r/{subreddit_name}: {e}")
        
        return posts_list
    
    def scrape_comments(self, post_id, limit=None):
        """
        Scrape comments from a specific post
        
        Parameters:
            post_id (str): Reddit post ID
            limit (int, optional): Maximum number of comments to scrape
        
        Returns:
            list: List of dictionaries containing the scraped comments
        """
        print(f"Scraping comments for post {post_id}...")
        submission = self.reddit.submission(id=post_id)
        
        # Replace MoreComments objects with actual comments
        submission.comments.replace_more(limit=limit)
        
        comments_list = []
        
        # Iterate through all comments and add to dictionary
        for comment in submission.comments.list():
            comment_dict = {
                "post_id": comment.id,
                "username": str(comment.author),
                "user_location": "",  # Reddit doesn't provide location
                "content_text": comment.body,
                "url": f"https://www.reddit.com/comments/{post_id}/_/{comment.id}/",
                "created_at": datetime.datetime.fromtimestamp(comment.created_utc),
                "likes": comment.score,
                "comments": 0,  # Comments don't have a comment count
                "platform": "Reddit",
                "topic_classification": self.classify_topic(comment.body),
                "collected_at": datetime.datetime.now(datetime.UTC)

            }
            comments_list.append(comment_dict)
            
        print(f"Collected {len(comments_list)} comments for post {post_id}")
        return comments_list
    
    def search_subreddit(self, subreddit_name, query, limit=10, sort_by="relevance", time_filter="all"):
        """
        Search for posts in a specific subreddit with a specific query
        
        Parameters:
            subreddit_name (str): Name of the subreddit to search
            query (str): Search query
            limit (int): Maximum number of posts to return
            sort_by (str): One of "relevance", "hot", "new", "top", "comments"
            time_filter (str): One of "all", "day", "hour", "month", "week", "year"
        
        Returns:
            list: List of dictionaries containing the search results
        """
        posts_list = []
        
        print(f"Searching r/{subreddit_name} for: {query}")
        try:
            subreddit = self.reddit.subreddit(subreddit_name)
            
            # Search the subreddit
            for post in subreddit.search(query, sort=sort_by, time_filter=time_filter, limit=limit):
                post_dict = {
                    "post_id": post.id,
                    "username": str(post.author),
                    "user_location": "",  # Reddit doesn't provide location
                    "content_text": post.title + "\n\n" + post.selftext,
                    "url": f"https://www.reddit.com{post.permalink}",
                    "created_at": datetime.datetime.fromtimestamp(post.created_utc),
                    "likes": post.score,
                    "comments": post.num_comments,
                    "platform": "Reddit",
                    "topic_classification": self.classify_topic(post.title + " " + post.selftext),
                    "collected_at": datetime.datetime.now(datetime.UTC)

                }
                posts_list.append(post_dict)

            if posts_list:
                try:
                    db_collection.insert_many(posts_list)
                    print(f"Inserted {len(posts_list)} posts into MongoDB")
                except Exception as e:
                    print(f"MongoDB insertion error: {e}")
                
            print(f"Found {len(posts_list)} posts matching '{query}' in r/{subreddit_name}")
        except Exception as e:
            print(f"Error searching r/{subreddit_name}: {e}")
        
        return posts_list
    
    def search_all_reddit(self, query, limit=100, sort_by="relevance", time_filter="all"):
        """
        Search for posts across all of Reddit with a specific query
        
        Parameters:
            query (str): Search query
            limit (int): Maximum number of posts to return
            sort_by (str): One of "relevance", "hot", "new", "top", "comments"
            time_filter (str): One of "all", "day", "hour", "month", "week", "year"
        
        Returns:
            list: List of dictionaries containing the search results from all of Reddit
        """
        print(f"Searching all of Reddit for: {query}")
        
        # Use 'all' to search across all subreddits
        all_reddit = self.reddit.subreddit('all')
        
        posts_list = []
        
        # Search all of Reddit
        for post in all_reddit.search(query, sort=sort_by, time_filter=time_filter, limit=limit):
            post_dict = {
                "post_id": post.id,
                "title": post.title,
                "score": post.score,
                "num_comments": post.num_comments,
                "created_utc": datetime.datetime.fromtimestamp(post.created_utc),
                "url": post.url,
                "selftext": post.selftext,
                "author": str(post.author),
                "permalink": f"https://www.reddit.com{post.permalink}",
                "subreddit": str(post.subreddit),
                "collected_at": datetime.datetime.now(datetime.UTC)

            }
            posts_list.append(post_dict)

        if posts_list:
                try:
                    db_collection.insert_many(posts_list)
                    print(f"Inserted {len(posts_list)} posts into MongoDB")
                except Exception as e:
                    print(f"MongoDB insertion error: {e}")
            
            
        print(f"Found {len(posts_list)} posts matching '{query}' across all of Reddit")
        return posts_list
    
    def search_all_reddit_stream(self, query, batch_size=25, max_posts=1000, sort_by="relevance", time_filter="all", callback=None, output_file=None):
        """
        Search for posts across all of Reddit with a specific query, processing and returning results in batches
        for real-time processing and CSV updates.
        
        Parameters:
            query (str): Search query
            batch_size (int): Number of posts to process in each batch before yielding/callback
            max_posts (int): Maximum total number of posts to return (set very high for "as many as possible")
            sort_by (str): One of "relevance", "hot", "new", "top", "comments"
            time_filter (str): One of "all", "day", "hour", "month", "week", "year"
            callback (function): Optional callback function to call with each batch of results
            output_file (str): Optional filename to stream results to CSV
            
        Returns:
            Generator that yields batches of results
        """
        print(f"Streaming search results from all of Reddit for: {query}")
        print(f"Will process in batches of {batch_size} up to a maximum of {max_posts} posts")
        
        # Use 'all' to search across all subreddits
        all_reddit = self.reddit.subreddit('all')
        
        # Variables to track progress
        posts_list = []
        total_posts = 0
        current_batch = []
        
        # Setup CSV writer if output file is provided
        csv_writer = None
        csv_file = None
        
        if output_file:
            # Ensure output file has the correct extension
            if not output_file.endswith('.csv'):
                output_file += '.csv'
            # The file will be created on first batch
            
            # Ensure the output directory exists
            output_dir = os.path.dirname(output_file)
            if output_dir and not os.path.exists(output_dir):
                os.makedirs(output_dir, exist_ok=True)
                print(f"Created output directory: {output_dir}")
        
        try:
            # Search all of Reddit - PRAW will handle pagination behind the scenes
            # We'll process in smaller batches to provide real-time updates
            for post in all_reddit.search(query, sort=sort_by, time_filter=time_filter, limit=max_posts):
                post_dict = {
                    "post_id": post.id,
                    "username": str(post.author),
                    "user_location": "",  # Reddit doesn't provide location
                    "content_text": post.title + "\n\n" + post.selftext,
                    "url": f"https://www.reddit.com{post.permalink}",
                    "created_at": datetime.datetime.fromtimestamp(post.created_utc),
                    "likes": post.score,
                    "comments": post.num_comments,
                    "platform": "Reddit",
                    "topic_classification": self.classify_topic(post.title + " " + post.selftext),
                    "collected_at": datetime.datetime.now(datetime.UTC)

                }
                
                # Add to the current batch and overall results
                current_batch.append(post_dict)
                posts_list.append(post_dict)
                total_posts += 1
                
                # When we've filled a batch or reached the limit, process it
                if len(current_batch) >= batch_size or total_posts >= max_posts:
                    print(f"Processed {total_posts} posts so far...")
                    
                    # Append to CSV if output file is specified
                    if output_file:
                        # On first batch, create the file and write the header
                        if csv_writer is None:
                            fieldnames = list(current_batch[0].keys())
                            # Create file, or append if file already exists
                            file_exists = os.path.exists(output_file)
                            mode = 'a' if file_exists else 'w'
                            try:
                                csv_file = open(output_file, mode, newline='', encoding='utf-8')
                                csv_writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
                                if not file_exists:
                                    csv_writer.writeheader()
                                    print(f"Created CSV file: {output_file}")
                            except Exception as e:
                                print(f"Error opening/creating CSV file {output_file}: {e}")
                                # Continue without CSV output if there's an error
                                output_file = None
                                
                        # Write the batch rows
                        if csv_writer:
                            for row in current_batch:
                                try:
                                    # Convert datetime objects to strings
                                    for key, value in row.items():
                                        if isinstance(value, datetime.datetime):
                                            row[key] = value.isoformat()
                                    csv_writer.writerow(row)
                                except Exception as e:
                                    print(f"Error writing row to CSV: {e}")
                                    # Continue with other rows even if one fails
                                    continue
                            
                            # Flush to ensure data is written immediately
                            if csv_file:
                                csv_file.flush()
                    
                    # Call the callback function if provided
                    if callback:
                        callback(current_batch, total_posts)
                    
                    # Yield the batch if this is being used as a generator
                    yield current_batch
                    
                    # Reset batch for next round
                    current_batch = []
                    
                    # Add a small delay to respect Reddit's rate limits (2 seconds between batches)
                    time.sleep(2)
                
                # If we've reached max_posts, break out of the loop
                if total_posts >= max_posts:
                    print(f"Reached maximum post limit of {max_posts}")
                    break
            
            # If there are any remaining posts in the last batch
            if current_batch:
                print(f"Processing final batch, total of {total_posts} posts")
                
                # Append to CSV if output file is specified
                if output_file and csv_writer:
                    try:
                        for row in current_batch:
                            try:
                                # Convert datetime objects to strings
                                for key, value in row.items():
                                    if isinstance(value, datetime.datetime):
                                        row[key] = value.isoformat()
                                csv_writer.writerow(row)
                            except Exception as e:
                                print(f"Error writing row to CSV: {e}")
                                # Continue with other rows even if one fails
                                continue
                        if csv_file:
                            csv_file.flush()
                    except Exception as e:
                        print(f"Error writing final batch to CSV: {e}")
                
                # Call the callback function if provided
                if callback:
                    callback(current_batch, total_posts)
                
                # Yield the final batch
                yield current_batch
        
        finally:
            # Always close the CSV file if it was opened
            if csv_file:
                try:
                    csv_file.close()
                    print(f"Data exported to {output_file}")
                except Exception as e:
                    print(f"Error closing CSV file: {e}")
        
        print(f"Completed search, found {total_posts} posts matching '{query}' across all of Reddit")
    
    def search_multiple_subreddits(self, subreddit_list, query, limit=10, sort_by="relevance", time_filter="all"):
        """
        Search for posts across multiple subreddits with a specific query
        
        Parameters:
            subreddit_list (list): List of subreddit names to search
            query (str): Search query
            limit (int): Maximum number of posts per subreddit to return
            sort_by (str): One of "relevance", "hot", "new", "top", "comments"
            time_filter (str): One of "all", "day", "hour", "month", "week", "year"
        
        Returns:
            list: List of dictionaries containing the search results from all specified subreddits
        """
        all_results = []
        
        for subreddit_name in subreddit_list:
            print(f"Searching r/{subreddit_name} for: {query}")
            subreddit = self.reddit.subreddit(subreddit_name)
            
            # Search the subreddit
            for post in subreddit.search(query, sort=sort_by, time_filter=time_filter, limit=limit):
                post_dict = {
                    "post_id": post.id,
                    "username": str(post.author),
                    "user_location": "",  # Reddit doesn't provide location
                    "content_text": post.title + "\n\n" + post.selftext,
                    "url": f"https://www.reddit.com{post.permalink}",
                    "created_at": datetime.datetime.fromtimestamp(post.created_utc),
                    "likes": post.score,
                    "comments": post.num_comments,
                    "platform": "Reddit",
                    "topic_classification": self.classify_topic(post.title + " " + post.selftext),
                    "collected_at": datetime.datetime.now(datetime.UTC)

                }
                all_results.append(post_dict)

            if posts_list:
                try:
                    db_collection.insert_many(posts_list)
                    print(f"Inserted {len(posts_list)} posts into MongoDB")
                except Exception as e:
                    print(f"MongoDB insertion error: {e}")
                
        print(f"Found {len(all_results)} posts matching '{query}' across {len(subreddit_list)} subreddits")
        return all_results
    
    def export_to_csv(self, data_list, filename):
        """
        Export a list of dictionaries to a CSV file
        
        Parameters:
            data_list (list): List of dictionaries to export
            filename (str): Name of the output file
        """
        if not filename.endswith('.csv'):
            filename += '.csv'
        
        if not data_list:
            print(f"No data to export to {filename}")
            return
        
        # Ensure the output directory exists
        output_dir = os.path.dirname(filename)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
            print(f"Created output directory: {output_dir}")
        
        try:
            # Get the field names from the first dictionary
            fieldnames = list(data_list[0].keys())
            
            with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()
                
                for row in data_list:
                    # Convert datetime objects to strings
                    for key, value in row.items():
                        if isinstance(value, datetime.datetime):
                            row[key] = value.isoformat()
                    writer.writerow(row)
                    
            print(f"Data exported to {filename}")
        except Exception as e:
            print(f"Error exporting to CSV: {e}")
            
    def append_to_csv(self, data_list, filename, create_if_missing=True):
        """
        Append data to an existing CSV file, or create a new one if it doesn't exist
        
        Parameters:
            data_list (list): List of dictionaries to export
            filename (str): Name of the output file
            create_if_missing (bool): Create file if it doesn't exist
        
        Returns:
            bool: True if successful, False otherwise
        """
        if not filename.endswith('.csv'):
            filename += '.csv'
        
        if not data_list:
            print(f"No data to append to {filename}")
            return False
        
        file_exists = os.path.isfile(filename)
        
        if not file_exists and not create_if_missing:
            print(f"File {filename} does not exist and create_if_missing is False")
            return False
        
        # Ensure the output directory exists
        output_dir = os.path.dirname(filename)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
            print(f"Created output directory: {output_dir}")
        
        try:
            # Get the field names from the first dictionary
            fieldnames = list(data_list[0].keys())
            
            with open(filename, 'a', newline='', encoding='utf-8') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                
                # Write header only if the file is being created
                if not file_exists:
                    writer.writeheader()
                
                for row in data_list:
                    # Convert datetime objects to strings
                    for key, value in row.items():
                        if isinstance(value, datetime.datetime):
                            row[key] = value.isoformat()
                    writer.writerow(row)
                    
            print(f"Data appended to {filename}")
            return True
        except Exception as e:
            print(f"Error appending to CSV: {e}")
            return False

    def classify_topic(self, text):
        """
        Simple keyword-based topic classification
        """
        text_lower = text.lower()
        
        # Define topics and their keywords
        topics = {
            "Politics": ["government", "policy", "minister", "parliament", "election", "vote", "president", "chancellor", "trump"],
            "Education": ["university", "school", "student", "education", "academic", "professor", "research", "study", "campus"],
            "Economy": ["money", "economy", "economic", "finance", "market", "investment", "salary", "price", "cost", "business", "tariff"],
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


def main():
    """Main function to run the scraper from command line"""
    parser = argparse.ArgumentParser(description="Reddit Scraper using PRAW")
    
    # Reddit API credentials
    parser.add_argument("--client_id", required=True, help="Reddit API client ID")
    parser.add_argument("--client_secret", required=True, help="Reddit API client secret")
    parser.add_argument("--user_agent", default="python:reddit-scraper:v1.0 (by u/YourUsername)", 
                        help="User agent string")
    parser.add_argument("--username", help="Reddit username (for authenticated access)")
    parser.add_argument("--password", help="Reddit password (for authenticated access)")
    
    # Scraping options
    parser.add_argument("--subreddit", help="Subreddit to scrape (omit to search all of Reddit)")
    parser.add_argument("--limit", type=int, default=10, help="Maximum number of posts to scrape")
    parser.add_argument("--sort", choices=["hot", "new", "top", "rising", "controversial", "relevance", "comments"], 
                       default="hot", help="Sort method for posts")
    parser.add_argument("--time", choices=["all", "day", "hour", "month", "week", "year"], 
                       default="all", help="Time filter for posts")
    parser.add_argument("--search", help="Search query within Reddit")
    parser.add_argument("--all_reddit", action="store_true", help="Search across all of Reddit instead of a specific subreddit")
    parser.add_argument("--multiple_subreddits", help="Comma-separated list of subreddits to search")
    parser.add_argument("--comments", action="store_true", help="Scrape comments for each post")
    parser.add_argument("--output_file", default="reddit_data", help="Output file name (without extension)")
    
    args = parser.parse_args()
    
    # Create the scraper instance
    scraper = RedditScraper(
        client_id=args.client_id,
        client_secret=args.client_secret,
        user_agent=args.user_agent,
        username=args.username,
        password=args.password
    )
    
    # If search query is provided
    if args.search:
        if args.all_reddit:
            # Search across all of Reddit
            posts_list = scraper.search_all_reddit(
                query=args.search,
                limit=args.limit,
                sort_by=args.sort,
                time_filter=args.time
            )
        elif args.multiple_subreddits:
            # Search across multiple subreddits
            subreddit_list = [s.strip() for s in args.multiple_subreddits.split(',')]
            posts_list = scraper.search_multiple_subreddits(
                subreddit_list=subreddit_list,
                query=args.search,
                limit=args.limit,
                sort_by=args.sort,
                time_filter=args.time
            )
        elif args.subreddit:
            # Search within a specific subreddit
            posts_list = scraper.search_subreddit(
                subreddit_name=args.subreddit,
                query=args.search,
                limit=args.limit,
                sort_by=args.sort,
                time_filter=args.time
            )
        else:
            # Default to searching all of Reddit if no subreddit specified
            posts_list = scraper.search_all_reddit(
                query=args.search,
                limit=args.limit,
                sort_by=args.sort,
                time_filter=args.time
            )
    elif args.subreddit:
        # Otherwise scrape the subreddit based on the sort method
        posts_list = scraper.scrape_subreddit(
            subreddit_name=args.subreddit,
            limit=args.limit,
            sort_by=args.sort,
            time_filter=args.time
        )
    else:
        parser.error("Either --subreddit or --search is required")
    
    # Export posts data
    scraper.export_to_csv(posts_list, f"{args.output_file}_posts")
    
    # If comments flag is True, scrape comments for each post
    if args.comments:
        all_comments = []
        for post in posts_list:
            post_id = post["post_id"]
            comments_list = scraper.scrape_comments(post_id)
            all_comments.extend(comments_list)
        
        # Export comments data if there are any
        if all_comments:
            scraper.export_to_csv(all_comments, f"{args.output_file}_comments")


if __name__ == "__main__":
    main() 