const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const SentimentService = require('../services/sentimentService');
const sentimentRoutes = require('../routes/sentiment');
const influencerRoutes = require('../routes/influencers');
const postsRoutes = require('../routes/posts');
const authRoutes = require('../routes/auth');
const usersRoutes = require('../routes/users');
const rolesRoutes = require('../routes/roles');
const monitorService = require('../services/monitorService');
const { connectDB } = require('../config/db');

// Load environment variables from parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.COMBINED_PORT || 5003;

// API endpoints for Twitter, Reddit and Sentiment services
const TWITTER_API_URL = process.env.TWITTER_API_URL || 'http://localhost:5001';
const REDDIT_API_URL = process.env.REDDIT_API_URL || 'http://localhost:5002';
const SENTIMENT_API_URL = process.env.SENTIMENT_API_URL || 'http://localhost:5004';
const BLUESKY_API_URL = process.env.BLUESKY_API_URL || 'http://localhost:5005';

// MongoDB configuration
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME || 'social-listening';
console.log('MongoDB URI:', MONGO_URI);

if (!MONGO_URI) {
  console.error('MONGO_URI is not defined in environment variables');
  process.exit(1);
}

// Initialize MongoDB and start the server
connectDB().then(() => {

  monitorService.initialise();
  console.log('Monitor service initialised');
  // Middleware
  app.use(cors()); // Enable CORS for all routes
  app.use(express.json()); // Parse JSON request bodies

  app.use('/api/sentiment', sentimentRoutes); // Mount sentiment routes
  app.use('/api/influencers', influencerRoutes); // Mount influencer routes
  app.use('/api/posts', postsRoutes); // Mount posts routes
  app.use('/api/auth', authRoutes); // Mount auth routes
  app.use('/api/users', usersRoutes); // Mount users routes
  app.use('/api/roles', rolesRoutes); // Mount roles routes

  // Store information about ongoing combined searches
  const combinedSearches = {};

  // Test endpoint to verify API is running
  app.get('/api/test', (req, res) => {
    res.json({
      status: 'success',
      message: 'Combined API server is running',
      services: {
        twitter: TWITTER_API_URL,
        reddit: REDDIT_API_URL,
        bluesky: BLUESKY_API_URL,
        sentiment: SENTIMENT_API_URL
      }
    });
  });

  /**
   * API endpoint to clear all collections across all platforms
   */
  app.post('/api/combined/clear-all-collections', async (req, res) => {
    console.log('\n\n=====================================');
    console.log('RECEIVED CLEAR ALL COLLECTIONS REQUEST - COMBINED API');
    console.log('TIME:', new Date().toISOString());
    console.log('=====================================\n\n');
    
    try {
      console.log('Attempting to connect to MongoDB using URI:', MONGO_URI.replace(/\/\/(.+?):(.+?)@/, '//***:***@')); // Mask credentials in logs
      
      // Connect to MongoDB
      const client = await MongoClient.connect(MONGO_URI, {
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000 // 5 second timeout
      });
      
      console.log('Successfully connected to MongoDB');
      
      const db = client.db(DB_NAME);
      console.log('Using database:', DB_NAME);
      
      // Collections to delete based on the ClusterO screenshot
      const collectionsToDelete = ['bluesky_posts', 'posts', 'reddit_posts', 'tweets'];
      let errors = [];
      
      // Delete each collection
      for (const collection of collectionsToDelete) {
        try {
          await db.collection(collection).deleteMany({});
          console.log(`Deleted all documents from ${collection} collection`);
        } catch (error) {
          console.error(`Error clearing ${collection} collection:`, error);
          errors.push({ collection, error: error.message });
          // Continue with other collections even if this one fails
        }
      }
      
      await client.close();
      
      // If we had errors but some operations succeeded
      if (errors.length > 0 && errors.length < collectionsToDelete.length) {
        res.status(207).json({ 
          status: 'partial_success',
          message: 'Some collections were cleared successfully, but others failed',
          errors
        });
      } 
      // If all operations failed
      else if (errors.length === collectionsToDelete.length) {
        res.status(500).json({ 
          status: 'error',
          message: 'Failed to clear any collections',
          errors
        });
      }
      // If all operations succeeded
      else {
        res.status(200).json({ 
          status: 'success',
          message: 'All collections cleared successfully'
        });
      }
    } catch (error) {
      console.error('Error clearing all collections:', error);
      res.status(500).json({ 
        status: 'error',
        message: 'Failed to connect to MongoDB. Please check your connection string in .env file.',
        details: error.message,
        uri_used: MONGO_URI.replace(/\/\/(.+?):(.+?)@/, '//***:***@') // Mask credentials in response
      });
    }
  });

  // Add a simple test endpoint to verify the sentiment service is accessible
  app.get('/api/sentiment/test', async (req, res) => {
    try {
      const healthStatus = await SentimentService.checkHealth();
      res.json({
        status: 'success',
        message: 'Sentiment analysis service is accessible',
        healthStatus
      });
    } catch (error) {
      console.error('Error testing sentiment service:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to connect to sentiment analysis service',
        error: error.message
      });
    }
  });
  /**
   * Combined search endpoint - triggers both Twitter and Reddit searches
   */
  app.post('/api/combined/search', async (req, res) => {
    console.log('\n\n=====================================');
    console.log('RECEIVED COMBINED SEARCH REQUEST');
    console.log('REQUEST BODY:', JSON.stringify(req.body));
    console.log('TIME:', new Date().toISOString());
    console.log('=====================================\n\n');
    
    try {
      // Generate a unique search ID based on timestamp
      const searchId = Date.now().toString();
      
      // Get search parameters from request body
      const searchParams = req.body;
      
      // Validate that query parameter is provided
      if (!searchParams.query) {
        return res.status(400).json({ error: 'Search query is required' });
      }
      
      console.log('Received combined search query:', searchParams.query);
      
      // Initialize combined search status tracking
      combinedSearches[searchId] = {
        status: 'running',
        last_updated: new Date().toISOString(),
        twitter: { status: 'pending' },
        reddit: { status: 'pending' },
        bluesky: { status: 'pending' }
      };
      
      // Send initial response
      res.json({
        search_id: searchId,
        message: 'Combined search started successfully',
        status: 'running',
        estimated_time: 'This process will run in the background and may take several minutes'
      });
      
      // Start Twitter search asynchronously
      startTwitterSearch(searchId, searchParams).catch(error => {
        console.error('Error starting Twitter search:', error);
        combinedSearches[searchId].twitter.status = 'error';
        combinedSearches[searchId].twitter.error = error.message;
        updateCombinedSearchStatus(searchId);
      });
      
      // Start Reddit search asynchronously
      startRedditSearch(searchId, searchParams).catch(error => {
        console.error('Error starting Reddit search:', error);
        combinedSearches[searchId].reddit.status = 'error';
        combinedSearches[searchId].reddit.error = error.message;
        updateCombinedSearchStatus(searchId);
      });
      
      // Start Bluesky search asynchronously
      startBlueskySearch(searchId, searchParams).catch(error => {
        console.error('Error starting Bluesky search:', error);
        combinedSearches[searchId].bluesky.status = 'error';
        combinedSearches[searchId].bluesky.error = error.message;
        updateCombinedSearchStatus(searchId);
      });
      console.log('Combined search started - data monitor will track incoming post data automatically');
    } catch (error) {
      console.error('Error starting combined search:', error);
      res.status(500).json({
        error: 'Failed to start combined search',
        details: error.message
      });
    }
  });

  /**
   * Helper function to start a Twitter search
   */
  async function startTwitterSearch(searchId, searchParams) {
    try {
      // Clone search params to ensure we're not modifying the original
      const twitterParams = { ...searchParams };
      
      // Ensure searchAllTime parameter is passed correctly
      console.log(`Twitter search with searchAllTime=${twitterParams.searchAllTime ? 'true' : 'false'}`);
      
      // Call the Twitter API to start a search
      const response = await axios.post(`${TWITTER_API_URL}/api/twitter/search`, twitterParams);
      
      // Store the Twitter search ID
      combinedSearches[searchId].twitter.status = 'running';
      combinedSearches[searchId].twitter.search_id = response.data.search_id;
      
      console.log(`Started Twitter search with ID ${response.data.search_id} for combined search ${searchId}`);
      
      // Poll for Twitter search status
      pollTwitterSearchStatus(searchId, response.data.search_id);
      
      return response.data;
    } catch (error) {
      console.error('Failed to start Twitter search:', error);
      throw error;
    }
  }

  /**
   * Helper function to start a Reddit search
   */
  async function startRedditSearch(searchId, searchParams) {
    try {
      // Clone search params to ensure we're not modifying the original
      const redditParams = { ...searchParams };
      
      // Ensure searchAllTime parameter is passed correctly
      console.log(`Reddit search with searchAllTime=${redditParams.searchAllTime ? 'true' : 'false'}`);
      
      // Call the Reddit API to start a search
      const response = await axios.post(`${REDDIT_API_URL}/api/reddit/search`, redditParams);
      
      // Store the Reddit search ID
      combinedSearches[searchId].reddit.status = 'running';
      combinedSearches[searchId].reddit.search_id = response.data.search_id;
      
      console.log(`Started Reddit search with ID ${response.data.search_id} for combined search ${searchId}`);
      
      // Poll for Reddit search status
      pollRedditSearchStatus(searchId, response.data.search_id);
      
      return response.data;
    } catch (error) {
      console.error('Failed to start Reddit search:', error);
      throw error;
    }
  }

  /**
   * Helper function to start a Bluesky search
   */
  async function startBlueskySearch(searchId, searchParams) {
    try {
      const blueskyParams = { ...searchParams };
      console.log(`Bluesky search with query: ${blueskyParams.query}`);
      const response = await axios.post(`${BLUESKY_API_URL}/api/bluesky/search`, blueskyParams);
      combinedSearches[searchId].bluesky.status = 'running';
      combinedSearches[searchId].bluesky.search_id = response.data.search_id;
      console.log(`Started Bluesky search with ID ${response.data.search_id} for combined search ${searchId}`);
      pollBlueskySearchStatus(searchId, response.data.search_id);
      return response.data;
    } catch (error) {
      console.error('Failed to start Bluesky search:', error);
      throw error;
    }
  }

  /**
   * Helper function to poll Twitter search status
   */
  async function pollTwitterSearchStatus(combinedId, twitterId) {
    // Don't continue if the combined search no longer exists
    if (!combinedSearches[combinedId]) {
      console.log(`Combined search ${combinedId} no longer exists, stopping Twitter poll`);
      return;
    }
    
    try {
      // Get the current status
      const response = await axios.get(`${TWITTER_API_URL}/api/twitter/status?search_id=${twitterId}`);
      
      // Update the status in our tracking
      combinedSearches[combinedId].twitter.status = response.data.status;
      combinedSearches[combinedId].twitter.post_count = response.data.tweet_count;
      combinedSearches[combinedId].last_updated = new Date().toISOString();
      
      console.log(`Twitter search ${twitterId} status: ${response.data.status}, tweets: ${response.data.tweet_count}`);
      
      // If the search is completed or errored, stop polling
      if (response.data.status === 'completed' || response.data.status === 'error') {
        // If completed, fetch the results
        if (response.data.status === 'completed') {
          try {
            const resultsResponse = await axios.get(`${TWITTER_API_URL}/api/twitter/results?search_id=${twitterId}`);
            combinedSearches[combinedId].twitter.results = resultsResponse.data;
          } catch (resultsError) {
            console.error(`Error fetching Twitter results for ${twitterId}:`, resultsError);
          }
        }
        
        // Update combined search status
        updateCombinedSearchStatus(combinedId);
      } else {
        // Continue polling
        setTimeout(() => pollTwitterSearchStatus(combinedId, twitterId), 5000);
      }
    } catch (error) {
      console.error(`Error polling Twitter search ${twitterId}:`, error);
      
      // Mark as error and stop polling
      combinedSearches[combinedId].twitter.status = 'error';
      combinedSearches[combinedId].twitter.error = error.message;
      
      // Update combined search status
      updateCombinedSearchStatus(combinedId);
    }
  }

  /**
   * Helper function to poll Reddit search status
   */
  async function pollRedditSearchStatus(combinedId, redditId) {
    // Don't continue if the combined search no longer exists
    if (!combinedSearches[combinedId]) {
      console.log(`Combined search ${combinedId} no longer exists, stopping Reddit poll`);
      return;
    }
    
    try {
      // Get the current status
      const response = await axios.get(`${REDDIT_API_URL}/api/reddit/status?search_id=${redditId}`);
      
      // Update the status in our tracking
      combinedSearches[combinedId].reddit.status = response.data.status;
      combinedSearches[combinedId].reddit.post_count = response.data.post_count;
      combinedSearches[combinedId].last_updated = new Date().toISOString();
      
      console.log(`Reddit search ${redditId} status: ${response.data.status}, posts: ${response.data.post_count}`);
      
      // If the search is completed or errored, stop polling
      if (response.data.status === 'completed' || response.data.status === 'error') {
        // If completed, fetch the results
        if (response.data.status === 'completed') {
          try {
            const resultsResponse = await axios.get(`${REDDIT_API_URL}/api/reddit/results?search_id=${redditId}`);
            combinedSearches[combinedId].reddit.results = resultsResponse.data;
          } catch (resultsError) {
            console.error(`Error fetching Reddit results for ${redditId}:`, resultsError);
          }
        }
        
        // Update combined search status
        updateCombinedSearchStatus(combinedId);
      } else {
        // Continue polling
        setTimeout(() => pollRedditSearchStatus(combinedId, redditId), 5000);
      }
    } catch (error) {
      console.error(`Error polling Reddit search ${redditId}:`, error);
      
      // Mark as error and stop polling
      combinedSearches[combinedId].reddit.status = 'error';
      combinedSearches[combinedId].reddit.error = error.message;
      
      // Update combined search status
      updateCombinedSearchStatus(combinedId);
    }
  }

  /**
   * Helper function to poll Bluesky search status
   */
  async function pollBlueskySearchStatus(combinedId, blueskyId) {
    try {
      const statusUrl = `${BLUESKY_API_URL}/api/bluesky/status?search_id=${blueskyId}`;
      const response = await axios.get(statusUrl);
      const status = response.data.status;
      combinedSearches[combinedId].bluesky.status = status;
      if (status === 'completed') {
        combinedSearches[combinedId].bluesky.completed = true;
        updateCombinedSearchStatus(combinedId);
      } else if (status === 'failed' || status === 'error') {
        combinedSearches[combinedId].bluesky.error = response.data.error || 'Unknown error';
        updateCombinedSearchStatus(combinedId);
      } else {
        setTimeout(() => pollBlueskySearchStatus(combinedId, blueskyId), 3000);
      }
    } catch (error) {
      console.error('Error polling Bluesky search status:', error);
      setTimeout(() => pollBlueskySearchStatus(combinedId, blueskyId), 5000);
    }
  }

  /**
   * Helper function to update the status of a combined search
   */
  function updateCombinedSearchStatus(searchId) {
    // Don't continue if the combined search no longer exists
    if (!combinedSearches[searchId]) {
      console.log(`Combined search ${searchId} no longer exists, cannot update status`);
      return;
    }
    
    const search = combinedSearches[searchId];
    const twitterStatus = search.twitter.status;
    const redditStatus = search.reddit.status;
    const blueskyStatus = search.bluesky.status;
    
    // If all searches are done (completed or error), mark the combined search as completed
    if ((twitterStatus === 'completed' || twitterStatus === 'error') && 
        (redditStatus === 'completed' || redditStatus === 'error') &&
        (blueskyStatus === 'completed' || blueskyStatus === 'error')) {
      
      // Determine overall status - completed only if at least one search completed successfully
      if (twitterStatus === 'completed' || redditStatus === 'completed' || blueskyStatus === 'completed') {
        search.status = 'completed';
      } else {
        search.status = 'error';
      }
      
      search.last_updated = new Date().toISOString();
      console.log(`Combined search ${searchId} status updated to ${search.status}`);
    }
    try 
    {
      if (monitorService) 
      {
        // Notify about Twitter results if they exist
        if (twitterStatus === 'completed') 
        {
          monitorService.notifyTwitterScrape({
            searchId: searchId,
            totalCount: search.twitter.post_count || 0,
            status: 'completed_from_combined',
            source: 'combined'
          });
        }
        // Notify about Reddit results if they exist
        if (redditStatus === 'completed') {
          monitorService.notifyRedditScrape({
            searchId: searchId,
            postCount: search.reddit.post_count || 0,
            status: 'completed_from_combined',
            source: 'combined'
          });
        }
        // Notify about Bluesky results if they exist
        if (blueskyStatus === 'completed') {
          monitorService.notifyBlueskyScrape({
            searchId: searchId,
            status: 'completed_from_combined',
            source: 'combined'
          });
        }
        console.log(`Notified data monitor about completed combined search ${searchId}`);
      }
    } 
    catch (error) 
    {
      console.error(`Error notifying data monitor about completed search: ${error.message}`);
    }

  }

  /**
   * Endpoint to check the status of a combined search
   */
  app.get('/api/combined/status', (req, res) => {
    const searchId = req.query.search_id;
    
    if (!searchId) {
      return res.status(400).json({ error: 'search_id parameter is required' });
    }
    
    // If we don't have this search in memory, return not found
    if (!combinedSearches[searchId]) {
      return res.status(404).json({
        error: 'Search not found',
        search_id: searchId
      });
    }
    
    // Return the current status
    const search = combinedSearches[searchId];
    res.json({
      search_id: searchId,
      status: search.status,
      last_updated: search.last_updated,
      twitter: {
        status: search.twitter.status,
        post_count: search.twitter.post_count
      },
      reddit: {
        status: search.reddit.status,
        post_count: search.reddit.post_count
      },
      bluesky: {
        status: search.bluesky.status
      }
    });
  });

  /**
   * Endpoint to get the results of a combined search
   */
  app.get('/api/combined/results', async (req, res) => {
    const searchId = req.query.search_id;
    
    if (!searchId) {
      return res.status(400).json({ error: 'search_id parameter is required' });
    }
    
    // If we don't have this search in memory, return not found
    if (!combinedSearches[searchId]) {
      return res.status(404).json({
        error: 'Search not found',
        search_id: searchId
      });
    }
    
    const search = combinedSearches[searchId];
    
    // If the search is still running, return status
    if (search.status === 'running') {
      return res.json({
        search_id: searchId,
        status: 'running',
        message: 'Search is still in progress'
      });
    }
    
    // Prepare the results to return
    const results = {
      search_id: searchId,
      status: search.status,
      last_updated: search.last_updated
    };
    
    // Add Twitter results if available
    if (search.twitter.results) {
      results.twitter = {
        status: search.twitter.status,
        count: search.twitter.results.count || 0,
        results: search.twitter.results.results || []
      };
    } else {
      // Try to fetch Twitter results if search is completed but we don't have results
      if (search.twitter.status === 'completed' && search.twitter.search_id) {
        try {
          const twitterResults = await axios.get(`${TWITTER_API_URL}/api/twitter/results?search_id=${search.twitter.search_id}`);
          search.twitter.results = twitterResults.data;
          results.twitter = {
            status: search.twitter.status,
            count: twitterResults.data.count || 0,
            results: twitterResults.data.results || []
          };
        } catch (error) {
          console.error(`Error fetching Twitter results for combined search ${searchId}:`, error);
          results.twitter = {
            status: 'error',
            count: 0,
            results: []
          };
        }
      } else {
        results.twitter = {
          status: search.twitter.status,
          count: 0,
          results: []
        };
      }
    }
    
    // Add Reddit results if available
    if (search.reddit.results) {
      results.reddit = {
        status: search.reddit.status,
        count: search.reddit.results.count || 0,
        results: search.reddit.results.results || []
      };
    } else {
      // Try to fetch Reddit results if search is completed but we don't have results
      if (search.reddit.status === 'completed' && search.reddit.search_id) {
        try {
          const redditResults = await axios.get(`${REDDIT_API_URL}/api/reddit/results?search_id=${search.reddit.search_id}`);
          search.reddit.results = redditResults.data;
          results.reddit = {
            status: search.reddit.status,
            count: redditResults.data.count || 0,
            results: redditResults.data.results || []
          };
        } catch (error) {
          console.error(`Error fetching Reddit results for combined search ${searchId}:`, error);
          results.reddit = {
            status: 'error',
            count: 0,
            results: []
          };
        }
      } else {
        results.reddit = {
          status: search.reddit.status,
          count: 0,
          results: []
        };
      }
    }
    
    // Add Bluesky results if available
    if (search.bluesky.results) {
      results.bluesky = {
        status: search.bluesky.status,
        count: search.bluesky.results.count || 0,
        results: search.bluesky.results.results || []
      };
    } else {
      // Try to fetch Bluesky results if search is completed but we don't have results
      if (search.bluesky.status === 'completed' && search.bluesky.search_id) {
        try {
          const blueskyResults = await axios.get(`${BLUESKY_API_URL}/api/bluesky/results?search_id=${search.bluesky.search_id}`);
          search.bluesky.results = blueskyResults.data;
          results.bluesky = {
            status: search.bluesky.status,
            count: blueskyResults.data.count || 0,
            results: blueskyResults.data.results || []
          };
        } catch (error) {
          console.error(`Error fetching Bluesky results for combined search ${searchId}:`, error);
          results.bluesky = {
            status: 'error',
            count: 0,
            results: []
          };
        }
      } else {
        results.bluesky = {
          status: search.bluesky.status,
          count: 0,
          results: []
        };
      }
    }
    
    // Calculate total results count
    results.count = (results.twitter?.count || 0) + (results.reddit?.count || 0) + (results.bluesky?.count || 0);
    
    // Combine results for convenience
    results.results = [
      ...(results.twitter?.results || []).map(tweet => ({ ...tweet, source: 'twitter' })),
      ...(results.reddit?.results || []).map(post => ({ ...post, source: 'reddit' })),
      ...(results.bluesky?.results || []).map(post => ({ ...post, source: 'bluesky' }))
    ];

    try 
    {
      // Notify the data monitor about retrieved results if available
      if (monitorService) 
      {
        const twitterCount = results.twitter?.count || 0;
        const redditCount = results.reddit?.count || 0;
        const blueskyCount = results.bluesky?.count || 0;
        
        // Only notify if we actually have results
        if (twitterCount > 0 || redditCount > 0 || blueskyCount > 0) 
        {   
          if (twitterCount > 0) 
          {
              monitorService.notifyTwitterScrape({
                searchId: searchId,
                totalCount: twitterCount,
                combinedResults: true,
                status: 'results_retrieved'
              });
          }
          
          if (redditCount > 0) 
          {
            monitorService.notifyRedditScrape({
              searchId: searchId,
              resultCount: redditCount,
              combinedResults: true,
              status: 'results_retrieved'
            });
          }
          
          if (blueskyCount > 0) {
            monitorService.notifyBlueskyScrape({
              searchId: searchId,
              resultCount: blueskyCount,
              combinedResults: true,
              status: 'results_retrieved'
            });
          }
          console.log(`Notified data monitor about combined results: ${twitterCount} Twitter, ${redditCount} Reddit, ${blueskyCount} Bluesky`);
        }
      }
    } catch (error) {
      console.error(`Error notifying data monitor about results: ${error.message}`);
    }

    // Return the results
    res.json(results);
  });

// Define agricultural keywords for word cloud
const AGRICULTURAL_KEYWORDS = [
  'wheat', 'rice', 'corn', 'barley', 'maize', 'sorghum', 'soybeans', 'canola', 
  'pulses', 'legumes', 'rust', 'blight', 'mildew', 'smut', 'mosaic', 'nematode', 
  'weevil', 'aphids', 'leaf spot', 'stem rot', 'fungicide', 'herbicide', 'pesticide', 
  'resistance', 'biosecurity', 'australia', 'usa', 'india', 'brazil', 'china', 
  'summer', 'winter', 'spring', 'drought', 'rainfall', 'heatwave', 'harvest', 
  'sowing', 'irrigation', 'spraying', 'tillage', 'yield', 'sustainable', 
  'regenerative', 'organic', 'biodiversity', 'disease', 'crop rotation', 
  'innovation', 'climate change'
];

// Analytics endpoint
app.get('/api/analytics', async (req, res) => {
  let client;
  try {
    console.log('Analytics endpoint called');
    const { startDate, endDate } = req.query;
    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      if (isNaN(start) || isNaN(end)) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
    }
    // Connect to MongoDB
    client = await MongoClient.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB successfully');
    const db = client.db(DB_NAME);
    // Helper for date filter
    const dateFilter = start && end ? {
      $expr: {
        $and: [
          { $gte: [ { $toDate: "$created_at" }, start ] },
          { $lte: [ { $toDate: "$created_at" }, end ] }
        ]
      }
    } : {};
    // Get total posts count (filtered)
    const redditCount = await db.collection('reddit_posts').countDocuments(dateFilter);
    const twitterCount = await db.collection('tweets').countDocuments(dateFilter);
    const blueskyCount = await db.collection('bluesky_posts').countDocuments(dateFilter);
    console.log('Post counts - Reddit:', redditCount, 'Twitter:', twitterCount, 'Bluesky:', blueskyCount);
    // Source breakdown
    const sourceBreakdown = [
      { _id: 'Reddit', count: redditCount },
      { _id: 'Twitter', count: twitterCount },
      { _id: 'Bluesky', count: blueskyCount }
    ];
    // Posts over time (trend)
    const redditPostsOverTime = await db.collection('reddit_posts').aggregate([
      { $match: { ...dateFilter, created_at: { $exists: true } } },
      { $addFields: { parsedDate: { $toDate: "$created_at" } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$parsedDate" } }, count: { $sum: 1 } } },
      { $project: { _id: 0, date: "$_id", reddit: "$count" } },
      { $sort: { date: 1 } }
    ]).toArray();
    const twitterPostsOverTime = await db.collection('tweets').aggregate([
      { $match: { ...dateFilter, created_at: { $exists: true } } },
      { $addFields: { parsedDate: { $toDate: "$created_at" } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$parsedDate" } }, count: { $sum: 1 } } },
      { $project: { _id: 0, date: "$_id", twitter: "$count" } },
      { $sort: { date: 1 } }
    ]).toArray();
    const blueskyPostsOverTime = await db.collection('bluesky_posts').aggregate([
      { $match: { ...dateFilter, created_at: { $exists: true } } },
      { $addFields: { parsedDate: { $toDate: "$created_at" } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$parsedDate" } }, count: { $sum: 1 } } },
      { $project: { _id: 0, date: "$_id", bluesky: "$count" } },
      { $sort: { date: 1 } }
    ]).toArray();
    // Merge trends by date
    const trendsMap = {};
    redditPostsOverTime.forEach(item => { trendsMap[item.date] = { date: item.date, reddit: item.reddit, twitter: 0, bluesky: 0 }; });
    twitterPostsOverTime.forEach(item => { if (!trendsMap[item.date]) trendsMap[item.date] = { date: item.date, reddit: 0, twitter: 0, bluesky: 0 }; trendsMap[item.date].twitter = item.twitter; });
    blueskyPostsOverTime.forEach(item => { if (!trendsMap[item.date]) trendsMap[item.date] = { date: item.date, reddit: 0, twitter: 0, bluesky: 0 }; trendsMap[item.date].bluesky = item.bluesky; });
    const postsOverTime = Object.values(trendsMap).sort((a, b) => a.date.localeCompare(b.date));
    // Word cloud (all words from content_text, not just agricultural keywords)
    const stopWords = new Set([
      'and', 'the', 'for', 'that', 'this', 'but', 'they', 'have', 'with', 'you', 'say', 'from', 'what', 'their', 'been', 'has', 'would', 'could', 'were', 'will', 'when', 'there', 'than', 'them', 'then', 'its', 'are', 'was', 'not', 'also', 'just', 'like', 'some', 'more', 'about', 'into', 'only', 'over', 'very', 'such', 'much', 'even', 'most', 'other', 'which', 'where', 'who', 'why', 'how', 'out', 'our', 'your', 'his', 'her', 'him', 'she', 'himself', 'herself', 'themselves', 'my', 'mine', 'me', 'we', 'us', 'so', 'if', 'on', 'in', 'at', 'by', 'an', 'as', 'of', 'to', 'is', 'it', 'a', 'be', 'do', 'did', 'does', 'can', 'should', 'shall', 'may', 'might', 'must', 'or', 'no', 'yes', 'up', 'down', 'off', 'all', 'any', 'each', 'every', 'because', 'after', 'before', 'again', 'against', 'between', 'both', 'during', 'few', 'he', 'i', 'o', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      // Expanded generic/weak/irrelevant words
      'year', 'time', 'these', 'its', 'first', 'make', 'want', 'need', 'help', 'good', 'know', 'people', 'anyone', 'here', "don't", "i've", "it's", 'plant', 'plants', 'crop', 'crops', 'farmers', 'growing', 'grow', 'planting', 'harvest', 'yield', 'soil', 'water', 'food', 'land', 'work', 'thanks', 'better', 'back', 'area', 'found', 'keep', 'since', 'next', 'after', 'before', 'still', 'well', 'down', 'around', 'going', 'different', 'best', 'high', 'small', 'last', 'take', 'every', 'many', 'much', 'most', 'other', 'really', 'sure', 'thing', 'things', 'try', 'trying', 'using', 'used', 'use', 'does', 'doesn', 'did', 'didn', 'can', 'cannot', 'could', 'couldn', 'should', 'shouldn', 'would', 'wouldn', 'might', 'mightn', 'must', 'mustn', 'shall', 'shan', 'may', 'mayn', 'perth', 'permis', 'permi', 'per', 'etc'
    ]);
    // Get all posts with their dates (filtered)
    const allPosts = [
      ...await db.collection('reddit_posts').find(dateFilter, { projection: { content_text: 1, created_at: 1 } }).toArray(),
      ...await db.collection('tweets').find(dateFilter, { projection: { content_text: 1, created_at: 1 } }).toArray(),
      ...await db.collection('bluesky_posts').find(dateFilter, { projection: { content_text: 1, created_at: 1 } }).toArray()
    ];
    // Process word frequencies and dates
    const wordFrequencies = {};
    const wordDates = {};
    allPosts.forEach(post => {
      const text = post.content_text || '';
      const date = post.created_at ? new Date(post.created_at).toISOString().split('T')[0] : null;
      
      if (!date) return;

      const words = text.toLowerCase()
        .replace(/[^\u0000-\u007F\w\s-]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.has(word) && !/^\d+$/.test(word));

      words.forEach(word => {
        // Update total frequency
        wordFrequencies[word] = (wordFrequencies[word] || 0) + 1;
        
        // Update date-based frequency
        if (!wordDates[word]) {
          wordDates[word] = {};
        }
        wordDates[word][date] = (wordDates[word][date] || 0) + 1;
      });
    });
    // Get top 25 words
    const wordCloudData = Object.entries(wordFrequencies)
      .map(([text, value]) => ({ 
        text, 
        value,
        dates: Object.entries(wordDates[text] || {}).map(([date, count]) => ({ date, count }))
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 25);
    // Sentiment analysis (merge all sources, filtered)
    const redditSentiments = await db.collection('reddit_posts').aggregate([
      { $match: { ...dateFilter, sentiment: { $exists: true } } },
      { $project: { sentiment: "$sentiment.sentiment" } },
      { $group: { _id: "$sentiment", count: { $sum: 1 } } }
    ]).toArray();
    const twitterSentiments = await db.collection('tweets').aggregate([
      { $match: { ...dateFilter, sentiment: { $exists: true } } },
      { $project: { sentiment: "$sentiment.sentiment" } },
      { $group: { _id: "$sentiment", count: { $sum: 1 } } }
    ]).toArray();
    const blueskySentiments = await db.collection('bluesky_posts').aggregate([
      { $match: { ...dateFilter, sentiment: { $exists: true } } },
      { $project: { sentiment: "$sentiment.sentiment" } },
      { $group: { _id: "$sentiment", count: { $sum: 1 } } }
    ]).toArray();
    const sentimentCounts = { "Slightly Negative": 0, "Slightly Positive": 0, "Positive": 0, "Negative": 0, "Neutral": 0 };
    [redditSentiments, twitterSentiments, blueskySentiments].flat().forEach(item => { if (item._id) sentimentCounts[item._id] = (sentimentCounts[item._id] || 0) + item.count; });
    const sentimentData = Object.entries(sentimentCounts).filter(([_, count]) => count > 0).map(([sentiment, count]) => ({ sentiment, count }));
    // Sentiment by source (dominant sentiment and percentage for each)
    function getDominantSentiment(sentiments) {
      let max = { sentiment: null, count: 0 };
      let total = 0;
      sentiments.forEach(item => {
        total += item.count;
        if (item.count > max.count) max = item;
      });
      return total > 0 ? { sentiment: max._id, percent: Math.round((max.count / total) * 100) } : { sentiment: null, percent: 0 };
    }
    const redditSentimentsAgg = await db.collection('reddit_posts').aggregate([
      { $match: { ...dateFilter, sentiment: { $exists: true } } },
      { $project: { sentiment: "$sentiment.sentiment" } },
      { $group: { _id: "$sentiment", count: { $sum: 1 } } }
    ]).toArray();
    const twitterSentimentsAgg = await db.collection('tweets').aggregate([
      { $match: { ...dateFilter, sentiment: { $exists: true } } },
      { $project: { sentiment: "$sentiment.sentiment" } },
      { $group: { _id: "$sentiment", count: { $sum: 1 } } }
    ]).toArray();
    const blueskySentimentsAgg = await db.collection('bluesky_posts').aggregate([
      { $match: { ...dateFilter, sentiment: { $exists: true } } },
      { $project: { sentiment: "$sentiment.sentiment" } },
      { $group: { _id: "$sentiment", count: { $sum: 1 } } }
    ]).toArray();
    const sentimentBySource = [
      { source: 'Reddit', ...getDominantSentiment(redditSentimentsAgg) },
      { source: 'Twitter', ...getDominantSentiment(twitterSentimentsAgg) },
      { source: 'Bluesky', ...getDominantSentiment(blueskySentimentsAgg) }
    ];
    // Add sentiment data to analytics response
    const analytics = {
      totalPosts: redditCount + twitterCount + blueskyCount,
      sourceBreakdown,
      postsOverTime,
      wordCloudData,
      sentimentData,
      sentimentBySource
    };
    console.log('Analytics response sentimentData:', analytics.sentimentData);
    console.log('Sending analytics response:', {
      totalPosts: analytics.totalPosts,
      postsOverTimeCount: postsOverTime.length,
      wordCloudDataCount: wordCloudData.length,
      samplePostOverTime: postsOverTime[0]
    });
    res.json(analytics);
  } catch (error) {
    console.error('Error in analytics endpoint:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

/**
 * Endpoint to manually trigger sentiment analysis
 */
app.post('/api/monitor/trigger-sentiment', (req, res) => {
  try 
  {    
    // First check if monitorService and sentimentScheduler are defined
    if (!monitorService) 
    {
      throw new Error('Monitor service is not initialised');
    }
    
    // Call notifyTwitterScrape or notifyRedditScrape directly based on source
    let result;
    if (req.body.source === 'twitter') 
    {
      result = monitorService.notifyTwitterScrape({
        totalCount: req.body.tweetCount,
        status: 'external_trigger',
        source: 'twitter_scraper'
      });
    } 
    else if (req.body.source === 'reddit') {
      result = monitorService.notifyRedditScrape({
        postCount: req.body.postCount,
        status: 'external_trigger',
        source: 'reddit_scraper'
      });
    } 
    else if (req.body.source === 'bluesky') {
      result = monitorService.notifyBlueskyScrape({
        status: 'external_trigger',
        source: 'bluesky_scraper'
      });
    } 
    else 
    {
      // Default case
      result = {
        acknowledged: true,
        message: 'Received notification, but source not specified'
      };
    }
    
    res.json({
      success: true,
      message: 'Sentiment analysis triggered',
      result
    });
  } catch (error) {
    console.error('Error triggering sentiment analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger sentiment analysis',
      error: error.message
    });
  }
});

// List of all countries in the world
const COUNTRY_MAPPINGS = {
  'Afghanistan': ['afghanistan'],
  'Albania': ['albania'],
  'Algeria': ['algeria'],
  'Andorra': ['andorra'],
  'Angola': ['angola'],
  'Antigua and Barbuda': ['antigua and barbuda'],
  'Argentina': ['argentina'],
  'Armenia': ['armenia'],
  'Australia': ['australia'],
  'Austria': ['austria'],
  'Azerbaijan': ['azerbaijan'],
  'Bahamas': ['bahamas'],
  'Bahrain': ['bahrain'],
  'Bangladesh': ['bangladesh'],
  'Barbados': ['barbados'],
  'Belarus': ['belarus'],
  'Belgium': ['belgium'],
  'Belize': ['belize'],
  'Benin': ['benin'],
  'Bhutan': ['bhutan'],
  'Bolivia': ['bolivia'],
  'Bosnia and Herzegovina': ['bosnia and herzegovina'],
  'Botswana': ['botswana'],
  'Brazil': ['brazil'],
  'Brunei': ['brunei'],
  'Bulgaria': ['bulgaria'],
  'Burkina Faso': ['burkina faso'],
  'Burundi': ['burundi'],
  'Cabo Verde': ['cabo verde'],
  'Cambodia': ['cambodia'],
  'Cameroon': ['cameroon'],
  'Canada': ['canada'],
  'Central African Republic': ['central african republic'],
  'Chad': ['chad'],
  'Chile': ['chile'],
  'China': ['china'],
  'Colombia': ['colombia'],
  'Comoros': ['comoros'],
  'Congo (Congo-Brazzaville)': ['congo (congo-brazzaville)'],
  'Costa Rica': ['costa rica'],
  'Croatia': ['croatia'],
  'Cuba': ['cuba'],
  'Cyprus': ['cyprus'],
  'Czechia (Czech Republic)': ['czechia (czech republic)'],
  'Democratic Republic of the Congo': ['democratic republic of the congo'],
  'Denmark': ['denmark'],
  'Djibouti': ['djibouti'],
  'Dominica': ['dominica'],
  'Dominican Republic': ['dominican republic'],
  'Ecuador': ['ecuador'],
  'Egypt': ['egypt'],
  'El Salvador': ['el salvador'],
  'Equatorial Guinea': ['equatorial guinea'],
  'Eritrea': ['eritrea'],
  'Estonia': ['estonia'],
  'Eswatini (fmr. "Swaziland")': ['eswatini (fmr. "swaziland")'],
  'Ethiopia': ['ethiopia'],
  'Fiji': ['fiji'],
  'Finland': ['finland'],
  'France': ['france'],
  'Gabon': ['gabon'],
  'Gambia': ['gambia'],
  'Georgia': ['georgia'],
  'Germany': ['germany'],
  'Ghana': ['ghana'],
  'Greece': ['greece'],
  'Grenada': ['grenada'],
  'Guatemala': ['guatemala'],
  'Guinea': ['guinea'],
  'Guinea-Bissau': ['guinea-bissau'],
  'Guyana': ['guyana'],
  'Haiti': ['haiti'],
  'Holy See': ['holy see'],
  'Honduras': ['honduras'],
  'Hungary': ['hungary'],
  'Iceland': ['iceland'],
  'India': ['india'],
  'Indonesia': ['indonesia'],
  'Iran': ['iran'],
  'Iraq': ['iraq'],
  'Ireland': ['ireland'],
  'Israel': ['israel'],
  'Italy': ['italy'],
  'Jamaica': ['jamaica'],
  'Japan': ['japan'],
  'Jordan': ['jordan'],
  'Kazakhstan': ['kazakhstan'],
  'Kenya': ['kenya'],
  'Kiribati': ['kiribati'],
  'Kuwait': ['kuwait'],
  'Kyrgyzstan': ['kyrgyzstan'],
  'Laos': ['laos'],
  'Latvia': ['latvia'],
  'Lebanon': ['lebanon'],
  'Lesotho': ['lesotho'],
  'Liberia': ['liberia'],
  'Libya': ['libya'],
  'Liechtenstein': ['liechtenstein'],
  'Lithuania': ['lithuania'],
  'Luxembourg': ['luxembourg'],
  'Madagascar': ['madagascar'],
  'Malawi': ['malawi'],
  'Malaysia': ['malaysia'],
  'Maldives': ['maldives'],
  'Mali': ['mali'],
  'Malta': ['malta'],
  'Marshall Islands': ['marshall islands'],
  'Mauritania': ['mauritania'],
  'Mauritius': ['mauritius'],
  'Mexico': ['mexico'],
  'Micronesia': ['micronesia'],
  'Moldova': ['moldova'],
  'Monaco': ['monaco'],
  'Mongolia': ['mongolia'],
  'Montenegro': ['montenegro'],
  'Morocco': ['morocco'],
  'Mozambique': ['mozambique'],
  'Myanmar (formerly Burma)': ['myanmar (formerly burma)'],
  'Namibia': ['namibia'],
  'Nauru': ['nauru'],
  'Nepal': ['nepal'],
  'Netherlands': ['netherlands'],
  'New Zealand': ['new zealand'],
  'Nicaragua': ['nicaragua'],
  'Niger': ['niger'],
  'Nigeria': ['nigeria'],
  'North Korea': ['north korea'],
  'North Macedonia': ['north macedonia'],
  'Norway': ['norway'],
  'Oman': ['oman'],
  'Pakistan': ['pakistan'],
  'Palau': ['palau'],
  'Palestine State': ['palestine state'],
  'Panama': ['panama'],
  'Papua New Guinea': ['papua new guinea'],
  'Paraguay': ['paraguay'],
  'Peru': ['peru'],
  'Philippines': ['philippines'],
  'Poland': ['poland'],
  'Portugal': ['portugal'],
  'Qatar': ['qatar'],
  'Romania': ['romania'],
  'Russia': ['russia'],
  'Rwanda': ['rwanda'],
  'Saint Kitts and Nevis': ['saint kitts and nevis'],
  'Saint Lucia': ['saint lucia'],
  'Saint Vincent and the Grenadines': ['saint vincent and the grenadines'],
  'Samoa': ['samoa'],
  'San Marino': ['san marino'],
  'Sao Tome and Principe': ['sao tome and principe'],
  'Saudi Arabia': ['saudi arabia'],
  'Senegal': ['senegal'],
  'Serbia': ['serbia'],
  'Seychelles': ['seychelles'],
  'Sierra Leone': ['sierra leone'],
  'Singapore': ['singapore'],
  'Slovakia': ['slovakia'],
  'Slovenia': ['slovenia'],
  'Solomon Islands': ['solomon islands'],
  'Somalia': ['somalia'],
  'South Africa': ['south africa'],
  'South Korea': ['south korea'],
  'South Sudan': ['south sudan'],
  'Spain': ['spain'],
  'Sri Lanka': ['sri lanka'],
  'Sudan': ['sudan'],
  'Suriname': ['suriname'],
  'Sweden': ['sweden'],
  'Switzerland': ['switzerland'],
  'Syria': ['syria'],
  'Tajikistan': ['tajikistan'],
  'Tanzania': ['tanzania'],
  'Thailand': ['thailand'],
  'Timor-Leste': ['timor-leste'],
  'Togo': ['togo'],
  'Tonga': ['tonga'],
  'Trinidad and Tobago': ['trinidad and tobago'],
  'Tunisia': ['tunisia'],
  'Turkey': ['turkey'],
  'Turkmenistan': ['turkmenistan'],
  'Tuvalu': ['tuvalu'],
  'Uganda': ['uganda'],
  'Ukraine': ['ukraine'],
  'United Arab Emirates': ['united arab emirates'],
  'United Kingdom': ['united kingdom'],
  'USA': ['united states', 'america', 'united states of america', 'u.s.', 'u.s.a.'],
  'Uruguay': ['uruguay'],
  'Uzbekistan': ['uzbekistan'],
  'Vanuatu': ['vanuatu'],
  'Venezuela': ['venezuela'],
  'Vietnam': ['vietnam'],
  'Yemen': ['yemen'],
  'Zambia': ['zambia'],
  'Zimbabwe': ['zimbabwe']
};

// Helper to get unique post ID
function getPostUniqueId(post) {
  return post.post_id || (post._id && post._id.toString());
}

// Helper to get platform name from collection
function getPlatformFromCollection(collectionName) {
  if (collectionName === 'tweets') return 'Twitter';
  if (collectionName === 'reddit_posts') return 'Reddit';
  if (collectionName === 'bluesky_posts') return 'Bluesky';
  return '';
}

// Shared function to build country->Set(postId) and postId->post
async function buildCountryPostMaps(db) {
  const collections = ['reddit_posts', 'tweets', 'bluesky_posts'];
  const countryToPosts = {};
  const postIdToPost = {};
  for (const collectionName of collections) {
    const posts = await db.collection(collectionName).find({}, { projection: { content_text: 1, user_location: 1, post_id: 1, _id: 1, likes: 1, comments: 1, username: 1, url: 1, platform: 1 } }).toArray();
    for (const post of posts) {
      const postId = getPostUniqueId(post);
      // Only count/show posts with a valid url
      if (!postId || !post.url) continue;
      post.platform = post.platform || getPlatformFromCollection(collectionName);
      postIdToPost[postId] = post;
      const text = (post.content_text || '').toLowerCase();
      const loc = (post.user_location || '').toLowerCase();
      for (const country of Object.keys(COUNTRY_MAPPINGS)) {
        for (const variant of COUNTRY_MAPPINGS[country]) {
          if (
            text.includes(variant.toLowerCase()) ||
            loc.includes(variant.toLowerCase())
          ) {
            if (!countryToPosts[country]) countryToPosts[country] = new Set();
            countryToPosts[country].add(postId);
          }
        }
      }
      if (loc.includes('nepal') || text.includes('nepal')) {
        console.log('DEBUG: Found Nepal in post:', { postId, loc, text, url: post.url });
      }
    }
  }
  // Add debug log for final countryToPosts
  console.log('FINAL countryToPosts keys:', Object.keys(countryToPosts));
  console.log('FINAL countryToPosts counts:', Object.entries(countryToPosts).map(([k, v]) => [k, v.size]));
  return { countryToPosts, postIdToPost };
}

// Endpoint to get country mentions (count unique posts per country)
app.get('/api/geographic/country-mentions', async (req, res) => {
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    const db = client.db(DB_NAME);
    const { countryToPosts } = await buildCountryPostMaps(db);
    // Debug: log post IDs for each country
    for (const [country, postSet] of Object.entries(countryToPosts)) {
      console.log(`[country-mentions] ${country}: count=${postSet.size}, postIds=[${Array.from(postSet).join(', ')}]`);
    }
    // Convert to array and sort by unique post count
    const result = Object.entries(countryToPosts)
      .map(([country, postSet]) => ({ country, count: postSet.size }))
      .sort((a, b) => b.count - a.count);
    res.json(result);
  } catch (error) {
    console.error('Error getting country mentions:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// Endpoint to get top posts by country
app.get('/api/geographic/top-posts-by-country', async (req, res) => {
  let client;
  try {
    const { country } = req.query;
    if (!country) {
      return res.status(400).json({ error: 'Country parameter is required' });
    }
    client = await MongoClient.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    const db = client.db(DB_NAME);
    const { countryToPosts, postIdToPost } = await buildCountryPostMaps(db);
    const postIds = countryToPosts[country] ? Array.from(countryToPosts[country]) : [];
    // Group posts by platform
    const grouped = { tweets: [], reddit_posts: [], bluesky_posts: [] };
    for (const postId of postIds) {
      const post = postIdToPost[postId];
      if (!post) continue;
      if (post.platform === 'Twitter') grouped.tweets.push(post);
      else if (post.platform === 'Reddit') grouped.reddit_posts.push(post);
      else if (post.platform === 'Bluesky') grouped.bluesky_posts.push(post);
    }
    // Debug: log post IDs and actual posts returned for the selected country
    console.log(`[top-posts-by-country] ${country}: postIds=[${postIds.join(', ')}]`);
    for (const key of Object.keys(grouped)) {
      console.log(`[top-posts-by-country] ${country} ${key}: count=${grouped[key].length}, postIds=[${grouped[key].map(p => getPostUniqueId(p)).join(', ')}]`);
    }
    // Do NOT slice to 5, return all for debugging
    res.json(grouped);
  } catch (error) {
    console.error('Error getting top posts by country:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// Disease and crop keyword lists
const DISEASE_KEYWORDS = [
  'Anthracnose', 'Barley stripe', 'Common root rot', 'Crown Rot', 'Crown rust', 'Downy mildew', 'Eyespot', 'Halo spot', 'Leaf rust', 'Leaf scald', 'Leaf spot', 'Loose smut', 'Net blotch', 'NFNB', 'Net form net blotch', 'Powdery mildew', 'Pythium root rot', 'Rhizoctonia', 'Scald', 'SFNB', 'Spot form net blotch', 'Stagonospora blotch', 'Snow molds', 'Gray snow mold', 'Typhula blight', 'Pink snow mold', 'Fusarium patch', 'Stem rust', 'Stripe rust', 'Yellow rust', 'Snow rot', 'Take-all', 'Tan spot', 'Pyrenophora tritici-repentis', 'Alternaria leaf blight', 'Anthracnose', 'Alternaria triticina', 'leaf blight', 'Bipolaris leaf spot', 'common bunt', 'Crown rot', 'Downy mildew', 'Flag smut', 'Foot rot', 'Fusarium head blight', 'Leaf rust', 'Powdery mildew', 'Pythium', 'Ring spot', 'Rhizoctonia', 'Root rot', 'Septoria avenae blotch', 'Septoria nodorum', 'Septoria tritici blotch', 'Stem rust', 'Stripe rust', 'Take-all', 'Yellow leaf spot', 'Blackleg', 'Powdery mildew', 'Rhizoctonia damping off root rot', 'Sclerotinia stem rot', 'White leaf spot', 'Ascochyta blight', 'Black root rot', 'Botrytis grey mould', 'Sclerotinia', 'Ascochyta blight', 'Chocolate Spot', 'Rust', 'Anthracnose', 'Brown Leaf spot', 'charcoal rot', 'Cladosporium leaf spot', 'Fusarium root', 'pod rot', 'grey leaf spot', 'grey mould', 'Phomopsis stem blight', 'Pleiochaeta root rot', 'Powdery mildew', 'Pythium damping off', 'Rhizoctonia damping off', 'Rhizoctonia root rot', 'Rhizoctonia bare patch', 'Sclerotinia', 'Ascochyta blight', 'Botrytis grey mould', 'Sclerotinia', 'Powdery mildew', 'Red leather leaf', 'Septoria avanae', 'Alternaria', 'Charcoal rot', 'Fusarium', 'Target spot soybean'
];
const CROP_KEYWORDS = [
  'wheat','rice','barley','corn','maize','millet','oat','rye','sorghum','wheat','chickpea','faba bean','field pea','pea','groundnut','kidney bean','lentil','lupin','mung bean','peanut','phaseolus','pigeon pea','soybean','canola','cotton','safflower'
];

// Helper: get quarter from month (1-based)
function getQuarter(month) {
  if (month >= 1 && month <= 3) return 'Q1';
  if (month >= 4 && month <= 6) return 'Q2';
  if (month >= 7 && month <= 9) return 'Q3';
  return 'Q4';
}

// Helper: normalize and match keywords in text
function findKeywords(text, keywords) {
  const found = new Set();
  if (!text) return found;
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) found.add(kw);
  }
  return found;
}

// API: Quarterly trends for diseases/crops
app.get('/api/seasonal/quarterly-trends', async (req, res) => {
  let client;
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db(DB_NAME);
    const collections = ['reddit_posts', 'tweets', 'bluesky_posts'];
    // Map: { 'Q1': { disease/crop: count, ... }, ... }
    const quarters = { Q1: {}, Q2: {}, Q3: {}, Q4: {} };
    // For available years
    const yearsSet = new Set();
    for (const collection of collections) {
      // Use $expr/$toDate to robustly parse created_at and extract year
      const posts = await db.collection(collection).find({
        $expr: {
          $eq: [ { $year: { $toDate: "$created_at" } }, year ]
        }
      }, { projection: { content_text: 1, created_at: 1 } }).toArray();
      // Also collect all years present in the collection
      const allPosts = await db.collection(collection).find({}, { projection: { created_at: 1 } }).toArray();
      allPosts.forEach(post => {
        if (post.created_at) {
          const d = new Date(post.created_at);
          if (!isNaN(d)) yearsSet.add(d.getFullYear());
        }
      });
      for (const post of posts) {
        if (!post.created_at) continue;
        const date = new Date(post.created_at);
        const postYear = date.getFullYear();
        if (postYear !== year) continue;
        const month = date.getMonth() + 1;
        const quarter = getQuarter(month);
        const text = post.content_text || '';
        let found = findKeywords(text, DISEASE_KEYWORDS);
        let type = 'disease';
        if (found.size === 0) {
          found = findKeywords(text, CROP_KEYWORDS);
          type = 'crop';
        }
        for (const kw of found) {
          if (!quarters[quarter][kw]) quarters[quarter][kw] = { count: 0, type };
          quarters[quarter][kw].count++;
        }
      }
    }
    // Build output: for each quarter, top 5 and all counts
    const output = { year, availableYears: Array.from(yearsSet).sort(), quarters: [], qoq_change: {} };
    const allNames = new Set();
    for (const q of ['Q1','Q2','Q3','Q4']) {
      const allCounts = quarters[q];
      const sorted = Object.entries(allCounts).sort((a,b) => b[1].count - a[1].count);
      const top = sorted.slice(0,5).map(([name, obj]) => ({ name, type: obj.type, count: obj.count }));
      output.quarters.push({ quarter: q, top, all_counts: Object.fromEntries(sorted.map(([name, obj]) => [name, obj.count])) });
      for (const name of Object.keys(allCounts)) allNames.add(name);
    }
    // Calculate quarter-over-quarter % change for each disease/crop
    for (const name of allNames) {
      output.qoq_change[name] = {};
      let prev = null;
      for (const q of ['Q1','Q2','Q3','Q4']) {
        const curr = quarters[q][name]?.count || 0;
        if (prev !== null) {
          const pct = prev === 0 ? (curr === 0 ? 0 : 100) : Math.round(((curr - prev) / prev) * 100);
          output.qoq_change[name][`${q}`] = pct;
        }
        prev = curr;
      }
    }
    res.json(output);
  } catch (error) {
    console.error('Error in /api/seasonal/quarterly-trends:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (client) await client.close();
  }
});

// API: Source Distribution analytics with date range and previous period comparison
app.get('/api/source-distribution', async (req, res) => {
  let client;
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required (YYYY-MM-DD)' });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    // Calculate previous period
    const msInDay = 24 * 60 * 60 * 1000;
    const days = Math.ceil((end - start) / msInDay) + 1;
    const prevEnd = new Date(start.getTime() - msInDay);
    const prevStart = new Date(prevEnd.getTime() - (days - 1) * msInDay);
    client = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db(DB_NAME);
    const collections = [
      { name: 'Reddit', col: 'reddit_posts' },
      { name: 'Twitter', col: 'tweets' },
      { name: 'Bluesky', col: 'bluesky_posts' }
    ];
    let totalMentions = 0;
    let totalMentionsPrev = 0;
    let trendData = {};
    let trendDataPrev = {};
    let sourceBreakdown = [];
    let sourceBreakdownPrev = [];
    let activePlatforms = [];
    let allDates = new Set();
    let allDatesPrev = new Set();
    // For top keywords by source
    const topKeywordsBySource = [];
    const allKeywords = [...new Set([...DISEASE_KEYWORDS, ...CROP_KEYWORDS].map(k => k.toLowerCase()))];
    function extractKeywords(text) {
      if (!text) return [];
      const lower = text.toLowerCase();
      return allKeywords.filter(kw => lower.includes(kw));
    }
    // For each source, aggregate data
    for (const { name, col } of collections) {
      // Current period (robust date filter)
      const posts = await db.collection(col).find({
        $expr: {
          $and: [
            { $gte: [ { $toDate: "$created_at" }, start ] },
            { $lte: [ { $toDate: "$created_at" }, end ] }
          ]
        }
      }, { projection: { created_at: 1, content_text: 1 } }).toArray();
      const count = posts.length;
      totalMentions += count;
      sourceBreakdown.push({ source: name, count });
      if (count > 0) activePlatforms.push(name);
      // Group by day for trend
      posts.forEach(post => {
        const d = new Date(post.created_at);
        const key = d.toISOString().slice(0, 10);
        allDates.add(key);
        if (!trendData[key]) trendData[key] = { date: key };
        trendData[key][name] = (trendData[key][name] || 0) + 1;
      });
      // Top keywords for this source
      const keywordCounts = {};
      posts.forEach(post => {
        const kws = extractKeywords(post.content_text);
        kws.forEach(kw => {
          keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
        });
      });
      const top5 = Object.entries(keywordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([keyword, count]) => ({ source: name, keyword, count }));
      topKeywordsBySource.push(...top5);
      // Previous period (robust date filter)
      const postsPrev = await db.collection(col).find({
        $expr: {
          $and: [
            { $gte: [ { $toDate: "$created_at" }, prevStart ] },
            { $lte: [ { $toDate: "$created_at" }, prevEnd ] }
          ]
        }
      }, { projection: { created_at: 1 } }).toArray();
      const countPrev = postsPrev.length;
      totalMentionsPrev += countPrev;
      sourceBreakdownPrev.push({ source: name, count: countPrev });
      postsPrev.forEach(post => {
        const d = new Date(post.created_at);
        const key = d.toISOString().slice(0, 10);
        allDatesPrev.add(key);
        if (!trendDataPrev[key]) trendDataPrev[key] = { date: key };
        trendDataPrev[key][name] = (trendDataPrev[key][name] || 0) + 1;
      });
    }
    // Prepare trendData arrays (sorted by date)
    const trendArr = Array.from(allDates).sort().map(date => ({
      date,
      ...trendData[date],
      Reddit: trendData[date]?.Reddit || 0,
      Twitter: trendData[date]?.Twitter || 0,
      Bluesky: trendData[date]?.Bluesky || 0
    }));
    const trendArrPrev = Array.from(allDatesPrev).sort().map(date => ({
      date,
      ...trendDataPrev[date],
      Reddit: trendDataPrev[date]?.Reddit || 0,
      Twitter: trendDataPrev[date]?.Twitter || 0,
      Bluesky: trendDataPrev[date]?.Bluesky || 0
    }));
    // Calculate averages
    const avgDailyPosts = days > 0 ? Math.round(totalMentions / days) : 0;
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
    const avgMonthlyPosts = months > 0 ? Math.round(totalMentions / months) : 0;
    // Source performance metrics (% change vs previous period)
    const sourcePerformance = sourceBreakdown.map((curr, i) => {
      const prev = sourceBreakdownPrev[i] || { count: 0 };
      const change = prev.count === 0 ? (curr.count === 0 ? 0 : 100) : Math.round(((curr.count - prev.count) / prev.count) * 100);
      return { source: curr.source, change };
    });
    // Placeholder for keywords/engagement
    const engagementBySource = {};
    res.json({
      totalSources: collections.length,
      totalMentions,
      avgDailyPosts,
      avgMonthlyPosts,
      sourceBreakdown,
      sourcePerformance,
      trendData: trendArr,
      activePlatforms,
      topKeywordsBySource,
      engagementBySource,
      trendDataPrev
    });
  } catch (error) {
    console.error('Error in /api/source-distribution:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (client) await client.close();
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Combined API server running on port ${PORT}`);
});
}).catch(error => {
  console.error('Failed to initialize the application:', error);
  process.exit(1);
}); 