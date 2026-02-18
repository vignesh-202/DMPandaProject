import os
import time
from pathlib import Path
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.id import ID
from appwrite.client import AppwriteException
from appwrite.permission import Permission
from appwrite.role import Role
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = os.getenv("APPWRITE_ENV_PATH") or str(BASE_DIR / ".env")
load_dotenv(ENV_PATH)

APPWRITE_ENDPOINT = os.getenv("APPWRITE_ENDPOINT")
APPWRITE_PROJECT_ID = os.getenv("APPWRITE_PROJECT_ID")
APPWRITE_API_KEY = os.getenv("APPWRITE_API_KEY")
APPWRITE_DATABASE_ID = os.getenv("APPWRITE_DATABASE_ID")

missing_env = [k for k, v in {
    "APPWRITE_ENDPOINT": APPWRITE_ENDPOINT,
    "APPWRITE_PROJECT_ID": APPWRITE_PROJECT_ID,
    "APPWRITE_API_KEY": APPWRITE_API_KEY,
    "APPWRITE_DATABASE_ID": APPWRITE_DATABASE_ID
}.items() if not v]

if missing_env:
    raise SystemExit(f"Missing required env vars: {', '.join(missing_env)}. "
                     f"Set them in {ENV_PATH} or your environment.")

client = Client()
client.set_endpoint(APPWRITE_ENDPOINT)
client.set_project(APPWRITE_PROJECT_ID)
client.set_key(APPWRITE_API_KEY)

databases = Databases(client)

def get_existing_attributes(collection_id):
    try:
        attrs = databases.list_attributes(APPWRITE_DATABASE_ID, collection_id)
        return {a['key']: a for a in attrs['attributes']}
    except:
        return {}

def ensure_attribute(collection_id, key, create_func, size=None, required=False, default=None, min_val=None, max_val=None):
    existing = get_existing_attributes(collection_id)
    if key in existing:
        attr = existing[key]
        # Check if size needs update (Appwrite doesn't support easy size update via SDK, 
        # but we can check if it's already large enough)
        current_size = attr.get('size', 0)
        if size and current_size < size:
            print(f" [!] Attribute '{key}' in '{collection_id}' size is {current_size}, target is {size}. Deleting and recreating...")
            try:
                databases.delete_attribute(APPWRITE_DATABASE_ID, collection_id, key)
                time.sleep(3) # Wait for Appwrite to process deletion
            except Exception as e:
                print(f" [X] Error deleting '{key}': {e}")
                return
        else:
            print(f" [OK] Attribute '{key}' in '{collection_id}' already exists.")
            return

    print(f" [+] Creating attribute '{key}' in '{collection_id}'...")
    try:
        if create_func == databases.create_string_attribute:
            create_func(APPWRITE_DATABASE_ID, collection_id, key, size, required, default)
        elif create_func == databases.create_integer_attribute:
            create_func(APPWRITE_DATABASE_ID, collection_id, key, required, min_val, max_val, default)
        elif create_func == databases.create_float_attribute:
            create_func(APPWRITE_DATABASE_ID, collection_id, key, required, min_val, max_val, default)
        else: # datetime, boolean, email, etc.
            create_func(APPWRITE_DATABASE_ID, collection_id, key, required, default)
        
        # Give Appwrite a moment to process
        time.sleep(0.5)
    except AppwriteException as e:
        msg = str(e)
        if "already exists" in msg:
            print(f" [OK] Attribute '{key}' in '{collection_id}' already exists.")
            return
        if "maximum number or size of attributes" in msg:
            print(f" [!] Skipping '{key}' in '{collection_id}': attribute limit reached.")
            return
        print(f" [X] Error creating '{key}': {e}")

