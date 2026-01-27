const axios = require('axios');

const API_KEY = '7ca7044c-4e31-4c66-b086-bee8d656fd7d';
const CONTAINER = 'MRSU4101891';

async function test(label, url) {
    console.log(`\n--- Testing ${label} ---`);
    try {
        const resp = await axios.get(url, {
            params: { container: CONTAINER },
            headers: { 'API_KEY': API_KEY, 'Accept': 'application/json' }
        });
        console.log(`✅ Success!`);
    } catch (err) {
        console.log(`❌ Failed: ${err.message} - ${err.response?.status}`);
    }
}

async function run() {
    await test('safecube/v1/shipments', 'https://api.sinay.ai/safecube/v1/shipments');
    await test('safecube/api/v1/shipments', 'https://api.sinay.ai/safecube/api/v1/shipments');
    await test('v1/safecube/shipments', 'https://api.sinay.ai/v1/safecube/shipments');
}

run();
