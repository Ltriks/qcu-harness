$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
Get-Process | Where-Object {$_.ProcessName -in @('DeepSeek Harness','QCU助手')} | Select-Object ProcessName,Id,MainWindowTitle | ConvertTo-Json -Compress
$teacherDataHome=Join-Path $env:LOCALAPPDATA 'QCUWindowsRc44Tests\20261117-rc451\fresh user data'
Get-ChildItem -LiteralPath (Join-Path $teacherDataHome 'electron') -File -ErrorAction SilentlyContinue | Select-Object Name,Length | ConvertTo-Json -Compress
