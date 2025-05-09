// Updated AdvancedSearch.js with navigation to Dashboard after search
import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, RefreshCw, Download, Search, CheckCircle, XCircle, Trash2
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import './AdvancedSearch.css';

// API endpoint constants
const TWITTER_API_BASE_URL = 'http://localhost:5001';
const TWITTER_SEARCH_ENDPOINT = `${TWITTER_API_BASE_URL}/api/twitter/search`;
const TWITTER_STATUS_ENDPOINT = `${TWITTER_API_BASE_URL}/api/twitter/status`;
const TWITTER_RESULTS_ENDPOINT = `${TWITTER_API_BASE_URL}/api/twitter/results`;
const TWITTER_TEST_ENDPOINT = `${TWITTER_API_BASE_URL}/api/test`;
const TWITTER_CLEAR_ALL_COLLECTIONS_ENDPOINT = `${TWITTER_API_BASE_URL}/api/twitter/clear-all-collections`;

// Reddit API endpoint constants
const REDDIT_API_BASE_URL = 'http://localhost:5002';
const REDDIT_SEARCH_ENDPOINT = `${REDDIT_API_BASE_URL}/api/reddit/search`;
const REDDIT_STATUS_ENDPOINT = `${REDDIT_API_BASE_URL}/api/reddit/status`;
const REDDIT_RESULTS_ENDPOINT = `${REDDIT_API_BASE_URL}/api/reddit/results`;
const REDDIT_TEST_ENDPOINT = `${REDDIT_API_BASE_URL}/api/reddit/test`;
const REDDIT_CLEAR_COLLECTIONS_ENDPOINT = `${REDDIT_API_BASE_URL}/api/reddit/clear-collections`;

// Bluesky API endpoint constants
const BLUESKY_API_BASE_URL = 'http://localhost:5005';
const BLUESKY_SEARCH_ENDPOINT = `${BLUESKY_API_BASE_URL}/api/bluesky/search`;
const BLUESKY_STATUS_ENDPOINT = `${BLUESKY_API_BASE_URL}/api/bluesky/status`;
const BLUESKY_RESULTS_ENDPOINT = `${BLUESKY_API_BASE_URL}/api/bluesky/results`;
const BLUESKY_TEST_ENDPOINT = `${BLUESKY_API_BASE_URL}/api/bluesky/test`;
const BLUESKY_CLEAR_COLLECTIONS_ENDPOINT = `${BLUESKY_API_BASE_URL}/api/bluesky/clear-collections`;

// Combined API endpoint constants
const COMBINED_API_BASE_URL = 'http://localhost:5003';
const COMBINED_CLEAR_ALL_COLLECTIONS_ENDPOINT = `${COMBINED_API_BASE_URL}/api/combined/clear-all-collections`;
const COMBINED_TEST_ENDPOINT = `${COMBINED_API_BASE_URL}/api/test`;

