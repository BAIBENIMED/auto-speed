const { Shipment } = require('./server/src/models');

async function check() {
    try {
        const s = await Shipment.findByPk('SHP-844724');
        if (!s) {
            console.log('Shipment SHP-844724 not found');
            return;
        }
        console.log('--- TRACKING HISTORY FOR SHP-844724 ---');
        const history = s.trackingHistory;
        console.log('Raw type:', typeof history);

        const events = JSON.parse(history || '[]');
        console.log('Number of events:', events.length);
        if (events.length > 0) {
            console.log('First event keys:', Object.keys(events[0]));
            console.log('First event full:', JSON.stringify(events[0], null, 2));
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

check().catch(console.error);
