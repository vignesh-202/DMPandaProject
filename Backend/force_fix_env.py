
import os
from pathlib import Path
import re

env_path = Path(__file__).resolve().parent / '.env'

if env_path.exists():
    with open(env_path, 'rb') as f:
        data = f.read()
    
    # Try to decode with errors='ignore' in ascii/utf8
    text = data.decode('utf-8', errors='ignore')
    
    # Also try to replace nulls
    text_nonull = data.replace(b'\x00', b'').decode('utf-8', errors='ignore')
    
    print("--- RECOVERED STRINGS ---")
    vars = {}
    for line in text_nonull.splitlines():
        if '=' in line:
            parts = line.split('=', 1)
            key = parts[0].strip()
            val = parts[1].strip()
            # rudimentary heuristic to find valid keys
            if re.match(r'^[A-Z_]+$', key):
                clean_val = val.strip().strip("'").strip('"')
                vars[key] = clean_val
                print(f"Found: {key} = {clean_val[:10]}...") 

    # Add manually if missing (based on chat history)
    # user provided these in step 115
    if 'APPWRITE_ENDPOINT' not in vars:
        vars['APPWRITE_ENDPOINT'] = 'https://fra.cloud.appwrite.io/v1'
    if 'APPWRITE_PROJECT_ID' not in vars:
        vars['APPWRITE_PROJECT_ID'] = '674db6240039229d277e'
    if 'APPWRITE_DATABASE_ID' not in vars:
        vars['APPWRITE_DATABASE_ID'] = '674e5e7800068d0e7610'
    
    # Ensure Origins are strictly correct
    vars['FRONTEND_ORIGIN'] = 'http://localhost:5173'
    vars['ADMIN_PANEL_ORIGIN'] = 'http://localhost:5173'

    print("--- SAVING CLEAN .env ---")
    with open(env_path, 'w', encoding='utf-8') as f:
        for k, v in vars.items():
            f.write(f"{k}={v}\n")
