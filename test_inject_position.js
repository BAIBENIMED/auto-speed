// Script to inject a test position for the vessel
const axios = require('axios');

async function injectTestPosition() {
    try {
        const response = await axios.post('https://tbiou-auto.onrender.com/api/shipments/test-signal', {
            mmsi: '255806086',
            lat: 36.1408,  // Position près de Gibraltar (dernière position connue du SONDERBORG)
            lng: -5.3536
        });

        console.log('✅ Test signal injected:', response.data);

        // Vérifier que la position a été enregistrée
        const checkResponse = await axios.get('https://tbiou-auto.onrender.com/api/shipments/tracking');
        console.log('\n📊 Tracking data:', JSON.stringify(checkResponse.data, null, 2));

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

injectTestPosition();
