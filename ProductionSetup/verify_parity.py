import os
from pathlib import Path
from dotenv import load_dotenv
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.services.functions import Functions
from appwrite.services.storage import Storage

DEV_ENV = Path(__file__).resolve().with_name(".env")
PROD_ENV = Path(__file__).resolve().with_name(".env.production")

def audit(env_file, label):
    load_dotenv(env_file, override=True)
    proj = os.getenv("APPWRITE_PROJECT_ID")
    db_id = os.getenv("APPWRITE_DATABASE_ID")
    c = Client().set_endpoint(os.getenv("APPWRITE_ENDPOINT")).set_project(proj).set_key(os.getenv("APPWRITE_API_KEY"))
    db = Databases(c)
    st = Storage(c)
    fn = Functions(c)

    colls = db.list_collections(db_id).get("collections", [])
    buckets = st.list_buckets().get("buckets", [])
    funcs = fn.list().get("functions", [])

    print(f"=== {label} (Project: {proj}, DB: {db_id}) ===")
    print(f"Collections count       : {len(colls)}")
    print(f"Collections list        : {sorted([c['$id'] for c in colls])}")
    print(f"Storage Buckets count   : {len(buckets)}")
    print(f"Storage Buckets list    : {[b['$id'] for b in buckets]}")
    print(f"Functions count         : {len(funcs)}")
    print(f"Functions list          : {sorted([f['name'] for f in funcs])}")

    total_vars = 0
    for f in funcs:
        fn_id = f["$id"]
        v_list = fn.list_variables(fn_id).get("variables", [])
        total_vars += len(v_list)
    print(f"Total Function Variables: {total_vars}")
    print()
    return {
        "collections": set(c["$id"] for c in colls),
        "buckets": set(b["$id"] for b in buckets),
        "functions": set(f["name"] for f in funcs),
        "total_vars": total_vars
    }

def main():
    dev_data = audit(DEV_ENV, "DEV SERVER")
    prod_data = audit(PROD_ENV, "PRODUCTION SERVER")

    print("=== DEV vs PROD PARITY REPORT ===")
    coll_diff = dev_data["collections"].symmetric_difference(prod_data["collections"])
    bucket_diff = dev_data["buckets"].symmetric_difference(prod_data["buckets"])
    func_diff = dev_data["functions"].symmetric_difference(prod_data["functions"])

    print(f"Collections Identical   : {len(coll_diff) == 0} (Diff: {coll_diff})")
    print(f"Storage Buckets Identical: {len(bucket_diff) == 0} (Diff: {bucket_diff})")
    print(f"Functions Identical     : {len(func_diff) == 0} (Diff: {func_diff})")
    print(f"Dev Variables Total     : {dev_data['total_vars']}")
    print(f"Prod Variables Total    : {prod_data['total_vars']}")
    print(f"Variables Count Match   : {dev_data['total_vars'] == prod_data['total_vars']}")

    if len(coll_diff) == 0 and len(bucket_diff) == 0 and len(func_diff) == 0 and dev_data['total_vars'] == prod_data['total_vars']:
        print("\n[SUCCESS] PERFECT 100% PARITY BETWEEN DEV AND PRODUCTION SERVERS!")
    else:
        print("\n[WARNING] Parity discrepancies detected.")

if __name__ == "__main__":
    main()
