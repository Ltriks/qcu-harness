@echo off
setlocal
set "KIT=%~dp0"
set "APP=%LOCALAPPDATA%\Programs\DeepSeek Harness\DeepSeek Harness.exe"
if not exist "%APP%" set "APP=%ProgramFiles%\DeepSeek Harness\DeepSeek Harness.exe"
if defined QCU_DSH_EXE set "APP=%QCU_DSH_EXE%"
if not exist "%APP%" (
  echo Install the official DSH client from the client folder first.
  echo For a custom location set QCU_DSH_EXE to the installed executable.
  pause
  exit /b 1
)
tasklist /FI "IMAGENAME eq DeepSeek Harness.exe" /NH 2>nul | find /I "DeepSeek Harness.exe" >nul
if not errorlevel 1 (
  echo Please save your work and fully quit DeepSeek Harness first.
  pause
  exit /b 1
)
for %%I in ("%APP%") do set "RESOURCES=%%~dpIresources"
set "ELECTRON_RUN_AS_NODE=1"
set "NODE_OPTIONS="
echo Installing ten packages into a separate QCU data directory.
"%APP%" --expose-internals "%KIT%installer\offline.cjs" install --kit "%KIT%." --resources "%RESOURCES%"
if errorlevel 1 (pause& exit /b 1)
choice /C YN /M "Enable seven teaching skills and QCU Market now?"
if errorlevel 2 goto done
"%APP%" --expose-internals "%KIT%installer\offline.cjs" activate --kit "%KIT%." --resources "%RESOURCES%"
if errorlevel 1 (pause& exit /b 1)
:done
echo Ready. Use 03-start-QCU.cmd to open this QCU environment.
echo Configure your own model. Enable Course Studio and Feishu separately in plugin settings.
pause
