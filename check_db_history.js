const { Shipment } = require('./server/src/models');

async function check() {
    const s = await Shipment.findByPk('SHP-844724');
    if (!s) {
        console.log('Shipment not found');
        return;
    }
    console.log('--- SHIPMENT DATA ---');
    console.log('ID:', s.id);
    console.log('History Type:', typeof s.trackingHistory);
    console.log('History:', s.trackingHistory);

    try {
        const events = JSON.parse(s.trackingHistory);
        console.log('Parsed Events (first 1):', events[0]);
    } catch (e) {
        console.log('History is not valid JSON');
    }
}

check().catch(console.error);
