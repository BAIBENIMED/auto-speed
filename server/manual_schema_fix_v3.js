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
        console.log("--- Fixing VEHICLES table for soldRegistration ---");
        const [vResults] = await sequelize.query("SHOW COLUMNS FROM vehicles LIKE 'sold_registration'");
        if (vResults.length === 0) {
            await sequelize.query("ALTER TABLE vehicles ADD COLUMN sold_registration BOOLEAN DEFAULT false");
            console.log("✅ sold_registration added to vehicles");
        } else {
            console.log("✅ sold_registration already exists in vehicles");
        }

        console.log("Schema fix complete.");
    } catch (error) {
        console.error("Error fixing schema:", error);
    } finally {
        await sequelize.close();
    }
}

fix();
