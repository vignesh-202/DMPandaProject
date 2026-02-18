import os
import json
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.query import Query

# This function is triggered by HTTP request from the backend.
# It saves an automation and updates the reply template usage count.
def main(context):
    try:
        payload = context.req.body
        if isinstance(payload, str):
            payload = json.loads(payload)
            
        action = payload.get('action') # 'create', 'update', or 'delete'
        automation_data = payload.get('automation', {})
        old_template_id = payload.get('old_template_id')
        
        client = Client()
        client.set_endpoint(os.environ['APPWRITE_ENDPOINT'])
        client.set_project(os.environ['APPWRITE_PROJECT_ID'])
        client.set_key(os.environ['APPWRITE_API_KEY'])

        databases = Databases(client)
        db_id = os.environ['APPWRITE_DATABASE_ID']
        auto_coll = 'automations'
        tpl_coll = 'templates'

        new_template_id = automation_data.get('template_id')
        automation_id = automation_data.get('$id')

        # 1. Perform database operation
        if action == 'create':
            doc = databases.create_document(db_id, auto_coll, 'unique()', automation_data)
            automation_id = doc['$id']
            # Increment count
            if new_template_id:
                databases.update_document(db_id, tpl_coll, new_template_id, {
                    "automation_count": get_actual_count(databases, db_id, auto_coll, new_template_id)
                })

        elif action == 'update':
            if not automation_id:
                return context.res.json({"error": "Missing automation ID for update"}, 400)
            
            databases.update_document(db_id, auto_coll, automation_id, automation_data)
            
            # Handle count shifts
            if old_template_id and old_template_id != new_template_id:
                # Decrement old
                databases.update_document(db_id, tpl_coll, old_template_id, {
                    "automation_count": get_actual_count(databases, db_id, auto_coll, old_template_id)
                })
            
            if new_template_id:
                # Increment/Update new
                databases.update_document(db_id, tpl_coll, new_template_id, {
                    "automation_count": get_actual_count(databases, db_id, auto_coll, new_template_id)
                })

        elif action == 'delete':
            if not automation_id:
                return context.res.json({"error": "Missing automation ID for delete"}, 400)
            
            databases.delete_document(db_id, auto_coll, automation_id)
            
            # Decrement count
            if new_template_id:
                databases.update_document(db_id, tpl_coll, new_template_id, {
                    "automation_count": get_actual_count(databases, db_id, auto_coll, new_template_id)
                })

        return context.res.json({"status": "success", "automation_id": automation_id})

    except Exception as e:
        context.error(f"Error in automation manager: {str(e)}")
        return context.res.json({"status": "error", "message": str(e)}, 500)

def get_actual_count(databases, db_id, coll_id, template_id):
    result = databases.list_documents(db_id, coll_id, [
        Query.equal('template_id', template_id),
        Query.limit(1)
    ])
    return result.get('total', 0)
