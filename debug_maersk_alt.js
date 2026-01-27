const axios = require('axios');

const API_KEY = '7ca7044c-4e31-4c66-b086-bee8d656fd7d';
const CONTAINER = 'MRSU4101891';

async function testPost(label, url, body) {
    console.log(`\n--- Testing ${label} ---`);
    try {
        const resp = await axios.post(url, body, {
            headers: {
                'API_KEY': API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 15000
        });
        console.log(`✅ Success! Status: ${resp.status}`);
        console.log(JSON.stringify(resp.data, null, 2));
    } catch (err) {
        console.log(`❌ Failed: ${err.message} - ${err.response?.status}`);
        if (err.response?.data) console.log(`Body:`, JSON.stringify(err.response.data));
    }
}

async function run() {
    // Some docs refer to Sinay Logistics as the broader umbrella
    await testPost('Logistics Public Registration', 'https://api.sinay.ai/logistics/v1/public/shipments', [{ shipmentNumber: CONTAINER, carrier: 'MAEU' }]);
    await testPost('Logistics Public Registration (No carrier)', 'https://api.sinay.ai/logistics/v1/public/shipments', [{ shipmentNumber: CONTAINER }]);
}

run();
