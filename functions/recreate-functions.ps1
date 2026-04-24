param(
    [switch]$WithVariables,
    [switch]$RemoveObsoleteFunctions,
    [string]$FunctionId = ""
)

$ErrorActionPreference = "Stop"
$AppwriteCli = (Get-Command appwrite.cmd).Source

$manifestPath = Join-Path $PSScriptRoot "function-manifest.json"
if (-not (Test-Path $manifestPath)) {
    throw "Function manifest not found at $manifestPath"
}

$manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
if (-not $manifest) {
    throw "Function manifest is empty."
}

$selected = @($manifest | Where-Object { [string]::IsNullOrWhiteSpace($FunctionId) -or $_.functionId -eq $FunctionId })
if (-not $selected.Count) {
    throw "No function matched FunctionId '$FunctionId'."
}

Push-Location $PSScriptRoot
try {

$ObsoleteFunctionIds = @()

function Sync-FunctionVariables {
    param(
        [string]$TargetFunctionId = ""
    )

    $scriptPath = Join-Path $PSScriptRoot "sync-function-variables.ps1"
    if (-not (Test-Path $scriptPath)) {
        throw "Function variable sync script not found at $scriptPath"
    }

    $invokeArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $scriptPath)
    if (-not [string]::IsNullOrWhiteSpace($TargetFunctionId)) {
        $invokeArgs += @("-FunctionId", $TargetFunctionId)
    }
    & powershell @invokeArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Function variable sync failed."
    }
}

foreach ($item in $selected) {
    $codePath = Join-Path $PSScriptRoot $item.path
    if (-not (Test-Path $codePath)) {
        throw "Function path not found: $codePath"
    }

    Write-Host "Recreating $($item.functionId) from $codePath"

    $existingFunction = $null
    $existingVariables = @()
    try {
        $existingFunction = & $AppwriteCli functions get --function-id $item.functionId --json | ConvertFrom-Json
        $existingVariables = @((& $AppwriteCli functions list-variables --function-id $item.functionId --json | ConvertFrom-Json).variables)
    } catch {
        Write-Host "Function $($item.functionId) does not exist yet. Creating fresh."
    }

    if ($existingFunction) {
        & $AppwriteCli functions delete --function-id $item.functionId | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to delete function $($item.functionId)"
        }
    }

    $runtime = if ($item.PSObject.Properties.Name -contains "runtime" -and -not [string]::IsNullOrWhiteSpace([string]$item.runtime)) {
        [string]$item.runtime
    } else {
        "python-3.9"
    }

    $createArgs = @(
        "functions", "create",
        "--function-id", $item.functionId,
        "--name", $item.name,
        "--runtime", $runtime,
        "--entrypoint", $item.entrypoint,
        "--commands", $item.buildCommands,
        "--timeout", [string]$item.timeout,
        "--enabled", "true",
        "--logging", "true"
    )
    if ($item.PSObject.Properties.Name -contains "events" -and @($item.events).Count -gt 0) {
        $createArgs += @("--events")
        $createArgs += @($item.events)
    }
    if ($item.PSObject.Properties.Name -contains "schedule" -and -not [string]::IsNullOrWhiteSpace([string]$item.schedule)) {
        $createArgs += @("--schedule", [string]$item.schedule)
    }

    & $AppwriteCli @createArgs | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create function $($item.functionId)"
    }

    foreach ($variable in $existingVariables) {
        if ($variable.secret -eq $true) {
            Write-Warning "Skipping secret variable '$($variable.key)' for $($item.functionId). Recreate it manually in Appwrite as a non-secret value if needed."
            continue
        }

        & $AppwriteCli functions create-variable `
            --function-id $item.functionId `
            --key $variable.key `
            --value ([string]$variable.value) `
            --secret false | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to recreate variable $($variable.key) for $($item.functionId)"
        }
    }

    & $AppwriteCli functions create-deployment `
        --function-id $item.functionId `
        --code $item.path `
        --activate true `
        --entrypoint $item.entrypoint `
        --commands $item.buildCommands | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to deploy $($item.functionId)"
    }

    if ($WithVariables) {
        Sync-FunctionVariables -TargetFunctionId $item.functionId
    }
}

if ($RemoveObsoleteFunctions) {
    foreach ($obsoleteFunctionId in $ObsoleteFunctionIds) {
        $exists = $false
        try {
            & $AppwriteCli functions get --function-id $obsoleteFunctionId | Out-Null
            $exists = $LASTEXITCODE -eq 0
        } catch {
            $exists = $false
        }

        if ($exists) {
            Write-Host "Removing obsolete function $obsoleteFunctionId"
            & $AppwriteCli functions delete --function-id $obsoleteFunctionId | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to delete obsolete function $obsoleteFunctionId"
            }
        }
    }
}
}
finally {
    Pop-Location
}
