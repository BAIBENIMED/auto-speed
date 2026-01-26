const axios = require('axios');

class ContainerTrackingService {
    constructor() {
        // Safecube API Configuration
        this.apiKey = process.env.SAFECUBE_API_KEY;
        this.baseUrl = 'https://api.safecube.com/v2';
    }

    async trackContainer(containerNumber) {
        // 1. Try Real API if Key is present
        if (this.apiKey && this.apiKey.trim() !== '' && this.apiKey !== 'your_safecube_key_here') {
            try {
                return await this.fetchFromSafecube(containerNumber);
            } catch (error) {
                console.error(`[Safecube] Tracking failed for ${containerNumber}:`, error.message);
                // Fallback to simulation if API fails? Or return error? 
                // For now, let's return error to alert user API is failing, 
                // UNLESS the error is "Unauthorized" which implies bad key.
                if (error.response && error.response.status === 401) {
                    console.warn('[Safecube] Invalid API Key. Falling back to simulation.');
                } else {
                    // Return simulation with "Simulation (Fallback)" status if real API error
                    const sim = this.simulateTracking(containerNumber);
                    sim.status += ' (Simulé - API HS)';
                    return sim;
                }
            }
        }

        // 2. Default to Simulation
        return this.simulateTracking(containerNumber);
    }

    async fetchFromSafecube(containerNumber) {
        console.log(`[Safecube] Fetching real data for ${containerNumber}...`);

        // const response = await axios.get(`${this.baseUrl}/shipments`, {
        const response = await axios.get(`https://api.sinay.ai/safecube/api/v1/shipments`, {
            params: { container: containerNumber },
            headers: {
                'API_KEY': this.apiKey,
                'Accept': 'application/json'
            },
            timeout: 10000
        });

        const data = response.data;

        // Map Safecube response to our standardized format
        // Note: Adaptation required based on exact Safecube response structure
        // Assuming typical structure: { data: { events: [], current_status: {}, ... } }

        // Safeguard against different response structures
        const shipment = Array.isArray(data) ? data[0] : (data.data || data);

        if (!shipment) {
            throw new Error('Container not found in Safecube');
        }

        return {
            containerNumber: containerNumber,
            status: shipment.status || 'En transit',
            location: {
                lat: parseFloat(shipment.latitude || shipment.location?.lat || 0),
                lng: parseFloat(shipment.longitude || shipment.location?.lng || 0),
                name: shipment.location?.name || shipment.last_port || 'Position Satellite'
            },
            events: (shipment.events || []).map(e => ({
                date: e.date || e.timestamp,
                description: e.description || e.status,
                location: e.location || ''
            })),
            eta: shipment.pod_eta || shipment.eta,
            vesselName: shipment.vessel_name || shipment.vessel,
            voyage: shipment.voyage_number || 'N/A',
            provider: 'Safecube'
        };
    }

    simulateTracking(containerNumber) {
        // Deterministic simulation based on container number hash
        const hash = containerNumber.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

        // Simulate progress (0-100) based on time of day + hash
        const now = Date.now();
        const progressRaw = (hash + Math.floor(now / 1000000)) % 100; // Slower movement

        let status = 'En mer';
        if (progressRaw < 10) status = 'Préparation';
        else if (progressRaw > 90) status = 'Arrivé';

        // Simulate coordinates (Atlantic Ocean path approx)
        // From Europe (46, -1) to West Africa (6, 1)
        const startLat = 46.0;
        const startLng = -1.0;
        const endLat = 6.0;
        const endLng = 1.0;

        const p = progressRaw / 100;
        const currentLat = startLat - ((startLat - endLat) * p);
        const currentLng = startLng + ((endLng - startLng) * p);

        return {
            containerNumber,
            status: status,
            location: {
                lat: currentLat + (Math.random() * 0.1 - 0.05), // Add tiny jitter
                lng: currentLng + (Math.random() * 0.1 - 0.05),
                name: 'Océan Atlantique (Simulé)'
            },
            events: [
                { date: new Date(now - 86400000 * 2).toISOString(), description: 'Départ du port de chargement', location: 'Le Havre, FR' },
                { date: new Date(now - 3600000).toISOString(), description: 'Position reçue par satellite', location: 'En mer' }
            ],
            eta: new Date(now + 86400000 * 5).toISOString(), // +5 days
            vesselName: 'MSC SIMULATOR',
            voyage: 'VOY-' + (hash % 1000),
            provider: 'Simulation'
        };
    }
}

module.exports = new ContainerTrackingService();
