const axios = require("axios");
// Base URL for the Flask server
const FLASK_SERVER_URL = process.env.SENTIMENT_API_URL || 'http://localhost:5004';

/**
 * Service class to handle all sentiment analysis operations
 */
class SentimentService {
    
    /**
     * Check the health status of the Flask server
     * @returns {Promise<Object>} - The health check results
     */
    static async checkHealth() 
    {
        try 
        {
            const response = await axios.get(`${FLASK_SERVER_URL}/health`);
            return response.data;
        } 
        catch (error) 
        {
            console.error('Error checking health:', error.message);
            throw error;
        }
    }

    /**
     * Get the Unanalysed posts count from the Flask server
     * @returns {Promise<Object>} - The unanalysed posts
     */
    static async getUnanalysedCount(source = null)
    {
        try 
        {
            const url = source 
                ? `${FLASK_SERVER_URL}/unanalysed-count?source=${source}`
                : `${FLASK_SERVER_URL}/unanalysed-count`;
            
            const response = await axios.get(url);
            return response.data;
        } 
        catch (error) 
        {
            console.error('Error fetching unanalysed posts:', error.message);
            throw error;
        }
    }
    
    /**
     * Analyse text using the Flask server's sentiment analysis endpoint
     * @param {string} text - The text to analyse
     * @returns {Promise<Object>} - The analysis results
     */
    static async analyseText(text) 
    {
        try 
        {
            const data = {text};
            const response = await axios.post(`${FLASK_SERVER_URL}/analyse`, data);
            return response.data;
        } 
        catch (error) 
        {
            console.error('Error analyzing text:', error.message);
            throw error;
        }
    }

    /**
     * Analyse multiple texts in batch
     * @param {number} batchSize - Number of posts to analyse in one batch
     * @param {string} source - Optional source filter (twitter, reddit, bluesky)
     * @returns {Promise<Object>} - Batch processing results
     */
    static async analyseBatch(batchSize = 50, source = null) 
    {
        try 
        {
            const requestData = { batch_size: batchSize };
            if (source) {
                requestData.source = source;
            }
            
            const response = await axios.post(`${FLASK_SERVER_URL}/analyse/batch`, requestData);
            return response.data;
        } 
        catch (error) 
        {
            console.error('Error in batch processing:', error.message);
            return {
                success: false,
                processed: 0,
                errors: 1,
                message: `Batch processing failed: ${error.message}`
            };
        }
    }

    /**
     * Analyse a post by its ID
     * @param {string} postId - ID of the post to analyse
     * @param {string} source - Optional source of the post (twitter, reddit, bluesky)
     * @returns {Promise<Object>} - The sentiment analysis results
     */
    static async analyseByID(postId, source = null) 
    {
        try 
        {
            const requestData = { post_id: postId };
            if (source) {
                requestData.source = source;
            }
            
            const response = await axios.post(`${FLASK_SERVER_URL}/analyse-by-id`, requestData);
            return response.data;
        } 
        catch (error) 
        {
            console.error(`Error processing post ${postId}:`, error.message);
            return {
                success: false,
                post_id: postId,
                error: error.message
            };
        }
    }

    /**
     * Extract named entities from text
     * @param {string} text - The text to analyse
     * @returns {Promise<Object>} - The entity extraction results
     */
    static async extractEntities(text) 
    {
        try 
        {
            const response = await axios.post(`${FLASK_SERVER_URL}/analyse/entities`, { text });
            return response.data;
        } 
        catch (error) 
        {
            console.error('Error extracting entities:', error.message);
            throw error;
        }
    }

    /**
     * Process posts with sentiment analysis based on platform type
     * @param {Array<Object>} posts - Array of social media posts
     * @returns {Promise<Array<Object>>} - Posts with sentiment analysis
     */
    static async processPosts(posts) 
    {
        try 
        {
            const processedPosts = await Promise.all(
                posts.map(async (post) => {
                    try {
                        let textToAnalyse = '';
                        
                        // Handle different platforms and their content formats
                        if (post.platform === 'Twitter' || post.platform === 'Bluesky') {
                            textToAnalyse = post.content_text || '';
                        }
                        else if (post.platform === 'Reddit') {
                            textToAnalyse = `${post.title || ''} ${post.selftext || post.content_text || ''}`.trim();
                        }
                        else {
                            // Generic fallback
                            textToAnalyse = post.content_text || post.content || post.selftext || post.text || '';
                        }
                        
                        if (!textToAnalyse) {
                            console.warn(`No text content found for post ${post.post_id || post.id}`);
                            return post;
                        }

                        const analysis = await this.analyseText(textToAnalyse);
                        
                        return {
                            ...post,
                            sentiment: analysis.analysis?.sentiment,
                            entities: analysis.analysis?.entities,
                            processed_text: analysis.analysis?.processed_text
                        };
                    } catch (error) {
                        console.error(`Error analyzing post ${post.post_id || post.id}:`, error);
                        return post;
                    }
                })
            );
            return processedPosts;
        } catch (error) {
            console.error('Error processing posts:', error);
            throw error;
        }
    }
}

module.exports = SentimentService;