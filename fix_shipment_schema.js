const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const sequelize = require('./server/src/config/database');

async function fixShipmentSchema() {
    try {
        console.log('🔧 Adding missing columns to shipments table...');

        try {
            await sequelize.query(`ALTER TABLE shipments ADD COLUMN voyage VARCHAR(100)`);
            console.log('✅ Added voyage to shipments table');
        } catch (err) {
            if (err.message.includes('Duplicate column')) {
                console.log('⚠️  Voyage column already exists, skipping...');
            } else {
                throw err;
            }
        }

        console.log('\n✅ Database schema updated successfully!');
    } catch (error) {
        console.error('❌ Update failed:', error);
    } finally {
        await sequelize.close();
        process.exit();
    }
}

fixShipmentSchema();
