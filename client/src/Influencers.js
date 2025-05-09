// Updated Influencers.js - removed Posts column and avatar icons
import React, { useState, useEffect } from 'react';
import MediaTypeChart from './MediaChart';
import api from './services/api';
import './Influencers.css';

const TopicBadge = ({ topic }) => {
  const className = `topic-badge ${topic.toLowerCase()}`;
  return <span className={className}>{topic}</span>;
};

const TopicFilterButton = ({ topic, isActive, onClick }) => {
  const className = `topic-filter-button ${isActive ? 'active' : ''} ${topic.toLowerCase()}`;
  return (
    <button className={className} onClick={() => onClick(topic)}>
      {topic}
    </button>
  );
};

const Influencers = ({ navigateTo }) => {
  const [influencers, setInfluencers] = useState([]);
  const [mediaTypes, setMediaTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [selectedPlatform, setSelectedPlatform] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10); // Default page size
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Fetch influencers from backend with filters and pagination
  const fetchInfluencers = async (platform, topic, page = 1, sDate = startDate, eDate = endDate) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getInfluencers(platform, topic, page, limit, sDate, eDate);
      setInfluencers(data.influencers || []);
      setCurrentPage(data.currentPage);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError('Failed to load data. Please try again later.');
      setInfluencers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInfluencers(selectedPlatform, selectedTopic, 1, startDate, endDate);
    // Also fetch media types (unchanged)
    const fetchMediaTypes = async () => {
      try {
        const data = await api.getMediaTypes();
        setMediaTypes(data);
      } catch {}
    };
    fetchMediaTypes();
  }, [selectedPlatform, selectedTopic, startDate, endDate]);

  // Handle platform filter
  const handlePlatformFilter = (platform) => {
    setSelectedPlatform(platform);
  };

  // Handle topic filter
  const handleTopicFilter = (topic) => {
    setSelectedTopic(topic);
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      fetchInfluencers(selectedPlatform, selectedTopic, page);
    }
  };

  if (loading) {
    return (
      <div className="influencers-page">
        <div className="loading">Loading influencer data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="influencers-page">
        <div className="error">{error}</div>
      </div>
    );
  }

  const generatePageNumbers = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
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

  return (
    <div className="influencers-page">
      <div className="influencers-container">
        <div className="influencer-content">
          {/* Platform Filters */}
          <div className="platform-filter">
            {['All', 'Reddit', 'Twitter', 'Bluesky'].map(platform => (
              <button
                key={platform}
                className={`platform-button${selectedPlatform === platform ? ' active' : ''}`}
                onClick={() => handlePlatformFilter(platform)}
              >
                {platform === 'All' ? 'All Platforms' : platform}
              </button>
            ))}
          </div>

          {/* Topic Filters */}
          <div className="topic-filters">
            {['All', 'Agriculture', 'General', 'Politics', 'Technology', 'Economy', 'Education', 'Environment', 'Health'].map(topic => (
              <TopicFilterButton
                key={topic}
                topic={topic}
                isActive={selectedTopic === topic}
                onClick={handleTopicFilter}
              />
            ))}
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

          <div className="table-stats-container">
            <div className="influencers-table-section">
              <div className="influencer-tabs">
                <div className="influencer-tab">
                  <div className="tab-header">
                    <span>TOP INFLUENCERS</span>
                  </div>
                </div>
              </div>
              
              <div className="influencers-table">
                <table>
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Sources</th>
                      <th>Network</th>
                      <th>Location</th>
                      <th>Likes</th>
                      <th>Comments</th>
                      <th>Topic</th>
                      <th>Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {influencers.map((influencer, index) => (
                      <tr key={index} className={index === 0 ? 'top-influencer' : ''}>
                        <td>{influencer.username || 'N/A'}</td>
                        <td className="influencer-cell">
                          <div className="influencer-info">
                            <div className="influencer-details">
                              <div className="influencer-name">{influencer.name}</div>
                              <div className="influencer-url">
                                <a href={influencer.url} target="_blank" rel="noopener noreferrer">
                                  {influencer.url}
                                </a>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td data-network={influencer.network}>{influencer.network}</td>
                        <td>{influencer.location || 'N/A'}</td>
                        <td>{influencer.likes?.toLocaleString() || '0'}</td>
                        <td>{influencer.comments?.toLocaleString() || '0'}</td>
                        <td>
                          <TopicBadge topic={influencer.topic || 'General'} />
                        </td>
                        <td>{influencer.created_at ? new Date(influencer.created_at).toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-') : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="pagination">
            <button onClick={() => handlePageChange(1)} disabled={currentPage === 1} className="pagination-button">First</button>
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="pagination-button">Previous</button>
            {generatePageNumbers().map((pageNum, idx) => (
              <button
                key={idx}
                onClick={() => typeof pageNum === 'number' && handlePageChange(pageNum)}
                className={`pagination-button${pageNum === currentPage ? ' active' : ''}`}
                disabled={pageNum === currentPage || pageNum === '...'}
              >
                {pageNum}
              </button>
            ))}
            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="pagination-button">Next</button>
            <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages} className="pagination-button">Last</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Influencers;