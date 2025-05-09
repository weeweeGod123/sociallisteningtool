const express = require('express');
const router = express.Router();
const { getDB } = require('../config/db');

/**
 * @route   GET /api/influencers
 * @desc    Get top influencers with their stats
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { platform, topic, startDate, endDate } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const db = getDB();
    if (!db) {
      throw new Error('Database connection not initialized');
    }

    // Date filtering
    let dateFilter = {};
    if (startDate && endDate) {
      const end = new Date(endDate + 'T23:59:59.999Z');
      dateFilter = { created_at: { $gte: new Date(startDate + 'T00:00:00Z'), $lte: end } };
    } else if (startDate) {
      dateFilter = { created_at: { $gte: new Date(startDate + 'T00:00:00Z') } };
    } else if (endDate) {
      const end = new Date(endDate + 'T23:59:59.999Z');
      dateFilter = { created_at: { $lte: end } };
    }

    // Get data from each collection with minimal deduplication
    const [twitterResults, redditResults, blueskyResults] = await Promise.all([
      db.collection('tweets').aggregate([
        { $addFields: { created_at_date: { $toDate: "$created_at" } } },
        ...(Object.keys(dateFilter).length > 0 ? [{ $match: { created_at_date: dateFilter.created_at } }] : []),
        {
          $group: {
            _id: "$url",
            name: { $first: "$username" },
            username: { $first: "$username" },
            url: { $first: "$url" },
            network: { $first: "Twitter" },
            location: { $first: "$user_location" },
            likes: { $max: { $ifNull: ["$likes", 0] } },
            comments: { $max: { $ifNull: ["$comments", 0] } },
            topic: { $first: "$topic_classification" },
            created_at: { $max: "$created_at_date" }
          }
        }
      ]).toArray(),
      db.collection('reddit_posts').aggregate([
        ...(Object.keys(dateFilter).length > 0 ? [{ $match: dateFilter }] : []),
        {
          $group: {
            _id: "$url",
            name: { $first: "$author" },
            username: { $first: "$username" },
            url: { $first: "$url" },
            network: { $first: "Reddit" },
            location: { $first: "$user_location" },
            likes: { $max: { $ifNull: ["$likes", 0] } },
            comments: { $max: { $ifNull: ["$comments", 0] } },
            topic: { $first: "$topic_classification" },
            created_at: { $max: "$created_at" }
          }
        }
      ]).toArray(),
      db.collection('bluesky_posts').aggregate([
        { $addFields: { created_at_date: { $toDate: "$created_at" } } },
        ...(Object.keys(dateFilter).length > 0 ? [{ $match: { created_at_date: dateFilter.created_at } }] : []),
        {
          $group: {
            _id: "$url",
            name: { $first: "$username" },
            username: { $first: "$username" },
            url: { $first: "$url" },
            network: { $first: "Bluesky" },
            location: { $first: "$user_location" },
            likes: { $max: { $ifNull: ["$likes", 0] } },
            comments: { $max: { $ifNull: ["$comments", 0] } },
            topic: { $first: "$topic_classification" },
            created_at: { $max: "$created_at_date" }
          }
        }
      ]).toArray()
    ]);

    // Combine all results
    let allPosts = [...twitterResults, ...redditResults, ...blueskyResults]
      .map(post => ({
        name: post.name,
        username: post.username,
        url: post.url,
        network: post.network,
        location: post.location || 'N/A',
        likes: post.likes,
        comments: post.comments,
        topic: post.topic || 'General',
        created_at: post.created_at
      }));

    // Filter by platform if specified
    if (platform && platform !== 'All') {
      allPosts = allPosts.filter(post => post.network.toLowerCase() === platform.toLowerCase());
    }
    // Filter by topic if specified
    if (topic && topic !== 'All') {
      allPosts = allPosts.filter(post => (post.topic || 'General') === topic);
    }

    // Sort by likes (descending)
    allPosts.sort((a, b) => b.likes - a.likes);

    const total = allPosts.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedPosts = allPosts.slice(skip, skip + limit);

    res.json({
      influencers: paginatedPosts,
      total,
      currentPage: page,
      totalPages
    });
  } catch (error) {
    console.error('Error in /api/influencers:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: error.message 
    });
  }
});

/**
 * @route   GET /api/influencers/media-types
 * @desc    Get media type breakdown
 * @access  Public
 */
router.get('/media-types', async (req, res) => {
  try {
    const db = getDB();
    
    if (!db) {
      throw new Error('Database connection not initialized');
    }

    // Get counts from each collection with deduplication
    const [twitterCount, redditCount, blueskyCount] = await Promise.all([
      db.collection('tweets').aggregate([
        {
          $group: {
            _id: "$url" // Count unique URLs
          }
        },
        {
          $count: "count"
        }
      ]).toArray().then(result => (result[0]?.count || 0)),
      db.collection('reddit_posts').aggregate([
        {
          $group: {
            _id: "$url" // Count unique URLs
          }
        },
        {
          $count: "count"
        }
      ]).toArray().then(result => (result[0]?.count || 0)),
      db.collection('bluesky_posts').aggregate([
        {
          $group: {
            _id: "$url" // Count unique URLs
          }
        },
        {
          $count: "count"
        }
      ]).toArray().then(result => (result[0]?.count || 0))
    ]);

    // Create media types array
    const mediaTypes = [
      {
        name: 'Twitter',
        value: twitterCount,
        color: '#1DA1F2'
      },
      {
        name: 'Reddit',
        value: redditCount,
        color: '#FF4500'
      },
      {
        name: 'Bluesky',
        value: blueskyCount,
        color: '#0560FF'
      }
    ].filter(type => type.value > 0); // Only include platforms with posts

    res.json(mediaTypes);
  } catch (error) {
    console.error('Error in /api/influencers/media-types:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: error.message 
    });
  }
});

module.exports = router; 