# Bluesky API & Scraper

This module provides a robust Python-based scraper for collecting public posts from the Bluesky social network, with a Node.js Express API wrapper for easy integration into full-stack applications.

---

## Features

- **Fetches public posts from Bluesky** using the official API.
- **Supports search queries** (keywords, phrases; logical operators are stripped automatically).
- **Handles authentication tokens** securely and automatically refreshes them as needed.
- **Saves results to CSV** with detailed post metadata.
- **Batch fetching** with configurable pause intervals to avoid rate limits.
- **Saves posts to MongoDB** (`social-listening.bluesky_posts`) in batches as they are scraped.
- **Real-time progress logging** for transparency and debugging.
- **API-ready:** Can be triggered via HTTP POST from a Node.js Express server.

---

## Folder Structure

```
bluesky_api/           # Node.js Express API server
  ├── server.js        # API server code
  ├── package.json     # API dependencies
  ├── README.md        # This file
bluesky_scraper/       # Python scraper
  ├── main.py          # Main Python scraper script
  ├── requirements.txt # Python dependencies for the scraper
  ├── bsky_tokens.json # Stores authentication tokens (auto-generated)
  ├── output/          # Output CSV files (auto-generated)
```

---

## How to Run

### 1. **Backend API Usage (Recommended for Full-Stack Integration)**

#### **Start the API Server**
From the `server/bluesky_api` directory:
```sh
npm install
npm start
```
- The API server will run on the port specified by `BLUESKY_PORT` in your `.env` (default: 5003).
- The API server will call the Python scraper in `../bluesky_scraper/main.py`.

#### **API Endpoints**
- `POST /api/bluesky/search`  
  Start a search.  
  **Body:** `{ "query": "Australia agriculture", "maxPosts": 500 }`
- `GET /api/bluesky/status?search_id=...`  
  Check search progress.
- `GET /api/bluesky/results?search_id=...`  
  Download the results CSV.

---

### 2. **Standalone Python Scraper Usage**

#### **Requirements**
- Python 3.8+
- Install dependencies:
  ```sh
  pip install -r requirements.txt
  ```
  (from the `server/bluesky_scraper` directory)

#### **.env Setup**
Create a `.env` file in the parent `server/` directory with:
```
BLUESKY_IDENTIFIER=your_bsky_username
BLUESKY_APP_PASSWORD=your_bsky_app_password
MONGO_URI=your_mongodb_connection_string
```

#### **Run the Scraper**
```sh
python3 main.py --query "Australia agriculture" --max-posts 500 --csv-file output/results.csv
```
- `--query`: Search keywords (logical operators will be removed automatically)
- `--max-posts`: Maximum number of posts to fetch (default: 1000)
- `--csv-file`: Output CSV file path (default: `bluesky_api_posts.csv`)

---

### 3. **Frontend Integration**

- The React frontend (see `client/src/AdvancedSearch.js`) can trigger Bluesky searches via the API.
- API status and results are polled and displayed in the dashboard, just like for Twitter and Reddit.

---

## MongoDB Integration

- Posts are saved in batches to the `social-listening` database, `bluesky_posts` collection.
- MongoDB connection is configured via `MONGO_URI` in your `.env`.
- If MongoDB is not configured, posts are only saved to CSV.

---

## Notes

- **Authentication tokens** are cached in `bsky_tokens.json` for seamless repeated use.
- **Query preprocessing:** Logical operators (`AND`, `OR`, `AND NOT`) are stripped before searching, as Bluesky API does not support them.
- **Logs:** Real-time progress and errors are printed to the terminal when running via the API server.

---

## Troubleshooting

- Ensure your `.env` file is correctly set up with valid Bluesky credentials and MongoDB URI.
- If you see port conflicts, check that no other service is using the same port as your API server.
- For more verbose logs, run the API server directly in your terminal.

---

## License

MIT License 