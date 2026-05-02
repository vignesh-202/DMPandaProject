import re
import os
import logging
import sys
from functools import wraps
import datetime
import requests

from flask import Flask, request, jsonify, redirect, g, make_response
from flask_cors import CORS
from flask_wtf.csrf import CSRFProtect
from dotenv import load_dotenv

from appwrite.client import Client
from appwrite.services.account import Account
from appwrite.services.databases import Databases
from appwrite.services.users import Users
from appwrite.id import ID
from appwrite.query import Query
from appwrite.exception import AppwriteException
from appwrite.permission import Permission
from appwrite.role import Role

# Load environment variables from .env file
load_dotenv(override=True)

APPWRITE_ENDPOINT = os.getenv("APPWRITE_ENDPOINT")
APPWRITE_PROJECT_ID = os.getenv("APPWRITE_PROJECT_ID")
APPWRITE_API_KEY = os.getenv("APPWRITE_API_KEY")
APPWRITE_DATABASE_ID = os.getenv("APPWRITE_DATABASE_ID")

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN")
ADMIN_PANEL_ORIGIN = os.getenv("ADMIN_PANEL_ORIGIN")

if not FRONTEND_ORIGIN:
    print("CRITICAL ERROR: FRONTEND_ORIGIN is not set via os.getenv")
if not ADMIN_PANEL_ORIGIN:
    print("CRITICAL ERROR: ADMIN_PANEL_ORIGIN is not set via os.getenv")
if not APPWRITE_ENDPOINT:
    print("CRITICAL ERROR: APPWRITE_ENDPOINT is not set via os.getenv")
if not APPWRITE_PROJECT_ID:
    print("CRITICAL ERROR: APPWRITE_PROJECT_ID is not set via os.getenv")
else:
    print(f"DEBUG: APPWRITE_PROJECT_ID loaded: {APPWRITE_PROJECT_ID[:5]}...")
# Instagram OAuth Configuration
INSTAGRAM_APP_ID = os.getenv("INSTAGRAM_APP_ID")
INSTAGRAM_APP_SECRET = os.getenv("INSTAGRAM_APP_SECRET")
INSTAGRAM_REDIRECT_URI = os.getenv("INSTAGRAM_REDIRECT_URL")
if not INSTAGRAM_REDIRECT_URI:
    INSTAGRAM_REDIRECT_URI = f"{FRONTEND_ORIGIN}/auth/ig-callback"
    print(f"WARNING: INSTAGRAM_REDIRECT_URL not set, defaulting to {INSTAGRAM_REDIRECT_URI}")
INSTAGRAM_AUTH_URL = os.getenv("INSTAGRAM_AUTH_URL")

# A list of allowed origins for CORS
FRONTEND_ORIGINS = [
    FRONTEND_ORIGIN,
    ADMIN_PANEL_ORIGIN,
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:3000"
]

USERS_COLLECTION_ID = "users"
SETTINGS_COLLECTION_ID = "settings"
CAMPAIGNS_COLLECTION_ID = "campaigns"
IG_ACCOUNTS_COLLECTION_ID = "ig_accounts"

# Cache for processed OAuth secrets to prevent duplicate callback requests
# This prevents errors when the same callback is triggered multiple times
processed_oauth_secrets = {}

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": FRONTEND_ORIGINS}}, supports_credentials=True)
csrf = CSRFProtect(app)

app.logger.setLevel(logging.DEBUG)
if not app.logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.DEBUG)
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    app.logger.addHandler(handler)

app.secret_key = os.getenv("FLASK_SECRET_KEY", "default-secret-key")

# Razorpay Configuration
import razorpay
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

# ==============================================================================
# IMPORTANT ARCHITECTURE NOTE:
# This Flask backend acts as a secure intermediary between the frontend and Appwrite.
# The frontend NEVER communicates directly with Appwrite. All authentication and
# data operations are handled by this server, which uses the secure, admin-level
# Appwrite SDK. This is a pure Server-Side Rendering (SSR) pattern.
# ==============================================================================
def is_valid_email(email):
    # Allow + in email for sub-addressing
    pattern = r'^[\w\.\-\+]+@[\w\.-]+\.\w+$'
    return re.match(pattern, email) is not None

def get_appwrite_client(use_api_key=False, session_token=None, headers=None):
    client = Client()
    client.set_endpoint(APPWRITE_ENDPOINT)
    client.set_project(APPWRITE_PROJECT_ID)
    
    if headers:
        for key, value in headers.items():
            if value:
                client.add_header(key, value)

    if use_api_key:
        client.set_key(APPWRITE_API_KEY)
    elif session_token:
        # app.logger.debug(f"Setting session token: {session_token[:10]}...")
        client.set_session(session_token)
    return client
 
def get_session_secret(session):
    if isinstance(session, dict):
        return session.get('secret')
    return getattr(session, 'secret', None)

def manage_user_on_login(user):
    if hasattr(user, 'to_dict'):
        user = user.to_dict()
    
    user_id = user.get('$id')
    user_name = user.get('name', 'N/A')
    user_email = user.get('email', 'N/A')

    try:
        server_client = get_appwrite_client(use_api_key=True)
        databases = Databases(server_client)
        existing_docs = databases.list_documents(
            APPWRITE_DATABASE_ID,
            USERS_COLLECTION_ID,
            queries=[Query.equal('$id', user_id)]
        )['documents']

        if not existing_docs:
            app.logger.info(f"Creating new user document for userId: {user_id}")
            databases.create_document(
                APPWRITE_DATABASE_ID,
                USERS_COLLECTION_ID,
                user_id,
                {
                    'name': user_name,
                    'email': user_email,
                },
                permissions=[
                    Permission.read(Role.user(user_id)),
                    Permission.update(Role.user(user_id)),
                ]
            )
        else:
            document_id = existing_docs[0]['$id']
            app.logger.info(f"Updating user document for userId: {user_id}, docId: {document_id}")
            databases.update_document(
                APPWRITE_DATABASE_ID,
                USERS_COLLECTION_ID,
                document_id,
                {
                    'name': user_name,
                    'email': user_email,
                }
            )
    except AppwriteException as e:
        app.logger.error(f"Failed to manage user document for {user_id}: {e}")

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        session_token = request.cookies.get('session_token')
        if not session_token:
            auth_header = request.headers.get('Authorization')
            if not auth_header or not auth_header.startswith('Bearer '):
                return jsonify({'error': 'Not authorized'}), 401
            session_token = auth_header.split(' ')[1]
        app.logger.debug(f"login_required received token: {session_token[:10]}... Length: {len(session_token)}")
        
        # Forward User-Agent and IP to mimic the client
        forward_headers = {
            'User-Agent': request.headers.get('User-Agent'),
            'X-Forwarded-For': request.headers.get('X-Forwarded-For', request.remote_addr)
        }
        
        client = get_appwrite_client(session_token=session_token)
        
        try:
            account = Account(client)
            g.user = account.get()
            if hasattr(g.user, 'to_dict'):
                g.user = g.user.to_dict()
            else:
                g.user = g.user
            g.appwrite_client = client
            app.logger.debug(f"User {g.user.get('$id')} authenticated successfully.")
        except AppwriteException as e:
            app.logger.error(f"AppwriteException in login_required: {e}")
            response = make_response(jsonify({'error': 'Session is invalid'}))
            response.status_code = 401
            response.delete_cookie('session_token')
            return response
            
        return f(*args, **kwargs)
    return decorated_function

