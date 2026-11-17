$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
$testRoot=Join-Path $env:LOCALAPPDATA 'QCUWindowsRc44Tests\20261117-rc451'
$kit='C:\QCU451-test\QCU助手'
$env:QCU_TEACHER_TEST_HOME=Join-Path $testRoot 'final ZIP short path test data'
1..2|ForEach-Object{
$p=Start-Process (Join-Path $kit 'QCU助手.exe') -ArgumentList '--prepare-only' -Wait -PassThru -RedirectStandardOutput (Join-Path $testRoot 'short-zip.out') -RedirectStandardError (Join-Path $testRoot 'short-zip.err')
if($p.ExitCode -ne 0){Get-Content (Join-Path $testRoot 'short-zip.err');throw 'ZIP prepare failed'}
}
Write-Output 'FINAL_ZIP_SHORT:prepare-repeat-passed'
