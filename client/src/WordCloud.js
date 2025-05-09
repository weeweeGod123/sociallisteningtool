import React from 'react';
import ReactWordcloud from 'react-wordcloud';

const WordCloud = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="no-data">No data available for word cloud</div>;
  }

  const options = {
    colors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b'],
    enableTooltip: true,
    deterministic: true,
    fontFamily: 'impact',
    fontSizes: [20, 60],
    fontStyle: 'normal',
    fontWeight: 'normal',
    padding: 1,
    rotations: 3,
    rotationAngles: [0, 90],
    scale: 'sqrt',
    spiral: 'archimedean',
    transitionDuration: 1000
  };

  return (
    <div style={{ width: '100%', height: '300px' }}>
      <ReactWordcloud 
        words={data} 
        options={options}
      />
    </div>
  );
};

export default WordCloud; 