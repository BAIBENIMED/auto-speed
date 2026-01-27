const axios = require('axios');

const API_KEY = '7ca7044c-4e31-4c66-b086-bee8d656fd7d';
const NUMBER = 'MRSU4101891';
const SEALINE = 'MAEU';

async function run() {
    try {
        const resp = await axios.get('https://api.sinay.ai/container-tracking/api/v2/shipment', {
            params: {
                shipmentNumber: NUMBER,
                sealine: SEALINE,
                shipmentType: 'CT',
                route: true,
                ais: true
            },
            headers: { 'API_KEY': API_KEY, 'Accept': 'application/json' }
        });
        console.log(JSON.stringify(resp.data, null, 2));
    } catch (err) {
        console.error(err.message);
        if (err.response) console.log(err.response.data);
    }
}

run();
