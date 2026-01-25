@echo off
echo ========================================
echo TIBOU AUTO - Ngrok Setup
echo ========================================
echo.
echo This script will expose your backend API server via ngrok
echo.
echo Prerequisites:
echo 1. Backend server must be running on port 5000
echo 2. Ngrok must be installed (download from https://ngrok.com)
echo.
echo ========================================
echo.

REM Check if ngrok is installed
where ngrok >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: ngrok is not installed or not in PATH
    echo.
    echo Please install ngrok:
    echo 1. Download from https://ngrok.com/download
    echo 2. Extract ngrok.exe to a folder
    echo 3. Add the folder to your PATH environment variable
    echo.
    pause
    exit /b 1
)

echo Starting ngrok tunnel on port 5000...
echo.
echo Once ngrok starts, you will see a URL like:
echo   https://xxxx-xxxx-xxxx.ngrok.io
echo.
echo Use this URL to access your application remotely!
echo.
echo ========================================
echo.

ngrok http 5000
