const axios = require('axios');

const API_KEY = '7ca7044c-4e31-4c66-b086-bee8d656fd7d';
const CONTAINER = 'MRSU4101891';

const configs = [
    { name: 'Header: API_KEY', headers: { 'API_KEY': API_KEY, 'Accept': 'application/json' } },
    { name: 'Header: X-API-KEY', headers: { 'X-API-KEY': API_KEY, 'Accept': 'application/json' } },
    { name: 'Header: Authorization Bearer', headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' } },
    { name: 'Header: Authorization Raw', headers: { 'Authorization': API_KEY, 'Accept': 'application/json' } }
];

async function runTests() {
    console.log(`[Debug] Testing access for ${CONTAINER} on Sinay API`);

    for (const config of configs) {
        console.log(`\n--- Testing ${config.name} ---`);
        try {
            const url = `https://api.sinay.ai/safecube/api/v1/shipment?shipmentNumber=${CONTAINER}`;
            const response = await axios.get(url, { headers: config.headers, timeout: 5000 });
            console.log(`✅ SUCCESS! Status: ${response.status}`);
            console.log('Data sample:', JSON.stringify(response.data).substring(0, 100));
            return; // Exit on first success
        } catch (error) {
            console.log(`❌ FAILED. Status: ${error.response ? error.response.status : error.message}`);
            if (error.response && error.response.data) {
                console.log('Error details:', JSON.stringify(error.response.data));
            }
        }
    }
    console.log('\n[Debug] All combinations failed.');
}

runTests();
