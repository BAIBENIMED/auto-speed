const axios = require('axios');

const API_KEY = '63913358-f0f3-4227-9ea1-1836fbc4a68b';

async function testEndpoint(name, method, url, params = {}, data = null) {
    console.log(`\n=== ${name} ===`);
    try {
        const config = {
            headers: { 'API_KEY': API_KEY, 'X-API-KEY': API_KEY, 'Accept': 'application/json', 'Content-Type': 'application/json' },
            timeout: 15000
        };
        if (params && Object.keys(params).length > 0) config.params = params;

        const response = data
            ? await axios[method](url, data, config)
            : await axios[method](url, config);

        console.log(`✅ Status: ${response.status}`);
        console.log(`Data: ${JSON.stringify(response.data).substring(0, 500)}`);
        return response.data;
    } catch (err) {
        console.log(`❌ Status: ${err.response?.status || 'N/A'} | Error: ${err.message}`);
        if (err.response?.data) console.log(`   API Message: ${JSON.stringify(err.response.data).substring(0, 300)}`);
    }
}

async function runAllTests() {
    // Test 1: Get all registered shipments in account
    await testEndpoint(
        '1. V1 GET all shipments (list account)',
        'get',
        'https://api.sinay.ai/safecube/api/v1/shipments'
    );

    // Test 2: V1 with container param
    await testEndpoint(
        '2. V1 GET shipments with container',
        'get',
        'https://api.sinay.ai/safecube/api/v1/shipments',
        { container: 'MRSU4101891' }
    );

    // Test 3: V1 tracking directly
    await testEndpoint(
        '3. V1 GET shipment tracking',
        'get',
        'https://api.sinay.ai/safecube/api/v1/shipments/MRSU4101891'
    );

    // Test 4: V2 container tracking
    await testEndpoint(
        '4. V2 Container Tracking',
        'get',
        'https://api.sinay.ai/container-tracking/api/v2/shipment',
        { shipmentNumber: 'MRSU4101891', shipmentType: 'CT', route: true, ais: true }
    );

    // Test 5: V2 BL tracking
    await testEndpoint(
        '5. V2 BL Tracking (try container as BL)',
        'get',
        'https://api.sinay.ai/container-tracking/api/v2/shipment',
        { shipmentNumber: 'MRSU4101891', shipmentType: 'BL', route: true, ais: true }
    );

    // Test 6: Public endpoint
    await testEndpoint(
        '6. V1 Public endpoint',
        'get',
        'https://api.sinay.ai/safecube/api/v1/public/shipments',
        { container: 'MRSU4101891' }
    );

    // Test 7: Inspect account (basic settings)
    await testEndpoint(
        '7. Account info',
        'get',
        'https://api.sinay.ai/safecube/api/v1/account'
    );

    console.log('\n=== DONE ===');
}

runAllTests();
