import os
import json
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.query import Query

# Handle Instagram account unlink (soft delete) and delete (hard delete with cascade).
def main(context):
    try:
        payload = context.req.body
        if isinstance(payload, str):
            payload = json.loads(payload)
            
        action = payload.get('action') # 'unlink' or 'delete'
        account_doc_id = payload.get('account_doc_id') # The Appwrite document ID
        
        if not account_doc_id:
            return context.res.json({"error": "Missing account_doc_id"}, 400)

        client = Client()
        client.set_endpoint(os.environ['APPWRITE_ENDPOINT'])
        client.set_project(os.environ['APPWRITE_PROJECT_ID'])
        client.set_key(os.environ['APPWRITE_API_KEY'])

        databases = Databases(client)
        db_id = os.environ['APPWRITE_DATABASE_ID']

        # Get account details first
        account = databases.get_document(db_id, 'ig_accounts', account_doc_id)
        ig_user_id = account.get('ig_user_id')

        if action == 'unlink':
            # Soft delete: set is_active to false
            databases.update_document(db_id, 'ig_accounts', account_doc_id, {"is_active": False})
            context.log(f"Account unlinked: {account_doc_id}")
            return context.res.json({"status": "success", "message": "Account unlinked"})

        elif action == 'delete':
            # Hard delete: cascade delete from all tables using account_id (ig_user_id)
            collections_to_clean = [
                'automations',
                'keywords',
                'analytics',
                'convo_starters',
                'inbox_menus',
                'super_profiles'
            ]
            
            for coll in collections_to_clean:
                # Find all documents for this account
                # Note: Some collections might use 'account_id' instead of 'ig_user_id'
                # but in DM Panda schema, ig_user_id is often stored in 'account_id' attribute.
                docs = databases.list_documents(db_id, coll, queries=[
                    Query.equal('account_id', ig_user_id),
                    Query.limit(100)
                ])
                
                for doc in docs['documents']:
                    databases.delete_document(db_id, coll, doc['$id'])
                
                context.log(f"Cleaned up {docs['total']} documents from {coll}")

            # Finally delete the account record
            databases.delete_document(db_id, 'ig_accounts', account_doc_id)
            context.log(f"Account deleted: {account_doc_id}")
            
            return context.res.json({"status": "success", "message": "Account and all data deleted"})

        return context.res.json({"error": "Invalid action"}, 400)

    except Exception as e:
        context.error(f"Error in account action: {str(e)}")
        return context.res.json({"status": "error", "message": str(e)}, 500)
