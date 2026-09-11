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
            if (n.startsWith('EISU') || n.startsWith('EGHU') || n.startsWith('EGSU')) return { carrier: 'Evergreen', type: 'container', trackingUrl: `https://ct.shipmentlink.com/servlet/TDB1_CargoTracking.do?type=C&no=${n}` };
            if (n.startsWith('HMMU') || n.startsWith('HDMU')) return { carrier: 'HMM', type: 'container', trackingUrl: `https://www.hmm21.com/e-service/general/trackNTrace/TrackNTrace.do?number=${n}` };
            if (n.startsWith('ONEU')) return { carrier: 'ONE', type: 'container', trackingUrl: `https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking?trakNoParam=${n}` };
            if (n.startsWith('OOLU') || n.startsWith('OOCU')) return { carrier: 'OOCL', type: 'container', trackingUrl: `https://www.oocl.com/eng/ourservices/eservices/cargotracking/Pages/cargotracking.aspx?ctSearchType=CT&ctShipmentNumber=${n}` };
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

    /**
     * Indice de transporteur envoye a Sinay : ce doit etre le code SCAC de la
     * compagnie, pas le prefixe du conteneur (les deux coincident pour MSC,
     * Maersk, CMA CGM, Hapag-Lloyd et COSCO, mais pas pour Evergreen).
     * Renvoyer null est sans danger : Sinay detecte alors le transporteur seul.
     */
    detectSealineCode(number) {
        const n = (number || '').trim().toUpperCase();
        if (n.startsWith('MSCU') || n.startsWith('MEDU')) return 'MEDU';
        if (n.startsWith('MRSU') || n.startsWith('MAEU') || n.startsWith('MSKU')) return 'MAEU';
        if (n.startsWith('CMAU') || n.startsWith('CGMU')) return 'CMDU';
        if (n.startsWith('HLCU')) return 'HLCU';
        if (n.startsWith('EISU') || n.startsWith('EGHU') || n.startsWith('EGSU')) return 'EGLV';
        if (n.startsWith('COSU') || n.startsWith('CBHU')) return 'COSU';
        if (n.startsWith('HMMU') || n.startsWith('HDMU')) return 'HDMU';
        if (n.startsWith('ONEU')) return 'ONEY';
        if (n.startsWith('OOLU') || n.startsWith('OOCU')) return 'OOLU';
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
        const finalPod = data.route?.pod?.location?.name || '';

        // Check if the latest actual event gives a better status than a generic transit status
        // OPTION B: Only promote to 'Arrivé' if we are at the FINAL destination
        const normalizedStatus = shippingStatus.toLowerCase();
        const isGenericTransit = normalizedStatus.includes('transit') || normalizedStatus.includes('route') || normalizedStatus.includes('mer');

        if (isGenericTransit && lastActualEvent && lastActualEvent.description) {
            const desc = lastActualEvent.description.toLowerCase();
            const eventLoc = (lastActualEvent.location || '').toLowerCase().trim();
            const podLoc = finalPod.toLowerCase().trim();

            const isArrivalKeyword = desc.includes('discharge') || desc.includes('unloaded') || desc.includes('arriv') || desc.includes('pod');

            // If it's an arrival keyword, check if the location matches the final POD
            if (isArrivalKeyword) {
                // Robust match: either includes the other
                const isPodMatch = podLoc && (podLoc.includes(eventLoc) || eventLoc.includes(podLoc));

                if (isPodMatch) {
                    shippingStatus = lastActualEvent.description;
                    console.log(`[SinayV2] SUCCESS: Promoting status to "${shippingStatus}" because it matches POD: ${finalPod} at ${lastActualEvent.location}`);
                } else {
                    console.log(`[SinayV2] SKIP: Arrival event at ${lastActualEvent.location} does not match POD ${finalPod}. Still in transit.`);
                }
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
            provider: 'Sinay V2',
            carrierInfo: {
                carrier: metadata.carrierName || 'Sinay API',
                debug: `Status: ${metadata.shippingStatus}, POD: ${finalPod}, Last: ${lastActualEvent?.description} @ ${lastActualEvent?.location}`
            }
        };
    }

    /**
     * Diagnostic du suivi maritime : repond a la question « pourquoi le
     * tracking ne marche pas ? » sans avoir a lire les journaux du serveur.
     * La cle n'est jamais renvoyee en clair.
     */
    async diagnostiquer(numero) {
        const rapport = {
            cleConfiguree: false,
            cleApercu: null,
            numeroTeste: null,
            transporteurDetecte: null,
            codeCompagnie: null,
            apiJoignable: null,
            dureeMs: null,
            statutHttp: null,
            resultat: null,
            erreur: null,
            conclusion: ''
        };

        const cle = (this.apiKey || '').trim();
        rapport.cleConfiguree = !!cle && cle !== 'your_safecube_key_here';
        if (rapport.cleConfiguree) {
            rapport.cleApercu = `${cle.length} caracteres, finit par ${cle.slice(-4)}`;
        }

        if (!rapport.cleConfiguree) {
            rapport.conclusion = "Aucune cle d'API n'est configuree sur le serveur (variable SAFECUBE_API_KEY). "
                + 'Le suivi automatique est donc desactive : seuls les liens vers les sites des transporteurs sont proposes.';
            return rapport;
        }

        const identifiant = (numero || '').trim().toUpperCase();
        if (!identifiant) {
            rapport.conclusion = "Cle presente. Indiquez un numero de conteneur ou de BL pour tester l'appel reel.";
            return rapport;
        }

        rapport.numeroTeste = identifiant;
        const transporteur = this.detectCarrier(identifiant);
        rapport.transporteurDetecte = transporteur ? transporteur.carrier : 'non reconnu';
        rapport.codeCompagnie = this.detectSealineCode(identifiant) || 'detection automatique par Sinay';

        const depart = Date.now();
        try {
            const reponse = await axios.get(`${this.baseUrl}/shipment`, {
                params: {
                    shipmentNumber: identifiant,
                    sealine: this.detectSealineCode(identifiant),
                    shipmentType: /^[A-Z]{4}\d{7}$/.test(identifiant) ? 'CT' : 'BL',
                    route: true,
                    ais: true
                },
                headers: { 'API_KEY': cle, 'X-API-KEY': cle, 'Accept': 'application/json' },
                timeout: 30000
            });

            rapport.dureeMs = Date.now() - depart;
            rapport.apiJoignable = true;
            rapport.statutHttp = reponse.status;

            const donnees = this.mapSinayV2Response(reponse.data, identifiant, false);
            rapport.resultat = {
                statut: donnees.status,
                navire: donnees.vesselName,
                position: donnees.location || null,
                etd: donnees.etd,
                eta: donnees.eta,
                evenements: (donnees.events || []).length
            };

            rapport.conclusion = donnees.status === 'ERREUR'
                ? `L'API repond mais ne suit pas ce numero : ${donnees.message || 'aucune donnee'}.`
                : `Le suivi fonctionne pour ${identifiant} : ${donnees.status}, navire ${donnees.vesselName || 'inconnu'}, ${(donnees.events || []).length} evenement(s).`;
            return rapport;

        } catch (erreur) {
            rapport.dureeMs = Date.now() - depart;
            rapport.apiJoignable = !!erreur.response;
            rapport.statutHttp = erreur.response ? erreur.response.status : null;
            rapport.erreur = erreur.response
                ? (erreur.response.data && (erreur.response.data.message || erreur.response.data.error)) || erreur.message
                : erreur.message;

            if (erreur.code === 'ECONNABORTED') {
                rapport.conclusion = "L'API Sinay n'a pas repondu en 30 secondes. Reessayez plus tard.";
            } else if (rapport.statutHttp === 401 || rapport.statutHttp === 403) {
                rapport.conclusion = "La cle d'API est refusee (droits insuffisants, cle expiree ou quota epuise). "
                    + 'Verifiez votre abonnement Sinay et la valeur de SAFECUBE_API_KEY.';
            } else if (rapport.statutHttp === 404) {
                rapport.conclusion = `Sinay ne connait pas le numero ${identifiant} : verifiez le numero, ou le transporteur ne publie pas encore ce conteneur.`;
            } else if (rapport.statutHttp === 429) {
                rapport.conclusion = 'Quota de requetes depasse chez Sinay. Le suivi repartira apres renouvellement du quota.';
            } else if (!erreur.response) {
                rapport.conclusion = "Le serveur n'arrive pas a joindre l'API Sinay (reseau ou pare-feu).";
            } else {
                rapport.conclusion = `L'API Sinay renvoie une erreur ${rapport.statutHttp} : ${rapport.erreur}`;
            }

            return rapport;
        }
    }
}

module.exports = new ContainerTrackingService();
