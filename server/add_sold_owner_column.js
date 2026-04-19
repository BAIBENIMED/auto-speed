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
        console.log("--- Adding sold_registration_owner to VEHICLES table ---");
        const [vResults] = await sequelize.query("SHOW COLUMNS FROM vehicles LIKE 'sold_registration_owner'");
        if (vResults.length === 0) {
            await sequelize.query("ALTER TABLE vehicles ADD COLUMN sold_registration_owner TEXT");
            console.log("✅ sold_registration_owner added to vehicles");
        } else {
            console.log("✅ sold_registration_owner already exists in vehicles");
        }

        console.log("Schema fix complete.");
    } catch (error) {
        console.error("Error fixing schema:", error);
    } finally {
        await sequelize.close();
    }
}

fix();
