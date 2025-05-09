import unittest
import sys
import os

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from combined_analyzer import CombinedAnalyzer
import json

class TestCombinedAnalyzer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Set up test fixtures that will be used for all tests"""
        cls.analyzer = CombinedAnalyzer()

    def test_initialization(self):
        """Test analyzer initialization"""
        self.assertIsNotNone(self.analyzer.nlp)
        self.assertIsNotNone(self.analyzer.matcher)
        self.assertIsNotNone(self.analyzer.roberta_model)
        self.assertIsNotNone(self.analyzer.roberta_tokenizer)

    def test_preprocessing(self):
        """Test text preprocessing"""
        test_text = "Wheat plants showing severe rust infection"
        result = self.analyzer.preprocess_text(test_text)
        
        self.assertIn("processed_text", result)
        self.assertIn("agricultural_terms", result)
        self.assertIn("doc", result)
        
        # Check if agricultural terms are detected
        found_terms = [term["text"].lower() for term in result["agricultural_terms"]]
        self.assertIn("wheat", found_terms)
        self.assertIn("rust", found_terms)

    def test_entity_extraction(self):
        """Test entity extraction"""
        test_text = "Wheat plants showing severe rust infection"
        entities = self.analyzer.extract_entities(test_text)
        
        self.assertIsInstance(entities, list)
        found_entities = [entity["text"].lower() for entity in entities]
        self.assertIn("wheat", found_entities)
        self.assertIn("rust", found_entities)

    def test_sentiment_analysis(self):
        """Test sentiment analysis"""
        test_text = "Wheat plants showing severe rust infection"
        sentiment = self.analyzer.sentiment_analysis(test_text)
        
        self.assertIn("positive", sentiment)
        self.assertIn("negative", sentiment)
        self.assertIn("neutral", sentiment)
        self.assertIn("compound", sentiment)
        self.assertIn("sentiment", sentiment)
        self.assertIn("neutral_leaning", sentiment)

    def test_error_handling(self):
        """Test error handling and edge cases"""
        # Test empty text
        result = self.analyzer.analyze_text("")
        self.assertIn("agricultural_terms", result)
        self.assertIn("sentiment", result)
        
        # Test None input
        result = self.analyzer.analyze_text(None)
        self.assertIn("agricultural_terms", result)
        self.assertIn("sentiment", result)
        
        # Test very long text (should be truncated)
        long_text = "wheat " * 100
        result = self.analyzer.analyze_text(long_text)
        self.assertIn("agricultural_terms", result)
        self.assertIn("sentiment", result)

    def test_agricultural_terms(self):
        """Test agricultural term detection"""
        test_text = "Wheat plants showing severe rust infection"
        result = self.analyzer.analyze_text(test_text)
        
        self.assertIn("agricultural_terms", result)
        found_terms = [term["text"].lower() for term in result["agricultural_terms"]]
        self.assertIn("wheat", found_terms)
        self.assertIn("rust", found_terms)

    def test_analyze_text(self):
        """Test complete text analysis"""
        test_text = "Wheat plants showing severe rust infection"
        result = self.analyzer.analyze_text(test_text)
        
        # Check all required fields are present
        self.assertIn("processed_text", result)
        self.assertIn("agricultural_terms", result)
        self.assertIn("sentiment", result)
        
        # Check content
        self.assertIn("wheat", result["processed_text"].lower())
        self.assertIn("rust", result["processed_text"].lower())
        
        # Check detected terms
        found_terms = [term["text"].lower() for term in result["agricultural_terms"]]
        self.assertIn("wheat", found_terms)
        self.assertIn("rust", found_terms)

if __name__ == '__main__':
    unittest.main() 