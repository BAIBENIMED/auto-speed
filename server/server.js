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

// CORS - strictly allow the render domain in production, or '*' with credentials handled
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // In production, we'd ideally list the domain, but for now we'll allow all while debugging
        return callback(null, true);
    },
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

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

// Diagnostic endpoint for Cloud deployment
app.get('/api/diag', async (req, res) => {
    // Show environment status immediately
    const diag = {
        timestamp: new Date().toISOString(),
        version: "2.1",
        request: {
            origin: req.get('origin'),
            host: req.get('host'),
            protocol: req.protocol,
            ip: req.ip
        },
        environment: {
            NODE_ENV: process.env.NODE_ENV,
            DB_HOST_SET: !!process.env.DB_HOST,
            DB_USER_SET: !!process.env.DB_USER,
            DB_NAME_SET: !!process.env.DB_NAME,
            DB_PORT_SET: !!process.env.DB_PORT,
            JWT_SECRET_SET: !!process.env.JWT_SECRET,
            PORT: process.env.PORT
        },
        database_config: {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT
        }
    };

    try {
        await sequelize.authenticate();
        diag.database_connection = "OK";
        diag.users_count = await models.User.count();
        res.json(diag);
    } catch (error) {
        diag.database_connection = "FAILED";
        diag.error = {
            name: error.name,
            message: error.message || "Unknown error (Empty message)",
            code: error.original ? error.original.code : error.code,
            details: error.toString()
        };
        res.status(500).json(diag);
    }
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

        // Auto-seed Roles and Admin if empty (Cloud setup helper)
        const rolesCount = await models.Role.count();
        if (rolesCount === 0) {
            console.log('🌱 Seeding initial roles...');
            await models.Role.bulkCreate([
                { id: 'admin', name: 'Administrateur', permissions: ['dashboard', 'clients', 'orders', 'vehicles', 'tracking', 'shipments', 'cash', 'settings', 'verification', 'audit'] },
                { id: 'manager', name: 'Manager', permissions: ['dashboard', 'clients', 'orders', 'vehicles', 'tracking', 'shipments', 'cash', 'verification'] },
                { id: 'commercial', name: 'Commercial', permissions: ['dashboard', 'clients', 'orders'] }
            ]);
        }

        const adminExists = await models.User.findOne({ where: { username: 'admin' } });
        if (!adminExists) {
            console.log('🌱 Seeding admin user...');
            await models.User.create({
                id: 'admin-' + Date.now(),
                username: 'admin',
                password: 'admin123',
                name: 'Administrateur',
                roleId: 'admin'
            });
        }
    } catch (err) {
        console.warn('⚠️ Attention: Problème lors de la synchronisation/seeding');
        console.error('Erreur:', err);
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
