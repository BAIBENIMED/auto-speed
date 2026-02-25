const axios = require('axios');

class ContainerTrackingService {
    constructor() {
        this.apiKey = process.env.SAFECUBE_API_KEY;
        this.baseUrl = 'https://api.sinay.ai/container-tracking/api/v2';
    }

    /**
     * Detect carrier from tracking number format
     * Returns { carrier, type, trackingUrl }
     */
    detectCarrier(number) {
        if (!number) return null;
        const n = number.trim().toUpperCase();

        // Container number format: 4 letters + 7 digits
        if (/^[A-Z]{4}\d{7}$/.test(n)) {
            if (n.startsWith('MSCU') || n.startsWith('MEDU')) return { carrier: 'MSC', type: 'container', trackingUrl: `https://www.msc.com/track-a-shipment?agencyPath=msc&trackingNumber=${n}` };
            if (n.startsWith('MRSU') || n.startsWith('MAEU') || n.startsWith('MSKU')) return { carrier: 'Maersk', type: 'container', trackingUrl: `https://www.maersk.com/tracking/${n}` };
            if (n.startsWith('CMAU') || n.startsWith('CGMU')) return { carrier: 'CMA CGM', type: 'container', trackingUrl: `https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=Container&Reference=${n}` };
            if (n.startsWith('GCNU') || n.startsWith('GRIU')) return { carrier: 'Grimaldi', type: 'container', trackingUrl: `https://www.grimaldi-lines.com/ro-ro-cargo/tracking/?query=${n}` };
            if (n.startsWith('COSU') || n.startsWith('CBHU')) return { carrier: 'COSCO', type: 'container', trackingUrl: `https://elines.coscoshipping.com/ebsentence/entire?e=${n}` };
            if (n.startsWith('HLCU')) return { carrier: 'Hapag-Lloyd', type: 'container', trackingUrl: `https://www.hapag-lloyd.com/en/online-business/tracing/tracing-by-container.html?container=${n}` };
            if (n.startsWith('EISU')) return { carrier: 'Evergreen', type: 'container', trackingUrl: `https://ct.shipmentlink.com/servlet/TDB1_CargoTracking.do?type=C&no=${n}` };
        }

        // Purely numeric BL (9 digits) => Grimaldi / Maersk most likely
        if (/^\d{9}$/.test(n)) {
            return {
                carrier: 'Grimaldi / Maersk', type: 'bl', trackingUrls: [
                    { label: 'Grimaldi', url: `https://www.grimaldi-lines.com/ro-ro-cargo/tracking/?query=${n}` },
                    { label: 'Maersk', url: `https://www.maersk.com/tracking/${n}` }
                ]
            };
        }

        // Numeric shorter (booking)
        if (/^\d{6,11}$/.test(n)) {
            return {
                carrier: 'Inconnu', type: 'booking', trackingUrls: [
                    { label: 'Grimaldi', url: `https://www.grimaldi-lines.com/ro-ro-cargo/tracking/?query=${n}` },
                    { label: 'Maersk', url: `https://www.maersk.com/tracking/${n}` },
                    { label: 'MSC', url: `https://www.msc.com/track-a-shipment?agencyPath=msc&trackingNumber=${n}` }
                ]
            };
        }

        // Known BL letter prefixes
        if (n.startsWith('MSCUBL') || n.startsWith('MEDU')) return { carrier: 'MSC', type: 'bl', trackingUrl: `https://www.msc.com/track-a-shipment?agencyPath=msc&trackingNumber=${n}` };
        if (n.startsWith('MAEU') || n.startsWith('MRSE')) return { carrier: 'Maersk', type: 'bl', trackingUrl: `https://www.maersk.com/tracking/${n}` };

        return {
            carrier: 'Inconnu', type: 'bl', trackingUrls: [
                { label: 'Grimaldi', url: `https://www.grimaldi-lines.com/ro-ro-cargo/tracking/?query=${n}` },
                { label: 'MSC', url: `https://www.msc.com/track-a-shipment?agencyPath=msc&trackingNumber=${n}` },
                { label: 'Maersk', url: `https://www.maersk.com/tracking/${n}` },
                { label: 'CMA CGM', url: `https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=BillOfLading&Reference=${n}` }
            ]
        };
    }

    async trackContainer(number, isBL = false) {
        if (!number) return { status: 'Numéro manquant', identifier: 'N/A' };

        const carrierInfo = this.detectCarrier(number);

        // 1. Try Real API if Key is present
        if (this.apiKey && this.apiKey.trim() !== '' && this.apiKey !== 'your_safecube_key_here') {
            try {
                const result = await this.fetchFromSinayV2(number, isBL);
                // Attach carrier info for UI use
                if (carrierInfo) result.carrierInfo = carrierInfo;
                return result;
            } catch (error) {
                console.error(`[SinayV2] Tracking failed for ${number}:`, error.message);
                return {
                    status: 'ERREUR',
                    identifier: number,
                    message: `ERREUR TRACKING: ${error.message}`,
                    details: error.response?.data
                };
            }
        }

        // 2. Return fallback with carrier links
        return {
            status: 'Tracking Non Disponible',
            identifier: number,
            message: 'Le suivi automatique est indisponible. Consultez directement le site du transporteur.',
            carrierInfo: carrierInfo
        };
    }

