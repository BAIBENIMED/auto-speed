require('dotenv').config({ path: './server/.env' });
const containerTrackingService = require('./server/src/services/containerTrackingService');

async function test() {
    console.log('Testing ContainerTrackingService V2 (Sinay)...');

    const NUMBER = 'MRSU4101891';
    console.log(`\n--- Testing Maersk Container (${NUMBER}) ---`);
    try {
        const res = await containerTrackingService.trackContainer(NUMBER);
        console.log('Result:', JSON.stringify(res, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }

    const BL = '953119106'; // Example BL if known, otherwise just test current support
    console.log(`\n--- Testing BL support ---`);
    try {
        const res = await containerTrackingService.trackContainer(BL, true);
        console.log('Result:', JSON.stringify(res, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
