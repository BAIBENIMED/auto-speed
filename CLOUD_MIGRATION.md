# Guide de Migration Cloud - TIBOU AUTO

Ce guide explique comment transférer l'application de votre PC local vers un serveur cloud (VPS).

## 🗄️ 1. Exportation des données (Local)
Ouvrez un terminal sur votre PC et exportez votre base de données :
```bash
mysqldump -u root -p gtm_auto > backup_tibou_auto.sql
```

## ☁️ 2. Configuration du Serveur Cloud (VPS Ubuntu)
Une fois votre VPS (DigitalOcean, OVH, etc.) prêt, connectez-vous en SSH et installez l'environnement :

### Mise à jour et composants de base
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nodejs npm mysql-server git
```

### Installation de PM2 (Gestionnaire de processus)
```bash
sudo npm install -g pm2
```

## 🚀 3. Déploiement du Code
1. Clonez votre code depuis votre dépôt Git (GitHub/GitLab) :
   ```bash
   git clone <votre-url-git>
   cd gestion-commandes-vehicules/server
   npm install
   ```

2. Configurez le fichier `.env` :
   ```bash
   nano .env
   ```
   Remplissez avec les accès de votre base de données cloud.

3. Importez vos données :
   ```bash
   mysql -u admin_user -p cloud_db_name < backup_tibou_auto.sql
   ```

4. Démarrez le serveur :
   ```bash
   pm2 start server.js --name "tibou-auto-api"
   pm2 save
   pm2 startup
   ```

## 🌐 4. Accès Public
Pour que l'application soit accessible sans Ngrok :
1. **IP Fixe** : Votre VPS a une adresse IP publique.
2. **Reverse Proxy (Nginx)** : Recommandé pour gérer le HTTPS.
   ```bash
   sudo apt install nginx
   ```
3. **SSL (Certbot)** : Pour avoir le cadenas (HTTPS).
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d gestion.tibouauto.com
   ```

## 🛠️ Prochaines Étapes
- Choisir un fournisseur (DigitalOcean est recommandé pour sa simplicité).
- Créer un compte et un premier "Droplet" (Ubuntu 22.04 LTS).
- Je peux vous aider à configurer les scripts de déploiement automatique.
