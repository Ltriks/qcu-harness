$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
$kit='C:\QCU451-final\QCU助手'
$testRoot=Join-Path $env:LOCALAPPDATA 'QCUWindowsRc44Tests\20261117-rc451'
$source='\\Mac\Home\Repos\cowork\qcu-harness\.work\release-rc45\release\rc451\existing-market-check.cjs'
$env:ELECTRON_RUN_AS_NODE='1'
$p=Start-Process (Join-Path $kit 'program\DeepSeek Harness.exe') -ArgumentList ('--expose-internals "'+$source+'"') -Wait -PassThru -RedirectStandardOutput (Join-Path $testRoot 'existing-market.out') -RedirectStandardError (Join-Path $testRoot 'existing-market.err')
Get-Content (Join-Path $testRoot 'existing-market.out')
Get-Content (Join-Path $testRoot 'existing-market.err')
if($p.ExitCode -ne 0){throw 'Existing market check failed'}
Write-Output ('HOTFIX_PROCESSES:'+@(Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue | Where-Object {$_.Path -like 'C:\QCU451-final\*'}).Count)
