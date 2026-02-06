const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
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

// ULTRA SIMPLE TEST - No auth, no dependencies
app.get('/api/test-public', (req, res) => {
    res.json({ message: 'PUBLIC ACCESS WORKS', timestamp: new Date().toISOString(), version: '3.0' });
});



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
app.use('/api/upload', require('./src/routes/upload'));
app.use('/api/tracking', require('./src/routes/tracking'));
app.use('/api/voyages', require('./src/routes/voyages'));
app.use('/api/maintenance', require('./src/routes/maintenance'));

// Initialize Tracking Service

// More routes will be added here

// Basic reachability test
app.get('/', (req, res) => res.json({ message: 'TIBOU AUTO API is running', version: '2.5' }));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'TIBOU AUTO API is running (v2.3 - FIXED)' });
});

// Diagnostic endpoint for Cloud deployment
app.get('/api/diag', async (req, res) => {
    // Show environment status immediately
    const diag = {
        timestamp: new Date().toISOString(),
        version: "2.2",
        request: {
            origin: req.get('origin'),
            host: req.get('host')
        },
        environment: {
            NODE_ENV: process.env.NODE_ENV,
            DB_HOST_SET: !!process.env.DB_HOST,
            DATABASE_URL_SET: !!process.env.DATABASE_URL,
            JWT_SECRET_SET: !!process.env.JWT_SECRET,
            JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN
        }
    };

    try {
        // Test JWT
        const jwt = require('jsonwebtoken');
        const testToken = jwt.sign({ test: true }, process.env.JWT_SECRET || 'test', { expiresIn: '1m' });
        diag.jwt_test = "OK";

        // Test Bcrypt
        const bcrypt = require('bcrypt');
        const hash = await bcrypt.hash('test', 10);
        diag.bcrypt_test = "OK";

        await sequelize.authenticate();
        diag.database_connection = "OK";
        diag.users_count = await models.User.count();
        res.json(diag);
    } catch (error) {
        diag.status = "DIAG_FAILED";
        diag.error = {
            name: error.name,
            message: error.message,
            stack: error.stack
        };
        res.status(500).json(diag);
    }
});

