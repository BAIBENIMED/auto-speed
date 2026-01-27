require('dotenv').config({ path: './server/.env' });
const containerTrackingService = require('./server/src/services/containerTrackingService');

async function test() {
    const NUMBER = 'MRSU4101891';
    console.log(`\n--- Testing Maersk Container (${NUMBER}) ---`);
    try {
        const res = await containerTrackingService.trackContainer(NUMBER);
        console.log('Result:', JSON.stringify(res, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
