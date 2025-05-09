const mongoose = require('mongoose');
const axios = require('axios');
const cropKeywords = [
  "crop", "pathogen", "disease", "fungicide", "pesticide", "fungal",
  "barley", "wheat", "canola", "chickpea", "faba bean", "lupins", "lentils",
  "mungbean", "oats", "safflower", "sorghum", "soybean",
  "plant pathology", "integrated disease management", "fungicide resistance",
  "stubble management", "crop disease severity", "crop loss", "grain quality"
];
const Post = require('../models/Post');
require('dotenv').config();

const REDDIT_SUBREDDITS = ['agriculture', 'farming', 'plantpathology']; // Relevant subreddits

async function fetchRedditData(subreddit) {
  try {
    console.log(`Fetching data from r/${subreddit}...`);
    
    const userAgent = 'SocialListeningApp/1.0.0';
    const response = await axios.get(`https://www.reddit.com/r/${subreddit}/hot.json?limit=100`, {
      headers: { 'User-Agent': userAgent }
    });

    if (!response.data?.data?.children) {
      console.log(`No data found for r/${subreddit}`);
      return 0;
    }

    const posts = response.data.data.children;
    let savedCount = 0;

    for (const post of posts) {
      if (post.data.promoted || post.data.pinned) continue;

      const existingPost = await Post.findOne({ postId: post.data.id });
      if (existingPost) continue;

      const content = (post.data.selftext + " " + post.data.title).toLowerCase();
      const keywordsFound = cropKeywords.filter(keyword => content.includes(keyword.toLowerCase()));

      if (keywordsFound.length === 0) continue; // Skip if unrelated

      await Post.create({
        source: 'reddit',                     // Use "source" instead of "platform"
        source_id: post.data.id,              // Use "source_id" instead of "postId"
        title: post.data.title,
        content: post.data.selftext || '',
        author: post.data.author,
        url: `https://reddit.com${post.data.permalink}`,
        created: new Date(post.data.created_utc * 1000),
        subreddit: post.data.subreddit,
        keywords: keywordsFound,
        metadata: {
          upvotes: post.data.ups,
          comments: post.data.num_comments
        }
      });
      
      savedCount++;
    }

    console.log(`Saved ${savedCount} new posts from r/${subreddit}`);
    return savedCount;
  } catch (error) {
    console.error(`Error collecting data from r/${subreddit}:`, error.message);
    return 0;
  }
}

async function collectData() {
  console.log('Starting Reddit data collection...');
  let totalSaved = 0;

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/social-listening', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected');
  }

  for (const subreddit of REDDIT_SUBREDDITS) {
    totalSaved += await fetchRedditData(subreddit);
  }

  console.log(`Data collection complete. Total saved: ${totalSaved}`);
}

if (require.main === module) {
  collectData()
    .then(() => {
      console.log('Collection complete, exiting...');
      setTimeout(() => process.exit(0), 2000);
    })
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}

module.exports = { collectData, fetchRedditData };
