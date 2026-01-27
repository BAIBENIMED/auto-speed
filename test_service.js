require('dotenv').config({ path: './server/.env' });
const containerTrackingService = require('./server/src/services/containerTrackingService');

async function test() {
    console.log('--- Final Verification for ETD/ETA ---');
    const NUMBER = 'MRSU4101891';
    try {
        const res = await containerTrackingService.trackContainer(NUMBER);
        console.log('Result for', NUMBER);
        console.log('Status:', res.status);
        console.log('ETD:', res.etd);
        console.log('ETA:', res.eta);
        console.log('Location:', res.location.name);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
