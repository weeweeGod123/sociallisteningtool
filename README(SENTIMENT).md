# Social Listening Platform Sentiment Analysis Integration

## SETUP

### FRONT-END
cd client
npm install
npm start

### BACK-END

#### Install requirements of all .py files (Scrappers & Sentiment Analysis)
cd server/
pip install -r requirements.txt

- All requirements is combined in this "requirements.txt" file

1. Reddit API Server
cd server/reddit_api
npm install
npm start

2. Twitter API Server
cd server/twitter_api
npm install
npm start

3. Blue Sky API Server
cd server/bluesky_api
npm install
npm start

4. Sentiment Analysis Server
cd server/sentiment-analysis
python flask_server.py

5. Combined API Server
cd server/combined_api
npm install
npm start

## Overview
This document provides details on the integration between data collection systems (Twitter and Reddit scrapers) and the sentiment analysis service. The integration enables automated collection, processing, and analysis of social media data with minimal manual intervention.

## System Components

### Data Collection

- Twitter Scraper (main.py) - Collects tweets matching specified agricultural keywords
- Reddit Scraper (reddit_scraper.py) - Collects Reddit posts from agricultural subreddits

### Core Services

- Combined API Server (server.js) - Added route to call sentiment analysis end point
- Sentiment Analysis Service (flask_server.py) - Python-based sentiment analysis with spaCy and RoBERTa
- Monitor Service (monitorService.js) - Tracks data flow and triggers sentiment analysis
- Sentiment Scheduler (sentimentScheduler.js) - Manages batched sentiment analysis

### API Endpoints

- Sentiment Routes (sentiment.js) - API endpoints for sentiment analysis
- Monitor Routes (monitor.js) - API endpoints for monitoring system status

### Database Connection

- DB Connection (db_connection.py) - Handles MongoDB access for sentiment analysis

## Pipeline Visualisation
┌───────────────┐    ┌───────────────┐    ┌─────────────────┐    ┌───────────────────┐
│  Twitter      │    │  Reddit       │    │  Blue Sky       │    │  Combined API     │
│  Scraper      │───►│  Scraper      │───►│  Scraper        │───►│  Server           │
└───────────────┘    └───────────────┘    └─────────────────┘    └────────┬──────────┘
                                                                          │
                                                                          │
┌───────────────┐    ┌───────────────┐    ┌───────────────────┐           │
│  Sentiment    │◄───┤  Sentiment    │◄───┤  Monitor          │◄──────────|           
│  Analysis     │    │  Scheduler    │    │  Service          │
└───────┬───────┘    └───────────────┘    └───────────────────┘
        │
        ▼
┌───────────────┐
│  MongoDB      │
│  Database     │
└───────────────┘

### Process Flow:

1. Scrapers collect data from Twitter and Reddit
2. New data is stored in MongoDB
3. Scrapers notify the Monitor Service via Combined API
4. Monitor Service activates the Sentiment Scheduler
5. Scheduler processes unanalysed posts in batches
6. Sentiment Analysis Service processes texts and updates database
7. Results are stored in MongoDB with sentiment scores and entities

## Monitor Service Details
The Monitor Service (monitorService.js) is responsible for:

- Tracking data collection activities
- Detecting new data from Twitter and Reddit scrapers
- Notifying the Sentiment Scheduler when new data is available
- Monitoring database changes to detect manually added posts

### Key Functions:

- notifyTwitterScrape() - Receives notifications when Twitter data is collected
- notifyRedditScrape() - Receives notifications when Reddit data is collected
- handleDatabaseChange() - Monitors database for direct additions

### Trigger Conditions:
The Monitor Service will trigger sentiment analysis under these conditions:

- When a scraper completes and notifies via "/api/monitor/trigger-sentiment"
- When posts are manually added to the database
- When a combined search retrieves results

## Sentiment Scheduler Details
The Sentiment Scheduler (sentimentScheduler.js) manages the analysis workflow:

- Batch Size: 250 posts per batch (configurable via BATCH_SIZE env variable)
- Check Interval: Checks for unanalysed posts every 60 seconds (configurable)
- Idle Timeout: Deactivates after 15 minutes of inactivity (900,000 ms, configurable)
- Cooldown Time: 3 seconds between batch processing (configurable)
- Maximum Retries: 3 attempts before backing off (configurable)

### Scheduler States:

- Active: Actively processing batches
- Inactive: Idle but ready to be activated
- Running: Currently processing a batch

### Scheduling Logic:

- Activates when notified of new data
- Processes posts in batches of 250
- Continues until all posts are processed
- Deactivates after 15 minutes of inactivity
- Uses exponential backoff when rate limits are hit

## Sentiment Analysis Service Details
The Sentiment Analysis service (flask_server.py and combined_analyzer.py) provides:

- Sentiment Analysis: Calculates positive, negative, and neutral scores
- Entity Extraction: Identifies key terms, locations, and concepts
- Agricultural Term Recognition: Specialised detection of agricultural terms

### Analysis Process:

- Text is preprocessed to remove noise
- RoBERTa model analyses sentiment
- spaCy extracts entities and agricultural terms
- Results include sentiment scores, entities, and processed text

## Database Integration
The db_connection.py handles MongoDB operations:

- Retrieves unanalysed posts for processing
- Updates posts with sentiment analysis results
- Handles error cases for failed analyses
- Tracks processing status for each post

## API Endpoints

### Sentiment Analysis Endpoints:

GET /api/sentiment/health - Check health of sentiment analysis server
POST /api/sentiment/analyze - Analyse text for sentiment
POST /api/sentiment/analyze-batch - Process batch of unanalysed posts
POST /api/sentiment/analyze-by-id - Analyse specific post by ID

### Monitor Endpoints:

GET /api/monitor/status - Get current system status
GET /api/monitor/recent - Get recent analysed posts

## Configuration (sentimentSchedular.js)
Key environment variables:

- BATCH_SIZE - Number of posts to analyse per batch (default: 250)
- CHECK_INTERVAL - Milliseconds between checks for new data (default: 60000)
- IDLE_TIMEOUT - Milliseconds before scheduler deactivates (default: 900000)
- COOLDOWN_TIME - Milliseconds between batch processing (default: 3000)
- MAX_RETRIES - Maximum retry attempts (default: 3)

## ERROR CHECKING
If sentiment analysis is not being triggered:

1. Check if Monitor Service is receiving notifications:
    - Review logs for "Received notification of new data" (server.js in combined_api directory)

2. Verify data is being collected:
    - Check MongoDB for new unanalysed posts

3. Ensure Sentiment Scheduler is active:
    - Check logs for "Sentiment Scheduler activated" (server.js in combined_api directory)

4. Validate Sentiment Analysis service is healthy:
    - Send a request to "/api/sentiment/health" (either using Postman, browser or curl command)

5. Check integration between services:
    - Test notification endpoint with: curl -X POST http://localhost:5003/api/monitor/trigger-sentiment -H "Content-Type: application/json" -d '{"source": "reddit", "postCount": 10}'

## Updates Summary

- Added integrated sentiment analysis pipeline
- Improved notification system between scrapers and sentiment analysis
- Enhanced monitoring with real-time status updates
- Implemented batch processing for efficient resource usage
- Added robust error handling and retry mechanisms
- Streamlined database operations for performance