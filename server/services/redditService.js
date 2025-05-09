const axios = require("axios");
const Post = require("../models/Post");
const qs = require("qs");

// STEP 1: Get Reddit Access Token
async function getRedditAccessToken() {
  const credentials = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
  ).toString("base64");

  try {
    const response = await axios.post(
      "https://www.reddit.com/api/v1/access_token",
      qs.stringify({ grant_type: "client_credentials" }),
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": process.env.REDDIT_USER_AGENT,
        },
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error("❌ Reddit authentication error:", error.response?.data || error.message);
    throw error;
  }
}

// STEP 2: Fetch Posts from Reddit and Save to MongoDB
async function fetchRedditPosts() {
  try {
    const token = await getRedditAccessToken();

    const response = await axios.get(
      "https://oauth.reddit.com/r/trump/new?limit=100",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": process.env.REDDIT_USER_AGENT,
        },
      }
    );
    

    const posts = response.data.data.children;
    let savedCount = 0;

    for (const post of posts) {
      const data = post.data;

      const exists = await Post.findOne({ redditId: data.id });
      if (exists) continue;

      const newPost = new Post({
        platform: "Reddit",
        redditId: data.id,
        author: data.author,
        title: data.title,
        content: data.selftext || data.url,
        url: `https://reddit.com${data.permalink}`,
        createdAt: new Date(data.created_utc * 1000),
        source: "r/trump",
      });

      try {
        await newPost.save();
        console.log(`✅ Saved: ${data.title}`);
        savedCount++;
      } catch (err) {
        console.error(`❌ Failed to save post: ${data.title}`);
        console.error(err.message);
      }
    }

    console.log(`✅ Successfully saved ${savedCount} new Reddit posts.`);
  } catch (err) {
    console.error("❌ Error during Reddit data collection:", err.message);
  }
}

module.exports = { fetchRedditPosts };
