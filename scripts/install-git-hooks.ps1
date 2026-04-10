Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) {
  throw "Unable to resolve repository root."
}

Set-Location $repoRoot
git config core.hooksPath .githooks

Write-Host "Git hooks are configured for this repository."
Write-Host "core.hooksPath=$(git config --get core.hooksPath)"
