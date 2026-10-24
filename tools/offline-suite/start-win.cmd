@echo off
setlocal
set "LAUNCHER=%LOCALAPPDATA%\QCU-DSH\offline\0.1.0-rc.1\Start-QCU-DSH.cmd"
if not exist "%LAUNCHER%" (
  echo Please run 02-install-QCU.cmd first.
  pause
  exit /b 1
)
call "%LAUNCHER%"
