import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Calendar } from 'lucide-react';

const ThemeCharts = ({ wordCloudData, startDate, endDate }) => {
  // State to track visible lines
  const [visibleLines, setVisibleLines] = useState({});

  // Get top 10 words for bar chart
  const topWords = useMemo(() => {
    return [...wordCloudData]
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [wordCloudData]);

  // Process data for line chart with date filtering from props
  const lineChartData = useMemo(() => {
    const dates = new Set();
    const wordData = {};
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    wordCloudData.forEach(word => {
      if (word.dates) {
        word.dates.forEach(dateCount => {
          const postDate = new Date(dateCount.date);
          if ((!start || postDate >= start) && (!end || postDate <= end)) {
            dates.add(dateCount.date);
            if (!wordData[word.text]) {
              wordData[word.text] = {};
            }
            wordData[word.text][dateCount.date] = dateCount.count;
          }
        });
      }
    });
    const sortedDates = Array.from(dates).sort();
    return sortedDates.map(date => {
      const dataPoint = { date };
      topWords.forEach(word => {
        dataPoint[word.text] = wordData[word.text]?.[date] || 0;
      });
      return dataPoint;
    });
  }, [wordCloudData, startDate, endDate, topWords]);

  // Format date for x-axis
  const formatXAxis = (tickItem) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Handle legend click to toggle lines
  const handleLegendClick = (entry) => {
    setVisibleLines(prev => {
      const newVisibleLines = { ...prev };
      
      // If no lines are explicitly set as visible, all are visible by default
      const areAllLinesVisible = Object.keys(prev).length === 0;
      
      if (areAllLinesVisible) {
        // First click: hide all except clicked
        topWords.forEach(word => {
          newVisibleLines[word.text] = false;
        });
        newVisibleLines[entry.dataKey] = true;
      } else {
        // Toggle the clicked line
        if (prev[entry.dataKey]) {
          // If this was the only visible line, show all lines
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

  // Check if a line should be visible
  const isLineVisible = (wordText) => {
    // If no lines are explicitly set as visible, all are visible
    return Object.keys(visibleLines).length === 0 || visibleLines[wordText];
  };

  return (
    <div className="theme-charts">
      <div className="chart-container">
        <h3>Top 10 Most Mentioned Words</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={topWords}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="text" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#007ac3" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-container">
        <h3>Word Frequency Over Time</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatXAxis}
                interval="preserveStartEnd"
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              />
              <Legend onClick={handleLegendClick} />
              {topWords.map((word, index) => (
                isLineVisible(word.text) && (
                  <Line
                    key={word.text}
                    type="monotone"
                    dataKey={word.text}
                    stroke={`hsl(${index * 36}, 70%, 50%)`}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                  />
                )
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default ThemeCharts; 