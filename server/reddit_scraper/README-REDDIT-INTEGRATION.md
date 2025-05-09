# Reddit API Integration for Social Listening Platform

This update integrates Reddit scraping capabilities into the existing Twitter-based social listening platform. The system now allows users to search both Twitter and Reddit simultaneously for social media content relevant to their queries.

## Features Added

- **Reddit Scraping API**: A new service that connects with Reddit's API to gather posts based on search queries
- **Combined Search**: Ability to search both Twitter and Reddit with a single query
- **Platform Selection**: Options to search only Twitter, only Reddit, or both platforms
- **Unified Results Display**: View and analyze results from both platforms in a single interface
- **All-Time Search**: Reddit scraper always searches across all time periods to maximize data collection

## Architecture

The system consists of three main API services:

1. **Twitter API** (existing) - port 5001
2. **Reddit API** (new) - port 5002
3. **Combined API** (new) - port 5003

The Combined API coordinates searches across both platforms and aggregates results.

## Setup Instructions

### 1. API Credentials

You'll need Reddit API credentials:

1. Go to https://www.reddit.com/prefs/apps
2. Create a new app with "script" type
3. Note the client ID and client secret
4. Add these to your `.env` file:

```
REDDIT_CLIENT_ID=your_client_id_here
REDDIT_CLIENT_SECRET=your_client_secret_here
```

### 2. Install Dependencies

Run the following command to install all required dependencies:

```bash
npm run install:all
```

This will install dependencies for:
- Main application
- Client
- Server
- Twitter API
- Reddit API
- Combined API

### 3. Start the Application

Start all services with a single command:

```bash
npm start
```

This launches:
- React frontend (port 3000)
- Main server (port 5000)
- Twitter API service (port 5001)
- Reddit API service (port 5002)
- Combined API service (port 5003)

## Usage Guide

1. Open the application at http://localhost:3000
2. Navigate to the Advanced Search page
3. Select your desired platform:
   - Twitter Only
   - Reddit Only
   - Combined (Twitter + Reddit)
4. Enter your search query using supported operators:
   - `AND`: Default operator between terms
   - `OR`: Alternative match
   - `AND NOT`: Exclusion
   - Exact phrases in quotes: `"exact phrase"`
   - Hashtags: `#hashtag`
   - Mentions: `@username`
5. Click Search and monitor the progress
6. View the combined or platform-specific results

Note: The Reddit scraper always searches across all time periods to maximize data collection.

## Important Files

- `/server/reddit_api/server.js` - Reddit API service
- `/server/combined_api/server.js` - Combined search service
- `/server/reddit_scraper/run_reddit_scraper.py` - Reddit scraper script
- `/client/src/AdvancedSearch.js` - Frontend with platform selector

## Troubleshooting

- **Reddit API Error**: Verify your credentials in the .env file
- **Connection Issues**: Make sure all services are running on their expected ports
- **No Results**: Try broadening your search query or adjusting operators
- **Long Wait Times**: Consider limiting your search to one platform at a time for faster results

## Limitations

- Reddit API has rate limits (60 requests per minute)
- Very large result sets may be truncated
- The Reddit scraper collects posts from all time periods and does not support date filtering 