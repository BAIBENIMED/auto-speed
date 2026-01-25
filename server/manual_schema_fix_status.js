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
        const [results] = await sequelize.query("SHOW COLUMNS FROM vehicles LIKE 'status'");
        if (results.length === 0) {
            console.log("Adding 'status' column to 'vehicles' table...");
            await sequelize.query("ALTER TABLE vehicles ADD COLUMN status VARCHAR(50) DEFAULT 'Available' AFTER `condition` ");
            console.log("Column added successfully.");
        } else {
            console.log("'status' column already exists.");
        }

        // Also ensure order_id can be NULL
        await sequelize.query("ALTER TABLE vehicles MODIFY COLUMN order_id VARCHAR(50) NULL");
        console.log("order_id modified to allow NULL.");

    } catch (error) {
        console.error("Error fixing schema:", error);
    } finally {
        await sequelize.close();
    }
}

fix();
