const express = require("express");
const cors = require("cors");
const axios = require("axios"); // HTTP client for making API requests
const dotenv = require("dotenv"); // For loading environment variables

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = 9000;

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 600000; // 10 minutes in milliseconds
const MAX_REQUESTS = process.env.MAX_REQUESTS
  ? parseInt(process.env.MAX_REQUESTS)
  : 600; // Make configurable for testing
let requestCount = 0;
let windowStart = Date.now();

/**
 * Rate limiting middleware to prevent exceeding Reddit API quotas
 * Tracks request count within a sliding window and rejects excess requests
 */
function rateLimiter(req, res, next) {
  const now = Date.now();

  // Reset window if needed (after 10 minutes have passed)
  if (now - windowStart >= RATE_LIMIT_WINDOW) {
    requestCount = 0;
    windowStart = now;
  }

  // Return 429 status if we've hit the request limit
  if (requestCount >= MAX_REQUESTS) {
    return res.status(429).json({
      error: "Rate limit exceeded. Please try again later.",
      retryAfter: Math.ceil((windowStart + RATE_LIMIT_WINDOW - now) / 1000), // Time until window resets
    });
  }

  // Increment counter and proceed to next middleware
  requestCount++;
  next();
}

// Apply rate limiting to all routes
app.use(rateLimiter);

// Middleware
app.use(cors()); // Enable cross-origin requests
app.use(express.json()); // Parse JSON request bodies

// Reddit API credentials loaded from environment variables
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;

/**
 * Fetches an OAuth access token from Reddit using client credentials
 * Required for all authenticated Reddit API requests
 */
