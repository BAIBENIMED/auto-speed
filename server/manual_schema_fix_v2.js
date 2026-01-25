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
        console.log("--- Fixing VEHICLES table ---");
        const [vResults] = await sequelize.query("SHOW COLUMNS FROM vehicles LIKE 'status'");
        if (vResults.length === 0) {
            await sequelize.query("ALTER TABLE vehicles ADD COLUMN status VARCHAR(50) DEFAULT 'Available' AFTER `condition` ");
            console.log("✅ status added to vehicles");
        }
        await sequelize.query("ALTER TABLE vehicles MODIFY COLUMN order_id VARCHAR(50) NULL");

        console.log("--- Fixing ORDERS table ---");
        const [oIdResults] = await sequelize.query("SHOW COLUMNS FROM orders LIKE 'vehicle_id'");
        if (oIdResults.length === 0) {
            await sequelize.query("ALTER TABLE orders ADD COLUMN vehicle_id VARCHAR(50) AFTER is_validated");
            console.log("✅ vehicle_id added to orders");
        }
        const [oNameResults] = await sequelize.query("SHOW COLUMNS FROM orders LIKE 'vehicle_name'");
        if (oNameResults.length === 0) {
            await sequelize.query("ALTER TABLE orders ADD COLUMN vehicle_name VARCHAR(200) AFTER vehicle_id");
            console.log("✅ vehicle_name added to orders");
        }

        console.log("Schema fix complete.");
    } catch (error) {
        console.error("Error fixing schema:", error);
    } finally {
        await sequelize.close();
    }
}

fix();
