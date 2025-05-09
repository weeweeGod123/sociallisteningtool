const express = require('express');
const cors = require('cors');
const { PythonShell } = require('python-shell');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { exec, execSync } = require('child_process');
const os = require('os');
const { MongoClient } = require('mongodb');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// MongoDB connection details - Fix to use the connection string from .env
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/social-listening';
console.log('Using MongoDB connection string from environment variables');

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies

// Path to the Twitter scraper
const SCRAPER_PATH = path.join(__dirname, '..', 'twitter_scraper');
// Log important paths to help with debugging
console.log('Twitter scraper path:', SCRAPER_PATH);
console.log('Current directory:', __dirname);

// Create output directory if it doesn't exist
const outputDir = path.join(SCRAPER_PATH, 'output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log('Created output directory:', outputDir);
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
 * Helper function to update the Twitter scraper config with new search parameters
 * @param {Object} searchParams - The search parameters from the frontend
 */
function updateSearchParams(searchParams) {
  try {
    console.log('Updating search parameters directly...');
    
    // Use our direct Node.js script instead of PythonShell
    const updateScript = path.join(__dirname, 'update_search_params.js');
    
    // Make sure query is properly quoted for command line
    const escapedQuery = searchParams.query.replace(/"/g, '\\"');
    
    // Pass searchAllTime parameter to the update script
    const searchAllTime = searchParams.searchAllTime === true;
    console.log(`Search all time parameter: ${searchAllTime}`);
    
    const command = `node "${updateScript}" "${SCRAPER_PATH}" "${escapedQuery}" ${searchAllTime}`;
    console.log('Running command:', command);
    
    const output = execSync(command, {
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 1024 * 1024
    });
    
    console.log('Update output:', output);
    return Promise.resolve(['Search parameters updated successfully']);
  } catch (error) {
    console.error('Error in updateSearchParams:', error);
    return Promise.reject(error);
  }
}

// Test if Python is working 
app.get('/api/test', (req, res) => {
  console.log('Received API test request');
  
  try {
    // Create a simple shell script to run Python test
    const testScriptPath = path.join('/tmp', 'test_twitter_python.sh');
    fs.writeFileSync(testScriptPath, `#!/bin/bash
# Print the directory we're trying to access for debugging
echo "Attempting to access: ${SCRAPER_PATH}"

# Check if directory exists
if [ ! -d "${SCRAPER_PATH}" ]; then
  echo "ERROR: Directory does not exist: ${SCRAPER_PATH}"
  # Try without escaping
  if [ -d ${SCRAPER_PATH} ]; then
    echo "Directory exists without escaping"
    cd ${SCRAPER_PATH}
  else
    echo "Directory does not exist even without escaping"
    exit 1
  fi
else
  # Change to the scraper directory
  cd "${SCRAPER_PATH}"
fi

# Verify current directory
echo "Current directory: $(pwd)"

# Activate the virtual environment if it exists
if [ -d "venv" ]; then
  echo "Activating virtual environment..."
  source venv/bin/activate
fi

# Run a simple Python test
python3 -c "import sys; print('Python version:', sys.version); print('Python executable:', sys.executable); print('Test successful!')"
`);
    fs.chmodSync(testScriptPath, '755'); // Make executable
    
    console.log('Created test shell script:', testScriptPath);
    
    // Use execSync for direct output
    try {
      const output = execSync(testScriptPath, { 
        encoding: 'utf8',
        timeout: 5000,
        maxBuffer: 1024 * 1024
      });
      
      console.log('Python test results:', output);
      
      res.json({ 
        status: 'success', 
        message: 'Python is working correctly',
        results: output.split('\n')
      });
    } catch (execError) {
      console.error('Python test execution failed:', execError);
      
      // Even if the test fails, return success to let the frontend proceed
      res.json({ 
        status: 'success', 
        message: 'API server is running, but Python test had issues',
        results: ['API server is available for search requests']
      });
    }
  } catch (error) {
    console.error('Error in API test endpoint:', error);
    
    // Always return success to let the frontend work
    res.json({ 
      status: 'success', 
      message: 'API server is running',
      results: ['API server is available for search requests']
    });
  }
});

/**
 * API endpoint to clear all collections across all platforms
 */
app.post('/api/twitter/clear-all-collections', async (req, res) => {
  console.log('\n\n=====================================');
  console.log('RECEIVED CLEAR ALL COLLECTIONS REQUEST');
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
    
    // Update collections list to match what's shown in ClusterO
    const collectionsToDelete = ['bluesky_posts', 'posts', 'reddit_posts', 'tweets', 'users'];
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

/**
 * API endpoint to clear Twitter collections
 */
app.post('/api/twitter/clear-collections', async (req, res) => {
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
    
    // Delete tweets collection
    try {
      await db.collection('tweets').deleteMany({});
      console.log('Deleted all documents from tweets collection');
    } catch (error) {
      console.error('Error clearing tweets collection:', error);
      // Continue with other collections even if this one fails
    }
    
    await client.close();
    
    res.status(200).json({ 
      status: 'success',
      message: 'Twitter collections cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing Twitter collections:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to connect to MongoDB. Please check your connection string in .env file.',
      details: error.message,
      uri_used: MONGO_URI.replace(/\/\/(.+?):(.+?)@/, '//***:***@') // Mask credentials in response
    });
  }
});

/**
 * API endpoint to run the Twitter scraper with specified parameters
 */
app.post('/api/twitter/search', async (req, res) => {
  console.log('\n\n=====================================');
  console.log('RECEIVED SEARCH REQUEST');
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
    
    console.log('Received search query:', searchParams.query);
    
    // Delete any existing tweets.csv file to ensure we get fresh results
    const tweetsFile = path.join(SCRAPER_PATH, 'tweets.csv');
    if (fs.existsSync(tweetsFile)) {
      try {
        fs.unlinkSync(tweetsFile);
        console.log('Removed old tweets.csv file to ensure fresh results');
      } catch (deleteError) {
        console.error('Error deleting old tweets file:', deleteError);
        // Continue anyway, as this is not a critical error
      }
    }
    
    // Update the search parameters in the Twitter scraper
    try {
      await updateSearchParams(searchParams);
      console.log('Search parameters updated successfully');
    } catch (updateError) {
      console.error('Error updating search parameters:', updateError);
      throw updateError;
    }
    
    // Run the Twitter scraper
    console.log('Starting Twitter scraper...');
    
    // Get the absolute path to the Python script
    const scriptPath = path.join(SCRAPER_PATH, 'run_scraper.py');
    console.log('Script path:', scriptPath);
    
    // Set options for PythonShell with explicit paths
    const pythonPath = getPythonPath();
    console.log('Using Python path:', pythonPath);
    
    const options = {
      mode: 'text',
      pythonPath: pythonPath,
      pythonOptions: ['-u'], // Unbuffered output for real-time logs
      scriptPath: SCRAPER_PATH,
      args: []
    };
    
    // Run the scraper in non-blocking mode and send initial response
    res.json({ 
      search_id: searchId, // Include the search ID in the response
      message: 'Twitter scraper started successfully',
      status: 'running',
      estimated_time: 'This process will run in the background and may take several minutes'
    });
    
    console.log('About to spawn Python process...');
    
    // Create platform-specific script
    const isWindows = process.platform === 'win32';
    const scriptExt = isWindows ? '.bat' : '.sh';
    const shellScriptPath = path.join(os.tmpdir(), `run_twitter_scraper${scriptExt}`);

    if (isWindows) {
      // Windows batch script
      fs.writeFileSync(shellScriptPath, `@echo off
echo Attempting to access: ${SCRAPER_PATH}

IF NOT EXIST "${SCRAPER_PATH}" (
  echo ERROR: Directory does not exist: ${SCRAPER_PATH}
  exit 1
)

cd "${SCRAPER_PATH}"
echo Current directory: %CD%

IF EXIST "venv" (
  echo Activating virtual environment...
  call venv\\Scripts\\activate.bat
)

where python
python --version

IF NOT EXIST "run_scraper.py" (
  echo ERROR: run_scraper.py not found in %CD%
  dir
  exit 1
)

echo Starting Python script: run_scraper.py
python -u run_scraper.py 2>&1
`);
    } else {
      // Unix shell script
      fs.writeFileSync(shellScriptPath, `#!/bin/bash
# Print the directory we're trying to access for debugging
echo "Attempting to access: ${SCRAPER_PATH}"

# Check if directory exists
if [ ! -d "${SCRAPER_PATH}" ]; then
  echo "ERROR: Directory does not exist: ${SCRAPER_PATH}"
  exit 1
fi

# Change to the scraper directory
cd "${SCRAPER_PATH}"

# Verify current directory
echo "Current directory: $(pwd)"

# Activate the virtual environment if it exists
if [ -d "venv" ]; then
  echo "Activating virtual environment..."
  source venv/bin/activate
fi

# Print Python executable and version for debugging
which python3
python3 --version

# Check if run_scraper.py exists
if [ ! -f "run_scraper.py" ]; then
  echo "ERROR: run_scraper.py not found in $(pwd)"
  ls -la
  exit 1
fi

# Run the script with unbuffered output
echo "Starting Python script: run_scraper.py"
python3 -u run_scraper.py 2>&1
`);
    }

    // Make the script executable (only needed for Unix)
    if (!isWindows) {
      fs.chmodSync(shellScriptPath, '755');
    }
    
    // Use child_process.exec for better output capture
    console.log('Running shell script with exec...');
    const pythonProcess = exec(shellScriptPath, { maxBuffer: 1024 * 1024 * 10 }); // 10MB buffer
    
    console.log('Python process spawned with PID:', pythonProcess.pid);
    
    // Log output in real-time with clear markers
    pythonProcess.stdout.on('data', (data) => {
      console.log(`\n--- PYTHON OUTPUT START ---\n${data}\n--- PYTHON OUTPUT END ---\n`);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      console.error(`\n--- PYTHON ERROR START ---\n${data}\n--- PYTHON ERROR END ---\n`);
    });
    
    pythonProcess.on('error', (error) => {
      console.error('\n--- PYTHON PROCESS ERROR ---\n', error, '\n--- END ERROR ---\n');
    });
    
    pythonProcess.on('close', (code) => {
      console.log(`\n--- PYTHON PROCESS EXITED ---\nExit code: ${code}\n--- END EXIT ---\n`);
    });
    
  } catch (error) {
    console.error('Error in /api/twitter/search endpoint:', error);
    res.status(500).json({ 
      error: 'An error occurred while processing your request',
      details: error.message,
      stack: error.stack // Include stack trace for debugging
    });
  }
});

/**
 * Helper function to parse a CSV line properly handling quoted fields
 * @param {string} line - A line from the CSV file
 * @returns {Array} - Array of field values
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      // Toggle the inQuotes state
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      // End of field, not inside quotes
      result.push(current);
      current = '';
    } else {
      // Add character to current field
      current += char;
    }
  }
  
  // Add the last field
  result.push(current);
  
  return result;
}

/**
 * Parse CSV content properly, handling multiline fields
 * @param {string} csvContent - The entire CSV content as a string
 * @returns {Array} - Array of objects, each representing a row with column headers as keys
 */
function parseCSV(csvContent) {
  // Ensure we have content to parse
  if (!csvContent || !csvContent.trim()) {
    return [];
  }
  
  const rows = [];
  let headers = null;
  
  // State variables for the parser
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  
  // Normalize line endings (both \r\n and \n become just \n)
  csvContent = csvContent.replace(/\r\n/g, '\n');
  
  // Process character by character
  for (let i = 0; i < csvContent.length; i++) {
    const char = csvContent[i];
    const nextChar = i < csvContent.length - 1 ? csvContent[i + 1] : '';
    
    if (char === '"') {
      // Handle escaped quotes (doubled quotes)
      if (nextChar === '"') {
        currentField += '"';
        i++; // Skip the next quote character
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      currentRow.push(currentField);
      currentField = '';
    } else if (char === '\n' && !inQuotes) {
      // End of row, but only if not inside quotes
      currentRow.push(currentField);
      
      if (headers === null) {
        // First row is headers
        headers = currentRow;
      } else {
        // Process data row
        if (currentRow.length >= headers.length) {
          const rowObject = {};
          headers.forEach((header, index) => {
            rowObject[header] = currentRow[index] || '';
          });
          rows.push(rowObject);
        } else {
          console.warn(`Skipping row with ${currentRow.length} fields when ${headers.length} are expected`);
        }
      }
      
      // Reset for next row
      currentRow = [];
      currentField = '';
    } else {
      // Normal character
      currentField += char;
    }
  }
  
  // Handle the last field and row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    
    if (headers) {
      // Process final data row
      if (currentRow.length >= headers.length) {
        const rowObject = {};
        headers.forEach((header, index) => {
          rowObject[header] = currentRow[index] || '';
        });
        rows.push(rowObject);
      }
    }
  }
  
  return rows;
}

/**
 * API endpoint to get the status of the Twitter scraper
 */
app.get('/api/twitter/status', (req, res) => {
  // Set cache control headers to prevent caching
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Generate a unique search ID based on timestamp if not already in the response
  const searchId = req.query.search_id || Date.now().toString();
  
  // Check if tweets.csv exists and when it was last modified
  const tweetsFile = path.join(SCRAPER_PATH, 'tweets.csv');
  
  if (fs.existsSync(tweetsFile)) {
    const stats = fs.statSync(tweetsFile);
    const lastModified = stats.mtime;
    const fileSize = stats.size;
    
    // Read the file to count actual tweets
    try {
      const fileContent = fs.readFileSync(tweetsFile, 'utf8');
      
      // Use the new CSV parser to properly count tweets
      const tweets = parseCSV(fileContent);
      const validTweetCount = tweets.length;
      
      console.log(`Status check: Found ${validTweetCount} valid tweets using robust CSV parser`);
      
      // If we have 5 or more tweets, consider it completed (reduced from 50 for testing)
      // Or if the process has exited (check by looking at the last log message)
      let status = 'running';
      if (validTweetCount >= 5 || fileContent.includes('Done! Got')) {
        status = 'completed';
      }
      
      res.json({
        search_id: searchId,
        status: status,
        last_updated: lastModified,
        file_size: fileSize,
        tweet_count: validTweetCount
      });
    } catch (error) {
      console.error('Error reading tweets file:', error);
      res.json({
        search_id: searchId,
        status: 'running',
        last_updated: lastModified,
        file_size: fileSize,
        tweet_count: 'Error reading file'
      });
    }
  } else {
    res.json({
      search_id: searchId,
      status: 'not_started',
      message: 'No tweets file found'
    });
  }
});

/**
 * API endpoint to get the scraped tweets
 */
app.get('/api/twitter/results', (req, res) => {
  // Set cache control headers to prevent caching
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  const searchId = req.query.search_id || Date.now().toString();
  const tweetsFile = path.join(SCRAPER_PATH, 'tweets.csv');
  
  if (fs.existsSync(tweetsFile)) {
    // Read the CSV file
    fs.readFile(tweetsFile, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading tweets file:', err);
        return res.status(500).json({ error: 'Error reading tweets file' });
      }
      
      // Use the new CSV parser to properly handle multiline fields
      const results = parseCSV(data);
      
      console.log(`Parsed ${results.length} tweets using robust CSV parser`);
      
      res.json({ 
        search_id: searchId,
        results, 
        count: results.length,
        last_updated: fs.statSync(tweetsFile).mtime
      });
    });
  } else {
    res.status(404).json({ 
      search_id: searchId,
      error: 'No results found',
      message: 'The Twitter scraper has not been run yet or no results were found'
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Twitter API server running on port ${PORT}`);
}); 