// Diagnostic endpoint for Database Schema
app.get('/api/db-verify', async (req, res) => {
    try {
        const [tables] = await sequelize.query("SHOW TABLES");
        const tableList = tables.map(t => Object.values(t)[0]);

        let schemaInfo = { tables: tableList };

        if (tableList.includes('voyages')) {
            const [columns] = await sequelize.query("DESCRIBE voyages");
            schemaInfo.voyage_columns = columns;
        }

        const [shipmentCols] = await sequelize.query("DESCRIBE shipments");
        schemaInfo.shipment_columns = shipmentCols;

        res.json({ success: true, ...schemaInfo });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
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

// Database sync and server start (Optimized for Cloud)
const startServer = async () => {
    // 1. Start listening IMMEDIATELY (Crucial for Render/Cloud health checks)
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`-----------------------------------------\n`);

        // Start Maritime Tracking Service

    });

    // 2. Initialize Database in background (Non-blocking)
    try {
        console.log('⏳ Initialisation de la base de données...');

        // Sync models
        try {
            await sequelize.sync({ alter: true });
            console.log('✅ Base de données synchronisée (MODE: ALTER)');
        } catch (syncError) {
            if (syncError.name === 'SequelizeDatabaseError' && syncError.parent && syncError.parent.code === 'ER_TOO_MANY_KEYS') {
                console.warn('⚠️ [DB Warning] Trop d\'index détectés sur certaines tables. La synchronisation automatique a été ignorée pour éviter de bloquer le serveur.');
            } else {
                console.error('❌ [DB Error] Erreur de synchronisation schema:', syncError.message);
            }
        }

        // Fail-safe: Ensure specific tables exist (in case global sync failed)
        try {
            await models.Notification.sync({ alter: true });
            console.log('🔧 Table Notification vérifiée/créée (Fail-safe).');

            // Raw SQL Fail-safe for Voyages (Sequelize sync might be ignored due to index warnings)
            await sequelize.query(`
                CREATE TABLE IF NOT EXISTS voyages (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(100) NOT NULL UNIQUE,
                    bl_number VARCHAR(100),
                    vesselName VARCHAR(100),
                    carrier VARCHAR(100),
                    loadingPort VARCHAR(100),
                    destination VARCHAR(100),
                    etd DATE,
                    eta DATE,
                    arrivalDate DATE,
                    status VARCHAR(50) DEFAULT 'Planifié',
                    active TINYINT(1) DEFAULT 1,
                    notes TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB;
            `);
            console.log('🔧 Table Voyage vérifiée/créée (Raw SQL Fail-safe).');

            // Ensure bl_number exists (for existing tables)
            try {
                await sequelize.query(`ALTER TABLE voyages ADD COLUMN bl_number VARCHAR(100) AFTER name;`);
                console.log('🔧 Colonne bl_number ajoutée à la table voyages.');
            } catch (alterErr) {
                // Ignore if column already exists
                if (alterErr.message.includes('Duplicate column name')) {
                    console.log('✅ Colonne bl_number déjà présente dans voyages.');
                } else {
                    console.warn('⚠️ Erreur lors de la vérification de bl_number:', alterErr.message);
                }
            }
        } catch (syncErr) {
            console.error('❌ Echec Fail-safe tables:', syncErr.message);
        }

        // Robust manual check for missing columns (Backwards compatibility/Fail-safe)
        try {
            const columnsToEnsure = [
                { table: 'shipments', name: 'current_lat', def: 'DECIMAL(10, 8)' },
                { table: 'shipments', name: 'current_lng', def: 'DECIMAL(11, 8)' },
                { table: 'shipments', name: 'speed', def: 'DECIMAL(5, 2)' },
                { table: 'shipments', name: 'course', def: 'INTEGER' },
                { table: 'shipments', name: 'last_update', def: 'DATETIME' },
                { table: 'shipments', name: 'ship_status', def: 'VARCHAR(100)' },
                { table: 'shipments', name: 'voyage', def: 'VARCHAR(100)' },
                { table: 'shipments', name: 'is_tracking_active', def: 'TINYINT(1) DEFAULT 0' },
                { table: 'shipments', name: 'tracking_history', def: 'LONGTEXT' },
                { table: 'shipments', name: 'voyage_id', def: 'INTEGER' },
                { table: 'voyages', name: 'bl_number', def: 'VARCHAR(100)' },
                { table: 'voyages', name: 'vesselName', def: 'VARCHAR(100)' },
                { table: 'voyages', name: 'carrier', def: 'VARCHAR(100)' },
                { table: 'voyages', name: 'loadingPort', def: 'VARCHAR(100)' },
                { table: 'voyages', name: 'destination', def: 'VARCHAR(100)' },
                { table: 'voyages', name: 'etd', def: 'DATE' },
                { table: 'voyages', name: 'eta', def: 'DATE' },
                { table: 'voyages', name: 'arrivalDate', def: 'DATE' },
                { table: 'voyages', name: 'notes', def: 'TEXT' },
                { table: 'voyages', name: 'active', def: 'TINYINT(1) DEFAULT 1' },
                { table: 'voyages', name: 'status', def: 'VARCHAR(50) DEFAULT "Planifié"' },
                { table: 'voyages', name: 'current_lat', def: 'DECIMAL(10, 8)' },
                { table: 'voyages', name: 'current_lng', def: 'DECIMAL(11, 8)' },
                { table: 'voyages', name: 'ship_status', def: 'VARCHAR(100)' },
                { table: 'voyages', name: 'tracking_history', def: 'LONGTEXT' }
            ];

            for (const col of columnsToEnsure) {
                try {
                    const [results] = await sequelize.query(`SHOW COLUMNS FROM ${col.table} LIKE '${col.name}'`);
                    if (results.length === 0) {
                        console.log(`🔧 Adding missing column ${col.name} to ${col.table}...`);
                        await sequelize.query(`ALTER TABLE ${col.table} ADD COLUMN ${col.name} ${col.def}`);
                    }
                } catch (colErr) {
                    console.error(`⚠️ Could not verify/add column ${col.name}:`, colErr.message);
                }
            }
        } catch (schemaErr) {
            console.error('❌ Schema fix error:', schemaErr);
        }

        // Auto-seed Roles if empty
        const rolesCount = await models.Role.count();
        if (rolesCount === 0) {
            console.log('🌱 Seeding initial roles...');
            await models.Role.bulkCreate([
                { id: 'admin', name: 'Administrateur', permissions: ['dashboard', 'clients', 'orders', 'vehicles', 'tracking', 'shipments', 'cash', 'settings', 'verification', 'audit'] },
                { id: 'manager', name: 'Manager', permissions: ['dashboard', 'clients', 'orders', 'vehicles', 'tracking', 'shipments', 'cash', 'verification'] },
                { id: 'commercial', name: 'Commercial', permissions: ['dashboard', 'clients', 'orders'] }
            ]);
            console.log('✅ Rôles créés avec succès');
        }

        // Auto-seed Admin if empty
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
            console.log('✅ Utilisateur admin créé (Login: admin / admin123)');
        }

        console.log('🏁 Initialisation terminée et prête.');

        // 3. Setup Automation (Cron Jobs)
        const voyageTrackingService = require('./src/services/voyageTrackingService');

        // Refresh all active voyages every hour (was 6 hours)
        // Cron: 0 * * * * (every hour at minute 0)
        cron.schedule('0 * * * *', () => {
            console.log('[CRON] Starting automatic voyage tracking refresh...');
            voyageTrackingService.refreshAllActive().catch(err => {
                console.error('[CRON] Voyage Refresh Error:', err.message);
            });
        });

        // Check for stale voyages every 3 hours
        // Cron: 0 */3 * * *
        cron.schedule('0 */3 * * *', () => {
            voyageTrackingService.checkStaleVoyages().catch(err => {
                console.error('[CRON] Stale Check Error:', err.message);
            });
        });

        console.log('⏰ Tâches automatisées (Cron) activées : Actualisation (1h) + Alerte retards (3h)');

    } catch (err) {
        console.error('❌ ERREUR INITIALISATION BACKGROUND:');
        console.error(err);
        // Note: We don't kill the process because Render might still serve static files/health
    }
};

startServer();

module.exports = app;
