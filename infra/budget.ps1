<#
  Creates a monthly AWS budget with email alerts, so a mistake can never turn into a surprise bill.

  Alerts go to -Email when real spend passes 50% and 80% of the limit, and when AWS forecasts
  the month will pass 100%. Spend is counted BEFORE credits, so you are warned even while
  hackathon credits are paying the bill.

  Run once:   powershell -ExecutionPolicy Bypass -File infra\budget.ps1 -Email you@example.com
  Options:    -Limit 5   (US dollars per month)   -Name suryacheck-monthly
  AWS sends each address a confirmation email first; click the link in it.
#>
param(
  [Parameter(Mandatory = $true)][string]$Email,
  [int]$Limit = 5,
  [string]$Name = 'suryacheck-monthly'
)

$ErrorActionPreference = 'Stop'
function Check($what) { if ($LASTEXITCODE -ne 0) { throw "$what failed (exit code $LASTEXITCODE)" } }

$account = aws sts get-caller-identity --query Account --output text; Check 'aws sts get-caller-identity (run `aws configure` first)'

$budget = @{
  BudgetName  = $Name
  BudgetLimit = @{ Amount = "$Limit"; Unit = 'USD' }
  TimeUnit    = 'MONTHLY'
  BudgetType  = 'COST'
  CostTypes   = @{ IncludeCredit = $false; IncludeRefund = $false }   # show real usage, even if credits cover it
}
$subscriber = @(@{ SubscriptionType = 'EMAIL'; Address = $Email })
$alerts = @(
  @{ Notification = @{ NotificationType = 'ACTUAL'; ComparisonOperator = 'GREATER_THAN'; Threshold = 50; ThresholdType = 'PERCENTAGE' }; Subscribers = $subscriber },
  @{ Notification = @{ NotificationType = 'ACTUAL'; ComparisonOperator = 'GREATER_THAN'; Threshold = 80; ThresholdType = 'PERCENTAGE' }; Subscribers = $subscriber },
  @{ Notification = @{ NotificationType = 'FORECASTED'; ComparisonOperator = 'GREATER_THAN'; Threshold = 100; ThresholdType = 'PERCENTAGE' }; Subscribers = $subscriber }
)

# Hand the JSON to the AWS CLI through files: Windows PowerShell mangles quotes in long JSON arguments.
$tmp = Join-Path ([IO.Path]::GetTempPath()) "suryacheck-budget-$PID"
New-Item -ItemType Directory -Force $tmp | Out-Null
$budgetFile = Join-Path $tmp 'budget.json'
$alertsFile = Join-Path $tmp 'alerts.json'
[IO.File]::WriteAllText($budgetFile, ($budget | ConvertTo-Json -Depth 5))
[IO.File]::WriteAllText($alertsFile, (ConvertTo-Json -InputObject $alerts -Depth 6))

try {
  aws budgets create-budget --region us-east-1 --account-id $account `
    --budget "file://$budgetFile" --notifications-with-subscribers "file://$alertsFile"
  Check 'aws budgets create-budget (if it already exists, delete it in Billing > Budgets or pick another -Name)'
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}

Write-Host "Budget '$Name' created: `$$Limit/month, alerts to $Email at 50% and 80% spent, and if the month is forecast to pass 100%." -ForegroundColor Green
Write-Host 'Check your inbox and confirm the AWS notification email.'
