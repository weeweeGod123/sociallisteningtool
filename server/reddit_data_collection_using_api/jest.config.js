/**
 * Jest Configuration for Social Listening Web Scraper
 * 
 * This file configures Jest testing framework settings for the project
 */

module.exports = {
  // Specify the test environment
  testEnvironment: 'node',
  
  verbose: true,
  
  collectCoverage: false,
  
  // Coverage directory
  coverageDirectory: './coverage',
  
  collectCoverageFrom: [
    '*.js',
    '!node_modules/**',
    '!coverage/**',
    '!jest.config.js'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70
    }
  },

  coverageReporters: ['text', 'lcov', 'html'],
  
  // Setup files to run before tests
  setupFiles: ['./tests/setup.js'],
  
  // Default timeout for tests in milliseconds (15 seconds)
  testTimeout: 15000,
}; 