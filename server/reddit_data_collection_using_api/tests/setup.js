/**
 * Jest Test Setup
 * 
 * This file sets up the testing environment before running tests
 */

// Set NODE_ENV to 'test' to prevent server from starting during tests
process.env.NODE_ENV = 'test';

// Provide mock Reddit API credentials if not already defined in environment
if (!process.env.REDDIT_CLIENT_ID) {
  process.env.REDDIT_CLIENT_ID = 'test_client_id';
}

if (!process.env.REDDIT_CLIENT_SECRET) {
  process.env.REDDIT_CLIENT_SECRET = 'test_client_secret';
}

// Set default PORT for testing
process.env.PORT = process.env.PORT || 9000;

// Additional test setup can be added below
console.log('Jest test environment configured'); 