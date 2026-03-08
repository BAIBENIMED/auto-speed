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

async function post(url, token) {
    return new Promise((resolve) => {
        console.log(`[POST] ${url}`);
        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Length': 0
            }
        }, (res) => {
            console.log(`[RES] Status: ${res.statusCode}`);
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ error: 'Parse error', raw: data });
                }
            });
        });
        req.on('error', (e) => {
            console.log('Request error:', e.message);
            resolve({ error: e.message });
        });
        req.end();
    });
}

async function main() {
    const token = await login('admin', 'password123') || await login('admin', 'admin123');
    if (!token) return console.log("Login failed");

    const shipmentId = 'SHP-844724';

    console.log('\n--- TRIGGERING REFRESH (POST) ---');
    const refreshRes = await post(`https://tbiou-auto.onrender.com/api/tracking/${shipmentId}/refresh`, token);
    console.log(JSON.stringify(refreshRes, null, 2));
}

main().catch(console.error);
