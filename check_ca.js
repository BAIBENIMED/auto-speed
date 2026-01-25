const mysql = require('mysql2/promise');
require('dotenv').config({ path: './server/.env' });

async function checkOrdersCA() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
    });

    try {
        const [orders] = await connection.execute('SELECT id, showroom, total_amount, currency, is_validated, status FROM orders');
        const [showrooms] = await connection.execute('SELECT name FROM showrooms');

        console.log(`Total Orders: ${orders.length}`);
        console.log(`Showrooms: ${showrooms.map(s => s.name).join(', ')}`);

        const caByShowroom = {};
        const pendingCaByShowroom = {};

        orders.forEach(o => {
            const showroom = o.showroom || 'N/A';
            if (o.is_validated) {
                caByShowroom[showroom] = (caByShowroom[showroom] || 0) + Number(o.total_amount);
            } else {
                pendingCaByShowroom[showroom] = (pendingCaByShowroom[showroom] || 0) + Number(o.total_amount);
            }
        });

        console.log('\n--- CA Validated ---');
        console.table(caByShowroom);

        console.log('\n--- CA Non-Validated (Pending) ---');
        console.table(pendingCaByShowroom);

    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

checkOrdersCA();
