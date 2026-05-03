document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('tracking-form');
    const input = document.getElementById('order-id-input');
    const content = document.getElementById('tracking-content');
    const errorMsg = document.getElementById('error-message');
    const btn = form.querySelector('button');
    const btnText = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.loader');

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
        document.getElementById('display-order-date').textContent = `Validée le ${new Date(data.orderDate).toLocaleDateString()}`;
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
        document.getElementById('display-shipment-date').textContent = data.shipmentDate ? new Date(data.shipmentDate).toLocaleDateString() : 'En attente';
        
        const shipment = data.shipment;
        if (shipment) {
            document.getElementById('display-loading-port').textContent = shipment.loadingPort || 'N/A';
            document.getElementById('display-destination').textContent = shipment.destination || 'N/A';
            document.getElementById('display-etd').textContent = shipment.etd ? new Date(shipment.etd).toLocaleDateString() : 'En attente';
            document.getElementById('display-eta').textContent = shipment.eta ? new Date(shipment.eta).toLocaleDateString() : 'En attente';
            document.getElementById('display-forwarder').textContent = shipment.forwarder || 'N/A';
            document.getElementById('display-container-number').textContent = shipment.containerNumber || 'N/A';
            document.getElementById('display-bl-number').textContent = shipment.blNumber || 'N/A';
            
            document.getElementById('map-section').style.display = 'block';
            document.getElementById('no-shipment-msg').style.display = 'none';

            // Map update
            if (shipment.currentLat && shipment.currentLng) {
                const locationQuery = `${shipment.currentLat},${shipment.currentLng}`;
                document.getElementById('tracking-iframe').src = `https://maps.google.com/maps?q=${encodeURIComponent(locationQuery)}&t=&z=6&ie=UTF8&iwloc=&output=embed`;
                document.getElementById('display-current-location').textContent = `Lat: ${shipment.currentLat}, Lng: ${shipment.currentLng}`;
            } else {
                const locationQuery = shipment.loadingPort || 'Dakar';
                document.getElementById('tracking-iframe').src = `https://maps.google.com/maps?q=${encodeURIComponent(locationQuery)}&t=&z=4&ie=UTF8&iwloc=&output=embed`;
                document.getElementById('display-current-location').textContent = shipment.status || 'En transit';
            }
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
