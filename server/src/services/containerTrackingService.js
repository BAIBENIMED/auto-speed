const axios = require('axios');

class ContainerTrackingService {
    constructor() {
        // Sinay/Safecube API Configuration
        this.apiKey = process.env.SAFECUBE_API_KEY;
        this.baseUrl = 'https://api.sinay.ai/container-tracking/api/v2';
    }

    async trackContainer(number, isBL = false) {
        if (!number) return this.simulateTracking('N/A', isBL);

        // 1. Try Real API if Key is present
        if (this.apiKey && this.apiKey.trim() !== '' && this.apiKey !== 'your_safecube_key_here') {
            try {
                return await this.fetchFromSinayV2(number, isBL);
            } catch (error) {
                console.error(`[SinayV2] Tracking failed for ${number}:`, error.message);

                if (error.response && error.response.status === 401) {
                    console.warn('[SinayV2] Invalid API Key. Falling back to simulation.');
                } else {
                    const sim = this.simulateTracking(number, isBL);
                    sim.status += ' (Simulé - API HS)';
                    return sim;
                }
            }
        }

        // 2. Default to Simulation
        return this.simulateTracking(number, isBL);
    }

    detectSealine(number) {
        if (number.startsWith('MRSU')) return 'MAEU'; // Maersk
        if (number.startsWith('MSCU') || number.startsWith('MEDU')) return 'MEDU'; // MSC
        return null;
    }

    async fetchFromSinayV2(number, isBL = false) {
        const type = isBL ? 'bl' : 'container';
        const sealine = this.detectSealine(number);
        console.log(`[SinayV2] Fetching V2 data for ${type} ${number} (Sealine: ${sealine || 'Auto'})...`);

        try {
            // Sinay V2 Path: /shipment
            // Params: shipmentNumber, sealine, shipmentType (CT=Container, BL=Bill of lading)
            const response = await axios.get(`${this.baseUrl}/shipment`, {
                params: {
                    shipmentNumber: number,
                    sealine: sealine,
                    shipmentType: isBL ? 'BL' : 'CT',
                    route: true,
                    ais: true
                },
                headers: {
                    'API_KEY': this.apiKey,
                    'Accept': 'application/json'
                },
                timeout: 15000
            });

            return this.mapSinayV2Response(response.data, number, isBL);

        } catch (error) {
            // 403 Forbidden on V2 often means the shipment isn't registered/tracked yet in the Sinay account
            // Some Sinay products require "Registration" via POST before "Tracking" via GET.
            if (error.response && error.response.status === 403) {
                console.log(`[SinayV2] 403 Forbidden for ${number}. Attempting legacy registration...`);
                // Fallback to legacy registration flow if possible, or just simulate
                return await this.createAndTrackLegacy(number, isBL);
            }
            throw error;
        }
    }

    async createAndTrackLegacy(number, isBL = false) {
        try {
            console.log(`[Sinay] Attempting registration for ${number}...`);
            const payload = isBL ? [{ blNumber: number }] : [{ shipmentNumber: number }];

            await axios.post(`https://api.sinay.ai/safecube/api/v1/public/shipments`,
                payload,
                {
                    headers: { 'API_KEY': this.apiKey, 'Content-Type': 'application/json' },
                    timeout: 10000
                }
            );

            return {
                identifier: number,
                type: isBL ? 'BL' : 'Container',
                status: 'Initialisation (V2)...',
                location: { lat: 0, lng: 0, name: 'Enregistrement en cours' },
                events: [{ date: new Date().toISOString(), description: 'Enregistrement activé', location: 'Systèle' }],
                provider: 'Sinay V2 (Pending)'
            };
        } catch (err) {
            console.error(`[Sinay] Registration failed:`, err.message);
            const sim = this.simulateTracking(number, isBL);
            sim.status += ' (Simulé - Droits Insuffisants)';
            return sim;
        }
    }

    mapSinayV2Response(data, number, isBL) {
        const metadata = data.metadata || {};
        const routeData = data.routeData || {};
        const vessels = data.vessels || [];

        // 1. Current Position
        // routeData.coordinates is the most reliable "current" point in V2
        let currentLat = routeData.coordinates?.lat || 0;
        let currentLng = routeData.coordinates?.lng || 0;
        let locationName = 'En transit';

        // 2. Events Mapping
        // In V2, events are typically inside information about the specific container or the whole shipment
        const container = (data.containers && data.containers[0]) || {};
        const rawEvents = container.events || data.events || [];

        const mappedEvents = rawEvents.map(e => ({
            date: e.date,
            description: e.description || e.eventCode || 'Événement',
            location: e.location?.name || '',
            isActual: e.isActual
        })).sort((a, b) => new Date(b.date) - new Date(a.date));

        // 3. Current Location Name (from latest actual event)
        const lastActualEvent = mappedEvents.find(e => e.isActual);
        if (lastActualEvent) {
            locationName = lastActualEvent.location || locationName;
            // If routeData coordinates are missing or zero, fallback to last actual event's coordinates
            if (!currentLat && lastActualEvent.location?.coordinates) {
                currentLat = lastActualEvent.location.coordinates.lat;
                currentLng = lastActualEvent.location.coordinates.lng;
            }
        }

        // 4. Vessel Name
        // Try to get the vessel from the vessels list or latest event
        let vesselName = data.ais?.vesselName || (vessels.length > 0 ? vessels[vessels.length - 1].name : metadata.sealineName || 'Navire');

        return {
            identifier: number,
            type: isBL ? 'BL' : 'Container',
            status: metadata.shippingStatus || 'En transit',
            location: {
                lat: parseFloat(currentLat),
                lng: parseFloat(currentLng),
                name: locationName
            },
            events: mappedEvents,
            etd: data.route?.pol?.date || null,
            eta: data.route?.pod?.date || metadata.updatedAt,
            loadingPort: data.route?.pol?.location?.name || null,
            unloadingPort: data.route?.pod?.location?.name || null,
            vesselName: vesselName,
            voyage: 'N/A',
            provider: 'Sinay V2'
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
