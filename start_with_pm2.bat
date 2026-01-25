@echo off
title TIBOU AUTO - Demarrage avec PM2
color 0B

echo ========================================
echo    TIBOU AUTO - Demarrage avec PM2
echo ========================================
echo.

:: Verification de PM2
echo [1/2] Verification de PM2...
pm2 --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] PM2 n'est pas installe
    echo.
    choice /C YN /M "Voulez-vous installer PM2 maintenant"
    if errorlevel 2 goto :end
    echo.
    echo Installation de PM2...
    npm install -g pm2
    if %errorlevel% neq 0 (
        echo [ERREUR] Echec de l'installation de PM2
        pause
        exit /b 1
    )
    echo [OK] PM2 installe avec succes
)
echo [OK] PM2 detecte
echo.

:: Demarrage avec PM2
echo [2/2] Demarrage du serveur avec PM2...
cd /d "%~dp0server"

:: Arreter si deja en cours
pm2 stop tibouauto >nul 2>&1

:: Demarrer
pm2 start ecosystem.config.js

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   Serveur demarre avec succes!
    echo   Acces: http://localhost:5000
    echo ========================================
    echo.
    echo Commandes utiles:
    echo   pm2 logs tibouauto    - Voir les logs
    echo   pm2 monit             - Monitorer
    echo   pm2 stop tibouauto    - Arreter
    echo   pm2 restart tibouauto - Redemarrer
    echo.
    
    choice /C YN /M "Voulez-vous voir les logs en temps reel"
    if errorlevel 1 if not errorlevel 2 pm2 logs tibouauto
) else (
    echo [ERREUR] Echec du demarrage
)

:end
pause
