const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const sequelize = require('./server/src/config/database');

async function migrate() {
    try {
        console.log('🔧 Adding missing columns to purchase_orders table...');

        const columns = [
            { name: 'document_status', definition: "VARCHAR(50) DEFAULT 'Rien'" },
            { name: 'documents_received', definition: "VARCHAR(10) DEFAULT 'Non'" },
            { name: 'loading_port', definition: 'VARCHAR(100)' },
            { name: 'loading_date', definition: 'DATETIME' },
            { name: 'etd', definition: 'DATETIME' },
            { name: 'eta', definition: 'DATETIME' },
            { name: 'is_loaded', definition: "VARCHAR(10) DEFAULT 'Non'" }
        ];

        for (const col of columns) {
            try {
                await sequelize.query(`ALTER TABLE purchase_orders ADD COLUMN ${col.name} ${col.definition}`);
                console.log(`✅ Added ${col.name} to purchase_orders table`);
            } catch (err) {
                if (err.message.includes('Duplicate column')) {
                    console.log(`⚠️  Column ${col.name} already exists in purchase_orders table, skipping...`);
                } else {
                    console.error(`❌ Error adding ${col.name}:`, err.message);
                }
            }
        }

        console.log('\n✅ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await sequelize.close();
        process.exit();
    }
}

migrate();
