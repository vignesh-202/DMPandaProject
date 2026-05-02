param(
    [string]$FunctionId = ""
)

$ErrorActionPreference = "Stop"
$AppwriteCli = (Get-Command appwrite.cmd).Source

function Get-EnvValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Key,
        [string]$Default = ""
    )

    $value = [Environment]::GetEnvironmentVariable($Key, "Process")
    if ([string]::IsNullOrWhiteSpace($value)) {
        $value = [Environment]::GetEnvironmentVariable($Key, "User")
    }
    if ([string]::IsNullOrWhiteSpace($value)) {
        $value = [Environment]::GetEnvironmentVariable($Key, "Machine")
    }
    if (-not [string]::IsNullOrWhiteSpace($value)) {
        return [string]$value
    }
    return [string]$Default
}

function Import-DotEnvFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path $Path)) {
        return
    }

    foreach ($line in Get-Content -Path $Path) {
        $trimmed = [string]$line
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.Trim().StartsWith("#")) {
            continue
        }
        $parts = $trimmed -split "=", 2
        if ($parts.Count -ne 2) {
            continue
        }
        $name = [string]$parts[0].Trim()
        $value = [string]$parts[1].Trim()
        if ($value.StartsWith('"') -and $value.EndsWith('"')) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        if ($value.StartsWith("'") -and $value.EndsWith("'")) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name, "Process"))) {
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

$repoRoot = Split-Path $PSScriptRoot -Parent
Import-DotEnvFile -Path (Join-Path $repoRoot ".env")
Import-DotEnvFile -Path (Join-Path $repoRoot "ProductionSetup\.env")

$databaseId = Get-EnvValue -Key "APPWRITE_DATABASE_ID"
if ([string]::IsNullOrWhiteSpace($databaseId)) {
    $databaseId = Get-EnvValue -Key "DATABASE_ID"
}
if ([string]::IsNullOrWhiteSpace($databaseId)) {
    throw "APPWRITE_DATABASE_ID (or DATABASE_ID) must be set before syncing function variables."
}

$appwriteEndpoint = Get-EnvValue -Key "APPWRITE_ENDPOINT"
$appwriteProjectId = Get-EnvValue -Key "APPWRITE_PROJECT_ID"
$appwriteApiKey = Get-EnvValue -Key "APPWRITE_API_KEY"

$functionVariables = @{
    "on-user-create" = @(
        @{ key = "APPWRITE_DATABASE_ID"; value = $databaseId; secret = $false }
        @{ key = "USERS_COLLECTION_ID"; value = (Get-EnvValue -Key "USERS_COLLECTION_ID" -Default "users"); secret = $false }
        @{ key = "PROFILES_COLLECTION_ID"; value = (Get-EnvValue -Key "PROFILES_COLLECTION_ID" -Default "profiles"); secret = $false }
        @{ key = "PRICING_COLLECTION_ID"; value = (Get-EnvValue -Key "PRICING_COLLECTION_ID" -Default "pricing"); secret = $false }
    )
    "subscription-manager" = @(
        @{ key = "APPWRITE_DATABASE_ID"; value = $databaseId; secret = $false }
        @{ key = "PROFILES_COLLECTION_ID"; value = (Get-EnvValue -Key "PROFILES_COLLECTION_ID" -Default "profiles"); secret = $false }
        @{ key = "USERS_COLLECTION_ID"; value = (Get-EnvValue -Key "USERS_COLLECTION_ID" -Default "users"); secret = $false }
        @{ key = "PRICING_COLLECTION_ID"; value = (Get-EnvValue -Key "PRICING_COLLECTION_ID" -Default "pricing"); secret = $false }
        @{ key = "JOB_LOCKS_COLLECTION_ID"; value = (Get-EnvValue -Key "JOB_LOCKS_COLLECTION_ID" -Default "job_locks"); secret = $false }
        @{ key = "FRONTEND_ORIGIN"; value = (Get-EnvValue -Key "FRONTEND_ORIGIN"); secret = $false }
    )
    "payment-reminders" = @(
        @{ key = "APPWRITE_DATABASE_ID"; value = $databaseId; secret = $false }
        @{ key = "PAYMENT_ATTEMPTS_COLLECTION_ID"; value = (Get-EnvValue -Key "PAYMENT_ATTEMPTS_COLLECTION_ID" -Default "payment_attempts"); secret = $false }
        @{ key = "TRANSACTIONS_COLLECTION_ID"; value = (Get-EnvValue -Key "TRANSACTIONS_COLLECTION_ID" -Default "transactions"); secret = $false }
        @{ key = "JOB_LOCKS_COLLECTION_ID"; value = (Get-EnvValue -Key "JOB_LOCKS_COLLECTION_ID" -Default "job_locks"); secret = $false }
        @{ key = "FRONTEND_ORIGIN"; value = (Get-EnvValue -Key "FRONTEND_ORIGIN"); secret = $false }
    )
    "inactive-user-cleanup" = @(
        @{ key = "APPWRITE_DATABASE_ID"; value = $databaseId; secret = $false }
        @{ key = "USERS_COLLECTION_ID"; value = (Get-EnvValue -Key "USERS_COLLECTION_ID" -Default "users"); secret = $false }
        @{ key = "PROFILES_COLLECTION_ID"; value = (Get-EnvValue -Key "PROFILES_COLLECTION_ID" -Default "profiles"); secret = $false }
        @{ key = "TRANSACTIONS_COLLECTION_ID"; value = (Get-EnvValue -Key "TRANSACTIONS_COLLECTION_ID" -Default "transactions"); secret = $false }
        @{ key = "PAYMENT_ATTEMPTS_COLLECTION_ID"; value = (Get-EnvValue -Key "PAYMENT_ATTEMPTS_COLLECTION_ID" -Default "payment_attempts"); secret = $false }
        @{ key = "COUPON_REDEMPTIONS_COLLECTION_ID"; value = (Get-EnvValue -Key "COUPON_REDEMPTIONS_COLLECTION_ID" -Default "coupon_redemptions"); secret = $false }
        @{ key = "JOB_LOCKS_COLLECTION_ID"; value = (Get-EnvValue -Key "JOB_LOCKS_COLLECTION_ID" -Default "job_locks"); secret = $false }
        @{ key = "INACTIVE_CLEANUP_AUDIT_COLLECTION_ID"; value = (Get-EnvValue -Key "INACTIVE_CLEANUP_AUDIT_COLLECTION_ID" -Default (Get-EnvValue -Key "INACTIVE_USER_CLEANUP_AUDIT_COLLECTION_ID" -Default "inactive_user_cleanup_audit")); secret = $false }
        @{ key = "FRONTEND_ORIGIN"; value = (Get-EnvValue -Key "FRONTEND_ORIGIN"); secret = $false }
        @{ key = "INACTIVE_CLEANUP_PROTECTED_EMAILS"; value = (Get-EnvValue -Key "INACTIVE_CLEANUP_PROTECTED_EMAILS"); secret = $false }
        @{ key = "INACTIVE_CLEANUP_PROTECTED_EMAIL_DOMAINS"; value = (Get-EnvValue -Key "INACTIVE_CLEANUP_PROTECTED_EMAIL_DOMAINS"); secret = $false }
        @{ key = "INACTIVE_CLEANUP_BATCH_SIZE"; value = (Get-EnvValue -Key "INACTIVE_CLEANUP_BATCH_SIZE" -Default "50"); secret = $false }
    )
    "remind-link-instagram" = @(
        @{ key = "APPWRITE_DATABASE_ID"; value = $databaseId; secret = $false }
        @{ key = "USERS_COLLECTION_ID"; value = (Get-EnvValue -Key "USERS_COLLECTION_ID" -Default "users"); secret = $false }
        @{ key = "PROFILES_COLLECTION_ID"; value = (Get-EnvValue -Key "PROFILES_COLLECTION_ID" -Default "profiles"); secret = $false }
        @{ key = "IG_ACCOUNTS_COLLECTION_ID"; value = (Get-EnvValue -Key "IG_ACCOUNTS_COLLECTION_ID" -Default "ig_accounts"); secret = $false }
        @{ key = "REMINDER_DELAY_HOURS"; value = (Get-EnvValue -Key "REMINDER_DELAY_HOURS" -Default "24"); secret = $false }
        @{ key = "EXPIRY_REMINDER_LEAD_DAYS"; value = (Get-EnvValue -Key "EXPIRY_REMINDER_LEAD_DAYS" -Default "3"); secret = $false }
        @{ key = "FRONTEND_ORIGIN"; value = (Get-EnvValue -Key "FRONTEND_ORIGIN"); secret = $false }
    )
    "audit-media-automations" = @(
        @{ key = "APPWRITE_DATABASE_ID"; value = $databaseId; secret = $false }
        @{ key = "AUTOMATIONS_COLLECTION_ID"; value = (Get-EnvValue -Key "AUTOMATIONS_COLLECTION_ID" -Default "automations"); secret = $false }
        @{ key = "KEYWORDS_COLLECTION_ID"; value = (Get-EnvValue -Key "KEYWORDS_COLLECTION_ID" -Default "keywords"); secret = $false }
        @{ key = "KEYWORD_INDEX_COLLECTION_ID"; value = (Get-EnvValue -Key "KEYWORD_INDEX_COLLECTION_ID" -Default "keyword_index"); secret = $false }
        @{ key = "IG_ACCOUNTS_COLLECTION_ID"; value = (Get-EnvValue -Key "IG_ACCOUNTS_COLLECTION_ID" -Default "ig_accounts"); secret = $false }
        @{ key = "FRONTEND_ORIGIN"; value = (Get-EnvValue -Key "FRONTEND_ORIGIN"); secret = $false }
    )
    "cleanup-audit-job-locks" = @(
        @{ key = "FUNCTION_APPWRITE_ENDPOINT"; value = $appwriteEndpoint; secret = $true }
        @{ key = "FUNCTION_APPWRITE_PROJECT_ID"; value = $appwriteProjectId; secret = $true }
        @{ key = "FUNCTION_APPWRITE_API_KEY"; value = $appwriteApiKey; secret = $true }
        @{ key = "APPWRITE_DATABASE_ID"; value = $databaseId; secret = $false }
        @{ key = "JOB_LOCKS_COLLECTION_ID"; value = (Get-EnvValue -Key "JOB_LOCKS_COLLECTION_ID" -Default "job_locks"); secret = $false }
        @{ key = "INACTIVE_CLEANUP_AUDIT_COLLECTION_ID"; value = (Get-EnvValue -Key "INACTIVE_CLEANUP_AUDIT_COLLECTION_ID" -Default (Get-EnvValue -Key "INACTIVE_USER_CLEANUP_AUDIT_COLLECTION_ID" -Default "inactive_user_cleanup_audit")); secret = $false }
        @{ key = "INACTIVE_CLEANUP_AUDIT_RETENTION_DAYS"; value = (Get-EnvValue -Key "INACTIVE_CLEANUP_AUDIT_RETENTION_DAYS" -Default "90"); secret = $false }
        @{ key = "JOB_LOCKS_RETENTION_HOURS"; value = (Get-EnvValue -Key "JOB_LOCKS_RETENTION_HOURS" -Default "24"); secret = $false }
    )
}

$selectedFunctionIds = if ([string]::IsNullOrWhiteSpace($FunctionId)) {
    @($functionVariables.Keys)
} else {
    @($FunctionId)
}

foreach ($targetFunctionId in $selectedFunctionIds) {
    $definitions = $functionVariables[$targetFunctionId]
    if (-not $definitions) {
        continue
    }

    $existingVariables = @()
    try {
        $existingVariables = @((& $AppwriteCli functions list-variables --function-id $targetFunctionId --json | ConvertFrom-Json).variables)
    } catch {
        throw "Failed to list variables for function '$targetFunctionId'. Ensure the function exists before syncing variables."
    }

    foreach ($definition in $definitions) {
        $existing = $existingVariables | Where-Object { $_.key -eq $definition.key } | Select-Object -First 1
        if ($existing) {
            & $AppwriteCli functions update-variable `
                --function-id $targetFunctionId `
                --variable-id $existing.'$id' `
                --key $definition.key `
                --value ([string]$definition.value) `
                --secret ($definition.secret.ToString().ToLower()) | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to update variable '$($definition.key)' for function '$targetFunctionId'"
            }
            continue
        }

        & $AppwriteCli functions create-variable `
            --function-id $targetFunctionId `
            --key $definition.key `
            --value ([string]$definition.value) `
            --secret ($definition.secret.ToString().ToLower()) | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to create variable '$($definition.key)' for function '$targetFunctionId'"
        }
    }
}
