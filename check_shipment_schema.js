require('dotenv').config({ path: './server/.env' });
const { sequelize } = require('./server/src/config/database');

async function checkColumns() {
    try {
        const [results] = await sequelize.query("DESCRIBE shipments");
        console.log("Columns in 'shipments' table:");
        results.forEach(col => {
            console.log(`- ${col.Field} (${col.Type})`);
        });

        const expected = ['mmsi', 'current_lat', 'current_lng', 'speed', 'course', 'last_update', 'ship_status'];
        const existing = results.map(r => r.Field);

        const missing = expected.filter(f => !existing.includes(f));

        if (missing.length > 0) {
            console.log("\n❌ MISSING COLUMNS:", missing.join(', '));
        } else {
            console.log("\n✅ All tracking columns are present.");
        }

        process.exit(0);
    } catch (error) {
        console.error("❌ Error checking schema:", error);
        process.exit(1);
    }
}

checkColumns();
