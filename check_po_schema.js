const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const sequelize = require('./server/src/config/database');

async function checkSchema() {
    try {
        const [results] = await sequelize.query("DESCRIBE purchase_orders");
        console.log('Schema for purchase_orders:');
        console.table(results);
    } catch (error) {
        console.error('Error checking schema:', error);
    } finally {
        await sequelize.close();
        process.exit();
    }
}

checkSchema();
