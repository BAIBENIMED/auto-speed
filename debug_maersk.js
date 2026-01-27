const axios = require('axios');

const API_KEY = '7ca7044c-4e31-4c66-b086-bee8d656fd7d';
const CONTAINER = 'MRSU4101891';

async function test(label, url, params) {
    console.log(`\n--- Testing ${label} ---`);
    console.log(`Params:`, JSON.stringify(params));
    try {
        const resp = await axios.get(url, {
            params: params,
            headers: { 'API_KEY': API_KEY, 'Accept': 'application/json' }
        });
        console.log(`✅ Success!`);
        console.log(JSON.stringify(resp.data, null, 2).substring(0, 1000));
    } catch (err) {
        console.log(`❌ Failed: ${err.message}`);
        if (err.response) {
            console.log(`Status: ${err.response.status}`);
            console.log(`Body:`, JSON.stringify(err.response.data));
        }
    }
}

async function run() {
    // Test with Maersk code (MAEU is the SCAC for Maersk)
    await test('Maersk (MAEU) - Sinay V1', 'https://api.sinay.ai/safecube/api/v1/shipments', { container: CONTAINER, carrier: 'MAEU' });
    await test('Maersk (MSCU) - Sinay V1', 'https://api.sinay.ai/safecube/api/v1/shipments', { container: CONTAINER, carrier: 'MSCU' }); // MRSU is a Maersk prefix but sometimes mixed

    // Test Registration with Maersk
    console.log(`\n--- Testing Registration with MAEU ---`);
    try {
        const postResp = await axios.post('https://api.sinay.ai/safecube/api/v1/public/shipments',
            [{ shipmentNumber: CONTAINER, carrier: 'MAEU' }],
            { headers: { 'API_KEY': API_KEY, 'Content-Type': 'application/json' } }
        );
        console.log(`✅ Registration Success: ${postResp.status}`);
    } catch (err) {
        console.log(`❌ Registration Failed: ${err.message} - ${JSON.stringify(err.response?.data)}`);
    }
}

run();
