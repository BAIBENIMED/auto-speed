/**
 * Configuration PM2 pour TIBOU AUTO Backend
 * 
 * Installation de PM2:
 *   npm install -g pm2
 * 
 * Commandes utiles:
 *   pm2 start ecosystem.config.js    - Démarrer l'application
 *   pm2 stop tibouauto               - Arrêter l'application
 *   pm2 restart tibouauto            - Redémarrer l'application
 *   pm2 logs tibouauto               - Voir les logs
 *   pm2 monit                        - Monitorer en temps réel
 *   pm2 list                         - Lister les processus
 *   pm2 startup                      - Configurer le démarrage automatique
 *   pm2 save                         - Sauvegarder la configuration
 */

module.exports = {
    apps: [{
        name: 'tibouauto',
        script: './server.js',
        cwd: __dirname,
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '500M',
        env: {
            NODE_ENV: 'development',
            PORT: 5000
        },
        env_production: {
            NODE_ENV: 'production',
            PORT: 5000
        },
        error_file: './logs/pm2-error.log',
        out_file: './logs/pm2-out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,
        min_uptime: '10s',
        max_restarts: 10,
        restart_delay: 4000
    }]
};
