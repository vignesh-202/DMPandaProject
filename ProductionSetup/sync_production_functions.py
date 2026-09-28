import os
from pathlib import Path
from dotenv import load_dotenv
from appwrite.client import Client
from appwrite.services.functions import Functions

DEV_ENV = Path(__file__).resolve().with_name(".env")
PROD_ENV = Path(__file__).resolve().with_name(".env.production")

def get_client(env_path):
    load_dotenv(env_path, override=True)
    c = Client()
    c.set_endpoint(os.getenv("APPWRITE_ENDPOINT"))
    c.set_project(os.getenv("APPWRITE_PROJECT_ID"))
    c.set_key(os.getenv("APPWRITE_API_KEY"))
    return c, os.getenv("APPWRITE_PROJECT_ID"), os.getenv("APPWRITE_API_KEY")

def main():
    print("=" * 60)
    print("DM Panda: Appwrite Function Environment Parity Sync")
    print("=" * 60)

    c_dev, dev_project_id, dev_api_key = get_client(DEV_ENV)
    f_dev = Functions(c_dev)

    c_prod, prod_project_id, prod_api_key = get_client(PROD_ENV)
    f_prod = Functions(c_prod)

    print(f"Dev  Project ID: {dev_project_id}")
    print(f"Prod Project ID: {prod_project_id}")

    dev_functions = {fn["name"]: fn for fn in f_dev.list().get("functions", [])}
    prod_functions = {fn["name"]: fn for fn in f_prod.list().get("functions", [])}

    print(f"Found {len(dev_functions)} functions in Dev, {len(prod_functions)} in Prod.\n")

    for name, dev_fn in dev_functions.items():
        if name not in prod_functions:
            print(f"[!] Warning: Function '{name}' found in Dev but not in Prod.")
            continue

        prod_fn = prod_functions[name]
        prod_fn_id = prod_fn["$id"]

        # Fetch existing variables in prod
        existing_prod_vars = {
            v["key"]: v for v in f_prod.list_variables(prod_fn_id).get("variables", [])
        }

        dev_vars = dev_fn.get("vars", [])
        print(f"[*] Syncing function: {name} (Prod ID: {prod_fn_id}, {len(dev_vars)} variables)...")

        for var in dev_vars:
            key = var["key"]
            val = var["value"]

            # Transform dev values to production
            if "PROJECT_ID" in key:
                target_val = prod_project_id
            elif "API_KEY" in key:
                target_val = prod_api_key
            elif key == "FRONTEND_ORIGIN":
                target_val = "https://dmpanda.com"
            else:
                target_val = val

            if key not in existing_prod_vars:
                try:
                    f_prod.create_variable(prod_fn_id, key, target_val)
                    print(f"    [+] Created: {key} = {target_val[:24]}...")
                except Exception as e:
                    print(f"    [!] Error creating {key}: {e}")
            else:
                curr_var = existing_prod_vars[key]
                if curr_var["value"] != target_val:
                    try:
                        f_prod.update_variable(prod_fn_id, curr_var["$id"], key, target_val)
                        print(f"    [~] Updated: {key}")
                    except Exception as e:
                        print(f"    [!] Error updating {key}: {e}")
                else:
                    pass

    print("\n[OK] Function environment variables sync complete!")

    # Verify final counts
    print("\nVerification:")
    for name, prod_fn in prod_functions.items():
        vars_list = f_prod.list_variables(prod_fn["$id"]).get("variables", [])
        print(f" - {name}: {len(vars_list)} variables configured.")

if __name__ == "__main__":
    main()
