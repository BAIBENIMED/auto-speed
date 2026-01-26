require('dotenv').config({ path: './server/.env' });
const { Shipment } = require('./server/src/models');
const { sequelize } = require('./server/src/config/database');

async function checkTrackingStatus() {
    try {
        console.log('--- Current Tracking Data in Database ---');
        const shipments = await Shipment.findAll({
            where: { isArchived: false },
            attributes: ['id', 'containerNumber', 'carrier', 'mmsi', 'currentLat', 'currentLng', 'lastUpdate', 'shipStatus']
        });

        if (shipments.length === 0) {
            console.log('No active shipments found.');
        }

        shipments.forEach(s => {
            console.log(`Shipment: ${s.id} | Contener: ${s.containerNumber}`);
            console.log(`- Carrier: ${s.carrier}`);
            console.log(`- MMSI: ${s.mmsi || 'N/A'}`);
            console.log(`- Position: ${s.currentLat}, ${s.currentLng}`);
            console.log(`- Last Update: ${s.lastUpdate || 'Never'}`);
            console.log(`- Signal Status: ${s.shipStatus || 'N/A'}`);
            console.log('-----------------------------------');
        });

        process.exit(0);
    } catch (error) {
        console.error('Error checking tracking data:', error);
        process.exit(1);
    }
}

checkTrackingStatus();
