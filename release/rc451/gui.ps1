$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
$testRoot=Join-Path $env:LOCALAPPDATA 'QCUWindowsRc44Tests\20261117-rc451'
$kit=Join-Path $testRoot '中文 空格\QCU助手'
$env:QCU_TEACHER_TEST_HOME=Join-Path $testRoot 'fresh user data'
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Start-Process (Join-Path $kit 'QCU助手.exe')
Write-Output 'GUI_REQUESTED:isolated-rc451-profile'
