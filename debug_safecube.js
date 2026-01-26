const axios = require('axios');

const API_KEY = '7ca7044c-4e31-4c66-b086-bee8d656fd7d';
const CONTAINER = 'MSCU1234567'; // Test container

async function testSafecube() {
    console.log(`Testing Safecube API with Key: ${API_KEY}`);
    console.log(`Container: ${CONTAINER}`);

    try {
        // const url = 'https://api.safecube.com/v2/shipments';
        const url = 'https://api.sinay.ai/safecube/api/v1/shipments';
        console.log(`GET ${url}?container=${CONTAINER}`);

        const response = await axios.get(url, {
            params: { container: CONTAINER },
            headers: {
                'API_KEY': API_KEY,
                'Accept': 'application/json'
            }
        });

        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error('API Error:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

testSafecube();
