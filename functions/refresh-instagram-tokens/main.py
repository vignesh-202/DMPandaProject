import os
import json
import requests
from appwrite.client import Client
from appwrite.query import Query


def _call_appwrite(client, method, path, params=None):
    headers = {"content-type": "application/json"}
    return client.call(method, path=path, headers=headers, params=params or {}, response_type="json")


def _list_documents(client, db_id, collection_id, queries=None):
    return _call_appwrite(
        client,
        "get",
        f"/databases/{db_id}/collections/{collection_id}/documents",
        {"queries": list(queries or [])},
    )


def _update_document(client, db_id, collection_id, document_id, data):
    return _call_appwrite(
        client,
        "patch",
        f"/databases/{db_id}/collections/{collection_id}/documents/{document_id}",
        {"data": data},
    )

# Scheduled function (every 30 days) to refresh Instagram access tokens.
def main(context):
    try:
        raw_body = getattr(getattr(context, "req", None), "body", None)
        if isinstance(raw_body, dict):
            request_body = raw_body
        else:
            try:
                request_body = json.loads(str(raw_body or "{}"))
            except Exception:
                request_body = {}
        dry_run = request_body.get("dry_run") is True

        client = Client()
        client.set_endpoint(os.environ['APPWRITE_ENDPOINT'])
        client.set_project(os.environ['APPWRITE_PROJECT_ID'])
        client.set_key(os.environ['APPWRITE_API_KEY'])

        db_id = os.environ['APPWRITE_DATABASE_ID']

        # Get all active accounts
        result = _list_documents(client, db_id, 'ig_accounts', queries=[
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

            if dry_run:
                refreshed_count += 1
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
                    expires_in = data.get('expires_in')
                    token_expires_at = None
                    try:
                        if expires_in is not None:
                            from datetime import datetime, timedelta, timezone
                            token_expires_at = (datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))).isoformat().replace("+00:00", "Z")
                    except Exception:
                        token_expires_at = None
                    # Update DB
                    _update_document(client, db_id, 'ig_accounts', doc_id, {
                        "access_token": new_token,
                        **({"token_expires_at": token_expires_at} if token_expires_at else {})
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
            "dry_run": dry_run,
            "scanned": len(accounts),
            "refreshed": refreshed_count,
            "failed": error_count
        })

    except Exception as e:
        context.error(f"Error in token refresh job: {str(e)}")
        return context.res.json({"status": "error", "message": str(e)}, 500)
