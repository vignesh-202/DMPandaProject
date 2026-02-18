import os
from appwrite.client import Client
from appwrite.services.databases import Databases
from dotenv import load_dotenv

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

try:
    accounts = databases.list_documents(
        APPWRITE_DATABASE_ID,
        "ig_accounts"
    )
    for acc in accounts['documents']:
        if not acc.get('status'):
            print(f"Updating account {acc['$id']} to active status...")
            databases.update_document(
                APPWRITE_DATABASE_ID,
                "ig_accounts",
                acc['$id'],
                {'status': 'active'}
            )
    print("Done updating statuses.")
except Exception as e:
    print(f"Error: {e}")
