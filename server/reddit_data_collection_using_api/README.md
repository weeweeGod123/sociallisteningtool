# Social Listening Web Scraper - Server

This is the server-side component of the Social Listening Web Scraper application. It provides API endpoints to fetch data from Reddit's API based on user queries.

## Features

- RESTful API for searching Reddit content
- Rate limiting to comply with Reddit API guidelines
- Environment-based configuration
- Comprehensive test suite

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v14 or later)
- npm (comes with Node.js)
- A Reddit developer account with API credentials

## Setup

1. Clone the repository and navigate to the server directory:
   ```bash
   git clone https://jimhie-admin@bitbucket.org/curtincomputingprojects/2025-group-21-social-listening.git
   cd social-listening/server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on the example:
   ```bash
   cp .env.example .env
   ```

4. Configure your `.env` file with your Reddit API credentials:
   ```bash
   REDDIT_CLIENT_ID=your_reddit_client_id_here
   REDDIT_CLIENT_SECRET=your_reddit_client_secret_here
   PORT=9000
   NODE_ENV=development
   ```

   To obtain Reddit API credentials:
   1. Visit https://www.reddit.com/prefs/apps
   2. Click "create app" or "create another app"
   3. Fill in the required fields (name, description, etc.)
   4. Select "script" as the application type
   5. For the redirect URI, you can use http://localhost:9000/callback
   6. Submit the form
   7. Get your client ID (the string under "personal use script") and client secret

## Running the Server

### Development Mode

Run the server with hot-reloading:
```bash
npm run dev
```

### Production Mode

Run the server in production mode:
```bash
npm start
```

The server will start on the specified port (default: 9000) and will be accessible at http://localhost:9000.

## API Endpoints

### Search Reddit
- **Endpoint**: `/api/reddit/search`
- **Method**: GET
- **Query Parameters**:
  - `q` (required): Search query
  - `subreddit`: Specific subreddit to search (optional)
  - `sort`: Sort method (optional, default: "relevance")
  - `time`: Time period (optional, default: "all")
  - `limit`: Number of results (optional, default: 25)

Example request:
```
GET http://localhost:9000/api/reddit/search?q=artificial%20intelligence&subreddit=technology&sort=new&time=month&limit=50
```

## Rate Limiting

The server implements rate limiting to comply with Reddit API guidelines. By default, it allows:
- 600 requests per 10-minute window

You can modify these values in the `.env` file:
```
RATE_LIMIT_WINDOW=600000
MAX_REQUESTS=600
```

## Testing

The project includes several types of tests:

### Running All Tests

```bash
npm test
```

### Running Tests with Coverage

```bash
npm run test:coverage
```

### Running Tests in Watch Mode

```bash
npm run test:watch
```

### Running Specific Tests

```bash
npm test -- -t "test name pattern"
```

## Error Handling

The server includes robust error handling for:
- Invalid requests
- Reddit API errors
- Rate limiting
- Authentication failures


## License
???