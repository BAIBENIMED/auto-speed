require('dotenv').config({ path: './server/.env' });
const { Voyage, Shipment } = require('./server/src/models');
const { Op } = require('sequelize');
const containerTrackingService = require('./server/src/services/containerTrackingService');

async function test() {
    console.log("Starting test...");
    try {
        // Fetch any shipment with a BL number or container number
        const shipment = await Shipment.findOne({
            order: [['updatedAt', 'DESC']],
            where: {
                [Op.or]: [
                    { blNumber: { [Op.ne]: null } },
                    { containerNumber: { [Op.ne]: null } }
                ]
            }
        });

        if (!shipment) {
            console.log("No shipments found.");
            return;
        }

        console.log(`Testing with shipment ${shipment.id}, Container: ${shipment.containerNumber}, BL: ${shipment.blNumber}`);

        let identifier = shipment.blNumber || shipment.containerNumber;
        let isBL = !!shipment.blNumber;

        console.log("Calling API with identifier:", identifier, "isBL:", isBL);
        const result = await containerTrackingService.trackContainer(identifier, isBL);

        console.log("\n--- RAW TRACKING RESULT ---");
        console.log(JSON.stringify(result, null, 2));

        if (result.success) {
            console.log("\nCurrent raw status:", result.data.status);

            const mapTrackingStatus = (rawStatus) => {
                if (!rawStatus) return null;
                const s = rawStatus.toLowerCase();
                if (s.includes('transit') || s.includes('en mer') || s.includes('loaded') ||
                    s.includes('departure') || s.includes('route') || s.includes('sailing')) return 'En Route';
                if (s.includes('delivered') || s.includes('gate out') || s.includes('completed')) return 'Livré';
                if (s.includes('arriv') || s.includes('unloaded') || s.includes('pod') || s.includes('discharge')) return 'Arrivé';
                if (s.includes('plan') || s.includes('sched') || s.includes('gate in') || s.includes('prep')) return 'Planifié';
                return null;
            }

            console.log("\nVoyageTracker Mapping Output:", mapTrackingStatus(result.data.status));
        }

    } catch (e) {
        console.error(e);
    }
}
test().then(() => process.exit(0));
