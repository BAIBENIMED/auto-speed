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

// Custom request to get raw tracking data if possible
async function getRawTracking(containerNumber, token) {
    // We can't easily get RAW from our API unless we have an endpoint. 
    // But we can check what our shipment controller returns in 'details' if it includes the raw response.
    // Instead, I'll use our existing repo code to simulate.
}

async function main() {
    const token = await login('admin', 'password123') || await login('admin', 'admin123');
    if (!token) return console.log("Login failed");

    // Let's use the shipment ID but try to find a way to see the RAW data.
    // Actually, I'll just inspect the 'destination' and 'unloadingPort' returned by my debug script.
}

main().catch(console.error);
