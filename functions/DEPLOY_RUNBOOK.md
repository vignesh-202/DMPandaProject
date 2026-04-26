# Function Deploy Runbook

## Error classes

- `config_error`
  Missing collection, bad schema, wrong schedule, wrong function binding, or manifest mismatch.
- `env_issue`
  Missing or incorrect environment variables, project IDs, endpoints, or secrets.
- `runtime_bug`
  Function code throws, parsing fails, external call fails, or retryable network issue occurs.
- `permission_issue`
  Missing API scopes, collection permissions, or function execution rights.

## Safe rollout order

1. Inspect current functions with the Appwrite CLI.
2. Review recent executions and logs for every changed function.
3. Classify each failure before editing code.
4. Fix locally and keep changes scoped to the failing function.
5. Sync variables before deployment.
6. Deploy changed functions.
7. Run a post-deploy execution check and confirm the expected trigger/schedule still exists.

## Rollback triggers

- New deployment introduces a new error class that was not present before.
- A function loses required environment variables or scope bindings.
- Execution volume drops to zero for a scheduled function that should still be running.
- Permission or schema errors appear immediately after deploy.

## Rollback path

1. Stop further deploys.
2. Re-check `function-manifest.json` and synced variables.
3. Re-deploy the last known good code for only the affected function.
4. Re-run a smoke execution and inspect logs again.

## CLI checklist

- `appwrite functions list`
- `appwrite functions list-executions --functionId <id>`
- `appwrite functions list-logs --functionId <id>`
- `powershell -ExecutionPolicy Bypass -File .\\sync-function-variables.ps1`
- `powershell -ExecutionPolicy Bypass -File .\\deploy-functions.ps1`
