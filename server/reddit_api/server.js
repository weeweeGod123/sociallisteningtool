const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const axios = require('axios');
const { createObjectCsvWriter } = require('csv-writer');
const { v4: uuidv4 } = require('uuid');
const { MongoClient } = require('mongodb');

// Load environment variables from parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Log Reddit API credentials to verify they're loaded
console.log("Reddit API Credentials:");
console.log(`- Client ID: ${process.env.REDDIT_CLIENT_ID ? process.env.REDDIT_CLIENT_ID.substring(0, 5) + "..." : "Not loaded"}`);
console.log(`- Client Secret: ${process.env.REDDIT_CLIENT_SECRET ? "Loaded (hidden for security)" : "Not loaded"}`);
console.log(`- User Agent: ${process.env.REDDIT_USER_AGENT || "Not loaded"}`);

const app = express();
const PORT = process.env.REDDIT_PORT || 5002;

// Path to the Reddit scraper
const SCRAPER_PATH = path.join(__dirname, '..', 'reddit_scraper');

// Create output directory if it doesn't exist
const outputDir = path.join(SCRAPER_PATH, 'output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log('Created output directory:', outputDir);
}

// Log important paths to help with debugging
console.log('Reddit scraper path:', SCRAPER_PATH);
console.log('Current directory:', __dirname);

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies

// Serve static files from the output directory
app.use('/reddit_scraper/output', express.static(path.join(SCRAPER_PATH, 'output')));

// Store information about ongoing searches
const redditSearches = {};

// MongoDB connection string - Fix to use the connection string from .env
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/social-listening';
console.log('Using MongoDB connection string from environment variables');

/**
 * Generate a unique search ID for tracking searches
 * @returns {string} A unique search ID
 */
