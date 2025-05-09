import unittest
from combined_analyzer import CombinedAnalyzer

class TestPreprocessing(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.analyzer = CombinedAnalyzer()

    def test_basic_preprocessing(self):
        """Test basic text preprocessing"""
        text = "Test preprocessing of Agricultural text"
        result = self.analyzer.preprocess_text(text)
        self.assertIn("processed_text", result)
        self.assertIsInstance(result["processed_text"], str)
        self.assertTrue(result["processed_text"].islower())

    def test_special_characters(self):
        """Test handling of special characters"""
        text = "Test!@#$%^&*() preprocessing"
        result = self.analyzer.preprocess_text(text)
        self.assertNotIn("!", result["processed_text"])
        self.assertNotIn("@", result["processed_text"])

    def test_preserve_negations(self):
        """Test preservation of negation words in text"""
        # Test 'no'
        text1 = "There is no disease in the field"
        result1 = self.analyzer.preprocess_text(text1)
        processed_text1 = result1["processed_text"]
        self.assertIn("no", processed_text1.split(),
                     f"Word 'no' should be preserved in: {text1}")
        
        # Test 'not'
        text2 = "The crops are not infected"
        result2 = self.analyzer.preprocess_text(text2)
        processed_text2 = result2["processed_text"]
        self.assertIn("not", processed_text2.split(),
                     f"Word 'not' should be preserved in: {text2}")

    def test_preserve_evaluative_words(self):
        """Test preservation of evaluative words in text"""
        # Test positive evaluative words
        text1 = "The crops are looking good and getting better"
        result1 = self.analyzer.preprocess_text(text1)
        processed_text1 = result1["processed_text"]
        self.assertIn("good", processed_text1.split(),
                     f"Word 'good' should be preserved in: {text1}")
        self.assertIn("better", processed_text1.split(),
                     f"Word 'better' should be preserved in: {text1}")
        
        # Test negative evaluative words
        text2 = "The situation is bad and getting worse"
        result2 = self.analyzer.preprocess_text(text2)
        processed_text2 = result2["processed_text"]
        self.assertIn("bad", processed_text2.split(),
                     f"Word 'bad' should be preserved in: {text2}")
        self.assertIn("worse", processed_text2.split(),
                     f"Word 'worse' should be preserved in: {text2}")
        
        # Test other evaluative words
        text3 = "The crops are doing well and are the best in the region"
        result3 = self.analyzer.preprocess_text(text3)
        processed_text3 = result3["processed_text"]
        self.assertIn("well", processed_text3.split(),
                     f"Word 'well' should be preserved in: {text3}")
        self.assertIn("best", processed_text3.split(),
                     f"Word 'best' should be preserved in: {text3}")

    def test_preserve_agricultural_evaluative_words(self):
        """Test preservation of agricultural-specific evaluative words"""
        # Test positive agricultural terms
        text1 = "The crops are healthy and thriving in the field"
        result1 = self.analyzer.preprocess_text(text1)
        processed_text1 = result1["processed_text"]
        self.assertIn("healthy", processed_text1.split(),
                     f"Word 'healthy' should be preserved in: {text1}")
        self.assertIn("thriving", processed_text1.split(),
                     f"Word 'thriving' should be preserved in: {text1}")
        
        # Test negative agricultural terms
        text2 = "The plants are unhealthy and showing signs of disease"
        result2 = self.analyzer.preprocess_text(text2)
        processed_text2 = result2["processed_text"]
        self.assertIn("unhealthy", processed_text2.split(),
                     f"Word 'unhealthy' should be preserved in: {text2}")
        self.assertIn("disease", processed_text2.split(),
                     f"Word 'disease' should be preserved in: {text2}")
        
        # Test comparative and intensity words
        text3 = "The yield is very high and more productive than last year"
        result3 = self.analyzer.preprocess_text(text3)
        processed_text3 = result3["processed_text"]
        self.assertIn("very", processed_text3.split(),
                     f"Word 'very' should be preserved in: {text3}")
        self.assertIn("more", processed_text3.split(),
                     f"Word 'more' should be preserved in: {text3}")
        
        # Test temporal and quality indicators
        text4 = "The crop is improving and showing excellent growth"
        result4 = self.analyzer.preprocess_text(text4)
        processed_text4 = result4["processed_text"]
        self.assertIn("improving", processed_text4.split(),
                     f"Word 'improving' should be preserved in: {text4}")
        self.assertIn("excellent", processed_text4.split(),
                     f"Word 'excellent' should be preserved in: {text4}")

if __name__ == '__main__':
    unittest.main() 