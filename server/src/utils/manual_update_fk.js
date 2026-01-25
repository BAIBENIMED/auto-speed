const sequelize = require('../config/database');

async function updateForeignKey() {
    try {
        console.log('🔄 Starting manual Foreign Key update...');

        // 1. Get the constraint name (it might be audit_logs_userId_foreign_idx or similar, but usually foreign key name is generated)
        // We'll verify the constraint name or try to drop standard naming

        // This is MySQL specific syntax
        const tableName = 'audit_logs';
        const constraintName = 'audit_logs_ibfk_1'; // Standard first FK. We might need to check information_schema if name differs.

        // Alternative: Try to fetch constraint name first
        const [results] = await sequelize.query(`
            SELECT CONSTRAINT_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_NAME = '${tableName}'
            AND COLUMN_NAME = 'userId'
            AND TABLE_SCHEMA = DATABASE();
        `);

        if (results.length > 0) {
            const constraint = results[0].CONSTRAINT_NAME;
            console.log(`ℹ️ Found constraint: ${constraint}`);

            await sequelize.query(`ALTER TABLE ${tableName} DROP FOREIGN KEY ${constraint}`);
            console.log('✅ Dropped existing Foreign Key');
        }

        // Re-add with SET NULL
        await sequelize.query(`
            ALTER TABLE ${tableName}
            ADD CONSTRAINT audit_logs_userId_fk
            FOREIGN KEY (userId) REFERENCES users(id)
            ON DELETE SET NULL
            ON UPDATE CASCADE;
        `);

        console.log('✅ Added new Foreign Key with ON DELETE SET NULL');

    } catch (error) {
        console.error('❌ Error updating foreign key:', error);
    } finally {
        await sequelize.close();
    }
}

updateForeignKey();
