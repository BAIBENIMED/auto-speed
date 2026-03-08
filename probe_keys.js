const axios = require('axios');

const API_KEY = '7ca7044c-4e31-4c66-b086-bee8d656fd7d';
const CONTAINER = 'TLLU5342468'; // I'll search for this later or use a common one

async function probe() {
    const endpoints = [
        { name: 'V2 GET', url: `https://api.sinay.ai/container-tracking/api/v2/shipment`, params: { shipmentNumber: CONTAINER, shipmentType: 'CT' } },
        { name: 'V1 GET', url: `https://api.sinay.ai/safecube/api/v1/shipment`, params: { shipmentNumber: CONTAINER } },
        { name: 'V1 PUBLIC GET', url: `https://api.sinay.ai/safecube/api/v1/public/shipments`, params: { container: CONTAINER } }
    ];

    for (const ep of endpoints) {
        console.log(`\n--- ${ep.name} ---`);
        try {
            const resp = await axios.get(ep.url, {
                params: ep.params,
                headers: { 'API_KEY': API_KEY, 'Accept': 'application/json' },
                timeout: 10000
            });
            console.log(`✅ Success: ${resp.status}`);
            console.log('Data:', JSON.stringify(resp.data).substring(0, 300));
        } catch (err) {
            console.log(`❌ Fail: ${err.message}`);
            if (err.response) console.log(`   Status: ${err.response.status}, Data:`, JSON.stringify(err.response.data));
        }
    }
}

probe();
