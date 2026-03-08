const https = require('https');

async function login(username, password) {
    return new Promise((resolve) => {
        const req = https.request('https://tbiou-auto.onrender.com/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result.token || null);
                } catch (e) { resolve(null); }
            });
        });
        req.write(JSON.stringify({ username, password }));
        req.end();
    });
}

async function get(url, token) {
    return new Promise((resolve) => {
        https.get(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
            });
        });
    });
}

async function main() {
    const token = await login('admin', 'password123') || await login('admin', 'admin123');
    if (!token) return console.log("Login failed");

    console.log("Checking full state of ORD-7800...");
    const orderRes = await get('https://tbiou-auto.onrender.com/api/orders/ORD-7800', token);
    const shipmentId = 'SHP-844724';
    const shipmentRes = await get(`https://tbiou-auto.onrender.com/api/shipments/${shipmentId}`, token);

    console.log('\n--- ORDER ---');
    if (orderRes && orderRes.data) {
        console.log({
            id: orderRes.data.id,
            status: orderRes.data.status,
            vehicleId: orderRes.data.vehicleId
        });
    }

    console.log('\n--- SHIPMENT ---');
    if (shipmentRes && shipmentRes.data) {
        const s = shipmentRes.data;
        console.log({
            id: s.id,
            status: s.status,
            destination: s.destination,
            lastUpdate: s.lastUpdate,
            updatedAt: s.updatedAt
        });
    }
}

main().catch(console.error);
