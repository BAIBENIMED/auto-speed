const axios = require('axios');

class ContainerTrackingService {
    constructor() {
        // Safecube API Configuration
        this.apiKey = process.env.SAFECUBE_API_KEY;
        this.baseUrl = 'https://api.safecube.com/v2';
    }

    async trackContainer(number, isBL = false) {
        // 1. Try Real API if Key is present
        if (this.apiKey && this.apiKey.trim() !== '' && this.apiKey !== 'your_safecube_key_here') {
            try {
                return await this.fetchFromSafecube(number, isBL);
            } catch (error) {
                console.error(`[Safecube] Tracking failed for ${number}:`, error.message);

                if (error.response && error.response.status === 401) {
                    console.warn('[Safecube] Invalid API Key. Falling back to simulation.');
                } else {
                    // Fallback to simulation if real API error
                    const sim = this.simulateTracking(number, isBL);
                    sim.status += ' (Simulé - API HS)';
                    return sim;
                }
            }
        }

        // 2. Default to Simulation
        return this.simulateTracking(number, isBL);
    }

    async fetchFromSafecube(number, isBL = false) {
        const type = isBL ? 'bl' : 'container';
        console.log(`[Safecube] Fetching real data for ${type} ${number}...`);

        try {
            // Safecube API v1: /shipments?container=XXX or ?bl=XXX
            const params = isBL ? { bl: number } : { container: number };
            const response = await axios.get(`https://api.sinay.ai/safecube/api/v1/shipments`, {
                params,
                headers: {
                    'API_KEY': this.apiKey,
                    'Accept': 'application/json'
                },
                timeout: 10000
            });

            if (response.data && (Array.isArray(response.data) ? response.data.length > 0 : true)) {
                return this.mapSafecubeResponse(response.data, number);
            } else {
                // If empty but successful, maybe not registered yet?
                console.log(`[Safecube] ${type} ${number} not found in database. Attempting registration...`);
                return await this.createAndTrackSafecube(number, isBL);
            }

        } catch (error) {
            // 403/404 means "Not found/Not accessible" -> We need to create it
            if (error.response && (error.response.status === 403 || error.response.status === 404)) {
                console.log(`[Safecube] ${type} ${number} not found/authorized. Attempting registration...`);
                return await this.createAndTrackSafecube(number, isBL);
            }
            throw error;
        }
    }

    async createAndTrackSafecube(number, isBL = false) {
        try {
            // Registration Payload
            const payload = isBL
                ? [{ blNumber: number }]
                : [{ shipmentNumber: number }];

            console.log(`[Safecube] Registering ${isBL ? 'BL' : 'Container'} ${number}...`);

            const postResponse = await axios.post(`https://api.sinay.ai/safecube/api/v1/public/shipments`,
                payload,
                {
                    headers: {
                        'API_KEY': this.apiKey,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: 10000
                }
            );

            if (postResponse.status === 200 || postResponse.status === 202) {
                console.log(`[Safecube] Registration successful for ${number}.`);
                return {
                    identifier: number,
                    type: isBL ? 'BL' : 'Container',
                    status: 'Initialisation...',
                    location: { lat: 0, lng: 0, name: 'Registration en cours' },
                    events: [{
                        date: new Date().toISOString(),
                        description: 'Enregistrement envoyé à Safecube',
                        location: 'Système'
                    }],
                    eta: null,
                    vesselName: 'Recherche...',
                    voyage: 'N/A',
                    provider: 'Safecube (Pending)'
                };
            }
        } catch (createError) {
            console.error(`[Safecube] Registration failed for ${number}:`, createError.message);

            if (createError.response && (createError.response.status === 403 || createError.response.status === 401)) {
                const sim = this.simulateTracking(number, isBL);
                sim.status += ' (Simulé - Clé API Limitée)';
                sim.events.unshift({
                    date: new Date().toISOString(),
                    description: 'Erreur API: Droits insuffisants (403)',
                    location: 'Système'
                });
                return sim;
            }
            throw createError;
        }
    }

    mapSafecubeResponse(data, number) {
        const shipment = Array.isArray(data) ? data[0] : (data.data || data);

        if (!shipment) {
            throw new Error('Data empty in Safecube response');
        }

        return {
            identifier: number,
            containerNumber: shipment.container_number || number,
            blNumber: shipment.bl_number,
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

    simulateTracking(number, isBL = false) {
        const hash = number.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const now = Date.now();
        const progressRaw = (hash + Math.floor(now / 1000000)) % 100;

        let status = 'En mer';
        if (progressRaw < 10) status = 'Préparation';
        else if (progressRaw > 90) status = 'Arrivé';

        // Europe to Africa path
        const startLat = 46.0;
        const startLng = -1.0;
        const endLat = 6.0;
        const endLng = 1.0;

        const p = progressRaw / 100;
        const currentLat = startLat - ((startLat - endLat) * p);
        const currentLng = startLng + ((endLng - startLng) * p);

        return {
            identifier: number,
            type: isBL ? 'BL' : 'Container',
            status: status,
            location: {
                lat: currentLat + (Math.random() * 0.1 - 0.05),
                lng: currentLng + (Math.random() * 0.1 - 0.05),
                name: 'Océan Atlantique (Simulé)'
            },
            events: [
                { date: new Date(now - 86400000 * 2).toISOString(), description: 'Départ du port de chargement', location: 'Le Havre, FR' },
                { date: new Date(now - 3600000).toISOString(), description: 'Position reçue par satellite', location: 'En mer' }
            ],
            eta: new Date(now + 86400000 * 5).toISOString(),
            vesselName: 'TITAN SIMULATOR',
            voyage: 'VOY-' + (hash % 1000),
            provider: 'Simulation'
        };
    }
}

module.exports = new ContainerTrackingService();
