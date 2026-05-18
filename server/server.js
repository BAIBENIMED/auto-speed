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

console.log(`[Startup] Initializing Tibou Auto Server...`);
console.log(`[Startup] Target Port: ${PORT}`);

// Global error handlers for better debugging on Render
process.on('uncaughtException', (err) => {
    console.error('❌ UNCAUGHT EXCEPTION:', err.message);
    console.error(err.stack);
    // process.exit(1); // Don't exit immediately on Render to allow log viewing
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

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
app.use('/api/public', require('./src/routes/public'));
app.use('/api/vehicle-prices', require('./src/routes/vehiclePrices'));

// Serve tracking page explicitly
app.get('/tracking', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'tracking.html'));
});

app.get('/tracking.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'tracking.html'));
});

// Initialize Tracking Service

// More routes will be added here

// Basic reachability test
app.get('/', (req, res) => res.json({ message: 'TIBOU AUTO API is running', version: '2.7-ANTIGRAVITY' }));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'TIBOU AUTO API is running (v2.7-ANTIGRAVITY)' });
});

// Diagnostic endpoint for Cloud deployment
app.get('/api/diag', async (req, res) => {
    // Show environment status immediately
    const diag = {
        timestamp: new Date().toISOString(),
        version: "2.6-ANTIGRAVITY",
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

// Diagnostic endpoint for Email
app.get('/api/test-email', async (req, res) => {
    try {
        const nodemailer = require('nodemailer');
        
        const configState = {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            user: process.env.SMTP_USER,
            from: process.env.SMTP_FROM,
            passLength: process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 0
        };

        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            return res.json({ 
                success: false, 
                message: "Les variables d'environnement SMTP ne sont pas configurées sur le serveur.",
                config: configState
            });
        }

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        const senderEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
        
        const mailOptions = {
            from: `"TEST TIBOU AUTO" <${senderEmail}>`,
            to: 'BAIB.IMED@GMAIL.COM',
            subject: 'Test Diagnostic Email Serveur',
            text: 'Ceci est un test direct depuis le serveur Render pour vérifier la configuration SMTP.'
        };

        const info = await transporter.sendMail(mailOptions);
        
        res.json({
            success: true,
            message: "Email envoyé avec succès !",
            messageId: info.messageId,
            config: configState
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Erreur lors de l'envoi de l'email.",
            errorName: error.name,
            errorMessage: error.message,
            errorCode: error.code,
            command: error.command,
            config: {
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT,
                user: process.env.SMTP_USER,
                from: process.env.SMTP_FROM,
                passLength: process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 0
            }
        });
    }
});

// Diagnostic endpoint for Database Schema and Files
app.get('/api/db-verify', async (req, res) => {
    try {
        const [tables] = await sequelize.query("SHOW TABLES");
        const tableList = tables.map(t => Object.values(t)[0]);

        const fs = require('fs');
        const rootFiles = fs.readdirSync(path.join(__dirname, '..'));

        let schemaInfo = { 
            tables: tableList,
            rootFiles: rootFiles,
            currentDir: __dirname,
            staticRoot: path.join(__dirname, '..')
        };

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

// Diagnostic/Migration endpoint for Purchase Orders logic
app.get('/api/migrate-po', async (req, res) => {
    try {
        let logs = [];
        logs.push('🔧 Starting migration...');
        const poColumns = [
            { name: 'document_status', def: "VARCHAR(50) DEFAULT 'Rien'" },
            { name: 'documents_received', def: "VARCHAR(10) DEFAULT 'Non'" },
            { name: 'loading_port', def: 'VARCHAR(100) NULL' },
            { name: 'loading_date', def: 'DATETIME NULL' },
            { name: 'etd', def: 'DATETIME NULL' },
            { name: 'eta', def: 'DATETIME NULL' },
            { name: 'is_loaded', def: "VARCHAR(10) DEFAULT 'Non'" },
            { name: 'supplierId', def: 'INT NULL' },
            { name: 'supplierName', def: 'VARCHAR(100) NULL' },
            { name: 'status', def: "VARCHAR(50) DEFAULT 'En cours'" },
            { name: 'forwarder', def: 'VARCHAR(100) NULL' },
            { name: 'carrier', def: 'VARCHAR(100) NULL' },
            { name: 'unbundler', def: 'VARCHAR(100) NULL' },
            { name: 'tasks', def: 'JSON NULL' }
        ];

        for (const col of poColumns) {
            try {
                await sequelize.query(`ALTER TABLE purchase_orders ADD COLUMN ${col.name} ${col.def}`);
                logs.push(`✅ Added ${col.name} to purchase_orders`);
            } catch (err) {
                if (err.message.includes('Duplicate column') || err.original?.code === 'ER_DUP_FIELDNAME') {
                    logs.push(`ℹ️ ${col.name} already exists in purchase_orders`);
                } else {
                    logs.push(`❌ Error adding ${col.name}: ${err.message}`);
                }
            }
        }

        // Add tasks to orders
        try {
            await sequelize.query(`ALTER TABLE orders ADD COLUMN tasks JSON NULL`);
            logs.push('✅ Added tasks column to orders table');
        } catch (err) {
            if (err.message.includes('Duplicate column') || err.original?.code === 'ER_DUP_FIELDNAME') {
                logs.push('ℹ️ tasks column already exists in orders table');
            } else {
                logs.push(`❌ Error adding tasks to orders: ${err.message}`);
            }
        }

        // Add purchase_order_id to vehicles (Fail-safe)
        try {
            await sequelize.query(`ALTER TABLE vehicles ADD COLUMN purchase_order_id VARCHAR(50) NULL`);
            logs.push('✅ Added purchase_order_id to vehicles table');
        } catch (err) {
            if (err.message.includes('Duplicate column')) {
                logs.push('ℹ️ purchase_order_id already exists in vehicles table');
            } else {
                logs.push(`❌ Error adding purchase_order_id to vehicles: ${err.message}`);
            }
        }

        // Add original owner columns
        try {
            await sequelize.query(`ALTER TABLE vehicles ADD COLUMN original_client_id VARCHAR(50) NULL AFTER bl_link`);
            logs.push('✅ Added original_client_id to vehicles table');
        } catch (err) {
            if (!err.message.includes('Duplicate column')) logs.push(`❌ Error original_client_id: ${err.message}`);
        }
        
        try {
            await sequelize.query(`ALTER TABLE vehicles ADD COLUMN original_owner_name VARCHAR(200) NULL AFTER original_client_id`);
            logs.push('✅ Added original_owner_name to vehicles table');
        } catch (err) {
            if (!err.message.includes('Duplicate column')) logs.push(`❌ Error original_owner_name: ${err.message}`);
        }

        logs.push('✅ Migration completed successfully!');
        res.json({ success: true, logs });
    } catch (error) {
        console.error('Migration failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint temporaire pour renommer JOON/003 -> JOON/001 (Sans Shell)
app.get('/api/rename-po-fix', async (req, res) => {
    const oldId = 'CMD/2026/JOON/003';
    const newId = 'CMD/2026/JOON/001';
    
    try {
        const [pos] = await sequelize.query("SELECT id FROM purchase_orders WHERE id = ?", { replacements: [oldId] });
        if (pos.length === 0) {
            return res.json({ success: false, message: `Référence ${oldId} non trouvée.` });
        }

        await sequelize.transaction(async (t) => {
            await sequelize.query("UPDATE vehicles SET purchase_order_id = ? WHERE purchase_order_id = ?", {
                replacements: [newId, oldId],
                transaction: t
            });
            await sequelize.query("UPDATE purchase_orders SET id = ? WHERE id = ?", {
                replacements: [newId, oldId],
                transaction: t
            });
        });

        res.json({ success: true, message: `Succès ! ${oldId} a été renommé en ${newId}.` });
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
            await models.VehicleTransfer.sync({ alter: true });
            await models.VehicleTrim.sync({ alter: true });
            await models.VehiclePrice.sync({ alter: true });
            console.log('🔧 Tables Notification/VehicleTransfer/VehicleTrim/VehiclePrice vérifiées/créées (Fail-safe).');

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

            // Raw SQL Fail-safe for VehicleTrims
            try {
                await sequelize.query(`
                    CREATE TABLE IF NOT EXISTS vehicle_trims (
                        id VARCHAR(255) PRIMARY KEY,
                        modelId VARCHAR(255) NOT NULL,
                        name VARCHAR(255) NOT NULL,
                        characteristics JSON NULL,
                        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB;
                `);
                console.log('🔧 Table VehicleTrim vérifiée/créées (Raw SQL Fail-safe sans contrainte).');
            } catch (trimErr) {
                if (trimErr.message.includes('JSON')) {
                    console.warn('⚠️ JSON type not supported, falling back to LONGTEXT for characteristics.');
                    await sequelize.query(`
                        CREATE TABLE IF NOT EXISTS vehicle_trims (
                            id VARCHAR(255) PRIMARY KEY,
                            modelId VARCHAR(255) NOT NULL,
                            name VARCHAR(255) NOT NULL,
                            characteristics LONGTEXT NULL,
                            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                        ) ENGINE=InnoDB;
                    `);
                    console.log('🔧 Table VehicleTrim vérifiée/créées (Fallback LONGTEXT sans contrainte).');
                } else {
                    console.error('❌ Echec creation table VehicleTrim:', trimErr.message);
                }
            }

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
                { table: 'voyages', name: 'status', def: "VARCHAR(50) DEFAULT 'Planifié'" },
                { table: 'voyages', name: 'current_lat', def: 'DECIMAL(10, 8)' },
                { table: 'voyages', name: 'current_lng', def: 'DECIMAL(11, 8)' },
                { table: 'voyages', name: 'ship_status', def: 'VARCHAR(100)' },
                { table: 'voyages', name: 'tracking_history', def: 'LONGTEXT' },
                { table: 'voyages', name: 'last_update', def: 'DATETIME' },
                { table: 'purchase_orders', name: 'document_status', def: "VARCHAR(50) DEFAULT 'Rien'" },
                { table: 'purchase_orders', name: 'documents_received', def: "VARCHAR(10) DEFAULT 'Non'" },
                { table: 'purchase_orders', name: 'mbl_status', def: 'BOOLEAN DEFAULT false' },
                { table: 'purchase_orders', name: 'hbl_status', def: 'BOOLEAN DEFAULT false' },
                { table: 'purchase_orders', name: 'mbl_received', def: 'BOOLEAN DEFAULT false' },
                { table: 'purchase_orders', name: 'hbl_received', def: 'BOOLEAN DEFAULT false' },
                { table: 'purchase_orders', name: 'loading_port', def: 'VARCHAR(100)' },
                { table: 'purchase_orders', name: 'loading_date', def: 'DATETIME' },
                { table: 'purchase_orders', name: 'etd', def: 'DATETIME' },
                { table: 'purchase_orders', name: 'eta', def: 'DATETIME' },
                { table: 'purchase_orders', name: 'is_loaded', def: "VARCHAR(10) DEFAULT 'Non'" },
                { table: 'purchase_orders', name: 'supplierId', def: 'INT' },
                { table: 'purchase_orders', name: 'supplierName', def: 'VARCHAR(100)' },
                { table: 'purchase_orders', name: 'purchaseDate', def: 'DATETIME' },
                { table: 'purchase_orders', name: 'forwarder', def: 'VARCHAR(100)' },
                { table: 'purchase_orders', name: 'carrier', def: 'VARCHAR(100)' },
                { table: 'purchase_orders', name: 'unbundler', def: 'VARCHAR(100)' },
                { table: 'purchase_orders', name: 'tasks', def: 'JSON' },
                { table: 'vehicles', name: 'motorization', def: 'VARCHAR(100)' },
                { table: 'vehicles', name: 'purchase_order_id', def: 'VARCHAR(50)' },
                { table: 'vehicles', name: 'trim_id', def: 'VARCHAR(255)' },
                { table: 'vehicles', name: 'client_id', def: 'VARCHAR(50)' },
                { table: 'vehicles', name: 'showroom', def: 'VARCHAR(100)' },
                { table: 'vehicles', name: 'video_link', def: 'VARCHAR(500)' },
                { table: 'vehicles', name: 'bl_link', def: 'VARCHAR(500)' },
                { table: 'vehicles', name: 'original_client_id', def: 'VARCHAR(50)' },
                { table: 'vehicles', name: 'original_owner_name', def: 'VARCHAR(200)' },
                { table: 'clients', name: 'passport_drive_link', def: 'VARCHAR(500)' },
                { table: 'clients', name: 'postal_code', def: 'VARCHAR(20)' },
                { table: 'orders', name: 'tasks', def: 'JSON' },
                { table: 'orders', name: 'tracking_code', def: 'VARCHAR(10)' },
                { table: 'orders', name: 'requested_trim', def: 'VARCHAR(100)' },
                { table: 'orders', name: 'requested_category', def: 'VARCHAR(50)' },
                { table: 'vehicle_prices', name: 'trim_id', def: 'VARCHAR(255)' },
                { table: 'vehicle_prices', name: 'supplier_id', def: 'INT' },
                { table: 'vehicle_prices', name: 'price_usd', def: 'DECIMAL(15,2)' },
                { table: 'vehicle_prices', name: 'date', def: 'DATE' },
                { table: 'vehicle_prices', name: 'notes', def: 'TEXT' },
                { table: 'vehicle_trims', name: 'price_dzd_neuf', def: 'DECIMAL(15,2)' },
                { table: 'vehicle_trims', name: 'price_dzd_3ans', def: 'DECIMAL(15,2)' },
                { table: 'settings', name: 'coefficient_neuf', def: 'DECIMAL(8,4) DEFAULT 1.0' },
                { table: 'settings', name: 'coefficient_3ans', def: 'DECIMAL(8,4) DEFAULT 1.0' }
            ];

            for (const col of columnsToEnsure) {
                try {
                    await sequelize.query(`ALTER TABLE ${col.table} ADD COLUMN ${col.name} ${col.def}`);
                    console.log(`🔧 Column checked/added: ${col.table}.${col.name}`);
                } catch (colErr) {
                    // Ignore "Duplicate column name" error as it means column already exists
                    if (colErr.message.includes('Duplicate column') || colErr.original?.code === 'ER_DUP_FIELDNAME') {
                        // Column already exists, this is fine
                    } else {
                        console.error(`⚠️ Could not verify/add column ${col.name} to ${col.table}:`, colErr.message);
                    }
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