    async fetchFromSinayV2(number, isBL = false) {
        const type = isBL ? 'bl' : 'container';
        const sealine = this.detectSealineCode(number);
        console.log(`[SinayV2] Fetching for ${type} ${number} (Sealine: ${sealine || 'Auto'})...`);

        try {
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
                    'X-API-KEY': this.apiKey,
                    'Accept': 'application/json'
                },
                timeout: 30000
            });

            return this.mapSinayV2Response(response.data, number, isBL);

        } catch (error) {
            if (error.response && error.response.status === 403) {
                console.log(`[SinayV2] 403 for ${number}. Attempting registration...`);
                return await this.createAndTrackLegacy(number, isBL);
            }
            if (error.code === 'ECONNABORTED') {
                throw new Error('Timeout: Le serveur Sinay/Safecube est trop lent à répondre (30s).');
            }
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                const msg = data?.message || data?.error || error.message;
                throw new Error(`Erreur API Sinay (${status}): ${msg}`);
            }
            throw error;
        }
    }

    detectSealineCode(number) {
        const n = (number || '').trim().toUpperCase();
        if (n.startsWith('MSCU') || n.startsWith('MEDU')) return 'MEDU';
        if (n.startsWith('MRSU') || n.startsWith('MAEU') || n.startsWith('MSKU')) return 'MAEU';
        if (n.startsWith('CMAU') || n.startsWith('CGMU')) return 'CMDU';
        if (n.startsWith('HLCU')) return 'HLCU';
        if (n.startsWith('EISU')) return 'EISU';
        if (n.startsWith('COSU') || n.startsWith('CBHU')) return 'COSU';
        return null;
    }

    async createAndTrackLegacy(number, isBL = false) {
        try {
            const payload = isBL ? [{ blNumber: number }] : [{ shipmentNumber: number }];
            console.log(`[Sinay] Registering ${number} at /safecube/api/v1/shipments...`);
            await axios.post(`https://api.sinay.ai/safecube/api/v1/shipments`,
                payload,
                {
                    headers: {
                        'API_KEY': this.apiKey,
                        'X-API-KEY': this.apiKey,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: 15000
                }
            );
            return {
                identifier: number,
                type: isBL ? 'BL' : 'Container',
                status: 'Initialisation...',
                location: { lat: 0, lng: 0, name: 'Enregistrement en cours' },
                events: [{ date: new Date().toISOString(), description: 'Suivi activé', location: 'Système' }],
                provider: 'Sinay V2 (Pending)'
            };
        } catch (err) {
            console.error(`[Sinay] Registration failed:`, err.message);
            throw new Error('Enregistrement échoué: ' + err.message);
        }
    }

    mapSinayV2Response(data, number, isBL) {
        const metadata = data.metadata || {};
        const routeData = data.routeData || {};
        const vessels = data.vessels || [];

        let currentLat = routeData.coordinates?.lat || 0;
        let currentLng = routeData.coordinates?.lng || 0;
        let locationName = 'En transit';

        const container = (data.containers && data.containers[0]) || {};
        const rawEvents = container.events || data.events || [];

        const mappedEvents = rawEvents.map(e => ({
            date: e.date,
            description: e.description || e.eventCode || 'Événement',
            location: e.location?.name || '',
            isActual: e.isActual
        })).sort((a, b) => new Date(b.date) - new Date(a.date));

        const lastActualEvent = mappedEvents.find(e => e.isActual);
        if (lastActualEvent) {
            locationName = lastActualEvent.location || locationName;
            if (!currentLat && lastActualEvent.location?.coordinates) {
                currentLat = lastActualEvent.location.coordinates.lat;
                currentLng = lastActualEvent.location.coordinates.lng;
            }
        }

        let vesselName = data.ais?.vesselName || (vessels.length > 0 ? vessels[vessels.length - 1].name : metadata.sealineName || 'Navire');

        const isSimulator = vesselName.toUpperCase().includes('TITAN') ||
            vesselName.toUpperCase().includes('SIMULATOR') ||
            (metadata.shippingStatus && metadata.shippingStatus.toUpperCase().includes('SIMULATOR'));

        if (isSimulator) {
            return {
                status: 'ERREUR',
                identifier: number,
                message: 'Le suivi automatique est indisponible. Consultez directement le site du transporteur.',
                provider: 'Sinay V2 (Simulated)'
            };
        }

        let shippingStatus = metadata.shippingStatus || 'En transit';

        // Check if the latest actual event gives a better status than 'En transit'
        if (shippingStatus === 'En transit' && lastActualEvent && lastActualEvent.description) {
            const desc = lastActualEvent.description.toLowerCase();
            if (desc.includes('discharge') || desc.includes('unloaded') || desc.includes('arriv') || desc.includes('pod')) {
                shippingStatus = lastActualEvent.description;
                console.log(`[SinayV2] Promoting status to "${shippingStatus}" based on latest actual event.`);
            }
        }

        return {
            identifier: number,
            type: isBL ? 'BL' : 'Container',
            status: shippingStatus,
            location: { lat: parseFloat(currentLat), lng: parseFloat(currentLng), name: locationName },
            events: mappedEvents,
            etd: data.route?.pol?.date || null,
            eta: data.route?.pod?.date || null,
            loadingPort: data.route?.pol?.location?.name || null,
            unloadingPort: data.route?.pod?.location?.name || null,
            vesselName: vesselName,
            voyage: 'N/A',
            provider: 'Sinay V2'
        };
    }
}

module.exports = new ContainerTrackingService();
