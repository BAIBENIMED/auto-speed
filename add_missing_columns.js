const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const sequelize = require('./server/src/config/database');

async function addMissingColumns() {
    try {
        console.log('🔧 Adding missing columns to database...');

        // Add columns to orders table
        console.log('Adding columns to orders table...');

        const ordersColumns = [
            { name: 'requested_brand', definition: 'VARCHAR(100)' },
            { name: 'requested_model', definition: 'VARCHAR(100)' },
            { name: 'requested_color', definition: 'VARCHAR(100)' },
            { name: 'showroom', definition: 'VARCHAR(100)' },
            { name: 'currency', definition: "VARCHAR(10) DEFAULT 'DZD'" },
            { name: 'discount', definition: 'DECIMAL(10, 2) DEFAULT 0' }
        ];

        for (const col of ordersColumns) {
            try {
                await sequelize.query(`ALTER TABLE orders ADD COLUMN ${col.name} ${col.definition}`);
                console.log(`✅ Added ${col.name} to orders table`);
            } catch (err) {
                if (err.message.includes('Duplicate column')) {
                    console.log(`⚠️  Column ${col.name} already exists in orders table, skipping...`);
                } else {
                    throw err;
                }
            }
        }

        // Add model column to vehicles table
        console.log('Adding model column to vehicles table...');

        try {
            await sequelize.query(`ALTER TABLE vehicles ADD COLUMN model VARCHAR(100)`);
            console.log('✅ Added model to vehicles table');
        } catch (err) {
            if (err.message.includes('Duplicate column')) {
                console.log('⚠️  Model column already exists in vehicles table, skipping...');
            } else {
                throw err;
            }
        }

        console.log('\n✅ Migration completed successfully!');
        console.log('\n📋 Summary:');
        console.log('   - Added requested_brand, requested_model, requested_color to orders');
        console.log('   - Added showroom, currency, discount to orders');
        console.log('   - Added model to vehicles');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await sequelize.close();
        process.exit();
    }
}

addMissingColumns();
