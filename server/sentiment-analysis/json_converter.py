# Import required libraries
import json
from datetime import datetime
import os

class JsonConverter:
    """
    A class to convert MongoDB-style JSON data into a format compatible with the Flask server.
    This converter handles MongoDB-specific data types like ObjectId and Date objects.
    """
    
    def __init__(self, input_file, output_file):
        """
        Initialize the converter with input and output file paths.
        
        Args:
            input_file (str): Path to the MongoDB-style JSON input file
            output_file (str): Path where the formatted JSON will be saved
        """
        self.input_file = input_file
        self.output_file = output_file

    def convert_timestamp(self, timestamp_obj):
        """
        Convert MongoDB timestamp object to ISO format string.
        MongoDB timestamps are stored as objects with '$date' key.
        
        Args:
            timestamp_obj: MongoDB timestamp object or regular timestamp string
            
        Returns:
            str: ISO format timestamp string
        """
        if isinstance(timestamp_obj, dict) and '$date' in timestamp_obj:
            return timestamp_obj['$date']
        return timestamp_obj

    def convert_id(self, id_obj):
        """
        Convert MongoDB ObjectId to string format.
        MongoDB IDs are stored as objects with '$oid' key.
        
        Args:
            id_obj: MongoDB ObjectId object or regular ID string
            
        Returns:
            str: String representation of the ID
        """
        if isinstance(id_obj, dict) and '$oid' in id_obj:
            return id_obj['$oid']
        return str(id_obj)

    def format_for_flask(self, data):
        """
        Format the data for Flask server input.
        Extracts relevant fields and structures them according to Flask server requirements.
        
        Args:
            data (dict): MongoDB document to format
            
        Returns:
            dict: Formatted data ready for Flask server
        """
        formatted_data = {
            'text': data.get('content', ''),  # Main text content for analysis
            'metadata': {
                'platform': data.get('platform', ''),  # Source platform (e.g., Twitter)
                'author': data.get('author', ''),      # Post author
                'timestamp': self.convert_timestamp(data.get('timestamp')),  # Post timestamp
                'post_url': data.get('metadata', {}).get('postUrl', ''),     # Original post URL
                'language': data.get('metadata', {}).get('language', 'en'),  # Content language
                'engagement': data.get('engagement', {})                     # Engagement metrics
            }
        }
        return formatted_data

    def process_file(self):
        """
        Process the input JSON file and save formatted data.
        Handles both single objects and arrays of objects.
        Includes error handling for common file operations.
        """
        try:
            # Read input file
            with open(self.input_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # Convert single object to list for consistent processing
            if isinstance(data, dict):
                data = [data]

            # Format each entry in the data
            formatted_data = []
            for entry in data:
                formatted_entry = self.format_for_flask(entry)
                formatted_data.append(formatted_entry)

            # Save formatted data to output file
            with open(self.output_file, 'w', encoding='utf-8') as f:
                json.dump(formatted_data, f, indent=2)

            print(f"Successfully converted {len(formatted_data)} entries")
            print(f"Output saved to: {self.output_file}")

        except FileNotFoundError:
            print(f"Error: Input file '{self.input_file}' not found")
        except json.JSONDecodeError:
            print(f"Error: Invalid JSON in file '{self.input_file}'")
        except Exception as e:
            print(f"Error processing file: {str(e)}")

def main():
    """
    Main function to demonstrate usage of the JsonConverter class.
    Creates a converter instance and processes the input file.
    """
    # Example usage
    input_file = 'input.json'  # MongoDB-style JSON file
    output_file = 'flask_input.json'  # Formatted output file

    converter = JsonConverter(input_file, output_file)
    converter.process_file()

if __name__ == "__main__":
    main() 