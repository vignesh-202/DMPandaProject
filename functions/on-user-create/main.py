import os
from appwrite.client import Client
from appwrite.services.databases import Databases

# This function is triggered by users.*.create event in Appwrite.
# It creates a corresponding profile document in the 'profiles' collection.
def main(context):
    try:
        # The user object is passed in the request body
        user = context.req.body
        user_id = user.get('$id')
        
        context.log(f"New user created: {user_id}")

        client = Client()
        client.set_endpoint(os.environ['APPWRITE_FUNCTION_ENDPOINT'])
        client.set_project(os.environ['APPWRITE_FUNCTION_PROJECT_ID'])
        client.set_key(os.environ['APPWRITE_API_KEY'])

        databases = Databases(client)
        db_id = os.environ['APPWRITE_DATABASE_ID']

        # Create profile document with default values
        # We use the user_id as the document ID for 1:1 mapping
        databases.create_document(
            database_id=db_id,
            collection_id='profiles',
            document_id=user_id,
            data={
                "user_id": user_id,
                "credits": 10, # Give 10 credits by default
                "tier": "free"
            }
        )
        
        context.log(f"Profile created for user {user_id}")
        return context.res.json({"status": "success", "user_id": user_id})

    except Exception as e:
        context.error(f"Error creating profile: {str(e)}")
        return context.res.json({"status": "error", "message": str(e)}, 500)
