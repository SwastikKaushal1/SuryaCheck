# Usage:  .\test-api.ps1                       (local)
#         .\test-api.ps1 https://your-api.com  (deployed)
param([string]$Base = "http://localhost:8000")
$ErrorActionPreference = "Stop"
$script:fail = 0
function Check($name, [scriptblock]$body) {
  try { $r = & $body; Write-Host "PASS  $name  $r" -ForegroundColor Green }
  catch { Write-Host "FAIL  $name  $($_.Exception.Message)" -ForegroundColor Red; $script:fail++ }
}
function Post($path, $obj) {
  Invoke-RestMethod "$Base$path" -Method Post -ContentType "application/json" -Body ($obj | ConvertTo-Json -Depth 5)
}
function Expect($cond, $msg) { if (-not $cond) { throw $msg } }
function ErrBody($scriptblock) {
  try { & $scriptblock | Out-Null; throw "expected an error" }
  catch { if ($_.ErrorDetails.Message) { return ($_.ErrorDetails.Message | ConvertFrom-Json) } else { throw } }
}
$h36 = 1..36 | ForEach-Object { 0 }
$wall = 1..36 | ForEach-Object { $i = ($_ - 1) * 10; if ($i -ge 130 -and $i -le 230) { 30 } else { 0 } }

Check "GET /"          { $r = Invoke-RestMethod "$Base/"; Expect $r.ok "no ok"; "ok" }
Check "GET /geocode"   { $r = @(Invoke-RestMethod "$Base/geocode?q=Connaught Place Delhi"); Expect ($r.Count -ge 1 -and $r[0].lat) "no results"; "$($r[0].lat),$($r[0].lon)" }
Check "GET /reverse"   { $r = Invoke-RestMethod "$Base/reverse?lat=28.6129&lon=77.2295"; Expect ($null -ne $r.found) "no found flag"; "found=$($r.found) state=$($r.stateCode)" }
Check "GET /quick"     { $r = Invoke-RestMethod "$Base/quick?lat=28.61&lon=77.21"; Expect ($r.kwhPerKwp -gt 1000 -and $r.kwhPerKwp -lt 2200) "odd value"; $r.kwhPerKwp }
Check "GET /building"  { $r = Invoke-RestMethod "$Base/building?lat=28.6129&lon=77.2295"; "found=$($r.found)" }
Check "POST /yield"    { $r = Post "/yield" @{lat=28.61;lon=77.21;tilts=@(10,20,30)}; Expect ($r.'20' -gt 1000) "bad yield"; "10=$($r.'10') 20=$($r.'20') 30=$($r.'30')" }
Check "yield horizon 0 = no loss" { $a = Post "/yield" @{lat=28.61;lon=77.21;tilts=@(20)}; $b = Post "/yield" @{lat=28.61;lon=77.21;tilts=@(20);horizon=$h36}; Expect ([math]::Abs($a.'20' - $b.'20') -lt 1) "zero horizon changed yield"; "$($a.'20') vs $($b.'20')" }
Check "yield 30deg south wall = loss" { $a = Post "/yield" @{lat=28.61;lon=77.21;tilts=@(20)}; $b = Post "/yield" @{lat=28.61;lon=77.21;tilts=@(20);horizon=$wall}; Expect ($b.'20' -lt $a.'20') "wall did not reduce yield"; "loss {0:P1}" -f (1 - $b.'20'/$a.'20') }
Check "finance subsidy 1,2,3,5 kW" { $o = foreach ($k in 1,2,3,5) { (Post "/finance" @{kwp=$k;stateCode="DL";monthlyBill=3000;residential=$true}).subsidy }; Expect (($o -join ",") -eq "30000,60000,78000,78000") "got $($o -join ',')"; ($o -join ",") }
Check "finance non-residential = 0 subsidy" { $r = Post "/finance" @{kwp=3;stateCode="DL";monthlyBill=3000;residential=$false}; Expect ($r.subsidy -eq 0) "subsidy not 0"; "ok" }
Check "finance full shape" { $r = Post "/finance" @{kwp=3;stateCode="DL";monthlyBill=3000;residential=$true;kwhPerKwp=1500}; Expect ($r.savingsYear -gt 0 -and $r.paybackRange.Count -eq 2 -and $r.co2 -gt 0) "missing fields"; "payback $($r.paybackRange -join '-') yrs" }
Check "GET /reference" { $r = Invoke-RestMethod "$Base/reference"; Expect $r.panel.kWp "no panel"; "panel $($r.panel.kWp) kWp" }
Check "error shape: bad lat" { $e = ErrBody { Invoke-RestMethod "$Base/quick?lat=abc&lon=77" }; Expect ($e.error -and $e.hint) "no error/hint"; $e.hint }
Check "error shape: bad horizon" { $e = ErrBody { Post "/yield" @{lat=28;lon=77;tilts=@(20);horizon=@(1,2,3)} }; Expect ($e.error -and $e.hint) "no error/hint"; $e.hint }
Check "error shape: 404" { $e = ErrBody { Invoke-RestMethod "$Base/nope" }; Expect ($e.error -and $e.hint) "no error/hint"; $e.hint }

if ($script:fail -eq 0) { Write-Host "`nALL PASSED" -ForegroundColor Green } else { Write-Host "`n$($script:fail) FAILED" -ForegroundColor Red; exit 1 }
