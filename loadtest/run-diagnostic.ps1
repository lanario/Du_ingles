param(
  [Parameter(Mandatory = $true)][string]$BaseUrl,
  [Parameter(Mandatory = $true)][string]$EnvFile,
  [string]$UsersFile = "loadtest/data/test-users.staging.local.json",
  [ValidateRange(3, 10000)][int]$MaxVus = 500,
  [ValidateRange(1, 3600)][int]$StepRampSeconds = 60,
  [ValidateRange(1, 3600)][int]$StepHoldSeconds = 60,
  [ValidateRange(1, 3600)][int]$PeakHoldSeconds = 300,
  [ValidateRange(1, 3600)][int]$RampDownSeconds = 120,
  [ValidateRange(1, 1000)][int]$PdfVus = 20,
  [ValidateRange(1, 100)][int]$PdfRps = 2,
  [switch]$AllowProduction
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$resolvedEnv = (Resolve-Path -LiteralPath $EnvFile).Path
$resolvedUsers = (Resolve-Path -LiteralPath $UsersFile).Path
$baseUri = [uri]$BaseUrl
if ($baseUri.Scheme -notin @("http", "https")) {
  throw "BaseUrl deve usar HTTP ou HTTPS."
}

$values = @{}
foreach ($line in Get-Content -LiteralPath $resolvedEnv) {
  if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
    $values[$Matches[1]] = $Matches[2].Trim('"', "'")
  }
}
$supabaseUrl = $values["NEXT_PUBLIC_SUPABASE_URL"]
$anonKey = $values["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
if (-not $supabaseUrl -or -not $anonKey) {
  throw "EnvFile precisa conter NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY."
}

# Evita usar sem perceber o projeto de produção configurado em .env.local.
$productionEnv = Join-Path $projectRoot ".env.local"
if (-not $AllowProduction -and (Test-Path -LiteralPath $productionEnv)) {
  $productionValues = @{}
  foreach ($line in Get-Content -LiteralPath $productionEnv) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
      $productionValues[$Matches[1]] = $Matches[2].Trim('"', "'")
    }
  }
  $productionSite = $productionValues["NEXT_PUBLIC_SITE_URL"]
  $productionSupabase = $productionValues["NEXT_PUBLIC_SUPABASE_URL"]
  if (
    ($productionSite -and $BaseUrl.TrimEnd('/') -eq $productionSite.TrimEnd('/')) -or
    ($productionSupabase -and $supabaseUrl.TrimEnd('/') -eq $productionSupabase.TrimEnd('/'))
  ) {
    throw "BaseUrl ou SupabaseUrl aponta para produção. Use o ambiente de homologação."
  }
}

$users = Get-Content -LiteralPath $resolvedUsers -Raw | ConvertFrom-Json
foreach ($role in @("students", "teachers", "admins")) {
  if ($null -eq $users.$role -or @($users.$role).Count -lt 1) {
    throw "UsersFile precisa conter ao menos uma conta em $role."
  }
}

$env:BASE_URL = $BaseUrl.TrimEnd('/')
$env:SUPABASE_URL = $supabaseUrl.TrimEnd('/')
$env:SUPABASE_ANON_KEY = $anonKey
$env:MAX_VUS = "$MaxVus"
$env:STEP_RAMP_SECONDS = "$StepRampSeconds"
$env:STEP_HOLD_SECONDS = "$StepHoldSeconds"
$env:PEAK_HOLD_SECONDS = "$PeakHoldSeconds"
$env:RAMP_DOWN_SECONDS = "$RampDownSeconds"
$env:PDF_VUS = "$PdfVus"
$env:PDF_RPS = "$PdfRps"
$env:TEST_USERS_FILE = "./data/$(Split-Path -Leaf $resolvedUsers)"

if ((Split-Path -Parent $resolvedUsers) -ne (Join-Path $PSScriptRoot "data")) {
  throw "UsersFile deve estar em loadtest/data para o k6 localizar o arquivo."
}

$resultsDir = Join-Path $PSScriptRoot "results"
New-Item -ItemType Directory -Force -Path $resultsDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$raw = Join-Path $resultsDir "diagnostic-$stamp.ndjson"
$summary = Join-Path $resultsDir "diagnostic-$stamp-summary.json"
$report = Join-Path $resultsDir "diagnostic-$stamp-report.md"

Write-Host "Iniciando diagnóstico em $($baseUri.Host) com $MaxVus VUs de navegação e até $PdfVus de PDF/CSV."
Push-Location $projectRoot
try {
  & k6 run --quiet --out "json=$raw" --summary-export $summary "loadtest/diagnostic-500.js"
  $k6Exit = $LASTEXITCODE
  if (Test-Path -LiteralPath $raw) {
    & node "loadtest/analyze-results.mjs" $raw $summary $report
    if ($LASTEXITCODE -ne 0) { throw "Falha ao analisar as métricas k6." }
  }
  if (Test-Path -LiteralPath $summary) { Write-Host "Resumo: $summary" }
  if (Test-Path -LiteralPath $report) { Write-Host "Relatório: $report" }
  exit $k6Exit
} finally {
  Pop-Location
}
