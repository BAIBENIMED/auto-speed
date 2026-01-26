require('dotenv').config({ path: './server/.env' });
const { Shipment } = require('./server/src/models');

async function testVessel() {
    try {
        // MSC MIAMI (MMSI: 255806114) - A real active container ship
        const mmsi = '255806114';

        // Find an existing shipment or create one
        let shipment = await Shipment.findOne({ where: { status: 'En mer' } });

        if (!shipment) {
            shipment = await Shipment.findOne();
        }

        if (shipment) {
            await shipment.update({
                mmsi: mmsi,
                status: 'En mer',
                carrier: 'MSC MIAMI',
                destination: 'Skikda (DZ)',
                currentLat: 36.5, // Initial dummy pos
                currentLng: 6.8,
                lastUpdate: new Date()
            });
            console.log(`✅ Shipment ${shipment.id} updated with MMSI ${mmsi} (MSC MIAMI)`);
        } else {
            console.log('❌ No shipments found to update.');
        }
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating test vessel:', error);
        process.exit(1);
    }
}

testVessel();