def setup_collection(collection_id, collection_name, attributes, indexes=[], permissions=None):
    if permissions is None:
        permissions = [
            Permission.read(Role.users()),
            Permission.create(Role.users()),
            Permission.update(Role.users()),
            Permission.delete(Role.users()),
        ]
    
    try:
        databases.get_collection(APPWRITE_DATABASE_ID, collection_id)
        print(f"\nCollection '{collection_id}' exists.")
    except AppwriteException:
        print(f"\nCreating collection '{collection_id}'...")
        databases.create_collection(APPWRITE_DATABASE_ID, collection_id, collection_name, permissions=permissions)

    for attr in attributes:
        # attr: (key, func, size, required, default, min, max)
        key = attr[0]
        func = attr[1]
        size = attr[2] if len(attr) > 2 else None
        required = attr[3] if len(attr) > 3 else False
        default = attr[4] if len(attr) > 4 else None
        min_val = attr[5] if len(attr) > 5 else None
        max_val = attr[6] if len(attr) > 6 else None
        
        ensure_attribute(collection_id, key, func, size, required, default, min_val, max_val)

    # Check indexes
    existing_indexes = []
    try:
        idx_res = databases.list_indexes(APPWRITE_DATABASE_ID, collection_id)
        existing_indexes = [i['key'] for i in idx_res['indexes']]
    except: pass

    for idx_key, idx_type, fields in indexes:
        if idx_key not in existing_indexes:
            print(f" [+] Creating index '{idx_key}' on '{collection_id}'...")
            try:
                databases.create_index(APPWRITE_DATABASE_ID, collection_id, idx_key, idx_type, fields)
            except AppwriteException as e:
                print(f" [X] Error creating index '{idx_key}': {e}")

def cleanup_redundant_attributes():
    redundant = {
        "super_profiles": ["buttons_json", "theme", "profile_id"],
        "convo_starters": ["starters_json"],
        "reply_templates": ["linked_automations"]
    }
    for col, attrs in redundant.items():
        existing = get_existing_attributes(col)
        for attr_id in attrs:
            if attr_id in existing:
                print(f" [-] Deleting redundant attribute '{attr_id}' from '{col}'...")
                try:
                    databases.delete_attribute(APPWRITE_DATABASE_ID, col, attr_id)
                except Exception as e:
                    print(f" [X] Error deleting '{attr_id}': {e}")

def cleanup_redundant_indexes():
    redundant = {
        "keywords": ["idx_account_keyword_norm"],
        "keyword_index": ["idx_lookup"]
    }
    for col, idxs in redundant.items():
        try:
            idx_res = databases.list_indexes(APPWRITE_DATABASE_ID, col)
            existing = {i['key'] for i in idx_res.get('indexes', [])}
        except Exception:
            existing = set()
        for idx_key in idxs:
            if idx_key in existing:
                print(f" [-] Deleting redundant index '{idx_key}' from '{col}'...")
                try:
                    databases.delete_index(APPWRITE_DATABASE_ID, col, idx_key)
                except Exception as e:
                    print(f" [X] Error deleting index '{idx_key}': {e}")
