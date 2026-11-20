param([Parameter(Mandatory=$true)][string]$Stage)
$ErrorActionPreference='Stop'
$stagePath=(Resolve-Path -LiteralPath $Stage).Path
$iconSource=Join-Path $PSScriptRoot 'assets\QCUBuddy.ico'
$local=Join-Path ([IO.Path]::GetTempPath()) ('qcu-buddy-build-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $local | Out-Null
try {
 Copy-Item -LiteralPath (Join-Path $stagePath 'Launcher.cs') -Destination (Join-Path $local 'Launcher.cs')
 Copy-Item -LiteralPath $iconSource -Destination (Join-Path $local 'QCUBuddy.ico')
 $csc=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
 $compiled=Join-Path $local 'QCU Buddy.exe'
 & $csc /nologo /target:winexe /platform:x64 /reference:System.Windows.Forms.dll "/out:$compiled" ("/win32icon:"+(Join-Path $local 'QCUBuddy.ico')) (Join-Path $local 'Launcher.cs')
 if($LASTEXITCODE -ne 0){throw 'Launcher compile failed'}
 Copy-Item -LiteralPath $compiled -Destination (Join-Path $stagePath 'QCU Buddy\QCU Buddy.exe') -Force
 Write-Output 'Compiled QCU Buddy Windows launcher; run package and native acceptance next.'
} finally { Remove-Item -LiteralPath $local -Recurse -Force }
