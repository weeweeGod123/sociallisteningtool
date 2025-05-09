const express = require("express");
const router = express.Router();
const SentimentService = require("../services/sentimentService");
const Post = require("../models/Post");

/**
 * @route   GET /api/sentiment/health
 * @desc    Check the health of sentiment analysis server
 * @access  Pubic
 */
router.get('/health', async (req,res) =>
{
    try
    {
        const health = await SentimentService.checkHealth();
        res.json(health);
    }
    catch (error)
    {
        console.error('Error checking sentiment analyser health:', error.message);
            res.status(500).json({ 
                status: 'error',
                message: 'Failed to connect to sentiment analysis server',
                error: error.message
            });
    }
});

/**
 * @route   POST /api/sentiment/analyse
 * @desc    Analyse text for sentiment
 * @access  Public
 */
router.post('/analyse', async (req, res) =>
{
    try
    {
        const { text } = req.body;

        if(!text)
        {
            return res.status(400).json({ message: 'Text is required for sentiment analysis' });
        }
        const analysis = await SentimentService.analyseText(text);
        res.json(analysis);
    }
    catch (error)
    {
        console.error('Error analyzing text:', error.message);
        res.status(500).json({ message: 'Sentiment Analysis Failed', error: error.message });
    }
});

/**
 * @route   POST /api/sentiment/analyse-batch
 * @desc    Process a batch of unanalysed posts
 * @access  Public
 */
router.post('/analyse-batch', async (req, res) => {
    try 
    {
        const batchSize = parseInt(req.body.batchSize) || 50;
        
        // Check if sentiment service is healthy
        try 
        {
            const healthStatus = await SentimentService.checkHealth();
            if (healthStatus.status !== 'healthy')
            {
                return res.status(503).json(
                    {
                    status: 'error',
                    message: 'Sentiment analysis server is not available',
                    details: healthStatus
                });
            }
        } 
        catch (error) 
        {
            return res.status(503).json(
                {
                status: 'error',
                message: 'Failed to connect to sentiment analysis server',
                details: error.message
            });
        }
        
        // Process the batch
        const result = await SentimentService.analyseBatch(batchSize);
        res.json(result);
    } 
    catch (error) 
    {
        console.error('Error processing batch:', error.message);
        res.status(500).json({ 
            status: 'error',
            message: 'Failed to process batch',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/sentiment/analyse-by-id
 * @desc    Analyse a specific post by ID from request body
 * @access  Public
 */
router.post('/analyse-by-id', async (req, res) => {
    try 
    {
        // Extract post_id from the request body
        const { post_id } = req.body;
        
        if (!post_id) 
            {
            return res.status(400).json({ 
                status: 'error',
                message: 'post_id is required in the request body' 
            });
        }
        
        // Analyse the post using the sentiment service
        const result = await SentimentService.analyseByID(post_id);
        
        // Return the result
        res.json(result);
    } 
    catch (error) 
    {
        console.error(`Error analyzing post:`, error.message);
        res.status(500).json({ 
            status: 'error',
            message: 'Sentiment analysis failed',
            error: error.message 
        });
    }
});

module.exports = router;