const axios = require('axios');

const API_KEY = '7ca7044c-4e31-4c66-b086-bee8d656fd7d';
const NUMBER = 'MRSU4101891';
const SEALINE = 'MAEU';

async function testV2(label, url, params) {
    console.log(`\n--- Testing ${label} ---`);
    console.log(`URL: ${url}`);
    console.log(`Params:`, JSON.stringify(params));
    try {
        const resp = await axios.get(url, {
            params: params,
            headers: { 'API_KEY': API_KEY, 'Accept': 'application/json' }
        });
        console.log(`✅ Success!`);
        console.log(JSON.stringify(resp.data, null, 2).substring(0, 1500));
    } catch (err) {
        console.log(`❌ Failed: ${err.message} - ${err.response?.status}`);
        if (err.response?.data) console.log(`Body:`, JSON.stringify(err.response.data));
    }
}

async function run() {
    // Official Sinay v2 endpoint patterns
    await testV2('Sinay Container Tracking V2 (shipment)',
        'https://api.sinay.ai/container-tracking/api/v2/shipment',
        { shipmentNumber: NUMBER, sealine: SEALINE, shipmentType: 'CT', route: true, ais: true }
    );

    await testV2('Sinay Container Tracking V2 (shipment - no sealine)',
        'https://api.sinay.ai/container-tracking/api/v2/shipment',
        { shipmentNumber: NUMBER, shipmentType: 'CT' }
    );

    // Some docs show /shipments plural
    await testV2('Sinay Container Tracking V2 (shipments plural)',
        'https://api.sinay.ai/container-tracking/api/v2/shipments',
        { container: NUMBER, sealine: SEALINE }
    );
}

run();
