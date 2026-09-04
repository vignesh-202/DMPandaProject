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
Import-DotEnvFile -Path (Join-Path $repoRoot "Backend\.env")
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

& $AppwriteCli client --endpoint $appwriteEndpoint --project-id $appwriteProjectId --key $appwriteApiKey | Out-Null

$commonBase = @(
    @{ key = "APPWRITE_ENDPOINT"; value = $appwriteEndpoint; secret = $false }
    @{ key = "APPWRITE_PROJECT_ID"; value = $appwriteProjectId; secret = $false }
    @{ key = "APPWRITE_API_KEY"; value = $appwriteApiKey; secret = $false }
    @{ key = "APPWRITE_DATABASE_ID"; value = $databaseId; secret = $false }
)

$functionVariables = @{
    "on-user-create" = @(
        $commonBase
        @{ key = "USERS_COLLECTION_ID"; value = (Get-EnvValue -Key "USERS_COLLECTION_ID" -Default "users"); secret = $false }
        @{ key = "PRICING_COLLECTION_ID"; value = (Get-EnvValue -Key "PRICING_COLLECTION_ID" -Default "pricing"); secret = $false }
        @{ key = "FRONTEND_ORIGIN"; value = (Get-EnvValue -Key "FRONTEND_ORIGIN"); secret = $false }
    ) | ForEach-Object { $_ }
    "subscription-manager" = @(
        $commonBase
        @{ key = "USERS_COLLECTION_ID"; value = (Get-EnvValue -Key "USERS_COLLECTION_ID" -Default "users"); secret = $false }
        @{ key = "PRICING_COLLECTION_ID"; value = (Get-EnvValue -Key "PRICING_COLLECTION_ID" -Default "pricing"); secret = $false }
        @{ key = "JOB_LOCKS_COLLECTION_ID"; value = (Get-EnvValue -Key "JOB_LOCKS_COLLECTION_ID" -Default "job_locks"); secret = $false }
        @{ key = "IG_ACCOUNTS_COLLECTION_ID"; value = (Get-EnvValue -Key "IG_ACCOUNTS_COLLECTION_ID" -Default "ig_accounts"); secret = $false }
        @{ key = "TRANSACTIONS_COLLECTION_ID"; value = (Get-EnvValue -Key "TRANSACTIONS_COLLECTION_ID" -Default "transactions"); secret = $false }
        @{ key = "FRONTEND_ORIGIN"; value = (Get-EnvValue -Key "FRONTEND_ORIGIN"); secret = $false }
    ) | ForEach-Object { $_ }
    "payment-reminders" = @(
        $commonBase
        @{ key = "PAYMENT_ATTEMPTS_COLLECTION_ID"; value = (Get-EnvValue -Key "PAYMENT_ATTEMPTS_COLLECTION_ID" -Default "payment_attempts"); secret = $false }
        @{ key = "TRANSACTIONS_COLLECTION_ID"; value = (Get-EnvValue -Key "TRANSACTIONS_COLLECTION_ID" -Default "transactions"); secret = $false }
        @{ key = "JOB_LOCKS_COLLECTION_ID"; value = (Get-EnvValue -Key "JOB_LOCKS_COLLECTION_ID" -Default "job_locks"); secret = $false }
        @{ key = "USERS_COLLECTION_ID"; value = (Get-EnvValue -Key "USERS_COLLECTION_ID" -Default "users"); secret = $false }
        @{ key = "FRONTEND_ORIGIN"; value = (Get-EnvValue -Key "FRONTEND_ORIGIN"); secret = $false }
    ) | ForEach-Object { $_ }
    "inactive-user-cleanup" = @(
        $commonBase
        @{ key = "USERS_COLLECTION_ID"; value = (Get-EnvValue -Key "USERS_COLLECTION_ID" -Default "users"); secret = $false }
        @{ key = "TRANSACTIONS_COLLECTION_ID"; value = (Get-EnvValue -Key "TRANSACTIONS_COLLECTION_ID" -Default "transactions"); secret = $false }
        @{ key = "PAYMENT_ATTEMPTS_COLLECTION_ID"; value = (Get-EnvValue -Key "PAYMENT_ATTEMPTS_COLLECTION_ID" -Default "payment_attempts"); secret = $false }
        @{ key = "COUPON_REDEMPTIONS_COLLECTION_ID"; value = (Get-EnvValue -Key "COUPON_REDEMPTIONS_COLLECTION_ID" -Default "coupon_redemptions"); secret = $false }
        @{ key = "JOB_LOCKS_COLLECTION_ID"; value = (Get-EnvValue -Key "JOB_LOCKS_COLLECTION_ID" -Default "job_locks"); secret = $false }
        @{ key = "INACTIVE_CLEANUP_AUDIT_COLLECTION_ID"; value = (Get-EnvValue -Key "INACTIVE_CLEANUP_AUDIT_COLLECTION_ID" -Default (Get-EnvValue -Key "INACTIVE_USER_CLEANUP_AUDIT_COLLECTION_ID" -Default "inactive_user_cleanup_audit")); secret = $false }
        @{ key = "FRONTEND_ORIGIN"; value = (Get-EnvValue -Key "FRONTEND_ORIGIN"); secret = $false }
        @{ key = "INACTIVE_CLEANUP_PROTECTED_EMAILS"; value = (Get-EnvValue -Key "INACTIVE_CLEANUP_PROTECTED_EMAILS"); secret = $false; optional = $true }
        @{ key = "INACTIVE_CLEANUP_PROTECTED_EMAIL_DOMAINS"; value = (Get-EnvValue -Key "INACTIVE_CLEANUP_PROTECTED_EMAIL_DOMAINS"); secret = $false; optional = $true }
        @{ key = "INACTIVE_CLEANUP_BATCH_SIZE"; value = (Get-EnvValue -Key "INACTIVE_CLEANUP_BATCH_SIZE" -Default "50"); secret = $false }
    ) | ForEach-Object { $_ }
    "remind-link-instagram" = @(
        $commonBase
        @{ key = "USERS_COLLECTION_ID"; value = (Get-EnvValue -Key "USERS_COLLECTION_ID" -Default "users"); secret = $false }
        @{ key = "IG_ACCOUNTS_COLLECTION_ID"; value = (Get-EnvValue -Key "IG_ACCOUNTS_COLLECTION_ID" -Default "ig_accounts"); secret = $false }
        @{ key = "REMINDER_DELAY_HOURS"; value = (Get-EnvValue -Key "REMINDER_DELAY_HOURS" -Default "24"); secret = $false }
        @{ key = "EXPIRY_REMINDER_LEAD_DAYS"; value = (Get-EnvValue -Key "EXPIRY_REMINDER_LEAD_DAYS" -Default "3"); secret = $false }
        @{ key = "FRONTEND_ORIGIN"; value = (Get-EnvValue -Key "FRONTEND_ORIGIN"); secret = $false }
    ) | ForEach-Object { $_ }
    "refresh-instagram-tokens" = @(
        $commonBase
        @{ key = "IG_ACCOUNTS_COLLECTION_ID"; value = (Get-EnvValue -Key "IG_ACCOUNTS_COLLECTION_ID" -Default "ig_accounts"); secret = $false }
        @{ key = "FRONTEND_ORIGIN"; value = (Get-EnvValue -Key "FRONTEND_ORIGIN"); secret = $false; optional = $true }
    ) | ForEach-Object { $_ }
    "sync-instagram-account-profiles" = @(
        $commonBase
        @{ key = "FUNCTION_APPWRITE_ENDPOINT"; value = $appwriteEndpoint; secret = $false }
        @{ key = "FUNCTION_APPWRITE_PROJECT_ID"; value = $appwriteProjectId; secret = $false }
        @{ key = "FUNCTION_APPWRITE_API_KEY"; value = $appwriteApiKey; secret = $false }
        @{ key = "IG_ACCOUNTS_COLLECTION_ID"; value = (Get-EnvValue -Key "IG_ACCOUNTS_COLLECTION_ID" -Default "ig_accounts"); secret = $false }
    ) | ForEach-Object { $_ }
    "audit-media-automations" = @(
        $commonBase
        @{ key = "AUTOMATIONS_COLLECTION_ID"; value = (Get-EnvValue -Key "AUTOMATIONS_COLLECTION_ID" -Default "automations"); secret = $false }
        @{ key = "KEYWORDS_COLLECTION_ID"; value = (Get-EnvValue -Key "KEYWORDS_COLLECTION_ID" -Default "keywords"); secret = $false }
        @{ key = "KEYWORD_INDEX_COLLECTION_ID"; value = (Get-EnvValue -Key "KEYWORD_INDEX_COLLECTION_ID" -Default "keyword_index"); secret = $false }
        @{ key = "IG_ACCOUNTS_COLLECTION_ID"; value = (Get-EnvValue -Key "IG_ACCOUNTS_COLLECTION_ID" -Default "ig_accounts"); secret = $false }
        @{ key = "FRONTEND_ORIGIN"; value = (Get-EnvValue -Key "FRONTEND_ORIGIN"); secret = $false }
    ) | ForEach-Object { $_ }
    "cleanup-audit-job-locks" = @(
        $commonBase
        @{ key = "FUNCTION_APPWRITE_ENDPOINT"; value = $appwriteEndpoint; secret = $false }
        @{ key = "FUNCTION_APPWRITE_PROJECT_ID"; value = $appwriteProjectId; secret = $false }
        @{ key = "FUNCTION_APPWRITE_API_KEY"; value = $appwriteApiKey; secret = $false }
        @{ key = "JOB_LOCKS_COLLECTION_ID"; value = (Get-EnvValue -Key "JOB_LOCKS_COLLECTION_ID" -Default "job_locks"); secret = $false }
        @{ key = "INACTIVE_CLEANUP_AUDIT_COLLECTION_ID"; value = (Get-EnvValue -Key "INACTIVE_CLEANUP_AUDIT_COLLECTION_ID" -Default (Get-EnvValue -Key "INACTIVE_USER_CLEANUP_AUDIT_COLLECTION_ID" -Default "inactive_user_cleanup_audit")); secret = $false }
        @{ key = "INACTIVE_CLEANUP_AUDIT_RETENTION_DAYS"; value = (Get-EnvValue -Key "INACTIVE_CLEANUP_AUDIT_RETENTION_DAYS" -Default "90"); secret = $false }
        @{ key = "JOB_LOCKS_RETENTION_HOURS"; value = (Get-EnvValue -Key "JOB_LOCKS_RETENTION_HOURS" -Default "24"); secret = $false }
    ) | ForEach-Object { $_ }
    "cleanup-email-tokens" = @(
        $commonBase
        @{ key = "EMAIL_CHANGE_TOKENS_COLLECTION_ID"; value = (Get-EnvValue -Key "EMAIL_CHANGE_TOKENS_COLLECTION_ID" -Default "email_change_tokens"); secret = $false }
    ) | ForEach-Object { $_ }
    "cleanup-logs-chat-state" = @(
        $commonBase
        @{ key = "LOGS_COLLECTION_ID"; value = (Get-EnvValue -Key "LOGS_COLLECTION_ID" -Default "logs"); secret = $false }
        @{ key = "CHAT_STATES_COLLECTION_ID"; value = (Get-EnvValue -Key "CHAT_STATES_COLLECTION_ID" -Default "chat_states"); secret = $false }
        @{ key = "AUTOMATIONS_COLLECTION_ID"; value = (Get-EnvValue -Key "AUTOMATIONS_COLLECTION_ID" -Default "automations"); secret = $false }
    ) | ForEach-Object { $_ }
    "remove-instagram" = @(
        $commonBase
        @{ key = "IG_ACCOUNTS_COLLECTION_ID"; value = (Get-EnvValue -Key "IG_ACCOUNTS_COLLECTION_ID" -Default "ig_accounts"); secret = $false }
        @{ key = "AUTOMATIONS_COLLECTION_ID"; value = (Get-EnvValue -Key "AUTOMATIONS_COLLECTION_ID" -Default "automations"); secret = $false }
        @{ key = "KEYWORDS_COLLECTION_ID"; value = (Get-EnvValue -Key "KEYWORDS_COLLECTION_ID" -Default "keywords"); secret = $false }
        @{ key = "KEYWORD_INDEX_COLLECTION_ID"; value = (Get-EnvValue -Key "KEYWORD_INDEX_COLLECTION_ID" -Default "keyword_index"); secret = $false }
        @{ key = "LOGS_COLLECTION_ID"; value = (Get-EnvValue -Key "LOGS_COLLECTION_ID" -Default "logs"); secret = $false }
        @{ key = "CHAT_STATES_COLLECTION_ID"; value = (Get-EnvValue -Key "CHAT_STATES_COLLECTION_ID" -Default "chat_states"); secret = $false }
        @{ key = "SUPER_PROFILES_COLLECTION_ID"; value = (Get-EnvValue -Key "SUPER_PROFILES_COLLECTION_ID" -Default "super_profiles"); secret = $false }
        @{ key = "REPLY_TEMPLATES_COLLECTION_ID"; value = (Get-EnvValue -Key "REPLY_TEMPLATES_COLLECTION_ID" -Default "reply_templates"); secret = $false }
        @{ key = "INBOX_MENUS_COLLECTION_ID"; value = (Get-EnvValue -Key "INBOX_MENUS_COLLECTION_ID" -Default "inbox_menus"); secret = $false }
        @{ key = "CONVO_STARTERS_COLLECTION_ID"; value = (Get-EnvValue -Key "CONVO_STARTERS_COLLECTION_ID" -Default "convo_starters"); secret = $false }
        @{ key = "COMMENT_MODERATION_COLLECTION_ID"; value = (Get-EnvValue -Key "COMMENT_MODERATION_COLLECTION_ID" -Default "comment_moderation"); secret = $false }
        @{ key = "FRONTEND_ORIGIN"; value = (Get-EnvValue -Key "FRONTEND_ORIGIN"); secret = $false }
    ) | ForEach-Object { $_ }
    "reset-user-action-budgets" = @(
        $commonBase
        @{ key = "IG_ACCOUNTS_COLLECTION_ID"; value = (Get-EnvValue -Key "IG_ACCOUNTS_COLLECTION_ID" -Default "ig_accounts"); secret = $false }
    ) | ForEach-Object { $_ }
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
        $existingVariables = @((& $AppwriteCli functions list-variables --function-id $targetFunctionId --show-secrets --json | ConvertFrom-Json).variables)
    } catch {
        throw "Failed to list variables for function '$targetFunctionId'. Ensure the function exists before syncing variables."
    }

    # Deduplicate definitions by key (last one wins)
    $dedupedDefinitions = @{}
    foreach ($def in $definitions) {
        $dedupedDefinitions[$def.key] = $def
    }

    foreach ($definition in $dedupedDefinitions.Values) {
        $existing = $existingVariables | Where-Object { $_.key -eq $definition.key } | Select-Object -First 1
        $skipOptional = (($definition.ContainsKey("optional")) -and $definition.optional -and [string]::IsNullOrWhiteSpace([string]$definition.value))

        if ($skipOptional) {
            if ($existing) {
                & $AppwriteCli functions delete-variable `
                    --function-id $targetFunctionId `
                    --variable-id $existing.'$id' | Out-Null
                if ($LASTEXITCODE -ne 0) {
                    throw "Failed to delete empty optional variable '$($definition.key)' for function '$targetFunctionId'."
                }
            }
            continue
        }

        if ($existing) {
            if (($existing.secret -eq $true) -and (-not $definition.secret)) {
                & $AppwriteCli functions delete-variable `
                    --function-id $targetFunctionId `
                    --variable-id $existing.'$id' | Out-Null
                if ($LASTEXITCODE -ne 0) {
                    throw "Failed to delete variable '$($definition.key)' for function '$targetFunctionId' before recreating it as non-secret."
                }
                $existing = $null
            } elseif (($existing.secret -ne $true) -and ($definition.secret -eq $true)) {
                & $AppwriteCli functions delete-variable `
                    --function-id $targetFunctionId `
                    --variable-id $existing.'$id' | Out-Null
                if ($LASTEXITCODE -ne 0) {
                    throw "Failed to delete variable '$($definition.key)' for function '$targetFunctionId' before recreating it as secret."
                }
                $existing = $null
            }
        }

        if (-not $existing) {
            Write-Host "Creating variable $($definition.key) on function $targetFunctionId"
            $createArgs = @(
                "functions", "create-variable",
                "--function-id", $targetFunctionId,
                "--key", $definition.key,
                "--value", ([string]$definition.value)
            )
            if ($definition.secret -eq $true) {
                $createArgs += @("--secret", "true")
            } else {
                $createArgs += @("--secret", "false")
            }

            & $AppwriteCli @createArgs | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to create variable '$($definition.key)' on function '$targetFunctionId'."
            }
            continue
        }

        if ([string]$existing.value -ne [string]$definition.value) {
            Write-Host "Updating variable $($definition.key) on function $targetFunctionId"
            $updateArgs = @(
                "functions", "update-variable",
                "--function-id", $targetFunctionId,
                "--variable-id", $existing.'$id',
                "--key", $definition.key,
                "--value", ([string]$definition.value)
            )
            if ($definition.secret -eq $true) {
                $updateArgs += @("--secret", "true")
            } else {
                $updateArgs += @("--secret", "false")
            }

            & $AppwriteCli @updateArgs | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to update variable '$($definition.key)' on function '$targetFunctionId'."
            }
        }
    }

    # Remove obsolete variables if present on function
    $obsoleteKeys = @("PROFILES_COLLECTION_ID")
    foreach ($obsKey in $obsoleteKeys) {
        $obsVar = $existingVariables | Where-Object { $_.key -eq $obsKey } | Select-Object -First 1
        if ($obsVar) {
            Write-Host "Removing obsolete variable $obsKey on function $targetFunctionId"
            & $AppwriteCli functions delete-variable `
                --function-id $targetFunctionId `
                --variable-id $obsVar.'$id' | Out-Null
        }
    }
}

Write-Host "[OK] Function variable synchronization completed."
