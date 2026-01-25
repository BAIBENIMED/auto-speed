const { Client, Order, Vehicle, Shipment, CashTransaction } = require('./src/models');
const sequelize = require('./src/config/database');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function clearTables() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connexion établie');

        console.log('⚠️  VIDAGE DES TABLES (Véhicules, Commandes, Clients, Expéditions, Transactions)...');

        // Disable foreign key checks to allow truncation
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

        // Truncate tables to remove data and reset auto-increment IDs
        // Note: CashTransaction is included because it depends on Order
        console.log(' - Vide CashTransaction...');
        await CashTransaction.destroy({ where: {}, truncate: true, force: true });

        console.log(' - Vide Vehicle...');
        await Vehicle.destroy({ where: {}, truncate: true, force: true });

        console.log(' - Vide Order...');
        await Order.destroy({ where: {}, truncate: true, force: true });

        console.log(' - Vide Shipment...');
        await Shipment.destroy({ where: {}, truncate: true, force: true });

        console.log(' - Vide Client...');
        await Client.destroy({ where: {}, truncate: true, force: true });

        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('✅ Opération terminée avec succès !');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur lors du vidage des tables:', error);
        process.exit(1);
    }
}

clearTables();
