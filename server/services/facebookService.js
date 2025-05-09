const axios = require('axios');
const Post = require('../models/Post');
require('dotenv').config();

const FB_API_VERSION = 'v17.0';
const FB_BASE_URL = `https://graph.facebook.com/${FB_API_VERSION}`;

const fetchFacebookPosts = async (keywords) => {
  try {
    // Create keyword query string
    const keywordQuery = keywords.join(' OR ');
    
    const response = await axios.get(`${FB_BASE_URL}/search`, {
      params: {
        q: keywordQuery,
        type: 'post',
        fields: 'id,message,created_time,from,place',
        access_token: process.env.FB_ACCESS_TOKEN
      }
    });

    // Process and save posts
    const posts = response.data.data || [];
    const savedPosts = [];
    
    for (const post of posts) {
      // Skip posts without messages
      if (!post.message) continue;
      
      // Check if post already exists
      const existingPost = await Post.findOne({ 
        platform: 'facebook', 
        postId: post.id 
      });

      if (!existingPost) {
        // Prepare location data if available
        let location = {
          type: 'Point',
          coordinates: [0, 0]  // Default coordinates
        };

        if (post.place && post.place.location) {
          location.coordinates = [
            post.place.location.longitude || 0,
            post.place.location.latitude || 0
          ];
        }

        // Create new post document
        const newPost = await Post.create({
          platform: 'facebook',
          postId: post.id,
          content: post.message,
          author: post.from ? post.from.name : 'Unknown',
          timestamp: new Date(post.created_time),
          location: location,
          keywords: keywords.filter(keyword => 
            post.message.toLowerCase().includes(keyword.toLowerCase())
          ),
          metadata: post
        });
        
        savedPosts.push(newPost);
      }
    }

    return { 
      success: true, 
      count: savedPosts.length,
      posts: savedPosts
    };
  } catch (error) {
    console.error('Facebook API error:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

module.exports = { fetchFacebookPosts };