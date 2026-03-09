require('dotenv').config(); // Load environment variables from .env
const sequelize = require('./server/src/config/database');

async function migrate() {
    try {
        console.log('Synchronizing Vehicle model to ensure client_id column is added...');
        const [results] = await sequelize.query("SHOW COLUMNS FROM vehicles LIKE 'client_id'");

        if (results.length === 0) {
            console.log('Adding client_id column to vehicles table...');
            await sequelize.query('ALTER TABLE vehicles ADD COLUMN client_id VARCHAR(50) NULL');
            console.log('✅ client_id column added successfully');
        } else {
            console.log('✅ client_id column already exists');
        }
    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        process.exit(0);
    }
}

migrate();
