@echo off
title TIBOU AUTO - Serveur Backend
color 0A

echo ========================================
echo    TIBOU AUTO - Demarrage du Serveur
echo ========================================
echo.

:: Verification si le serveur est deja en cours d'execution
echo [1/3] Verification du port 5000...
netstat -ano | findstr :5000 | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo [!] Le serveur est deja en cours d'execution sur le port 5000
    echo.
    choice /C YN /M "Voulez-vous le redemarrer"
    if errorlevel 2 goto :end
    echo.
    echo [*] Arret du serveur en cours...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
    timeout /t 2 /nobreak >nul
)

echo [OK] Port 5000 disponible
echo.

:: Verification de Node.js
echo [2/3] Verification de Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installe ou n'est pas dans le PATH
    echo Telechargez Node.js depuis: https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js detecte
echo.

:: Demarrage du serveur
echo [3/3] Demarrage du serveur...
cd /d "%~dp0server"
echo.
echo ========================================
echo   Serveur en cours d'execution...
echo   Acces: http://localhost:5000
echo   Appuyez sur Ctrl+C pour arreter
echo ========================================
echo.

npm start

:end
pause
