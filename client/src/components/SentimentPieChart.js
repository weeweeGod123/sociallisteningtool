import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = {
  'Positive': '#4CAF50',
  'Slightly Positive': '#8BC34A',
  'Neutral': '#9E9E9E',
  'Slightly Negative': '#FF9800',
  'Negative': '#F44336'
};

const SentimentPieChart = ({ data }) => {
  console.log('SentimentPieChart received data:', data);
  
  if (!data || data.length === 0) {
    console.log('No sentiment data available:', { data });
    return <div>No sentiment data available</div>;
  }

  // Log the data being used for the pie chart
  console.log('Rendering pie chart with data:', {
    dataLength: data.length,
    sampleData: data.slice(0, 2),
    availableColors: Object.keys(COLORS)
  });

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="sentiment"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {data.map((entry, index) => {
              console.log('Rendering pie segment:', { sentiment: entry.sentiment, count: entry.count, color: COLORS[entry.sentiment] });
              return (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[entry.sentiment] || '#000000'} 
                />
              );
            })}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SentimentPieChart; 