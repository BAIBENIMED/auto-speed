const sequelize = require('./src/config/database');
require('./src/models');

async function syncDb() {
    try {
        console.log('🔄 Synchronisation de la base de données (alter: true)...');
        await sequelize.sync({ alter: true });
        console.log('✅ Base de données synchronisée !');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur lors de la synchronisation:', error);
        process.exit(1);
    }
}

syncDb();
