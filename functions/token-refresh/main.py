import os
import requests
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.query import Query

# Scheduled function (every 30 days) to refresh Instagram access tokens.
def main(context):
    try:
        client = Client()
        client.set_endpoint(os.environ['APPWRITE_ENDPOINT'])
        client.set_project(os.environ['APPWRITE_PROJECT_ID'])
        client.set_key(os.environ['APPWRITE_API_KEY'])

        databases = Databases(client)
        db_id = os.environ['APPWRITE_DATABASE_ID']

        # Get all active accounts
        result = databases.list_documents(db_id, 'ig_accounts', queries=[
            Query.equal('is_active', True),
            Query.limit(100)
        ])
        
        accounts = result['documents']
        context.log(f"Found {len(accounts)} active accounts to refresh.")

        refreshed_count = 0
        error_count = 0

        for account in accounts:
            current_token = account.get('access_token')
            doc_id = account.get('$id')
            username = account.get('username')

            if not current_token:
                continue

            # Call Instagram refresh API
            # GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token={token}
            try:
                url = "https://graph.instagram.com/refresh_access_token"
                params = {
                    "grant_type": "ig_refresh_token",
                    "access_token": current_token
                }
                
                response = requests.get(url, params=params)
                data = response.json()

                if response.status_code == 200:
                    new_token = data.get('access_token')
                    # Update DB
                    databases.update_document(db_id, 'ig_accounts', doc_id, {
                        "access_token": new_token
                        # token_expires_at update could be added here if needed, 
                        # but user asked to directly update access_token.
                    })
                    context.log(f"Successfully refreshed token for @{username}")
                    refreshed_count += 1
                else:
                    context.error(f"Failed to refresh token for @{username}: {data.get('error', {}).get('message', 'Unknown error')}")
                    error_count += 1
            except Exception as e:
                context.error(f"Network error refreshing token for @{username}: {str(e)}")
                error_count += 1

        return context.res.json({
            "status": "done",
            "refreshed": refreshed_count,
            "failed": error_count
        })

    except Exception as e:
        context.error(f"Error in token refresh job: {str(e)}")
        return context.res.json({"status": "error", "message": str(e)}, 500)