# Disposable email domains (comprehensive list)
DISPOSABLE_DOMAINS = {
    # Popular temporary email services
    "tempmail.com", "temp-mail.org", "temp-mail.io", "tempmail.net",
    "throwawaymail.com", "mailinator.com", "guerrillamail.com", "guerrillamail.org",
    "yopmail.com", "yopmail.fr", "yopmail.net",
    "10minutemail.com", "10minutemail.net", "10minmail.com",
    "sharklasers.com", "getnada.com", "getnada.cc",
    "dispostable.com", "grr.la", "guerillamail.com",
    "mailnesia.com", "maildrop.cc", "mailsac.com",
    "mohmal.com", "fakeinbox.com", "tempinbox.com",
    "trashmail.com", "trashmail.net", "trashmail.org",
    "mailcatch.com", "mytrashmail.com", "safetymail.info",
    "spamgourmet.com", "spamex.com", "spam4.me",
    "emailondeck.com", "tempmailaddress.com", "throwaway.email",
    "tempail.com", "crazymailing.com", "tempmails.org",
    "fakemailgenerator.com", "emailfake.com", "tempemails.io",
    "burnermail.io", "minutemail.com", "getairmail.com",
    "dropmail.me", "harakirimail.com", "mailslurp.com",
    "inboxkitten.com", "email-generator.com", "guerrillamailblock.com",
    "mintemail.com", "spaml.com", "spaml.de",
    "fakemail.fr", "jetable.org", "nwytg.net",
    "emkei.cz", "anonymbox.com", "33mail.com",
    "anonaddy.com", "simplelogin.io",
}

def normalize_email(email):
    """
    Normalizes email addresses.
    - Lowercases the email.
    - For Gmail: removes dots and ignores everything after '+' in the local part.
    """
    email = email.lower().strip()
    if '@' not in email:
        return email
    
    local, domain = email.split('@', 1)
    
    if domain in ['gmail.com', 'googlemail.com']:
        local = local.split('+')[0]
        local = local.replace('.', '')
    
    return f"{local}@{domain}"

def is_disposable_email(email):
    domain = email.split('@')[-1].lower()
    return domain in DISPOSABLE_DOMAINS

@app.route('/api/register', methods=['POST'])
@csrf.exempt # Exempt this stateless API endpoint from CSRF protection
def register():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    name = data.get('name')

    if not is_valid_email(email):
        return jsonify({'error': 'Invalid email format.'}), 400
        
    if is_disposable_email(email):
        return jsonify({'error': 'Disposable email addresses are not allowed.'}), 400
        
    normalized_email = normalize_email(email)
    
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters long.'}), 400

    try:
        server_client = get_appwrite_client(use_api_key=True)
        users = Users(server_client)
        
        # Create the user with email and password using Users service (Admin SDK)
        # This properly sets up the email/password identity
        new_user = users.create(
            user_id=ID.unique(),
            email=normalized_email,
            password=password,
            name=name
        )
        
        # Assign 'user' label for RLS
        try:
            users.update_labels(new_user['$id'], ['user'])
        except Exception as label_error:
            app.logger.error(f"Failed to assign 'user' label: {label_error}")
        
        # To send a verification email, we must act on the user's behalf.
        # 1. Create a temporary session for the new user.
        # 2. Use that session to create a client and send the verification.
        # 3. Delete the temporary session immediately.
        temp_session = users.create_session(new_user['$id'])
        
        # Create a client acting as the new user
        user_client = get_appwrite_client(session_token=temp_session['secret'])
        user_account = Account(user_client)
        
        # Now, create the verification email from the user's perspective
        user_account.create_verification(url=f"{FRONTEND_ORIGIN}/auth/verify")
        
        # IMPORTANT: Immediately delete the temporary session.
        # The user should not be logged in until they click the verification link.
        user_account.delete_session('current')
        
        # We still want to create their associated document in our 'users' collection
        manage_user_on_login(new_user)

        return jsonify({'message': 'Registration successful. Please check your email to verify your account.'}), 201
    except AppwriteException as e:
        if e.code == 409:
             return jsonify({'error': 'User with this email already exists.'}), 409
        app.logger.error(f"Error during registration: {e}")
        return jsonify({'error': 'Registration failed.'}), 500

@app.route('/api/login', methods=['POST'])
@csrf.exempt
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400

    # Normalize email
    normalized_email = normalize_email(email)
    
    # Debug: Check user status via Admin API
    try:
        server_client = get_appwrite_client(use_api_key=True)
        users = Users(server_client)
        user_docs = users.list(queries=[Query.equal('email', normalized_email)])
        
        if not user_docs['users']:
            app.logger.warning(f"Login failed: User {normalized_email} not found in Appwrite.")
            return jsonify({'error': 'Invalid email or password.'}), 401
            
        user = user_docs['users'][0]
        app.logger.info(f"User found: {user['$id']}, Status: {user['status']}, EmailVerification: {user['emailVerification']}")
        
        if not user['status']:
            return jsonify({'error': 'Account is disabled.'}), 403
            
    except Exception as e:
        app.logger.error(f"Admin check failed: {e}")

    # Attempt Login
    try:
        # Step 1: Verify credentials by attempting to create a session.
        # We use a temporary client for this. If it fails, it throws an exception.
        temp_client = get_appwrite_client()
        temp_account = Account(temp_client)
        validation_session = temp_account.create_email_password_session(email=normalized_email, password=password)
        
        # If we reach here, the password is valid.
        # For security, immediately delete the temporary session we just created.
        # The `temp_account` is now authenticated with this session, so it can delete it.
        try:
            temp_account.delete_session('current')
        except AppwriteException as e:
            app.logger.warning(f"Could not delete temporary validation session: {e}")

        # Step 2: Now that credentials are verified, use the ADMIN client to create a new, clean session.
        # We already have the user object from the check at the top of this function.
        user_id = user['$id']
        server_client = get_appwrite_client(use_api_key=True)
        users = Users(server_client)
        
        # Create a new session for the user.
        new_session = users.create_session(user_id)
        token = get_session_secret(new_session)
        
        # Step 3: Manage the user document in our database.
        # We can use the user object we fetched earlier.
        manage_user_on_login(user)

        resp = make_response(jsonify({'token': token}))
        resp.set_cookie('session_token', token, httponly=True, secure=True, samesite='Lax', max_age=86400*30)
        return resp
        
    except AppwriteException as e:
        app.logger.error(f"Login failed: {e.message}, Code: {e.code}, Type: {e.type}")
        
        if e.code == 429:
            return jsonify({'error': 'Too many login attempts. Please try again later.'}), 429
            
        if e.code == 401:
            return jsonify({'error': 'Invalid email or password.'}), 401
            
        return jsonify({'error': 'An unexpected error occurred during login.'}), 500

