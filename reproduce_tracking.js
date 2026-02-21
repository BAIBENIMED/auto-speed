const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

const API_KEY = process.env.SAFECUBE_API_KEY;
// Using a known container from debug scripts if possible, or common format
const CONTAINER = 'MRSU4101891';

async function testEndpoints() {
    console.log(`[Repro] Testing for ${CONTAINER} using Key: ${API_KEY ? 'MASKED' : 'MISSING'}`);

    if (!API_KEY) {
        console.error('ERROR: SAFECUBE_API_KEY is missing from .env');
        return;
    }

    const tests = [
        {
            name: 'Sinay V2 (Current)',
            url: `https://api.sinay.ai/container-tracking/api/v2/shipment`,
            params: { shipmentNumber: CONTAINER, shipmentType: 'CT' },
            headers: { 'API_KEY': API_KEY, 'Accept': 'application/json' }
        },
        {
            name: 'Safecube V1 (Alternative)',
            url: `https://api.sinay.ai/safecube/api/v1/shipment`,
            params: { shipmentNumber: CONTAINER },
            headers: { 'API_KEY': API_KEY, 'Accept': 'application/json' }
        },
        {
            name: 'Safecube V1 Public (Legacy)',
            url: `https://api.sinay.ai/safecube/api/v1/public/shipments`,
            method: 'POST',
            data: [{ shipmentNumber: CONTAINER }],
            headers: { 'API_KEY': API_KEY, 'Content-Type': 'application/json' }
        }
    ];

    for (const test of tests) {
        console.log(`\n--- Testing: ${test.name} ---`);
        try {
            const config = {
                method: test.method || 'GET',
                url: test.url,
                params: test.params,
                data: test.data,
                headers: test.headers,
                timeout: 30000
            };
            const response = await axios(config);
            console.log(`✅ SUCCESS! Status: ${response.status}`);
            console.log('Brief Data:', JSON.stringify(response.data).substring(0, 200));
        } catch (error) {
            console.log(`❌ FAILED. Status: ${error.response ? error.response.status : error.message}`);
            if (error.response && error.response.data) {
                console.log('Error details:', JSON.stringify(error.response.data));
            }
        }
    }
}

testEndpoints();