const AdvancedSearch = ({ navigateTo, currentPage }) => {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchStatus, setSearchStatus] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [apiConnected, setApiConnected] = useState(false);
  const [twitterConnected, setTwitterConnected] = useState(false);
  const [redditConnected, setRedditConnected] = useState(false);
  const [blueskyConnected, setBlueskyConnected] = useState(false);
  const [combinedApiConnected, setCombinedApiConnected] = useState(false);
  const [statusPollingInterval, setStatusPollingInterval] = useState(null);
  const [clearingCollections, setClearingCollections] = useState(false);
  
  // Check if we received a search query from the Topbar
  useEffect(() => {
    if (location.state?.initialQuery) {
      setSearchQuery(location.state.initialQuery);
    }
  }, [location.state]);
  
  // Check API connection when component mounts
  useEffect(() => {
    checkApiConnection();
  }, []);
  
  // Simple function to check API connection
  const checkApiConnection = async () => {
    try {
      console.log('Checking API connections...');
      
      // Check Twitter API
      let isTwitterConnected = false;
      try {
        console.log('Testing Twitter API connection at:', TWITTER_TEST_ENDPOINT);
        const twitterResponse = await fetch(TWITTER_TEST_ENDPOINT);
        isTwitterConnected = twitterResponse.ok;
        console.log('Twitter API connection status:', isTwitterConnected ? 'Connected' : 'Disconnected');
        if (twitterResponse.ok) {
          const data = await twitterResponse.json();
          console.log('Twitter API response:', data);
        }
      } catch (twitterError) {
        console.error('Twitter API connection error:', twitterError);
      }
      setTwitterConnected(isTwitterConnected);
      
      // Check Reddit API
      let isRedditConnected = false;
      try {
        console.log('Testing Reddit API connection at:', REDDIT_TEST_ENDPOINT);
        const redditResponse = await fetch(REDDIT_TEST_ENDPOINT);
        isRedditConnected = redditResponse.ok;
        console.log('Reddit API connection status:', isRedditConnected ? 'Connected' : 'Disconnected');
        if (redditResponse.ok) {
          const data = await redditResponse.json();
          console.log('Reddit API response:', data);
        }
      } catch (redditError) {
        console.error('Reddit API connection error:', redditError);
      }
      setRedditConnected(isRedditConnected);
      
      // Check Bluesky API
      let isBlueskyConnected = false;
      try {
        const blueskyResponse = await fetch(BLUESKY_TEST_ENDPOINT);
        isBlueskyConnected = blueskyResponse.ok;
      } catch (blueskyError) {
        console.error('Bluesky API connection error:', blueskyError);
      }
      setBlueskyConnected(isBlueskyConnected);
      
      // Check Combined API
      let isCombinedApiConnected = false;
      try {
        console.log('Testing Combined API connection at:', COMBINED_TEST_ENDPOINT);
        const combinedResponse = await fetch(COMBINED_TEST_ENDPOINT);
        isCombinedApiConnected = combinedResponse.ok;
        console.log('Combined API connection status:', isCombinedApiConnected ? 'Connected' : 'Disconnected');
        if (combinedResponse.ok) {
          const data = await combinedResponse.json();
          console.log('Combined API response:', data);
        }
      } catch (combinedError) {
        console.error('Combined API connection error:', combinedError);
      }
      setCombinedApiConnected(isCombinedApiConnected);
      
      // Set API connected if either one is available
      setApiConnected(isTwitterConnected || isRedditConnected || isBlueskyConnected);
      console.log('Overall API connection status:', (isTwitterConnected || isRedditConnected || isBlueskyConnected) ? 'At least one API connected' : 'All APIs disconnected');
    } catch (error) {
      console.error('API connection check error:', error);
      setApiConnected(false);
      setTwitterConnected(false);
      setRedditConnected(false);
      setBlueskyConnected(false);
      setCombinedApiConnected(false);
    }
  };

  // Operators with their symbols
  const operators = [
    { name: 'AND', symbol: '&' },
    { name: 'OR', symbol: '|' },
    { name: 'NOT', symbol: '-' },
    { name: 'Exact Phrase', symbol: '"' },
    { name: 'Hashtag', symbol: '#' },
    { name: 'Mention', symbol: '@' },
  ];

  // Function to send search query to both Twitter and Reddit APIs
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setErrorMessage('Please enter a search query');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage('');
      setSearchResults(null);
      setSearchStatus({ status: 'starting', message: 'Starting the search...' });

      // First, attempt to clear all collections using the Combined API endpoint
      setClearingCollections(true);
      let collectionsCleared = false;
      try {
        console.log('Clearing all collections before starting new search using Combined API');
        setSearchStatus({ status: 'clearing', message: 'Clearing previous data collections...' });
        
        const clearResponse = await fetch(COMBINED_CLEAR_ALL_COLLECTIONS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (clearResponse.ok) {
          collectionsCleared = true;
          console.log('All collections cleared successfully using Combined API');
        } else {
          console.warn('Failed to clear all collections using Combined API endpoint:', await clearResponse.text());
        }
      } catch (clearError) {
        console.error('Error clearing collections using combined endpoint:', clearError);
      }
      
      // If the combined endpoint failed, try clearing collections individually per platform
      if (!collectionsCleared) {
        console.log('Attempting to clear collections individually per platform');
        
        // Try clearing Twitter collections
        if (twitterConnected) {
          try {
            const twitterClearResponse = await fetch(`${TWITTER_API_BASE_URL}/api/twitter/clear-collections`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
              }
            });
            
            if (twitterClearResponse.ok) {
              console.log('Twitter collections cleared successfully');
            } else {
              console.warn('Failed to clear Twitter collections:', await twitterClearResponse.text());
            }
          } catch (twitterClearError) {
            console.error('Error clearing Twitter collections:', twitterClearError);
          }
        }
        
        // Try clearing Reddit collections
        if (redditConnected) {
          try {
            const redditClearResponse = await fetch(REDDIT_CLEAR_COLLECTIONS_ENDPOINT, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
              }
            });
            
            if (redditClearResponse.ok) {
              console.log('Reddit collections cleared successfully');
            } else {
              console.warn('Failed to clear Reddit collections:', await redditClearResponse.text());
            }
          } catch (redditClearError) {
            console.error('Error clearing Reddit collections:', redditClearError);
          }
        }
        
        // Try clearing Bluesky collections
        if (blueskyConnected) {
          try {
            const blueskyClearResponse = await fetch(BLUESKY_CLEAR_COLLECTIONS_ENDPOINT, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
              }
            });
            
            if (blueskyClearResponse.ok) {
              console.log('Bluesky collections cleared successfully');
            } else {
              console.warn('Failed to clear Bluesky collections:', await blueskyClearResponse.text());
            }
          } catch (blueskyClearError) {
            console.error('Error clearing Bluesky collections:', blueskyClearError);
          }
        }
      }
      
      setClearingCollections(false);
      setSearchStatus({ status: 'starting', message: 'Collections cleared. Starting search...' });

      // Prepare the search parameters
      const searchParams = {
        query: searchQuery,
        language: 'en',
        fromDate: '2023-01-01',
        toDate: new Date().toISOString().split('T')[0],
        locations: ['Australia', 'Western Australia', 'WA', 'Perth']
      };

      // Initialize variables to track search IDs
      let twitterSearchId = null;
      let redditSearchId = null;
      let blueskySearchId = null;

      // Start Twitter search
      try {
        const twitterResponse = await fetch(TWITTER_SEARCH_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify(searchParams)
        });

        if (twitterResponse.ok) {
          const twitterData = await twitterResponse.json();
          twitterSearchId = twitterData.search_id || Date.now().toString();
          console.log('Twitter search started with ID:', twitterSearchId);
        } else {
          console.error('Twitter search failed:', await twitterResponse.text());
        }
      } catch (twitterError) {
        console.error('Error starting Twitter search:', twitterError);
      }

      // Start Reddit search
      try {
        const redditResponse = await fetch(REDDIT_SEARCH_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify(searchParams)
        });

        if (redditResponse.ok) {
          const redditData = await redditResponse.json();
          redditSearchId = redditData.search_id || Date.now().toString();
          console.log('Reddit search started with ID:', redditSearchId);
        } else {
          console.error('Reddit search failed:', await redditResponse.text());
        }
      } catch (redditError) {
        console.error('Error starting Reddit search:', redditError);
      }

      // Start Bluesky search
      try {
        const blueskyResponse = await fetch(BLUESKY_SEARCH_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify(searchParams)
        });

        if (blueskyResponse.ok) {
          const blueskyData = await blueskyResponse.json();
          blueskySearchId = blueskyData.search_id || Date.now().toString();
          console.log('Bluesky search started with ID:', blueskySearchId);
        } else {
          console.error('Bluesky search failed:', await blueskyResponse.text());
        }
      } catch (blueskyError) {
        console.error('Error starting Bluesky search:', blueskyError);
      }

      // Check if at least one search was started successfully
      if (twitterSearchId || redditSearchId || blueskySearchId) {
        setSearchStatus({ 
          twitter_search_id: twitterSearchId,
          reddit_search_id: redditSearchId,
          bluesky_search_id: blueskySearchId,
          status: 'running', 
          message: 'Search is running in the background. This may take several minutes.' 
        });

        // Start polling for status with the primary search ID (Twitter or Reddit, whichever is available)
        const primarySearchId = twitterSearchId || redditSearchId || blueskySearchId;
        startStatusPolling(primarySearchId);
      } else {
        throw new Error('Failed to start search on any platform');
      }
    } catch (error) {
      setClearingCollections(false);
      setErrorMessage(error.message || 'An error occurred while starting the search');
      setSearchStatus({ status: 'error', message: `Error: ${error.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  // Start polling for search status
  const startStatusPolling = (searchId) => {
    // Poll immediately on start
    checkSearchStatus(searchId);
    
    const statusInterval = setInterval(() => {
      checkSearchStatus(searchId);
    }, 3000); // Poll every 3 seconds
    
    // Store the interval ID to clear it later
    setStatusPollingInterval(statusInterval);
    
    // Return a cleanup function to clear the interval
    return () => clearInterval(statusInterval);
  };

  // Check search status
  const checkSearchStatus = async (searchId) => {
    if (!searchId) {
      // Try to get search IDs from state
      const twitterSearchId = searchStatus?.twitter_search_id;
      const redditSearchId = searchStatus?.reddit_search_id;
      const blueskySearchId = searchStatus?.bluesky_search_id;
      
      // If we don't have any search IDs, exit
      if (!twitterSearchId && !redditSearchId && !blueskySearchId) return;
      
      // Use whichever search ID is available
      searchId = twitterSearchId || redditSearchId || blueskySearchId;
    }
    
    try {
      // Check Twitter status if we have a Twitter search ID
      let twitterStatus = null;
      if (searchStatus?.twitter_search_id) {
        try {
          const statusUrl = `${TWITTER_STATUS_ENDPOINT}?search_id=${searchStatus.twitter_search_id}&_=${Date.now()}`;
          const response = await fetch(statusUrl, {
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          if (response.ok) {
            twitterStatus = await response.json();
            console.log('Twitter status:', twitterStatus);
          }
        } catch (error) {
          console.error('Error checking Twitter status:', error);
        }
      }

      // Check Reddit status if we have a Reddit search ID
      let redditStatus = null;
      if (searchStatus?.reddit_search_id) {
        try {
          const statusUrl = `${REDDIT_STATUS_ENDPOINT}?search_id=${searchStatus.reddit_search_id}&_=${Date.now()}`;
          const response = await fetch(statusUrl, {
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          if (response.ok) {
            redditStatus = await response.json();
            console.log('Reddit status:', redditStatus);
          }
        } catch (error) {
          console.error('Error checking Reddit status:', error);
        }
      }
      
      // Check Bluesky status if we have a Bluesky search ID
      let blueskyStatus = null;
      if (searchStatus?.bluesky_search_id) {
        try {
          const statusUrl = `${BLUESKY_STATUS_ENDPOINT}?search_id=${searchStatus.bluesky_search_id}&_=${Date.now()}`;
          const response = await fetch(statusUrl, {
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          if (response.ok) {
            blueskyStatus = await response.json();
            console.log('Bluesky status:', blueskyStatus);
          }
        } catch (error) {
          console.error('Error checking Bluesky status:', error);
        }
      }
      
      // Determine overall status
      let combinedStatus = {
        status: 'running',
        twitter_search_id: searchStatus?.twitter_search_id,
        reddit_search_id: searchStatus?.reddit_search_id,
        bluesky_search_id: searchStatus?.bluesky_search_id,
        twitter_status: twitterStatus,
        reddit_status: redditStatus,
        bluesky_status: blueskyStatus,
        message: 'Search is running in the background...'
      };

      // If Twitter is completed or Reddit is completed, show completed
      if ((twitterStatus && twitterStatus.status === 'completed') || 
          (redditStatus && redditStatus.status === 'completed') ||
          (blueskyStatus && blueskyStatus.status === 'completed')) {
        combinedStatus.status = 'completed';
        combinedStatus.message = 'One or more searches have completed.';
        
        // If all are completed, fetch results from all
        if ((!twitterStatus || twitterStatus.status === 'completed') && 
            (!redditStatus || redditStatus.status === 'completed') &&
            (!blueskyStatus || blueskyStatus.status === 'completed')) {
          fetchSearchResults();
          
          // Clear the polling interval since search is complete
          if (statusPollingInterval) {
            clearInterval(statusPollingInterval);
            setStatusPollingInterval(null);
          }
        }
      }
      
      // Update the UI with the combined status
      setSearchStatus(combinedStatus);
      
    } catch (error) {
      setSearchStatus({
        status: 'error',
        twitter_search_id: searchStatus?.twitter_search_id,
        reddit_search_id: searchStatus?.reddit_search_id,
        bluesky_search_id: searchStatus?.bluesky_search_id,
        message: `Error checking status: ${error.message}. Try refreshing.`
      });
    }
  };

  // Fetch search results
  const fetchSearchResults = async () => {
    const twitterSearchId = searchStatus?.twitter_search_id;
    const redditSearchId = searchStatus?.reddit_search_id;
    const blueskySearchId = searchStatus?.bluesky_search_id;
    
    if (!twitterSearchId && !redditSearchId && !blueskySearchId) return;
    
    let twitterResults = null;
    let redditResults = null;
    let blueskyResults = null;
    let combinedResults = {
      count: 0,
      results: []
    };
    
    // Fetch Twitter results if available
    if (twitterSearchId) {
      try {
        const resultsUrl = `${TWITTER_RESULTS_ENDPOINT}?search_id=${twitterSearchId}&_=${Date.now()}`;
        const response = await fetch(resultsUrl, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (response.ok) {
          twitterResults = await response.json();
          console.log('Twitter results:', twitterResults);
          
          if (twitterResults && twitterResults.results) {
            combinedResults.count += twitterResults.count || 0;
            combinedResults.results = combinedResults.results.concat(twitterResults.results);
          }
        }
      } catch (error) {
        console.error('Error fetching Twitter results:', error);
      }
    }
    
    // Fetch Reddit results if available
    if (redditSearchId) {
      try {
        const resultsUrl = `${REDDIT_RESULTS_ENDPOINT}?search_id=${redditSearchId}&_=${Date.now()}`;
        const response = await fetch(resultsUrl, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (response.ok) {
          redditResults = await response.json();
          console.log('Reddit results:', redditResults);
          
          if (redditResults && redditResults.results) {
            combinedResults.count += redditResults.count || 0;
            combinedResults.results = combinedResults.results.concat(redditResults.results);
          }
        }
      } catch (error) {
        console.error('Error fetching Reddit results:', error);
      }
    }
    
    // Fetch Bluesky results if available
    if (blueskySearchId) {
      try {
        const resultsUrl = `${BLUESKY_RESULTS_ENDPOINT}?search_id=${blueskySearchId}&_=${Date.now()}`;
        const response = await fetch(resultsUrl, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (response.ok) {
          // You can process the CSV or show a download link
          // For now, just log the download URL
          console.log('Bluesky results available at:', resultsUrl);
        }
      } catch (error) {
        console.error('Error fetching Bluesky results:', error);
      }
    }
    
    // Set the combined results
    setSearchResults(combinedResults);
    
    setSearchStatus({ 
      status: 'completed', 
      twitter_search_id: twitterSearchId,
      reddit_search_id: redditSearchId,
      bluesky_search_id: blueskySearchId,
      message: `Search completed with ${combinedResults.count} results.` 
    });
    
    // Auto-navigate to dashboard after successful search with search parameters
    setTimeout(() => {
      navigateTo('dashboard', { 
        twitterSearchId: twitterSearchId,
        redditSearchId: redditSearchId,
        blueskySearchId: blueskySearchId,
        searchQuery: searchQuery,
        results: combinedResults
      });
    }, 1500); // Small delay to let user see the completion message
  };

  // Reset the form
  const handleReset = () => {
    setSearchQuery('');
    setErrorMessage('');
    setSearchResults(null);
    setSearchStatus(null);
  };

  // Show immediate result and navigate to dashboard
  const viewResults = () => {
    if (searchResults) {
      navigateTo('dashboard', { 
        twitterSearchId: searchStatus?.twitter_search_id,
        redditSearchId: searchStatus?.reddit_search_id,
        blueskySearchId: searchStatus?.bluesky_search_id,
        searchQuery: searchQuery,
        results: searchResults
      });
    }
  };

  return (
    <div className="dashboard-container">
      {/* Main Content */}
      <div className="main-content">
        {/* Page title */}
        <div className="adv-search-title">
          <h2>Advanced Search</h2>
        </div>
        
        {/* Advanced Search Content */}
        <div className="adv-search-container">
          <div className="adv-search-card">
            <div className="adv-search-content">
              <div className="adv-search-query-section">
                <h3 className="adv-section-title">Enter query string</h3>
                <textarea
                  id="queryString"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  rows={8}
                  className="adv-query-textarea"
                  placeholder={`Example: "Western Australia" AND (wheat OR barley OR canola) AND NOT flood`}
                />
                {/* API Status Indicators */}
                <div className="adv-api-status">
                  <div className={`adv-api-status-item ${twitterConnected ? 'connected' : 'disconnected'}`}>
                    {twitterConnected ? 
                      <CheckCircle size={16} className="status-icon connected" /> : 
                      <XCircle size={16} className="status-icon disconnected" />
                    }
                    <span>Twitter API</span>
                  </div>
                  <div className={`adv-api-status-item ${redditConnected ? 'connected' : 'disconnected'}`}>
                    {redditConnected ? 
                      <CheckCircle size={16} className="status-icon connected" /> : 
                      <XCircle size={16} className="status-icon disconnected" />
                    }
                    <span>Reddit API</span>
                  </div>
                  <div className={`adv-api-status-item ${blueskyConnected ? 'connected' : 'disconnected'}`}>
                    {blueskyConnected ? 
                      <CheckCircle size={16} className="status-icon connected" /> : 
                      <XCircle size={16} className="status-icon disconnected" />
                    }
                    <span>Bluesky API</span>
                  </div>
                  <div className={`adv-api-status-item ${combinedApiConnected ? 'connected' : 'disconnected'}`}>
                    {combinedApiConnected ? 
                      <CheckCircle size={16} className="status-icon connected" /> : 
                      <XCircle size={16} className="status-icon disconnected" />
                    }
                    <span>Combined API</span>
                  </div>
                  <button 
                    className="adv-refresh-button"
                    onClick={() => checkApiConnection()}
                    title="Refresh API connection status"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>
              
              <div className="adv-search-operators">
                <h3 className="adv-section-title">Search Operators</h3>
                <ul className="adv-operators-list">
                  {operators.map((operator, index) => (
                    <li key={index} className="adv-operator-item">
                      <span className="adv-operator-name">{operator.name}</span>
                      <span className="adv-operator-symbol">{operator.symbol}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="adv-search-footer">
              <div className="adv-search-actions">
                <button 
                  type="button" 
                  className="adv-reset-button"
                  onClick={handleReset}
                >
                  Reset
                </button>
                <button 
                  type="button" 
                  className="adv-search-button" 
                  onClick={handleSearch}
                  disabled={isLoading || !apiConnected || !searchQuery.trim() || clearingCollections}
                >
                  {isLoading ? (
                    clearingCollections ? (
                      <>
                        <Trash2 size={16} className="button-icon" />
                        Clearing Data...
                      </>
                    ) : (
                      'Searching...'
                    )
                  ) : (
                    'Search'
                  )}
                </button>
              </div>
              
              {!apiConnected && (
                <div className="adv-error-message">
                  <AlertCircle size={16} />
                  <span>No API services are connected. Please start at least one API server to continue.</span>
                </div>
              )}
              
              {errorMessage && (
                <div className="adv-error-message">
                  <AlertCircle size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}
              
              {searchStatus && (
                <div className="adv-status-message">
                  <div className={`adv-status-indicator ${searchStatus.status}`}>
                    {searchStatus.status === 'running' && <span className="adv-loading-spinner"></span>}
                    <span className="adv-status-text">{searchStatus.status}</span>
                  </div>
                  <p>{searchStatus.message}</p>
                  {searchStatus.tweet_count && searchStatus.tweet_count !== 'Error reading file' && (
                    <p><strong>Items collected: {searchStatus.tweet_count}</strong></p>
                  )}
                </div>
              )}
              
              {/* Results Section - Will show when results are available */}
              {searchResults && searchResults.results && (
                <div className="adv-results-preview">
                  <h3>Search Results</h3>
                  <p>Found {searchResults.count} items matching your query</p>
                  <p className="adv-redirect-message">You will be redirected to the dashboard shortly...</p>
                  <button 
                    className="adv-view-results-button"
                    onClick={viewResults}
                  >
                    View Dashboard Now
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedSearch;