import os
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.id import ID
from appwrite.client import AppwriteException
from appwrite.permission import Permission
from appwrite.role import Role
from dotenv import load_dotenv
load_dotenv()

APPWRITE_ENDPOINT = os.getenv("APPWRITE_ENDPOINT")
APPWRITE_PROJECT_ID = os.getenv("APPWRITE_PROJECT_ID")
APPWRITE_API_KEY = os.getenv("APPWRITE_API_KEY")
APPWRITE_DATABASE_ID = os.getenv("APPWRITE_DATABASE_ID")

# Initialize Appwrite
client = Client()
client.set_endpoint(APPWRITE_ENDPOINT)
client.set_project(APPWRITE_PROJECT_ID)
client.set_key(APPWRITE_API_KEY)

databases = Databases(client)

USERS_COLLECTION_ID = "users"

def setup_database():
    """
    Creates the 'users' collection and its attributes in the Appwrite database.
    """
    try:
        # Create collection
        databases.create_collection(
            APPWRITE_DATABASE_ID,
            USERS_COLLECTION_ID,
            "Users",
            permissions=[
                Permission.read(Role.users()), # Only authenticated users can read their own profile
                # No create, update, or delete permissions for client-side users.
                # These operations will be handled by the server-side SDK using an API key.
            ]
        )
        print(f"Collection '{USERS_COLLECTION_ID}' created successfully.")

        # Define attributes for the 'users' collection
        user_attributes = [
            ('name', databases.create_string_attribute, (APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, 'name', 255, True)),
            ('email', databases.create_string_attribute, (APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, 'email', 255, True)),
            ('first_login', databases.create_datetime_attribute, (APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, 'first_login', False)),
            ('last_login', databases.create_datetime_attribute, (APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, 'last_login', False)),
            ('subscription_plan_id', databases.create_string_attribute, (APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, 'subscription_plan_id', 255, False)),
        ]

        # Create attributes, handling existing ones
        for attr_name, create_func, args in user_attributes:
            try:
                create_func(*args)
                print(f"Attribute '{attr_name}' for '{USERS_COLLECTION_ID}' created successfully.")
            except AppwriteException as e:
                if e.code == 409: # Conflict, attribute already exists
                    print(f"Attribute '{attr_name}' for '{USERS_COLLECTION_ID}' already exists.")
                else:
                    print(f"An error occurred creating attribute '{attr_name}': {e}")

        print("Attributes for 'users' collection created successfully.")

    except AppwriteException as e:
        if e.code == 409: # Conflict, collection already exists
            print(f"Collection '{USERS_COLLECTION_ID}' already exists.")
        else:
            print(f"An error occurred: {e}")

def setup_campaigns_collection():
    """
    Creates the 'campaigns' collection and its attributes.
    """
    CAMPAIGNS_COLLECTION_ID = "campaigns"
    try:
        databases.create_collection(
            APPWRITE_DATABASE_ID,
            CAMPAIGNS_COLLECTION_ID,
            "Campaigns",
            permissions=[
                Permission.read(Role.users()),
                Permission.create(Role.users()),
                Permission.update(Role.users()),
                Permission.delete(Role.users()),
            ]
        )
        print(f"Collection '{CAMPAIGNS_COLLECTION_ID}' created successfully.")

        campaign_attributes = [
            ('name', databases.create_string_attribute, (APPWRITE_DATABASE_ID, CAMPAIGNS_COLLECTION_ID, 'name', 255, True)),
            ('status', databases.create_string_attribute, (APPWRITE_DATABASE_ID, CAMPAIGNS_COLLECTION_ID, 'status', 50, True)),
            ('user_id', databases.create_string_attribute, (APPWRITE_DATABASE_ID, CAMPAIGNS_COLLECTION_ID, 'user_id', 50, True)),
        ]

        for attr_name, create_func, args in campaign_attributes:
            try:
                create_func(*args)
                print(f"Attribute '{attr_name}' for '{CAMPAIGNS_COLLECTION_ID}' created successfully.")
            except AppwriteException as e:
                if e.code == 409:
                    print(f"Attribute '{attr_name}' for '{CAMPAIGNS_COLLECTION_ID}' already exists.")
                else:
                    print(f"An error occurred creating attribute '{attr_name}': {e}")
    except AppwriteException as e:
        if e.code == 409:
            print(f"Collection '{CAMPAIGNS_COLLECTION_ID}' already exists.")
        else:
            print(f"An error occurred: {e}")

