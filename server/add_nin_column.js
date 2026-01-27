/**
 * Migration: Add NIN column to clients table
 * Run with: node server/add_nin_column.js
 */

const sequelize = require('./src/config/database');

async function addNinColumn() {
    try {
        console.log('🔧 Adding NIN column to clients table...');

        await sequelize.query(`
            ALTER TABLE clients 
            ADD COLUMN IF NOT EXISTS nin VARCHAR(100);
        `);

        console.log('✅ NIN column added successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error adding NIN column:', error);
        process.exit(1);
    }
}

addNinColumn();
