const express = require('express');
const router = express.Router();
const sentimentScheduler = require('../services/sentimentScheduler');
const monitorService = require('../services/monitorService');
const Post = require('../models/Post');


/**
 *  @route GET /api/monitor/status
 *  @desc  Get the current status of the monitor
 *  @access Public
 */
router.get('/status', async (req, res) => {
    try 
    {
        const monitorStatus = monitorService.getStatus();
        const totalPosts = await Post.countDocuments();
        const unanalysedPosts = await Post.countDocuments({ sentiment: null });
        const analysedPosts = totalPosts - unanalysedPosts;

        const twitterCount = await Post.countDocuments({ platform: 'Twitter' });
        const redditCount = await Post.countDocuments({ platform: 'Reddit' });

        const twitterUnanalysed = await Post.countDocuments({ platform: 'Twitter', sentiment: null });
        const redditUnanalysed = await Post.countDocuments({ platform: 'Reddit', sentiment: null });

        res.json({
            success: true,
            timestamp: new Date(),
            monitor: monitorStatus,
            posts: {
              total: totalPosts,
              analysed: analysedPosts,
              unanalysed: unanalysedPosts,
              twitter: {
                total: twitterCount,
                analysed: twitterCount - twitterUnanalysed,
                unanalysed: twitterUnanalysed
              },
              reddit: {
                total: redditCount,
                analysed: redditCount - redditUnanalysed,
                unanalysed: redditUnanalysed
              }
            }
          });
    }
    catch (error)
    {
        console.error(`Error getting monitor status: ${error.message}`);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to retrieve status',
            error: error.message
        });
    }
});


/**
 *  @route GET /api/monitor/recent
 *  @desc  Get recent analysed posts from the database
 *  @access Public
 */
router.get('/recent', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      
      // Find the most recently analysed posts
      const recentAnalysed = await Post.find({ sentiment: { $ne: null } })
        .sort({ 'sentiment_updated_at': -1 })
        .limit(limit)
        .select('_id post_id username user_location content_text url created_at likes comments platform topic_classification entities processed_text sentiment sentiment_updated_at');
      

      res.json({
        success: true,
        count: recentAnalysed.length,
        posts: recentAnalysed
      });
    } catch (error) {
      console.error(`Error getting recent analysed posts: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve recent posts',
        error: error.message
      });
    }
  });
  
  module.exports = router;
