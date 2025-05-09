import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  MoreVertical,
  Maximize,
  Star,
  HelpCircle,
  RefreshCcw,
  Download,
} from "lucide-react";
import WordCloud from './WordCloud';
import ThemeCharts from './ThemeCharts';
import "./ThemesPage.css";

function formatDate(date) {
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

const ThemesPage = ({ navigateTo, currentPage }) => {
  const [wordCloudData, setWordCloudData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return formatDate(d);
  });
  const [endDate, setEndDate] = useState(() => formatDate(new Date()));

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
    const fetchWordCloud = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`http://localhost:5003/api/analytics?startDate=${startDate}&endDate=${endDate}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setWordCloudData(data.wordCloudData || []);
      } catch (err) {
        setError('Failed to fetch word cloud data.');
      } finally {
        setLoading(false);
      }
    };
    if (startDate && endDate) fetchWordCloud();
  }, [startDate, endDate]);

  return (
    <div className="themes-page">
      <div className="main-content">
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

        <div className="themes-header">
          <h2>Top Themes</h2>
        </div>

        <div className="themes-wordcloud-section">
          {loading ? (
            <div>Loading word cloud...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : (
            <>
              <WordCloud data={wordCloudData} />
              {wordCloudData.length > 0 && <ThemeCharts wordCloudData={wordCloudData} startDate={startDate} endDate={endDate} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ThemesPage;