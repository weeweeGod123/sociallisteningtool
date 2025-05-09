// Updated MostEngagementPage.js - Removed redundant search bar
import React, { useState, useEffect } from 'react';
import { 
  User,
  Crown
} from 'lucide-react';
import SentimentBar from './components/SentimentBar';
import api from './services/api';
import './MostEngagementPage.css';

const MostEngagementPage = ({ navigateTo, currentPage }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Function to fetch posts from the backend
  const fetchPosts = async (page = 1, sDate = startDate, eDate = endDate) => {
    try {
      setLoading(true);
      const data = await api.getMostEngagementPosts(page, selectedPlatform, sDate, eDate);
      setPosts(data.posts);
      setTotalPages(data.totalPages);
      setCurrentPageNum(data.currentPage);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch posts when component mounts or platform/date changes
  useEffect(() => {
    fetchPosts(1, startDate, endDate);
    // eslint-disable-next-line
  }, [selectedPlatform, startDate, endDate]);

  // Function to handle platform change
  const handlePlatformChange = (platform) => {
    setSelectedPlatform(platform);
    setCurrentPageNum(1); // Reset to first page when changing platform
  };

  // Function to handle page change
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchPosts(newPage);
    }
  };

  // Function to render sentiment emoji
  const renderSentimentEmoji = (sentiment) => {
    switch(sentiment) {
      case 'Positive':
        return <div className="sentiment-emoji positive">😊</div>;
      case 'Negative':
        return <div className="sentiment-emoji negative">☹️</div>;
      default:
        return <div className="sentiment-emoji neutral">😐</div>;
    }
  };

  // Function to calculate engagement score
  const calculateEngagement = (post) => {
    const likes = post.metadata?.score || post.score || post.likes || 0;
    const comments = post.metadata?.comments || post.comments || 0;
    return likes + comments;
  };

  // Function to render source badge
  const renderSourceBadge = (source) => {
    const sourceColors = {
      reddit: '#FF4500',
      twitter: '#1DA1F2',
      bluesky: '#0560FF'
    };
    
    return (
      <span 
        style={{
          backgroundColor: sourceColors[source] || '#666',
          color: 'white',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          marginLeft: '8px'
        }}
      >
        {source?.charAt(0).toUpperCase() + source?.slice(1) || 'Unknown'}
      </span>
    );
  };

  const generatePageNumbers = () => {
    const delta = 2; // Number of pages to show before and after current page
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 || 
        i === totalPages || 
        (i >= currentPageNum - delta && i <= currentPageNum + delta)
      ) {
        range.push(i);
      }
    }

    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  };

  // Skeleton loader component
  const PostSkeleton = () => (
    <div className="result-item skeleton">
      <div className="result-content">
        <div className="result-header">
          <div className="result-title skeleton-title"></div>
        </div>
        <div className="result-details">
          <div className="author-info">
            <div className="author-meta">
              <div className="author-name skeleton-line"></div>
              <div className="user-location skeleton-line"></div>
            </div>
          </div>
          <div className="result-preview">
            <div className="preview-text skeleton-block"></div>
          </div>
        </div>
      </div>
      <div className="result-metrics">
        <div className="sentiment-section skeleton-block"></div>
        <div className="metrics-details skeleton-block"></div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="main-content">
          <div className="results-container">
            {[...Array(10)].map((_, i) => <PostSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="main-content">
          <div className="error-container">
            <p>Error: {error}</p>
            <button onClick={() => fetchPosts()}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Main Content */}
      <div className="main-content">
        {/* Page title that was in top-nav */}
        <div className="page-title" style={{ marginBottom: '20px' }}>
          <h2>Most Engagement</h2>
        </div>
        
        {/* Platform Filter */}
        <div className="platform-filter">
          <button 
            className={`platform-button ${selectedPlatform === 'all' ? 'active' : ''}`}
            onClick={() => handlePlatformChange('all')}
          >
            All Platforms
          </button>
          <button 
            className={`platform-button ${selectedPlatform === 'reddit' ? 'active' : ''}`}
            onClick={() => handlePlatformChange('reddit')}
          >
            Reddit
          </button>
          <button 
            className={`platform-button ${selectedPlatform === 'twitter' ? 'active' : ''}`}
            onClick={() => handlePlatformChange('twitter')}
          >
            Twitter
          </button>
          <button 
            className={`platform-button ${selectedPlatform === 'bluesky' ? 'active' : ''}`}
            onClick={() => handlePlatformChange('bluesky')}
          >
            Bluesky
          </button>
        </div>
        {/* Date Range Filter */}
        <div className="date-filter" style={{ display: 'flex', gap: '10px', margin: '16px 0' }}>
          <label>
            From:
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              max={endDate || undefined}
            />
          </label>
          <label>
            To:
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              min={startDate || undefined}
            />
          </label>
        </div>
        
        {/* Results Container */}
        <div className="results-container">
          {/* Results List */}
          <div className="results-list">
            {posts.length === 0 ? (
              <div className="no-posts-message">
                No posts found for the selected platform.
              </div>
            ) : (
              posts.map((post, idx) => (
                <div key={post._id} className={`result-item${idx === 0 ? ' top-post' : ''}`}>
                  <div className="result-content">
                    <div className="result-header">
                      <div className="result-title">
                        {post.title || post.content?.substring(0, 100) || 'No title'}
                        {renderSourceBadge(post.platform)}
                      </div>
                    </div>
                    
                    <div className="result-details">
                      <div className="author-info">
                        <div className="author-meta">
                          <div className="author-name">
                            {post.author || post.username || 'Anonymous'}
                          </div>
                          <div className="user-location">
                            {post.user_location || 'Location not specified'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="result-preview">
                        <div className="preview-text">
                          {post.content || post.content_text || post.text || 'No content available'}
                        </div>
                        {post.url && (
                          <a href={post.url} target="_blank" rel="noopener noreferrer" className="post-link">
                            View Original Post
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="result-metrics">
                    <div className="sentiment-section">
                      <div className="sentiment-title">Sentiment Analysis</div>
                      <SentimentBar sentiment={post.sentiment?.sentiment} />
                      <div className="sentiment-indicator">
                        {renderSentimentEmoji(post.sentiment?.sentiment)}
                      </div>
                    </div>
                    
                    <div className="metrics-details">
                      <div className="metric-group">
                        <div className="metric-values">
                          <div className="metric">
                            <div className="metric-icon engagement-icon">⭐</div>
                            <div className="metric-number">{calculateEngagement(post)}</div>
                            <div className="metric-label">Total Engagement</div>
                          </div>
                          
                          <div className="metric">
                            <div className="metric-icon score-icon">👍</div>
                            <div className="metric-number">
                              {post.metadata?.score || post.score || post.likes || 0}
                            </div>
                            <div className="metric-label">Likes</div>
                          </div>
                          
                          <div className="metric">
                            <div className="metric-icon comments-icon">💬</div>
                            <div className="metric-number">
                              {post.metadata?.comments || post.comments || 0}
                            </div>
                            <div className="metric-label">Comments</div>
                          </div>
                        </div>
                        
                        <div className="metric-additional-info">
                          {post.created_at && (
                            <div className="post-date">
                              Posted: {new Date(post.created_at).toLocaleDateString()}
                            </div>
                          )}
                          {post.source === 'reddit' && post.subreddit && (
                            <div className="subreddit-info">
                              Subreddit: {post.subreddit}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="pagination">
            <button 
              onClick={() => handlePageChange(1)}
              disabled={currentPageNum === 1}
              className="pagination-button"
            >
              First
            </button>
            <button 
              onClick={() => handlePageChange(currentPageNum - 1)}
              disabled={currentPageNum === 1}
              className="pagination-button"
            >
              Previous
            </button>

            <div className="page-numbers">
              {generatePageNumbers().map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`pagination-button ${pageNum === currentPageNum ? 'active' : ''}`}
                  disabled={pageNum === currentPageNum}
                >
                  {pageNum}
                </button>
              ))}
            </div>

            <button 
              onClick={() => handlePageChange(currentPageNum + 1)}
              disabled={currentPageNum === totalPages}
              className="pagination-button"
            >
              Next
            </button>
            <button 
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPageNum === totalPages}
              className="pagination-button"
            >
              Last
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MostEngagementPage;