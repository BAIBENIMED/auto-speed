require('dotenv').config({ path: './server/.env' });
const { Shipment, Vehicle, Order } = require('./server/src/models');

async function debugData() {
    try {
        console.log('--- SHIPMENTS ---');
        const shipments = await Shipment.findAll({
            where: { isArchived: false },
            limit: 5
        });

        for (const s of shipments) {
            console.log(`Shipment: ${s.id} | Container: ${s.containerNumber} | Status: ${s.status}`);

            const vehicles = await Vehicle.findAll({ where: { shipmentId: s.id } });
            console.log(`  Linked Vehicles (${vehicles.length}):`);
            for (const v of vehicles) {
                console.log(`    Vehicle: ${v.id} | Brand: ${v.brand} | Status: ${v.status} | OrderID: ${v.orderId}`);

                if (v.orderId) {
                    const order = await Order.findByPk(v.orderId);
                    if (order) {
                        console.log(`      Linked Order: ${order.id} | Status: ${order.status}`);
                    } else {
                        console.log(`      Linked Order (MISSING): ${v.orderId}`);
                    }
                }
            }
            console.log('------------------');
        }
    } catch (err) {
        console.error('Debug failed:', err);
    } finally {
        process.exit();
    }
}

debugData();
