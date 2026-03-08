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
        const req = https.request(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Length': 0 }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
            });
        });
        req.end();
    });
}

async function main() {
    const token = await login('admin', 'password123') || await login('admin', 'admin123');
    if (!token) return console.log("Login failed");

    const shipmentId = 'SHP-844724';
    console.log(`Refreshing ${shipmentId}...`);
    const refreshRes = await post(`https://tbiou-auto.onrender.com/api/tracking/${shipmentId}/refresh`, token);

    if (refreshRes && refreshRes.data) {
        console.log('\n--- FULL DATA FROM SERVER ---');
        console.log(JSON.stringify(refreshRes.data, null, 2));
    } else {
        console.log('Error or no data:', refreshRes);
    }
}

main().catch(console.error);
