
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
            
            # Add Admin Permissions if not present
            # We want Admins to be able to Read, Create, Update, Delete everything
            # Note: Appwrite permissions are strings in the API response, but list of Permission objects for update?
            # Actually update_collection expects strict Permission objects or strings? The SDK expects strings usually for the list.
            # Let's inspect 'current_permissions'. It is a list of strings like 'read("any")', 'write("user:123")'.
            
            updates = []
            # We'll just append our new ones. Appwrite dedups.
            new_perms = [
                Permission.read(Role.label("admin")),
                Permission.create(Role.label("admin")),
                Permission.update(Role.label("admin")),
                Permission.delete(Role.label("admin")),
            ]
            
            # Convert existing to prompt format if needed, but update_collection takes specific args.
            # wait, databases.update_collection(..., permissions=[...]) replaces them!
            # So we must merge.
            
            # Parse existing strings back to inputs? No, we can pass strings.
            # The SDK handles strings.
            
            final_permissions = list(current_permissions)
            
            # Simple check to avoid adding duplicates if running multiple times (though Appwrite handles it, safer to check)
            # Actually, let's just add the strings manually.
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
