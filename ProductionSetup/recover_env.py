
import os
from pathlib import Path

env_path = Path(__file__).resolve().parent / '.env'

encodings = ['utf-8', 'utf-16', 'utf-16-le', 'utf-16-be', 'cp1252']

for enc in encodings:
    print(f"\nTrying encoding: {enc}")
    try:
        with open(env_path, 'r', encoding=enc) as f:
            content = f.read()
            if "APPWRITE_ENDPOINT" in content:
                print(">>> SUCCESS! Found content:")
                # filter blank lines
                lines = [l.strip() for l in content.splitlines() if l.strip()]
                print('\n'.join(lines))
                
                # If success, let's SAVE it as clean UTF-8
                with open(env_path, 'w', encoding='utf-8') as out:
                    out.write('\n'.join(lines) + '\n')
                print(">>> OVERWROTE .env with CLEAN UTF-8 <<<")
                break
    except Exception as e:
        print(f"Failed: {e}")
