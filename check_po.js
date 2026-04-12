const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: false
    }
);

async function checkMoreTables() {
    try {
        console.log('--- Checking for JOON/JOO in Users ---');
        const [users] = await sequelize.query("SELECT id, username, name FROM users WHERE name LIKE '%JOO%' OR username LIKE '%JOO%'");
        console.log(JSON.stringify(users, null, 2));

        console.log('\n--- Checking for JOON/JOO in Settings ---');
        const [settings] = await sequelize.query("SELECT * FROM settings");
        console.log(JSON.stringify(settings, null, 2));

        console.log('\n--- Checking for JOON/JOO in Suppliers (Case sensitive) ---');
        const [suppliers] = await sequelize.query("SELECT id, name, code FROM suppliers WHERE name LIKE 'JOO%'");
        console.log(JSON.stringify(suppliers, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkMoreTables();