@app.route('/api/me', methods=['GET'])
@login_required
def get_current_user():
    user_data = g.user.copy()
    password_update = user_data.get('passwordUpdate')
    has_password = bool(password_update and password_update != '')
    
    if not has_password and 'identities' in user_data:
        has_password = any(identity.get('provider') == 'email' for identity in user_data['identities'])
    
    user_data['hasPassword'] = has_password
    
    # Check for linked Instagram accounts
    try:
        server_client = get_appwrite_client(use_api_key=True)
        databases = Databases(server_client)
        ig_accounts = databases.list_documents(
            APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            queries=[Query.equal('user_id', g.user['$id'])]
        )['documents']
        
        user_data['hasLinkedInstagram'] = len(ig_accounts) > 0
        if ig_accounts:
            # Return the first (primary) Instagram account details
            primary_ig = ig_accounts[0]
            user_data['instagram_username'] = primary_ig.get('username')
            user_data['instagram_profile_pic_url'] = primary_ig.get('profile_picture_url')
            user_data['ig_accounts'] = ig_accounts
        else:
            user_data['instagram_username'] = None
            user_data['instagram_profile_pic_url'] = None
            user_data['ig_accounts'] = []
    except AppwriteException as e:
        app.logger.error(f"Error fetching IG accounts: {e}")
        user_data['hasLinkedInstagram'] = False
        user_data['instagram_username'] = None
        user_data['instagram_profile_pic_url'] = None
        user_data['ig_accounts'] = []
    
    return jsonify(user_data)

@app.route('/api/account/set-password', methods=['POST'])
@csrf.exempt
@login_required
def set_password():
    user_id = g.user['$id']
    user_email = g.user.get('email')
    app.logger.info(f"Setting password for user_id: {user_id}, email: {user_email}")

    data = request.get_json()
    password = data.get('password')

    if not password or len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters long.'}), 400

    try:
        # 1. Update password using Server SDK (admin privileges)
        server_client = get_appwrite_client(use_api_key=True)
        users = Users(server_client)
        users.update_password(user_id=user_id, password=password)
        app.logger.info("Password updated via Server SDK")
        
        # 2. Create a new session for the user immediately (Optional but good UX)
        # Since we are NOT deleting sessions, the current session *might* still be valid depending on Appwrite settings.
        # However, to be safe and ensure a fresh state, we can issue a new one or just let the client re-check.
        # Per user request: "check session status before loggin out user".
        # We will NOT delete sessions here.
        
        return jsonify({'message': 'Password set successfully'}), 200
    except AppwriteException as e:
        app.logger.error(f"AppwriteException in set_password: {e}")
        if e.code == 400 and 'password' in e.message.lower():
             return jsonify({'error': f"Password error: {e.message}"}), 400
        return jsonify({'error': 'Failed to set password.'}), e.code or 500

@app.route('/api/account/has-password', methods=['GET'])
@login_required
def has_password():
    user_data = g.user
    password_update = user_data.get('passwordUpdate')
    has_password = bool(password_update and password_update != '')
    if not has_password and 'identities' in user_data:
        has_password = any(identity.get('provider') == 'email' for identity in user_data['identities'])
    return jsonify({'hasPassword': has_password})

@app.route('/logout')
def logout():
    session_token = request.cookies.get('session_token')
    if not session_token:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            session_token = auth_header.split(' ')[1]

    if session_token:
        try:
            client = get_appwrite_client(session_token=session_token)
            account = Account(client)
            account.delete_session('current')
        except AppwriteException:
            pass
            
    response = jsonify({'message': 'Logged out'})
    response.delete_cookie('session_token')
    return response

@app.route('/auth/google')
def auth_google():
    client = get_appwrite_client()
    account = Account(client)
    try:
        redirect_url = account.create_o_auth2_token(
            provider='google',
            success=f"{FRONTEND_ORIGIN}/auth/callback",
            failure=f"{FRONTEND_ORIGIN}/login?error=oauth_failed",
        )
        return jsonify({'url': redirect_url})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/google-callback', methods=['GET'])
def api_auth_google_callback():
    user_id = request.args.get('userId')
    secret = request.args.get('secret')

    if not APPWRITE_API_KEY:
        app.logger.error("CRITICAL: APPWRITE_API_KEY is not set!")
        return jsonify({'error': 'Server configuration error.'}), 500

    if not secret or not user_id:
        return jsonify({'error': 'Missing userId or secret'}), 400

    # Duplicate request protection: check if this secret was already processed
    cache_key = f"{user_id}:{secret[:16]}"  # Use truncated secret for cache key
    if cache_key in processed_oauth_secrets:
        cached_token = processed_oauth_secrets[cache_key]
        if cached_token:
            app.logger.info(f"Returning cached token for duplicate OAuth callback: {user_id}")
            return jsonify({'token': cached_token}), 200
        else:
            app.logger.info(f"Ignoring duplicate OAuth callback (already failed): {user_id}")
            return jsonify({'error': 'This OAuth session has already been processed.'}), 400

    try:
        # Use a server-side client with an API key to create the session
        server_client = get_appwrite_client(use_api_key=True)
        account = Account(server_client)
        users = Users(server_client)
        
        # Create a session for the user using the secret from the OAuth flow
        session = account.create_session(user_id, secret)
        session_token = get_session_secret(session)

        # Get the user details using the new session
        user_client = get_appwrite_client(session_token=session_token)
        user = Account(user_client).get()
        
        email = user.get('email')
        current_user_id = user.get('$id')

        if email:
            # 1. Strict Check: Disposable Email
            if is_disposable_email(email):
                app.logger.warning(f"Blocking disposable email login: {email}")
                # Delete the user as they are not allowed
                users.delete(current_user_id)
                return jsonify({'error': 'Disposable email addresses are not allowed.'}), 400

            # 2. Strict Check: Duplicate Account Prevention
            # Search for all users with this email
            user_docs = users.list(queries=[Query.equal('email', email)])
            
            if user_docs['total'] > 1:
                app.logger.info(f"Duplicate accounts found for email {email}. Total: {user_docs['total']}")
                
                # Sort by registration date to find the oldest (original) account
                # Registration is an ISO string, so string sort works for chronological order
                sorted_users = sorted(user_docs['users'], key=lambda u: u['registration'])
                original_user = sorted_users[0]
                
                if original_user['$id'] != current_user_id:
                    app.logger.warning(f"User {current_user_id} is a duplicate of {original_user['$id']}. Deleting new user.")
                    # The current user is a new duplicate. Delete it.
                    users.delete(current_user_id)
                    return jsonify({'error': 'An account with this email already exists. Please log in with your password.'}), 409

        manage_user_on_login(user)
        
        # Cache the token for duplicate request protection
        processed_oauth_secrets[cache_key] = session_token
        
        app.logger.info(f"Appwrite session object: {session}")
        return jsonify({'token': session_token}), 200
    except AppwriteException as e:
        # Cache as None to prevent retries on failed secrets
        processed_oauth_secrets[cache_key] = None
        app.logger.error(f"Google callback API error: {e.message}, Code: {e.code}, Response: {e.response}")
        return jsonify({'error': 'Failed to create session from Google OAuth.'}), 500

