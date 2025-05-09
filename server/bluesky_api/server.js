const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.BLUESKY_PORT || 5003;
const SCRAPER_PATH = path.join(__dirname, '..', 'bluesky_scraper');
const OUTPUT_DIR = path.join(SCRAPER_PATH, 'output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// MongoDB connection string - Fix to use the connection string from .env
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/social-listening';
console.log('Using MongoDB connection string from environment variables');

app.use(cors());
app.use(express.json());

const blueskySearches = {};

function generateSearchId() {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomPart}`;
}

function getPythonPath() {
  return process.platform === 'win32' ? 'python' : 'python3';
}

app.get('/api/bluesky/test', (req, res) => {
  res.json({ status: 'success', message: 'Bluesky API server is running' });
});

app.post('/api/bluesky/search', (req, res) => {
  const { query, maxPosts } = req.body;
  if (!query) return res.status(400).json({ error: 'No search query provided' });
  const searchId = generateSearchId();
  const csvFile = `bluesky_results_${searchId}.csv`;
  const args = [
    '-u',
    path.join(SCRAPER_PATH, 'main.py'),
    '--query', query,
    '--max-posts', maxPosts ? String(maxPosts) : '1000',
    '--csv-file', path.join(OUTPUT_DIR, csvFile)
  ];
  const pythonProcess = spawn(getPythonPath(), args, { cwd: SCRAPER_PATH });
  blueskySearches[searchId] = {
    status: 'running',
    lastUpdated: new Date(),
    process: pythonProcess,
    outputFile: path.join(OUTPUT_DIR, csvFile),
    statusFile: path.join(OUTPUT_DIR, `bluesky_status_${searchId}.json`)
  };
  res.json({ search_id: searchId, status: 'started', message: 'Bluesky search started' });
  pythonProcess.stdout.on('data', (data) => {
    process.stdout.write(`[Bluesky Scraper] ${data}`);
    blueskySearches[searchId].lastUpdated = new Date();
  });
  pythonProcess.stderr.on('data', (data) => {
    process.stderr.write(`[Bluesky Scraper ERROR] ${data}`);
  });
  pythonProcess.on('close', (code) => {
    blueskySearches[searchId].status = code === 0 ? 'completed' : 'failed';
    // Write status file
    fs.writeFileSync(
      blueskySearches[searchId].statusFile,
      JSON.stringify({ status: blueskySearches[searchId].status }, null, 2)
    );
  });
});

app.get('/api/bluesky/status', (req, res) => {
  const { search_id } = req.query;
  if (!search_id || !blueskySearches[search_id]) {
    return res.status(404).json({ error: 'Search ID not found' });
  }
  const statusObj = {
    status: blueskySearches[search_id].status,
    lastUpdated: blueskySearches[search_id].lastUpdated,
  };
  res.json(statusObj);
});

app.get('/api/bluesky/results', (req, res) => {
  const { search_id } = req.query;
  if (!search_id || !blueskySearches[search_id]) {
    return res.status(404).json({ error: 'Search ID not found' });
  }
  const filePath = blueskySearches[search_id].outputFile;
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Results not ready' });
  }
  res.download(filePath);
});

/**
 * API endpoint to clear Bluesky collections
 */
app.post('/api/bluesky/clear-collections', async (req, res) => {
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
    
    // Delete bluesky_posts collection
    try {
      await db.collection('bluesky_posts').deleteMany({});
      console.log('Deleted all documents from bluesky_posts collection');
    } catch (error) {
      console.error('Error clearing bluesky_posts collection:', error);
      // Continue even if this operation fails
    }
    
    await client.close();
    
    res.status(200).json({ 
      status: 'success',
      message: 'Bluesky collections cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing Bluesky collections:', error);
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
    console.log(`Bluesky API server running on port ${PORT}`);
  });
}

module.exports = app; 