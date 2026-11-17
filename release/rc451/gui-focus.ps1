$ErrorActionPreference='Stop'
$p=Get-Process -Name 'DeepSeek Harness' | Where-Object {$_.MainWindowTitle -eq 'DeepSeek Harness' -and $_.Path -like '*20261117-rc451*'}
if(@($p).Count -ne 1){throw 'Isolated window not found'}
(New-Object -ComObject WScript.Shell).AppActivate($p.Id) | Out-Null
Write-Output 'FOCUSED:isolated-hotfix-window'
