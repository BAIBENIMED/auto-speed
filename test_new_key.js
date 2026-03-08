const axios = require('axios');

const API_KEY = '63913358-f0f3-4227-9ea1-1836fbc4a68b';

// Test with the known container
async function testV2(container) {
    console.log(`\n[Test V2] Container: ${container}`);
    try {
        const response = await axios.get('https://api.sinay.ai/container-tracking/api/v2/shipment', {
            params: {
                shipmentNumber: container,
                shipmentType: 'CT',
                route: true,
                ais: true
            },
            headers: {
                'API_KEY': API_KEY,
                'X-API-KEY': API_KEY,
                'Accept': 'application/json'
            },
            timeout: 30000
        });

        const data = response.data;
        console.log(`✅ SUCCESS - Status: ${response.status}`);
        console.log(`Vessel: ${data.ais?.vesselName || 'N/A'}`);
        console.log(`Ship Status: ${data.metadata?.shippingStatus || 'N/A'}`);
        console.log(`POL: ${data.route?.pol?.location?.name || 'N/A'}`);
        console.log(`POD: ${data.route?.pod?.location?.name || 'N/A'}`);
        console.log(`Events count: ${data.containers?.[0]?.events?.length || 0}`);

    } catch (err) {
        console.log(`❌ Error: ${err.response?.status} - ${JSON.stringify(err.response?.data)}`);
    }
}

// Also test V1 GET (to list registered shipments)
async function testV1List() {
    console.log(`\n[Test V1 List] Getting registered shipments...`);
    try {
        const response = await axios.get('https://api.sinay.ai/safecube/api/v1/shipments', {
            headers: {
                'API_KEY': API_KEY,
                'X-API-KEY': API_KEY,
                'Accept': 'application/json'
            },
            timeout: 30000
        });
        console.log(`✅ Status: ${response.status}`);
        console.log(`Data: ${JSON.stringify(response.data).substring(0, 500)}`);
    } catch (err) {
        console.log(`❌ V1 Error: ${err.response?.status} - ${JSON.stringify(err.response?.data).substring(0, 200)}`);
    }
}

async function run() {
    await testV2('MRSU4101891');
    await testV1List();
}

run();
