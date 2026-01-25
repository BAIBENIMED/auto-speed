const { Client, Order, Vehicle, Shipment, CashTransaction } = require('./src/models');
const sequelize = require('./src/config/database');

async function truncateTables() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connexion établie');

        // Disable foreign key checks
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

        console.log('🗑️  Vidage des tables en cours...');

        await CashTransaction.destroy({ where: {}, force: true });
        console.log('  - CashTransactions vidés');

        await Vehicle.destroy({ where: {}, force: true });
        console.log('  - Véhicules vidés');

        await Order.destroy({ where: {}, force: true });
        console.log('  - Commandes vidées');

        await Shipment.destroy({ where: {}, force: true });
        console.log('  - Expéditions vidées');

        await Client.destroy({ where: {}, force: true });
        console.log('  - Clients vidés');

        // Re-enable foreign key checks
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('\n✅ Tables vidées avec succès !');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur lors du vidage des tables:', error);
        process.exit(1);
    }
}

truncateTables();
