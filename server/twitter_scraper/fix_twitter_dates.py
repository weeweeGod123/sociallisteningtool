#!/usr/bin/env python3
"""
Utility script to convert Twitter CSV dates to match Reddit's ISO format
"""

import csv
import os
from datetime import datetime
import sys

def convert_twitter_dates(input_file, output_file=None):
    """
    Converts Twitter date formats in CSV to ISO format that matches Reddit
    
    Args:
        input_file (str): Path to input CSV file
        output_file (str, optional): Path to output CSV file. If not provided,
                                     will create a new file with "_fixed" suffix
    
    Returns:
        bool: True if successful, False otherwise
    """
    if not output_file:
        filename, ext = os.path.splitext(input_file)
        output_file = f"{filename}_fixed{ext}"
    
    print(f"Converting dates in {input_file}")
    print(f"Output will be saved to {output_file}")
    
    # Track statistics
    total_rows = 0
    converted_dates = 0
    failed_conversions = 0
    
    try:
        # Read the input CSV
        with open(input_file, 'r', newline='', encoding='utf-8') as infile:
            reader = csv.reader(infile)
            headers = next(reader)  # Get the header row
            
            # Find the index of the date column (usually 'created_at')
            date_col_idx = None
            for i, header in enumerate(headers):
                if header.lower() in ('created_at', 'date', 'timestamp'):
                    date_col_idx = i
                    print(f"Found date column: '{header}' at index {i}")
                    break
            
            if date_col_idx is None:
                print("Error: Could not find a date column in the CSV")
                return False
            
            # Prepare output file
            with open(output_file, 'w', newline='', encoding='utf-8') as outfile:
                writer = csv.writer(outfile)
                writer.writerow(headers)  # Write headers
                
                # Process each row
                for row in reader:
                    total_rows += 1
                    
                    # Skip if row is too short
                    if len(row) <= date_col_idx:
                        writer.writerow(row)
                        continue
                    
                    # Get the date value
                    date_str = row[date_col_idx]
                    if not date_str:
                        writer.writerow(row)
                        continue
                    
                    # Try to convert the date
                    try:
                        # Check if it's already in ISO format
                        if 'T' in date_str and (date_str.endswith('Z') or '+' in date_str):
                            # Already in ISO format, keep as is
                            writer.writerow(row)
                            continue
                        
                        # Try Twitter's format with timezone: "Tue Mar 04 17:35:50 +0000 2025"
                        try:
                            parsed_date = datetime.strptime(date_str, '%a %b %d %H:%M:%S %z %Y')
                            row[date_col_idx] = parsed_date.isoformat()
                            converted_dates += 1
                        except ValueError:
                            # Try without timezone: "Tue Mar 04 17:35:50 2025"
                            try:
                                parsed_date = datetime.strptime(date_str, '%a %b %d %H:%M:%S %Y')
                                row[date_col_idx] = parsed_date.isoformat()
                                converted_dates += 1
                            except ValueError:
                                # If both fail, keep original
                                failed_conversions += 1
                                print(f"Warning: Could not parse date: {date_str}")
                    except Exception as e:
                        failed_conversions += 1
                        print(f"Error processing date '{date_str}': {e}")
                    
                    # Write the row with potentially updated date
                    writer.writerow(row)
        
        # Print summary
        print(f"\nConversion completed:")
        print(f"  Total rows processed: {total_rows}")
        print(f"  Dates successfully converted: {converted_dates}")
        print(f"  Failed conversions: {failed_conversions}")
        
        return True
        
    except Exception as e:
        print(f"Error processing CSV file: {e}")
        return False

if __name__ == "__main__":
    # Get input file from command line or prompt
    if len(sys.argv) >= 2:
        input_file = sys.argv[1]
        output_file = sys.argv[2] if len(sys.argv) >= 3 else None
    else:
        print("Usage: python fix_twitter_dates.py input.csv [output.csv]")
        input_file = input("Enter path to Twitter CSV file: ").strip()
        output_file = input("Enter path for output file (or leave blank for auto-naming): ").strip() or None
    
    if input_file:
        convert_twitter_dates(input_file, output_file) 