const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: console.log
    }
);

async function fix() {
    try {
        console.log("--- Adding reference_drive to ORDERS table ---");
        const [oResults] = await sequelize.query("SHOW COLUMNS FROM orders LIKE 'reference_drive'");
        if (oResults.length === 0) {
            await sequelize.query("ALTER TABLE orders ADD COLUMN reference_drive VARCHAR(100) AFTER remarks");
            console.log("✅ reference_drive added to orders");
        } else {
            console.log("✅ reference_drive already exists in orders");
        }

        console.log("Schema fix complete.");
    } catch (error) {
        console.error("Error fixing schema:", error);
    } finally {
        await sequelize.close();
    }
}

fix();
