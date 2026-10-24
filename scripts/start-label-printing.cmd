@echo off
setlocal
set "CHURCH_CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHURCH_CHROME%" set "CHURCH_CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHURCH_CHROME%" set "CHURCH_CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not exist "%CHURCH_CHROME%" (
  echo Google Chrome was not found. Please install Chrome first.
  pause
  exit /b 1
)
start "" "%CHURCH_CHROME%" --user-data-dir="%LOCALAPPDATA%\ChurchLabelPrintingChrome" --kiosk-printing --use-system-default-printer --new-window "http://192.168.16.240:26001/eureka/sunday/"
endlocal
