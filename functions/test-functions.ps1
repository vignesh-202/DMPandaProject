param(
    [string]$FunctionId = "",
    [string]$Body = "{}"
)

$ErrorActionPreference = "Stop"
$AppwriteCli = (Get-Command appwrite.cmd).Source
$manifestPath = Join-Path $PSScriptRoot "function-manifest.json"
if (-not (Test-Path $manifestPath)) {
    throw "Function manifest not found at $manifestPath"
}

$manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
$selected = @($manifest | Where-Object { [string]::IsNullOrWhiteSpace($FunctionId) -or $_.functionId -eq $FunctionId })
if (-not $selected.Count) {
    throw "No function matched FunctionId '$FunctionId'."
}

function Import-DotEnvFile {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return }
    foreach ($line in Get-Content -Path $Path) {
        $trimmed = [string]$line
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.Trim().StartsWith("#")) { continue }
        $parts = $trimmed -split "=", 2
        if ($parts.Count -ne 2) { continue }
        $name = [string]$parts[0].Trim()
        $value = [string]$parts[1].Trim().Trim('"')
        if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name, "Process"))) {
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

function Invoke-RestExecution {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TargetFunctionId,
        [Parameter(Mandatory = $true)]
        [string]$ExecutionBody,
        [hashtable]$ExecutionHeaders = @{}
    )

    $repoRoot = Split-Path $PSScriptRoot -Parent
    Import-DotEnvFile -Path (Join-Path $repoRoot "ProductionSetup\\.env")
    Import-DotEnvFile -Path (Join-Path $repoRoot ".env")

    $endpoint = [Environment]::GetEnvironmentVariable("APPWRITE_ENDPOINT", "Process")
    $projectId = [Environment]::GetEnvironmentVariable("APPWRITE_PROJECT_ID", "Process")
    $apiKey = [Environment]::GetEnvironmentVariable("APPWRITE_API_KEY", "Process")
    if ([string]::IsNullOrWhiteSpace($endpoint) -or [string]::IsNullOrWhiteSpace($projectId) -or [string]::IsNullOrWhiteSpace($apiKey)) {
        throw "REST fallback requires APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, and APPWRITE_API_KEY."
    }

    $headers = @{
        "X-Appwrite-Project" = $projectId
        "X-Appwrite-Key" = $apiKey
        "Content-Type" = "application/json"
    }
    $requestHeaders = @{
        "content-type" = "application/json"
    }
    foreach ($key in $ExecutionHeaders.Keys) {
        $requestHeaders[$key] = [string]$ExecutionHeaders[$key]
    }

    $payload = @{
        body = [string]$ExecutionBody
        async = $false
        path = "/"
        method = "POST"
        headers = $requestHeaders
    } | ConvertTo-Json -Depth 5

    return Invoke-RestMethod -Method Post -Uri "$endpoint/functions/$TargetFunctionId/executions" -Headers $headers -Body $payload
}

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

function Invoke-CommandCapture {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CommandLine
    )

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "cmd.exe"
    $psi.Arguments = "/c $CommandLine"
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi
    [void]$process.Start()
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    return [pscustomobject]@{
        ExitCode = $process.ExitCode
        Output = (($stdout, $stderr) -join [Environment]::NewLine).Trim()
    }
}

foreach ($item in $selected) {
    $execution = $null
    $safeBody = [string]$Body
    if ([string]::IsNullOrWhiteSpace($safeBody)) {
        $safeBody = "{}"
    }
    Write-Host "Creating test execution for $($item.functionId)"
    $executionHeaders = @{}
    if ($item.functionId -in @("reset-user-action-budgets", "refresh-instagram-tokens") -and $safeBody -match '"dry_run"\s*:\s*(true|1)') {
        $executionHeaders["x-dry-run"] = "true"
        $safeBody = "{}"
    }
    $commandLine = Join-AppwriteCommand -Args @(
        "functions", "create-execution",
        "--function-id", $item.functionId,
        "--body", $safeBody,
        "--async", "false",
        "--json"
    )
    $result = Invoke-CommandCapture -CommandLine $commandLine
    $rawOutput = $result.Output
    if ($result.ExitCode -ne 0) {
        if ($rawOutput -match 'not valid JSON') {
            Write-Host "CLI execution failed; falling back to REST for $($item.functionId)"
            $execution = Invoke-RestExecution -TargetFunctionId $item.functionId -ExecutionBody $safeBody -ExecutionHeaders $executionHeaders
        } else {
            throw "Failed to create execution for $($item.functionId): $rawOutput"
        }
    }
    if (-not $execution) {
        $jsonPayload = $rawOutput
        $jsonStart = $rawOutput.IndexOf("{")
        if ($jsonStart -ge 0) {
            $jsonPayload = $rawOutput.Substring($jsonStart)
        }

        try {
            $execution = $jsonPayload | ConvertFrom-Json
        } catch {
            throw "Failed to parse execution payload for $($item.functionId): $rawOutput"
        }
    }

    if (-not $execution) {
        throw "Failed to create execution for $($item.functionId): empty response"
    }

    $status = [string]$execution.status
    $executionId = [string]$execution.'$id'
    if ([string]::IsNullOrWhiteSpace($executionId)) {
        $executionId = [string]$execution.id
    }
    Write-Host "Execution $executionId status=$status"
    if ($execution.response) {
        Write-Host "response=$($execution.response)"
    }
    if ($execution.stderr) {
        Write-Host "stderr=$($execution.stderr)"
    }
    if ($status -and $status.ToLower() -notin @("completed", "success", "succeeded")) {
        throw "Function $($item.functionId) test execution did not complete successfully. status=$status"
    }
}
