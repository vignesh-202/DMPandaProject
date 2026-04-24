param(
    [switch]$WithVariables,
    [switch]$SkipSettings,
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

function Format-CmdArgument {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    if ($Value -match '[\s"]') {
        return '"' + ($Value -replace '"', '\"') + '"'
    }
    return $Value
}

function Join-AppwriteCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args
    )

    $parts = @($AppwriteCli) + $Args
    return ($parts | ForEach-Object { Format-CmdArgument -Value ([string]$_) }) -join " "
}

function Invoke-AppwriteCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args
    )

    $commandLine = Join-AppwriteCommand -Args $Args
    cmd.exe /c $commandLine
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "Appwrite command failed: $AppwriteCli $($Args -join ' ')"
    }
}

function Test-FunctionExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FunctionId
    )

    $commandLine = Join-AppwriteCommand -Args @("functions", "get", "--function-id", $FunctionId)
    cmd.exe /c "$commandLine >nul 2>nul"
    return $LASTEXITCODE -eq 0
}

function Ensure-FunctionExists {
    param(
        [Parameter(Mandatory = $true)]
        [pscustomobject]$Item
    )

    if (Test-FunctionExists -FunctionId $Item.functionId) {
        return
    }

    Write-Host "Creating missing function $($Item.functionId)"
    $createArgs = @(
        "functions", "create",
        "--function-id", $Item.functionId,
        "--name", $Item.name,
        "--runtime", $Item.runtime,
        "--entrypoint", $Item.entrypoint,
        "--commands", $Item.buildCommands,
        "--timeout", [string]$Item.timeout,
        "--enabled", "true",
        "--logging", "true"
    )

    if ($Item.PSObject.Properties.Name -contains "schedule" -and -not [string]::IsNullOrWhiteSpace([string]$Item.schedule)) {
        $createArgs += @("--schedule", [string]$Item.schedule)
    }
    if ($Item.PSObject.Properties.Name -contains "events" -and $Item.events) {
        $createArgs += @("--events")
        $createArgs += @($Item.events)
    }

    Invoke-AppwriteCommand -Args $createArgs
}

function Remove-ObsoleteFunction {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ObsoleteFunctionId
    )

    if (-not (Test-FunctionExists -FunctionId $ObsoleteFunctionId)) {
        return
    }

    Write-Host "Removing obsolete function $ObsoleteFunctionId"
    Invoke-AppwriteCommand -Args @("functions", "delete", "--function-id", $ObsoleteFunctionId)
}

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

    Write-Host "Deploying $($item.functionId) from $codePath"
    Ensure-FunctionExists -Item $item

    if (-not $SkipSettings) {
        $updateArgs = @(
            "functions", "update",
            "--function-id", $item.functionId,
            "--name", $item.name,
            "--runtime", $item.runtime,
            "--entrypoint", $item.entrypoint,
            "--commands", $item.buildCommands,
            "--timeout", [string]$item.timeout,
            "--enabled", "true",
            "--logging", "true"
        )
        if ($item.PSObject.Properties.Name -contains "schedule" -and -not [string]::IsNullOrWhiteSpace([string]$item.schedule)) {
            $updateArgs += @("--schedule", [string]$item.schedule)
        }
        if ($item.PSObject.Properties.Name -contains "events" -and $item.events) {
            $updateArgs += @("--events")
            $updateArgs += @($item.events)
        }
        Invoke-AppwriteCommand -Args $updateArgs
    }

    $deployArgs = @(
        "functions", "create-deployment",
        "--function-id", $item.functionId,
        "--code", $item.path,
        "--activate", "true",
        "--entrypoint", $item.entrypoint,
        "--commands", $item.buildCommands
    )
    Invoke-AppwriteCommand -Args $deployArgs

    Write-Host "Verifying function status for $($item.functionId)"
    Invoke-AppwriteCommand -Args @("functions", "get", "--function-id", $item.functionId)

    if ($WithVariables) {
        Sync-FunctionVariables -TargetFunctionId $item.functionId
    }
}

if ($RemoveObsoleteFunctions) {
    foreach ($obsoleteFunctionId in $ObsoleteFunctionIds) {
        Remove-ObsoleteFunction -ObsoleteFunctionId $obsoleteFunctionId
    }
}
}
finally {
    Pop-Location
}
