# mongo_connector.py
from pymongo import MongoClient
from dotenv import load_dotenv
import os

# Load environment variables from .env
load_dotenv()

def get_mongo_collection():
    MONGO_URI = os.getenv("MONGO_URI")
    DB_NAME = os.getenv("DB_NAME", "test")  # Default to "test" if not specified
    if not MONGO_URI:
        raise ValueError("Missing MONGO_URI in .env file")
    
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    return db["posts"]

if __name__ == "__main__":
    collection = get_mongo_collection()
    print("Connected to collection:", collection.name)
