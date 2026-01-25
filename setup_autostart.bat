@echo off
title TIBOU AUTO - Configuration Demarrage Automatique
color 0E

echo ========================================
echo   Configuration Demarrage Automatique
echo ========================================
echo.
echo Ce script va configurer le serveur pour
echo demarrer automatiquement avec Windows.
echo.
echo PREREQUIS: PM2 doit etre installe
echo.
pause

:: Verification de PM2
pm2 --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] PM2 n'est pas installe
    echo Executez d'abord: start_with_pm2.bat
    pause
    exit /b 1
)

echo [1/4] Demarrage du serveur avec PM2...
cd /d "%~dp0server"
pm2 start ecosystem.config.js
if %errorlevel% neq 0 (
    echo [ERREUR] Echec du demarrage
    pause
    exit /b 1
)
echo [OK] Serveur demarre
echo.

echo [2/4] Sauvegarde de la configuration PM2...
pm2 save
echo [OK] Configuration sauvegardee
echo.

echo [3/4] Configuration du demarrage automatique...
echo.
echo IMPORTANT: Cette etape necessite des privileges administrateur
echo Une fenetre UAC va s'ouvrir, cliquez sur "Oui"
echo.
pause

pm2 startup
echo.
echo [!] COPIEZ et EXECUTEZ la commande affichee ci-dessus
echo     (celle qui commence par "pm2 startup...")
echo.
echo [4/4] Apres avoir execute la commande, appuyez sur une touche...
pause

pm2 save
echo.
echo ========================================
echo   Configuration terminee!
echo ========================================
echo.
echo Le serveur demarrera automatiquement
echo au prochain demarrage de Windows.
echo.
echo Pour desactiver:
echo   pm2 unstartup
echo.
pause