if __name__ == "__main__":
    print("Starting Appwrite Schema Sync...")
    
    # Cleanup known blockers
    cleanup_redundant_attributes()
    cleanup_redundant_indexes()
    
    # Remove legacy collections
    try:
        databases.delete_collection(APPWRITE_DATABASE_ID, 'templates')
        print(" [-] Deleted legacy collection 'templates'")
    except:
        pass

    try:
        databases.delete_collection(APPWRITE_DATABASE_ID, 'welcome_message_ads')
        print(" [-] Deleted legacy collection 'welcome_message_ads'")
    except:
        pass

    try:
        databases.delete_collection(APPWRITE_DATABASE_ID, 'campaigns')
        print(" [-] Deleted legacy collection 'campaigns'")
    except:
        pass

    # Users
    setup_collection("users", "Users", [
        ('name', databases.create_string_attribute, 255, True),
        ('email', databases.create_string_attribute, 255, True),
        ('status', databases.create_string_attribute, 50, False, 'active'),
        ('first_login', databases.create_datetime_attribute, None, False),
        ('last_login', databases.create_datetime_attribute, None, False),
        ('subscription_plan_id', databases.create_string_attribute, 255, False),
        ('avatar_url', databases.create_string_attribute, 2048, False),
        ('subscription_status', databases.create_string_attribute, 50, False, 'trial'),
        ('subscription_expires', databases.create_datetime_attribute, None, False),
        ('referred_by', databases.create_string_attribute, 36, False),
        ('referral_code', databases.create_string_attribute, 20, False),
    ], permissions=[Permission.read(Role.users())])

    # Profiles (subscription + credits)
    setup_collection("profiles", "Profiles", [
        ('user_id', databases.create_string_attribute, 255, True),
        ('credits', databases.create_integer_attribute, None, False, 0),
        ('tier', databases.create_string_attribute, 50, False, 'free'),
        ('subscription_plan_id', databases.create_string_attribute, 255, False),
        ('subscription_status', databases.create_string_attribute, 50, False, 'trial'),
        ('subscription_expires', databases.create_datetime_attribute, None, False),
        ('referred_by', databases.create_string_attribute, 36, False),
        ('referral_code', databases.create_string_attribute, 20, False),
    ], indexes=[
        ('idx_user_id', 'unique', ['user_id']),
        ('idx_referral_code', 'unique', ['referral_code']),
    ], permissions=[Permission.read(Role.users())])

    # Settings
    setup_collection("settings", "Settings", [
        ('user_id', databases.create_string_attribute, 255, False),
        ('dark_mode', databases.create_boolean_attribute, None, False, False),
        ('notification_preference', databases.create_string_attribute, 50, False, 'email'),
    ], indexes=[
        ('idx_user_id', 'key', ['user_id']),
    ], permissions=[Permission.read(Role.users())])

    # IG Accounts
    setup_collection("ig_accounts", "Instagram Accounts", [
        ('user_id', databases.create_string_attribute, 255, True),
        ('ig_user_id', databases.create_string_attribute, 255, True),
        ('username', databases.create_string_attribute, 255, True),
        ('profile_picture_url', databases.create_string_attribute, 2048, False),
        ('access_token', databases.create_string_attribute, 1024, True),
        ('token_expires_at', databases.create_datetime_attribute, None, True),
        ('permissions', databases.create_string_attribute, 1024, False),
        ('linked_at', databases.create_datetime_attribute, None, False),
        ('ig_scoped_id', databases.create_string_attribute, 255, False),
        ('name', databases.create_string_attribute, 255, False),
        ('status', databases.create_string_attribute, 50, False, 'active'),
        ('account_id', databases.create_string_attribute, 255, False),
        ('is_active', databases.create_boolean_attribute, None, False, True),
        ('is_primary', databases.create_boolean_attribute, None, False, False),
        ('followers_count', databases.create_integer_attribute, None, False, 0),
        ('account_type', databases.create_string_attribute, 50, False),
    ], indexes=[
        ('ig_user_id_unique', 'unique', ['ig_user_id']),
        ('user_id_idx', 'key', ['user_id']),
        ('idx_user_ig_user', 'key', ['user_id', 'ig_user_id']),
    ], permissions=[Permission.read(Role.users())])

    # Pricing
    setup_collection("pricing", "Pricing Plans", [
        ('name', databases.create_string_attribute, 100, True),
        ('price_monthly_inr', databases.create_integer_attribute, None, False, 0),
        ('price_yearly_inr', databases.create_integer_attribute, None, False, 0),
        ('price_monthly_usd', databases.create_integer_attribute, None, False, 0),
        ('price_yearly_usd', databases.create_integer_attribute, None, False, 0),
        ('is_custom', databases.create_boolean_attribute, None, False, False),
        ('is_popular', databases.create_boolean_attribute, None, False, False),
        ('features', databases.create_string_attribute, 10000, False),
        ('display_order', databases.create_integer_attribute, None, False, 0),
        ('button_text', databases.create_string_attribute, 100, False),
        ('yearly_bonus', databases.create_string_attribute, 100, False),
    ], indexes=[
        ('display_order_idx', 'key', ['display_order']),
    ], permissions=[Permission.read(Role.any())])

    # Automations
    setup_collection("automations", "Automations", [
        ('user_id', databases.create_string_attribute, 255, True),
        ('account_id', databases.create_string_attribute, 255, True),
        ('automation_type', databases.create_string_attribute, 255, True),
        ('title', databases.create_string_attribute, 255, True),
        ('title_normalized', databases.create_string_attribute, 255, False),
        ('is_active', databases.create_boolean_attribute, None, True, True),
        ('keyword', databases.create_string_attribute, 255, False),
        ('keywords', databases.create_string_attribute, 2000, False),
        ('keyword_match_type', databases.create_string_attribute, 50, False, 'exact'),
        ('template_type', databases.create_string_attribute, 50, False),
        ('template_content', databases.create_string_attribute, 3000, False),
        ('template_id', databases.create_string_attribute, 255, False),
        ('buttons', databases.create_string_attribute, 2000, False),
        ('template_elements', databases.create_string_attribute, 2000, False),
        ('replies', databases.create_string_attribute, 2000, False),
        ('media_url', databases.create_string_attribute, 500, False),
        ('media_id', databases.create_string_attribute, 100, False),
        ('use_latest_post', databases.create_boolean_attribute, None, False, False),
        ('latest_post_type', databases.create_string_attribute, 50, False),
        ('followers_only', databases.create_boolean_attribute, None, False, False),
        ('exclude_existing_customers', databases.create_boolean_attribute, None, False, False),
        ('send_to', databases.create_string_attribute, 50, False),
        ('delay_seconds', databases.create_integer_attribute, None, False, 0),
        ('comment_reply', databases.create_string_attribute, 1000, False),
        ('linked_media_id', databases.create_string_attribute, 255, False),
        ('linked_media_url', databases.create_string_attribute, 500, False),
    ], indexes=[
        ('idx_user_id', 'key', ['user_id']),
        ('idx_account_id', 'key', ['account_id']),
        ('idx_account_type', 'key', ['account_id', 'automation_type']),
        ('idx_account_type_active', 'key', ['account_id', 'automation_type', 'is_active']),
        ('idx_account_keyword', 'key', ['account_id', 'keyword']),
        ('idx_account_media', 'key', ['account_id', 'linked_media_id']),
        ('idx_account_type_title_norm', 'key', ['account_id', 'automation_type', 'title_normalized']),
        ('idx_template_id', 'key', ['template_id']),
    ])

    # Reply Templates
    setup_collection("reply_templates", "Reply Templates", [
        ('user_id', databases.create_string_attribute, 255, True),
        ('account_id', databases.create_string_attribute, 255, True),
        ('name', databases.create_string_attribute, 255, True),
        ('name_normalized', databases.create_string_attribute, 255, False),
        ('template_type', databases.create_string_attribute, 50, True),
        # TARGET FIX: 12000 chars for carousel support
        ('template_data', databases.create_string_attribute, 12000, True),
        ('automation_count', databases.create_integer_attribute, None, False, 0),
    ], indexes=[
        ('idx_user_id', 'key', ['user_id']),
        ('idx_account_id', 'key', ['account_id']),
        ('idx_account_name_norm', 'key', ['account_id', 'name_normalized']),
        ('idx_template_type', 'key', ['template_type']),
    ])

    # Inbox Menus
    setup_collection("inbox_menus", "Inbox Menus", [
        ('user_id', databases.create_string_attribute, 255, True),
        ('account_id', databases.create_string_attribute, 255, True),
        ('menu_items', databases.create_string_attribute, 4000, True),
    ], indexes=[
        ('idx_user_acc', 'key', ['user_id', 'account_id']),
    ])

    # Convo Starters
    setup_collection("convo_starters", "Convo Starters", [
        ('user_id', databases.create_string_attribute, 255, True),
        ('account_id', databases.create_string_attribute, 255, True),
        ('starters', databases.create_string_attribute, 4000, True),
    ], indexes=[
        ('idx_user_acc', 'key', ['user_id', 'account_id']),
    ])

    # Super Profiles
    setup_collection("super_profiles", "Super Profiles", [
        ('user_id', databases.create_string_attribute, 255, True),
        ('account_id', databases.create_string_attribute, 255, True),
        ('slug', databases.create_string_attribute, 255, False),
        ('template_id', databases.create_string_attribute, 255, False),
        ('buttons', databases.create_string_attribute, 6000, False),
        ('is_active', databases.create_boolean_attribute, None, True, True),
    ], indexes=[
        ('idx_slug', 'key', ['slug']),
        ('idx_slug_unique', 'unique', ['slug']),
        ('idx_user_id', 'key', ['user_id']),
        ('idx_user_acc', 'key', ['user_id', 'account_id']),
    ])

    # Mentions
    setup_collection("mentions", "Mentions", [
        ('user_id', databases.create_string_attribute, 255, True),
        ('account_id', databases.create_string_attribute, 255, True),
        ('template_id', databases.create_string_attribute, 255, False),
        ('is_active', databases.create_boolean_attribute, None, False, True),
    ], indexes=[
        ('idx_user_acc', 'key', ['user_id', 'account_id']),
        ('idx_template_id', 'key', ['template_id']),
    ])

    # Suggest More
    setup_collection("suggest_more", "Suggest More", [
        ('user_id', databases.create_string_attribute, 255, True),
        ('account_id', databases.create_string_attribute, 255, True),
        ('template_id', databases.create_string_attribute, 255, False),
        ('is_active', databases.create_boolean_attribute, None, False, True),
    ], indexes=[
        ('idx_user_acc', 'key', ['user_id', 'account_id']),
        ('idx_template_id', 'key', ['template_id']),
    ])



    # Comment Moderation
    setup_collection("comment_moderation", "Comment Moderation", [
        ('user_id', databases.create_string_attribute, 255, True),
        ('account_id', databases.create_string_attribute, 255, True),
        ('rules', databases.create_string_attribute, 10000, True),
        ('is_active', databases.create_boolean_attribute, None, True, True),
    ], indexes=[
        ('idx_user_acc', 'key', ['user_id', 'account_id']),
    ])

    # Affiliate Profiles
    setup_collection("affiliate_profiles", "Affiliate Profiles", [
        ('user_id', databases.create_string_attribute, 255, True),
        ('status', databases.create_string_attribute, 50, True, 'pending'),
        ('type', databases.create_string_attribute, 50, True, 'standard'),
        ('instagram_url', databases.create_string_attribute, 500, False),
        ('youtube_url', databases.create_string_attribute, 500, False),
        ('referral_code', databases.create_string_attribute, 20, True),
        ('earnings_total', databases.create_float_attribute, None, False, 0.0),
        ('earnings_pending', databases.create_float_attribute, None, False, 0.0),
    ], indexes=[
        ('idx_user_id', 'unique', ['user_id']),
        ('idx_ref_code', 'unique', ['referral_code']),
    ])

    # Referrals
    setup_collection("referrals", "Referrals", [
        ('referrer_id', databases.create_string_attribute, 255, True),
        ('referred_id', databases.create_string_attribute, 255, True),
        ('status', databases.create_string_attribute, 50, True, 'pending'),
        ('commission_amount', databases.create_float_attribute, None, True, 0.0),
        ('qualified_at', databases.create_datetime_attribute, None, False),
    ], indexes=[
        ('idx_referrer', 'key', ['referrer_id']),
    ])

    # Payouts
    setup_collection("payouts", "Payouts", [
        ('affiliate_id', databases.create_string_attribute, 255, True),
        ('amount', databases.create_float_attribute, None, True, 0.0),
        ('status', databases.create_string_attribute, 50, True, 'pending'),
        ('requested_at', databases.create_datetime_attribute, None, True),
        ('paid_at', databases.create_datetime_attribute, None, False),
        ('processed_at', databases.create_datetime_attribute, None, False),
        ('transaction_id', databases.create_string_attribute, 255, False),
    ], indexes=[
        ('idx_affiliate', 'key', ['affiliate_id']),
    ])

    # Keywords (For detailed management of triggers)
    setup_collection("keywords", "Keywords", [
        ('automation_id', databases.create_string_attribute, 255, True),
        ('account_id', databases.create_string_attribute, 255, True),
        ('automation_type', databases.create_string_attribute, 50, False),
        ('type', databases.create_string_attribute, 50, False),
        ('keyword', databases.create_string_attribute, 255, True),
        ('keyword_normalized', databases.create_string_attribute, 255, True),
        ('keyword_hash', databases.create_string_attribute, 255, True),
        ('match_type', databases.create_string_attribute, 50, False, 'exact'),
        ('is_active', databases.create_boolean_attribute, None, False, True),
    ], indexes=[
        ('idx_account_type_keyword_norm', 'unique', ['account_id', 'automation_type', 'keyword_normalized']),
        ('idx_automation_keyword_norm', 'unique', ['automation_id', 'keyword_normalized']),
        ('idx_automation', 'key', ['automation_id']),
        ('idx_account_active', 'key', ['account_id', 'is_active']),
    ])

    # Keyword Index (For high-performance routing/lookup)
    setup_collection("keyword_index", "Keyword Index", [
        ('account_id', databases.create_string_attribute, 255, True),
        ('keyword_hash', databases.create_string_attribute, 255, True),
        ('automation_id', databases.create_string_attribute, 255, True),
        ('automation_type', databases.create_string_attribute, 50, False),
    ], indexes=[
        ('idx_lookup_type', 'unique', ['account_id', 'automation_type', 'keyword_hash']),
        ('idx_automation', 'key', ['automation_id']),
        ('idx_account_type', 'key', ['account_id', 'automation_type']),
    ])

    # Analytics (optional / future use)
    setup_collection("analytics", "Analytics", [
        ('user_id', databases.create_string_attribute, 255, False),
        ('account_id', databases.create_string_attribute, 255, True),
        ('metric', databases.create_string_attribute, 100, True),
        ('payload', databases.create_string_attribute, 20000, True),
        ('range_start', databases.create_datetime_attribute, None, False),
        ('range_end', databases.create_datetime_attribute, None, False),
        ('recorded_at', databases.create_datetime_attribute, None, False),
    ], indexes=[
        ('idx_account', 'key', ['account_id']),
        ('idx_recorded_at', 'key', ['recorded_at']),
        ('idx_account_recorded', 'key', ['account_id', 'recorded_at']),
    ])

    print("\n[COMPLETE] Appwrite Schema Sync Finished.")






