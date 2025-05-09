// DashboardCharts.js
import React, { useRef, useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  ArcElement
} from 'chart.js';
import * as d3 from 'd3';
import ReactWordcloud from 'react-wordcloud';
import { Calendar } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  ChartLegend,
  ArcElement
);

export const TrendLineChart = ({ data, limitToPastYear }) => {
  const [visibleLines, setVisibleLines] = useState({});

  // Optionally filter data to past 1 year
  let chartData = data || [];
  if (limitToPastYear && chartData.length > 0) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    chartData = chartData.filter(d => {
      const dDate = new Date(d.date);
      return dDate >= oneYearAgo;
    });
  }

  const handleLegendClick = (entry) => {
    setVisibleLines(prev => {
      const newVisibleLines = { ...prev };
      const areAllLinesVisible = Object.keys(prev).length === 0;
      if (areAllLinesVisible) {
        ['reddit', 'twitter', 'bluesky'].forEach(source => {
          newVisibleLines[source] = false;
        });
        newVisibleLines[entry.dataKey] = true;
      } else {
        if (prev[entry.dataKey]) {
          const visibleCount = Object.values(prev).filter(Boolean).length;
          if (visibleCount === 1) {
            return {};
          }
        }
        newVisibleLines[entry.dataKey] = !prev[entry.dataKey];
      }
      return newVisibleLines;
    });
  };

  const isLineVisible = (source) => {
    return Object.keys(visibleLines).length === 0 || visibleLines[source];
  };

  if (!chartData || chartData.length === 0) {
    return <div className="no-data">No data available for trend analysis</div>;
  }

  return (
    <div className="trend-line-chart">
      <ResponsiveContainer width="100%" height={250}>
        <LineChart 
          data={chartData}
          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(date) => {
              const d = new Date(date);
              return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
            }}
            tick={{ fill: '#666', fontSize: 11 }}
            interval="preserveStartEnd"
            axisLine={{ stroke: '#eee' }}
            tickLine={{ stroke: '#eee' }}
          />
          <YAxis 
            tick={{ fill: '#666', fontSize: 11 }}
            axisLine={{ stroke: '#eee' }}
            tickLine={{ stroke: '#eee' }}
            width={25}
          />
          <Tooltip 
            labelFormatter={(date) => {
              const d = new Date(date);
              return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
            }}
            formatter={(value, name) => [
              `${value} posts`, 
              name === 'reddit' ? 'Reddit' : name === 'twitter' ? 'Twitter' : 'Bluesky'
            ]}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid #eee',
              borderRadius: '4px',
              fontSize: '11px',
              padding: '8px'
            }}
          />
          <Legend 
            verticalAlign="top"
            height={36}
            formatter={(value) => value === 'reddit' ? 'Reddit' : value === 'twitter' ? 'Twitter' : 'Bluesky'}
            wrapperStyle={{
              paddingBottom: '15px',
              fontSize: '12px'
            }}
            onClick={handleLegendClick}
          />
          {isLineVisible('reddit') && (
          <Line 
            type="monotone" 
            dataKey="reddit"
            stroke="#FF6B6B"
            name="reddit"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          )}
          {isLineVisible('twitter') && (
          <Line 
            type="monotone" 
            dataKey="twitter"
            stroke="#4ECDC4"
            name="twitter"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          )}
          {isLineVisible('bluesky') && (
          <Line 
            type="monotone" 
            dataKey="bluesky"
            stroke="#0085FF"
            name="bluesky"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const DiseasePieChart = ({ data }) => {
  if (!data) return null;

  const SOURCE_COLORS = {
    Reddit: '#FF4500',
    Twitter: '#1DA1F2',
    Bluesky: '#5A5AFF'
  };
  const chartData = {
    labels: data.map(item => item._id),
    datasets: [
      {
        data: data.map(item => item.count),
        backgroundColor: data.map(item => SOURCE_COLORS[item._id] || '#ccc'),
        borderWidth: 0
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    cutout: '70%'
  };

  return <Pie data={chartData} options={options} />;
};

export const SourcePieChart = ({ data, onSliceClick }) => {
  if (!data) return null;
  const SOURCE_COLORS = {
    Twitter: '#1DA1F2',
    Reddit: '#FF4500',
    Bluesky: '#5A5AFF'
  };
  const chartData = {
    labels: data.map(item => item.source),
    datasets: [
      {
        data: data.map(item => item.count),
        backgroundColor: data.map(item => SOURCE_COLORS[item.source] || '#ccc'),
        borderWidth: 0
      }
    ]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          color: '#0a2e5c',
          font: { size: 14 }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.parsed || 0;
            return `${label}: ${value} posts`;
          }
        }
      }
    },
    onClick: (evt, elements) => {
      if (elements && elements.length && onSliceClick) {
        const idx = elements[0].index;
        onSliceClick(data[idx].source);
      }
    },
    cutout: '70%'
  };
  return <Pie data={chartData} options={options} />;
};