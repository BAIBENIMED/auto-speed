const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const sequelize = require('./server/src/config/database');

async function migrate() {
    try {
        console.log('🔧 Starting migration...');

        // Add purchase_order_id to vehicles
        try {
            await sequelize.query(`ALTER TABLE vehicles ADD COLUMN purchase_order_id VARCHAR(50)`);
            console.log('✅ Added purchase_order_id to vehicles table');
        } catch (err) {
            if (err.message.includes('Duplicate column')) {
                console.log('⚠️  purchase_order_id already exists in vehicles table, skipping...');
            } else {
                console.error('Error adding purchase_order_id:', err.message);
            }
        }

        // Drop unique constraint on order_id in purchase_orders
        try {
            // First we need to find the name of the constraint
            const [results] = await sequelize.query(`
                SELECT CONSTRAINT_NAME
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'orderId'
            `);
            if (results && results.length > 0) {
                // For MySQL it's usually `orderId`, or the specific constraint name
                const constraintName = results[0].CONSTRAINT_NAME;
                // In MySQL: ALTER TABLE table_name DROP INDEX index_name
                await sequelize.query(`ALTER TABLE purchase_orders DROP INDEX \`${constraintName}\``);
                console.log(`✅ Dropped unique constraint/index ${constraintName} on purchase_orders.orderId`);
            }
        } catch (err) {
            console.log('⚠️ Could not drop index on purchase_orders (maybe it does not exist or named differently):', err.message);
        }

        // Ensure order_id is nullable (MySQL syntax)
        try {
            await sequelize.query(`ALTER TABLE purchase_orders MODIFY orderId VARCHAR(50) NULL`);
            console.log('✅ Made orderId nullable in purchase_orders');
        } catch (err) {
            console.log('⚠️ Could not modify orderId:', err.message);
        }

        console.log('✅ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await sequelize.close();
        process.exit();
    }
}

migrate();
