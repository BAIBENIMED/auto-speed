const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const sequelize = require('./src/config/database');
const models = require('./src/models');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false // Disable CSP for easier integration of external fonts/icons
}));

// Servir les fichiers statiques (Cache désactivé pour développement/débogage)
app.use(express.static(path.join(__dirname, '..'), {
    setHeaders: (res, filePath) => {
        if (filePath.toLowerCase().endsWith('.html') ||
            filePath.toLowerCase().endsWith('.js') ||
            filePath.toLowerCase().endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        }
    }
}));

// CORS - more permissive for local development and network access
app.use(cors({
    origin: '*',
    credentials: true
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/clients', require('./src/routes/clients'));
app.use('/api/vehicles', require('./src/routes/vehicles'));
app.use('/api/orders', require('./src/routes/orders'));
app.use('/api/shipments', require('./src/routes/shipments'));
app.use('/api/cash', require('./src/routes/cash'));
app.use('/api/settings', require('./src/routes/settings'));
app.use('/api/exchange-rates', require('./src/routes/exchangeRates'));
app.use('/api/roles', require('./src/routes/roles'));
app.use('/api/brands', require('./src/routes/brands'));
app.use('/api/showrooms', require('./src/routes/showrooms'));
app.use('/api/audit', require('./src/routes/audit'));
app.use('/api/sync', require('./src/routes/sync'));
app.use('/api/purchase-orders', require('./src/routes/purchaseOrders'));
app.use('/api/suppliers', require('./src/routes/suppliers'));
// More routes will be added here

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'TIBOU AUTO API is running' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route non trouvée' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
});

// Database sync and server start
const startServer = async () => {
    try {
        // Enabled 'alter' to add missing columns (like 'status' in vehicles)
        await sequelize.sync({ alter: true });
        console.log('✅ Base de données synchronisée');
    } catch (err) {
        console.warn('⚠️ Attention: Problème lors de la synchronisation (Fonctionnalités limitées)');
        console.error('Erreur de synchronisation:', err);
    }

    // Start server independently of sync result
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Serveur démarré sur le port ${PORT}`);
        console.log(`📍 Accès local: http://localhost:${PORT}`);
        console.log(`🌐 Accès réseau: http://192.168.1.12:${PORT}`);
        console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    });
};

startServer();

module.exports = app;
