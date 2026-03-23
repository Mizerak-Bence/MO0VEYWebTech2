$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $repoRoot 'backend'
$frontendPath = Join-Path $repoRoot 'frontend'

try {
  $mongo = Get-Service MongoDB -ErrorAction Stop
  if ($mongo.Status -ne 'Running') {
    Start-Service MongoDB
    Start-Sleep -Seconds 2
  }
  Write-Host 'MongoDB service is running.' -ForegroundColor Green
} catch {
  Write-Warning 'MongoDB Windows service not found. Start MongoDB manually or use: docker compose up -d mongo'
}

Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$backendPath'; npm run dev"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$frontendPath'; npm start"

Write-Host 'Backend and frontend startup commands launched in separate PowerShell windows.' -ForegroundColor Green
