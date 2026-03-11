const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const sequelize = require('./src/config/database');

async function checkSchema() {
    try {
        const [poResults] = await sequelize.query("DESCRIBE purchase_orders");
        console.log('--- purchase_orders schema ---');
        poResults.forEach(r => console.log(`- ${r.Field} (${r.Type})`));
        
        const [vehResults] = await sequelize.query("DESCRIBE vehicles");
        console.log('\n--- vehicles schema ---');
        vehResults.forEach(r => console.log(`- ${r.Field} (${r.Type})`));
        
        const [ordersResults] = await sequelize.query("DESCRIBE orders");
        console.log('\n--- orders schema ---');
        ordersResults.forEach(r => console.log(`- ${r.Field} (${r.Type})`));
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkSchema();
