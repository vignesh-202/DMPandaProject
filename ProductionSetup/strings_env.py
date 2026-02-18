
import os
from pathlib import Path
import re

env_path = Path(__file__).resolve().parent / '.env'

def strings(filename, min=4):
    with open(filename, "rb") as f:
        result = ""
        for b in f.read():
            c = chr(b)
            if c.isprintable():
                result += c
            else:
                if len(result) >= min:
                    yield result
                result = ""
        if len(result) >= min:
            yield result

print("--- EXRACTED STRINGS ---")
for s in strings(env_path):
    print(s)
