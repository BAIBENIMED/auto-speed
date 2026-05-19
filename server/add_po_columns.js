const sequelize = require('./src/config/database');
const { QueryTypes } = require('sequelize');

async function fixTable() {
    try {
        console.log('--- Fixing purchase_orders table ---');
        
        try {
            await sequelize.query("ALTER TABLE purchase_orders ADD COLUMN mbl_status BOOLEAN DEFAULT false;", { type: QueryTypes.RAW });
            console.log('✅ Added mbl_status');
        } catch (e) { console.log('ℹ️ mbl_status error:', e.message); }

        try {
            await sequelize.query("ALTER TABLE purchase_orders ADD COLUMN hbl_status BOOLEAN DEFAULT false;", { type: QueryTypes.RAW });
            console.log('✅ Added hbl_status');
        } catch (e) { console.log('ℹ️ hbl_status error:', e.message); }

        try {
            await sequelize.query("ALTER TABLE purchase_orders ADD COLUMN mbl_received BOOLEAN DEFAULT false;", { type: QueryTypes.RAW });
            console.log('✅ Added mbl_received');
        } catch (e) { console.log('ℹ️ mbl_received error:', e.message); }

        try {
            await sequelize.query("ALTER TABLE purchase_orders ADD COLUMN hbl_received BOOLEAN DEFAULT false;", { type: QueryTypes.RAW });
            console.log('✅ Added hbl_received');
        } catch (e) { console.log('ℹ️ hbl_received error:', e.message); }

        console.log('Done!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error fixing table:', error);
        process.exit(1);
    }
}

fixTable();
