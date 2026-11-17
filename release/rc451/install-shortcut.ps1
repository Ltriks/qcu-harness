$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
$from='C:\QCU451-final\QCU助手'
$dest='C:\QCU451\QCU助手'
if(-not(Test-Path $dest)){
New-Item -ItemType Directory -Force $dest | Out-Null
robocopy $from $dest /E /NFL /NDL /NJH /NJS /NP
if($LASTEXITCODE -gt 7){throw 'Local program copy failed'}
}
foreach($relative in @('QCU助手.exe','support\manifest.json','program\resources\app.asar')){
if((Get-FileHash -LiteralPath (Join-Path $from $relative)).Hash -ne (Get-FileHash -LiteralPath (Join-Path $dest $relative)).Hash){throw 'Local program hash mismatch'}
}
$menu=Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$link=Join-Path $menu 'QCU Teacher rc4.5.1.lnk'
$shell=New-Object -ComObject WScript.Shell
$fso=New-Object -ComObject Scripting.FileSystemObject
$short=$fso.GetFile((Join-Path $dest 'QCU助手.exe')).ShortPath
$shortcut=$shell.CreateShortcut($link)
$explorer=Join-Path $env:WINDIR 'explorer.exe'
$shortcut.TargetPath=$explorer
$shortcut.Arguments='"'+$short+'"'
$shortcut.WorkingDirectory='C:\QCU451'
$shortcut.Description='QCU Teacher rc4.5.1'
$shortcut.Save()
$verify=$shell.CreateShortcut($link)
if($verify.TargetPath -ne $explorer -or $verify.Arguments -ne ('"'+$short+'"') -or -not(Test-Path -LiteralPath $short)){throw 'Shortcut verification failed'}
Write-Output 'START_MENU:QCU Teacher rc4.5.1; existing-verified-exe-argument-passed'
