// Updated GeographicDistribution.js
import React, { useState, useEffect, useCallback } from 'react';
import { 
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup
} from "react-simple-maps";
import { scaleLinear, scaleThreshold } from "d3-scale";
import './GeographicDistribution.css';

// Use a reliable CDN source for the map topology
const geoUrl = "https://unpkg.com/world-atlas@2.0.2/countries-50m.json";

const GeographicDistribution = ({ navigateTo, currentPage }) => {
  const [countryData, setCountryData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tooltipContent, setTooltipContent] = useState("");
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [mapTopology, setMapTopology] = useState(null);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [topPosts, setTopPosts] = useState({ reddit_posts: [], tweets: [], bluesky_posts: [] });
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState(null);
  const [countryPostCounts, setCountryPostCounts] = useState({});

  // Helper function to normalize country names
  const normalizeCountryName = (name) => {
    const nameMap = {
      'United States of America': 'USA',
      'United States': 'USA',
      'United Kingdom': 'UK',
      'Russian Federation': 'Russia'
    };
    // Only remap if in nameMap, otherwise return the name as-is
    return nameMap[name] || name;
  };

  // Load map topology
  const loadMapTopology = useCallback(async () => {
    try {
      setIsMapLoading(true);
      const response = await fetch(geoUrl);
      if (!response.ok) {
        throw new Error('Failed to load map data');
      }
      const topology = await response.json();
      setMapTopology(topology);
    } catch (err) {
      console.error('Error loading map:', err);
      setError('Failed to load map. Please refresh the page or try again later.');
    } finally {
      setIsMapLoading(false);
    }
  }, []);

  // Load map data on component mount
  useEffect(() => {
    loadMapTopology();
  }, [loadMapTopology]);

  // Load country data and post counts
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        // Fetch country post counts from backend
        const response = await fetch('http://localhost:5003/api/geographic/country-mentions');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // Convert array to object for easier access
        const postCounts = data.reduce((acc, item) => {
          acc[item.country] = item.count;
          return acc;
        }, {});
        setCountryPostCounts(postCounts);
        setLastUpdated(new Date().toLocaleString());
        // Set default selected country to the one with the most posts
        if (Object.keys(postCounts).length > 0 && !selectedCountry) {
          const topCountry = Object.entries(postCounts).sort((a, b) => b[1] - a[1])[0][0];
          setSelectedCountry(topCountry);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load country data. Please refresh the page or try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line
  }, []);

  // Fetch top posts when selectedCountry changes
  useEffect(() => {
    if (!selectedCountry) return;
    setPostsLoading(true);
    setPostsError(null);
    fetch(`http://localhost:5003/api/geographic/top-posts-by-country?country=${encodeURIComponent(selectedCountry)}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch top posts');
        return res.json();
      })
      .then(data => setTopPosts(data))
      .catch(err => setPostsError(err.message))
      .finally(() => setPostsLoading(false));
  }, [selectedCountry]);

  // Define color stops and ranges
  const colorStops = [0, 10, 50, 100, 500];
  const colorRange = [
    "#FFF9C4",  // Very light yellow for few mentions
    "#4FC3F7",  // Light blue
    "#2196F3",  // Medium blue
    "#1976D2",  // Dark blue
    "#0D47A1"   // Very dark blue
  ];

  // Use post counts for map coloring
  const getCountryColor = (geo) => {
    const countryName = normalizeCountryName(geo.properties.name);
    const mentions = countryPostCounts[countryName] || 0;
    if (mentions === 0) return "#F1F5F9";  // Light gray for no posts
    for (let i = 0; i < colorStops.length; i++) {
      if (mentions <= colorStops[i]) {
        return colorRange[i];
      }
    }
    return colorRange[colorRange.length - 1];
  };

  // Show loading state if either map or data is loading
  if (isLoading || isMapLoading) {
    return (
      <div className="dashboard-container">
        <div className="main-content">
          <div className="geo-content">
            <div className="loading">
              {isMapLoading ? "Loading map..." : "Loading geographic data..."}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="dashboard-container">
        <div className="main-content">
          <div className="geo-content">
            <div className="error">
              <div style={{ marginBottom: '10px' }}>{error}</div>
              <button 
                onClick={loadMapTopology}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3B82F6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Retry Loading Map
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="main-content">
        <div className="geo-title-section">
          <h2>Geographic Distribution</h2>
          {lastUpdated && <span className="last-updated">Last updated: {lastUpdated}</span>}
        </div>
        <div className="geo-content">
          <div className="map-container">
            <ComposableMap
              projectionConfig={{
                rotate: [-10, 0, 0],
                scale: 147
              }}
            >
              <ZoomableGroup>
                {mapTopology && (
                  <Geographies geography={mapTopology}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const countryName = normalizeCountryName(geo.properties.name);
                        const mentions = countryPostCounts[countryName] || 0;
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={getCountryColor(geo)}
                            stroke="#FFFFFF"
                            strokeWidth={0.5}
                            style={{
                              default: { outline: "none" },
                              hover: { outline: "none", fill: "#2563EB" },
                              pressed: { outline: "none" }
                            }}
                            onMouseEnter={(event) => {
                              setTooltipContent(`${countryName}: ${mentions} posts`);
                              setTooltipPosition({
                                x: event.clientX,
                                y: event.clientY
                              });
                            }}
                            onMouseMove={(event) => {
                              setTooltipPosition({
                                x: event.clientX,
                                y: event.clientY
                              });
                            }}
                            onMouseLeave={() => {
                              setTooltipContent("");
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>
                )}
              </ZoomableGroup>
            </ComposableMap>
            {/* Tooltip */}
            {tooltipContent && (
              <div 
                className="tooltip"
                style={{
                  left: `${tooltipPosition.x}px`,
                  top: `${tooltipPosition.y}px`
                }}
              >
                {tooltipContent}
              </div>
            )}
          </div>
          {/* Legend - moved outside map-container for visibility */}
          <div className="map-legend" style={{ marginTop: 24 }}>
              <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: "#F1F5F9" }}></div>
              <span>No posts</span>
              </div>
            {colorStops.map((stop, index) => (
              <div key={stop} className="legend-item">
                <div className="legend-color" style={{ backgroundColor: colorRange[index] }}></div>
                <span>
                  {index === 0 ? '1-10' :
                    index === colorStops.length - 1 ? '500+':
                    `${colorStops[index-1] + 1}-${stop}`} posts
                </span>
              </div>
            ))}
              </div>

          {/* Add a debug section to show the data */}
          <div className="debug-section" style={{ marginTop: '20px', padding: '20px' }}>
            <h3>Country Post Counts</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
              {Object.entries(countryPostCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([country, count]) => (
                  <button
                    key={country}
                    className={`country-mention-btn${selectedCountry === country ? ' selected' : ''}`}
                    style={{
                      padding: '8px',
                      border: selectedCountry === country ? '2px solid #2563EB' : '1px solid #e2e8f0',
                      borderRadius: '6px',
                      background: selectedCountry === country ? '#e0e7ff' : '#fff',
                      fontWeight: selectedCountry === country ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      outline: 'none',
                    }}
                    onClick={() => setSelectedCountry(country)}
                  >
                    {country}: {count}
                  </button>
                ))}
            </div>
          </div>
          
          {/* Top posts for selected country */}
          <div className="top-posts-section" style={{ marginTop: '30px' }}>
            <h3 style={{ marginBottom: 12 }}>
              Top Posts for <span style={{ color: '#2563EB' }}>{selectedCountry}</span>
            </h3>
            {postsLoading ? (
              <div>Loading top posts...</div>
            ) : postsError ? (
              <div style={{ color: 'red' }}>Error: {postsError}</div>
            ) : (
              <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
                {['tweets', 'reddit_posts', 'bluesky_posts'].map(platform => (
                  <div key={platform} style={{ flex: '1 1 300px', minWidth: 280 }}>
                    <h4 style={{ color: '#334155', marginBottom: 8 }}>
                      {platform === 'tweets' ? 'Tweets' : platform === 'reddit_posts' ? 'Reddit Posts' : 'Bluesky Posts'}
                    </h4>
                    {topPosts[platform] && topPosts[platform].length > 0 ? (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {topPosts[platform].map(post => (
                          <li key={post._id?.$oid || post.post_id} style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            marginBottom: 10,
                            padding: '10px 12px',
                            fontSize: 14,
                            overflow: 'hidden',
                          }}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>
                              {post.username} {post.platform ? `(${post.platform})` : ''}
                    </div>
                            <div style={{ marginBottom: 6, color: '#334155' }}>
                              {post.content_text.length > 120 ? post.content_text.slice(0, 120) + '...' : post.content_text}
              </div>
                            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>
                              Likes: {post.likes || 0} | Comments: {post.comments || 0}
            </div>
                            <a href={post.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB', fontSize: 12 }}>
                              View Post
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div style={{ color: '#64748b', fontSize: 13 }}>No posts found for this country.</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeographicDistribution;