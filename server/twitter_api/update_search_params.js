// Direct script to update search parameters using execSync
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get command-line arguments
// Usage: node update_search_params.js <SCRAPER_PATH> <QUERY> [SEARCH_ALL_TIME]
// Example: node update_search_params.js /path/to/scraper "wheat AND barley" true
if (process.argv.length < 4) {
  console.error('Usage: node update_search_params.js <SCRAPER_PATH> <QUERY> [SEARCH_ALL_TIME]');
  process.exit(1);
}

const SCRAPER_PATH = process.argv[2];
const QUERY = process.argv[3];
const SEARCH_ALL_TIME = process.argv[4] === 'true';

console.log('Updating search parameters...');
console.log('Scraper path:', SCRAPER_PATH);
console.log('Query:', QUERY);
console.log('Search all time:', SEARCH_ALL_TIME);

// Create search config
const searchConfig = {
  "all_of_these_words": [],
  "this_exact_phrase": "",
  "any_of_these_words": [],
  "none_of_these_words": [],
  "these_hashtags": [],
  "language": "en"
};

// Only add date constraints if not searching all time
if (!SEARCH_ALL_TIME) {
  searchConfig.from_date = "2023-01-01";
  searchConfig.to_date = new Date().toISOString().split('T')[0];
}

// Improved query parsing logic
function parseQuery(query) {
  // Extract exact phrases (quoted text)
  const exactPhrases = [];
  const withoutQuotes = query.replace(/"([^"]+)"/g, (match, phrase) => {
    exactPhrases.push(phrase);
    return ' PHRASE_PLACEHOLDER ';
  });

  // Extract and process conditions
  let workingQuery = withoutQuotes;
  
  // Handle OR clauses in parentheses - (term1 OR term2)
  workingQuery = workingQuery.replace(/\(([^()]+)\)/g, (match, group) => {
    if (group.includes(' OR ')) {
      const orTerms = group.split(' OR ').map(t => t.trim()).filter(Boolean);
      if (orTerms.length > 0) {
        searchConfig.any_of_these_words = [...searchConfig.any_of_these_words, ...orTerms];
        return ' ';
      }
    }
    return match; // Keep intact if not an OR group
  });

  // Handle remaining AND/OR terms
  const parts = workingQuery.split(' AND ').map(p => p.trim()).filter(Boolean);
  
  parts.forEach(part => {
    if (part.includes(' OR ')) {
      const orTerms = part.split(' OR ').map(t => t.trim()).filter(Boolean);
      searchConfig.any_of_these_words = [...searchConfig.any_of_these_words, ...orTerms];
    } else if (part !== 'PHRASE_PLACEHOLDER') {
      // Add to all_of_these_words if it's not a placeholder for a phrase we already extracted
      searchConfig.all_of_these_words.push(part);
    }
  });

  // Clean up all_of_these_words to remove placeholders
  searchConfig.all_of_these_words = searchConfig.all_of_these_words
    .filter(w => w !== 'PHRASE_PLACEHOLDER')
    .filter(Boolean); // Remove empty strings

  // Clean up any_of_these_words
  searchConfig.any_of_these_words = searchConfig.any_of_these_words
    .filter(w => w !== 'PHRASE_PLACEHOLDER')
    .filter(Boolean); // Remove empty strings

  // Set exact phrases
  if (exactPhrases.length > 0) {
    searchConfig.this_exact_phrase = exactPhrases.join(' ');
  }
}

// Parse the query
parseQuery(QUERY);

// Log the final search configuration for debugging
console.log('Parsed search configuration:', JSON.stringify(searchConfig, null, 2));

// Create Python code
const pythonCode = `
# Twitter advanced search parameters
SEARCH_PARAMS = ${JSON.stringify(searchConfig, null, 4)}

# Minimum number of tweets to collect
MINIMUM_TWEETS = 9
`;

// Write the parameters file directly
const paramFilePath = path.join(SCRAPER_PATH, 'search_params.py');
try {
  fs.writeFileSync(paramFilePath, pythonCode);
  console.log('Search parameters file written to:', paramFilePath);
  console.log('Content:', pythonCode);
  console.log('Update successful');
} catch (error) {
  console.error('Error writing search parameters file:', error);
  process.exit(1);
} 