function generateSearchId() {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomPart}`;
}

// Helper function to determine Python executable path
function getPythonPath() {
  // Try to figure out the best Python command for the system
  const platform = process.platform;
  if (platform === 'win32') {
    // On Windows, try 'python' first
    return 'python';
  } else {
    // On macOS and Linux, try 'python3' first, fallback to 'python'
    return 'python3';
  }
}

/**
 * Update the search parameters for the Reddit scraper based on the frontend search query
 */
function updateRedditSearchParams(searchParams, searchId) {
  return new Promise((resolve, reject) => {
    try {
      // Parse the query string into a more structured format
      // that respects AND, OR, NOT operators
      const queryString = searchParams.query.trim();
      console.log(`Parsing query string: "${queryString}"`);
      
      // Handle exact phrases first before tokenizing
      const exactPhrases = [];
      let modifiedQuery = queryString.replace(/"([^"]+)"/g, (match, phrase) => {
        exactPhrases.push(phrase);
        return `EXACTPHRASE${exactPhrases.length - 1}`;
      });
      
      // Pre-process parenthetical expressions
      const parentheticalExpressions = [];
      modifiedQuery = modifiedQuery.replace(/\(([^()]+)\)/g, (match, content) => {
        parentheticalExpressions.push(content);
        return `PARENEXPR${parentheticalExpressions.length - 1}`;
      });
      
      // Split the modified query into tokens
      const tokens = modifiedQuery.split(/\s+/);
      
      // Initialize search configuration with ONLY the necessary fields
      // DO NOT include any default hashtags, exact phrases, or additional terms
      const searchConfig = {
        and_terms: [],
        or_terms: [],
        not_terms: [],
        exact_phrases: [],
        // Agriculture-specific subreddits to search in addition to all Reddit
        subreddits: [
          "AusFarming",
          "GrainGrowers",
          "RegenerativeAg",
          "AustralianAgriculture",
          "farming", 
          "agriculture", 
          "australianplants",
          "australiangardening",
          "AustralianAgriculture",
          "WesternAustralia",
          "perth",
          "ausfarming",
          "permaculture",
          "AussieFarmers",
          "gardening",
          "OrganicFarming",
          "plantdisease",
          "PlantPathology",
          "cropfarming",
          "wheat",
          "sustainablefarming",
          "AgTech",
          "crops",
          "Agronomy",
          "soilscience",
          "Irrigation",
          "Pesticides",
          "botany",
          "farmers"
        ],
        search_all_reddit: true,
        time_filter: "all",
        sort_by: "relevance"
      };
      
      // Process the tokens to build the correct search configuration
      // This uses the user's query exclusively without adding default terms
      let i = 0;
      while (i < tokens.length) {
        const token = tokens[i];
        
        // Handle exact phrase placeholders
        if (token.startsWith('EXACTPHRASE')) {
          const index = parseInt(token.slice(11));
          searchConfig.exact_phrases.push(exactPhrases[index]);
          i++;
          continue;
        }
        
        // Handle parenthetical expression placeholders
        if (token.startsWith('PARENEXPR')) {
          const index = parseInt(token.slice(9));
          const parenExpr = parentheticalExpressions[index];
          
          // Extract the terms from the parenthetical expression
          const innerTerms = parenExpr.split(/\s+/); // Split by whitespace
          
          // Check if this is an OR expression (contains OR)
          if (innerTerms.includes('OR')) {
            // Extract all non-operator terms from the OR expression
            for (let j = 0; j < innerTerms.length; j++) {
              if (innerTerms[j] !== 'OR') {
                searchConfig.or_terms.push(innerTerms[j]);
              }
            }
          } else {
            // If no OR, then treat as a group of AND terms
            for (let j = 0; j < innerTerms.length; j++) {
              if (innerTerms[j] !== 'AND') {
                searchConfig.and_terms.push(innerTerms[j]);
              }
            }
          }
          
          i++;
          continue;
        }
        
        // Process normal operators and terms
        if (token.toUpperCase() === "AND") {
          // Skip AND operators (they're implied)
          i++;
        } else if (token.toUpperCase() === "OR" && i + 1 < tokens.length) {
          // Add the term after OR to or_terms
          i++;
          const nextToken = tokens[i];
          if (nextToken.startsWith('PARENEXPR') || nextToken.startsWith('EXACTPHRASE')) {
            // We'll handle this in the appropriate case above
            continue;
          }
          searchConfig.or_terms.push(nextToken);
          i++;
        } else if (token.toUpperCase() === "NOT" && i + 1 < tokens.length) {
          // Add next term to not_terms
          searchConfig.not_terms.push(tokens[i + 1]);
          i += 2;
        } else {
          // Regular term - add to and_terms
          searchConfig.and_terms.push(token);
          i++;
        }
      }
      
      // Remove any additional terms that might be added by external code
      delete searchConfig.hashtags;
      
      // Make sure exact_phrases only contains phrases from the user's query
      if (searchConfig.exact_phrases.length > 0) {
        // Filter out any exact phrases that aren't in the original list of extracted phrases
        searchConfig.exact_phrases = searchConfig.exact_phrases.filter(phrase => 
          exactPhrases.includes(phrase)
        );
      }
      
      console.log('Parsed search configuration:', searchConfig);
      
      // Create search parameters file with the structured format
      // ONLY include the fields that were explicitly parsed from the user's query
      const searchParamsContent = `
# Reddit search parameters (Search ID: ${searchId})
SEARCH_PARAMS = {
  ${searchConfig.and_terms.length > 0 ? `"and_terms": ${JSON.stringify(searchConfig.and_terms)},` : ''}
  ${searchConfig.or_terms.length > 0 ? `"or_terms": ${JSON.stringify(searchConfig.or_terms)},` : ''}
  ${searchConfig.not_terms.length > 0 ? `"not_terms": ${JSON.stringify(searchConfig.not_terms)},` : ''}
  ${searchConfig.exact_phrases.length > 0 ? `"exact_phrases": ${JSON.stringify(searchConfig.exact_phrases)},` : ''}
  "subreddits": ${JSON.stringify(searchConfig.subreddits, null, 4)},
  "search_all_reddit": True,
  "time_filter": "all",
  "sort_by": "relevance"
}

