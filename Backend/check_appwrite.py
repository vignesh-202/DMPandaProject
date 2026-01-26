import os
from dotenv import load_dotenv
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.exception import AppwriteException

# Load environment variables from .env file
load_dotenv()

# Get Appwrite credentials from environment variables
APPWRITE_ENDPOINT = os.getenv("APPWRITE_ENDPOINT")
APPWRITE_PROJECT_ID = os.getenv("APPWRITE_PROJECT_ID")
APPWRITE_API_KEY = os.getenv("APPWRITE_API_KEY")

def check_appwrite_connection():
    """
    Checks the connection to Appwrite and validates credentials.
    """
    print("--- Starting Appwrite Connection Check ---")

    # 1. Check if all required environment variables are loaded
    if not all([APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY]):
        print("\n[ERROR] Missing one or more required environment variables:")
        if not APPWRITE_ENDPOINT: print("- APPWRITE_ENDPOINT is not set.")
        if not APPWRITE_PROJECT_ID: print("- APPWRITE_PROJECT_ID is not set.")
        if not APPWRITE_API_KEY: print("- APPWRITE_API_KEY is not set.")
        print("\nPlease ensure these are correctly set in your .env file.")
        return

    print(f"\nLoaded Credentials:")
    print(f"  - Endpoint: {APPWRITE_ENDPOINT}")
    print(f"  - Project ID: {APPWRITE_PROJECT_ID}")
    print(f"  - API Key: {'*' * (len(APPWRITE_API_KEY) - 4) + APPWRITE_API_KEY[-4:] if APPWRITE_API_KEY else 'Not Set'}")

    # 2. Initialize the Appwrite client
    try:
        client = Client()
        client.set_endpoint(APPWRITE_ENDPOINT)
        client.set_project(APPWRITE_PROJECT_ID)
        client.set_key(APPWRITE_API_KEY)
        print("\n[SUCCESS] Appwrite client initialized successfully.")
    except Exception as e:
        print(f"\n[FATAL ERROR] Failed to initialize Appwrite client: {e}")
        return

    # 3. Attempt to make an API call (listing databases)
    try:
        databases = Databases(client)
        print("\nAttempting to list databases...")
        db_list = databases.list()
        print(f"\n[SUCCESS] Successfully connected to Appwrite!")
        print(f"Found {db_list['total']} database(s) in project '{APPWRITE_PROJECT_ID}'.")

    except AppwriteException as e:
        print(f"\n[ERROR] An Appwrite API error occurred:")
        print(f"  - Message: {e.message}")
        print(f"  - Code: {e.code}")
        print(f"  - Type: {e.type}")
        print("\nCommon causes for this error:")
        if e.code == 401:
            print("  - The API Key may be incorrect or lack the required permissions (e.g., 'databases.read').")
        elif e.code == 404 and 'project' in e.type:
            print("  - The Project ID is likely incorrect.")
        elif 'Failed to connect' in e.message:
             print("  - The Appwrite Endpoint URL is incorrect or the Appwrite server is not reachable from here.")
        else:
            print("  - Please double-check your Endpoint, Project ID, and API Key.")
            
    except Exception as e:
        print(f"\n[ERROR] A general error occurred: {e}")

    finally:
        print("\n--- Connection Check Finished ---")

if __name__ == "__main__":
    check_appwrite_connection()