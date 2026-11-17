$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
$testRoot=Join-Path $env:LOCALAPPDATA 'QCUWindowsRc44Tests\20261117-rc451'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$dest='C:\QCU451-final'
if(Test-Path $dest){throw 'Fresh destination required'}
try{[IO.Compression.ZipFile]::ExtractToDirectory((Join-Path $testRoot 'final-delivery-v2.zip'),$dest);Write-Output ('ZIP_NET_EXTRACTED:'+@(Get-ChildItem -LiteralPath $dest -File -Recurse).Count)}catch{Write-Output $_.Exception.ToString();exit 1}
