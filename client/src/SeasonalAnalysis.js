// SeasonalAnalysis.js
import React, { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import "./SeasonalAnalysis.css";

// Helper to get quarter start month and label
function getQuarterStartLabel(year, quarter) {
  const map = { Q1: 0, Q2: 3, Q3: 6, Q4: 9 };
  const month = map[quarter];
  const date = new Date(year, month, 1);
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '-');
}

function SeasonalAnalysis({ navigateTo }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [quarters, setQuarters] = useState([]);
  const [topNames, setTopNames] = useState([]); // Top 5 for the year
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quarterCards, setQuarterCards] = useState([]);
  const [selectedLine, setSelectedLine] = useState(null);
  const [topDiseases, setTopDiseases] = useState([]);
  const [topCrops, setTopCrops] = useState([]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const url = `http://localhost:5003/api/seasonal/quarterly-trends?year=${year}`;
    console.log('[SeasonalAnalysis] Fetching:', url);
    fetch(url)
      .then(res => res.json())
      .then(data => {
        console.log("[SeasonalAnalysis] API data:", data);
        setAvailableYears(data.availableYears || []);
        setQuarters(data.quarters || []);
        // Get all unique top names (top 5 per quarter, unioned)
        const namesSet = new Set();
        (data.quarters || []).forEach(q => q.top.forEach(t => namesSet.add(t.name)));
        const names = Array.from(namesSet);
        setTopNames(names);
        // Prepare chart data: [{ dateLabel: 'Jan-2024', Disease1: count, ... }, ...]
        const chartRows = (data.quarters || []).map(q => {
          const dateLabel = getQuarterStartLabel(data.year, q.quarter);
          const row = { dateLabel };
          names.forEach(name => {
            row[name] = q.all_counts[name] || 0;
          });
          return row;
        });
        setChartData(chartRows);
        // Prepare quarter cards
        const cards = (data.quarters || []).map((q, idx, arr) => {
          const total = Object.values(q.all_counts).reduce((a, b) => a + b, 0);
          let change = null;
          if (idx > 0) {
            const prevTotal = Object.values(arr[idx - 1].all_counts).reduce((a, b) => a + b, 0);
            change = prevTotal === 0 ? null : Math.round(((total - prevTotal) / prevTotal) * 100);
          }
          const dateLabel = getQuarterStartLabel(data.year, q.quarter);
          return { quarter: q.quarter, total, change, dateLabel };
        });
        setQuarterCards(cards);
        // Aggregate top diseases and crops for the year
        const diseaseTotals = {};
        const cropTotals = {};
        (data.quarters || []).forEach(q => {
          Object.entries(q.all_counts).forEach(([name, count]) => {
            const type = (q.top.find(t => t.name === name)?.type) || '';
            if (type === 'disease') diseaseTotals[name] = (diseaseTotals[name] || 0) + count;
            if (type === 'crop') cropTotals[name] = (cropTotals[name] || 0) + count;
          });
        });
        const topDiseasesArr = Object.entries(diseaseTotals)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count }));
        const topCropsArr = Object.entries(cropTotals)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count }));
        setTopDiseases(topDiseasesArr);
        setTopCrops(topCropsArr);
        setLoading(false);
      })
      .catch(err => {
        setError("Failed to load data");
        setLoading(false);
      });
  }, [year]);

  // Legend click handler
  const handleLegendClick = (e) => {
    const { dataKey } = e;
    setSelectedLine(prev => (prev === dataKey ? null : dataKey));
  };

  return (
    <div className="seasonal-analysis-page">
      <div className="seasonal-header">
        <h2>Seasonal Analysis</h2>
        <div style={{ marginLeft: 24 }}>
          <label htmlFor="year-select">Year: </label>
          <select id="year-select" value={year} onChange={e => setYear(Number(e.target.value))}>
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>
      {/* Quarter cards row */}
      <div style={{ display: 'flex', gap: 20, margin: '32px 0 16px 0', flexWrap: 'wrap' }}>
        {quarterCards.map((card, idx) => (
          <div key={card.quarter} style={{
            flex: '1 1 120px',
            background: '#fff',
            borderRadius: 8,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            padding: 18,
            minWidth: 120,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{card.quarter}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>{card.dateLabel}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#2563EB', marginBottom: 2 }}>{card.total}</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>
              {idx === 0 || card.change === null ? (
                <span style={{ color: '#64748b' }}>N/A</span>
              ) : card.change > 0 ? (
                <span style={{ color: '#16a34a' }}>+{card.change}%</span>
              ) : card.change < 0 ? (
                <span style={{ color: '#dc2626' }}>{card.change}%</span>
              ) : (
                <span style={{ color: '#64748b' }}>0%</span>
              )}
              <span style={{ color: '#64748b', marginLeft: 4, fontWeight: 400 }}>
                vs prev
              </span>
      </div>
          </div>
        ))}
          </div>
      <div style={{ marginTop: 8 }}>
        {loading ? (
          <div>Loading seasonal trends...</div>
        ) : error ? (
          <div style={{ color: 'red' }}>{error}</div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dateLabel" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend onClick={handleLegendClick} />
              {(selectedLine ? topNames.filter(n => n === selectedLine) : topNames).map((name, idx) => (
                <Line key={name} type="monotone" dataKey={name} stroke={`hsl(${idx * 60}, 70%, 45%)`} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <div style={{ marginTop: 32, display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20, minWidth: 220 }}>
          <h3 style={{ marginBottom: 16, color: '#2563EB', fontSize: 18 }}>Diseases</h3>
          {topDiseases.length === 0 ? <div style={{ color: '#64748b' }}>No data</div> : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {topDiseases.map(d => (
                <li key={d.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontWeight: 500 }}>
                  <span>{d.name}</span>
                  <span style={{ color: '#2563EB', fontWeight: 700 }}>{d.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div style={{ flex: '1 1 300px', background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20, minWidth: 220 }}>
          <h3 style={{ marginBottom: 16, color: '#16a34a', fontSize: 18 }}>Crops</h3>
          {topCrops.length === 0 ? <div style={{ color: '#64748b' }}>No data</div> : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {topCrops.map(c => (
                <li key={c.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontWeight: 500 }}>
                  <span>{c.name}</span>
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>{c.count}</span>
                </li>
              ))}
          </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default SeasonalAnalysis;
