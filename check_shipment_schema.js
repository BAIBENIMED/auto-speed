const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const sequelize = require('./server/src/config/database');
const { QueryTypes } = require('sequelize');

async function checkShipmentTable() {
    try {
        console.log('🔍 Checking shipments table schema...');
        const columns = await sequelize.query("DESCRIBE shipments", { type: QueryTypes.SELECT });
        console.log('Columns in shipments table:');
        console.table(columns);
    } catch (error) {
        console.error('❌ Error checking shipments table:', error);
    } finally {
        await sequelize.close();
    }
}

checkShipmentTable();
