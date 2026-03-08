require('dotenv').config({ path: './server/.env' });
const { Shipment } = require('./server/src/models');

async function inspectAllShipments() {
    console.log("Checking ALL shipments in database...");
    try {
        const shipments = await Shipment.findAll({
            order: [['updatedAt', 'DESC']],
            limit: 10
        });

        if (shipments.length === 0) {
            console.log("No shipments found at all.");
            return;
        }

        const data = shipments.map(s => ({
            id: s.id,
            container: s.containerNumber,
            bl: s.blNumber,
            status: s.status,
            isTrackingActive: s.isTrackingActive,
            isArchived: s.isArchived,
            updatedAt: s.updatedAt
        }));

        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error inspecting shipments:", e);
    } finally {
        process.exit(0);
    }
}

inspectAllShipments();
