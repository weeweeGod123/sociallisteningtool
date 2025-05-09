# Reddit Scraper API Version

This is a modified version of the Reddit scraper that works with the Social Listening 21 frontend's Advanced Search interface, accepting query strings through configuration files and implementing the same operator logic.

## Key Features

- Accepts complex search queries with multiple operators
- Searches specific subreddits and/or all of Reddit
- Collects posts from all time periods to maximize data collection
- Handles batch processing for efficient API usage
- Streams results in real-time for immediate visualization
- Respects Reddit API rate limits

## Setup

1. Make sure you have the required dependencies installed:
   ```bash
   pip install -r requirements.txt
   ```

2. Configure your search parameters in `reddit_search_params.py`:
   ```python
   SEARCH_PARAMS = {
       "and_terms": ["crop", "agriculture"],  # Terms to be combined with AND operator
       "or_terms": ["wheat", "barley", "canola"],  # Terms to be combined with OR operator
       "not_terms": ["gaming", "game"],  # Terms to be excluded with NOT operator
       "exact_phrases": ["Western Australia"],  # Phrases to be searched exactly as written
       "hashtags": ["farming", "agriculture"],  # Hashtag terms (# in Reddit search)
       "mentions": ["australia"],  # Mention terms (for Reddit usernames)
       "subreddits": ["farming", "agriculture", "australia"],  # Subreddits to search
       "search_all_reddit": True,  # Whether to also search all of Reddit
       "sort_by": "relevance",  # Sort by: relevance, hot, new, top, comments
   }
   
   MINIMUM_POSTS = 10000  # Minimum number of posts to collect
   ```

Note: The `time_filter` parameter has been removed as the scraper now always uses "all" to search across all time periods.

## Usage

Run the script with your Reddit API credentials:

```bash
python run_reddit_scraper.py --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET --output results.csv --max-posts 10000 --batch-size 25
```

### Required Arguments:
- `--client-id`: Your Reddit API client ID
- `--client-secret`: Your Reddit API client secret

### Optional Arguments:
- `--output`: Output file name (default: reddit_data.csv)
- `--max-posts`: Maximum number of posts to retrieve (default: 10000)
- `--batch-size`: Number of posts to process in each batch (default: 25)

Note: Date filtering parameters (`--from-date` and `--to-date`) still exist for backwards compatibility but are ignored, as the scraper now always searches all time periods.

## How It Works

1. The script loads search parameters from `reddit_search_params.py`
2. It builds a Reddit search query using the operators from the frontend:
   - AND operator (implicit space between terms)
   - OR operator (explicit OR between terms)
   - NOT operator (minus sign before terms)
   - Exact phrase operator (quotes around phrases)
   - Hashtag operator (# before tags)
   - Mention operator (converted to u/ for Reddit usernames)
3. It searches specific subreddits and/or all of Reddit based on your configuration
4. Finally, it exports the results to a CSV file

## Example Query

With the default parameters, it would build a query like:
```
(crop agriculture) (wheat OR barley OR canola) "Western Australia" #farming #agriculture u/australia -gaming -game
```

## Frontend Integration

This implementation matches the operators available in the Social Listening 21 frontend:
- AND (&): Terms that must all appear in results
- OR (|): Terms where at least one must appear
- NOT (-): Terms that must not appear
- Exact Phrase (""): Phrases that must appear exactly as written
- Hashtag (#): For searching hashtags
- Mention (@): For searching usernames

## Output Format

The output CSV file contains the following columns:

### Post Information:
- `post_id`: Unique identifier of the post
- `title`: Post title
- `score`: Post score (upvotes minus downvotes)
- `num_comments`: Number of comments on the post
- `created_utc`: Creation timestamp
- `url`: URL to the post
- `selftext`: Post content
- `author`: Author username
- `subreddit`: Subreddit name
- `permalink`: Permanent link to the post

You can modify your search parameters without changing the core code, just by editing the `reddit_search_params.py` file.

## Important Changes

1. **Date Filtering Removed**: The scraper now always searches across all time periods to maximize data collection
2. **Streaming Results**: Results are now streamed in real-time, with the CSV file created as soon as the first batch is available
3. **Batch Processing**: Posts are processed in batches with real-time status updates
4. **API Rate Limiting**: Built-in delays between API calls to respect Reddit's rate limits 