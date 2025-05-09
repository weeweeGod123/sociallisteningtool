# Social Listening Application

This application allows you to collect and analyze social media data from multiple platforms including Twitter and Reddit.

## Environment Setup

1. Copy the `.env.example` file to create your own `.env` file:
   ```
   cp server/.env.example server/.env
   ```

2. Edit the `.env` file and add your API credentials:
   - For Reddit: Add your Reddit API client ID and secret
   - For Twitter: Add your Twitter API credentials
   - Update other settings as needed

3. Keep your `.env` file private - it's already in the `.gitignore` file to prevent accidentally committing your credentials.

## Installation and Running

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Install dependencies:
   ```
   cd 2025-group-21-social-listening
   npm install
   cd client
   npm install
   cd ../server
   npm install
   ```

3. Set up environment variables as described above

4. Start the application:
   ```
   npm run dev
   ```

## Features

- Multi-platform social media data collection
- Advanced search with boolean operators (AND, OR, NOT)
- Real-time data analysis and visualization
- Sentiment analysis of social media content
- Custom flash notification system for user feedback
  - Supports both temporary and persistent messages
  - Visual indicators for message importance
  - Accessible design with appropriate ARIA attributes
- Complete account management including secure account deletion

## Project Structure

- `client/`: Frontend React application
- `server/`: Backend Node.js API server
- `server/twitter_scraper/`: Twitter data collection module
- `server/reddit_scraper/`: Reddit data collection module
- `server/sentiment-analysis/`: Text analysis components
