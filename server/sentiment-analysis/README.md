# Sentiment Analysis Service

A Flask-based service for analyzing agricultural text data using natural language processing and sentiment analysis.

## Features

- Text analysis with agricultural domain focus
- Sentiment analysis using RoBERTa model
- Entity extraction for agricultural terms
- Text categorization
- JSON-based result storage
- RESTful API endpoints

## Project Structure

```
sentiment-analysis/
├── flask_server.py          # Main Flask application
├── combined_analyzer.py     # Text analysis implementation
├── json_writer.py          # JSON file handling
├── requirements.txt        # Python dependencies
├── sentiment_analysis_results.json  # Analysis results storage
├── preprocessing/          # Training data and categories
│   ├── categories_data.json
│   ├── output.json
│   └── roberta_sentiment_keywords.json
├── tests/                 # Test files
└── venv/                  # Python virtual environment
```

## Setup

1. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Setup the Model
```bash
python tuning_script.py
```

4. Run the Flask server:
```bash
python flask_server.py
```

The server will start on `http://localhost:5000`

## API Endpoints

### 1. Health Check
```
GET http://localhost:5000/health
```
Returns the health status of the service.

### 2. Analyze Text
```
POST http://localhost:5000/analyze
Content-Type: application/json

{
    "text": "The wheat field is showing signs of rust disease."
}
```
Performs comprehensive text analysis including:
- Text preprocessing
- Sentiment analysis
- Entity extraction
- Category classification

### 3. Analyze Batch
```
POST http://localhost:5000/analyze/batch
Content-Type: application/json

{
    "texts": [
        "The wheat field is showing signs of rust disease.",
        "The barley crop is healthy and growing well.",
        "There's a pest infestation in the corn field."
    ]
}
```
Analyzes multiple texts in a single request.

### 4. Analyze Sentiment
```
POST http://localhost:5000/analyze/sentiment
Content-Type: application/json

{
    "text": "The wheat field is showing signs of rust disease."
}
```
Returns sentiment analysis scores:
- Positive
- Negative
- Neutral
- Compound

### 5. Extract Entities
```
POST http://localhost:5000/analyze/entities
Content-Type: application/json

{
    "text": "The wheat field is showing signs of rust disease."
}
```
Returns extracted entities with their labels and positions.

## Analysis Results

All analysis results are saved to `sentiment_analysis_results.json` in the following format:
```json
{
    "timestamp": "2024-03-29T12:34:56.789",
    "text": "Original text",
    "categories": {
        "categories": {
            "disease": 0.8,
            "pest": 0.2,
            "nutrition": 0.1,
            "general": 0.1
        },
        "top_category": "disease"
    },
    "sentiment": {
        "compound": -0.53041,
        "negative": 0.53041,
        "neutral": 0.46959,
        "neutral_leaning": {
            "direction": "negative",
            "percentage": 53
        },
        "positive": 0.0,
        "sentiment": "Negative"
    },
    "entities": [
        {
            "text": "wheat",
            "label": "CROP",
            "start": 4,
            "end": 9
        }
    ]
}
```

## Dependencies

- accelerate>=0.26.0
- datasets>=2.0.0 
- evaluate >= 0.4.0
- flask>=2.0.1
- flask-cors>=4.0.0
- spacy>=3.0.0
- scikit-learn>=1.0.0
- werkzeug>=2.0.0
- torch>=1.10.0
- transformers>=4.12.0
- numpy>=1.19.0
- tqdm>=4.65.0

## Testing

Run tests using:
```bash
python -m pytest tests/
``` 