# TIBOU AUTO - Scripts de Démarrage

Ce dossier contient plusieurs scripts pour démarrer le serveur backend.

## 📜 Scripts Disponibles

### 1. start_server.bat (Original)
Script de base pour démarrer le serveur.

### 2. start_server_improved.bat ⭐ NOUVEAU
Script amélioré avec :
- Vérification du port 5000
- Détection de Node.js
- Interface colorée
- Gestion des erreurs

**Utilisation :** Double-cliquez sur le fichier

### 3. start_with_pm2.bat ⭐⭐⭐ RECOMMANDÉ
Démarre le serveur avec PM2 (gestionnaire de processus professionnel)
- Installation automatique de PM2 si nécessaire
- Redémarrage automatique en cas de crash
- Logs et monitoring
- Le serveur continue après fermeture du terminal

**Utilisation :** Double-cliquez sur le fichier

### 4. setup_autostart.bat ⭐⭐⭐⭐ AVANCÉ
Configure le démarrage automatique avec Windows
- Nécessite PM2
- Exécuter en tant qu'administrateur
- Configuration une seule fois

**Utilisation :** Clic droit → Exécuter en tant qu'administrateur

## 🚀 Démarrage Rapide

**Pour la première fois :**
1. Double-cliquez sur `start_with_pm2.bat`
2. Attendez l'installation de PM2 (si nécessaire)
3. Le serveur démarre automatiquement

**Pour les fois suivantes :**
- Double-cliquez sur `start_with_pm2.bat`
- OU utilisez les commandes PM2 :
  ```bash
  pm2 start tibouauto
  pm2 stop tibouauto
  pm2 restart tibouauto
  pm2 logs tibouauto
  ```

## 📚 Documentation Complète

Consultez le guide complet dans le dossier `.gemini/antigravity/brain/` pour plus de détails.

## ❓ Support

En cas de problème :
1. Vérifiez que Node.js est installé : `node --version`
2. Vérifiez que le port 5000 est libre
3. Consultez les logs : `pm2 logs tibouauto` (si vous utilisez PM2)
