import React, { useState, useEffect } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import './SentimentAnalysis.css';
import SentimentPieChart from './components/SentimentPieChart';

// Sample sentiment pie chart data
const pieData = [
  { name: 'Positive', value: 400 },
  { name: 'Neutral', value: 300 },
  { name: 'Negative', value: 300 },
];

const COLORS = ['#34A853', '#AAAAAA', '#EA4335'];

const sources = [
  { name: 'Twitter', value: 72, color: '#34A853' },
  { name: 'Facebook', value: 65, color: '#34A853' },
  { name: 'New Sites', value: 55, color: '#fbbc04' },
  { name: 'Forums', value: 45, color: '#ea4335' },
];

function formatDate(date) {
  // Format a Date object as YYYY-MM-DD
  if (!date) return '';
  const d = new Date(date);
  const month = '' + (d.getMonth() + 1);
  const day = '' + d.getDate();
  const year = d.getFullYear();
  return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function SentimentAnalysis({ navigateTo, currentPage }) {
  const [sentimentData, setSentimentData] = useState([]);
  const [sentimentBySource, setSentimentBySource] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return formatDate(d);
  });
  const [endDate, setEndDate] = useState(() => formatDate(new Date()));

  const sentimentCategories = [
    'Slightly Negative',
    'Slightly Positive',
    'Positive',
    'Negative',
    'Neutral'
  ];

  // Date filter quick ranges
  const quickRanges = [
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last quarter', days: 90 },
    { label: 'Last year', days: 365 }
  ];

  const handleQuickRange = (days) => {
    const end = new Date();
    const start = addDays(end, -days + 1);
    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
  };

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);
      try {
        let url = `http://localhost:5003/api/analytics?startDate=${startDate}&endDate=${endDate}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setSentimentData(data.sentimentData || []);
        setSentimentBySource(data.sentimentBySource || []);
      } catch (err) {
        setError('Failed to fetch sentiment data.');
      } finally {
        setLoading(false);
      }
    };
    if (startDate && endDate) fetchAnalytics();
  }, [startDate, endDate]);

  // Calculate total count
  const totalCount = sentimentData.reduce((sum, item) => sum + item.count, 0);

  // Map each category to its percentage
  const sentimentPercentages = sentimentCategories.map(category => {
    const found = sentimentData.find(item => item.sentiment === category);
    return {
      sentiment: category,
      percent: found && totalCount > 0 ? Math.round((found.count / totalCount) * 100) : 0
    };
  });

  // Sentiment color mapping
  const sentimentColors = {
    'Positive': '#34A853',
    'Slightly Positive': '#8BC34A',
    'Neutral': '#9E9E9E',
    'Negative': '#EA4335',
    'Slightly Negative': '#FFC107'
  };

  return (
    <div className="sentiment-analysis-page">
      <div className="sentiment-dashboard">
        {/* Date Filter UI */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, marginTop: 8, justifyContent: 'flex-end', width: '100%' }}>
          {quickRanges.map((range) => (
            <button
              key={range.label}
              style={{
                background: 'none',
                border: 'none',
                color: '#174ea6',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: 16,
                marginRight: 8,
                padding: '4px 8px',
                borderRadius: 4,
                transition: 'background 0.2s',
                textDecoration: 'none',
                outline: 'none',
              }}
              onMouseOver={e => e.currentTarget.style.background = '#e3eafc'}
              onMouseOut={e => e.currentTarget.style.background = 'none'}
              onFocus={e => e.currentTarget.style.background = '#e3eafc'}
              onBlur={e => e.currentTarget.style.background = 'none'}
              onClick={() => handleQuickRange(range.days)}
            >
              {range.label}
            </button>
          ))}
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{ marginLeft: 16, marginRight: 4, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
          />
          <span>to</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            style={{ marginLeft: 4, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
          />
        </div>
        {/* Header */}
        <div className="dashboard-header">
          <h2>Sentiment Analysis</h2>
          <p>Updated live</p>
        </div>

        {/* Sentiment Cards */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: 32, marginBottom: 32, maxWidth: 900, marginLeft: 'auto', marginRight: 'auto' }}>
          <div style={{ display: 'flex', gap: 24, marginBottom: 24, justifyContent: 'center' }}>
            {sentimentPercentages.slice(0, 3).map(({ sentiment, percent }) => (
              <div
                key={sentiment}
                style={{
                  flex: 1,
                  background: sentimentColors[sentiment] || '#f3f4f6',
                  color: ['Neutral', 'Slightly Positive', 'Slightly Negative'].includes(sentiment) ? '#222' : '#fff',
                  borderRadius: 10,
                  padding: '24px 0',
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: 18,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
                }}
              >
                <div style={{ fontSize: 16, marginBottom: 8 }}>{sentiment}</div>
                <div style={{ fontSize: 28 }}>{percent}%</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
            {sentimentPercentages.slice(3, 5).map(({ sentiment, percent }) => (
              <div
                key={sentiment}
                style={{
                  flex: 1,
                  background: sentimentColors[sentiment] || '#f3f4f6',
                  color: ['Neutral', 'Slightly Positive', 'Slightly Negative'].includes(sentiment) ? '#222' : '#fff',
                  borderRadius: 10,
                  padding: '24px 0',
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: 18,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
                }}
              >
                <div style={{ fontSize: 16, marginBottom: 8 }}>{sentiment}</div>
                <div style={{ fontSize: 28 }}>{percent}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sentiment Trends Section */}
        <div className="sentiment-trends-section">
          <h2>Sentiment Trends</h2>
          {loading ? (
            <div>Loading sentiment data...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : (
            <SentimentPieChart data={sentimentData} />
          )}
        </div>

        {/* Sentiment by Source */}
        <div className="sources-section">
          <h3>Most Popular Sentiment by Source</h3>
          {sentimentBySource.map((source) => (
            <div className="source-bar" key={source.source}>
              <div className="source-bar-label">
                <span>{source.source}</span>
                <span style={{ color: sentimentColors[source.sentiment] || '#333', fontWeight: 600 }}>
                  {source.percent}% {source.sentiment}
                </span>
              </div>
              <div className="source-bar-container">
                <div
                  className="source-bar-fill"
                  style={{
                    width: `${source.percent}%`,
                    backgroundColor: sentimentColors[source.sentiment] || '#333',
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SentimentAnalysis;
