import unittest
import json
from flask import Flask
import sys
import os
import requests

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from flask_server import app

class TestFlaskApp(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Set up test fixtures that will be used for all tests"""
        cls.app = app.test_client()
        cls.app.testing = True

    def test_health_check(self):
        """Test the health check endpoint"""
        response = self.app.get('/health')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'healthy')

    def test_analyze_text_endpoint(self):
        """Test the text analysis endpoint"""
        test_text = "Wheat plants showing severe rust infection"
        response = self.app.post('/analyze',
                               json={'text': test_text},
                               content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        # Check for required fields
        self.assertIn('processed_text', data)
        self.assertIn('agricultural_terms', data)
        self.assertIn('sentiment', data)
        
        # Check detected terms
        found_terms = [term["text"].lower() for term in data["agricultural_terms"]]
        self.assertIn("wheat", found_terms)
        self.assertIn("rust", found_terms)

    def test_error_handling(self):
        """Test error handling in the API"""
        # Test with missing text
        response = self.app.post('/analyze',
                               json={},
                               content_type='application/json')
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('error', data)

    def test_large_text_handling(self):
        """Test handling of large text inputs"""
        # Create a large text input
        large_text = "wheat " * 100
        response = self.app.post('/analyze',
                               json={'text': large_text},
                               content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('agricultural_terms', data)
        self.assertIn('sentiment', data)

    def test_special_characters(self):
        """Test handling of special characters"""
        test_text = "Wheat plants!@#$%^&*() with rust infection"
        response = self.app.post('/analyze',
                               json={'text': test_text},
                               content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        found_terms = [term["text"].lower() for term in data["agricultural_terms"]]
        self.assertIn("wheat", found_terms)
        self.assertIn("rust", found_terms)

    def test_batch_analysis(self):
        """Test batch text analysis endpoint"""
        test_texts = ["Wheat with rust", "Healthy barley field"]
        response = self.app.post('/analyze/batch',
                               json={'texts': test_texts},
                               content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(len(data), 2)
        
        # Check first result
        self.assertIn('agricultural_terms', data[0])
        self.assertIn('sentiment', data[0])
        
        # Check second result
        self.assertIn('agricultural_terms', data[1])
        self.assertIn('sentiment', data[1])

if __name__ == '__main__':
    unittest.main() 