import pytest
from unittest.mock import patch, MagicMock
from reddit_scraper import RedditScraper
import datetime

@pytest.fixture
def mock_reddit():
    with patch('praw.Reddit') as mock_praw:
        mock_instance = MagicMock()
        mock_praw.return_value = mock_instance
        yield mock_instance

@pytest.fixture
def scraper(mock_reddit):
    return RedditScraper(client_id='id', client_secret='secret', user_agent='agent')

def test_init_success(scraper):
    assert scraper.reddit is not None

def test_scrape_subreddit_success(scraper, mock_reddit):
    mock_subreddit = MagicMock()
    mock_post = MagicMock()
    mock_post.id = 'abc123'
    mock_post.author = 'user1'
    mock_post.title = 'Test Title'
    mock_post.selftext = 'Test Body'
    mock_post.permalink = '/r/test/abc123'
    mock_post.created_utc = 1700000000
    mock_post.score = 10
    mock_post.num_comments = 2
    mock_subreddit.hot.return_value = [mock_post]
    mock_reddit.subreddit.return_value = mock_subreddit
    with patch('reddit_scraper.reddit_scraper.db_collection', None):
        posts = scraper.scrape_subreddit('test', limit=1, sort_by='hot')
    assert len(posts) == 1
    assert posts[0]['post_id'] == 'abc123'

def test_search_subreddit_no_results(scraper, mock_reddit):
    mock_subreddit = MagicMock()
    mock_subreddit.search.return_value = []
    mock_reddit.subreddit.return_value = mock_subreddit
    with patch('reddit_scraper.reddit_scraper.db_collection', None):
        posts = scraper.search_subreddit('test', 'query', limit=1)
    assert posts == []

def test_search_all_reddit_success(scraper, mock_reddit):
    mock_subreddit = MagicMock()
    mock_post = MagicMock()
    mock_post.id = 'abc123'
    mock_post.title = 'Test Title'
    mock_post.score = 5
    mock_post.num_comments = 1
    mock_post.created_utc = 1700000000
    mock_post.url = 'http://reddit.com/abc123'
    mock_post.selftext = 'Body'
    mock_post.author = 'user1'
    mock_post.permalink = '/r/test/abc123'
    mock_post.subreddit = 'test'
    mock_subreddit.search.return_value = [mock_post]
    mock_reddit.subreddit.return_value = mock_subreddit
    with patch('reddit_scraper.reddit_scraper.db_collection', None):
        posts = scraper.search_all_reddit('query', limit=1)
    assert len(posts) == 1
    assert posts[0]['post_id'] == 'abc123'

def test_export_to_csv(tmp_path, scraper):
    data = [{
        'post_id': 'abc', 'username': 'user', 'user_location': '', 'content_text': 'text',
        'url': 'url', 'created_at': datetime.datetime.now(), 'likes': 1, 'comments': 2,
        'platform': 'Reddit', 'topic_classification': 'General', 'collected_at': datetime.datetime.now()
    }]
    file_path = tmp_path / 'test.csv'
    scraper.export_to_csv(data, str(file_path))
    assert file_path.exists()
    content = file_path.read_text()
    assert 'post_id' in content
    assert 'abc' in content

def test_append_to_csv(tmp_path, scraper):
    data = [{
        'post_id': 'abc', 'username': 'user', 'user_location': '', 'content_text': 'text',
        'url': 'url', 'created_at': datetime.datetime.now(), 'likes': 1, 'comments': 2,
        'platform': 'Reddit', 'topic_classification': 'General', 'collected_at': datetime.datetime.now()
    }]
    file_path = tmp_path / 'test.csv'
    # First append (creates file)
    result = scraper.append_to_csv(data, str(file_path))
    assert result is True
    # Second append (appends row)
    result = scraper.append_to_csv(data, str(file_path))
    assert result is True
    content = file_path.read_text()
    assert content.count('abc') == 2

def test_classify_topic(scraper):
    assert scraper.classify_topic('The government announced a new policy') == 'Politics'
    assert scraper.classify_topic('This is about farming and crops') == 'Agriculture'
    assert scraper.classify_topic('Random unrelated text') == 'General'

def test_scrape_subreddit_invalid_sort(scraper, mock_reddit):
    mock_subreddit = MagicMock()
    mock_reddit.subreddit.return_value = mock_subreddit
    with patch('reddit_scraper.reddit_scraper.db_collection', None):
        posts = scraper.scrape_subreddit('test', limit=1, sort_by='invalid')
    assert posts == []

def test_init_invalid_credentials():
    with patch('reddit_scraper.reddit_scraper.praw.Reddit', side_effect=Exception('401 Unauthorized')):
        with pytest.raises(Exception):
            RedditScraper(client_id='bad', client_secret='bad', user_agent='bad') 