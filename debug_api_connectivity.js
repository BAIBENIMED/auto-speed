
const BASE_URL = 'http://localhost:5000/api';

async function testEndpoints() {
    console.log('Testing identifiers using native fetch...');

    const endpoints = [
        '/health',
        '/vehicles',
        '/orders',
        '/clients',
        '/users'
    ];

    for (const endpoint of endpoints) {
        try {
            console.log(`\nGET ${endpoint}...`);
            const res = await fetch(`${BASE_URL}${endpoint}`);
            console.log(`Status: ${res.status}`);

            if (res.ok) {
                const data = await res.json();
                if (data.success !== undefined) {
                    console.log(`Success: ${data.success}`);
                    if (data.data) {
                        console.log(`Count: ${Array.isArray(data.data) ? data.data.length : 'N/A'}`);
                        if (Array.isArray(data.data) && data.data.length > 0) {
                            console.log('Sample ID:', data.data[0].id);
                        }
                    }
                } else {
                    console.log('Response:', data); // For health check
                }
            } else {
                console.log('Error Status:', res.statusText);
                const text = await res.text();
                console.log('Body:', text);
            }
        } catch (error) {
            console.error(`Error fetching ${endpoint}:`, error.message);
        }
    }
}

testEndpoints();
