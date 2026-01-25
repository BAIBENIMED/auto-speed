const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const { Order, Vehicle, Client } = require('./server/src/models');

async function inspect() {
    try {
        console.log("--- ORDERS ---");
        const orders = await Order.findAll({ include: ['client'] });
        console.log(JSON.stringify(orders.map(o => o.toJSON()), null, 2));

        console.log("\n--- VEHICLES ---");
        const vehicles = await Vehicle.findAll();
        console.log(JSON.stringify(vehicles.map(v => v.toJSON()), null, 2));

    } catch (error) {
        console.error("Inspection failed:", error);
    } finally {
        process.exit();
    }
}

inspect();
