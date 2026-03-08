const https = require('https');

async function login(username, password) {
    return new Promise((resolve, reject) => {
        const req = https.request('https://tbiou-auto.onrender.com/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.token) resolve(result.token);
                    else resolve(null);
                } catch (e) { resolve(null); }
            });
        });
        req.on('error', reject);
        req.write(JSON.stringify({ username, password }));
        req.end();
    });
}

async function get(url, token) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ error: 'Parse error', raw: data });
                }
            });
        }).on('error', reject);
    });
}

async function main() {
    // Try both common passwords
    let token = await login('admin', 'password123');
    if (!token) token = await login('admin', 'admin123');

    if (!token) return console.log("Login failed");

    const shipmentId = 'SHP-844724';
    console.log(`Fetching detailed shipment data for ${shipmentId}...`);
    const sRes = await get(`https://tbiou-auto.onrender.com/api/shipments/${shipmentId}`, token);

    if (sRes.success && sRes.data) {
        const s = sRes.data;
        console.log('\n--- SHIPMENT CORE DATA ---');
        console.log(JSON.stringify({
            id: s.id,
            container: s.containerNumber,
            bl: s.blNumber,
            status: s.status,
            arrivalDate: s.arrivalDate
        }, null, 2));

        console.log('\n--- TRACKING HISTORY ---');
        try {
            const history = JSON.parse(s.trackingHistory);
            console.log(JSON.stringify(history, null, 2));
        } catch (e) {
            console.log('History data:', s.trackingHistory);
        }
    } else {
        console.log("Failed to fetch shipment:", sRes);
    }
}

main().catch(console.error);
