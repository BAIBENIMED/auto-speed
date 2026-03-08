const axios = require('axios');

const API_KEY = '7ca7044c-4e31-4c66-b086-bee8d656fd7d';
const CONTAINER = 'MRSU4101891';

async function testRegistration() {
    console.log(`[Test] Registering ${CONTAINER}...`);

    const payload = [{ shipmentNumber: CONTAINER }];

    try {
        const response = await axios.post('https://api.sinay.ai/safecube/api/v1/shipments',
            payload,
            {
                headers: {
                    'API_KEY': API_KEY,
                    'X-API-KEY': API_KEY, // Test both just in case
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        console.log('Success:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.response ? error.response.status : error.message);
        if (error.response) {
            console.error('Details:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testRegistration();
