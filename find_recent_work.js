require('dotenv').config({ path: './server/.env' });
const { Order, Vehicle, Shipment } = require('./server/src/models');

async function findRecentWork() {
    console.log("Searching for the actual shipment the user is tracking...");
    try {
        // Find most recent orders
        const orders = await Order.findAll({
            order: [['updatedAt', 'DESC']],
            limit: 5
        });

        console.log("\n--- RECENT ORDERS ---");
        console.log(JSON.stringify(orders.map(o => ({ id: o.id, status: o.status, updatedAt: o.updatedAt })), null, 2));

        // Find most recent vehicles
        const vehicles = await Vehicle.findAll({
            order: [['updatedAt', 'DESC']],
            limit: 5
        });

        console.log("\n--- RECENT VEHICLES ---");
        console.log(JSON.stringify(vehicles.map(v => ({ id: v.id, brand: v.brand, shipmentId: v.shipmentId, updatedAt: v.updatedAt })), null, 2));

        // Find ALL shipments again but with a higher limit and NO filters
        const shipments = await Shipment.findAll({
            order: [['updatedAt', 'DESC']],
            limit: 20
        });

        console.log("\n--- RECENT SHIPMENTS ---");
        console.log(JSON.stringify(shipments.map(s => ({
            id: s.id,
            container: s.containerNumber,
            bl: s.blNumber,
            status: s.status,
            isTrackingActive: s.isTrackingActive,
            updatedAt: s.updatedAt
        })), null, 2));

    } catch (e) {
        console.error("Error searching recent work:", e);
    } finally {
        process.exit(0);
    }
}

findRecentWork();
