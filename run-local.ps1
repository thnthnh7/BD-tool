# Run BD Tool locally (Next.js)
# Usage: .\run-local.ps1
# Optional: .\run-local.ps1 -Port 3001

param(
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "=== CSJ Tek - BD Quote Tool ===" -ForegroundColor Cyan
Write-Host "Working directory: $PWD"
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is not installed or not in PATH." -ForegroundColor Red
  Write-Host "Install from https://nodejs.org/ then re-run this script."
  exit 1
}

$nodeVersion = node -v
$npmVersion = npm -v
Write-Host "Node: $nodeVersion  |  npm: $npmVersion"

if (-not (Test-Path ".\node_modules")) {
  Write-Host ""
  Write-Host "Installing dependencies (npm install)..." -ForegroundColor Yellow
  npm.cmd install
  if ($LASTEXITCODE -ne 0) {
    Write-Host "npm install failed." -ForegroundColor Red
    exit $LASTEXITCODE
  }
}

Write-Host ""
Write-Host "Starting dev server at http://localhost:$Port" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop."
Write-Host ""

npm.cmd run dev -- -p $Port
