// server/routes/api/posts.js
const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const { getDB } = require('../config/db');

/**
 * @route   GET api/posts
 * @desc    Get all posts with pagination
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const posts = await Post.find()
      .sort({ created: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Post.countDocuments();
    
    res.json({
      posts,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalPosts: total
    });
  } catch (err) {
    console.error('Error fetching posts:', err.message);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   GET api/posts/source/:source
 * @desc    Get posts by source (reddit, twitter, etc.)
 * @access  Public
 */
router.get('/source/:source', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const posts = await Post.find({ source: req.params.source })
      .sort({ created: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Post.countDocuments({ source: req.params.source });
    
    res.json({
      posts,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalPosts: total
    });
  } catch (err) {
    console.error(`Error fetching ${req.params.source} posts:`, err.message);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   GET api/posts/subreddit/:subreddit
 * @desc    Get posts by subreddit
 * @access  Public
 */
router.get('/subreddit/:subreddit', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const posts = await Post.find({ 
      source: 'reddit',
      subreddit: req.params.subreddit 
    })
      .sort({ created: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Post.countDocuments({ 
      source: 'reddit',
      subreddit: req.params.subreddit 
    });
    
    res.json({
      posts,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalPosts: total
    });
  } catch (err) {
    console.error(`Error fetching posts from r/${req.params.subreddit}:`, err.message);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   GET api/posts/search
 * @desc    Search posts by keyword
 * @access  Public
 */
router.get('/search', async (req, res) => {
  const { q } = req.query;
  
  if (!q) {
    return res.status(400).json({ msg: 'Search query is required' });
  }

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Text search on title and content
    const posts = await Post.find({
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { content: { $regex: q, $options: 'i' } }
      ]
    })
      .sort({ created: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Post.countDocuments({
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { content: { $regex: q, $options: 'i' } }
      ]
    });
    
    res.json({
      posts,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalPosts: total,
      query: q
    });
  } catch (err) {
    console.error(`Error searching posts for "${q}":`, err.message);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   GET api/posts/analytics
 * @desc    Get analytics data about posts
 * @access  Public
 */
router.get('/analytics', async (req, res) => {
  try {
    // Get counts by source
    const sourceStats = await Post.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get counts by subreddit
    const subredditStats = await Post.aggregate([
      { $match: { source: 'reddit' } },
      { $group: { _id: '$subreddit', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Get post count by day for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const postsByDay = await Post.aggregate([
      { $match: { created: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$created' },
            month: { $month: '$created' },
            day: { $dayOfMonth: '$created' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);
    
    // Format the results
    const dailyData = postsByDay.map(day => ({
      date: `${day._id.year}-${day._id.month.toString().padStart(2, '0')}-${day._id.day.toString().padStart(2, '0')}`,
      count: day.count
    }));
    
    res.json({
      totalPosts: await Post.countDocuments(),
      sourceBreakdown: sourceStats,
      topSubreddits: subredditStats,
      postsOverTime: dailyData
    });
  } catch (err) {
    console.error('Error fetching analytics:', err.message);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   GET api/posts/engagement
 * @desc    Get posts sorted by engagement metrics
 * @access  Public
 */
router.get('/engagement', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const platform = req.query.platform || 'all';
    const skip = (page - 1) * limit;

    // Date filtering
    const { startDate, endDate } = req.query;
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = { created_at: { $gte: new Date(startDate), $lte: new Date(endDate) } };
    } else if (startDate) {
      dateFilter = { created_at: { $gte: new Date(startDate) } };
    } else if (endDate) {
      dateFilter = { created_at: { $lte: new Date(endDate) } };
    }

    const db = getDB();
    if (!db) {
      throw new Error('Database connection not initialized');
    }

    let posts = [];
    
    // Function to get posts from a specific collection with proper field mapping
    const getPostsFromCollection = async (collection, source) => {
      const pipeline = [];
      if (collection === 'tweets' || collection === 'bluesky_posts') {
        pipeline.push({ $addFields: { created_at_date: { $toDate: "$created_at" } } });
        if (Object.keys(dateFilter).length > 0) {
          pipeline.push({ $match: { created_at_date: dateFilter.created_at } });
        }
      } else {
        if (Object.keys(dateFilter).length > 0) {
          pipeline.push({ $match: dateFilter });
        }
      }
      pipeline.push({
        $addFields: {
          engagementScore: {
            $sum: [
              { $ifNull: ["$likes", 0] },
              { $ifNull: ["$comments", 0] }
            ]
          },
          platform: source,
          content: { $ifNull: ["$content_text", "$title"] },
          metadata: {
            score: { $ifNull: ["$likes", 0] },
            comments: { $ifNull: ["$comments", 0] }
          }
        }
      });
      pipeline.push({ $sort: { engagementScore: -1 } });
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });
      return await db.collection(collection).aggregate(pipeline).toArray();
    };

    // Function to get total count from a collection
    const getCollectionCount = async (collection) => {
      if (Object.keys(dateFilter).length > 0) {
        return await db.collection(collection).countDocuments(dateFilter);
      }
      return await db.collection(collection).countDocuments();
    };

    let totalPosts = 0;

    // Get posts based on selected platform
    switch (platform) {
      case 'reddit':
        posts = await getPostsFromCollection('reddit_posts', 'reddit');
        totalPosts = await getCollectionCount('reddit_posts');
        break;
      case 'twitter':
        posts = await getPostsFromCollection('tweets', 'twitter');
        totalPosts = await getCollectionCount('tweets');
        break;
      case 'bluesky':
        posts = await getPostsFromCollection('bluesky_posts', 'bluesky');
        totalPosts = await getCollectionCount('bluesky_posts');
        break;
      case 'all':
        // For 'all', use $unionWith and apply date filter to each pipeline
        const redditPipeline = [];
        if (Object.keys(dateFilter).length > 0) {
          redditPipeline.push({ $match: dateFilter });
        }
        redditPipeline.push({
          $addFields: {
            engagementScore: {
              $sum: [
                { $ifNull: ["$likes", 0] },
                { $ifNull: ["$comments", 0] }
              ]
            },
            platform: 'reddit',
            content: { $ifNull: ["$content_text", "$title"] },
            metadata: {
              score: { $ifNull: ["$likes", 0] },
              comments: { $ifNull: ["$comments", 0] }
            }
          }
        });
        const twitterPipeline = [];
        twitterPipeline.push({ $addFields: { created_at_date: { $toDate: "$created_at" } } });
        if (Object.keys(dateFilter).length > 0) {
          twitterPipeline.push({ $match: { created_at_date: dateFilter.created_at } });
        }
        twitterPipeline.push({
          $addFields: {
            engagementScore: {
              $sum: [
                { $ifNull: ["$likes", 0] },
                { $ifNull: ["$comments", 0] }
              ]
            },
            platform: 'twitter',
            content: "$content_text",
            metadata: {
              score: { $ifNull: ["$likes", 0] },
              comments: { $ifNull: ["$comments", 0] }
            }
          }
        });
        const blueskyPipeline = [];
        blueskyPipeline.push({ $addFields: { created_at_date: { $toDate: "$created_at" } } });
        if (Object.keys(dateFilter).length > 0) {
          blueskyPipeline.push({ $match: { created_at_date: dateFilter.created_at } });
        }
        blueskyPipeline.push({
          $addFields: {
            engagementScore: {
              $sum: [
                { $ifNull: ["$likes", 0] },
                { $ifNull: ["$comments", 0] }
              ]
            },
            platform: 'bluesky',
            content: "$content_text",
            metadata: {
              score: { $ifNull: ["$likes", 0] },
              comments: { $ifNull: ["$comments", 0] }
            }
          }
        });
        posts = await db.collection('reddit_posts').aggregate([
          ...redditPipeline,
          {
            $unionWith: {
              coll: 'tweets',
              pipeline: twitterPipeline
            }
          },
          {
            $unionWith: {
              coll: 'bluesky_posts',
              pipeline: blueskyPipeline
            }
          },
          { $sort: { engagementScore: -1 } },
          { $skip: skip },
          { $limit: limit }
        ]).toArray();

        // Get total count from all collections
        totalPosts = await (async () => {
          const [redditCount, twitterCount, blueskyCount] = await Promise.all([
            getCollectionCount('reddit_posts'),
            getCollectionCount('tweets'),
            getCollectionCount('bluesky_posts')
          ]);
          return redditCount + twitterCount + blueskyCount;
        })();
        break;
      default:
        throw new Error('Invalid platform specified');
    }

    const totalPages = Math.ceil(totalPosts / limit);

    res.json({
      posts,
      currentPage: page,
      totalPages,
      totalPosts
    });
  } catch (err) {
    console.error('Error fetching posts by engagement:', err.message);
    res.status(500).json({
      message: 'Server Error',
      error: err.message
    });
  }
});

module.exports = router;