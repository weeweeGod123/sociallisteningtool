import logging
import os
from datetime import datetime
from pymongo import MongoClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class db_connection:
    """Class to handle MongoDB connection."""
    def __init__(self):
        self.mongodb_uri =  ("mongodb+srv://sentimentUser:grp21-Sentiment-Analysis@cluster0.uplstte.mongodb.net/")
        self.db_name = ("social-listening")
        self.client = None
        self.db = None
        self.tweet_posts_collection = None
        self.reddit_posts_collection = None
        self.bluesky_posts_collection = None  # Added collection for Bluesky posts
        self.start_db_connection()

    def start_db_connection(self):
        """Establishes a connection to the MongoDB database."""
        try:
            self.client = MongoClient(self.mongodb_uri)
            self.db = self.client[self.db_name]
            self.tweet_posts_collection = self.db.tweets
            self.reddit_posts_collection = self.db.reddit_posts
            self.bluesky_posts_collection = self.db.bluesky_posts  # Initialise Bluesky collection
            logger.info(f"Connected to MongoDB Atlas: {self.db_name}")
            return True
        except Exception as e:
            logger.error(f"MongoDB connection error: {e}")
            return False
        
    def get_collection_for_source(self, source):
        """
        Get the appropriate collection based on source
        
        Args:
            source (str): 'twitter', 'reddit', or 'bluesky'
            
        Returns:
            Collection: MongoDB collection
        """
        if source == 'Twitter':
            return self.tweet_posts_collection
        elif source == 'Reddit':
            return self.reddit_posts_collection
        elif source == 'Bluesky':
            return self.bluesky_posts_collection
        else:
            logger.warning(f"Unknown source: {source}, defaulting to reddit_posts")
            return self.reddit_posts_collection
    
    def get_unanalysed_posts(self, limit=50, source=None):
        """
        Get unanalysed posts from the database.
        
        Args:
            limit (int): The maximum number of posts to fetch. Default is 50.
            source (str): Optional source filter ('twitter', 'reddit', or 'bluesky')
            
        Returns:
            list: A list of unanalysed posts.
        """
        try:
            # Check if the connection is established
            if (self.tweet_posts_collection is None or 
                self.reddit_posts_collection is None or 
                self.bluesky_posts_collection is None):
                # Attempt to reconnect
                if not self.start_db_connection():
                    logger.error("MongoDB connection not established.")
                    return []
            
            results = []
            
            # Updated query to strictly ensure we only get posts where sentiment is exactly null
            # and haven't been marked as failed or skipped
            query = {
                "$and": [
                    {"sentiment": None},  # Must be exactly null (not undefined, not false, not empty string)
                    {"sentiment_analysis_failed": {"$ne": True}},
                    {"sentiment_analysis_skipped": {"$ne": True}},
                    # Add a check for sentiment_updated_at to ensure we don't process posts that might have been
                    # partially processed but not marked properly
                    {"sentiment_updated_at": {"$exists": False}}
                ]
            }
            
            projection = {
                "post_id": 1,
                "content_text": 1,
                "platform": 1
            }
            
            # If source is specified, only query that collection
            if source:
                collection = self.get_collection_for_source(source)
                cursor = collection.find(query, projection).limit(limit)
                results = list(cursor)
            else:
               # First try Reddit with highest priority
                reddit_limit = int(limit * 0.6)  # 60% of the limit for Reddit
                reddit_cursor = self.reddit_posts_collection.find(query, projection).limit(reddit_limit)
                reddit_results = list(reddit_cursor)

                # Then try Bluesky with second priority
                bluesky_limit = int((limit - len(reddit_results)) * 0.7)  # 70% of remaining for Bluesky
                bluesky_cursor = self.bluesky_posts_collection.find(query, projection).limit(bluesky_limit)
                bluesky_results = list(bluesky_cursor)

                # Finally try Twitter with the remaining limit
                twitter_limit = limit - len(reddit_results) - len(bluesky_results)
                twitter_cursor = self.tweet_posts_collection.find(query, projection).limit(twitter_limit)
                twitter_results = list(twitter_cursor)

                # Combine results
                results = reddit_results + bluesky_results + twitter_results
                
                # Combine results
                results = reddit_results + bluesky_results + twitter_results

            # Log the post IDs we're about to process to help with debugging
            post_ids = [post.get('post_id') for post in results]
            logger.info(f"Fetched {len(results)} unanalysed posts with IDs: {post_ids[:5]}{'...' if len(post_ids) > 5 else ''}")
            
            return results
        except Exception as e:
            logger.error(f"Error fetching unanalysed posts: {e}")
            return []
        
    def update_post_sentiment(self, post_id, sentiment, source=None):
        """
        Update the sentiment of a post in the database.
        
        Args:
            post_id (str): The ID of the post to update.
            sentiment (dict): The sentiment data to update.
            source (str): Source of the post ('twitter', 'reddit' or 'bluesky')
            
        Returns:
            bool: Status of update
        """
        try:
            if (self.tweet_posts_collection is None or 
                self.reddit_posts_collection is None or 
                self.bluesky_posts_collection is None):
                if not self.start_db_connection():
                    logger.error("MongoDB connection not established.")
                    return False
            
            # Build the update document with all necessary fields
            update_doc = {
                "$set": {
                    "sentiment": sentiment.get("sentiment"),
                    "entities": sentiment.get("entities"),
                    "processed_text": sentiment.get("processed_text"),
                    "sentiment_updated_at": datetime.utcnow(),
                    # Add a status field to explicitly track that this post has been processed
                    "sentiment_status": "processed"
                }
            }
            
            # If source is provided, only update that collection
            if source:
                collection = self.get_collection_for_source(source)
                result = collection.update_one(
                    {"post_id": post_id},
                    update_doc
                )
                
                if result.modified_count > 0:
                    logger.info(f"{source.capitalize()} post {post_id} sentiment updated successfully.")
                    return True
                else:
                    logger.warning(f"No changes made to {source} post {post_id}. Document might not exist or already has the same values.")
            else:
                # Try to update in all collections
                twitter_result = self.tweet_posts_collection.update_one(
                    {"post_id": post_id},
                    update_doc
                )
                
                reddit_result = self.reddit_posts_collection.update_one(
                    {"post_id": post_id},
                    update_doc
                )
                
                bluesky_result = self.bluesky_posts_collection.update_one(
                    {"post_id": post_id},
                    update_doc
                )
                
                if twitter_result.modified_count > 0:
                    logger.info(f"Twitter post {post_id} sentiment updated successfully.")
                    return True
                elif reddit_result.modified_count > 0:
                    logger.info(f"Reddit post {post_id} sentiment updated successfully.")
                    return True
                elif bluesky_result.modified_count > 0:
                    logger.info(f"Bluesky post {post_id} sentiment updated successfully.")
                    return True
                else:
                    logger.warning(f"No changes made to post {post_id}. Document might not exist or already has the same values.")
            
            return False
                
        except Exception as e:
            logger.error(f"Error updating post sentiment: {e}")
            return False
        
    def get_unanalysed_count(self):
        """
        Get the count of unanalysed posts in the database.
        
        Returns:
            dict: Counts of unanalysed posts by source
        """
        try:
            if (self.tweet_posts_collection is None or 
                self.reddit_posts_collection is None or 
                self.bluesky_posts_collection is None):
                if not self.start_db_connection():
                    logger.error("MongoDB connection not established.")
                    return {"total": 0, "twitter": 0, "reddit": 0, "bluesky": 0}
            
            # Use the same query as get_unanalysed_posts for consistency
            query = {
                "$and": [
                    {"sentiment": None},
                    {"sentiment_analysis_failed": {"$ne": True}},
                    {"sentiment_analysis_skipped": {"$ne": True}},
                    {"sentiment_updated_at": {"$exists": False}}
                ]
            }
            
            # Count unanalysed posts using the consistent query
            twitter_count = self.tweet_posts_collection.count_documents(query)
            reddit_count = self.reddit_posts_collection.count_documents(query)
            bluesky_count = self.bluesky_posts_collection.count_documents(query)
            total_count = twitter_count + reddit_count + bluesky_count
            
            logger.info(f"Unanalysed posts count - Total: {total_count}, Twitter: {twitter_count}, Reddit: {reddit_count}, Bluesky: {bluesky_count}")
            return {
                "total": total_count,
                "twitter": twitter_count,
                "reddit": reddit_count,
                "bluesky": bluesky_count
            }
        except Exception as e:
            logger.error(f"Error fetching unanalysed posts count: {e}")
            return {"total": 0, "twitter": 0, "reddit": 0, "bluesky": 0}
    
    def find_post_by_id(self, post_id):
        """
        Find a post by its ID in any collection
        
        Args:
            post_id (str): The ID of the post to find
            
        Returns:
            dict: The post document if found, None otherwise
        """
        try:
            # Try Twitter first
            twitter_post = self.tweet_posts_collection.find_one({"post_id": post_id})
            if twitter_post:
                return twitter_post, "twitter"
            
            # Then try Reddit
            reddit_post = self.reddit_posts_collection.find_one({"post_id": post_id})
            if reddit_post:
                return reddit_post, "reddit"
            
            # Then try Bluesky
            bluesky_post = self.bluesky_posts_collection.find_one({"post_id": post_id})
            if bluesky_post:
                return bluesky_post, "bluesky"
            
            # Not found in any collection
            return None, None
        except Exception as e:
            logger.error(f"Error finding post {post_id}: {e}")
            return None, None
        
    def mark_post_analysis_failed(self, post_id, error_message):
        """
        Mark a post as failed analysis to prevent it from being retried endlessly
        
        Args:
            post_id (str): The ID of the post
            error_message (str): The error message
        """
        try:
            # Try to update in all collections
            twitter_result = self.tweet_posts_collection.update_one(
                {"post_id": post_id},
                {
                    "$set": {
                        "sentiment_analysis_failed": True,
                        "sentiment_error": error_message,
                        "sentiment_updated_at": datetime.utcnow()
                    }
                }
            )
            
            reddit_result = self.reddit_posts_collection.update_one(
                {"post_id": post_id},
                {
                    "$set": {
                        "sentiment_analysis_failed": True,
                        "sentiment_error": error_message,
                        "sentiment_updated_at": datetime.utcnow()
                    }
                }
            )
            
            bluesky_result = self.bluesky_posts_collection.update_one(
                {"post_id": post_id},
                {
                    "$set": {
                        "sentiment_analysis_failed": True,
                        "sentiment_error": error_message,
                        "sentiment_updated_at": datetime.utcnow()
                    }
                }
            )
            
            if twitter_result.modified_count > 0:
                logger.info(f"Marked Twitter post {post_id} as failed analysis")
                return True
            elif reddit_result.modified_count > 0:
                logger.info(f"Marked Reddit post {post_id} as failed analysis")
                return True
            elif bluesky_result.modified_count > 0:
                logger.info(f"Marked Bluesky post {post_id} as failed analysis")
                return True
            
            logger.info(f"No post found with ID {post_id} to mark as failed")
            return False
        except Exception as e:
            logger.error(f"Error marking post as failed: {e}")
            return False

    def mark_post_analysis_skipped(self, post_id, reason):
        """
        Mark a post as skipped (not to be analysed)
        
        Args:
            post_id (str): The ID of the post
            reason (str): The reason for skipping
        """
        try:
            # Try to update in all collections
            twitter_result = self.tweet_posts_collection.update_one(
                {"post_id": post_id},
                {
                    "$set": {
                        "sentiment_analysis_skipped": True,
                        "sentiment_skip_reason": reason,
                        "sentiment_updated_at": datetime.utcnow()
                    }
                }
            )
            
            reddit_result = self.reddit_posts_collection.update_one(
                {"post_id": post_id},
                {
                    "$set": {
                        "sentiment_analysis_skipped": True,
                        "sentiment_skip_reason": reason,
                        "sentiment_updated_at": datetime.utcnow()
                    }
                }
            )
            
            bluesky_result = self.bluesky_posts_collection.update_one(
                {"post_id": post_id},
                {
                    "$set": {
                        "sentiment_analysis_skipped": True,
                        "sentiment_skip_reason": reason,
                        "sentiment_updated_at": datetime.utcnow()
                    }
                }
            )
            
            if twitter_result.modified_count > 0:
                logger.info(f"Marked Twitter post {post_id} as skipped analysis: {reason}")
                return True
            elif reddit_result.modified_count > 0:
                logger.info(f"Marked Reddit post {post_id} as skipped analysis: {reason}")
                return True
            elif bluesky_result.modified_count > 0:
                logger.info(f"Marked Bluesky post {post_id} as skipped analysis: {reason}")
                return True
            
            logger.info(f"No post found with ID {post_id} to mark as skipped")
            return False
        except Exception as e:
            logger.error(f"Error marking post as skipped: {e}")
            return False