# Minimum number of posts to retrieve
MINIMUM_POSTS = 10000
`;
      
      // Write to a search-specific parameters file
      const paramsFilePath = path.join(SCRAPER_PATH, `reddit_search_params_${searchId}.py`);
      fs.writeFileSync(paramsFilePath, searchParamsContent);
      
      // Also update the main parameters file for backward compatibility
      const mainParamsFilePath = path.join(SCRAPER_PATH, 'reddit_search_params.py');
      fs.writeFileSync(mainParamsFilePath, searchParamsContent);
      
      console.log('Reddit search parameters updated successfully');
      
      // Return the search configuration for use in the calling function
      resolve(searchConfig);
    } catch (error) {
      console.error('Error updating Reddit search parameters:', error);
      reject(error);
    }
  });
}

// Test if Python and Reddit scraper are working
app.get('/api/reddit/test', (req, res) => {
  console.log('Received Reddit API test request');
  
  // Simple test to check if the API server is running
  res.json({ 
    status: 'success', 
    message: 'Reddit API server is running',
    results: ['Reddit API server is available for search requests']
  });
});

/**
 * API endpoint to start a Reddit search
 */
app.post('/api/reddit/search', async (req, res) => {
  try {
    // Validate search parameters
    if (!req.body.query) {
      return res.status(400).json({ error: 'No search query provided' });
    }
    
    console.log('Received Reddit search request:', req.body);
    
    // Create a unique ID for this search
    const searchId = generateSearchId();
    
    // Update the search parameters files with the new search
    const parsedSearchConfig = await updateRedditSearchParams(req.body, searchId);
    
    // Prepare arguments for the Python script
    const args = [
      path.join(SCRAPER_PATH, 'run_reddit_scraper.py'),
      '--client-id', process.env.REDDIT_CLIENT_ID || 'YOUR_CLIENT_ID',
      '--client-secret', process.env.REDDIT_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
      '--search-id', searchId,
      '--search-params-file', `reddit_search_params_${searchId}.py`,
      '--max-posts', req.body.maxPosts || '10000',
      '--batch-size', req.body.batchSize || '25',
    ];
    
    // Add subreddits parameter if we have subreddits in the search configuration
    if (parsedSearchConfig && parsedSearchConfig.subreddits && parsedSearchConfig.subreddits.length > 0) {
      args.push('--subreddits', parsedSearchConfig.subreddits.join(','));
    }
    
    // Only add date filters if:
    // 1. They are provided in the request AND
    // 2. The user hasn't specified they want to search all time
    const searchAllTime = req.body.searchAllTime === true || req.body.allTime === true;
    
    if (!searchAllTime) {
      // Add date filters if provided
      if (req.body.fromDate) {
        args.push('--from-date', req.body.fromDate);
      }
      if (req.body.toDate) {
        args.push('--to-date', req.body.toDate);
      }
    }
    
    console.log('Spawning Python process with arguments:', args);
    console.log(`Search all time: ${searchAllTime ? 'Yes' : 'No'}`);
    
    // Spawn the Python process
    const pythonProcess = spawn(process.platform === 'win32' ? 'python' : 'python3', args, {
      cwd: SCRAPER_PATH
    });
    
    // Store information about this search
    redditSearches[searchId] = {
      status: 'running',
      lastUpdated: new Date(),
      process: pythonProcess,
      outputFile: path.join(SCRAPER_PATH, 'output', `reddit_results_${searchId}.csv`),
      statusFile: path.join(SCRAPER_PATH, 'output', `reddit_status_${searchId}.json`)
    };
    
    // Send back the search ID immediately
    res.json({
      id: searchId,
      status: 'started',
      message: 'Reddit search started successfully',
      estimatedTime: '5-10 minutes'
    });
    
    // Handle process output
    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      console.log(`Reddit search ${searchId} output:`, output);
      
      // Update last updated time
      if (redditSearches[searchId]) {
        redditSearches[searchId].lastUpdated = new Date();
      }
      
      // Try to parse and update status if it's a status message
      try {
        if (output.includes('STATUS:')) {
          const statusStr = output.split('STATUS:')[1].trim();
          const statusObj = JSON.parse(statusStr);
          
          // Update the search status
          if (redditSearches[searchId]) {
            redditSearches[searchId].status = statusObj.status;
            
            // Write status to file
            try {
              fs.writeFileSync(
                redditSearches[searchId].statusFile,
                JSON.stringify(statusObj, null, 2)
              );
            } catch (e) {
              console.error(`Error writing status file for search ${searchId}:`, e);
            }
          }
        }
      } catch (e) {
        console.error(`Error parsing status message for search ${searchId}:`, e);
      }
    });
    
    pythonProcess.stderr.on('data', (data) => {
      console.error(`Reddit search ${searchId} error:`, data.toString().trim());
    });
    
    pythonProcess.on('close', (code) => {
      console.log(`Reddit search ${searchId} process exited with code ${code}`);
      
      // Update search status based on exit code
      if (redditSearches[searchId]) {
        redditSearches[searchId].status = code === 0 ? 'completed' : 'failed';
        
        // Create a status file if it doesn't exist yet
        if (!fs.existsSync(redditSearches[searchId].statusFile)) {
          try {
            fs.writeFileSync(
              redditSearches[searchId].statusFile,
              JSON.stringify({
                status: redditSearches[searchId].status,
                post_count: 0
              }, null, 2)
            );
          } catch (e) {
            console.error(`Error creating status file for search ${searchId}:`, e);
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Error starting Reddit search:', error);
    res.status(500).json({ error: 'Error starting search', details: error.message });
  }
});

/**
 * API endpoint to check the status of a Reddit search
 */
app.get('/api/reddit/status', (req, res) => {
  const searchId = req.query.search_id;
  
  if (!searchId) {
    return res.status(400).json({ error: 'search_id parameter is required' });
  }
  
  console.log(`Checking status of Reddit search ${searchId}`);
  
  // Check if we have this search in memory
  if (redditSearches[searchId]) {
    const search = redditSearches[searchId];
    
    // Check if there's a status file
    const statusFile = search.statusFile;
    if (fs.existsSync(statusFile)) {
      try {
        const statusData = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
        return res.json({
          search_id: searchId,
          status: statusData.status,
          post_count: statusData.post_count || search.post_count || 0,
          last_updated: statusData.last_updated || search.lastUpdated,
          // Add flag to indicate if results are still streaming in
          is_streaming: statusData.status === 'running' && fs.existsSync(search.outputFile)
        });
      } catch (statusError) {
        console.error(`Error reading status file for search ${searchId}:`, statusError);
      }
    }
    
    // Return the in-memory status if no file or error reading file
    return res.json({
      search_id: searchId,
      status: search.status,
      post_count: search.post_count || 0,
      last_updated: search.lastUpdated,
      is_streaming: search.status === 'running' && fs.existsSync(search.outputFile)
    });
  }
  
  // Check if there's a status file even if the search is not in memory
  const statusFile = path.join(SCRAPER_PATH, 'output', `reddit_status_${searchId}.json`);
  if (fs.existsSync(statusFile)) {
    try {
      const statusData = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
      const outputFile = path.join(SCRAPER_PATH, 'output', `reddit_results_${searchId}.csv`);
      
      return res.json({
        search_id: searchId,
        status: statusData.status,
        post_count: statusData.post_count || 0,
        last_updated: statusData.last_updated,
        // If the status is running but we have results, it's streaming
        is_streaming: statusData.status === 'running' && fs.existsSync(outputFile)
      });
    } catch (statusError) {
      console.error(`Error reading status file for search ${searchId}:`, statusError);
    }
  }
  
  // If we can't find the search, check if there's a results file
  const resultsFile = path.join(SCRAPER_PATH, 'output', `reddit_results_${searchId}.csv`);
  if (fs.existsSync(resultsFile)) {
    try {
      // Try to count lines in the file (each line is a post)
      const fileContent = fs.readFileSync(resultsFile, 'utf8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      const postCount = Math.max(0, lines.length - 1); // Subtract 1 for header row
      
      return res.json({
        search_id: searchId,
        status: 'completed',
        post_count: postCount,
        last_updated: new Date(fs.statSync(resultsFile).mtime).toISOString()
      });
    } catch (fileError) {
      console.error(`Error reading results file for search ${searchId}:`, fileError);
    }
  }
  
  // If all else fails, return not found
  res.status(404).json({
    error: 'Search not found',
    search_id: searchId
  });
});

/**
 * API endpoint to get the results of a completed Reddit search
 */
app.get('/api/reddit/results', (req, res) => {
  const searchId = req.query.search_id;
  
  if (!searchId) {
    return res.status(400).json({ error: 'search_id parameter is required' });
  }
  
  console.log(`Getting results for Reddit search ${searchId}`);
  
  // Check if the results file exists
  const resultsFile = path.join(SCRAPER_PATH, 'output', `reddit_results_${searchId}.csv`);
  if (!fs.existsSync(resultsFile)) {
    return res.status(404).json({
      error: 'Results not found',
      search_id: searchId
    });
  }
  
  try {
    // Read and parse the CSV file
    const fileContent = fs.readFileSync(resultsFile, 'utf8');
    const results = parseCSV(fileContent);
    
    // Check if search is still in progress (streaming results)
    const statusFile = path.join(SCRAPER_PATH, 'output', `reddit_status_${searchId}.json`);
    let isStreaming = false;
    let status = "completed";
    
    if (fs.existsSync(statusFile)) {
      try {
        const statusData = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
        status = statusData.status;
        isStreaming = status === "running";
      } catch (statusError) {
        console.error(`Error reading status file: ${statusError}`);
      }
    }
    
    res.json({
      search_id: searchId,
      count: results.length,
      results: results,
      status: status,
      is_streaming: isStreaming,
      message: isStreaming ? "More results are being collected in real-time..." : "All results collected."
    });
  } catch (error) {
    console.error(`Error reading results for search ${searchId}:`, error);
    res.status(500).json({
      error: 'Failed to read search results',
      details: error.message
    });
  }
});

/**
 * Helper function to parse a CSV file into an array of objects
 */
function parseCSV(csvContent) {
  // Split the CSV into lines
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  if (lines.length <= 1) {
    return [];
  }
  
  // Parse the header row
  const headers = parseCSVLine(lines[0]);
  
  // Parse each data row
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    // Create an object with header keys and row values
    const result = {};
    for (let j = 0; j < headers.length; j++) {
      if (j < values.length) {
        result[headers[j]] = values[j];
      }
    }
    
    results.push(result);
  }
  
  return results;
}

/**
 * Helper function to parse a CSV line into an array of values, handling quoted values
 */
function parseCSVLine(line) {
  const values = [];
  let currentValue = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      // Toggle quote state
      inQuotes = !inQuotes;
      continue;
    }
    
    if (char === ',' && !inQuotes) {
      // End of value
      values.push(currentValue);
      currentValue = '';
      continue;
    }
    
    // Add character to current value
    currentValue += char;
  }
  
  // Add the last value
  values.push(currentValue);
  
  return values;
}

/**
 * API endpoint to clear Reddit collections
 */
app.post('/api/reddit/clear-collections', async (req, res) => {
  console.log('\n\n=====================================');
  console.log('RECEIVED CLEAR COLLECTIONS REQUEST');
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
    
    const db = client.db(process.env.MONGO_DB_NAME || 'social-listening');
    console.log('Using database:', process.env.MONGO_DB_NAME || 'social-listening');
    
    // Delete reddit_posts collection
    try {
      await db.collection('reddit_posts').deleteMany({});
      console.log('Deleted all documents from reddit_posts collection');
    } catch (error) {
      console.error('Error clearing reddit_posts collection:', error);
      // Continue with other operations even if this one fails
    }
    
    await client.close();
    
    res.status(200).json({ 
      status: 'success',
      message: 'Reddit collections cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing Reddit collections:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to connect to MongoDB. Please check your connection string in .env file.',
      details: error.message,
      uri_used: MONGO_URI.replace(/\/\/(.+?):(.+?)@/, '//***:***@') // Mask credentials in response
    });
  }
});

// Only start the server if this file is run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Reddit API server running on port ${PORT}`);
  });
}

module.exports = app; 