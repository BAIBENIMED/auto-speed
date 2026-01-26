const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const { Shipment } = require('./server/src/models');

async function testShipmentUpdate() {
    try {
        console.log('🧪 Testing Shipment update...');

        let shipment = await Shipment.findOne();
        if (!shipment) {
            console.log('📝 Creating dummy shipment for test...');
            shipment = await Shipment.create({
                id: 'TEST-SHIP-123',
                containerNumber: 'TESTCON123',
                shipmentDate: '2026-01-01',
                status: 'Préparation'
            });
        }

        console.log(`Found shipment: ${shipment.id}`);
        const testDate = '2026-02-15';
        console.log(`Setting dates to: ${testDate}`);

        await shipment.update({
            shipmentDate: testDate,
            etd: testDate,
            eta: testDate
        });

        // Reload to verify
        await shipment.reload();
        console.log('Reloaded shipment data:', {
            shipmentDate: shipment.shipmentDate ? shipment.shipmentDate.toISOString().split('T')[0] : null,
            etd: shipment.etd ? shipment.etd.toISOString().split('T')[0] : null,
            eta: shipment.eta ? shipment.eta.toISOString().split('T')[0] : null
        });

        if (shipment.shipmentDate && shipment.etd && shipment.eta) {
            console.log('✅ Update successful! Persistence is working.');
        } else {
            console.log('❌ Update failed or dates were nullified.');
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        process.exit();
    }
}

testShipmentUpdate();
