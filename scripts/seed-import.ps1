param(
  [string]$Username = 'bence',
  [string]$Password = 'secret123',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $repoRoot 'backend'

$dryRunArg = if ($DryRun) { '--dry-run' } else { '' }
Set-Location $backendPath
npx tsx src/scripts/import-from-txt.ts --username $Username --password $Password $dryRunArg
