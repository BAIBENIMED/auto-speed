const sequelize = require('./src/config/database');

async function checkDB() {
    try {
        console.log('Checking database status...');

        // Show tables
        const [tables] = await sequelize.query('SHOW TABLES');
        console.log('Tables in database:', tables.map(t => Object.values(t)[0]));

        // Check brands indices
        const [indices] = await sequelize.query('SHOW INDEX FROM brands');
        console.log(`Indices on brands table (${indices.length}):`);
        indices.forEach(idx => {
            console.log(` - ${idx.Key_name} (${idx.Column_name}) - Unique: ${idx.Non_unique === 0}`);
        });

        // Check if purchase_orders exists
        const [poTable] = await sequelize.query("SHOW TABLES LIKE 'purchase_orders'");
        if (poTable.length > 0) {
            console.log('✅ TABLE purchase_orders EXISTS');
            const [columns] = await sequelize.query('DESCRIBE purchase_orders');
            console.log('Columns in purchase_orders:');
            columns.forEach(col => console.log(` - ${col.Field}: ${col.Type}`));
        } else {
            console.log('❌ TABLE purchase_orders MISSING');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error checking DB:', error);
        process.exit(1);
    }
}

checkDB();
