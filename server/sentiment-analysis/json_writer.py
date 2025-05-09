import json
from datetime import datetime
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AnalysisJSONWriter:
    def __init__(self):
        self.output_path = os.path.join(os.path.dirname(__file__), 'sentiment_analysis_results.json')
        self.results = []
        
        # Load existing results if file exists
        if os.path.exists(self.output_path):
            logger.info(f"Loading existing results from: {self.output_path}")
            try:
                with open(self.output_path, 'r', encoding='utf-8') as jsonfile:
                    data = json.load(jsonfile)
                    # Ensure we have a list of results
                    self.results = data if isinstance(data, list) else []
                logger.info(f"Loaded {len(self.results)} existing results")
            except Exception as e:
                logger.error(f"Error loading existing results: {str(e)}")
                self.results = []

    def save_analysis(self, text, analysis_result):
        """Save a single analysis result to JSON file"""
        try:
            # Re-check file for duplicates before saving
            if os.path.exists(self.output_path):
                try:
                    with open(self.output_path, 'r', encoding='utf-8') as jsonfile:
                        existing_data = json.load(jsonfile)
                        # Check for duplicate text in existing data
                        for result in existing_data:
                            if result['text'] == text:
                                logger.info(f"Skipping duplicate text: {text[:100]}...")
                                return True
                except Exception as e:
                    logger.error(f"Error checking for duplicates: {str(e)}")

            # Prepare the record with formatted timestamp
            current_time = datetime.now()
            formatted_time = current_time.strftime("%Y-%m-%d %H:%M:%S")
            
            record = {
                'timestamp': formatted_time,
                'text': text,
                'processed_text': analysis_result.get('processed_text', ''),
                'categories': analysis_result.get('categories', {}),
                'sentiment': analysis_result.get('sentiment', {}),
                'entities': analysis_result.get('entities', [])
            }

            # Add to results list
            self.results.append(record)

            # Save all results to file
            with open(self.output_path, 'w', encoding='utf-8') as jsonfile:
                json.dump(self.results, jsonfile, indent=2, ensure_ascii=False)

            logger.info(f"Successfully saved analysis to: {self.output_path}")
            return True
        except Exception as e:
            logger.error(f"Error saving analysis to JSON: {str(e)}")
            return False

    def get_total_entries(self):
        """Get the total number of entries in the JSON file"""
        return len(self.results)

    def get_latest_analysis(self):
        """Get the most recent analysis result"""
        if not self.results:
            return None
        return self.results[-1]

    def get_analyses_by_date_range(self, start_date, end_date):
        """Get all analyses within a date range"""
        start = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date)
        return [
            result for result in self.results
            if start <= datetime.fromisoformat(result['timestamp']) <= end
        ] 