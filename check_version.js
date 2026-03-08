const https = require('https');

async function get(url) {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { resolve({ error: 'Parse error', raw: data }); }
            });
        }).on('error', e => resolve({ error: e.message }));
    });
}

async function main() {
    console.log('--- CHECKING RENDER VERSION ---');
    const root = await get('https://tbiou-auto.onrender.com/');
    console.log('Root:', root);
    const health = await get('https://tbiou-auto.onrender.com/health');
    console.log('Health:', health);
}

main().catch(console.error);