async function getRedditAccessToken() {
  try {
    const response = await axios.post(
      "https://www.reddit.com/api/v1/access_token",
      "grant_type=client_credentials", // Use client credentials flow
      {
        auth: {
          username: REDDIT_CLIENT_ID,
          password: REDDIT_CLIENT_SECRET,
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error("Error getting Reddit access token:", error);
    throw error;
  }
}

/**
 * Builds a complex Reddit search query with advanced filtering options
 * Handles special formatting requirements for Reddit's search syntax
 */
function buildSearchQuery(params) {
  const {
    keyword,
    subreddits = [],
    timeframe = "all",
    sort = "relevance",
    includeNsfw = false,
  } = params;

  // Check if the entire keyword contains spaces and no operators
  // If so, automatically wrap the whole phrase in quotes
  let processedKeyword = keyword;
  if (
    keyword.includes(" ") &&
    !keyword.includes(" AND ") &&
    !keyword.includes(" OR ") &&
    !keyword.includes('"')
  ) {
    processedKeyword = `"${keyword}"`;
  }

  // Split the input into terms while preserving quoted phrases
  const terms = [];
  let currentTerm = "";
  let inQuotes = false;

  // Parse keyword into individual terms, keeping quoted phrases intact
  for (let i = 0; i < processedKeyword.length; i++) {
    const char = processedKeyword[i];

    if (char === '"') {
      // Toggle quote state when encountering a quote character
      inQuotes = !inQuotes;
      currentTerm += char;
    } else if (char === " " && !inQuotes) {
      // Space outside of quotes marks the end of a term
      if (currentTerm) {
        terms.push(currentTerm);
        currentTerm = "";
      }
    } else {
      // Add character to current term
      currentTerm += char;
    }
  }
  // Add final term if there's anything left
  if (currentTerm) {
    terms.push(currentTerm);
  }

  // Process terms and build query with proper formatting
  let query = terms
    .filter((term) => term.trim()) // Remove empty terms
    .map((term) => {
      term = term.trim();
      // Keep existing quotes for phrases
      if (term.startsWith('"') && term.endsWith('"')) {
        return term;
      }
      // Preserve logical operators (AND, OR)
      if (term.toUpperCase() === "AND" || term.toUpperCase() === "OR") {
        return term.toUpperCase();
      }
      // Add quotes if term contains spaces (makes it a phrase search)
      if (term.includes(" ")) {
        return `"${term}"`;
      }
      return term;
    })
    .join(" ");

  // Add subreddit filtering if specified
  if (subreddits.length > 0) {
    const subredditQuery = subreddits
      .map((sub) => `subreddit:${sub}`)
      .join(" OR ");
    query = `${query} (${subredditQuery})`;
  }

  // Add NSFW filtering unless explicitly included
  if (!includeNsfw) {
    query = `${query} NOT nsfw:1`;
  }

  console.log("Search query:", query); // Log the final query for debugging

  // Return complete search parameters for Reddit API
  return {
    q: query,
    t: timeframe, // Time range (hour, day, week, month, year, all)
    sort: sort, // Sort method (relevance, hot, new, comments, top)
    limit: 100, // Maximum number of results to return
    restrict_sr: false, // Search across all subreddits
  };
}

/**
 * API endpoint to search Reddit posts by keyword and other filters
 * Returns formatted post data and metadata
 */
app.get("/api/search", async (req, res) => {
  const { keyword, subreddits, timeframe, sort, includeNsfw } = req.query;

  // Validate required parameters
  if (!keyword) {
    return res.status(400).json({ error: "Keyword is required" });
  }

  try {
    // Get authentication token for Reddit API
    const accessToken = await getRedditAccessToken();

    // Build search parameters from user input
    const searchParams = buildSearchQuery({
      keyword,
      subreddits: subreddits ? subreddits.split(",") : [], // Convert comma-separated list to array
      timeframe,
      sort,
      includeNsfw: includeNsfw === "true",
    });

    // Construct and execute the API request to Reddit
    const queryString = new URLSearchParams(searchParams).toString();
    const response = await axios.get(
      `https://oauth.reddit.com/search?${queryString}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`, // Attach auth token
          "User-Agent": "social-listening-app/1.0.0", // Required by Reddit API
        },
      }
    );

    // Transform Reddit's response into a cleaner, more usable format
    const posts = response.data.data.children.map((child) => {
      const post = child.data;
      return {
        id: post.id,
        title: post.title,
        subreddit: post.subreddit_name_prefixed, // Full form with r/ prefix
        author: post.author,
        url: `https://reddit.com${post.permalink}`, // Full URL to the Reddit post
        created: post.created_utc, // Unix timestamp
        score: post.score, // Upvotes minus downvotes
        numComments: post.num_comments,
        selftext: post.selftext, // Post body text
        thumbnail:
          post.thumbnail !== "self" && post.thumbnail !== "default"
            ? post.thumbnail
            : null, // Post thumbnail if available
        upvoteRatio: post.upvote_ratio, // Percentage of upvotes
        isNsfw: post.over_18,
        flair: post.link_flair_text, // Post category/tag
        domain: post.domain, // Source domain for links
        isVideo: post.is_video, // Whether post contains video
      };
    });

    // Sort results by a combined relevance score (upvotes + weighted comments)
    posts.sort((a, b) => {
      const scoreA = a.score + a.numComments * 2;
      const scoreB = b.score + b.numComments * 2;
      return scoreB - scoreA; // Descending order (highest first)
    });

    // Send formatted response with posts and metadata
    res.json({
      posts,
      metadata: {
        total: posts.length,
        timeframe,
        sort,
        query: searchParams.q, // Include the actual query used for transparency
      },
    });
  } catch (error) {
    console.error("Error searching Reddit:", error);
    res.status(500).json({ error: "Failed to search Reddit" });
  }
});

// Only start the server if we're not in test mode
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for testing
module.exports = {
  app,
  getRedditAccessToken,
  buildSearchQuery,
  // Export rate limiting variables for testing
  requestCount,
  windowStart,
  RATE_LIMIT_WINDOW,
  MAX_REQUESTS,
};
