document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('tracking-form');
    const input = document.getElementById('order-id-input');
    const content = document.getElementById('tracking-content');
    const errorMsg = document.getElementById('error-message');
    const btn = form.querySelector('button');
    const btnText = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.loader');
    
    function formatDate(dateStr) {
        if (!dateStr) return '--';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    // Auto-track if code is in URL
    const urlParams = new URLSearchParams(window.location.search);
    const trackCode = urlParams.get('code') || urlParams.get('id');
    if (trackCode) {
        input.value = trackCode;
        performTracking(trackCode);
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = input.value.trim().toUpperCase();
        if (id) performTracking(id);
    });

    async function performTracking(id) {
        // UI State: Loading
        errorMsg.style.display = 'none';
        btn.disabled = true;
        btnText.style.display = 'none';
        loader.style.display = 'block';

        try {
            const response = await fetch(`/api/public/track?code=${encodeURIComponent(id)}`);
            const result = await response.json();

            if (result.success) {
                updateUI(result.data);
                content.style.display = 'block';
                // Update URL without reloading
                window.history.pushState({}, '', `?code=${encodeURIComponent(id)}`);
            } else {
                content.style.display = 'none';
                errorMsg.style.display = 'block';
                errorMsg.textContent = result.message || 'Commande introuvable.';
            }
        } catch (error) {
            console.error('Tracking fetch error:', error);
            errorMsg.style.display = 'block';
            errorMsg.textContent = 'Erreur de connexion au serveur.';
        } finally {
            btn.disabled = false;
            btnText.style.display = 'block';
            loader.style.display = 'none';
        }
    }

    function updateUI(data) {
        // Basic Info
        document.getElementById('display-order-id').textContent = `COMMANDE #${data.orderId}`;
        document.getElementById('display-order-date').textContent = `Validée le ${formatDate(data.orderDate)}`;
        document.getElementById('display-status-badge').textContent = data.orderStatus;
        
        // Client Info
        document.getElementById('display-client-name').textContent = data.clientName || '--';
        document.getElementById('display-client-phone').textContent = data.clientPhone || '--';
        
        const clientIds = [];
        if (data.clientNIN) clientIds.push(`NIN: ${data.clientNIN}`);
        if (data.clientPassport) clientIds.push(`PASSPORT: ${data.clientPassport}`);
        document.getElementById('display-client-ids').textContent = clientIds.length > 0 ? clientIds.join(' / ') : '--';
        
        const vehicleName = data.vehicle ? `${data.vehicle.brand} ${data.vehicle.model || ''} ${data.vehicle.year || ''}` : 'Véhicule en attente';
        document.getElementById('display-vehicle-name').textContent = vehicleName;
        document.getElementById('display-vehicle-trim').textContent = data.vehicle?.trim || '--';
        document.getElementById('display-vehicle-color').textContent = data.vehicle?.color || 'N/A';
        document.getElementById('display-vehicle-vin').textContent = data.vehicle?.chassisNumber || '--';
        
        const trimSection = document.getElementById('trim-characteristics-section');
        const trimGrid = document.getElementById('trim-characteristics-grid');
        const trimRemarks = document.getElementById('trim-remarks');
        
        if (data.vehicle && data.vehicle.trimCharacteristics) {
            const c = data.vehicle.trimCharacteristics;
            trimSection.style.display = 'block';
            trimGrid.innerHTML = `
                <div>Moteur: <strong style="color: #fff;">${c.engine || 'N/A'}</strong></div>
                <div>Boîte: <strong style="color: #fff;">${c.gearbox || 'N/A'}</strong></div>
                <div>Turbo: <strong style="color: #fff;">${c.turbo || 'N/A'}</strong></div>
                <div>Caméra: <strong style="color: #fff;">${c.camera || 'N/A'}</strong></div>
                <div>Sièges élec.: <strong style="color: #fff;">${c.electricSeats || 'N/A'}</strong></div>
                <div>Malle élec.: <strong style="color: #fff;">${c.electricTrunk || 'N/A'}</strong></div>
                <div>Toit: <strong style="color: #fff;">${c.roof || 'N/A'}</strong></div>
                <div>Roue secours: <strong style="color: #fff;">${c.spareWheel || 'N/A'}</strong></div>
                <div>Keyless: <strong style="color: #fff;">${c.keyless || 'N/A'}</strong></div>
                <div>Start & Stop: <strong style="color: #fff;">${c.startStop || 'N/A'}</strong></div>
            `;
            if (c.remarks) {
                trimRemarks.style.display = 'block';
                trimRemarks.innerHTML = `<i class="fas fa-comment-alt"></i> Remarques: ${c.remarks}`;
            } else {
                trimRemarks.style.display = 'none';
            }
        } else {
            if (trimSection) trimSection.style.display = 'none';
        }
        
        // Shipment Info
        document.getElementById('display-shipment-date').textContent = data.shipmentDate ? formatDate(data.shipmentDate) : 'En attente';
        
        const shipment = data.shipment;
        if (shipment) {
            document.getElementById('display-loading-port').textContent = shipment.loadingPort || 'N/A';
            document.getElementById('display-destination').textContent = shipment.destination || 'N/A';
            document.getElementById('display-etd').textContent = shipment.etd ? formatDate(shipment.etd) : 'En attente';
            document.getElementById('display-eta').textContent = shipment.eta ? formatDate(shipment.eta) : 'En attente';
            document.getElementById('display-forwarder').textContent = shipment.forwarder || 'N/A';
            document.getElementById('display-container-number').textContent = shipment.containerNumber || 'N/A';
            document.getElementById('display-bl-number').textContent = shipment.blNumber || 'N/A';
            
            document.getElementById('map-section').style.display = 'block';
            document.getElementById('no-shipment-msg').style.display = 'none';

            // Carte : Leaflet remplace l'ancien embed Google (ferme par Google -> "API key required")
            if (shipment.currentLat && shipment.currentLng) {
                document.getElementById('display-current-location').textContent = `Lat: ${shipment.currentLat}, Lng: ${shipment.currentLng}`;
            } else {
                document.getElementById('display-current-location').textContent = shipment.status || 'En transit';
            }
            afficherCarte(shipment, data);
        } else {
            document.getElementById('display-destination').textContent = 'En attente';
            document.getElementById('display-eta').textContent = 'En attente';
            document.getElementById('map-section').style.display = 'none';
            document.getElementById('no-shipment-msg').style.display = 'block';
        }

        // Documents section (BL)
        if (data.vehicle && data.vehicle.blLink) {
            const docSection = document.getElementById('document-section');
            const blBtn = document.getElementById('bl-link-btn');
            docSection.style.display = 'block';
            blBtn.href = data.vehicle.blLink;
        } else {
            document.getElementById('document-section').style.display = 'none';
        }

        // Video section
        if (data.vehicle && data.vehicle.videoLink) {
            const videoSection = document.getElementById('video-section');
            const videoBtn = document.getElementById('video-link-btn');
            videoSection.style.display = 'block';
            videoBtn.href = data.vehicle.videoLink;
        } else {
            document.getElementById('video-section').style.display = 'none';
        }

        // Stepper Logic
        updateStepper(data.orderStatus, shipment?.status);
    }

    // --- Carte de suivi (Leaflet) ---------------------------------------
    // L'ancien embed <iframe src="maps.google.com/...output=embed"> a ete
    // ferme par Google et affichait "API key required" : on dessine
    // desormais la carte nous-memes avec les tuiles CARTO.

    // Repli quand le suivi ne renvoie pas encore de coordonnees GPS :
    // on centre sur le port connu le plus proche du libelle.
    const PORTS_CONNUS = {
        'shanghai': [31.23, 121.49], 'ningbo': [29.87, 121.55], 'nansha': [22.79, 113.61],
        'guangzhou': [23.10, 113.42], 'shekou': [22.48, 113.90], 'shenzhen': [22.55, 114.05],
        'yantian': [22.58, 114.27], 'qingdao': [36.07, 120.38], 'tianjin': [38.98, 117.75],
        'xingang': [38.98, 117.75], 'dalian': [38.93, 121.63], 'lianyungang': [34.75, 119.45],
        'yantai': [37.54, 121.39], 'xiamen': [24.48, 118.09], 'hong kong': [22.32, 114.17],
        'busan': [35.10, 129.04], 'incheon': [37.46, 126.62], 'pyeongtaek': [36.97, 126.82],
        'masan': [35.19, 128.58], 'singapore': [1.26, 103.83], 'port klang': [3.00, 101.39],
        'jebel ali': [25.01, 55.06], 'dubai': [25.27, 55.30], 'jeddah': [21.48, 39.18],
        'port said': [31.26, 32.30], 'damietta': [31.46, 31.81], 'suez': [29.97, 32.55],
        'piraeus': [37.94, 23.64], 'valencia': [39.44, -0.32], 'barcelona': [41.35, 2.16],
        'genoa': [44.40, 8.92], 'genes': [44.40, 8.92], 'marseille': [43.30, 5.37],
        'malta': [35.89, 14.51], 'marsaxlokk': [35.83, 14.54], 'tanger': [35.88, -5.51],
        'tanger med': [35.88, -5.51], 'casablanca': [33.60, -7.62], 'tunis': [36.82, 10.30],
        'rades': [36.79, 10.28], 'alger': [36.77, 3.07], 'algiers': [36.77, 3.07],
        'skikda': [36.89, 6.91], 'annaba': [36.90, 7.77], 'oran': [35.71, -0.64],
        'bejaia': [36.76, 5.09], 'mostaganem': [35.94, 0.09], 'djen djen': [36.83, 5.88],
        'jijel': [36.83, 5.88], 'ghazaouet': [35.10, -1.86], 'tenes': [36.52, 1.32],
        'arzew': [35.85, -0.29], 'dakar': [14.72, -17.47]
    };

    function positionPort(libelle) {
        if (!libelle) return null;
        const cle = String(libelle).toLowerCase();
        for (const nom in PORTS_CONNUS) {
            if (cle.includes(nom)) return PORTS_CONNUS[nom];
        }
        return null;
    }

    function echapper(valeur) {
        return String(valeur == null ? '' : valeur)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Contenu de l'infobulle : conteneur + vehicule + client
    function contenuInfobulle(shipment, data) {
        const v = data.vehicle || {};
        const vehicule = [v.brand, v.model, v.year].filter(Boolean).join(' ');
        const lignes = [];
        const ajouter = (etiquette, valeur) => {
            if (valeur) lignes.push(`<div style="display:flex;gap:8px;"><span style="color:#94a3b8;min-width:82px;">${etiquette}</span><strong>${echapper(valeur)}</strong></div>`);
        };
        ajouter('Conteneur', shipment.containerNumber);
        ajouter('BL', shipment.blNumber);
        ajouter('Navire', shipment.shipStatus || shipment.vesselName);
        ajouter('Vehicule', vehicule);
        ajouter('Chassis', v.chassisNumber);
        ajouter('Client', data.clientName);
        ajouter('Commande', data.orderId);
        ajouter('Depart', shipment.loadingPort);
        ajouter('Arrivee', shipment.destination);
        return `<div style="font-family:'Outfit',sans-serif;font-size:0.82rem;line-height:1.65;color:#f8fafc;min-width:210px;">${lignes.join('') || 'Expedition en cours'}</div>`;
    }

    let carteSuivi = null;

    function afficherCarte(shipment, data) {
        const conteneur = document.getElementById('tracking-map');
        if (!conteneur || typeof L === 'undefined') return;

        const aGps = shipment.currentLat && shipment.currentLng;
        const repli = positionPort(shipment.loadingPort) || positionPort(shipment.destination);
        const lat = aGps ? parseFloat(shipment.currentLat) : (repli ? repli[0] : 20);
        const lng = aGps ? parseFloat(shipment.currentLng) : (repli ? repli[1] : 20);
        const zoom = aGps ? 5 : (repli ? 4 : 2);

        // La carte n'est creee qu'une fois : les recherches suivantes la repositionnent.
        if (carteSuivi) {
            carteSuivi.remove();
            carteSuivi = null;
        }

        carteSuivi = L.map('tracking-map', { scrollWheelZoom: false }).setView([lat, lng], zoom);

        // CARTO exige desormais une cle d'API et tamponne ses tuiles gratuites du
        // message « API KEY REQUIRED » : fond sombre Esri (sans cle), avec repli OSM.
        const fond = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
            attribution: '&copy; Esri, HERE, Garmin, &copy; OpenStreetMap',
            maxZoom: 16
        });
        let bascule = false;
        fond.on('tileerror', () => {
            if (bascule) return;
            bascule = true;
            carteSuivi.removeLayer(fond);
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap',
                maxZoom: 19
            }).addTo(carteSuivi);
        });
        fond.addTo(carteSuivi);

        if (aGps || repli) {
            const icone = L.divIcon({
                html: '<i class="fas fa-ship" style="font-size:22px;color:#4ade80;text-shadow:0 0 10px rgba(74,222,128,.6);"></i>',
                className: 'marqueur-navire',
                iconSize: [22, 22],
                iconAnchor: [11, 11]
            });
            const infobulle = contenuInfobulle(shipment, data);
            const marqueur = L.marker([lat, lng], { icon: icone })
                .addTo(carteSuivi)
                .bindTooltip(infobulle, { direction: 'top', offset: [0, -14], opacity: 0.97 })
                .bindPopup(infobulle, { maxWidth: 260 });

            // Sur telephone la bulle couvrirait toute la carte : on la laisse au clic.
            if (window.innerWidth >= 768) marqueur.openPopup();
        }

        // Le conteneur vient d'etre affiche : Leaflet doit remesurer.
        setTimeout(() => carteSuivi && carteSuivi.invalidateSize(), 200);
    }

    function updateStepper(orderStatus, shipmentStatus) {
        const steps = [
            document.getElementById('step-1'),
            document.getElementById('step-2'),
            document.getElementById('step-3'),
            document.getElementById('step-4'),
            document.getElementById('step-5')
        ];
        const progressBar = document.getElementById('step-progress-bar');
        
        // Reset
        steps.forEach(s => {
            s.classList.remove('active', 'completed');
        });

        let currentStep = 0;

        // Logic based on status strings
        if (orderStatus === 'Validated' || orderStatus === 'Paid') {
            currentStep = 1;
            steps[0].classList.add('completed');
            steps[1].classList.add('active');
        }

        if (shipmentStatus) {
            const s = shipmentStatus.toLowerCase();
            
            // Step 2: Chargement
            currentStep = 2;
            steps[0].classList.add('completed');
            steps[1].classList.add('completed');
            steps[2].classList.add('active');

            // Step 3: En mer
            if (s.includes('mer') || s.includes('transit') || s.includes('shipped')) {
                currentStep = 3;
                steps[0].classList.add('completed');
                steps[1].classList.add('completed');
                steps[2].classList.add('completed');
                steps[3].classList.add('active');
            }
            // Step 4: Arrivée Port
            if (s.includes('arriv') || s.includes('port')) {
                currentStep = 4;
                steps[0].classList.add('completed');
                steps[1].classList.add('completed');
                steps[2].classList.add('completed');
                steps[3].classList.add('completed');
                steps[4].classList.add('active');
            }
        }

        if (orderStatus === 'Delivered') {
            currentStep = 5;
            steps.forEach(s => s.classList.add('completed'));
        }

        // Progress bar width
        const widths = ['0%', '12.5%', '37.5%', '62.5%', '87.5%', '100%'];
        progressBar.style.width = widths[currentStep];
    }
});
