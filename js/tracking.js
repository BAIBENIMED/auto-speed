document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('tracking-form');
    const input = document.getElementById('order-id-input');
    const content = document.getElementById('tracking-content');
    const errorMsg = document.getElementById('error-message');
    const btn = form.querySelector('button');
    const btnText = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.loader');

    // Auto-track if ID is in URL
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('id') || urlParams.get('orderId');
    if (orderId) {
        input.value = orderId;
        performTracking(orderId);
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = input.value.trim();
        if (id) performTracking(id);
    });

    async function performTracking(id) {
        // UI State: Loading
        errorMsg.style.display = 'none';
        btn.disabled = true;
        btnText.style.display = 'none';
        loader.style.display = 'block';

        try {
            const response = await fetch(`/api/public/track?id=${encodeURIComponent(id)}`);
            const result = await response.json();

            if (result.success) {
                updateUI(result.data);
                content.style.display = 'block';
                // Update URL without reloading
                window.history.pushState({}, '', `?id=${encodeURIComponent(id)}`);
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
        
        const vehicleName = data.vehicle ? `${data.vehicle.brand} ${data.vehicle.model || ''} ${data.vehicle.year || ''}` : 'Véhicule en attente';
        document.getElementById('display-vehicle-name').textContent = vehicleName;
        document.getElementById('display-vehicle-color').textContent = data.vehicle?.color || 'N/A';
        
        // Shipment Info
        const shipment = data.shipment;
        if (shipment) {
            document.getElementById('display-destination').textContent = shipment.destination || 'N/A';
            document.getElementById('display-eta').textContent = shipment.eta ? new Date(shipment.eta).toLocaleDateString() : 'En attente';
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

        // Stepper Logic
        updateStepper(data.orderStatus, shipment?.status);
    }

    function updateStepper(orderStatus, shipmentStatus) {
        const steps = [
            document.getElementById('step-1'),
            document.getElementById('step-2'),
            document.getElementById('step-3'),
            document.getElementById('step-4')
        ];
        const progressBar = document.getElementById('step-progress-bar');
        
        // Reset
        steps.forEach(s => {
            s.classList.remove('active', 'completed');
        });

        let currentStep = 0;

        // Logic based on status strings (simplified)
        if (orderStatus === 'Validated' || orderStatus === 'Paid') {
            currentStep = 1;
            steps[0].classList.add('completed');
            steps[1].classList.add('active');
        }

        if (shipmentStatus) {
            const s = shipmentStatus.toLowerCase();
            if (s.includes('mer') || s.includes('transit') || s.includes('shipped')) {
                currentStep = 2;
                steps[0].classList.add('completed');
                steps[1].classList.add('completed');
                steps[2].classList.add('active');
            }
            if (s.includes('arriv') || s.includes('port')) {
                currentStep = 3;
                steps[0].classList.add('completed');
                steps[1].classList.add('completed');
                steps[2].classList.add('completed');
                steps[3].classList.add('active');
            }
        }

        if (orderStatus === 'Delivered') {
            currentStep = 4;
            steps.forEach(s => s.classList.add('completed'));
        }

        // Progress bar width
        const widths = ['0%', '16.6%', '50%', '83.3%', '100%'];
        progressBar.style.width = widths[currentStep];
    }
});
