import React from 'react';
import './SentimentBar.css';

const SentimentBar = ({ sentiment }) => {
  // Convert sentiment to a numerical value between -1 and 1
  const getSentimentValue = (sentimentText) => {
    switch (sentimentText) {
      case 'Negative':
        return -1;
      case 'Slightly Negative':
        return -0.5;
      case 'Neutral':
        return 0;
      case 'Slightly Positive':
        return 0.5;
      case 'Positive':
        return 1;
      default:
        return 0;
    }
  };

  const sentimentValue = getSentimentValue(sentiment);
  const position = ((sentimentValue + 1) / 2) * 100; // Convert to percentage (0-100)

  return (
    <div className="sentiment-bar-container">
      <div className="sentiment-bar">
        <div className="sentiment-gradient"></div>
        <div 
          className="sentiment-marker"
          style={{ left: `${position}%` }}
        ></div>
      </div>
      <div className="sentiment-labels">
        <span className="negative-label">Negative</span>
        <span className="neutral-label">Neutral</span>
        <span className="positive-label">Positive</span>
      </div>
      <div className="current-sentiment">
        {sentiment || 'No sentiment'}
      </div>
    </div>
  );
};

export default SentimentBar; 