<#
  Deploys SuryaCheck to AWS: API on Lambda (via SAM), website on S3 + CloudFront.

  Needs: AWS CLI (logged in: `aws configure`), AWS SAM CLI, Docker Desktop running, pnpm.
  Run from anywhere:   powershell -ExecutionPolicy Bypass -File infra\deploy.ps1
  Options:             -Stack suryacheck -Region ap-southeast-2 -NoContainer
#>
param(
  [string]$Stack = 'suryacheck',
  [string]$Region = 'ap-southeast-2',   # Sydney: the only Region AWS's new sign-up gives Indian accounts (site still served from India via CloudFront)
  [switch]$NoContainer              # build without Docker (only if Docker is not available)
)

$ErrorActionPreference = 'Stop'
$infra = $PSScriptRoot
$root = Split-Path $infra -Parent

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Check($what) { if ($LASTEXITCODE -ne 0) { throw "$what failed (exit code $LASTEXITCODE)" } }

foreach ($tool in 'aws', 'sam', 'pnpm') {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "'$tool' is not installed or not on PATH. See README > Deploy on AWS." }
}

Step 'Checking AWS login'
aws sts get-caller-identity --query Account --output text; Check 'aws sts get-caller-identity (run `aws configure` first)'

Step 'Staging the backend (only the files Lambda needs, like the Dockerfile)'
$api = Join-Path $infra 'build\api'
if (Test-Path $api) { Remove-Item -Recurse -Force $api }
New-Item -ItemType Directory -Force $api | Out-Null
foreach ($f in 'main.py', 'geo.py', 'finance.py', 'reference.json', 'requirements.txt') {
  Copy-Item (Join-Path $root "backend\$f") $api
}

Step 'Building the API with SAM'
Push-Location $infra
try {
  # In a Linux container, so compiled packages (pydantic-core) match Lambda, not Windows.
  if ($NoContainer) { sam build } else { sam build --use-container }
  Check 'sam build'

  Step "Deploying stack '$Stack' to $Region"
  sam deploy --stack-name $Stack --region $Region --resolve-s3 --capabilities CAPABILITY_IAM `
    --no-confirm-changeset --no-fail-on-empty-changeset
  Check 'sam deploy'
} finally { Pop-Location }

$outputs = aws cloudformation describe-stacks --stack-name $Stack --region $Region --query 'Stacks[0].Outputs' --output json | ConvertFrom-Json
Check 'reading stack outputs'
function OutputOf($key) { ($outputs | Where-Object { $_.OutputKey -eq $key }).OutputValue }
$apiUrl = OutputOf 'ApiUrl'
$siteUrl = OutputOf 'SiteUrl'
$bucket = OutputOf 'SiteBucketName'
$distribution = OutputOf 'DistributionId'

Step "Checking the API answers ($apiUrl/health)"
try { Invoke-RestMethod "$apiUrl/health" -TimeoutSec 30 | ConvertTo-Json -Compress } catch { Write-Warning "API health check failed: $_" }

Step 'Building the website as static files'
Push-Location (Join-Path $root 'web')
try {
  $env:STATIC_EXPORT = '1'
  $env:NEXT_PUBLIC_API_URL = $apiUrl
  pnpm install --frozen-lockfile; Check 'pnpm install'
  pnpm build; Check 'pnpm build'
} finally {
  Remove-Item Env:STATIC_EXPORT, Env:NEXT_PUBLIC_API_URL -ErrorAction SilentlyContinue
  Pop-Location
}

Step 'Uploading the website to S3'
aws s3 sync (Join-Path $root 'web\out') "s3://$bucket" --delete --region $Region; Check 'aws s3 sync'

Step 'Refreshing CloudFront'
aws cloudfront create-invalidation --distribution-id $distribution --paths '/*' --query 'Invalidation.Id' --output text; Check 'cloudfront invalidation'

Write-Host "`nDone." -ForegroundColor Green
Write-Host "  Website: $siteUrl   (a brand-new CloudFront site can take ~5 minutes to appear)"
Write-Host "  API:     $apiUrl"
