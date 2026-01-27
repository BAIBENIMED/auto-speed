const axios = require('axios');

const API_KEY = '7ca7044c-4e31-4c66-b086-bee8d656fd7d';
const CONTAINER = 'MRSU4101891'; // Known valid container

async function runTest() {
    console.log(`[Debug] Testing full flow for ${CONTAINER}`);

    try {
        // 1. Try GET
        console.log('[Debug] Step 1: GET Shipment');
        try {
            await axios.get(`https://api.sinay.ai/safecube/api/v1/shipments`, {
                params: { container: CONTAINER },
                headers: { 'X-API-KEY': API_KEY, 'Accept': 'application/json' }
            });
            console.log('[Debug] GET successful (Unexpected if new)');
        } catch (error) {
            if (error.response && error.response.status === 403) {
                console.log('[Debug] Got 403 Forbidden (Expected). Proceeding to registration.');

                // 2. Try POST
                console.log('[Debug] Step 2: POST Shipment (Register)');
                const postResp = await axios.post(`https://api.sinay.ai/safecube/api/v1/shipments`,
                    [{ shipmentNumber: CONTAINER }],
                    {
                        headers: {
                            'API_KEY': API_KEY,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        }
                    }
                );
                console.log(`[Debug] POST Status: ${postResp.status}`);
                console.log(`[Debug] POST Data:`, JSON.stringify(postResp.data, null, 2));

            } else {
                console.error('[Debug] GET Error was not 403:', error.response ? error.response.status : error.message);
                console.error('Data:', error.response?.data);
            }
        }

    } catch (err) {
        console.error('[Debug] Fatal Error:', err.message);
        if (err.response) console.error('Response:', err.response.data);
    }
}

runTest();
