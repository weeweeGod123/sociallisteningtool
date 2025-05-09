// Modified Dashboard.js to display search results
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { TrendLineChart, DiseasePieChart } from './DashboardCharts';
import {
  Search, ChevronRight, User, Clock, 
  Briefcase, AlertCircle
} from 'lucide-react';
import WordCloud from './WordCloud';
import SentimentPieChart from './components/SentimentPieChart';
import './Dashboard.css';

const Dashboard = ({ navigateTo, currentPage }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [formattedChartData, setFormattedChartData] = useState([]);
  const location = useLocation();
  // Date range for Latest Trends (default last 6 months)
  const today = new Date();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(today.getMonth() - 5); // 6 months including current
  const [trendStartDate, setTrendStartDate] = useState(sixMonthsAgo.toISOString().split('T')[0]);
  const [trendEndDate, setTrendEndDate] = useState(today.toISOString().split('T')[0]);

  // Fetch analytics data
  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('http://localhost:5003/api/analytics');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Received analytics data:', data);
      setAnalytics(data);
      
      if (data.postsOverTime?.length > 0) {
        setFormattedChartData(data.postsOverTime);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError('Failed to fetch analytics data');
      setLoading(false);
    }
  };

  // Fetch search results if we have a search ID
  const fetchSearchResults = async (searchId) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`http://localhost:5003/api/combined/results/${searchId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Received search results:', data);
      setSearchResults(data);
      
      if (data?.length > 0) {
        const formattedData = formatDataForCharts(data);
        setFormattedChartData(formattedData);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching search results:', error);
      setError('Failed to fetch search results');
      setLoading(false);
    }
  };

  // Format data for charts
  const formatDataForCharts = (data) => {
    if (!data || data.length === 0) return [];

    if (data[0].hasOwnProperty('reddit') || data[0].hasOwnProperty('twitter') || data[0].hasOwnProperty('bluesky')) {
      return data;
    }

    const postsByDate = data.reduce((acc, post) => {
      let date;
      
      if (post.created_at) {
        if (typeof post.created_at === 'object' && post.created_at.$date) {
          date = new Date(post.created_at.$date).toISOString().split('T')[0];
        } else {
          date = new Date(post.created_at).toISOString().split('T')[0];
        }
      } else {
        return acc;
      }

      if (!acc[date]) {
        acc[date] = { 
          date, 
          reddit: post.platform === 'Reddit' ? 1 : 0,
          twitter: post.platform === 'Twitter' ? 1 : 0,
          bluesky: post.platform === 'Bluesky' ? 1 : 0
        };
      } else {
        if (post.platform === 'Reddit') acc[date].reddit += 1;
        if (post.platform === 'Twitter') acc[date].twitter += 1;
        if (post.platform === 'Bluesky') acc[date].bluesky += 1;
      }
      return acc;
    }, {});

    return Object.values(postsByDate).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );
  };

  // Filter chart data for selected date range (Latest Trends)
  const filteredTrends = formattedChartData.filter(d => {
    const dDate = new Date(d.date);
    return dDate >= new Date(trendStartDate) && dDate <= new Date(trendEndDate);
  });

  // Load data when component mounts or when search ID changes
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchId = params.get('searchId');
    
    if (searchId) {
      fetchSearchResults(searchId);
    } else {
      fetchAnalytics();
    }
  }, [location.search]);

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="main-content">
          <div className="loading-message">Loading dashboard data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="main-content">
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="main-content">
        {location.state?.searchQuery && (
          <div className="search-info-banner">
            <div className="search-info-content">
              <h3>Search Results for: <span className="search-query">{location.state.searchQuery}</span></h3>
              <p className="results-count">Found {searchResults?.length || 0} matches</p>
            </div>
            <button 
              className="new-search-button"
              onClick={() => navigateTo('advancedSearch')}
            >
              New Search
            </button>
          </div>
        )}
        
        <div className="welcome-message">
          <h2>Welcome back</h2>
          <p>Here are {location.state?.searchQuery ? 'your search results' : "today's stats"}!</p>
        </div>

        <div className="dashboard-cards">
          {/* Sources Card - white card style, top left title */}
          <div className="dashboard-card" style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', height: '100%' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontWeight: 600, fontSize: 18, textAlign: 'right' }}>Sources</h3>
            </div>
            <div className="card-content" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
              <div className="sources-chart" style={{ height: '220px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 32, marginBottom: 12 }}>
                {Array.isArray(analytics?.sourceBreakdown) ? (
                  <DiseasePieChart data={analytics.sourceBreakdown} />
                ) : (
                  <DiseasePieChart 
                    data={Object.entries(analytics?.sourceBreakdown || {}).map(([key, value]) => ({
                      _id: key,
                      count: value
                    }))} 
                  />
                )}
              </div>
              <div className="sources-legend" style={{ marginTop: 8, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, width: '100%' }}>
                {Array.isArray(analytics?.sourceBreakdown) ? (
                  analytics.sourceBreakdown.map((source, index) => {
                    const SOURCE_COLORS = {
                      Reddit: '#FF4500',
                      Twitter: '#1DA1F2',
                      Bluesky: '#5A5AFF'
                    };
                    return (
                      <div key={index} className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
                        <span className="legend-color" style={{ backgroundColor: SOURCE_COLORS[source._id] || '#ccc' }}></span>
                        <span className="legend-name">{source._id}</span>
                        <span className="legend-value">{source.count} posts</span>
                      </div>
                    );
                  })
                ) : (
                  Object.entries(analytics?.sourceBreakdown || {}).map(([key, value], index) => {
                    const SOURCE_COLORS = {
                      Reddit: '#FF4500',
                      Twitter: '#1DA1F2',
                      Bluesky: '#5A5AFF'
                    };
                    return (
                      <div key={index} className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
                        <span className="legend-color" style={{ backgroundColor: SOURCE_COLORS[key] || '#ccc' }}></span>
                        <span className="legend-name">{key}</span>
                        <span className="legend-value">{value} posts</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          
          {/* Sentiment Analysis Card - white card style, top left title */}
          <div className="dashboard-card" style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div className="card-header" style={{ alignItems: 'flex-start', marginBottom: 12 }}>
              <div className="card-icon sentiment-icon">
                <AlertCircle size={20} color="white" />
              </div>
              <h3 style={{ margin: 0, fontWeight: 600, fontSize: 18, textAlign: 'left' }}>Sentiment Analysis</h3>
            </div>
            <div className="card-content" style={{ width: '100%' }}>
              <SentimentPieChart data={analytics?.sentimentData} />
            </div>
          </div>
        </div>

        <div className="dashboard-charts">
          <div className="chart-container">
            <div className="chart-header" style={{ alignItems: 'flex-start' }}>
              <div className="chart-icon">
                <Clock size={20} color="white" />
              </div>
              <h3 style={{ margin: 0, fontWeight: 600, fontSize: 18, textAlign: 'left' }}>Latest Trends</h3>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="date"
                  value={trendStartDate}
                  max={trendEndDate}
                  onChange={e => setTrendStartDate(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #e5e7eb' }}
                />
                <span>to</span>
                <input
                  type="date"
                  value={trendEndDate}
                  min={trendStartDate}
                  max={today.toISOString().split('T')[0]}
                  onChange={e => setTrendEndDate(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #e5e7eb' }}
                />
              </div>
            </div>
            {filteredTrends && filteredTrends.length > 0 ? (
              <TrendLineChart data={filteredTrends} limitToPastYear={false} />
            ) : (
              <div className="no-data">
                <p>No trend data available</p>
                <small>This could be because no posts have been collected yet or the data is still being processed.</small>
              </div>
            )}
          </div>

          <div className="chart-container">
            <div className="chart-header" style={{ alignItems: 'flex-start' }}>
              <div className="chart-icon">
                <Briefcase size={20} color="white" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <h3 style={{ margin: 0, fontWeight: 600, fontSize: 18, textAlign: 'left' }}>Keyword Cloud</h3>
                {analytics?.wordCloudData && (
                  <span className="chart-subtitle">
                    Top {analytics.wordCloudData.length} most frequent terms
                  </span>
                )}
              </div>
            </div>
            <div className="card-content">
              {analytics?.wordCloudData && analytics.wordCloudData.length > 0 ? (
                <WordCloud data={analytics.wordCloudData} />
              ) : (
                <div className="no-data">
                  <p>No word cloud data available</p>
                  <small>This could be because no word cloud data has been loaded yet.</small>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;