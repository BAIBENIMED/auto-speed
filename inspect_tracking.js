require('dotenv').config({ path: './server/.env' });
const { Shipment } = require('./server/src/models');

async function inspectShipments() {
    console.log("Checking active shipments tracking data...");
    try {
        const shipments = await Shipment.findAll({
            where: { isTrackingActive: true, isArchived: false }
        });

        if (shipments.length === 0) {
            console.log("No active shipments found.");
            return;
        }

        const data = shipments.map(s => {
            let historyPreview = 'No History';
            try {
                if (s.trackingHistory) {
                    const parsed = JSON.parse(s.trackingHistory);
                    historyPreview = parsed.slice(0, 3).map(e => `${e.date}: ${e.description} (${e.location})`);
                }
            } catch (e) {
                historyPreview = 'Parse Error';
            }

            return {
                id: s.id,
                container: s.containerNumber,
                bl: s.blNumber,
                status: s.status,
                arrivalDate: s.arrivalDate,
                history: historyPreview
            };
        });

        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error inspecting shipments:", e);
    } finally {
        process.exit(0);
    }
}

inspectShipments();
