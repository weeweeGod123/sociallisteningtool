const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const Keyword = require('../models/Keyword');

// Get all posts with pagination
router.get('/posts', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const posts = await Post.find()
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Post.countDocuments();
    
    res.json({
      posts,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get posts by platform
router.get('/posts/platform/:platform', async (req, res) => {
  try {
    const posts = await Post.find({ platform: req.params.platform })
      .sort({ timestamp: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get posts by keyword
router.get('/posts/keyword/:keyword', async (req, res) => {
  try {
    const keyword = req.params.keyword;
    const posts = await Post.find({
      $or: [
        { keywords: keyword },
        { content: { $regex: keyword, $options: 'i' } }
      ]
    }).sort({ timestamp: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get posts by geographic area
router.get('/posts/geo', async (req, res) => {
  try {
    const { lon, lat, radius } = req.query;
    
    if (!lon || !lat || !radius) {
      return res.status(400).json({ 
        message: 'Longitude, latitude and radius are required' 
      });
    }
    
    const posts = await Post.find({
      location: {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lon), parseFloat(lat)]
          },
          $maxDistance: parseInt(radius) * 1000 // Convert km to meters
        }
      }
    }).sort({ timestamp: -1 });
    
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Manage keywords
router.get('/keywords', async (req, res) => {
  try {
    const keywords = await Keyword.find().sort({ category: 1, term: 1 });
    res.json(keywords);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/keywords', async (req, res) => {
  try {
    const { term, category } = req.body;
    
    if (!term || !category) {
      return res.status(400).json({ message: 'Term and category are required' });
    }
    
    const newKeyword = new Keyword({
      term,
      category,
      isActive: true
    });
    
    await newKeyword.save();
    res.status(201).json(newKeyword);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;