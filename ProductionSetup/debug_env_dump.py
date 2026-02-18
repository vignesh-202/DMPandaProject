
import os
from pathlib import Path

env_path = Path(__file__).resolve().parent / '.env'

def print_clean(s):
    # Print repr to see escapes
    print(repr(s))

if env_path.exists():
    print("Reading raw bytes...")
    with open(env_path, 'rb') as f:
        raw = f.read()
        print(f"Total bytes: {len(raw)}")
        print(f"First 100 bytes repr: {raw[:100]}")
        
    print("\nReading text...")
    try:
        with open(env_path, 'r', encoding='utf-8') as f:
            content = f.read()
            print("--- CONTENT START ---")
            print(content)
            print("--- CONTENT END ---")
    except Exception as e:
        print(f"Read error: {e}")
else:
    print(".env NOT FOUND")