# ==============================================================================
# IMPORTANT ARCHITECTURE NOTE: Email Verification Callback
# This endpoint handles the final step of email verification.
# 1. The user clicks the link in their email, which directs them to the frontend
#    at /auth/verify.
# 2. The frontend extracts the userId and secret from the URL and sends them here.
# 3. This endpoint uses the Admin API Key to securely validate the secret with
#    Appwrite using `account.update_verification()`.
# 4. If valid, it creates a new session for the user and returns the session token.
# 5. The frontend receives the token and logs the user in.
# ==============================================================================
@app.route('/api/auth/verify-callback', methods=['POST'])
@csrf.exempt
def api_auth_verify_callback():
    data = request.get_json()
    user_id = data.get('userId')
    secret = data.get('secret')

    if not user_id or not secret:
        return jsonify({'error': 'Missing user ID or secret'}), 400

    try:
        # The `update_verification` method must be called from a client-side context.
        # We create a new, unauthenticated (guest) client for this purpose.
        guest_client = get_appwrite_client()
        guest_account = Account(guest_client)

        # This validates the secret and marks the email as verified in Appwrite.
        guest_account.update_verification(user_id=user_id, secret=secret)

        # Now that verification is successful, use the secure ADMIN client
        # to create a session for the user.
        server_client = get_appwrite_client(use_api_key=True)
        users = Users(server_client)
        session = users.create_session(user_id)
        token = get_session_secret(session)

        app.logger.info(f"User {user_id} completed email verification and created a session.")
        return jsonify({'token': token}), 200
    except AppwriteException as e:
        app.logger.error(f"Email verification callback error: {e.message}, Code: {e.code}")
        return jsonify({'error': 'Invalid or expired verification link.'}), 401

