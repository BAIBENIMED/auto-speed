/**
 * Script to test API endpoints and verify data accessibility
 * This simulates what the frontend does when syncing data
 */

const API_BASE = 'http://localhost:5000/api';

async function testAPIEndpoints() {
    console.log('🧪 Test des endpoints API...\n');

    // First, login to get a token
    console.log('1️⃣ Login...');
    try {
        const loginResponse = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'admin',
                password: 'admin123'
            })
        });

        const loginData = await loginResponse.json();

        if (!loginData.success) {
            console.error('❌ Login failed:', loginData.message);
            return;
        }

        console.log('✅ Login successful');
        console.log(`   User: ${loginData.user.name}`);
        console.log(`   Role: ${loginData.user.role}`);
        console.log(`   Token: ${loginData.token.substring(0, 20)}...`);

        const token = loginData.token;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        // Test each endpoint
        const endpoints = [
            { name: 'Roles', url: '/roles' },
            { name: 'Users', url: '/users' },
            { name: 'Clients', url: '/clients' },
            { name: 'Orders', url: '/orders' },
            { name: 'Vehicles', url: '/vehicles' },
            { name: 'Shipments', url: '/shipments' },
            { name: 'Brands', url: '/brands' },
            { name: 'Showrooms', url: '/showrooms' },
            { name: 'Settings', url: '/settings' },
            { name: 'Exchange Rates', url: '/exchange-rates' }
        ];

        console.log('\n2️⃣ Test des endpoints:\n');

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(`${API_BASE}${endpoint.url}`, { headers });
                const data = await response.json();

                if (data.success) {
                    const count = Array.isArray(data.data) ? data.data.length : (data.data ? 1 : 0);
                    console.log(`✅ ${endpoint.name.padEnd(20)} - ${count} item(s)`);
                } else {
                    console.log(`❌ ${endpoint.name.padEnd(20)} - Error: ${data.message}`);
                }
            } catch (error) {
                console.log(`❌ ${endpoint.name.padEnd(20)} - Exception: ${error.message}`);
            }
        }

        console.log('\n✅ Test terminé');

    } catch (error) {
        console.error('❌ Erreur lors du test:', error.message);
    }
}

testAPIEndpoints();
