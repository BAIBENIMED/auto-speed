const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: false
    }
);

async function renamePO() {
    const oldId = 'CMD/2026/JOON/003';
    const newId = 'CMD/2026/JOON/001';

    try {
        console.log(`🔍 Checking database: ${process.env.DB_NAME} on ${process.env.DB_HOST}`);
        console.log(`🔍 Checking if ${oldId} exists...`);
        const [pos] = await sequelize.query("SELECT id FROM purchase_orders WHERE id = ?", { replacements: [oldId] });

        if (pos.length === 0) {
            console.log(`❌ Reference ${oldId} not found in database.`);
            console.log(`💡 Pro-tip: Ensure this script is running on the RENDER environment's Shell, as the local database does not contain this ID.`);
            process.exit(0);
        }

        console.log(`✅ Reference found. Starting rename to ${newId}...`);

        // Transaction to ensure data integrity
        await sequelize.transaction(async (t) => {
            // 1. Check if newId already exists (to avoid collision)
            const [exists] = await sequelize.query("SELECT id FROM purchase_orders WHERE id = ?", { 
                replacements: [newId],
                transaction: t 
            });

            if (exists.length > 0) {
                throw new Error(`Target reference ${newId} already exists!`);
            }

            // 2. Update vehicles linked to this PO
            console.log('Updating linked vehicles...');
            await sequelize.query("UPDATE vehicles SET purchaseOrderId = ? WHERE purchaseOrderId = ?", {
                replacements: [newId, oldId],
                transaction: t
            });

            // 3. Update the PO record itself
            console.log('Updating purchase order record...');
            await sequelize.query("UPDATE purchase_orders SET id = ? WHERE id = ?", {
                replacements: [newId, oldId],
                transaction: t
            });
        });

        console.log(`✨ Successfully renamed ${oldId} to ${newId}.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during rename:', error.message);
        process.exit(1);
    }
}

renamePO();
