const sequelize = require('./src/config/database');
const { QueryTypes } = require('sequelize');

async function fixTable() {
    try {
        console.log('--- Fixing vehicles table ---');
        
        // Add original_client_id
        try {
            await sequelize.query("ALTER TABLE vehicles ADD COLUMN original_client_id VARCHAR(50) NULL AFTER bl_link;", { type: QueryTypes.RAW });
            console.log('✅ Added original_client_id column');
        } catch (e) {
            console.log('ℹ️ original_client_id column might already exist or error:', e.message);
        }

        // Add original_owner_name
        try {
            await sequelize.query("ALTER TABLE vehicles ADD COLUMN original_owner_name VARCHAR(200) NULL AFTER original_client_id;", { type: QueryTypes.RAW });
            console.log('✅ Added original_owner_name column');
        } catch (e) {
            console.log('ℹ️ original_owner_name column might already exist or error:', e.message);
        }

        console.log('Done!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error fixing table:', error);
        process.exit(1);
    }
}

fixTable();
