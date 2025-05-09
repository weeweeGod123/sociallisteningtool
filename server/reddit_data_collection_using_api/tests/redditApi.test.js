/**
 * Reddit API Tests
 * 
 * Tests for the Reddit API authentication and data retrieval
 * Uses nock to mock HTTP requests
 */

const nock = require('nock');
const { getRedditAccessToken, app } = require('../server');
const request = require('supertest');

// Mock environment variables (should be set in setup.js)
process.env.REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID || 'test_client_id';
process.env.REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET || 'test_client_secret';

describe('Reddit API Integration', () => {
  
  // Clear all HTTP mocks before each test
  beforeEach(() => {
    nock.cleanAll();
  });
  
  describe('getRedditAccessToken', () => {
    test('should fetch an access token from Reddit API', async () => {
      // Mock the Reddit token endpoint
      nock('https://www.reddit.com')
        .post('/api/v1/access_token')
        .reply(200, {
          access_token: 'mock_access_token',
          token_type: 'bearer',
          expires_in: 3600,
          scope: '*'
        });
      
      const token = await getRedditAccessToken();
      
      expect(token).toBe('mock_access_token');
    });
    
    test('should throw an error when authentication fails', async () => {
      // Mock an authentication failure
      nock('https://www.reddit.com')
        .post('/api/v1/access_token')
        .reply(401, {
          error: 'invalid_client'
        });
        
      await expect(getRedditAccessToken()).rejects.toThrow();
    });
  });
  
  describe('/api/search endpoint', () => {
    test('should return formatted search results', async () => {
      // First, mock the token endpoint
      nock('https://www.reddit.com')
        .post('/api/v1/access_token')
        .reply(200, {
          access_token: 'mock_access_token',
          token_type: 'bearer',
          expires_in: 3600
        });
      
      // Then, mock the search endpoint with sample data
      nock('https://oauth.reddit.com')
        .get(/\/search\?.*/)
        .reply(200, {
          data: {
            children: [
              {
                data: {
                  id: 'abc123',
                  title: 'Test Post Title',
                  subreddit: 'testsubreddit',
                  subreddit_name_prefixed: 'r/testsubreddit',
                  author: 'testuser',
                  permalink: '/r/testsubreddit/comments/abc123/test_post_title/',
                  url: 'https://www.reddit.com/r/testsubreddit/comments/abc123/test_post_title/',
                  created_utc: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
                  score: 42,
                  num_comments: 10,
                  selftext: 'This is a test post content',
                  thumbnail: 'https://example.com/thumbnail.jpg',
                  upvote_ratio: 0.95,
                  over_18: false,
                  domain: 'self.testsubreddit'
                }
              }
            ]
          }
        });
      
      // Make a request to the search endpoint
      const response = await request(app)
        .get('/api/search')
        .query({ keyword: 'test' });
      
      // Verify the response
      expect(response.status).toBe(200);
      expect(response.body.posts).toBeDefined();
      expect(response.body.posts.length).toBe(1);
      expect(response.body.posts[0].title).toBe('Test Post Title');
      expect(response.body.posts[0].subreddit).toBe('r/testsubreddit');
      expect(response.body.posts[0].author).toBe('testuser');
      expect(response.body.metadata).toBeDefined();
      expect(response.body.metadata.total).toBe(1);
    });
    
    test('should return 400 when keyword is missing', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Keyword is required');
    });
    
    test('should handle API errors properly', async () => {
      // Mock the token endpoint
      nock('https://www.reddit.com')
        .post('/api/v1/access_token')
        .reply(200, {
          access_token: 'mock_access_token',
          token_type: 'bearer',
          expires_in: 3600
        });
      
      // Mock a server error from Reddit
      nock('https://oauth.reddit.com')
        .get(/\/search\?.*/)
        .reply(500, {
          error: 'server_error'
        });
      
      const response = await request(app)
        .get('/api/search')
        .query({ keyword: 'test' });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });
  });
}); 