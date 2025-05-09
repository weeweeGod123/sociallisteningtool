// SourceDistribution.js
import React, { useEffect, useState } from "react";
// import Topbar from "./Topbar"; // Removed Topbar import
import "./SourceDistribution.css";
import api from "./services/api";
import { SourcePieChart, TrendLineChart } from "./DashboardCharts";

const QUICK_SELECTS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last quarter", days: 90 },
  { label: "Last year", days: 365 }
];

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

function SourceDistribution() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatDate(d);
  });
  const [endDate, setEndDate] = useState(() => formatDate(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null); // null = all
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getSourceDistribution(startDate, endDate)
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch(err => {
        setError("Failed to load data");
        setLoading(false);
      });
  }, [startDate, endDate]);

  // Filtered data for trend chart and cards
  const filteredTrend = data && data.trendData
    ? (selectedSource
        ? data.trendData.map(d => ({ date: d.date, [selectedSource]: d[selectedSource] || 0 }))
        : data.trendData)
    : [];

  // Format trend data for the chart (dashboard logic)
  const formattedTrendData = data && data.trendData
    ? data.trendData.map(d => ({
        date: d.date,
        reddit: d.Reddit || d.reddit || 0,
        twitter: d.Twitter || d.twitter || 0,
        bluesky: d.Bluesky || d.bluesky || 0
      }))
    : [];

  // Card values
  const totalSources = data?.totalSources || 0;
  const totalMentions = selectedSource
    ? (data?.sourceBreakdown?.find(s => s.source === selectedSource)?.count || 0)
    : data?.totalMentions || 0;
  const avgDailyPosts = selectedSource
    ? Math.round(totalMentions / ((new Date(endDate) - new Date(startDate)) / (1000*60*60*24) + 1))
    : data?.avgDailyPosts || 0;
  const avgMonthlyPosts = selectedSource
    ? Math.round(totalMentions / (((new Date(endDate).getFullYear() - new Date(startDate).getFullYear()) * 12 + (new Date(endDate).getMonth() - new Date(startDate).getMonth()) + 1) || 1))
    : data?.avgMonthlyPosts || 0;

  // Source performance
  const sourcePerformance = data?.sourcePerformance || [];

  // Compute previous period dates in short format
  const start = new Date(startDate);
  const end = new Date(endDate);
  const msInDay = 24 * 60 * 60 * 1000;
  const days = Math.ceil((end - start) / msInDay) + 1;
  const prevEnd = new Date(start.getTime() - msInDay);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * msInDay);
  function formatShort(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const prevPeriodLabel = `${formatShort(prevStart)} – ${formatShort(prevEnd)}`;

  // Pie chart click handler
  const handlePieSliceClick = (source) => {
    setSelectedSource(selectedSource === source ? null : source);
  };

  // Quick-select handler
  const handleQuickSelect = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days + 1);
    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
  };

  // Date input handler
  const handleDateChange = (e) => {
    if (e.target.name === "start") setStartDate(e.target.value);
    else setEndDate(e.target.value);
  };

  return (
    <div className="source-distribution-page">
      {/* <Topbar /> Removed Topbar component */}
      <div className="main-content">
        <div className="metrics-header">
          <h2>Source Distribution</h2>
          <div className="time-filters">
            {QUICK_SELECTS.map(q => (
              <span
                key={q.label}
                className={
                  new Date(startDate).toDateString() === new Date((() => { const d = new Date(); d.setDate(d.getDate() - q.days + 1); return d; })()).toDateString() &&
                  new Date(endDate).toDateString() === new Date().toDateString()
                    ? "active"
                    : ""
                }
                onClick={() => handleQuickSelect(q.days)}
              >
                {q.label}
              </span>
            ))}
            <input
              type="date"
              name="start"
              value={startDate}
              onChange={handleDateChange}
              style={{ marginLeft: 12, marginRight: 4 }}
            />
            <span>to</span>
            <input
              type="date"
              name="end"
              value={endDate}
              onChange={handleDateChange}
              style={{ marginLeft: 4 }}
            />
          </div>
        </div>
        {loading ? (
          <div style={{ margin: 40 }}>Loading...</div>
        ) : error ? (
          <div style={{ color: "red", margin: 40 }}>{error}</div>
        ) : data ? (
          <>
            <div className="metric-cards">
              <div className="metric-card">
                <div className="card-header">Total Sources</div>
                <h3>{totalSources}</h3>
              </div>
              <div className="metric-card">
                <div className="card-header">Total Mentions</div>
                <h3>{totalMentions}</h3>
              </div>
              <div className="metric-card">
                <div className="card-header">Avg. Daily Posts</div>
                <h3>{avgDailyPosts}</h3>
              </div>
              <div className="metric-card">
                <div className="card-header">Avg. Monthly Posts</div>
                <h3>{avgMonthlyPosts}</h3>
              </div>
            </div>
            <div className="chart-section">
              <div className="chart-box" style={{ minWidth: 320, maxWidth: 400, height: 320 }}>
                <h4 style={{ textAlign: "center" }}>Source Breakdown</h4>
                <SourcePieChart
                  data={data.sourceBreakdown}
                  onSliceClick={handlePieSliceClick}
                  selectedSource={selectedSource}
                />
              </div>
              <div className="chart-box full-width" style={{ height: 320 }}>
                <h4 style={{ textAlign: "center" }}>
                  {selectedSource ? `${selectedSource} Trend` : "Overall Trend"}
                </h4>
                <TrendLineChart data={filteredTrend} selectedSource={selectedSource} />
              </div>
            </div>
            <div className="performance-section">
              <h4>Source Performance (vs. {prevPeriodLabel})</h4>
              {sourcePerformance.length > 0 ? (
                <table className="performance-table">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Current Period Mentions</th>
                      <th>Previous Period Mentions</th>
                      <th>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourcePerformance.map((item, index) => (
                      <tr key={index}>
                        <td>{item.source}</td>
                        <td>{item.current_mentions}</td>
                        <td>{item.previous_mentions}</td>
                        <td>
                          <span className={item.change >= 0 ? "positive" : "negative"}>
                            {item.change >= 0 ? "▲" : "▼"} {Math.abs(item.change).toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No performance data available.</p>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default SourceDistribution;