if __name__ == "__main__":
    setup_database()
    setup_campaigns_collection()

    # Setup 'settings' collection
    SETTINGS_COLLECTION_ID = "settings"
    try:
        databases.create_collection(
            APPWRITE_DATABASE_ID,
            SETTINGS_COLLECTION_ID,
            "Settings",
            permissions=[
                Permission.read(Role.users()),
            ]
        )
        print(f"Collection '{SETTINGS_COLLECTION_ID}' created successfully.")
    except AppwriteException as e:
        if e.code == 409: # Conflict, collection already exists
            print(f"Collection '{SETTINGS_COLLECTION_ID}' already exists.")
        else:
            print(f"An error occurred while creating collection '{SETTINGS_COLLECTION_ID}': {e}")

    # Define attributes for the 'settings' collection
    settings_attributes = [
        ('dark_mode', databases.create_boolean_attribute, (APPWRITE_DATABASE_ID, SETTINGS_COLLECTION_ID, 'dark_mode', False)),
        ('notification_preference', databases.create_string_attribute, (APPWRITE_DATABASE_ID, SETTINGS_COLLECTION_ID, 'notification_preference', 255, False)),
    ]

    # Create attributes, handling existing ones
    for attr_name, create_func, args in settings_attributes:
        try:
            create_func(*args)
            print(f"Attribute '{attr_name}' for '{SETTINGS_COLLECTION_ID}' created successfully.")
        except AppwriteException as e:
            if e.code == 409: # Conflict, attribute already exists
                print(f"Attribute '{attr_name}' for '{SETTINGS_COLLECTION_ID}' already exists.")
            else:
                print(f"An error occurred creating attribute '{attr_name}': {e}")

    # Setup 'ig_accounts' collection for Instagram account linking
    IG_ACCOUNTS_COLLECTION_ID = "ig_accounts"
    try:
        databases.create_collection(
            APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            "Instagram Accounts",
            permissions=[
                Permission.read(Role.users()),
            ]
        )
        print(f"Collection '{IG_ACCOUNTS_COLLECTION_ID}' created successfully.")
    except AppwriteException as e:
        if e.code == 409:
            print(f"Collection '{IG_ACCOUNTS_COLLECTION_ID}' already exists.")
        else:
            print(f"An error occurred while creating collection '{IG_ACCOUNTS_COLLECTION_ID}': {e}")

    # Define attributes for the 'ig_accounts' collection
    ig_accounts_attributes = [
        ('user_id', databases.create_string_attribute, (APPWRITE_DATABASE_ID, IG_ACCOUNTS_COLLECTION_ID, 'user_id', 255, True)),
        ('ig_user_id', databases.create_string_attribute, (APPWRITE_DATABASE_ID, IG_ACCOUNTS_COLLECTION_ID, 'ig_user_id', 255, True)),
        ('username', databases.create_string_attribute, (APPWRITE_DATABASE_ID, IG_ACCOUNTS_COLLECTION_ID, 'username', 255, True)),
        ('profile_picture_url', databases.create_string_attribute, (APPWRITE_DATABASE_ID, IG_ACCOUNTS_COLLECTION_ID, 'profile_picture_url', 2048, False)),
        ('access_token', databases.create_string_attribute, (APPWRITE_DATABASE_ID, IG_ACCOUNTS_COLLECTION_ID, 'access_token', 1024, True)),
        ('token_expires_at', databases.create_datetime_attribute, (APPWRITE_DATABASE_ID, IG_ACCOUNTS_COLLECTION_ID, 'token_expires_at', True)),
        ('permissions', databases.create_string_attribute, (APPWRITE_DATABASE_ID, IG_ACCOUNTS_COLLECTION_ID, 'permissions', 1024, False)),
        ('linked_at', databases.create_datetime_attribute, (APPWRITE_DATABASE_ID, IG_ACCOUNTS_COLLECTION_ID, 'linked_at', False)),
    ]

    for attr_name, create_func, args in ig_accounts_attributes:
        try:
            create_func(*args)
            print(f"Attribute '{attr_name}' for '{IG_ACCOUNTS_COLLECTION_ID}' created successfully.")
        except AppwriteException as e:
            if e.code == 409:
                print(f"Attribute '{attr_name}' for '{IG_ACCOUNTS_COLLECTION_ID}' already exists.")
            else:
                print(f"An error occurred creating attribute '{attr_name}': {e}")

    # Create index on ig_user_id for uniqueness check
    try:
        databases.create_index(
            APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            'ig_user_id_index',
            'unique',
            ['ig_user_id']
        )
        print(f"Unique index on 'ig_user_id' created successfully.")
    except AppwriteException as e:
        if e.code == 409:
            print(f"Index 'ig_user_id_index' already exists.")
        else:
            print(f"An error occurred creating index: {e}")

    # Create index on user_id for querying user's accounts
    try:
        databases.create_index(
            APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            'user_id_index',
            'key',
            ['user_id']
        )
        print(f"Index on 'user_id' created successfully.")
    except AppwriteException as e:
        if e.code == 409:
            print(f"Index 'user_id_index' already exists.")
        else:
            print(f"An error occurred creating index: {e}")

    # Setup 'pricing' collection for pricing plans
    PRICING_COLLECTION_ID = "pricing"
    try:
        databases.create_collection(
            APPWRITE_DATABASE_ID,
            PRICING_COLLECTION_ID,
            "Pricing Plans",
            permissions=[
                Permission.read(Role.any()),  # Public read for pricing
            ]
        )
        print(f"Collection '{PRICING_COLLECTION_ID}' created successfully.")
    except AppwriteException as e:
        if e.code == 409:
            print(f"Collection '{PRICING_COLLECTION_ID}' already exists.")
        else:
            print(f"An error occurred while creating collection '{PRICING_COLLECTION_ID}': {e}")

    # Define attributes for the 'pricing' collection
    pricing_attributes = [
        ('name', databases.create_string_attribute, (APPWRITE_DATABASE_ID, PRICING_COLLECTION_ID, 'name', 100, True)),
        ('price_monthly_inr', databases.create_integer_attribute, (APPWRITE_DATABASE_ID, PRICING_COLLECTION_ID, 'price_monthly_inr', False)),
        ('price_yearly_inr', databases.create_integer_attribute, (APPWRITE_DATABASE_ID, PRICING_COLLECTION_ID, 'price_yearly_inr', False)),
        ('price_monthly_usd', databases.create_integer_attribute, (APPWRITE_DATABASE_ID, PRICING_COLLECTION_ID, 'price_monthly_usd', False)),
        ('price_yearly_usd', databases.create_integer_attribute, (APPWRITE_DATABASE_ID, PRICING_COLLECTION_ID, 'price_yearly_usd', False)),
        ('is_custom', databases.create_boolean_attribute, (APPWRITE_DATABASE_ID, PRICING_COLLECTION_ID, 'is_custom', False)),
        ('is_popular', databases.create_boolean_attribute, (APPWRITE_DATABASE_ID, PRICING_COLLECTION_ID, 'is_popular', False)),
        ('features', databases.create_string_attribute, (APPWRITE_DATABASE_ID, PRICING_COLLECTION_ID, 'features', 10000, False)),  # JSON string
        ('display_order', databases.create_integer_attribute, (APPWRITE_DATABASE_ID, PRICING_COLLECTION_ID, 'display_order', False)),
        ('button_text', databases.create_string_attribute, (APPWRITE_DATABASE_ID, PRICING_COLLECTION_ID, 'button_text', 100, False)),
        ('yearly_bonus', databases.create_string_attribute, (APPWRITE_DATABASE_ID, PRICING_COLLECTION_ID, 'yearly_bonus', 100, False)),
    ]

    for attr_name, create_func, args in pricing_attributes:
        try:
            create_func(*args)
            print(f"Attribute '{attr_name}' for '{PRICING_COLLECTION_ID}' created successfully.")
        except AppwriteException as e:
            if e.code == 409:
                print(f"Attribute '{attr_name}' for '{PRICING_COLLECTION_ID}' already exists.")
            else:
                print(f"An error occurred creating attribute '{attr_name}': {e}")

    # Create index on display_order for sorted queries
    try:
        databases.create_index(
            APPWRITE_DATABASE_ID,
            PRICING_COLLECTION_ID,
            'display_order_index',
            'key',
            ['display_order']
        )
        print(f"Index on 'display_order' created successfully.")
    except AppwriteException as e:
        if e.code == 409:
            print(f"Index 'display_order_index' already exists.")
        else:
            print(f"An error occurred creating index: {e}")



    # Setup 'affiliate_profiles' collection
    AFFILIATE_PROFILES_COLLECTION_ID = "affiliate_profiles"
    try:
        databases.create_collection(
            APPWRITE_DATABASE_ID,
            AFFILIATE_PROFILES_COLLECTION_ID,
            "Affiliate Profiles",
            permissions=[
                Permission.read(Role.users()),
                Permission.create(Role.users()),
                Permission.update(Role.users()),
                Permission.delete(Role.users()),
            ]
        )
        print(f"Collection '{AFFILIATE_PROFILES_COLLECTION_ID}' created successfully.")
    except AppwriteException as e:
        if e.code == 409:
            print(f"Collection '{AFFILIATE_PROFILES_COLLECTION_ID}' already exists.")
        else:
            print(f"An error occurred while creating collection '{AFFILIATE_PROFILES_COLLECTION_ID}': {e}")

    # Define attributes for 'affiliate_profiles'
    affiliate_profiles_attributes = [
        ('user_id', databases.create_string_attribute, (APPWRITE_DATABASE_ID, AFFILIATE_PROFILES_COLLECTION_ID, 'user_id', 255, True)),
        ('status', databases.create_string_attribute, (APPWRITE_DATABASE_ID, AFFILIATE_PROFILES_COLLECTION_ID, 'status', 50, True)), # inactive, pending, active, rejected
        ('type', databases.create_string_attribute, (APPWRITE_DATABASE_ID, AFFILIATE_PROFILES_COLLECTION_ID, 'type', 50, True)), # influencer, subscriber
        ('instagram_url', databases.create_string_attribute, (APPWRITE_DATABASE_ID, AFFILIATE_PROFILES_COLLECTION_ID, 'instagram_url', 500, False)),
        ('youtube_url', databases.create_string_attribute, (APPWRITE_DATABASE_ID, AFFILIATE_PROFILES_COLLECTION_ID, 'youtube_url', 500, False)),
        ('referral_code', databases.create_string_attribute, (APPWRITE_DATABASE_ID, AFFILIATE_PROFILES_COLLECTION_ID, 'referral_code', 20, True)),
        ('earnings_total', databases.create_float_attribute, (APPWRITE_DATABASE_ID, AFFILIATE_PROFILES_COLLECTION_ID, 'earnings_total', False)),
        ('earnings_pending', databases.create_float_attribute, (APPWRITE_DATABASE_ID, AFFILIATE_PROFILES_COLLECTION_ID, 'earnings_pending', False)),
    ]

    for attr_name, create_func, args in affiliate_profiles_attributes:
        try:
            create_func(*args)
            print(f"Attribute '{attr_name}' for '{AFFILIATE_PROFILES_COLLECTION_ID}' created successfully.")
        except AppwriteException as e:
            if e.code == 409:
                print(f"Attribute '{attr_name}' for '{AFFILIATE_PROFILES_COLLECTION_ID}' already exists.")
            else:
                print(f"An error occurred creating attribute '{attr_name}': {e}")
    
    # Create indexes for 'affiliate_profiles'
    try:
        databases.create_index(APPWRITE_DATABASE_ID, AFFILIATE_PROFILES_COLLECTION_ID, 'user_id_index', 'unique', ['user_id'])
        print(f"Index 'user_id_index' created successfully.")
    except AppwriteException as e:
        if e.code != 409: print(f"Error creating index: {e}")
        
    try:
        databases.create_index(APPWRITE_DATABASE_ID, AFFILIATE_PROFILES_COLLECTION_ID, 'referral_code_index', 'unique', ['referral_code'])
        print(f"Index 'referral_code_index' created successfully.")
    except AppwriteException as e:
        if e.code != 409: print(f"Error creating index: {e}")


    # Setup 'referrals' collection
    REFERRALS_COLLECTION_ID = "referrals"
    try:
        databases.create_collection(
            APPWRITE_DATABASE_ID,
            REFERRALS_COLLECTION_ID,
            "Referrals",
            permissions=[
                Permission.read(Role.users()),
                Permission.create(Role.users()),
                Permission.update(Role.users()),
            ]
        )
        print(f"Collection '{REFERRALS_COLLECTION_ID}' created successfully.")
    except AppwriteException as e:
        if e.code == 409:
            print(f"Collection '{REFERRALS_COLLECTION_ID}' already exists.")
        else:
            print(f"An error occurred while creating collection '{REFERRALS_COLLECTION_ID}': {e}")

    # Define attributes for 'referrals'
    referrals_attributes = [
        ('referrer_id', databases.create_string_attribute, (APPWRITE_DATABASE_ID, REFERRALS_COLLECTION_ID, 'referrer_id', 255, True)), # Affiliate User ID
        ('referred_id', databases.create_string_attribute, (APPWRITE_DATABASE_ID, REFERRALS_COLLECTION_ID, 'referred_id', 255, True)), # New User ID
        ('status', databases.create_string_attribute, (APPWRITE_DATABASE_ID, REFERRALS_COLLECTION_ID, 'status', 50, True)), # pending, qualified, paid, cancelled
        ('commission_amount', databases.create_float_attribute, (APPWRITE_DATABASE_ID, REFERRALS_COLLECTION_ID, 'commission_amount', True)),
        ('created_at', databases.create_datetime_attribute, (APPWRITE_DATABASE_ID, REFERRALS_COLLECTION_ID, 'created_at', True)),
    ]

    for attr_name, create_func, args in referrals_attributes:
        try:
            create_func(*args)
            print(f"Attribute '{attr_name}' for '{REFERRALS_COLLECTION_ID}' created successfully.")
        except AppwriteException as e:
            if e.code == 409:
                print(f"Attribute '{attr_name}' for '{REFERRALS_COLLECTION_ID}' already exists.")
            else:
                print(f"An error occurred creating attribute '{attr_name}': {e}")

    try:
        databases.create_index(APPWRITE_DATABASE_ID, REFERRALS_COLLECTION_ID, 'referrer_id_index', 'key', ['referrer_id'])
        print(f"Index 'referrer_id_index' created successfully.")
    except AppwriteException as e:
        if e.code != 409: print(f"Error creating index: {e}")


    # Setup 'payouts' collection
    PAYOUTS_COLLECTION_ID = "payouts"
    try:
        databases.create_collection(
            APPWRITE_DATABASE_ID,
            PAYOUTS_COLLECTION_ID,
            "Payouts",
            permissions=[
                Permission.read(Role.users()),
                Permission.create(Role.users()),
            ]
        )
        print(f"Collection '{PAYOUTS_COLLECTION_ID}' created successfully.")
    except AppwriteException as e:
        if e.code == 409:
            print(f"Collection '{PAYOUTS_COLLECTION_ID}' already exists.")
        else:
            print(f"An error occurred while creating collection '{PAYOUTS_COLLECTION_ID}': {e}")

    # Define attributes for 'payouts'
    payouts_attributes = [
        ('affiliate_id', databases.create_string_attribute, (APPWRITE_DATABASE_ID, PAYOUTS_COLLECTION_ID, 'affiliate_id', 255, True)), # User ID
        ('amount', databases.create_float_attribute, (APPWRITE_DATABASE_ID, PAYOUTS_COLLECTION_ID, 'amount', True)),
        ('status', databases.create_string_attribute, (APPWRITE_DATABASE_ID, PAYOUTS_COLLECTION_ID, 'status', 50, True)), # requested, processing, paid, rejected
        ('requested_at', databases.create_datetime_attribute, (APPWRITE_DATABASE_ID, PAYOUTS_COLLECTION_ID, 'requested_at', True)),
        ('paid_at', databases.create_datetime_attribute, (APPWRITE_DATABASE_ID, PAYOUTS_COLLECTION_ID, 'paid_at', False)),
    ]

    for attr_name, create_func, args in payouts_attributes:
        try:
            create_func(*args)
            print(f"Attribute '{attr_name}' for '{PAYOUTS_COLLECTION_ID}' created successfully.")
        except AppwriteException as e:
            if e.code == 409:
                print(f"Attribute '{attr_name}' for '{PAYOUTS_COLLECTION_ID}' already exists.")
            else:
                print(f"An error occurred creating attribute '{attr_name}': {e}")
    
    try:
        databases.create_index(APPWRITE_DATABASE_ID, PAYOUTS_COLLECTION_ID, 'affiliate_id_index', 'key', ['affiliate_id'])
        print(f"Index 'affiliate_id_index' created successfully.")
    except AppwriteException as e:
        if e.code != 409: print(f"Error creating index: {e}")
