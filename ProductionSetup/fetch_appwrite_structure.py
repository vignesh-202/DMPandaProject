import os
import json
from appwrite.client import Client
from appwrite.services.databases import Databases
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

APPWRITE_ENDPOINT = os.getenv("APPWRITE_ENDPOINT")
APPWRITE_PROJECT_ID = os.getenv("APPWRITE_PROJECT_ID")
APPWRITE_API_KEY = os.getenv("APPWRITE_API_KEY")
APPWRITE_DATABASE_ID = os.getenv("APPWRITE_DATABASE_ID")

client = Client()
client.set_endpoint(APPWRITE_ENDPOINT)
client.set_project(APPWRITE_PROJECT_ID)
client.set_key(APPWRITE_API_KEY)

databases = Databases(client)

def get_structure():
    structure = {}
    try:
        collections = databases.list_collections(APPWRITE_DATABASE_ID)
        for col in collections['collections']:
            col_id = col['$id']
            col_name = col['name']
            print(f"Fetching attributes for collection: {col_name} ({col_id})")
            
            # Attributes
            attrs = databases.list_attributes(APPWRITE_DATABASE_ID, col_id)
            
            # Indexes
            idxs = databases.list_indexes(APPWRITE_DATABASE_ID, col_id)
            
            structure[col_id] = {
                'name': col_name,
                'attributes': attrs['attributes'],
                'indexes': idxs['indexes'],
                'permissions': col['$permissions']
            }
        
        with open('appwrite_structure.json', 'w') as f:
            json.dump(structure, f, indent=4)
        print("\nStructure saved to appwrite_structure.json")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    get_structure()
