# Run BD Tool locally (Next.js)
# Start in background: .\run-local.ps1
# Start in foreground: .\run-local.ps1 -Foreground
# Check status: .\run-local.ps1 -Status
# Stop server: .\run-local.ps1 -Stop
# Optional port: .\run-local.ps1 -Port 3001

param(
  [ValidateRange(1, 65535)]
  [int]$Port = 3000,
  [switch]$Foreground,
  [switch]$Status,
  [switch]$Stop
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$runtimeDirectory = Join-Path $PSScriptRoot ".next"
$statePath = Join-Path $runtimeDirectory "local-server-$Port.json"
$outputLogPath = Join-Path $runtimeDirectory "local-server-$Port.log"
$errorLogPath = Join-Path $runtimeDirectory "local-server-$Port.error.log"

function Get-ServerState {
  if (-not (Test-Path -LiteralPath $statePath)) { return $null }
  try {
    return Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Get-LiveServerProcess {
  $state = Get-ServerState
  if (-not $state -or -not $state.pid) { return $null }
  return Get-Process -Id ([int]$state.pid) -ErrorAction SilentlyContinue
}

function Get-DescendantProcessIds {
  param([int]$ParentId)
  $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $ParentId" -ErrorAction SilentlyContinue)
  $ids = @()
  foreach ($child in $children) {
    $ids += Get-DescendantProcessIds -ParentId ([int]$child.ProcessId)
    $ids += [int]$child.ProcessId
  }
  return $ids
}

if ($Status) {
  $process = Get-LiveServerProcess
  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($process -and $listener) {
    Write-Host "BD Tool is running at http://localhost:$Port" -ForegroundColor Green
    Write-Host "Launcher PID: $($process.Id) | Server PID: $($listener.OwningProcess)"
    Write-Host "Output log: $outputLogPath"
    Write-Host "Error log:  $errorLogPath"
    exit 0
  }
  Write-Host "BD Tool is not running on port $Port." -ForegroundColor Yellow
  exit 1
}

if ($Stop) {
  $process = Get-LiveServerProcess
  if (-not $process) {
    Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
    Write-Host "BD Tool is not running on port $Port." -ForegroundColor Yellow
    exit 0
  }
  $descendantIds = @(Get-DescendantProcessIds -ParentId $process.Id)
  foreach ($processId in $descendantIds) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  Write-Host "Stopped BD Tool on port $Port." -ForegroundColor Green
  exit 0
}

Write-Host ""
Write-Host "=== Bizcraw local development ===" -ForegroundColor Cyan
Write-Host "Working directory: $PWD"
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is not installed or not in PATH." -ForegroundColor Red
  Write-Host "Install from https://nodejs.org/ then re-run this script."
  exit 1
}

$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCommand) {
  Write-Host "npm is not installed or not in PATH." -ForegroundColor Red
  exit 1
}

$nodeVersion = node -v
$npmVersion = npm -v
Write-Host "Node: $nodeVersion | npm: $npmVersion"

if (-not (Test-Path -LiteralPath ".\node_modules")) {
  Write-Host ""
  Write-Host "Installing dependencies (npm install)..." -ForegroundColor Yellow
  npm.cmd install
  if ($LASTEXITCODE -ne 0) {
    Write-Host "npm install failed." -ForegroundColor Red
    exit $LASTEXITCODE
  }
}

$existingProcess = Get-LiveServerProcess
$existingListener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existingProcess -and $existingListener) {
  Write-Host "BD Tool is already running at http://localhost:$Port" -ForegroundColor Green
  Write-Host "Use .\run-local.ps1 -Port $Port -Status to inspect it."
  exit 0
}
if ($existingListener) {
  Write-Host "Port $Port is already used by process $($existingListener.OwningProcess)." -ForegroundColor Red
  Write-Host "Choose another port with .\run-local.ps1 -Port 3001"
  exit 1
}

Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue

if ($Foreground) {
  Write-Host ""
  Write-Host "Starting dev server at http://localhost:$Port in this terminal" -ForegroundColor Green
  Write-Host "Press Ctrl+C to stop."
  Write-Host ""
  npm.cmd run dev -- -p $Port
  exit $LASTEXITCODE
}

New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
Write-Host ""
Write-Host "Starting dev server in the background at http://localhost:$Port ..." -ForegroundColor Green

$serverProcess = Start-Process `
  -FilePath $npmCommand.Source `
  -ArgumentList @("run", "dev", "--", "-p", "$Port") `
  -WorkingDirectory $PSScriptRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $outputLogPath `
  -RedirectStandardError $errorLogPath `
  -PassThru

@{
  pid = $serverProcess.Id
  port = $Port
  startedAt = (Get-Date).ToString("o")
  outputLog = $outputLogPath
  errorLog = $errorLogPath
} | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8

$ready = $false
for ($attempt = 0; $attempt -lt 60; $attempt++) {
  Start-Sleep -Milliseconds 500
  if (-not (Get-Process -Id $serverProcess.Id -ErrorAction SilentlyContinue)) { break }
  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($listener) {
    $ready = $true
    break
  }
}

if (-not $ready) {
  Write-Host "The dev server did not become ready." -ForegroundColor Red
  if (Test-Path -LiteralPath $errorLogPath) {
    Get-Content -LiteralPath $errorLogPath -Tail 20
  }
  Write-Host "See logs at $outputLogPath and $errorLogPath"
  exit 1
}

Write-Host "BD Tool is running independently of this terminal." -ForegroundColor Green
Write-Host "Status: .\run-local.ps1 -Port $Port -Status"
Write-Host "Stop:   .\run-local.ps1 -Port $Port -Stop"
Write-Host "Logs:   $outputLogPath"
