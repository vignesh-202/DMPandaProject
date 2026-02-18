import os
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.permission import Permission
from appwrite.role import Role
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

COLLECTIONS = [
    "users",
    "campaigns",
    "settings",
    "ig_accounts",
    "pricing",
    "affiliate_profiles",
    "referrals",
    "payouts"
]

def add_admin_permissions():
    print("Updating collection permissions for Admin access...")
    
    for collection_id in COLLECTIONS:
        try:
            # Fetch current collection to get existing permissions
            collection = databases.get_collection(APPWRITE_DATABASE_ID, collection_id)
            current_permissions = collection['$permissions']
            
            updates = []
            
            final_permissions = list(current_permissions)
            
            admin_label = 'label:admin'
            
            required_perms = [
                f'read("{admin_label}")',
                f'create("{admin_label}")',
                f'update("{admin_label}")',
                f'delete("{admin_label}")'
            ]
            
            changed = False
            for p in required_perms:
                if p not in final_permissions:
                    final_permissions.append(p)
                    changed = True
            
            if changed:
                databases.update_collection(
                    database_id=APPWRITE_DATABASE_ID,
                    collection_id=collection_id,
                    name=collection['name'],
                    permissions=final_permissions
                )
                print(f"Updated permissions for '{collection['name']}' ({collection_id}).")
            else:
                print(f"Permissions for '{collection['name']}' ({collection_id}) already up to date.")

        except Exception as e:
            print(f"Error processing collection '{collection_id}': {e}")

if __name__ == "__main__":
    add_admin_permissions()
