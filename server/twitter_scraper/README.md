# Twitter Data Collection Tool

This Python script collects tweets related to crops (wheat, barley, canola) in Western Australia using Twitter's web interface. The script is designed to be gentle with Twitter's rate limits and includes human-like behavior patterns.

## Prerequisites

- Python 3.7 or higher
- `twikit` library
- A Twitter/X.com account
- Chrome or Firefox browser installed

## Installation

Install the required packages:
```bash
pip install twikit selenium
```

## Initial Setup

1. Create a `config.ini` file in the same directory as `main.py` with your Twitter credentials:
```ini
[X]
username=your_username
email=your_email
password=your_password
```

2. Run `browser_login.py` first in these situations:
   - When running the script for the first time
   - If you get authentication errors in main.py
   - If your cookies have expired (usually after several days)
   - If you're getting frequent rate limits
   
```bash
python browser_login.py
```
This will create/update your `cookies.json` file using browser authentication.

3. (Optional) Adjust search parameters in `main.py`:
```python
SEARCH_PARAMS = {
    "all_of_these_words": ["crop"],
    "any_of_these_words": ["wheat", "barley", "canola"],
    "none_of_these_words": ["Washington", "AAgWa"],
    "language": "en",
    "from_date": "2018-01-01",
    "to_date": "2025-03-19",
    "location_mentions": ["Western Australia", "WA", "Perth"],
    "author_locations": ["australia", "western australia", "wa", "perth"]
}
```

## Usage

1. Make sure you have valid cookies:
   - If running for the first time or if cookies are expired, run `browser_login.py` first
   - The script will tell you if you need to refresh cookies

2. Run the main script:
```bash
python main.py
```

3. The script will:
   - Authenticate using your cookies
   - Search for tweets matching your criteria
   - Save matching tweets to `tweets.csv`
   - Stop after collecting 50 tweets (adjustable)

## Rate Limiting and Safety Features

The script includes several safety features to avoid triggering Twitter's rate limits:

- 60-120 seconds delay between requests
- 15% chance of taking 3-10 minute breaks
- 15-minute breaks after every 10 requests
- Automatic handling of rate limit errors
- Cookie-based authentication

## Output

Tweets are saved to `tweets.csv` with the following columns:
- Tweet_count
- Username
- User_Location
- Text
- Created At
- Retweets
- Likes
- Match_Reason

## Important Notes

1. **Rate Limits**: The script is designed to be conservative with requests. If you hit a rate limit, it will automatically wait for the appropriate time.

2. **Authentication**: 
   - Always run `browser_login.py` first when setting up
   - The script saves cookies after browser login
   - Cookies typically last several days before needing renewal
   - If you get authentication errors, run `browser_login.py` again

3. **Location Filtering**: Tweets are filtered to include only those:
   - From users in Australia/WA
   - Mentioning Western Australia locations

4. **Running Time**: Due to conservative rate limiting, the script may take several hours to collect 50 tweets.

## Troubleshooting

1. If you get authentication errors:
   - Run `browser_login.py` to refresh cookies
   - Check your credentials in `config.ini`
   - Make sure you can log into Twitter in your browser

2. If you hit rate limits frequently:
   - The script will handle this automatically
   - Consider increasing delays in `TIMING_SETTINGS`
   - Try running `browser_login.py` to get fresh cookies

## Safety Recommendations

- Don't modify the timing settings to be more aggressive
- Let the script run its course with breaks
- Don't run multiple instances simultaneously
- Monitor the first few runs to ensure smooth operation
- Always use `browser_login.py` when setting up or if you encounter issues
