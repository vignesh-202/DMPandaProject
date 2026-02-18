import os
import json
import datetime
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.permission import Permission
from appwrite.role import Role

# This function is triggered by users.*.create event in Appwrite.
# It creates a corresponding document in both 'users' and 'profiles' collections.
def main(context):
    try:
        # Appwrite sends the event payload as JSON in the request body.
        # In most runtimes this is a string, so normalize to a dict.
        raw_body = getattr(context.req, "body", None)
        if isinstance(raw_body, dict):
            user = raw_body
        else:
            try:
                user = json.loads(raw_body or "{}")
            except Exception:
                context.error(f"on-user-create: Failed to parse request body: {raw_body!r}")
                return context.res.json(
                    {"status": "error", "message": "Invalid event payload received."},
                    400,
                )

        user_id = user.get("$id")
        user_name = user.get("name", "")
        user_email = user.get("email", "")

        if not user_id:
            context.error(f"on-user-create: Missing user id in payload: {user}")
            return context.res.json(
                {"status": "error", "message": "Missing user id in event payload."},
                400,
            )

        context.log(f"New user created event received for userId: {user_id}")

        client = Client()
        client.set_endpoint(os.environ["APPWRITE_FUNCTION_ENDPOINT"])
        client.set_project(os.environ["APPWRITE_FUNCTION_PROJECT_ID"])
        client.set_key(os.environ["APPWRITE_API_KEY"])

        databases = Databases(client)
        db_id = os.environ["APPWRITE_DATABASE_ID"]

        users_collection_id = "users"
        profiles_collection_id = "profiles"

        # 1. Create Users document (idempotent)
        try:
            databases.get_document(db_id, users_collection_id, user_id)
            context.log(f"User document already exists for userId: {user_id}")
        except Exception:
            context.log(f"Creating user document for userId: {user_id}")
            now = datetime.datetime.now(datetime.timezone.utc).isoformat()
            databases.create_document(
                database_id=db_id,
                collection_id=users_collection_id,
                document_id=user_id,
                data={
                    "name": user_name,
                    "email": user_email,
                    "first_login": now,
                    "last_login": now,
                    "status": "active",
                },
                permissions=[
                    Permission.read(Role.user(user_id)),
                    Permission.update(Role.user(user_id)),
                ],
            )

        # 2. Create Profiles document (idempotent)
        try:
            databases.get_document(db_id, profiles_collection_id, user_id)
            context.log(f"Profile document already exists for userId: {user_id}")
        except Exception:
            context.log(f"Creating profile document for userId: {user_id}")
            databases.create_document(
                database_id=db_id,
                collection_id=profiles_collection_id,
                document_id=user_id,
                data={
                    "user_id": user_id,
                    "credits": 10,  # Give 10 credits by default
                    "tier": "free",
                },
                permissions=[
                    Permission.read(Role.user(user_id)),
                    Permission.update(Role.user(user_id)),
                ],
            )

        context.log(f"Successfully processed user and profile creation for {user_id}")
        return context.res.json({"status": "success", "user_id": user_id})

    except Exception as e:
        context.error(f"Error in on-user-create function: {str(e)}")
        return context.res.json({"status": "error", "message": str(e)}, 500)