@app.route('/api/create-order', methods=['POST'])
@csrf.exempt
@login_required
def create_order():
    try:
        data = request.get_json()
        amount = data.get('amount')
        currency = data.get('currency', 'INR')
        
        if not amount:
            return jsonify({'error': 'Amount is required'}), 400

        order_data = {
            "amount": amount,
            "currency": currency,
            "receipt": f"receipt_{g.user['$id']}_{datetime.datetime.now().timestamp()}",
            "payment_capture": 1
        }
        
        order = razorpay_client.order.create(data=order_data)
        return jsonify(order), 200
    except Exception as e:
        app.logger.error(f"Error creating Razorpay order: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/verify-payment', methods=['POST'])
@csrf.exempt
@login_required
def verify_payment():
    data = request.get_json()
    razorpay_order_id = data.get('razorpay_order_id')
    razorpay_payment_id = data.get('razorpay_payment_id')
    razorpay_signature = data.get('razorpay_signature')

    if not razorpay_order_id or not razorpay_payment_id or not razorpay_signature:
        return jsonify({'error': 'Missing payment details'}), 400

    try:
        # Verify signature
        params_dict = {
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature
        }
        razorpay_client.utility.verify_payment_signature(params_dict)
        
        # Payment is successful. You should now update the user's subscription status in Appwrite.
        # For now, we will just log it.
        app.logger.info(f"Payment verified for user {g.user['$id']}. Payment ID: {razorpay_payment_id}")
        
        return jsonify({'message': 'Payment verified successfully'}), 200
    except razorpay.errors.SignatureVerificationError:
        return jsonify({'error': 'Payment verification failed'}), 400
    except Exception as e:
        app.logger.error(f"Error verifying payment: {e}")
        return jsonify({'error': str(e)}), 500



@app.route('/api/dashboard')
@login_required
def api_dashboard():
    try:
        user_id = g.user['$id']
        databases = Databases(g.appwrite_client)
        campaigns_response = databases.list_documents(
            APPWRITE_DATABASE_ID,
            CAMPAIGNS_COLLECTION_ID,
            queries=[Query.equal("user_id", user_id)]
        )
        campaigns_data = campaigns_response['documents']
        
        user_settings = {}
        try:
            settings_docs = databases.list_documents(
                APPWRITE_DATABASE_ID,
                SETTINGS_COLLECTION_ID,
                queries=[Query.equal('$id', user_id)]
            )['documents']
            if settings_docs:
                user_settings = settings_docs[0]
            else:
                server_client = get_appwrite_client(use_api_key=True)
                server_databases = Databases(server_client)
                user_settings = server_databases.create_document(
                    APPWRITE_DATABASE_ID,
                    SETTINGS_COLLECTION_ID,
                    user_id,
                    {'dark_mode': False, 'notification_preference': 'email'},
                    permissions=[Permission.read(Role.user(user_id)), Permission.update(Role.user(user_id))]
                )
        except AppwriteException:
            user_settings = {}

        dashboard_data = {
            'active_campaigns': len([c for c in campaigns_data if c.get('status') == 'active']),
            'dms_sent_24h': 0,
            'new_contacts': 0,
            'reply_rate': "0%",
            'campaigns': campaigns_data,
            'user_settings': {
                'dark_mode': user_settings.get('dark_mode', False),
                'notification_preference': user_settings.get('notification_preference', 'email')
            }
        }
        return jsonify(dashboard_data)
    except AppwriteException as e:
        app.logger.error(f"Error fetching dashboard data: {e}")
        return jsonify({'error': 'Failed to fetch dashboard data'}), 500

@app.route('/api/account/update', methods=['POST'])
@csrf.exempt 
@login_required
def update_account():
    user_id = g.user['$id']
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')

    try:
        server_client = get_appwrite_client(use_api_key=True)
        # Use the Users service for admin-level user updates
        server_users = Users(server_client)
        server_databases = Databases(server_client)

        # Fetch fresh user data to ensure we have identities
        try:
            user_details = server_users.get(user_id)
        except AppwriteException:
            # Fallback to g.user if fetch fails, though unlikely if token is valid
            user_details = g.user

        if name and name != user_details.get('name'):
            # Corrected: Use the Users service with the correct arguments
            server_users.update_name(user_id=user_id, name=name)
        
        if email and email != user_details.get('email'):
            if is_disposable_email(email):
                return jsonify({'error': 'Disposable email addresses are not allowed.'}), 400
            
            normalized_email = normalize_email(email)
            
            # Check if user has a password set (password hash exists on user object)
            has_password = bool(user_details.get('password'))
            
            if not has_password:
                return jsonify({'error': 'Please set a password first.'}), 400
            if not password:
                return jsonify({'error': 'Password required.'}), 400
            
            try:
                # We need to use the USER's client to update their own email with password confirmation
                user_account = Account(g.appwrite_client)
                user_account.update_email(normalized_email, password)
                
                # Send verification email to the new address
                try:
                    user_account.create_verification(url=f"{FRONTEND_ORIGIN}/auth/verify")
                    app.logger.info(f"Verification email sent to {normalized_email}")
                except AppwriteException as ve:
                    app.logger.warning(f"Could not send verification email: {ve}")
                
            except AppwriteException as e:
                if 'password' in str(e).lower():
                    return jsonify({'error': 'Invalid password.'}), 401
                raise e

        update_data = {}
        if name: update_data['name'] = name
        if email: update_data['email'] = normalize_email(email)
        
        if update_data:
            try:
                server_databases.update_document(APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, user_id, update_data)
            except AppwriteException as e:
                if e.code == 404:
                    # Document doesn't exist, create it
                    app.logger.info(f"User document not found for {user_id}, creating new one.")
                    server_databases.create_document(
                        APPWRITE_DATABASE_ID, 
                        USERS_COLLECTION_ID, 
                        user_id, 
                        {
                            'name': name or user_details.get('name'),
                            'email': email or user_details.get('email'),
                            # Add other default fields if necessary
                        }
                    )
                else:
                    raise e

        # Different response if email was changed (to prompt re-verification)
        if email and email != user_details.get('email'):
            return jsonify({
                'message': 'Email updated. Please check your inbox to verify your new email address.',
                'emailChanged': True
            }), 200

        return jsonify({'message': 'Account updated successfully'}), 200
    except AppwriteException as e:
        app.logger.error(f"Error updating account: {e}")
        return jsonify({'error': 'Failed to update account.'}), 500

@app.route('/api/account/change-password', methods=['POST'])
@csrf.exempt
@login_required
def change_password():
    data = request.get_json()
    new_password = data.get('newPassword')

    if not new_password:
        return jsonify({'error': 'New password is required.'}), 400
    
    if len(new_password) < 8:
        return jsonify({'error': 'New password must be at least 8 characters long.'}), 400

    try:
        # Use server SDK to update password directly without requiring old password
        user_id = g.user['$id']
        server_client = get_appwrite_client(use_api_key=True)
        users = Users(server_client)
        users.update_password(user_id=user_id, password=new_password)
        
        # We do NOT delete sessions here anymore, per user request.
        # Appwrite "Invalidate Session" setting will control if the current session remains valid.
        
        return jsonify({'message': 'Password updated successfully.'}), 200
    except AppwriteException as e:
        app.logger.error(f"Error changing password: {e}")
        return jsonify({'error': 'Failed to update password.'}), 500

@app.route('/api/account/delete', methods=['DELETE'])
@csrf.exempt
@login_required
def delete_account():
    user_id = g.user['$id']
    user_email = g.user.get('email')
    
    data = request.get_json()
    password = data.get('password')

    if not password:
        return jsonify({'error': 'Password is required to delete account.'}), 400

    try:
        # 1. Verify password by attempting to create a session (simulating login)
        # We use a fresh client for this verification to ensure the password is correct
        # for the current user.
        client = get_appwrite_client()
        account = Account(client)
        
        # This will throw an exception if the password is invalid
        # We don't need to keep this session, just verify it can be created
        session = account.create_email_password_session(email=user_email, password=password)
        
        # If we get here, password is correct. Clean up the test session.
        try:
            account.delete_session(session['$id'])
        except:
            pass # Ignore cleanup errors

        # 2. Delete the user completely using Server SDK
        server_client = get_appwrite_client(use_api_key=True)
        users = Users(server_client)
        users.delete(user_id)
        
        return jsonify({'message': 'Account deleted successfully'}), 200
        
    except AppwriteException as e:
        app.logger.error(f"Error deleting account: {e}")
        if e.code == 401:
             return jsonify({'error': 'Invalid password.'}), 401
        return jsonify({'error': 'Failed to delete account.'}), 500

@app.route('/api/account/change-unverified-email', methods=['POST'])
@csrf.exempt
@login_required
def change_unverified_email():
    """
    Allows a logged-in but unverified user to change their email.
    This endpoint:
    1. Updates the user's email using the admin API.
    2. Sends a new verification email to the new address.
    """
    user_id = g.user['$id']
    data = request.get_json()
    new_email = data.get('email')

    if not new_email:
        return jsonify({'error': 'New email is required.'}), 400

    if not is_valid_email(new_email):
        return jsonify({'error': 'Invalid email format.'}), 400

    if is_disposable_email(new_email):
        return jsonify({'error': 'Disposable email addresses are not allowed.'}), 400

    normalized_email = normalize_email(new_email)

    try:
        server_client = get_appwrite_client(use_api_key=True)
        server_users = Users(server_client)

        # Update the user's email using admin API
        server_users.update_email(user_id=user_id, email=normalized_email)

        # Send a new verification email
        # Create a temporary session to send verification from user's perspective
        temp_session = server_users.create_session(user_id)
        user_client = get_appwrite_client(session_token=temp_session['secret'])
        user_account = Account(user_client)
        
        user_account.create_verification(url=f"{FRONTEND_ORIGIN}/auth/verify")
        
        # Delete the temporary session
        user_account.delete_session('current')

        return jsonify({'message': f'Email changed to {normalized_email}. A new verification link has been sent.'}), 200

    except AppwriteException as e:
        app.logger.error(f"Error changing unverified email: {e}")
        if e.code == 409:
            return jsonify({'error': 'This email is already in use by another account.'}), 409
        return jsonify({'error': 'Failed to change email.'}), 500

@app.route('/api/settings', methods=['POST'])
@csrf.exempt
@login_required
def update_settings():
    user_id = g.user['$id']
    data = request.get_json()
    update_data = {}
    if 'dark_mode' in data: update_data['dark_mode'] = data['dark_mode']
    if 'notification_preference' in data: update_data['notification_preference'] = data['notification_preference']

    if not update_data:
        return jsonify({"error": "No settings provided"}), 400

    try:
        databases = Databases(g.appwrite_client)
        settings_docs = databases.list_documents(APPWRITE_DATABASE_ID, SETTINGS_COLLECTION_ID, queries=[Query.equal("$id", user_id)])['documents']
        
        if settings_docs:
            databases.update_document(APPWRITE_DATABASE_ID, SETTINGS_COLLECTION_ID, settings_docs[0]['$id'], update_data)
        else:
            databases.create_document(APPWRITE_DATABASE_ID, SETTINGS_COLLECTION_ID, user_id, update_data)
            
        return jsonify({'message': 'Settings updated'}), 200
    except AppwriteException as e:
        app.logger.error(f"Error updating settings: {e}")
        return jsonify({'error': 'Failed to update settings'}), 500


@app.route('/api/forgot-password', methods=['POST'])
@csrf.exempt
def forgot_password():
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({'error': 'Email is required.'}), 400
    
    normalized_email = normalize_email(email)
    
    try:
        # Check if user exists
        server_client = get_appwrite_client(use_api_key=True)
        users = Users(server_client)
        user_list = users.list(queries=[Query.equal('email', normalized_email)])
        
        if not user_list['users']:
            # Don't reveal if user exists or not for security
            return jsonify({'message': 'If an account with that email exists, a password reset link has been sent.'}), 200
        
        user = user_list['users'][0]
        user_id = user['$id']
        
        # Use Appwrite's password recovery
        # This will send an email with a recovery link to /auth/recovery?userId=...&secret=...&expire=...
        account = Account(server_client)
        account.create_recovery(email=normalized_email, url=f"{FRONTEND_ORIGIN}/auth/recovery")
        
        app.logger.info(f"Password recovery email sent for user {user_id}")
        
        return jsonify({'message': 'If an account with that email exists, a password reset link has been sent.'}), 200
    except AppwriteException as e:
        app.logger.error(f"Forgot password error: {e.message}, Code: {e.code}")
        return jsonify({'message': 'If an account with that email exists, a password reset link has been sent.'}), 200

@app.route('/api/auth/recovery', methods=['POST'])
@csrf.exempt
def password_recovery():
    data = request.get_json()
    user_id = data.get('userId')
    secret = data.get('secret')
    new_password = data.get('newPassword')
    confirm_password = data.get('confirmPassword')
    
    if not user_id or not secret:
        return jsonify({'error': 'Missing userId or secret'}), 400
    
    if not new_password or not confirm_password:
        return jsonify({'error': 'Password is required'}), 400
        
    if new_password != confirm_password:
        return jsonify({'error': 'Passwords do not match'}), 400
        
    if len(new_password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    
    try:
        # Complete the password recovery
        server_client = get_appwrite_client(use_api_key=True)
        account = Account(server_client)
        
        # This validates the recovery secret and updates the password
        account.update_recovery(user_id=user_id, secret=secret, password=new_password)
        
        app.logger.info(f"Password successfully reset for user {user_id}")
        
        return jsonify({'message': 'Password reset successful. You can now log in with your new password.'}), 200
    except AppwriteException as e:
        app.logger.error(f"Password recovery error: {e.message}, Code: {e.code}")
        if 'expired' in str(e).lower():
            return jsonify({'error': 'Recovery link has expired. Please request a new one.'}), 401
        return jsonify({'error': 'Invalid or expired recovery link.'}), 401

# ==============================================================================
# IMPORTANT ARCHITECTURE NOTE: Resend Verification Email
# This endpoint allows an authenticated but unverified user to request a new
# verification email.
# 1. The user must be logged in, so this route is protected by @login_required.
# 2. It uses the user's own session (via g.appwrite_client) to make the request,
#    which is the correct, secure way to perform this action.
# ==============================================================================
@app.route('/api/account/resend-verification', methods=['POST'])
@csrf.exempt
@login_required
def resend_verification():
    try:
        # The user's client is available from the login_required decorator
        user_account = Account(g.appwrite_client)
        user_account.create_verification(url=f"{FRONTEND_ORIGIN}/auth/verify")
        
        return jsonify({'message': 'A new verification email has been sent.'}), 200
    except AppwriteException as e:
        app.logger.error(f"Resend verification error: {e.message}, Code: {e.code}")
        # Appwrite often returns a 429 for rate-limiting if an email was sent recently
        if e.code == 429:
            return jsonify({'error': 'A verification email was sent recently. Please wait a few minutes before trying again.'}), 429
        return jsonify({'error': 'Failed to resend verification email.'}), 500

# ==============================================================================
# INSTAGRAM OAUTH INTEGRATION
# ==============================================================================

@app.route('/auth/instagram')
def auth_instagram():
    """
    Returns the Instagram authorization URL for the user to authorize the app.
    """
    if INSTAGRAM_AUTH_URL:
        return jsonify({'url': INSTAGRAM_AUTH_URL})

    if not INSTAGRAM_APP_ID:
        return jsonify({'error': 'Instagram integration is not configured.'}), 500
    
    scopes = 'instagram_business_basic,instagram_business_manage_messages'
    auth_url = (
        f"https://www.instagram.com/oauth/authorize"
        f"?client_id={INSTAGRAM_APP_ID}"
        f"&redirect_uri={INSTAGRAM_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope={scopes}"
    )
    return jsonify({'url': auth_url})

@app.route('/api/auth/instagram-callback', methods=['POST'])
@csrf.exempt
@login_required
def api_auth_instagram_callback():
    """
    Handle Instagram OAuth callback.
    1. Exchange authorization code for short-lived token
    2. Exchange short-lived for long-lived token
    3. Fetch Instagram user profile
    4. Check for duplicate accounts
    5. Save to database
    """
    data = request.get_json()
    code = data.get('code')
    
    if not code:
        return jsonify({'error': 'Authorization code is required'}), 400
    
    if not INSTAGRAM_APP_ID or not INSTAGRAM_APP_SECRET:
        return jsonify({'error': 'Instagram integration is not configured.'}), 500
    
    user_id = g.user['$id']
    
    try:
        # Step 1: Exchange code for short-lived access token
        token_response = requests.post(
            'https://api.instagram.com/oauth/access_token',
            data={
                'client_id': INSTAGRAM_APP_ID,
                'client_secret': INSTAGRAM_APP_SECRET,
                'grant_type': 'authorization_code',
                'redirect_uri': INSTAGRAM_REDIRECT_URI,
                'code': code
            }
        )
        
        if token_response.status_code != 200:
            app.logger.error(f"IG token exchange failed: {token_response.text}")
            return jsonify({'error': 'Failed to exchange authorization code.'}), 400
        
        token_data = token_response.json()
        
        # Handle both response formats (data array or direct)
        if 'data' in token_data and isinstance(token_data['data'], list):
            short_lived_token = token_data['data'][0]['access_token']
            ig_user_id = str(token_data['data'][0]['user_id'])
            permissions = token_data['data'][0].get('permissions', '')
        else:
            short_lived_token = token_data.get('access_token')
            ig_user_id = str(token_data.get('user_id'))
            permissions = token_data.get('permissions', '')
        
        if not short_lived_token:
            return jsonify({'error': 'Failed to get access token.'}), 400
        
        # Step 2: Exchange short-lived token for long-lived token
        long_lived_response = requests.get(
            'https://graph.instagram.com/access_token',
            params={
                'grant_type': 'ig_exchange_token',
                'client_secret': INSTAGRAM_APP_SECRET,
                'access_token': short_lived_token
            }
        )
        
        if long_lived_response.status_code != 200:
            app.logger.error(f"IG long-lived token exchange failed: {long_lived_response.text}")
            return jsonify({'error': 'Failed to get long-lived token.'}), 400
        
        long_lived_data = long_lived_response.json()
        long_lived_token = long_lived_data.get('access_token')
        expires_in = long_lived_data.get('expires_in', 5184000)  # Default 60 days in seconds
        
        # Calculate expiration datetime
        token_expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=expires_in)
        
        # Step 3: Fetch Instagram user profile
        profile_response = requests.get(
            f'https://graph.instagram.com/me',
            params={
                'fields': 'id,username,profile_picture_url',
                'access_token': long_lived_token
            }
        )
        
        if profile_response.status_code != 200:
            app.logger.error(f"IG profile fetch failed: {profile_response.text}")
            return jsonify({'error': 'Failed to fetch Instagram profile.'}), 400
        
        profile_data = profile_response.json()
        ig_username = profile_data.get('username', 'Unknown')
        profile_picture_url = profile_data.get('profile_picture_url', '')
        
        # Step 4: Check if this Instagram account is already linked to another user
        server_client = get_appwrite_client(use_api_key=True)
        databases = Databases(server_client)
        
        existing_accounts = databases.list_documents(
            APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            queries=[Query.equal('ig_user_id', ig_user_id)]
        )['documents']
        
        if existing_accounts:
            existing_owner = existing_accounts[0].get('user_id')
            if existing_owner != user_id:
                return jsonify({
                    'error': f'This Instagram account (@{ig_username}) is already linked to another user.'
                }), 409
            else:
                # Update existing record for the same user
                doc_id = existing_accounts[0]['$id']
                databases.update_document(
                    APPWRITE_DATABASE_ID,
                    IG_ACCOUNTS_COLLECTION_ID,
                    doc_id,
                    {
                        'username': ig_username,
                        'profile_picture_url': profile_picture_url,
                        'access_token': long_lived_token,
                        'token_expires_at': token_expires_at.isoformat(),
                        'permissions': permissions if isinstance(permissions, str) else ','.join(permissions),
                    }
                )
                app.logger.info(f"Updated existing IG account {ig_username} for user {user_id}")
                return jsonify({
                    'message': f'Instagram account @{ig_username} updated successfully.',
                    'username': ig_username,
                    'profile_picture_url': profile_picture_url
                }), 200
        
        # Step 5: Save new Instagram account to database
        databases.create_document(
            APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            ID.unique(),
            {
                'user_id': user_id,
                'ig_user_id': ig_user_id,
                'username': ig_username,
                'profile_picture_url': profile_picture_url,
                'access_token': long_lived_token,
                'token_expires_at': token_expires_at.isoformat(),
                'permissions': permissions if isinstance(permissions, str) else ','.join(permissions),
                'linked_at': datetime.datetime.now(datetime.timezone.utc).isoformat()
            },
            permissions=[
                Permission.read(Role.user(user_id)),
            ]
        )
        
        app.logger.info(f"Linked IG account {ig_username} to user {user_id}")
        
        return jsonify({
            'message': f'Instagram account @{ig_username} linked successfully.',
            'username': ig_username,
            'profile_picture_url': profile_picture_url
        }), 200
        
    except requests.RequestException as e:
        app.logger.error(f"Instagram API request failed: {e}")
        return jsonify({'error': 'Failed to communicate with Instagram API.'}), 500
    except AppwriteException as e:
        app.logger.error(f"Database error during IG linking: {e}")
        return jsonify({'error': 'Failed to save Instagram account.'}), 500

@app.route('/api/account/ig-accounts', methods=['GET'])
@login_required
def get_ig_accounts():
    """
    Get all Instagram accounts linked to the current user.
    """
    try:
        server_client = get_appwrite_client(use_api_key=True)
        databases = Databases(server_client)
        
        ig_accounts = databases.list_documents(
            APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            queries=[Query.equal('user_id', g.user['$id'])]
        )['documents']
        
        # Remove sensitive data from response
        safe_accounts = []
        for account in ig_accounts:
            safe_accounts.append({
                'id': account['$id'],
                'ig_user_id': account.get('ig_user_id'),
                'username': account.get('username'),
                'profile_picture_url': account.get('profile_picture_url'),
                'linked_at': account.get('linked_at'),
                'token_expires_at': account.get('token_expires_at')
            })
        
        return jsonify({'accounts': safe_accounts}), 200
    except AppwriteException as e:
        app.logger.error(f"Error fetching IG accounts: {e}")
        return jsonify({'error': 'Failed to fetch Instagram accounts.'}), 500

@app.route('/api/account/ig-accounts/<account_id>', methods=['DELETE'])
@csrf.exempt
@login_required
def delete_ig_account(account_id):
    """
    Unlink an Instagram account from the current user.
    """
    try:
        server_client = get_appwrite_client(use_api_key=True)
        databases = Databases(server_client)
        
        # Verify the account belongs to the current user
        account = databases.get_document(
            APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            account_id
        )
        
        if account.get('user_id') != g.user['$id']:
            return jsonify({'error': 'Account not found.'}), 404
        
        databases.delete_document(
            APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            account_id
        )
        
        app.logger.info(f"Unlinked IG account {account_id} from user {g.user['$id']}")
        return jsonify({'message': 'Instagram account unlinked successfully.'}), 200
    except AppwriteException as e:
        app.logger.error(f"Error unlinking IG account: {e}")
        if e.code == 404:
            return jsonify({'error': 'Account not found.'}), 404
        return jsonify({'error': 'Failed to unlink Instagram account.'}), 500

@app.route('/api/instagram/stats', methods=['GET'])
@login_required
def get_instagram_stats():
    """
    Get Instagram stats (followers, media count) for the linked account.
    """
    try:
        server_client = get_appwrite_client(use_api_key=True)
        databases = Databases(server_client)
        
        # Get the linked Instagram account for the user
        ig_accounts = databases.list_documents(
            APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            queries=[Query.equal('user_id', g.user['$id'])]
        )['documents']
        
        if not ig_accounts:
            return jsonify({'error': 'No Instagram account linked.'}), 404
            
        ig_account = ig_accounts[0] # Assuming one account for now
        access_token = ig_account.get('access_token')
        ig_user_id = ig_account.get('ig_user_id')
        
        if not access_token:
             return jsonify({'error': 'Invalid Instagram session.'}), 401

        # Fetch stats from Instagram Graph API
        # Using graph.instagram.com as per Instagram API with Instagram Login
        response = requests.get(
            f'https://graph.instagram.com/me',
            params={
                'fields': 'followers_count,media_count,username,profile_picture_url',
                'access_token': access_token
            }
        )
        
        if response.status_code != 200:
            app.logger.error(f"IG stats fetch failed: {response.text}")
            return jsonify({'error': 'Failed to fetch Instagram stats.'}), response.status_code
            
        data = response.json()
        
        return jsonify({
            'followers': data.get('followers_count', 0),
            'media_count': data.get('media_count', 0),
            'username': data.get('username'),
            'profile_picture_url': data.get('profile_picture_url')
        }), 200

    except AppwriteException as e:
        app.logger.error(f"Database error fetching IG stats: {e}")
        return jsonify({'error': 'Database error.'}), 500
    except requests.RequestException as e:
        app.logger.error(f"Network error fetching IG stats: {e}")
        return jsonify({'error': 'Network error.'}), 500

@app.route('/api/instagram/media', methods=['GET'])
@login_required
def get_instagram_media():
    """
    Get Instagram media (Reels, Posts, Stories).
    Query Params:
    - type: 'reel', 'image', 'video', 'story' (optional filter)
    - after: pagination cursor (optional)
    """
    try:
        media_type_filter = request.args.get('type')
        after_cursor = request.args.get('after')
        
        server_client = get_appwrite_client(use_api_key=True)
        databases = Databases(server_client)
        
        ig_accounts = databases.list_documents(
            APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            queries=[Query.equal('user_id', g.user['$id'])]
        )['documents']
        
        if not ig_accounts:
            return jsonify({'error': 'No Instagram account linked.'}), 404
            
        ig_account = ig_accounts[0]
        access_token = ig_account.get('access_token')
        
        # Determine API endpoint based on type request (Stories vs Feed/Reels)
        # Note: Stories are fetched from /me/stories, others from /me/media
        api_edge = 'media'
        if media_type_filter == 'story':
            api_edge = 'stories'
            
        params = {
            'fields': 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,shortcode',
            'access_token': access_token,
            'limit': 25
        }
        
        if after_cursor:
            params['after'] = after_cursor

        response = requests.get(
            f'https://graph.instagram.com/me/{api_edge}',
            params=params
        )

        if response.status_code != 200:
             # Basic handling for 401/expired tokens could go here
             app.logger.error(f"IG media fetch failed: {response.text}")
             return jsonify({'error': 'Failed to fetch Instagram media.'}), response.status_code

        data = response.json()
        media_items = data.get('data', [])
        paging = data.get('paging', {})
        
        # Filter in python if edge is generic 'media' but we want specific types
        # Instagram API 'media_type' can be IMAGE, VIDEO, CAROUSEL_ALBUM
        # REELS are VIDEOs with specific characteristics or fetched via specific edges in newer APIs,
        # but standard media edge returns them as VIDEO usually.
        # User requested specific sections for Reels, Posts (Image/Carousel), Stories.
        
        filtered_items = []
        for item in media_items:
             # Mock "automation set" status for now as we don't have that DB yet
             # In future, check against a DB collection of automations
             item['has_automation'] = False 
             
             if media_type_filter:
                 if media_type_filter == 'reel':
                      # Rudimentary check: if it's a video, we assume it shows up in reels
                      # A better check might be MediaType==VIDEO 
                      if item.get('media_type') == 'VIDEO':
                           filtered_items.append(item)
                 elif media_type_filter == 'post':
                      # Images and Carousels
                      if item.get('media_type') in ['IMAGE', 'CAROUSEL_ALBUM']:
                           filtered_items.append(item)
                 else:
                      filtered_items.append(item)
             else:
                 filtered_items.append(item)

        # Build response
        return jsonify({
            'data': filtered_items,
            'paging': {
                'cursors': paging.get('cursors', {}),
                'next': paging.get('next')
            }
        }), 200

    except Exception as e:
        app.logger.error(f"Error fetching IG media: {e}")
        return jsonify({'error': str(e)}), 500



# ==============================================================================
# ADMIN PANEL API (JSON)
# ==============================================================================

@app.route('/api/admin/dashboard', methods=['GET'])
@login_required
def admin_dashboard_api():
    try:
        # Security: In a real app, verify user is an admin here
        # e.g., if g.user.get('email') not in ADMIN_EMAILS: abort(403)
        
        server_client = get_appwrite_client(use_api_key=True)
        databases = Databases(server_client)
        
        # Fetch Stats (Data Rich)
        # 1. Total Users
        users_response = databases.list_documents(
            APPWRITE_DATABASE_ID,
            USERS_COLLECTION_ID,
            queries=[Query.limit(5000)] # Get reasonable max for stats
        )
        users = users_response['documents']
        total_users = users_response['total']
        
        now = datetime.datetime.now(datetime.timezone.utc)

        def _parse_expiry_date(value):
            if not value:
                return None
            try:
                return datetime.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            except Exception:
                return None

        def _is_active_paid_subscription(user_doc):
            plan_code = str(user_doc.get('plan_code') or 'free').strip().lower()
            expiry_date = _parse_expiry_date(user_doc.get('expiry_date'))
            if plan_code == 'free' or expiry_date is None:
                return False
            return expiry_date > now

        # DEPRECATED - DO NOT USE FOR SUBSCRIPTION LOGIC:
        # `subscription_plan_id` is intentionally ignored here.
        # Subscription state must come only from `plan_code` + `expiry_date`.

        # 2. Paid Users & MRR
        paid_users = 0
        mrr = 0
        for u in users:
            plan = str(u.get('plan_code') or 'free').strip().lower()
            if _is_active_paid_subscription(u):
                paid_users += 1
                if plan == 'premium_monthly':
                    mrr += 29
                elif plan == 'premium_yearly':
                    mrr += (299 / 12)
        
        # 3. New Users (24h)
        one_day_ago = now - datetime.timedelta(days=1)
        new_users_24h = 0
        
        # Calculate recent growth
        for u in users:
            try:
                created_at_str = u.get('$createdAt')
                if created_at_str:
                    # Fix Appwrite ISO format if needed
                    created_at_str = created_at_str.replace("Z", "+00:00")
                    created_at = datetime.datetime.fromisoformat(created_at_str)
                    if created_at > one_day_ago:
                        new_users_24h += 1
            except Exception:
                pass

        # 4. Recent Actions / Automations (Mock for now, or fetch from logs if available)
        active_campaigns = 0 
        try:
           campaigns_res = databases.list_documents(APPWRITE_DATABASE_ID, CAMPAIGNS_COLLECTION_ID, queries=[Query.limit(1)])
           active_campaigns = campaigns_res['total']
        except:
           pass

        data = {
            'stats': {
                'totalUsers': total_users,
                'paidUsers': paid_users,
                'newUsers24h': new_users_24h,
                'mrr': int(mrr),
                'activeCampaigns': active_campaigns,
                'automationsRan': 0 # Placeholder
            },
            'recentUsers': [
                {
                    'name': u.get('name', 'N/A'),
                    'email': u.get('email', 'N/A'),
                    'status': 'Active' if u.get('status') else 'Inactive',
                    'joined_at': u.get('$createdAt', ''),
                    'amount': '$29.00' if _is_active_paid_subscription(u) else '$0.00'
                } for u in sorted(users, key=lambda x: x.get('$createdAt', ''), reverse=True)[:5]
            ]
        }
        
        return jsonify(data), 200
        
    except Exception as e:
        app.logger.error(f"Admin API Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users', methods=['GET'])
@login_required
def admin_users_api():
    try:
        server_client = get_appwrite_client(use_api_key=True)
        databases = Databases(server_client)
        
        cursor = request.args.get('cursor')
        queries = [Query.limit(50), Query.order_desc('$createdAt')]
        if cursor:
             queries.append(Query.cursor_after(cursor))

        users_response = databases.list_documents(
            APPWRITE_DATABASE_ID,
            USERS_COLLECTION_ID,
            queries=queries
        )
        
        return jsonify({
            'users': users_response['documents'],
            'total': users_response['total']
        }), 200
        
    except Exception as e:
        app.logger.error(f"Admin Users API Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<user_id>', methods=['PUT', 'PATCH'])
@login_required
def admin_update_user_api(user_id):
    try:
         data = request.get_json()
         server_client = get_appwrite_client(use_api_key=True)
         databases = Databases(server_client)
         
         # Filter out system keys
         clean_data = {k: v for k, v in data.items() if not k.startswith('$')}
         
         result = databases.update_document(
             APPWRITE_DATABASE_ID,
             USERS_COLLECTION_ID,
             user_id,
             clean_data
         )
         return jsonify(result), 200
    except Exception as e:
         app.logger.error(f"Admin Update User Error: {e}")
         return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
