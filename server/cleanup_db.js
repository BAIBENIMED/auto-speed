const sequelize = require('./src/config/database');

async function cleanupIndices() {
    try {
        console.log('Starting index cleanup...');

        const [tables] = await sequelize.query('SHOW TABLES');
        const tableNames = tables.map(t => Object.values(t)[0]);

        for (const table of tableNames) {
            console.log(`Checking table: ${table}...`);
            const [indices] = await sequelize.query(`SHOW INDEX FROM ${table}`);

            // Group indices by column
            const indicesToDrop = indices.filter(idx => {
                // Keep PRIMARY and the "original" index if it looks clean
                // Drop any index that ends with _N (e.g., name_1, name_2)
                return idx.Key_name.match(/_\d+$/);
            });

            if (indicesToDrop.length > 0) {
                console.log(`Found ${indicesToDrop.length} duplicate indices to drop on ${table}.`);
                for (const idx of indicesToDrop) {
                    try {
                        await sequelize.query(`ALTER TABLE ${table} DROP INDEX ${idx.Key_name}`);
                        console.log(` - Dropped ${idx.Key_name}`);
                    } catch (e) {
                        console.warn(` - Could not drop ${idx.Key_name}: ${e.message}`);
                    }
                }
            }
        }

        console.log('Cleanup complete. Now trying a final sync...');
        await sequelize.sync({ alter: true });
        console.log('✅ Database synchronized successfully!');

        process.exit(0);
    } catch (error) {
        console.error('Error during cleanup:', error);
        process.exit(1);
    }
}

cleanupIndices();
