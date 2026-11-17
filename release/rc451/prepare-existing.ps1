$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
$testRoot=Join-Path $env:LOCALAPPDATA 'QCUWindowsRc44Tests\20261117-rc451'
$kit='C:\QCU451-final\QCU助手'
$teacherDataHome=Join-Path $env:LOCALAPPDATA 'QCU-DSH\teacher\0.1.0-rc.4.5'
Remove-Item Env:QCU_TEACHER_TEST_HOME -ErrorAction SilentlyContinue
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$patch=Join-Path $teacherDataHome 'profiles\desktop\cordis.patch.yml'
$before=(Get-FileHash -LiteralPath $patch).Hash
$p=Start-Process (Join-Path $kit 'QCU助手.exe') -ArgumentList '--prepare-only' -Wait -PassThru -RedirectStandardError (Join-Path $testRoot 'existing-prepare.err') -RedirectStandardOutput (Join-Path $testRoot 'existing-prepare.out')
if($p.ExitCode -ne 0){Get-Content (Join-Path $testRoot 'existing-prepare.err');throw 'Existing profile preparation failed safely'}
if((Get-FileHash -LiteralPath $patch).Hash -ne $before){throw 'Settings changed'}
Write-Output 'EXISTING_PROFILE:managed-market-updated;settings-byte-identical'
Start-Process (Join-Path $kit 'QCU助手.exe')
