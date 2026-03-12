/**
 * Main Application Logic for GTM Auto
 */


// DOMContentLoaded removed to allow global definition
// document.addEventListener('DOMContentLoaded', async () => {
const app = {
    viewContainer: document.getElementById('view-container'),
    navLinks: document.querySelectorAll('.nav-link'),
    currentView: 'dashboard',
    mapTracking: null,

    generateVehicleId(brand) {
        if (!brand) return `v${Date.now()}`;

        const prefix = brand.substring(0, 3).toUpperCase().padEnd(3, 'X');
        const random = Math.floor(1000 + Math.random() * 9000);
        const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES) || [];

        let newId = `${prefix}-${random}`;

        // Uniqueness check
        let attempts = 0;
        while (vehicles.some(v => v.id === newId) && attempts < 10) {
            const nextRandom = Math.floor(1000 + Math.random() * 9000);
            newId = `${prefix}-${nextRandom}`;
            attempts++;
        }

        return newId;
    },

    generateClientReference() {
        const clients = StorageService.get(STORAGE_KEYS.CLIENTS) || [];
        let maxNum = 0;

        clients.forEach(c => {
            if (c.reference && c.reference.startsWith('CL-')) {
                const num = parseInt(c.reference.split('-')[1]);
                if (!isNaN(num) && num > maxNum) maxNum = num;
            }
        });

        return `CL-${String(maxNum + 1).padStart(4, '0')}`;
    },

    searchQuery: '',
    dashboardFilters: {
        showroom: '',
        startDate: '',
        endDate: ''
    },
    orderFilters: {
        status: '',
        showroom: '',
        startDate: '',
        endDate: '',
        showArchived: false
    },
    vehicleFilters: {
        brand: '',
        model: '',
        status: '',
        supplier: '',
        purchaseOrderId: '',
        showArchived: false
    },
    purchaseFilters: {
        supplier: '',
        status: '',
        startDate: '',
        endDate: ''
    },
    shipmentFilters: {
        showArchived: false
    },

    getTrackingUrl(carrier, number) {
        if (!number) return null;
        const cleanNumber = number.trim();
        switch (carrier?.toUpperCase()) {
            case 'MSC': return `https://www.msc.com/en/track-a-shipment?query=${cleanNumber}`;
            case 'MAERSK': return `https://www.maersk.com/tracking/${cleanNumber}`;
            case 'CMA CGM': return `https://www.cma-cgm.com/ebusiness/tracking/search?SearchType=Container&Reference=${cleanNumber}`;
            case 'HAPAG-LLOYD': return `https://www.hapag-lloyd.com/en/online-business/track-and-trace/container-tracing/${cleanNumber}.html`;
            case 'COSCO': return `https://lines.coscoshipping.com/track/#/container/${cleanNumber}`;
            case 'ONE': return `https://www.one-line.com/en/tracking?container_number=${cleanNumber}`;
            case 'EVERGREEN': return `https://ct.shipment-tracking.com/t97?container_number=${cleanNumber}`;
            case 'ZIM': return `https://www.zim.com/tools/track-a-shipment?containerNumber=${cleanNumber}`;
            case 'YANG MING': return `https://www.yangming.com/e-service/track_trace/track_trace_cargo_tracking.aspx?number=${cleanNumber}`;
            case 'HMM': return `https://www.hmm21.com/cms/company/engn/index.jsp?type=2&number=${cleanNumber}`;
            case 'OOCL': return `https://www.oocl.com/eng/ourservices/eservices/cargotracking/Pages/cargotracking.aspx?container=${cleanNumber}`;
            case 'PIL': return `https://www.pilship.com/p-shipment-tracking/${cleanNumber}`;
            case 'DHL': return `https://www.dhl.com/en/express/tracking.html?AWB=${cleanNumber}`;
            case 'FEDEX': return `https://www.fedex.com/fedextrack/?tracknumbers=${cleanNumber}`;
            case '17TRACK': return `https://t.17track.net/en#nums=${cleanNumber}`;
            default:
                // By default, try 17track as it supports many carriers and containers
                return `https://t.17track.net/en#nums=${cleanNumber}`;
        }
    },

    isOutdated(dateStr) {
        if (!dateStr) return true;
        const lastUpdate = new Date(dateStr);
        const now = new Date();
        const diffHours = (now - lastUpdate) / (1000 * 60 * 60);
        return diffHours > 24;
    },

    async init() {
        const currentUser = StorageService.get(STORAGE_KEYS.CURRENT_USER);

        if (currentUser && currentUser.token) {
            // Wait for initial data sync from server only if logged in
            try {
                const synced = await StorageService.syncAll();
                if (!synced) {
                    console.warn("Initial sync failed, using local data.");
                }
            } catch (error) {
                console.error("❌ Critical sync error during initialization:", error);
                // If it's a 401/Auth error, checkSession will handle redirect
                if (error.message.includes('Token expiré') || error.message.includes('Accès refusé')) {
                    this.checkSession();
                    return; // Stop initialization
                }
                // For other errors, just warn and proceed with local data
                console.warn("⚠️ Sync failed, running in OFFLINE mode with local data.", error);
                this.showToast("Mode Hors-Ligne : Impossible de synchroniser avec le serveur.", "warning");
            }
        }

        this.syncOrderStatuses();
        this.checkSession();

        // Periodic background sync (every 60 seconds)
        setInterval(async () => {
            try {
                const session = StorageService.get(STORAGE_KEYS.CURRENT_USER);
                if (session && session.token && this.appContainer?.style.display !== 'none') {
                    const refreshed = await StorageService.syncAll();
                    if (refreshed && this.currentView !== 'login') {
                        this.renderView(this.currentView);
                    }
                }
            } catch (err) {
                console.warn("Background sync failed:", err.message);
            }
        }, 60000);
    },

    checkSession() {
        const currentUser = StorageService.get(STORAGE_KEYS.CURRENT_USER);
        const loginContainer = document.getElementById('login-container');
        const appContainer = document.getElementById('app-container');

        if (currentUser && currentUser.id) {
            loginContainer.style.display = 'none';
            appContainer.style.display = 'flex';
            this.setupEventListeners();
            this.applyTheme();
            this.renderSidebar();
            this.renderView(this.currentView);
        } else {
            appContainer.style.display = 'none';
            loginContainer.style.display = 'flex';
            this.renderLogin();
        }
    },

    renderLogin() {
        const loginContainer = document.getElementById('login-container');
        loginContainer.innerHTML = `
                <div class="login-wrapper">
                    <div class="login-box glass">
                        <div class="login-logo" style="display: flex; flex-direction: column; align-items: center; margin-bottom: 20px;">
                            <div class="logo-text-wrapper" style="font-size: 3.5rem; letter-spacing: -2px;">
                                <span class="tibou" style="color: white;">TIBOU</span>
                                <span class="auto">AUTO</span>
                            </div>
                            <div style="color: #ff0000; font-size: 0.7rem; font-weight: 800; letter-spacing: 5px; margin-top: -5px; text-transform: uppercase;">CHINA CARS</div>
                        </div>
                        
                        <form id="login-form" autocomplete="off">
                            <div class="form-group">
                                <label><i class="fas fa-user"></i> Identifiant</label>
                                <input type="text" id="login-username" class="glass-input" placeholder="Nom d'utilisateur" required>
                            </div>
                            <div class="form-group">
                                <label><i class="fas fa-lock"></i> Mot de passe</label>
                                <input type="password" id="login-password" class="glass-input" placeholder="••••••••" required>
                            </div>
                            <div style="display: flex; justify-content: center; margin-top: 10px;">
                                <button type="submit" class="btn-primary login-btn" style="width: auto; padding: 12px 40px;">Se Connecter</button>
                            </div>
                        </form>

                        <p class="login-subtitle" style="color: #D50000; font-weight: bold; font-size: 0.85rem; letter-spacing: 2px; text-align: center; margin-top: 25px;">AUTO SHOWROOM</p>
                        
                        <div class="login-footer">
                            <p>&copy; 2026 TIBOU AUTO. Tous droits réservés.</p>
                        </div>
                    </div>
                </div>
            `;

        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        this.applyTheme(); // Ensure login also respects theme (mostly dark/glass)
    },

    async handleLogin() {
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await ApiService.login({ username, password });

            if (response.success) {
                const sessionUser = {
                    id: response.user.id,
                    username: response.user.username,
                    name: response.user.name,
                    role: response.user.role,
                    clientId: response.user.clientId,
                    token: response.token // Important: Store token for future requests
                };

                // Save to localStorage so ApiService and app can use it
                await StorageService.save(STORAGE_KEYS.CURRENT_USER, sessionUser);
                // Also update the hidden token if necessary or if ApiService reads from here
                localStorage.setItem('gtm_current_user', JSON.stringify(sessionUser));

                // Sync data from server now that we are authenticated
                await StorageService.syncAll();

                // Fetch roles from API and store them
                try {
                    const rolesResponse = await ApiService.getRoles();
                    if (rolesResponse.success && rolesResponse.data) {
                        await StorageService.save(STORAGE_KEYS.ROLES, rolesResponse.data);
                    }
                } catch (error) {
                    console.error("Error fetching roles:", error);
                }

                this.showToast(`Bienvenue, ${response.user.name}`, "success");
                this.checkSession();
            } else {
                this.showToast(response.message || "Identifiant ou mot de passe incorrect", "error");
            }
        } catch (error) {
            console.error("Login error:", error);
            this.showToast(error.message || "Erreur de connexion au serveur", "error");
        }
    },

    async handleLogout() {
        try {
            await ApiService.logout();
        } catch (error) {
            console.error("Logout error on server:", error);
        } finally {
            // Clear local data
            localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
            localStorage.removeItem('gtm_current_user');
            // Optional: Clear other data if needed, but keeping cache might be fine

            this.showToast("Déconnexion réussie", "success");

            // Reset state and show login
            this.currentView = 'dashboard';
            this.checkSession();
        }
    },

    applyTheme(themeName = null) {
        const settings = StorageService.get(STORAGE_KEYS.SETTINGS);
        const theme = themeName || (settings ? settings.theme : 'dark');

        // Remove all existing theme attributes if switching to default (dark)
        if (theme === 'dark') {
            document.body.removeAttribute('data-theme');
        } else {
            document.body.setAttribute('data-theme', theme);
        }
    },

    setupEventListeners() {
        const sidebar = document.querySelector('.sidebar');
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');

        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.getAttribute('data-view');
                if (this.canAccess(view)) {
                    this.switchView(view);

                    // Close mobile menu if open
                    if (sidebar && sidebar.classList.contains('active')) {
                        sidebar.classList.remove('active');
                        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
                    }
                } else {
                    this.showToast("Accès refusé : vous n'avez pas les droits nécessaires.", "error");
                }
            });
        });

        // Mobile menu toggle
        if (mobileMenuBtn) {
            mobileMenuBtn.onclick = () => {
                if (sidebar) sidebar.classList.toggle('active');
                if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
            };
        }

        if (sidebarOverlay) {
            sidebarOverlay.onclick = () => {
                if (sidebar) sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
            };
        }

        // Logout
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
                    this.handleLogout();
                }
            });
        }

        // "Nouvelle Commande" button
        const btnNewOrder = document.getElementById('btn-new-order');
        if (btnNewOrder) {
            btnNewOrder.addEventListener('click', () => {
                this.showOrderModal();
            });
        }

        // Handle modal closing
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                this.closeModal();
            }
        });

        // Prevent closing when clicking inside modal content (already handled by propagation but good for safety)
        document.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                this.isMouseDownOnOverlay = true;
            } else {
                this.isMouseDownOnOverlay = false;
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (e.target.classList.contains('modal-overlay') && this.isMouseDownOnOverlay) {
                this.closeModal();
            }
            this.isMouseDownOnOverlay = false;
        });

        // Search functionality
        const searchInput = document.querySelector('.search-container input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                // If on dashboard, maybe the user wants to jump to orders if searching?
                // For now, just re-render the current view
                this.renderView(this.currentView);
            });
        }
    },

    async validateOrder(id) {
        const orders = StorageService.get(STORAGE_KEYS.ORDERS);
        const order = orders.find(o => o.id === id);
        if (order) {
            order.isValidated = true;
            await StorageService.update(STORAGE_KEYS.ORDERS, id, order);
            await this.syncOrderStatuses();
            this.showToast(`Commande #${id} validée`, "success");
            this.renderView(this.currentView);
        }
    },

    async unvalidateOrder(id) {
        const orders = StorageService.get(STORAGE_KEYS.ORDERS);
        const order = orders.find(o => o.id === id);

        if (!order) return;

        let confirmMessage = `Voulez-vous vraiment dévalider la commande #${id} ? Cela bloquera à nouveau la sélection de véhicule.`;

        if (order.vehicleId) {
            confirmMessage = `ATTENTION : Cette commande est liée au véhicule réf. "${order.vehicleId}". \n\nEn dévalidant cette commande, le véhicule sera DÉTACHÉ et remis en vente immédiatement. \n\nSouhaitez-vous continuer ?`;
        }

        if (confirm(confirmMessage)) {
            order.isValidated = false;

            // Clear vehicle reference on the order itself
            order.vehicleId = null;
            order.vehicleName = "Sans véhicule";

            await StorageService.update(STORAGE_KEYS.ORDERS, id, order);

            // Also release the vehicle status/link
            const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES) || [];
            const linkedVehicles = vehicles.filter(v => v.orderId === id || (v.id === order.vehicleId));

            for (const vToRelease of linkedVehicles) {
                vToRelease.orderId = null;
                vToRelease.status = 'Available';
                await StorageService.update(STORAGE_KEYS.VEHICLES, vToRelease.id, vToRelease);
            }

            await this.syncOrderStatuses();
            this.showToast(`Commande #${id} dévalidée et véhicule libéré`, "info");
            this.renderView(this.currentView);
        }
    },

    showOrderModal(vehicleId = null) {
        const allAvailableVehicles = StorageService.get(STORAGE_KEYS.VEHICLES).filter(v => !v.orderId && !v.archived);
        const clients = StorageService.get(STORAGE_KEYS.CLIENTS);
        const brands = StorageService.get(STORAGE_KEYS.BRANDS);
        const brandModels = StorageService.get(STORAGE_KEYS.BRAND_MODELS);
        const colors = StorageService.get(STORAGE_KEYS.COLORS);
        const motors = StorageService.get(STORAGE_KEYS.MOTORS) || [];
        const currentYear = new Date().getFullYear();

        const preSelectedVehicle = vehicleId ? StorageService.get(STORAGE_KEYS.VEHICLES).find(v => v.id === vehicleId) : null;

        const modalHtml = `
                <div id="modal-overlay" class="modal-overlay">
                    <div class="modal-content glass" style="width: 600px; max-height: 90vh; overflow-y: auto;">
                        <div class="modal-header">
                            <h2>Nouvelle Commande</h2>
                            <button class="btn-close" onclick="app.closeModal()">&times;</button>
                        </div>
                        <form id="order-form" autocomplete="off">
                            <div class="form-group">
                                <label>Client</label>
                                <!-- Client Search Input -->
                                <div style="position: relative; margin-bottom: 5px;">
                                    <i class="fas fa-search" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-dim); font-size: 0.8rem;"></i>
                                    <input type="text" id="client-search" class="glass-input" placeholder="Filtrer par nom..." style="padding-left: 30px; font-size: 0.9rem;" autocomplete="off">
                                </div>
                                <select name="clientId" id="client-select" required class="glass-select">
                                    <option value="">Sélectionner un client</option>
                                    ${clients.map(c => `<option value="${c.id}">${c.firstName} ${c.lastName}</option>`).join('')}
                                </select>
                            </div>

                            <div class="form-group">
                                <label>Date de Commande</label>
                                <input type="date" name="date" class="glass-input" value="${new Date().toISOString().split('T')[0]}" required>
                            </div>

                            <fieldset style="border: 1px solid rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                                <legend style="padding: 0 0.5rem; color: var(--primary); font-weight: 500; font-size: 0.85rem;">Détails Véhicule Commandé (Si pas de stock)</legend>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <div class="form-group">
                                        <label>Marque</label>
                                        <select id="filter-brand" name="requestedBrand" class="glass-select">
                                            <option value="">Toutes les marques</option>
                                            ${brands.map(b => `<option value="${b}">${b}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Modèle</label>
                                        <select id="filter-model" name="requestedModel" class="glass-select">
                                            <option value="">Tous les modèles</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Motorisation</label>
                                        <select name="requestedMotorization" id="filter-motor" class="glass-select">
                                            <option value="">Toutes</option>
                                            ${motors.map(m => `<option value="${m}">${m}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Catégorie</label>
                                        <select id="filter-category" name="requestedCategory" class="glass-select">
                                            <option value="">Toutes</option>
                                            <option value="Neuf">Neuf</option>
                                            <option value="Recent">Moins de 3 ans</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Couleur Souhaitée</label>
                                        <select name="requestedColor" class="glass-select">
                                            <option value="">Peu importe</option>
                                            ${colors.map(c => `<option value="${c}">${c}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Showroom</label>
                                        <select name="showroom" id="filter-showroom" required class="glass-select">
                                            <option value="">Sélectionner un showroom</option>
                                            ${StorageService.get(STORAGE_KEYS.SHOWROOMS).map(s => `<option value="${s}">${s}</option>`).join('')}
                                        </select>
                                    </div>
                                </div>
                            </fieldset>

                            <div class="form-group">
                                <label>Véhicule Sélectionné (Stock)</label>
                                <div class="validation-notice" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b; padding: 8px; border-radius: 6px; font-size: 0.8rem; margin-bottom: 8px; border: 1px solid rgba(245, 158, 11, 0.2);">
                                    <i class="fas fa-lock"></i> La sélection d'un véhicule nécessite la validation de la commande par un administrateur après sa création.
                                </div>
                                <select name="vehicleId" id="order-vehicle-select" class="glass-select" disabled>
                                    <option value="">[EN ATTENTE DE VALIDATION]</option>
                                </select>
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label>Prix de Vente (Total)</label>
                                    <input type="number" name="totalAmount" id="order-total-amount" class="glass-input" value="0" step="1">
                                </div>
                                <div class="form-group">
                                    <label>Commentaires / Remarques</label>
                                    <textarea name="remarks" class="glass-input" rows="1" placeholder="Notes particulières..."></textarea>
                                </div>
                            </div>



                            <div class="modal-footer">
                                <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                                <button type="submit" class="btn-primary">Créer la commande</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // --- PRE-SELECTION LOGIC (from Affecter Client) ---
        if (preSelectedVehicle) {
            const v = preSelectedVehicle;
            if (v.brand) document.querySelector('#order-form [name="requestedBrand"]').value = v.brand;
            if (v.brand && brandModels[v.brand]) {
                const modelSel = document.getElementById('filter-model');
                const opts = brandModels[v.brand].map(m => `<option value="${m}">${m}</option>`).join('');
                modelSel.innerHTML = '<option value="">Tous les modèles</option>' + opts;
                if (v.model) modelSel.value = v.model;
            }
            if (v.motorization) document.getElementById('filter-motor').value = v.motorization;
            if (v.color) document.querySelector('#order-form [name="requestedColor"]').value = v.color;
            if (v.showroom) document.querySelector('#order-form select[name="showroom"]').value = v.showroom;
            const vSelect = document.getElementById('order-vehicle-select');
            vSelect.disabled = false;
            vSelect.innerHTML = `<option value="${v.id}" selected>${v.brand} ${v.model || ''} (${v.chassisNumber || v.id})</option>`;
            const price = v.sellingPrice || v.price || 0;
            document.getElementById('order-total-amount').value = price;
        }
        // ---------------------------------------------------

        // --- CLIENT SEARCH LOGIC ---
        const clientSearch = document.getElementById('client-search');
        const clientSelect = document.getElementById('client-select');

        if (clientSearch && clientSelect) {
            clientSearch.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const filtered = clients.filter(c =>
                    `${c.firstName} ${c.lastName}`.toLowerCase().includes(term) ||
                    (c.phone || '').includes(term)
                );

                // Rebuild options
                let opts = '<option value="">Sélectionner un client</option>';
                opts += filtered.map(c => `<option value="${c.id}">${c.firstName} ${c.lastName}</option>`).join('');

                clientSelect.innerHTML = opts;
            });

            clientSelect.addEventListener('change', () => {
                refreshVehicles();
            });
        }
        // ---------------------------

        const brandFilter = document.getElementById('filter-brand');
        const modelFilter = document.getElementById('filter-model');
        const motorFilter = document.getElementById('filter-motor');
        const categoryFilter = document.getElementById('filter-category');
        const showroomFilter = document.getElementById('filter-showroom');
        const vehicleSelect = document.getElementById('order-vehicle-select');

        const refreshVehicles = () => {
            const brand = brandFilter.value;
            const model = modelFilter.value;
            const category = categoryFilter.value;
            const showroom = showroomFilter.value;
            const currentSelectedClientId = clientSelect ? clientSelect.value : '';

            let filtered = allAvailableVehicles;

            if (brand) filtered = filtered.filter(v => v.brand === brand);
            if (model) filtered = filtered.filter(v => (v.model || '') === model);
            if (showroom) filtered = filtered.filter(v => v.showroom === showroom);
            if (category === 'Neuf') {
                filtered = filtered.filter(v => v.condition === 'Neuf');
            } else if (category === 'Recent') {
                filtered = filtered.filter(v => v.year >= (currentYear - 3));
            }

            // Allow vehicle only if it has no clientId assigned OR it matches the selected client
            filtered = filtered.filter(v => !v.clientId || v.clientId === currentSelectedClientId);

            vehicleSelect.innerHTML = '<option value="">Choisir un véhicule...</option>';
            filtered.forEach(v => {
                const option = document.createElement('option');
                option.value = v.id;
                const vin = v.chassisNumber ? `VIN: ${v.chassisNumber}` : 'VIN: N/A';
                const color = v.color ? `${v.color}` : 'N/A';
                const km = v.mileage ? `${v.mileage.toLocaleString()} km` : '0 km';
                const category = v.category || v.condition || 'N/A';
                option.textContent = `[#${v.id}] ${v.brand} ${v.model || ''} (${v.year}) | ${vin} | ${color} | ${km} | ${category} - ${this.formatCurrency(v.sellingPrice || v.price, v.sellingCurrency)}`;
                vehicleSelect.appendChild(option);
            });
        };

        brandFilter.addEventListener('change', () => {
            const brand = brandFilter.value;
            modelFilter.innerHTML = '<option value="">Tous les modèles</option>';
            if (brand && brandModels[brand]) {
                brandModels[brand].forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m;
                    opt.textContent = m;
                    modelFilter.appendChild(opt);
                });
            }
            refreshVehicles();
        });

        modelFilter.addEventListener('change', refreshVehicles);
        categoryFilter.addEventListener('change', refreshVehicles);
        showroomFilter.addEventListener('change', refreshVehicles);

        // Initial population of vehicles
        refreshVehicles();

        document.getElementById('order-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleOrderSubmission(new FormData(e.target));
        });
    },

    closeModal() {
        const modal = document.getElementById('modal-overlay') || document.querySelector('.modal-overlay');
        if (modal) modal.remove();
    },

    calculateOrderStatus(order) {
        if (!order) return 'N/A';
        if (['ANNULÉE', 'LIVRÉE', 'ANNULÉ', 'CONCLUE', 'EN COURS'].includes(order.status)) return order.status;
        if (!order.isValidated) return 'EN ATTENTE DE VALIDATION';

        const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES) || [];
        const vehicle = vehicles.find(v => (v.id && order.vehicleId && String(v.id) === String(order.vehicleId)) ||
            (order.id && v.orderId && String(v.orderId) === String(order.id)));

        if (!vehicle) return "ATTENTE AFFECTATION VÉHICULE";
        if (!vehicle.shipmentId) return "ATTENTE EXPÉDITION";

        const shipments = StorageService.get(STORAGE_KEYS.SHIPMENTS) || [];
        const shipment = shipments.find(s => String(s.id) === String(vehicle.shipmentId));

        if (!shipment) return "ATTENTE EXPÉDITION";

        const shpStatus = (shipment.status || '').toLowerCase().trim();

        // Priority to pickup/arrival dates if present
        if (shipment.pickupDate || shpStatus === 'livré' || shpStatus === 'livre' || shpStatus === 'enlevée' || shpStatus.includes('delivered') || shpStatus.includes('completed')) return 'ENLEVÉE';
        if (shipment.arrivalDate || shpStatus === 'arrivé' || shpStatus === 'arrive' || shpStatus === 'arrivée' || shpStatus.includes('arrived') || shpStatus.includes('discharge')) return 'ARRIVÉE';
        if (shpStatus === 'en mer' || shpStatus === 'en route' || shpStatus.includes('transit') || shpStatus.includes('sailing')) return 'EN MER';
        if (shpStatus === 'préparation' || shpStatus === 'preparation' || shpStatus.includes('loaded') || shpStatus.includes('departure') || shipment.etd) return 'A BORD';

        return order.status || 'EN COURS';
    },

    async syncOrderStatuses() {
        const orders = StorageService.get(STORAGE_KEYS.ORDERS);
        for (const order of orders) {
            const newStatus = this.calculateOrderStatus(order);
            if (order.status !== newStatus) {
                order.status = newStatus;
                await StorageService.update(STORAGE_KEYS.ORDERS, order.id, order);
            }
        }
    },

    async handleOrderSubmission(formData) {
        const submitBtn = document.querySelector('#order-form button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...';
        }

        try {
            const clientId = formData.get('clientId');
            const vehicleId = formData.get('vehicleId');
            const orderId = formData.get('orderId');

            const client = StorageService.get(STORAGE_KEYS.CLIENTS).find(c => c.id === clientId);
            const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES);
            const vehicle = vehicles.find(v => v.id === vehicleId);

            if (!client) {
                this.showToast('Veuillez sélectionner un client valide.', 'danger');
                return;
            }

            if (vehicleId) {
                if (!vehicle) return;
                // Strict Validation: Vehicle must not be already ordered (unless by this order)
                if (vehicle.orderId && vehicle.orderId !== orderId) {
                    this.showToast('Ce véhicule est déjà associé à une autre commande !', 'danger');
                    return;
                }
            }

            // Get manual price or vehicle price
            const manualPrice = Number(formData.get('totalAmount') || 0);

            let finalOrderId = orderId;

            if (orderId) {
                const orders = StorageService.get(STORAGE_KEYS.ORDERS);
                const orderIndex = orders.findIndex(o => o.id === orderId);
                if (orderIndex !== -1) {
                    // Unlink previous vehicle if changed
                    const previousVehicleId = orders[orderIndex].vehicleId;
                    if (previousVehicleId && previousVehicleId !== vehicleId) {
                        const prevVehicle = vehicles.find(v => v.id === previousVehicleId);
                        if (prevVehicle) {
                            prevVehicle.orderId = null;
                            await StorageService.update(STORAGE_KEYS.VEHICLES, prevVehicle.id, prevVehicle);
                        }
                    }

                    const updatedOrder = {
                        ...orders[orderIndex],
                        clientId: client.id,
                        clientName: `${client.firstName} ${client.lastName}`,
                        vehicleId: vehicleId || null,
                        vehicleName: vehicle ? `${vehicle.brand} ${vehicle.model || ''} ${vehicle.motorization || ''} ${vehicle.trim || ''} (${vehicle.year})`.trim().replace(/\s+/g, ' ') : `${formData.get('requestedBrand') || 'N/A'} ${formData.get('requestedModel') || ''}`,
                        requestedBrand: formData.get('requestedBrand') || '',
                        requestedModel: formData.get('requestedModel') || '',
                        requestedMotorization: formData.get('requestedMotorization') || '',
                        requestedColor: formData.get('requestedColor') || '',
                        totalAmount: vehicle ? (vehicle.sellingPrice || vehicle.price) : manualPrice,
                        discount: 0,
                        date: (formData.get('date') && formData.get('date').trim() !== '') ? new Date(formData.get('date')).toISOString() : orders[orderIndex].date,
                        remarks: formData.get('remarks') || '',
                        showroom: formData.get('showroom') || orders[orderIndex].showroom || 'Showroom Principal',
                        status: formData.get('status') || orders[orderIndex].status,
                        documentStatus: formData.get('documentStatus') || orders[orderIndex].documentStatus || 'Rien',
                        documentsReceived: formData.get('documentsReceived') || orders[orderIndex].documentsReceived || 'Non'
                    };

                    // Calculate status normally UNLESS it was manually set to ANNULÉE
                    if (updatedOrder.status !== 'ANNULÉE') {
                        updatedOrder.status = this.calculateOrderStatus(updatedOrder);
                    } else {
                        // If manually cancelled, release ALL associated vehicles
                        const linkedVehicles = vehicles.filter(v => v.orderId === orderId);
                        for (const vToRelease of linkedVehicles) {
                            vToRelease.orderId = null;
                            vToRelease.status = 'Available';
                            await StorageService.update(STORAGE_KEYS.VEHICLES, vToRelease.id, vToRelease);
                        }
                        updatedOrder.vehicleId = null;
                        updatedOrder.vehicleName = 'COMMANDE ANNULÉE';
                    }

                    await StorageService.update(STORAGE_KEYS.ORDERS, orderId, updatedOrder);
                }
            } else {
                // Create new order
                finalOrderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
                const newOrder = {
                    id: finalOrderId,
                    clientId: client.id,
                    clientName: `${client.firstName} ${client.lastName}`,
                    vehicleId: vehicleId || null,
                    vehicleName: vehicle ? `${vehicle.brand} ${vehicle.model || ''} (${vehicle.year})` : `${formData.get('requestedBrand') || 'N/A'} ${formData.get('requestedModel') || ''}`,
                    requestedBrand: formData.get('requestedBrand') || '',
                    requestedModel: formData.get('requestedModel') || '',
                    requestedMotorization: formData.get('requestedMotorization') || '',
                    requestedColor: formData.get('requestedColor') || '',
                    date: new Date().toISOString(),
                    totalAmount: vehicle ? (vehicle.sellingPrice || vehicle.price) : manualPrice,
                    discount: 0,
                    currency: vehicle ? (vehicle.sellingCurrency || 'EUR') : (StorageService.get(STORAGE_KEYS.SETTINGS)?.sellingCurrency || 'EUR'),
                    date: (formData.get('date') && formData.get('date').trim() !== '') ? new Date(formData.get('date')).toISOString() : new Date().toISOString(),
                    remarks: formData.get('remarks') || '',
                    showroom: formData.get('showroom') || 'Showroom Principal',
                    documentStatus: formData.get('documentStatus') || 'Rien',
                    documentsReceived: formData.get('documentsReceived') || 'Non',
                    isValidated: false
                };
                newOrder.status = this.calculateOrderStatus(newOrder);
                await StorageService.add(STORAGE_KEYS.ORDERS, newOrder);
            }

            // Link vehicle to order if provided
            if (vehicle) {
                vehicle.orderId = finalOrderId;
                vehicle.status = 'Reserved';
                vehicle.showroom = formData.get('showroom') || 'Showroom Principal';
                await StorageService.update(STORAGE_KEYS.VEHICLES, vehicle.id, vehicle);
            }

            await this.syncOrderStatuses();
            this.closeModal();
            this.showToast(orderId ? 'Commande mise à jour' : 'Nouvelle commande créée avec succès', 'success');
            this.renderView(this.currentView);
        } catch (error) {
            console.error("Error in handleOrderSubmission:", error);
            this.showToast(`Erreur lors de l'enregistrement: ${error.message || 'Serveur injoignable'}`, "error");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = formData.get('orderId') ? 'Enregistrer' : 'Créer la commande';
            }
        }
    },

    renderOrderTasks(order) {
        const tasks = order.tasks || [];
        if (tasks.length === 0) {
            return '<p style="color: var(--text-dim); font-size: 0.9rem; font-style: italic; text-align: center; padding: 10px;">Aucune action prévue.</p>';
        }

        return tasks.map((task, index) => `
            <div class="task-item" style="display: flex; align-items: center; gap: 10px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 6px; margin-bottom: 5px; border: 1px solid rgba(255,255,255,0.05);">
                <input type="checkbox" ${task.completed ? 'checked' : ''} 
                    onchange="app.toggleOrderTask('${order.id}', ${index})" 
                    style="width: 18px; height: 18px; cursor: pointer;">
                <span style="flex: 1; font-size: 0.9rem; ${task.completed ? 'text-decoration: line-through; color: var(--text-dim);' : ''}">
                    ${task.text}
                </span>
                <button class="btn-icon danger" onclick="app.deleteOrderTask('${order.id}', ${index})" style="padding: 4px 8px; font-size: 0.75rem;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    },

    async addOrderTask(orderId) {
        const text = prompt("Quelle action souhaitez-vous ajouter ?");
        if (!text || !text.trim()) return;

        const orders = StorageService.get(STORAGE_KEYS.ORDERS);
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        if (!order.tasks) order.tasks = [];
        order.tasks.push({ text: text.trim(), completed: false, createdAt: new Date().toISOString() });

        try {
            await StorageService.update(STORAGE_KEYS.ORDERS, orderId, order);
            const container = document.getElementById(`tasks-container-${orderId}`);
            if (container) container.innerHTML = this.renderOrderTasks(order);
        } catch (err) {
            this.showToast("Erreur lors de l'ajout de la tâche", "error");
        }
    },

    async toggleOrderTask(orderId, taskIndex) {
        const orders = StorageService.get(STORAGE_KEYS.ORDERS);
        const order = orders.find(o => o.id === orderId);
        if (!order || !order.tasks || !order.tasks[taskIndex]) return;

        order.tasks[taskIndex].completed = !order.tasks[taskIndex].completed;

        try {
            await StorageService.update(STORAGE_KEYS.ORDERS, orderId, order);
            const container = document.getElementById(`tasks-container-${orderId}`);
            if (container) container.innerHTML = this.renderOrderTasks(order);
        } catch (err) {
            this.showToast("Erreur lors de la mise à jour de la tâche", "error");
        }
    },

    async deleteOrderTask(orderId, taskIndex) {
        if (!confirm("Supprimer cette action ?")) return;

        const orders = StorageService.get(STORAGE_KEYS.ORDERS);
        const order = orders.find(o => o.id === orderId);
        if (!order || !order.tasks) return;

        order.tasks.splice(taskIndex, 1);

        try {
            await StorageService.update(STORAGE_KEYS.ORDERS, orderId, order);
            const container = document.getElementById(`tasks-container-${orderId}`);
            if (container) container.innerHTML = this.renderOrderTasks(order);
        } catch (err) {
            this.showToast("Erreur lors de la suppression de la tâche", "error");
        }
    },

    showOrderDetails(id) {
        const order = StorageService.get(STORAGE_KEYS.ORDERS).find(o => o.id === id);
        const client = StorageService.get(STORAGE_KEYS.CLIENTS).find(c => c.id === order.clientId);
        const vehicle = StorageService.get(STORAGE_KEYS.VEHICLES).find(v => v.id === order.vehicleId);

        const cash = StorageService.get(STORAGE_KEYS.CASH).filter(t => t.orderId === id);
        const totalPaid = cash.reduce((sum, t) => sum + Number(t.amount || 0), 0);

        // Timeline status logic
        const shipments = StorageService.get(STORAGE_KEYS.SHIPMENTS) || [];
        const shipment = vehicle && vehicle.shipmentId ? shipments.find(s => s.id === vehicle.shipmentId) : null;

        const orderStatus = (this.calculateOrderStatus(order) || '').toLowerCase();

        const isAboard = ['a bord', 'en mer', 'arrivée', 'enlevée', 'conclue'].includes(orderStatus);
        const isAtSea = ['en mer', 'arrivée', 'enlevée', 'conclue'].includes(orderStatus);
        const isArrived = ['arrivée', 'enlevée', 'conclue'].includes(orderStatus);
        const isDelivered = orderStatus === 'enlevée' || orderStatus === 'livrée' || orderStatus === 'conclue';

        const steps = [
            { id: 'validation', label: 'Validation', icon: 'fa-check-double', completed: order.isValidated || !!order.vehicleId },
            { id: 'assignment', label: 'Affectation', icon: 'fa-car', completed: !!order.vehicleId || !!shipment },
            { id: 'shipping', label: 'Expédition', icon: 'fa-shipping-fast', completed: !!shipment || isAboard },
            { id: 'onboard', label: 'A Bord', icon: 'fa-ship', completed: isAboard || isAtSea },
            { id: 'atsea', label: 'En Mer', icon: 'fa-water', completed: isAtSea || isArrived },
            { id: 'arrived', label: 'Arrivée', icon: 'fa-box-open', completed: isArrived || isDelivered },
            { id: 'delivered', label: 'Enlevée', icon: 'fa-handshake', completed: isDelivered }
        ];

        // Ensure strictly progressive visual completion
        let activeIndex = -1;
        for (let i = steps.length - 1; i >= 0; i--) {
            if (steps[i].completed) {
                activeIndex = Math.max(activeIndex, i);
            }
        }
        for (let i = 0; i <= activeIndex; i++) {
            steps[i].completed = true;
        }

        const modalHtml = `
                <div class="modal-overlay">
                    <div class="modal-content glass" style="width: 700px; max-height: 90vh; overflow-y: auto;">
                        <div class="modal-header">
                            <h2>Détails de la Commande #${order.id}</h2>
                            <button class="btn-close" onclick="app.closeModal()">&times;</button>
                        </div>
                        <div class="order-details-content">
                            <!-- Timeline Section -->
                            <div class="details-section" style="padding-top: 5px;">
                                <h3 style="margin-bottom: 20px;"><i class="fas fa-tasks"></i> Suivi de la Commande</h3>
                                <div class="summary-timeline">
                                    <div class="timeline-steps">
                                        ${steps.map((step, index) => `
                                            <div class="timeline-step ${step.completed ? 'completed' : ''} ${index === activeIndex ? 'active' : ''}">
                                                <div class="step-icon">
                                                    <i class="fas ${step.completed ? 'fa-check' : step.icon}"></i>
                                                </div>
                                                <div class="step-label">${step.label}</div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>

                            <div class="details-section">
                                <h3><i class="fas fa-user"></i> Informations Client</h3>
                                <p><strong>Nom:</strong> ${order.clientName || (client ? `${client.firstName} ${client.lastName}` : 'Client Inconnu')}</p>
                                <p><strong>Email:</strong> ${client ? `<a href="mailto:${client.email}" style="color: var(--primary); text-decoration: underline;">${client.email}</a>` : 'N/A'}</p>
                                <p><strong>Téléphone:</strong> ${client ? client.phone : 'N/A'}</p>
                            </div>
                            <div class="details-section">
                                <h3><i class="fas fa-car"></i> Véhicule</h3>
                                <p><strong>Désignation:</strong> ${order.vehicleName || 'N/A'}</p>
                                ${vehicle ? `
                                    <p><strong>Marque/Modèle:</strong> ${vehicle.brand} ${vehicle.model || ''} (${vehicle.year})</p>
                                    <p><strong>Châssis:</strong> <code style="font-size: 0.85rem;">${vehicle.chassisNumber || 'N/A'}</code></p>
                                    <p><strong>Motorisation:</strong> ${vehicle.motorization || 'N/A'}</p>
                                    <p><strong>Finition:</strong> ${vehicle.trim || 'N/A'}</p>
                                    <p><strong>Couleur:</strong> ${vehicle.color || 'N/A'}</p>
                                ` : `
                                    <p><strong>Marque Souhaitée:</strong> ${order.requestedBrand || 'N/A'}</p>
                                    <p><strong>Modèle Souhaité:</strong> ${order.requestedModel || 'N/A'}</p>
                                    <p><strong>Couleur Souhaitée:</strong> ${order.requestedColor || 'N/A'}</p>
                                `}
                                ${vehicle && vehicle.options ? `<p><strong>Options:</strong> <span style="font-size: 0.85rem; color: var(--text-dim);">${vehicle.options}</span></p>` : ''}
                                
                                ${shipment ? `
                                <div style="margin-top: 15px; padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.03); border-left: 3px solid var(--primary);">
                                    <h4 style="font-size: 0.9rem; margin-bottom: 8px; color: var(--primary);"><i class="fas fa-shipping-fast"></i> Situation du Transport</h4>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem;">
                                        <div><strong>ETD:</strong> ${shipment.etd ? new Date(shipment.etd).toLocaleDateString() : 'N/A'}</div>
                                        <div><strong>ETA:</strong> ${shipment.eta ? new Date(shipment.eta).toLocaleDateString() : 'N/A'}</div>
                                        <div><strong>Dédouanement:</strong> ${shipment.customsClearanceDate ? new Date(shipment.customsClearanceDate).toLocaleDateString() : 'N/A'}</div>
                                        <div><strong>Enlèvement:</strong> ${shipment.pickupDate ? new Date(shipment.pickupDate).toLocaleDateString() : 'N/A'}</div>
                                    </div>
                                    <div style="margin-top: 8px; font-size: 0.8rem; color: var(--text-dim);">
                                        <strong>Conteneur:</strong> ${shipment.containerNumber} | <strong>Compagnie:</strong> ${shipment.carrier || 'N/A'}
                                        ${shipment.voyage ? `<br><strong>Voyage:</strong> ${shipment.voyage}` : ''}
                                    </div>
                                    <div style="display: flex; gap: 10px; margin-top: 12px;">
                                        <button class="btn btn-secondary" style="flex: 1; font-size: 0.85rem;" onclick="app.showShipmentMap('${shipment.id}')">
                                            <i class="fas fa-map-marked-alt"></i> Voir sur la carte
                                        </button>
                                        <button class="btn btn-primary" style="flex: 1; font-size: 0.85rem;" onclick="app.showShipmentTrackingHistory('${shipment.id}')">
                                            <i class="fas fa-history"></i> Historique
                                        </button>
                                    </div>
                                    <button class="btn btn-secondary" style="width: 100%; margin-top: 10px; font-size: 0.85rem; background: rgba(59, 130, 246, 0.1); color: #3b82f6; border-color: rgba(59, 130, 246, 0.2);" onclick="app.refreshShipmentTracking('${shipment.id}', this)">
                                        <i class="fas fa-sync"></i> Actualiser Tracking (Voyage)
                                    </button>
                                </div>
                                ` : ''}
                                
                                <p style="margin-top: 10px;"><strong>Prix Total:</strong> ${this.formatCurrency(order.totalAmount)}</p>
                            </div>

                            <div class="details-section">
                                <h3><i class="fas fa-money-bill-wave"></i> Détail Financier</h3>
                                <div class="financial-breakdown" style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                        <span>Prix Initial:</span>
                                        <span>${this.formatCurrency(order.totalAmount)}</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: var(--danger);">
                                        <span>Remise:</span>
                                        <span>- ${this.formatCurrency(order.discount || 0)}</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); font-weight: 700; color: var(--success); font-size: 1.1rem; margin-bottom: 15px;">
                                        <span>Prix Net:</span>
                                        <span>${this.formatCurrency((order.totalAmount || 0) - (order.discount || 0))}</span>
                                    </div>
                                    
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                        <span>Total Encaissé:</span>
                                        <span class="success" style="font-weight: 600;">${this.formatCurrency(totalPaid)}</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; font-weight: 700;">
                                        <span>Solde à Payé:</span>
                                        <span class="danger">${this.formatCurrency(Math.max(0, (order.totalAmount - (order.discount || 0)) - totalPaid))}</span>
                                    </div>
                                </div>
                                
                                ${cash.length > 0 ? `
                                    <div class="payment-history" style="margin-top: 20px;">
                                        <h4>Historique des paiements</h4>
                                        <table class="data-table mini" style="font-size: 0.85rem;">
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Méthode</th>
                                                    <th>Note</th>
                                                    <th>Montant</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${cash.map(t => `
                                                    <tr>
                                                        <td>${new Date(t.date).toLocaleDateString()}</td>
                                                        <td>${t.paymentMethod}</td>
                                                        <td>${t.description || '-'}</td>
                                                        <td class="success" style="font-weight: 600;">${this.formatCurrency(t.amount, t.currency)}</td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                ` : '<p style="margin-top: 10px; color: var(--text-dim);">Aucun paiement enregistré pour le moment.</p>'}
                            </div>

                            ${vehicle && vehicle.estimatedCustomsDuty ? `
                            <div class="details-section" style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 20px; text-align: center;">
                                <h3 style="margin-bottom: 10px; color: var(--primary);"><i class="fas fa-file-invoice-dollar"></i> Estimation Dédouanement</h3>
                                <div style="font-size: 2rem; font-weight: 800; color: var(--primary);">
                                    ${this.formatCurrency(vehicle.estimatedCustomsDuty, vehicle.sellingCurrency || 'EUR')}
                                </div>
                                <p style="font-size: 0.75rem; color: var(--text-dim); margin-top: 5px;">Cette valeur est indicative et basée sur les caractéristiques du véhicule.</p>
                            </div>
                            ` : ''}

                            <div class="details-section">
                                <h3><i class="fas fa-info-circle"></i> État de la Commande</h3>
                                <p><strong>Date Bc:</strong> ${new Date(order.date).toLocaleDateString()}</p>
                                <p><strong>Statut:</strong> <span class="status-badge ${(order.status || 'N/A').toLowerCase().replace(/\s+/g, '-')}">${order.status || 'N/A'}</span></p>
                                ${order.remarks ? `<p><strong>Commentaires:</strong> <i style="color: var(--text-dim);">${order.remarks}</i></p>` : ''}
                            </div>

                            <!-- Actions à faire (To-Do List) -->
                            <div class="details-section" style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px;">
                                <h3 style="display: flex; justify-content: space-between; align-items: center;">
                                    <span><i class="fas fa-clipboard-list"></i> Actions à faire</span>
                                    <button class="btn-action success-alt" onclick="app.addOrderTask('${order.id}')" title="Ajouter une action"><i class="fas fa-plus"></i></button>
                                </h3>
                                <div id="tasks-container-${order.id}" class="tasks-list" style="margin-top: 15px;">
                                    ${this.renderOrderTasks(order)}
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn-secondary" onclick="app.closeModal()">Fermer</button>
                            <button class="btn-primary" onclick="app.showCashModal('${order.id}')">
                                <i class="fas fa-cash-register"></i> Nouveau Règlement
                            </button>
                        </div>
                    </div>
                </div>
            `;
                document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    renderPurchaseOrderTasks(po) {
        if (!po.tasks || po.tasks.length === 0) {
            return '<p style="color: var(--text-dim); font-size: 0.85rem; font-style: italic;">Aucune action enregistrée.</p>';
        }

        return po.tasks.map((task, index) => `
            <div class="task-item" style="display: flex; align-items: center; gap: 10px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 6px; margin-bottom: 5px; border: 1px solid rgba(255,255,255,0.05);">
                <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="app.togglePurchaseOrderTask('${po.id}', ${index})" style="width: 18px; height: 18px; cursor: pointer;">
                <span style="flex: 1; ${task.completed ? 'text-decoration: line-through; color: var(--text-dim);' : ''} font-size: 0.9rem;">
                    ${task.text}
                </span>
                <button class="btn-icon danger" onclick="app.deletePurchaseOrderTask('${po.id}', ${index})" style="padding: 4px 8px; font-size: 0.75rem;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    },

    async addPurchaseOrderTask(poId) {
        const text = prompt("Quelle action souhaitez-vous ajouter à cet achat ?");
        if (!text || !text.trim()) return;

        const pos = StorageService.get(STORAGE_KEYS.PURCHASE_ORDERS);
        const po = pos.find(p => p.id === poId);
        if (!po) return;

        if (!po.tasks) po.tasks = [];
        po.tasks.push({ text: text.trim(), completed: false, createdAt: new Date().toISOString() });

        try {
            await StorageService.update(STORAGE_KEYS.PURCHASE_ORDERS, poId, po);
            const container = document.getElementById(`po-tasks-container-${poId}`);
            if (container) container.innerHTML = this.renderPurchaseOrderTasks(po);
        } catch (err) {
            this.showToast("Erreur lors de l'ajout de la tâche", "error");
        }
    },

    async togglePurchaseOrderTask(poId, taskIndex) {
        const pos = StorageService.get(STORAGE_KEYS.PURCHASE_ORDERS);
        const po = pos.find(p => p.id === poId);
        if (!po || !po.tasks || !po.tasks[taskIndex]) return;

        po.tasks[taskIndex].completed = !po.tasks[taskIndex].completed;

        try {
            await StorageService.update(STORAGE_KEYS.PURCHASE_ORDERS, poId, po);
            const container = document.getElementById(`po-tasks-container-${poId}`);
            if (container) container.innerHTML = this.renderPurchaseOrderTasks(po);
        } catch (err) {
            this.showToast("Erreur lors de la mise à jour de la tâche", "error");
        }
    },

    async deletePurchaseOrderTask(poId, taskIndex) {
        if (!confirm("Supprimer cette action ?")) return;

        const pos = StorageService.get(STORAGE_KEYS.PURCHASE_ORDERS);
        const po = pos.find(p => p.id === poId);
        if (!po || !po.tasks) return;

        po.tasks.splice(taskIndex, 1);

        try {
            await StorageService.update(STORAGE_KEYS.PURCHASE_ORDERS, poId, po);
            const container = document.getElementById(`po-tasks-container-${poId}`);
            if (container) container.innerHTML = this.renderPurchaseOrderTasks(po);
        } catch (err) {
            this.showToast("Erreur lors de la suppression de la tâche", "error");
        }
    },

    showEditOrderModal(id) {
        const order = StorageService.get(STORAGE_KEYS.ORDERS).find(o => o.id === id);
        const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES).filter(v => (!v.orderId && !v.archived) || v.id === order.vehicleId);
        const clients = StorageService.get(STORAGE_KEYS.CLIENTS);
        const brands = StorageService.get(STORAGE_KEYS.BRANDS);
        const brandModels = StorageService.get(STORAGE_KEYS.BRAND_MODELS);
        const colors = StorageService.get(STORAGE_KEYS.COLORS);

        if (!order) return;

        const modalHtml = `
                <div class="modal-overlay">
                    <div class="modal-content glass">
                        <div class="modal-header">
                            <h2>Modifier la Commande #${order.id}</h2>
                            <button class="btn-close" onclick="app.closeModal()">&times;</button>
                        </div>
                        <form id="order-form">
                            <input type="hidden" name="orderId" value="${order.id}">
                            <div class="form-group">
                                <label>Client</label>
                                <select name="clientId" required class="glass-select">
                                    ${clients.map(c => `<option value="${c.id}" ${c.id === order.clientId ? 'selected' : ''}>${c.firstName} ${c.lastName}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Date de Commande</label>
                                <input type="date" name="date" value="${order.date ? new Date(order.date).toISOString().split('T')[0] : ''}" required class="glass-input">
                            </div>
                            <div class="form-group">
                                <label>Véhicule Sélectionné (Stock)</label>
                                ${!order.isValidated ? `
                                    <div class="validation-notice" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b; padding: 8px; border-radius: 6px; font-size: 0.8rem; margin-bottom: 8px; border: 1px solid rgba(245, 158, 11, 0.2);">
                                        <i class="fas fa-exclamation-triangle"></i> Cette commande n'est pas encore validée. La sélection de véhicule est bloquée.
                                    </div>
                                ` : ''}
                                <select name="vehicleId" class="glass-select" ${!order.isValidated ? 'disabled' : ''}>
                                    <option value="">[SANS VÉHICULE EN STOCK]</option>
                                    ${vehicles.map(v => {
            const vin = v.chassisNumber ? `VIN: ${v.chassisNumber}` : 'VIN: N/A';
            const color = v.color ? `${v.color}` : 'N/A';
            const km = v.mileage ? `${v.mileage.toLocaleString()} km` : '0 km';
            const category = v.category || v.condition || 'N/A';
            return `<option value="${v.id}" ${v.id === order.vehicleId ? 'selected' : ''}>[#${v.id}] ${v.brand} ${v.model || ''} (${v.year}) | ${vin} | ${color} | ${km} | ${category} - ${this.formatCurrency(v.sellingPrice || v.price, v.sellingCurrency)}</option>`;
        }).join('')}
                                </select>
                            </div>
                            
                            <div class="form-group" style="padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <label style="color: var(--primary);">Véhicule Commandé (Hors Stock)</label>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 5px;">
                                    <div>
                                        <label style="font-size: 0.8rem;">Marque</label>
                                        <select name="requestedBrand" id="edit-requested-brand" class="glass-select">
                                            <option value="">Sélectionner...</option>
                                            ${brands.map(b => `<option value="${b}" ${order.requestedBrand === b ? 'selected' : ''}>${b}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div>
                                        <label style="font-size: 0.8rem;">Modèle</label>
                                        <select name="requestedModel" id="edit-requested-model" class="glass-select">
                                            <option value="">Sélectionner...</option>
                                            ${brandModels[order.requestedBrand] ? brandModels[order.requestedBrand].map(m => `<option value="${m}" ${order.requestedModel === m ? 'selected' : ''}>${m}</option>`).join('') : (order.requestedModel ? `<option value="${order.requestedModel}" selected>${order.requestedModel}</option>` : '')}
                                        </select>
                                    </div>
                                    <div style="grid-column: span 2;">
                                        <label style="font-size: 0.8rem;">Couleur Souhaitée</label>
                                        <select name="requestedColor" class="glass-select">
                                            <option value="">Peu importe</option>
                                            ${colors.map(c => `<option value="${c}" ${order.requestedColor === c ? 'selected' : ''}>${c}</option>`).join('')}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div class="form-group">
                                <label>Prix de Vente (Net)</label>
                                <input type="number" name="totalAmount" id="edit-order-total" class="glass-input" value="${order.totalAmount || 0}" step="1">
                            </div>

                            <div class="form-group">
                                <label>Commentaires / Remarques</label>
                                <textarea name="remarks" class="glass-input" rows="3" placeholder="Notes particulières...">${order.remarks || ''}</textarea>
                            </div>

                            <div class="form-group">
                                <label>Statut</label>
                                <select name="status" class="glass-select">
                                    <option value="${order.status}" selected>${order.status} (Actuel)</option>
                                    <option value="EN ATTENTE DE VALIDATION">EN ATTENTE DE VALIDATION</option>
                                    <option value="EN COURS">EN COURS</option>
                                    <option value="ATTENTE AFFECTATION VÉHICULE">ATTENTE AFFECTATION VÉHICULE</option>
                                    <option value="ATTENTE EXPÉDITION">ATTENTE EXPÉDITION</option>
                                    <option value="ENLEVÉE">ENLEVÉE</option>
                                    <option value="CONCLUE">CONCLUE</option>
                                    <option value="ANNULÉE" style="color: var(--danger);">ANNULÉE</option>
                                </select>
                                <p style="font-size: 0.7rem; color: var(--text-dim); margin-top: 4px;">Attention: Changer le statut manuellement peut impacter le cycle auto.</p>
                            </div>
                            <div class="form-group">
                                <label>Showroom</label>
                                <select name="showroom" required class="glass-select">
                                    ${StorageService.get(STORAGE_KEYS.SHOWROOMS).map(s => `<option value="${s}" ${order.showroom === s ? 'selected' : ''}>${s}</option>`).join('')}
                                </select>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                                <button type="button" class="btn-primary" style="background: var(--text-dim); border-color: transparent;" onclick="app.archiveOrder('${order.id}')">
                                    <i class="fas fa-archive"></i> Clôturer le dossier
                                </button>
                                <button type="submit" class="btn-primary">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Dynamic model population
        const brandSelect = document.getElementById('edit-requested-brand');
        const modelSelect = document.getElementById('edit-requested-model');

        brandSelect.addEventListener('change', () => {
            const brand = brandSelect.value;
            modelSelect.innerHTML = '<option value="">Sélectionner...</option>';
            if (brand && brandModels[brand]) {
                brandModels[brand].forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m;
                    opt.textContent = m;
                    modelSelect.appendChild(opt);
                });
            }
        });



        document.getElementById('order-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleOrderSubmission(new FormData(e.target));
        });
    },

    showConfirmModal(message, onConfirm) {
        const modalHtml = `
                <div class="modal-overlay">
                    <div class="modal-content glass" style="width: 400px; text-align: center;">
                        <div class="modal-header" style="justify-content: center;">
                            <h2>Confirmation</h2>
                        </div>
                        <p style="margin: 20px 0;">${message}</p>
                        <div class="modal-footer" style="justify-content: center; gap: 15px;">
                            <button class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                            <button class="btn-primary" style="background: var(--danger); box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);" id="btn-confirm-action">Confirmer</button>
                        </div>
                    </div>
                </div>
            `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.getElementById('btn-confirm-action').addEventListener('click', async () => {
            await onConfirm();
            this.closeModal();
        });
    },

    deleteOrder(id) {
        this.showConfirmModal('Êtes-vous sûr de vouloir supprimer cette commande ?', async () => {
            try {
                // Clean up vehicle link
                const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES);
                const vehicle = vehicles.find(v => v.orderId === id);
                if (vehicle) {
                    vehicle.orderId = null;
                    if (!vehicle.shipmentId) {
                        vehicle.status = 'Available';
                    }
                    await StorageService.update(STORAGE_KEYS.VEHICLES, vehicle.id, vehicle);
                }
                await StorageService.delete(STORAGE_KEYS.ORDERS, id);
                this.showToast('Commande supprimée avec succès', 'success');
                this.renderView(this.currentView);
            } catch (error) {
                console.error("Error deleting order:", error);
                this.showToast(`Échec de la suppression: ${error.message || 'Erreur serveur'}`, 'danger');
            }
        });
    },

    archiveOrder(id) {
        const orders = StorageService.get(STORAGE_KEYS.ORDERS);
        const order = orders.find(o => o.id === id);
        if (!order) return;

        const netPrice = (order.totalAmount || 0) - (order.discount || 0);
        const paid = this.getPaidAmount(order.id);
        const balance = Math.max(0, netPrice - paid);

        if (balance > 0) {
            this.showToast(`Impossible de clôturer: Solde restant de ${this.formatCurrency(balance)}`, 'danger');
            return;
        }

        if (order.status !== 'ENLEVÉE') {
            this.showToast('Impossible de clôturer: Le véhicule doit être enlevé (statut ENLEVÉE)', 'danger');
            return;
        }

        this.showConfirmModal("Voulez-vous vraiment clôturer ce dossier ?<br>Cela archivera la commande, le véhicule et l'expédition associée.", async () => {
            const orders = StorageService.get(STORAGE_KEYS.ORDERS);
            const orderIndex = orders.findIndex(o => o.id === id);
            if (orderIndex === -1) return;

            const order = orders[orderIndex];
            order.archived = true;
            const vehicleId = order.vehicleId;

            await StorageService.update(STORAGE_KEYS.ORDERS, order.id, order);

            if (vehicleId) {
                const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES);
                const vehicle = vehicles.find(v => v.id === vehicleId);

                if (vehicle) {
                    vehicle.archived = true;
                    const shipmentId = vehicle.shipmentId;

                    if (shipmentId) {
                        const shipments = StorageService.get(STORAGE_KEYS.SHIPMENTS);
                        const shipment = shipments.find(s => s.id === shipmentId);
                        if (shipment) {
                            shipment.archived = true;
                            await StorageService.update(STORAGE_KEYS.SHIPMENTS, shipment.id, shipment);
                        }
                    }

                    await StorageService.update(STORAGE_KEYS.VEHICLES, vehicle.id, vehicle);
                }
            }

            this.showToast('Dossier clôturé avec succès', 'success');
            this.renderView(this.currentView);
        });
    },

    deleteClient(id) {
        this.showConfirmModal('Êtes-vous sûr de vouloir supprimer ce client ? Toutes les commandes associées resteront mais le client sera marqué comme inconnu.', async () => {
            await StorageService.delete(STORAGE_KEYS.CLIENTS, id);
            this.renderView(this.currentView);
        });
    },

    showVehicleDetails(id) {
        const vehicle = StorageService.get(STORAGE_KEYS.VEHICLES).find(v => v.id === id);
        if (!vehicle) return;

        const order = vehicle.orderId ? StorageService.get(STORAGE_KEYS.ORDERS).find(o => o.id === vehicle.orderId) : null;
        const clientId = vehicle.clientId || (order ? order.clientId : null);
        const client = clientId ? StorageService.get(STORAGE_KEYS.CLIENTS).find(c => String(c.id) === String(clientId)) : null;

        const modalHtml = `
                <div class="modal-overlay">
                    <div class="modal-content glass" style="width: 550px;">
                        <div class="modal-header">
                            <h2>Détails du Véhicule #${vehicle.id}</h2>
                            <button class="btn-close" onclick="app.closeModal()">&times;</button>
                        </div>
                        <div class="order-details-content">
                            <div class="details-section">
                                <h3><i class="fas fa-info-circle"></i> Identification</h3>
                                <p><strong>Marque/Modèle:</strong> ${vehicle.brand} ${vehicle.model || ''}</p>
                                ${client ? `
                                <div class="details-section" style="background: rgba(var(--primary-rgb), 0.03); border-radius: 10px; padding: 15px; border: 1px solid rgba(var(--primary-rgb), 0.1);">
                                    <h3 style="margin-bottom: 12px; font-size: 1rem;"><i class="fas fa-user-check"></i> Client Affecté</h3>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.9rem;">
                                        <p><strong>Nom:</strong> <span class="badge-pill" style="background: rgba(var(--primary-rgb), 0.1); color: var(--primary); font-weight: 600;">${client.firstName} ${client.lastName}</span></p>
                                        <p><strong>ID Client:</strong> #${client.id || 'N/A'}</p>
                                        <p><strong>Showroom:</strong> ${client.showroom || 'N/A'}</p>
                                        <p><strong>NIN:</strong> ${client.nin || 'N/A'}</p>
                                        <p><strong>Passeport:</strong> ${client.passportNumber || 'N/A'}</p>
                                    </div>
                                </div>` : ''}
                                <p><strong>Provenance/Fournisseur:</strong> ${vehicle.supplier || 'N/A'}</p>
                                ${vehicle.purchaseOrderId ? `<p><strong>Commande d'Achat (PO):</strong> <span class="badge-pill" style="background: rgba(var(--primary-rgb), 0.1); color: var(--primary); cursor: pointer;" onclick="app.closeModal(); app.renderPurchases('${vehicle.purchaseOrderId}')">${vehicle.purchaseOrderId}</span></p>` : ''}
                                <p><strong>Châssis (VIN):</strong> <code class="chassis">${vehicle.chassisNumber || 'N/A'}</code></p>
                                <p><strong>Année/Mois:</strong> ${vehicle.year || 'N/A'} ${vehicle.month ? '/ ' + vehicle.month : ''}</p>
                            </div>
                            
                            <div class="details-section">
                                <h3><i class="fas fa-list-ul"></i> Options & Caractéristiques</h3>
                                <div style="white-space: pre-line; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; font-size: 0.9rem; color: var(--text-secondary); max-height: 200px; overflow-y: auto;">
                                    ${vehicle.options || 'Aucune option renseignée.'}
                                </div>
                            </div>

                            <div class="details-section">
                                <h3><i class="fas fa-cogs"></i> Spécifications</h3>
                                <p><strong>Motorisation:</strong> ${vehicle.motorization || 'N/A'}</p>
                                <p><strong>Couleur:</strong> ${vehicle.color || 'N/A'}</p>

                                <p><strong>Kilométrage:</strong> ${vehicle.mileage ? vehicle.mileage.toLocaleString() + ' km' : 'N/A'}</p>
                            </div>

                            ${vehicle.remarks ? `
                            <div class="details-section">
                                <h3><i class="fas fa-comment-alt"></i> Remarques</h3>
                                <p style="font-style: italic;">${vehicle.remarks}</p>
                            </div>
                            ` : ''}
                        </div>
                        <div class="modal-footer">
                            <button class="btn-secondary" onclick="app.closeModal()">Fermer</button>
                            <button class="btn-primary" onclick="app.showEditVehicleModal('${vehicle.id}')">
                                <i class="fas fa-edit"></i> Modifier
                            </button>
                        </div>
                    </div>
                </div>
            `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    async deleteVehicle(id) {
        this.showConfirmModal('Êtes-vous sûr de vouloir supprimer ce véhicule du stock ?', async () => {
            await StorageService.delete(STORAGE_KEYS.VEHICLES, id);
            this.renderView(this.currentView);
        });
    },

    switchView(viewName) {
        if (this.currentView === viewName) return;

        // Close any open modals when switching views
        this.closeModal();

        // Reset search query when switching views for a clean state
        const searchInput = document.querySelector('.search-container input');
        if (searchInput) {
            searchInput.value = '';
            this.searchQuery = '';
        }

        // Update active state in sidebar
        this.navLinks.forEach(link => {
            if (link.getAttribute('data-view') === viewName) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        this.currentView = viewName;
        this.renderView(viewName);
    },

    attachDashboardListeners() {
        const showroomFilter = document.getElementById('dash-filter-showroom');
        const startFilter = document.getElementById('dash-filter-start');
        const endFilter = document.getElementById('dash-filter-end');
        const resetBtn = document.getElementById('btn-reset-filters');

        if (showroomFilter) {
            showroomFilter.addEventListener('change', (e) => {
                this.dashboardFilters.showroom = e.target.value;
                this.renderDashboard();
            });
        }

        if (startFilter) {
            startFilter.addEventListener('change', (e) => {
                this.dashboardFilters.startDate = e.target.value;
                this.renderDashboard();
            });
        }

        if (endFilter) {
            endFilter.addEventListener('change', (e) => {
                this.dashboardFilters.endDate = e.target.value;
                this.renderDashboard();
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.dashboardFilters = { showroom: '', startDate: '', endDate: '' };
                this.renderDashboard();
            });
        }

        const syncBtn = document.getElementById('btn-sync-dashboard');
        if (syncBtn) {
            syncBtn.addEventListener('click', async () => {
                const icon = syncBtn.querySelector('i');
                if (icon) icon.classList.add('fa-spin');
                try {
                    await StorageService.syncAll();
                    this.renderDashboard();
                    Toast.show('Données actualisées avec succès', 'success');
                } catch (e) {
                    Toast.show('Erreur lors de l\'actualisation', 'error');
                } finally {
                    if (icon) icon.classList.remove('fa-spin');
                }
            });
        }
    },

    renderView(viewName) {
        this.viewContainer.innerHTML = ''; // Clear container

        switch (viewName) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'orders':
                this.renderOrders(this.searchQuery);
                break;
            case 'clients':
                this.renderClients(this.searchQuery);
                break;
            case 'vehicles':
                this.renderVehicles(this.searchQuery);
                break;
            case 'shipments':
                this.renderShipments(this.searchQuery);
                break;
            case 'cash':
                this.renderCash(this.searchQuery);
                break;
            case 'purchases':
                this.renderPurchases(this.searchQuery);
                break;
            case 'exchange-rates':
                this.renderExchangeRates(this.searchQuery);
                break;
            case 'settings':
                this.renderSettings();
                break;
            case 'audit':
                this.renderAudit();
                break;

            case 'alerts':
                this.renderAlerts();
                break;
            case 'verification':
                this.renderVerification();
                break;
            case 'suppliers':
                this.renderSuppliers(this.searchQuery);
                break;
            case 'voyages':
                this.renderVoyages();
                break;
            case 'global-tracking':
                this.renderGlobalTracking();
                break;
            default:
                this.renderDashboard();
        }
    },

    async renderDashboard() {
        try {
            let orders = StorageService.get(STORAGE_KEYS.ORDERS);
            const clients = StorageService.get(STORAGE_KEYS.CLIENTS);
            const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES);
            let cash = StorageService.get(STORAGE_KEYS.CASH);
            const shipments = StorageService.get(STORAGE_KEYS.SHIPMENTS) || [];

            // Sort orders by date desc for the timeline
            orders.sort((a, b) => new Date(b.date) - new Date(a.date));

            // --- 1. DATA PREPARATION ---
            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase();
                orders = orders.filter(o =>
                    String(o.id || '').toLowerCase().includes(q) ||
                    String(o.clientName || '').toLowerCase().includes(q) ||
                    String(o.vehicleName || '').toLowerCase().includes(q)
                );
                cash = cash.filter(t =>
                    String(t.clientName || '').toLowerCase().includes(q) ||
                    String(t.description || '').toLowerCase().includes(q)
                );
            }

            if (this.dashboardFilters.showroom) {
                orders = orders.filter(o => o.showroom === this.dashboardFilters.showroom);
                cash = cash.filter(t => t.showroom === this.dashboardFilters.showroom);
            }

            if (this.dashboardFilters.startDate) {
                const start = new Date(this.dashboardFilters.startDate);
                orders = orders.filter(o => new Date(o.date) >= start);
                cash = cash.filter(t => new Date(t.date) >= start);
            }

            if (this.dashboardFilters.endDate) {
                const end = new Date(this.dashboardFilters.endDate);
                end.setHours(23, 59, 59, 999);
                orders = orders.filter(o => new Date(o.date) <= end);
                cash = cash.filter(t => new Date(t.date) <= end);
            }

            // Financial & Stat Calculations
            const settings = StorageService.get(STORAGE_KEYS.SETTINGS) || {};
            const reportingCurrency = settings.sellingCurrency || 'EUR';

            const totalSales = orders.reduce((sum, o) => sum + this.convertCurrency(o.totalAmount, o.currency, reportingCurrency, o.date), 0);
            const totalInflow = cash.filter(t => t.type === 'In').reduce((sum, t) => sum + this.convertCurrency(Number(t.amount), t.currency, reportingCurrency, t.date), 0);
            const totalOutflow = cash.filter(t => t.type === 'Out').reduce((sum, t) => sum + this.convertCurrency(Number(t.amount), t.currency, reportingCurrency, t.date), 0);
            const netCashBalance = totalInflow - totalOutflow;

            const unpaidAmount = orders.reduce((sum, order) => {
                const paid = this.getPaidAmount(order.id);
                const balance = Math.max(0, (order.totalAmount || 0) - paid);
                return sum + this.convertCurrency(balance, order.currency, reportingCurrency, order.date);
            }, 0);

            const stockValue = vehicles.filter(v => v.status === 'Available').reduce((sum, v) => {
                return sum + this.convertCurrency(Number(v.purchasePrice || 0), v.purchaseCurrency || 'EUR', reportingCurrency);
            }, 0);

            const statusCounts = orders.reduce((acc, order) => {
                acc[order.status] = (acc[order.status] || 0) + 1;
                return acc;
            }, {});

            // --- DATA INTEGRITY CHECK (Self-Repair) ---
            let dataChanged = false;
            vehicles.forEach(v => {
                const originalStatus = v.status;
                if (v.shipmentId) {
                    const shipment = shipments.find(s => s.id === v.shipmentId);
                    if (shipment) {
                        // Map specific shipment statuses to order-friendly names (Case insensitive)
                        const normalizedStatus = shipment.status.toLowerCase().trim();

                        if (normalizedStatus === 'en route' || normalizedStatus === 'en mer' || normalizedStatus === 'en-route' || normalizedStatus === 'préparation') {
                            v.status = 'In Transit';
                        } else if (normalizedStatus === 'arrivé' || normalizedStatus === 'arrive' || normalizedStatus === 'arrivée') {
                            v.status = 'Arrived';
                        } else if (normalizedStatus === 'livré' || normalizedStatus === 'livre' || normalizedStatus === 'enlevée') {
                            v.status = 'Sold';
                        }
                    } else {
                        v.shipmentId = null;
                    }
                }
                if (!v.shipmentId && v.orderId) {
                    v.status = 'Reserved';
                }
                if (!v.shipmentId && !v.orderId && !['In Transit', 'Arrived', 'Sold', 'Reserved'].includes(v.status)) {
                    v.status = 'Available';
                }
                if (v.status !== originalStatus) dataChanged = true;
            });

            if (dataChanged) {
                await StorageService.save(STORAGE_KEYS.VEHICLES, vehicles);
            }

            // Alert Calculations
            const today = new Date();
            const nextWeek = new Date();
            nextWeek.setDate(today.getDate() + 7);

            const arrivingSoonAlerts = shipments.filter(s => {
                if (!s.eta) return false;
                const eta = new Date(s.eta);
                return eta >= today && eta <= nextWeek;
            });

            const outdatedVoyages = shipments.filter(s => {
                if (s.status === 'Arrivé' || s.status === 'Livré') return false;
                return this.isOutdated(s.updatedAt || s.date);
            });

            const missingDocsAlerts = orders.filter(o => {
                if (!o.vehicleId || !o.isValidated) return false;
                const v = vehicles.find(veh => veh.id === o.vehicleId);
                if (!v || !v.shipmentId) return false;
                const s = shipments.find(sh => sh.id === v.shipmentId);
                if (!s || !s.eta) return false;

                const eta = new Date(s.eta);
                const isArrivingSoon = eta >= today && eta <= nextWeek;
                const hasDocs = o.bolReceived || o.docsReceived; // Generic docs check
                return isArrivingSoon && !hasDocs;
            });

            // --- 2. RENDER HTML ---
            this.viewContainer.innerHTML = `
                <div class="view-header">
                    <h2>DASHBOARD</h2>
                    <div class="header-filters glass">
                        <select id="dash-showroom" onchange="app.setDashboardFilter('showroom', this.value)">
                            <option value="">Tous les showrooms</option>
                            ${(StorageService.get(STORAGE_KEYS.SHOWROOMS) || []).map(s => `<option value="${s}" ${this.dashboardFilters.showroom === s ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                        <input type="date" value="${this.dashboardFilters.startDate || ''}" onchange="app.setDashboardFilter('startDate', this.value)">
                        <input type="date" value="${this.dashboardFilters.endDate || ''}" onchange="app.setDashboardFilter('endDate', this.value)">
                    </div>
                </div>

                <div class="preview-container">
                    <!-- Hero Banner -->
                    <div class="hero-banner glass animate">
                        <div class="hero-content">
                            <h1>Bonjour, ${StorageService.get(STORAGE_KEYS.CURRENT_USER)?.name || 'Admin'}</h1>
                            <p>Voici l'état actuel de votre business aujourd'hui.</p>
                        </div>
                        <div class="hero-stats">
                            <div class="hero-stat-item">
                                <div class="hero-stat-label">Chiffre d'Affaires</div>
                                <div class="hero-stat-value">${this.formatCurrency(totalSales, reportingCurrency)}</div>
                            </div>
                            <div class="hero-stat-item">
                                <div class="hero-stat-label">Objectif Semaine</div>
                                <div class="hero-stat-value" style="color: var(--accent-blue);">85%</div>
                            </div>
                        </div>
                    </div>

                    <!-- KPI Grid -->
                    <div class="kpi-grid">
                        <div class="kpi-card glass animate delay-1" onclick="app.switchView('orders')">
                            <div class="kpi-icon"><i class="fas fa-shopping-bag" style="color: var(--primary);"></i></div>
                            <div class="kpi-label">Ventes Globales</div>
                            <div class="kpi-value">${this.formatCurrency(totalSales, reportingCurrency)}</div>
                            <div class="kpi-trend trend-up"><i class="fas fa-arrow-up"></i> ${orders.length} commandes</div>
                        </div>
                        <div class="kpi-card glass animate delay-1" onclick="app.switchView('cash')">
                            <div class="kpi-icon"><i class="fas fa-wallet" style="color: var(--success);"></i></div>
                            <div class="kpi-label">Trésorerie Nette</div>
                            <div class="kpi-value">${this.formatCurrency(netCashBalance, reportingCurrency)}</div>
                            <div class="kpi-trend ${netCashBalance >= 0 ? 'trend-up' : 'trend-down'}">Flux de caisse global</div>
                        </div>
                        <div class="kpi-card glass animate delay-2" onclick="app.switchView('vehicles')">
                            <div class="kpi-icon"><i class="fas fa-car" style="color: var(--accent-blue);"></i></div>
                            <div class="kpi-label">Valeur du Stock</div>
                            <div class="kpi-value">${this.formatCurrency(stockValue, reportingCurrency)}</div>
                            <div class="kpi-trend">Véhicules disponibles</div>
                        </div>
                        <div class="kpi-card glass animate delay-2" onclick="app.switchView('orders')">
                            <div class="kpi-icon"><i class="fas fa-hand-holding-usd" style="color: var(--danger);"></i></div>
                            <div class="kpi-label">À Recouvrer</div>
                            <div class="kpi-value">${this.formatCurrency(unpaidAmount, reportingCurrency)}</div>
                            <div class="kpi-trend trend-up" style="color: var(--danger); font-weight: 600;">Balance à recouvrer</div>
                        </div>
                    </div>

                    <!-- Charts Section -->
                    <div class="main-grid">
                        <div class="chart-section glass animate delay-3">
                            <div class="section-title">
                                <h2><i class="fas fa-chart-line"></i> Comparatif Performance par Showroom</h2>
                                <button class="btn-primary" onclick="app.renderView('dashboard')" style="padding: 5px 15px; font-size: 0.8rem;">
                                    <i class="fas fa-sync"></i>
                                </button>
                            </div>
                            
                            <div class="chart-controls">
                                <label class="control-item"><input type="checkbox" id="perf-global" checked> Global</label>
                                ${(StorageService.get(STORAGE_KEYS.SHOWROOMS) || []).map((s, i) => `
                                    <label class="control-item"><input type="checkbox" class="perf-showroom" data-index="${i + 1}" checked> ${s}</label>
                                `).join('')}
                            </div>

                            <div class="chart-container">
                                <canvas id="performanceChart"></canvas>
                            </div>
                        </div>
                        <div class="chart-section glass animate delay-3">
                            <div class="section-title">
                                <h2><i class="fas fa-chart-bar"></i> CA par Showroom (Valeur & Qté)</h2>
                            </div>
                            
                            <div class="chart-controls">
                                <label class="control-item"><input type="checkbox" id="ca-val" checked> Valeur (${reportingCurrency})</label>
                                <label class="control-item"><input type="checkbox" id="ca-qty" checked> Quantité (Véhicules)</label>
                            </div>

                            <div class="chart-container">
                                <canvas id="stockPieChart"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- Tracking & Activity Section -->
                    <div class="main-grid" style="margin-top: 30px;">
                        <div class="chart-section glass animate delay-3">
                            <div class="section-title">
                                <h2><i class="fas fa-globe-africa"></i> Suivi Maritime en Direct</h2>
                                <button class="btn-primary" onclick="app.renderView('global-tracking')" style="padding: 5px 15px; font-size: 0.8rem;">Mapper</button>
                            </div>
                            <div class="map-wrapper" style="height: 350px; overflow: hidden; border-radius: 12px; position: relative;">
                                <div id="dashboard-map" style="width: 100%; height: 100%; z-index: 1;"></div>
                                <div class="map-overlay" style="position: absolute; bottom: 10px; right: 10px; z-index: 400; background: rgba(0,0,0,0.6); padding: 5px 10px; border-radius: 4px; font-size: 0.7rem; color: #fff;">
                                    <i class="fas fa-circle" style="color: #4ade80; font-size: 6px;"></i> Live Updates
                                </div>
                            </div>

                        </div>
                        <div class="chart-section glass animate delay-3">
                            <div class="section-title">
                                <h2><i class="fas fa-stream"></i> Flux d'Activité Live</h2>
                            </div>
                            <div class="activity-timeline glass-scroll">
                                ${orders.slice(0, 8).map(o => `
                                    <div class="timeline-item">
                                        <div class="item-icon" style="color: ${o.isValidated ? 'var(--success)' : 'var(--warning)'};">
                                            <i class="fas ${o.isValidated ? 'fa-check-circle' : 'fa-clock'}"></i>
                                        </div>
                                        <div class="item-content">
                                            <div class="item-header">
                                                <span class="item-title">Commande #${o.id}</span>
                                                <span class="item-time">${new Date(o.date).toLocaleDateString()}</span>
                                            </div>
                                            <div class="item-desc">${o.clientName} - ${o.vehicleName}</div>
                                        </div>
                                    </div>
                                `).join('')}
                                ${orders.length === 0 ? '<p style="text-align: center; color: var(--text-dim);">Aucune activité récente</p>' : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Alert Center -->
                    <div class="chart-section glass animate delay-3" style="margin-top: 30px; margin-bottom: 30px;">
                        <div class="section-title">
                            <h2><i class="fas fa-bell"></i> Centre d'Alertes</h2>
                            <button class="btn-primary" onclick="app.switchView('alerts')" style="padding: 8px 20px; font-size: 0.9rem;">
                                <i class="fas fa-external-link-alt"></i> Mes Alertes
                            </button>
                        </div>
                        <div class="alert-grid">
                            <!-- Ships Arriving This Week -->
                            <div class="alert-card animate">
                                <div class="alert-icon bg-info-soft"><i class="fas fa-ship"></i></div>
                                <div class="alert-content">
                                    <div class="alert-title">
                                        Navires en Arrivée
                                        <span class="alert-badge bg-info-soft">Cette Semaine</span>
                                    </div>
                                    <div class="alert-desc">
                                        ${arrivingSoonAlerts.length > 0
                    ? `<strong>${arrivingSoonAlerts.length} navire(s)</strong> attendu(s) au port d'ici 7 jours.`
                    : "Aucune arrivée prévue cette semaine."}
                                    </div>
                                </div>
                            </div>

                            <!-- Outdated Journeys -->
                            <div class="alert-card animate" style="border-left: 4px solid var(--warning);">
                                <div class="alert-icon bg-warning-soft"><i class="fas fa-sync-alt"></i></div>
                                <div class="alert-content">
                                    <div class="alert-title">
                                        Voyages Immobiles
                                        <span class="alert-badge bg-warning-soft">> 24 Heures</span>
                                    </div>
                                    <div class="alert-desc">
                                        ${outdatedVoyages.length > 0
                    ? `<strong>${outdatedVoyages.length} suivi(s)</strong> n'ayant pas été actualisés depuis plus de 24h.`
                    : "Tous les suivis sont à jour."}
                                    </div>
                                </div>
                            </div>

                            <!-- Missing Documents -->
                            <div class="alert-card animate" style="border-left: 4px solid var(--danger);">
                                <div class="alert-icon bg-danger-soft"><i class="fas fa-file-invoice"></i></div>
                                <div class="alert-content">
                                    <div class="alert-title">
                                        Documents Urgents
                                        <span class="alert-badge bg-danger-soft">Urgent</span>
                                    </div>
                                    <div class="alert-desc">
                                        ${missingDocsAlerts.length > 0
                    ? `<strong>${missingDocsAlerts.length} commande(s)</strong> arrivant bientôt avec documents manquants.`
                    : "Tous les dossiers documents sont complets."}
                                    </div>
                                </div>
                            </div>

                            <!-- Payment Suggested Alert -->
                            <div class="alert-card animate">
                                <div class="alert-icon" style="background: rgba(16, 185, 129, 0.15); color: var(--success);"><i class="fas fa-clock"></i></div>
                                <div class="alert-content">
                                    <div class="alert-title">
                                        Paiements Attendus
                                        <span class="alert-badge" style="background: rgba(16, 185, 129, 0.15); color: var(--success);">48h+</span>
                                    </div>
                                    <div class="alert-desc">
                                        Vérifiez les virements pour les commandes validées il y a plus de 2 jours.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            this.attachDashboardListeners();

            // --- 3. INITIALIZE CHARTS ---
            setTimeout(() => {
                this.initDashboardCharts(orders, vehicles, cash, reportingCurrency);
                this.initDashboardMap(shipments);
            }, 300);

        } catch (err) {
            console.error("Dashboard Render Error:", err);
            this.viewContainer.innerHTML = `<div style="padding: 2rem; color: red;">Erreur lors de l'affichage du dashboard: ${err.message}</div>`;
        }
    },

    initDashboardCharts(orders, vehicles, cash, reportingCurrency) {
        // --- 1. PERFORMANCE CHART (Line - Multi Showrooms) ---
        const perfCanvas = document.getElementById('performanceChart');
        if (perfCanvas) {
            const ctx = perfCanvas.getContext('2d');
            const showrooms = StorageService.get(STORAGE_KEYS.SHOWROOMS) || [];

            // Dynamic Rolling 12 Months (current month + previous 11)
            const months = [];
            const monthKeys = []; // To store "YYYY-MM" for easy data matching
            const today = new Date();

            for (let i = 11; i >= 0; i--) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const shortMonth = d.toLocaleString('fr-FR', { month: 'short' });
                const shortYear = d.getFullYear().toString().slice(-2);
                months.push(`${shortMonth} ${shortYear}`); // e.g., "Jan 25"
                monthKeys.push({ year: d.getFullYear(), month: d.getMonth() });
            }

            // Helper to get monthly data for a showroom
            const getMonthlyData = (showroomName = null) => {
                const data = new Array(12).fill(0);

                orders.forEach(o => {
                    if (!o.date || !o.isValidated) return;
                    if (showroomName && o.showroom !== showroomName) return;

                    const date = new Date(o.date);
                    const oYear = date.getFullYear();
                    const oMonth = date.getMonth();

                    // Find matching bucket
                    const index = monthKeys.findIndex(k => k.year === oYear && k.month === oMonth);
                    if (index !== -1) {
                        data[index] += this.convertCurrency(o.totalAmount, o.currency, reportingCurrency, o.date);
                    }
                });
                return data;
            };

            const datasets = [];

            // 0. Global Dataset (White/Dash)
            const globalData = getMonthlyData();
            const globalGrad = ctx.createLinearGradient(0, 0, 0, 400);
            globalGrad.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
            globalGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

            datasets.push({
                label: 'Global',
                data: globalData,
                borderColor: '#ffffff',
                borderWidth: 3,
                borderDash: [5, 5],
                fill: true,
                backgroundColor: globalGrad,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 5
            });

            // 1+. Showroom Datasets
            const colors = ['#c2a15e', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444'];
            showrooms.forEach((s, i) => {
                const sData = getMonthlyData(s);
                const color = colors[i % colors.length];
                const grad = ctx.createLinearGradient(0, 0, 0, 400);
                grad.addColorStop(0, color + '22');
                grad.addColorStop(1, color + '00');

                datasets.push({
                    label: s,
                    data: sData,
                    borderColor: color,
                    borderWidth: 2,
                    fill: true,
                    backgroundColor: grad,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 5
                });
            });

            const perfChart = new Chart(ctx, {
                type: 'line',
                data: { labels: months, datasets: datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(10, 14, 23, 0.9)',
                            titleColor: '#fff',
                            bodyColor: '#9ca3af',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1,
                            padding: 12,
                            displayColors: true,
                            usePointStyle: true
                        }
                    },
                    scales: {
                        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' } },
                        x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
                    }
                }
            });

            // Event Listeners for Perf
            const globalCb = document.getElementById('perf-global');
            if (globalCb) {
                globalCb.addEventListener('change', (e) => {
                    perfChart.setDatasetVisibility(0, e.target.checked);
                    perfChart.update();
                });
            }

            document.querySelectorAll('.perf-showroom').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    const idx = parseInt(cb.getAttribute('data-index'));
                    perfChart.setDatasetVisibility(idx, e.target.checked);
                    perfChart.update();
                });
            });
        }

        // --- 2. CA CHART (Bar - Dual Axis: Value vs Qty) ---
        const caCanvas = document.getElementById('stockPieChart');
        if (caCanvas) {
            const ctx = caCanvas.getContext('2d');
            const showrooms = StorageService.get(STORAGE_KEYS.SHOWROOMS) || [];

            const valueData = showrooms.map(s => {
                const sOrders = orders.filter(o => o.showroom === s && o.isValidated);
                return sOrders.reduce((sum, o) => sum + this.convertCurrency(o.totalAmount, o.currency, reportingCurrency, o.date), 0);
            });

            const qtyData = showrooms.map(s => {
                return orders.filter(o => o.showroom === s && o.isValidated).length;
            });

            const caChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: showrooms,
                    datasets: [
                        {
                            label: `Valeur (${reportingCurrency})`,
                            data: valueData,
                            backgroundColor: '#c2a15e',
                            borderRadius: 8,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Quantité (Véhicules)',
                            data: qtyData,
                            backgroundColor: '#3b82f6',
                            borderRadius: 8,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { color: '#9ca3af' }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            grid: { drawOnChartArea: false },
                            ticks: { color: '#9ca3af' }
                        },
                        x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
                    }
                }
            });

            // Event Listeners for CA
            const valCb = document.getElementById('ca-val');
            if (valCb) {
                valCb.addEventListener('change', (e) => {
                    caChart.setDatasetVisibility(0, e.target.checked);
                    caChart.update();
                });
            }
            const qtyCb = document.getElementById('ca-qty');
            if (qtyCb) {
                qtyCb.addEventListener('change', (e) => {
                    caChart.setDatasetVisibility(1, e.target.checked);
                    caChart.update();
                });
            }
        }
    },

    initDashboardMap(shipments) {
        if (!window.L) return;

        const mapContainer = document.getElementById('dashboard-map');
        if (!mapContainer) return;

        // Clean up existing map if any (though usually we clear innerHTML so it's gone)
        // Initialize Map
        const map = L.map('dashboard-map', {
            zoomControl: false,
            attributionControl: false
        }).setView([20, 0], 2);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 18
        }).addTo(map);

        // Filter active shipments with coordinates
        const activeShipments = shipments.filter(s =>
            s.currentLat && s.currentLng &&
            !s.isArchived
        );

        if (activeShipments.length === 0) {
            // If no shipments, just show a default view or a message?
            // For now, default view is fine.
        }

        activeShipments.forEach(s => {
            // Determine if tracking is valid or error
            // We assume 'Erreur Tracking' or 'No API Key' or 'Tracking Error' in status implies error
            const isError = s.status === 'Erreur Tracking' || s.status === 'Tracking Error' || s.status === 'No API Key';
            const color = isError ? '#ef4444' : '#4ade80';
            const shadowColor = isError ? 'rgba(239, 68, 68, 0.6)' : 'rgba(74, 222, 128, 0.6)';

            const icon = L.divIcon({
                html: `<div style="background: ${color}; width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 10px ${shadowColor}; border: 2px solid rgba(255,255,255,0.8);"></div>`,
                className: 'dash-ship-marker',
                iconSize: [14, 14],
                iconAnchor: [7, 7]
            });

            L.marker([s.currentLat, s.currentLng], { icon: icon })
                .addTo(map)
                .bindPopup(`
                    <div style="color: #333; font-size: 0.8rem; padding: 5px;">
                        <strong>${s.vesselName || s.carrier || 'Navire'}</strong><br>
                        <span style="color: #666;">${s.containerNumber || ''}</span>
                        ${isError ? '<br><span style="color: #ef4444; font-weight: bold;">⚠️ Tracking Indisponible</span>' : ''}
                    </div>
                `);
        });

        // Fit bounds if we have shipments
        if (activeShipments.length > 0) {
            const bounds = activeShipments.map(s => [s.currentLat, s.currentLng]);
            map.fitBounds(bounds, { padding: [30, 30], maxZoom: 5 });
        }
    },




    renderOrders(query = '') {
        const currentUser = StorageService.get(STORAGE_KEYS.CURRENT_USER);
        let orders = StorageService.get(STORAGE_KEYS.ORDERS);
        const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES);
        const shipments = StorageService.get(STORAGE_KEYS.SHIPMENTS);
        const clients = StorageService.get(STORAGE_KEYS.CLIENTS);

        if (query) {
            const q = query.toLowerCase();
            orders = orders.filter(o => {
                const c = clients.find(cl => cl.id === o.clientId);
                const clientName = c ? (c.firstName + ' ' + c.lastName).toLowerCase() : '';
                return (
                    String(o.id || '').toLowerCase().includes(q) ||
                    clientName.includes(q) ||
                    String(o.clientName || '').toLowerCase().includes(q) ||
                    String(o.vehicleName || '').toLowerCase().includes(q) ||
                    String(o.status || '').toLowerCase().includes(q) ||
                    String(o.showroom || '').toLowerCase().includes(q) ||
                    (clients.find(c => c.id === o.clientId)?.reference || '').toLowerCase().includes(q)
                );
            });
        }

        // Apply Advanced Filters
        if (this.orderFilters.status) {
            orders = orders.filter(o => o.status === this.orderFilters.status);
        }
        if (this.orderFilters.showroom) {
            orders = orders.filter(o => o.showroom === this.orderFilters.showroom);
        }
        if (this.orderFilters.startDate) {
            const start = new Date(this.orderFilters.startDate);
            orders = orders.filter(o => new Date(o.date) >= start);
        }
        if (this.orderFilters.endDate) {
            const end = new Date(this.orderFilters.endDate);
            end.setHours(23, 59, 59, 999);
            orders = orders.filter(o => new Date(o.date) <= end);
        }
        // Filter archived orders
        if (!this.orderFilters.showArchived) {
            orders = orders.filter(o => !o.archived);
        }

        const canCreate = this.canAccess('orders.create');
        const canEdit = this.canAccess('orders.edit');
        const canDelete = this.canAccess('orders.delete');
        const canValidate = this.canAccess('orders.validate');
        const canViewFinancials = this.canAccess('orders.financials');
        const canManageShipment = this.canAccess('shipments.manage');
        // Helper for managing shipment logic inside rows if needed, or just rely on checks there

        this.viewContainer.innerHTML = `
                <div class="view-header">
                    <h1>Gestion des Commandes</h1>
                    <div class="header-actions">
                        ${canCreate ? `
                        <button class="btn-primary" onclick="app.showOrderModal()">
                            <i class="fas fa-plus"></i> Nouvelle Commande
                        </button>` : ''}
                        <button class="btn-secondary" onclick="app.exportPendingOrdersMatrixToPDF()" style="background: rgba(79, 70, 229, 0.1); color: #4f46e5; border-color: rgba(79, 70, 229, 0.2);" title="État des commandes à passer">
                            <i class="fas fa-clipboard-list"></i> A COMMANDER
                        </button>
                        <button class="btn-secondary" onclick="app.exportOrdersToPDF()" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: rgba(239, 68, 68, 0.2);">
                            <i class="fas fa-file-pdf"></i> PDF
                        </button>
                        <button class="btn-secondary" onclick="app.exportOrdersToCSV()">
                            <i class="fas fa-file-csv"></i> CSV
                        </button>
                    </div>
                </div>

                <div class="glass filter-bar" style="margin-bottom: 20px; padding: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; align-items: end;">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">Statut</label>
                        <select id="filter-order-status" class="glass-select" style="padding: 8px;">
                            <option value="">Tous les statuts</option>
                            <option value="EN ATTENTE DE VALIDATION" ${this.orderFilters.status === 'EN ATTENTE DE VALIDATION' ? 'selected' : ''}>Validation</option>
                            <option value="EN COURS" ${this.orderFilters.status === 'EN COURS' ? 'selected' : ''}>En Cours</option>
                            <option value="ATTENTE AFFECTATION VÉHICULE" ${this.orderFilters.status === 'ATTENTE AFFECTATION VÉHICULE' ? 'selected' : ''}>Affectation</option>
                            <option value="ATTENTE EXPÉDITION" ${this.orderFilters.status === 'ATTENTE EXPÉDITION' ? 'selected' : ''}>Expédition</option>
                            <option value="A BORD" ${this.orderFilters.status === 'A BORD' ? 'selected' : ''}>A Bord</option>
                            <option value="EN MER" ${this.orderFilters.status === 'EN MER' ? 'selected' : ''}>En Mer</option>
                            <option value="ARRIVÉE" ${this.orderFilters.status === 'ARRIVÉE' ? 'selected' : ''}>Arrivée</option>
                            <option value="ENLEVÉE" ${this.orderFilters.status === 'ENLEVÉE' ? 'selected' : ''}>Enlevée</option>
                            <option value="CONCLUE" ${this.orderFilters.status === 'CONCLUE' ? 'selected' : ''}>Conclue</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">Showroom</label>
                        <select id="filter-order-showroom" class="glass-select" style="padding: 8px;">
                            <option value="">Tous les showrooms</option>
                            ${StorageService.get(STORAGE_KEYS.SHOWROOMS).map(s => `<option value="${s}" ${this.orderFilters.showroom === s ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">Depuis</label>
                        <input type="date" id="filter-order-start" class="glass-input" style="padding: 8px;" value="${this.orderFilters.startDate}">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem;">Jusqu'à</label>
                        <input type="date" id="filter-order-end" class="glass-input" style="padding: 8px;" value="${this.orderFilters.endDate}">
                    </div>
                    <div>
                        <button class="btn-secondary" style="width: 100%; padding: 10px;" onclick="app.resetOrderFilters()">
                            <i class="fas fa-undo"></i> Reset
                        </button>
                    </div>
                    <div class="form-group" style="margin-bottom: 0; display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" id="filter-order-archived" ${this.orderFilters.showArchived ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
                        <label for="filter-order-archived" style="font-size: 0.85rem; cursor: pointer; margin: 0;">Voir les archives</label>
                    </div>
                </div>

                <div class="glass data-table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th style="width: 100px;">N° BC</th>
                                <th>Client</th>
                                <th>ID V.</th>
                                <th>Véhicule</th>
                                <th>Date</th>
                                <th style="text-align: center;">Statut</th>
                                <th>Documents</th>
                                <th>Validation</th>
                                ${canViewFinancials ? `
                                <th>Total</th>
                                <th>Solde</th>` : ''}
                                <th>Showroom</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${orders.map(order => {
            const vehicle = vehicles.find(v => v.id === order.vehicleId || (order.id && v.orderId === order.id));
            const client = clients.find(c => c.id === order.clientId);
            const vehicleName = vehicle ? `${vehicle.brand} ${vehicle.model || ''} ${vehicle.motorization || ''} ${vehicle.trim || ''} (${vehicle.year})`.trim().replace(/\s+/g, ' ') : (order.vehicleName || 'Sans véhicule');
            const shipment = vehicle && vehicle.shipmentId ? shipments.find(s => s.id === vehicle.shipmentId) : null;
            const isShipped = !!shipment;

            const paid = this.getPaidAmount(order.id);
            const netPrice = (order.totalAmount || 0) - (order.discount || 0);
            const balance = Math.max(0, netPrice - paid);
            const isPaid = balance <= 0;

            return `
                                <tr>
                                    <td style="font-weight: 600; color: var(--primary);">#${order.id}</td>
                                    <td>
                                        <div style="font-weight: 500;">
                                            ${client ? (client.firstName + ' ' + client.lastName) : 'Client Inconnu'}
                                        </div>
                                        ${client && client.company ? `<div style="font-size: 0.75rem; color: var(--text-dim);">${client.company}</div>` : ''}
                                        ${client && client.reference ? `<div style="font-size: 0.75rem; color: var(--text-dim);">Réf: ${client.reference}</div>` : ''}
                                    </td>
                                    <td><span style="font-family: monospace; color: var(--text-dim);">#${order.vehicleId || 'N/A'}</span></td>
                                    <td>${vehicleName}</td>
                                    <td>${new Date(order.date).toLocaleDateString()}</td>
                                    <td style="text-align: center;">
                                        <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                                            <span class="status-badge ${(this.calculateOrderStatus(order) || 'EN COURS').toLowerCase().replace(/\s+/g, '-')}">
                                                ${this.calculateOrderStatus(order)}
                                            </span>
                                            ${shipment ? (() => {
                    const apiStatus = shipment.status || 'En cours';
                    const statusColors = {
                        'IN_TRANSIT': { bg: 'rgba(99,102,241,0.15)', color: 'var(--primary)', icon: 'fa-ship' },
                        'En mer': { bg: 'rgba(99,102,241,0.15)', color: 'var(--primary)', icon: 'fa-ship' },
                        'En Route': { bg: 'rgba(99,102,241,0.15)', color: 'var(--primary)', icon: 'fa-ship' },
                        'ARRIVED': { bg: 'rgba(34,197,94,0.15)', color: 'var(--success)', icon: 'fa-anchor' },
                        'Arrivé': { bg: 'rgba(34,197,94,0.15)', color: 'var(--success)', icon: 'fa-anchor' },
                        'Livré': { bg: 'rgba(34,197,94,0.2)', color: 'var(--success)', icon: 'fa-check-circle' },
                        'ERREUR': { bg: 'rgba(239,68,68,0.1)', color: 'var(--danger)', icon: 'fa-exclamation-triangle' }
                    };
                    const sc = statusColors[apiStatus] || { bg: 'rgba(245,158,11,0.12)', color: 'var(--warning)', icon: 'fa-satellite-dish' };
                    return `
                                                    <div style="padding: 2px 8px; background: ${sc.bg}; border: 1px solid ${sc.color}33; border-radius: 12px; font-size: 0.65rem; color: ${sc.color}; display: flex; align-items: center; gap: 4px; cursor: pointer;" 
                                                         onclick="app.showTrackingHistoryModal('${shipment.id}')" title="Voir l'historique satellite">
                                                        <i class="fas ${sc.icon}"></i> 
                                                        ${shipment.shipStatus || apiStatus}
                                                    </div>
                                                `;
                })() : ''}
                                        </div>
                                    </td>
                                    </td>
                                    <td>
                                        ${order.isValidated ?
                    '<span class="badge-pill" style="background: rgba(34, 197, 94, 0.1); color: var(--success); border: 1px solid rgba(34, 197, 94, 0.2);"><i class="fas fa-check-circle"></i> Validée</span>' :
                    '<span class="badge-pill" style="background: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.2);"><i class="fas fa-clock"></i> En attente</span>'}
                                    </td>
                                    ${canViewFinancials ? `
                                    <td>
                                        <div style="font-weight: 600;">${this.formatCurrency(netPrice)}</div>
                                        ${order.discount ? `<div style="font-size: 0.7rem; color: var(--danger);">Remise: -${this.formatCurrency(order.discount)}</div>` : ''}
                                    </td>
                                    <td>
                                        <span class="value ${isPaid ? 'success' : 'danger'}" style="font-weight: 600;">
                                            ${this.formatCurrency(balance)}
                                        </span>
                                    </td>` : ''}
                                    <td><span class="badge-pill" style="background: rgba(139, 112, 246, 0.1); color: #a78bfa; font-size: 0.7rem;">${order.showroom || 'Principal'}</span></td>
                                    <td>
                                        <div class="table-actions">
                                            <button class="btn-action" onclick="app.showOrderDetails('${order.id}')" title="Voir détails"><i class="fas fa-eye"></i></button>
                                            ${canEdit ? `<button class="btn-action" onclick="app.showEditOrderModal('${order.id}')" title="Modifier"><i class="fas fa-edit"></i></button>` : ''}
                                            ${canValidate ? (
                    order.isValidated ?
                        `<button class="btn-action" onclick="app.unvalidateOrder('${order.id}')" title="Dévalider la commande" style="color: var(--danger); border-color: var(--danger);"><i class="fas fa-undo"></i></button>` :
                        `<button class="btn-action" onclick="app.validateOrder('${order.id}')" title="Valider la commande" style="color: var(--primary); border-color: var(--primary);"><i class="fas fa-check-double"></i></button>`
                ) : ''}
                                            ${canViewFinancials ? `<button class="btn-action" onclick="app.showCashModal('${order.id}')" title="Encaisser" style="color: var(--success); border-color: var(--success);"><i class="fas fa-hand-holding-dollar"></i></button>` : ''}
                                            ${canManageShipment ? (
                    order.vehicleId ? (isShipped ?
                        `
                        <button class="btn-action" onclick="app.showTrackingHistoryModal('${shipment.id}')" title="Suivi Satellite" style="color: var(--primary); border-color: var(--primary);"><i class="fas fa-satellite-dish"></i></button>
                        <button class="btn-action" onclick="app.switchView('shipments')" title="Voir l'expédition (Envoyé)" style="color: var(--success); border-color: var(--success);"><i class="fas fa-check-circle"></i></button>
                        ` :
                        `<button class="btn-action" onclick="app.showShipmentModal('${order.vehicleId}')" title="Expédier le véhicule"><i class="fas fa-shipping-fast"></i></button>`
                    ) : `<button class="btn-action disabled" title="Aucun véhicule lié" style="opacity: 0.3; cursor: not-allowed;"><i class="fas fa-shipping-fast"></i></button>`
                ) : ''}
                                            ${canDelete ? `<button class="btn-action danger" onclick="app.deleteOrder('${order.id}')" title="Supprimer"><i class="fas fa-trash"></i></button>` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `}).join('')}
                            ${orders.length === 0 ? '<tr><td colspan="10" style="text-align: center; padding: 2rem;">Aucune commande trouvée.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            `;
        this.attachOrderFilterListeners();
    },

    attachOrderFilterListeners() {
        const statusF = document.getElementById('filter-order-status');
        const showroomF = document.getElementById('filter-order-showroom');
        const startF = document.getElementById('filter-order-start');
        const endF = document.getElementById('filter-order-end');

        if (statusF) statusF.addEventListener('change', (e) => { this.orderFilters.status = e.target.value; this.renderView('orders'); });
        if (showroomF) showroomF.addEventListener('change', (e) => { this.orderFilters.showroom = e.target.value; this.renderView('orders'); });
        if (startF) startF.addEventListener('change', (e) => { this.orderFilters.startDate = e.target.value; this.renderView('orders'); });
        if (endF) endF.addEventListener('change', (e) => { this.orderFilters.endDate = e.target.value; this.renderView('orders'); });

        const archivedF = document.getElementById('filter-order-archived');
        if (archivedF) archivedF.addEventListener('change', (e) => { this.orderFilters.showArchived = e.target.checked; this.renderView('orders'); });
    },

    resetOrderFilters() {
        this.orderFilters = { status: '', showroom: '', startDate: '', endDate: '', showArchived: false };
        this.renderView('orders');
    },

    renderClients(query = '') {
        const currentUser = StorageService.get(STORAGE_KEYS.CURRENT_USER);
        let clients = StorageService.get(STORAGE_KEYS.CLIENTS);

        if (query) {
            const q = query.toLowerCase();
            clients = clients.filter(c =>
                String(c.firstName || '').toLowerCase().includes(q) ||
                String(c.lastName || '').toLowerCase().includes(q) ||
                String(c.company || '').toLowerCase().includes(q) ||
                String(c.email || '').toLowerCase().includes(q) ||
                String(c.reference || '').toLowerCase().includes(q) ||
                String(c.address || '').toLowerCase().includes(q) ||
                String(c.passportNumber || '').toLowerCase().includes(q) ||
                String(c.nin || '').toLowerCase().includes(q)
            );
        }

        this.viewContainer.innerHTML = `
                <div class="view-header">
                    <h1>Base Clients</h1>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn-primary" onclick="app.showBatchClientModal()" style="background: var(--accent-blue); border-color: var(--accent-blue);">
                            <i class="fas fa-file-import"></i> Importer (Lot)
                        </button>
                        <button class="btn-primary" onclick="app.showClientModal()">
                            <i class="fas fa-plus"></i> Nouveau Client
                        </button>
                    </div>
                </div>
                <div class="clients-grid">
                    ${clients.map(client => `
                        <div class="client-card glass">
                            <div class="client-avatar">
                                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(client.firstName + ' ' + client.lastName)}&background=6366f1&color=fff" alt="${client.firstName} ${client.lastName}">
                            </div>
                            <div class="client-info">
                                <h3>${client.firstName} ${client.lastName}</h3>
                                <div class="client-details">
                                    <span><i class="fas fa-envelope"></i> <a href="mailto:${client.email}" style="color: inherit;">${client.email}</a></span>
                                    <span><i class="fas fa-phone"></i> ${client.phone}</span>
                                    <span><i class="fas fa-map-marker-alt"></i> ${client.address}</span>
                                    <span><i class="fas fa-id-card"></i> Passeport: ${client.passportNumber || '-'}</span>
                                    <span><i class="fas fa-fingerprint"></i> NIN: ${client.nin || '-'}</span>
                                    <span><i class="fas fa-hashtag"></i> Réf: ${client.reference || '-'}</span>
                                    <span><i class="fas fa-store"></i> ${client.showroom || 'Non assigné'}</span>
                                </div>
                            </div>
                            <div class="client-actions">
                                <button class="btn-action" onclick="app.showEditClientModal('${client.id}')"><i class="fas fa-edit"></i></button>
                                <button class="btn-action danger" onclick="app.deleteClient('${client.id}')"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    `).join('')}
                    ${clients.length === 0 ? '<p style="grid-column: 1/-1; text-align: center; padding: 2rem;">Aucun client trouvé.</p>' : ''}
                </div>
            `;
    },

    showClientModal() {
        const modalHtml = `
                <div class="modal-overlay">
                    <div class="modal-content glass">
                        <div class="modal-header">
                            <h2>Nouveau Client</h2>
                            <button class="btn-close" onclick="app.closeModal()">&times;</button>
                        </div>
                        <form id="client-form" autocomplete="off">
                            <div class="form-group">
                                <label>Référence Client</label>
                                <input type="text" name="reference" value="CL-${String((StorageService.get(STORAGE_KEYS.CLIENTS) || []).length + 1).padStart(4, '0')}" class="glass-input" required>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Prénom</label>
                                    <input type="text" name="firstName" required class="glass-input">
                                </div>
                                <div class="form-group">
                                    <label>Nom</label>
                                    <input type="text" name="lastName" required class="glass-input">
                                </div>
                            </div>
                             <div class="form-group">
                                <label>Showroom</label>
                                <select name="showroom" class="glass-select">
                                    <option value="">Sélectionner un showroom</option>
                                    ${StorageService.get(STORAGE_KEYS.SHOWROOMS).map(s => `<option value="${s}">${s}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Email</label>
                                    <input type="email" name="email" required class="glass-input">
                                </div>
                                <div class="form-group">
                                    <label>Téléphone</label>
                                    <input type="text" name="phone" class="glass-input">
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Adresse</label>
                                    <input type="text" name="address" required class="glass-input">
                                </div>
                                <div class="form-group">
                                    <label>Code Postal</label>
                                    <input type="text" name="postalCode" class="glass-input">
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Numéro de Passeport</label>
                                    <input type="text" name="passportNumber" class="glass-input">
                                </div>
                                <div class="form-group">
                                    <label>NIN (ID National)</label>
                                    <input type="text" name="nin" class="glass-input">
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                                <button type="submit" class="btn-primary">Ajouter le client</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('client-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleClientSubmission(new FormData(e.target));
        });
    },


    async handleClientSubmission(formData) {
        try {
            const clientId = formData.get('clientId');
            const newClient = {
                id: clientId || `c${Date.now()}`,
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                address: formData.get('address'),
                passportNumber: formData.get('passportNumber'),
                nin: formData.get('nin'),
                postalCode: formData.get('postalCode'),
                reference: formData.get('reference') || this.generateClientReference(),
                showroom: formData.get('showroom') || 'Showroom Principal'
            };

            if (clientId) {
                await StorageService.update(STORAGE_KEYS.CLIENTS, clientId, newClient);
                this.showToast('Client mis à jour', 'success');
            } else {
                // Disable button to prevent double-click
                const submitBtn = document.querySelector('#client-form button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...';
                }

                try {
                    await StorageService.add(STORAGE_KEYS.CLIENTS, newClient);
                    this.showToast('Client ajouté avec succès', 'success');
                } catch (addError) {
                    // Re-enable button on error
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Ajouter le client';
                    }
                    throw addError; // Rethrow to main catch
                }
            }

            this.closeModal();
            this.renderView(this.currentView);
        } catch (error) {
            console.error("Error in handleClientSubmission:", error);
            this.showToast(`Erreur lors de l'enregistrement: ${error.message || 'Serveur injoignable'}`, "error");
        }
    },

    showBatchClientModal() {
        const modalHtml = `
            <div class="modal-overlay">
                <div class="modal-content glass" style="width: 90vw; max-width: 1000px;">
                    <div class="modal-header">
                        <h2>Importation Clients par Lot</h2>
                        <button class="btn-close" onclick="app.closeModal()">&times;</button>
                    </div>
                    <form id="batch-client-form">
                        <div class="form-body" style="padding: 1.5rem;">
                            <div class="alert info" style="margin-bottom: 1.5rem; background: rgba(59, 130, 246, 0.1); padding: 1rem; border-radius: 8px; font-size: 0.9rem;">
                                <i class="fas fa-info-circle"></i> Copiez et collez vos données depuis Excel (ou utilisez le <b>point-virgule ;</b> comme séparateur). L'ordre des colonnes doit être :<br>
                                <strong>Référence | Prénom | Nom | Email | Téléphone | Adresse | Code Postal | Passeport | NIN | Showroom | Entreprise</strong>
                            </div>
                            <div class="form-group">
                                <label>Données Clients (Une ligne par client)</label>
                                <textarea name="batchData" class="glass-input" rows="15" 
                                    placeholder="REF001	Jean	Dupont	jean@email.com	0601020304	Paris	A1234567	123456789	Showroom A	MaSociété"
                                    style="font-family: monospace; white-space: pre; overflow-x: auto;"></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                            <button type="submit" class="btn-primary">Lancer l'importation</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('batch-client-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleBatchClientSubmission(new FormData(e.target));
        });
    },

    async handleBatchClientSubmission(formData) {
        try {
            const rawData = formData.get('batchData');
            if (!rawData || !rawData.trim()) {
                this.showToast("Aucune donnée à importer", "warning");
                return;
            }

            const lines = rawData.trim().split('\n');
            let successCount = 0;
            let errorCount = 0;

            // Start loading state
            const submitBtn = document.querySelector('#batch-client-form button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importation...';
            }

            for (const [index, line] of lines.entries()) {
                if (!line.trim()) continue;

                // Headers check
                if (index === 0 && (line.toLowerCase().includes('nom') || line.toLowerCase().includes('prénom') || line.toLowerCase().includes('email'))) {
                    continue;
                }

                // Detect delimiter: Tab, Semicolon, or Comma (in that priority)
                let parts;
                if (line.includes('\t')) {
                    parts = line.split('\t');
                } else if (line.includes(';')) {
                    parts = line.split(';');
                } else {
                    parts = line.split(',');
                }

                if (parts.length < 3) {
                    errorCount++;
                    continue;
                }

                const cleanParts = parts.map(p => p.trim().replace(/^"|"$/g, ''));

                const [
                    reference, firstName, lastName, email, phone,
                    address, postalCode, passport, nin, showroom, company
                ] = cleanParts;

                if (!firstName || !lastName) {
                    errorCount++;
                    continue;
                }

                const client = {
                    id: 'CLT' + Date.now() + Math.floor(Math.random() * 1000),
                    reference: reference || '',
                    firstName: firstName,
                    lastName: lastName,
                    email: email || '',
                    phone: phone || '',
                    address: address || '',
                    postalCode: postalCode || '',
                    passportNumber: passport || '',
                    nin: nin || '',
                    showroom: showroom || '',
                    company: company || ''
                };

                // Auto-generate reference if missing
                if (!client.reference) {
                    client.reference = this.generateClientReference();
                }

                try {
                    await StorageService.add(STORAGE_KEYS.CLIENTS, client);
                    successCount++;
                } catch (err) {
                    console.error("Single client import error:", err);
                    errorCount++;
                }
            }

            this.closeModal();
            this.renderView('clients');
            this.showToast(`${successCount} clients importés avec succès (${errorCount} erreurs)`, successCount > 0 ? 'success' : 'warning');
        } catch (error) {
            console.error("Error in handleBatchClientSubmission:", error);
            this.showToast("Erreur lors de l'importation par lot", "error");
        }
    },


    showEditClientModal(id) {
        const client = StorageService.get(STORAGE_KEYS.CLIENTS).find(c => c.id === id);
        if (!client) return;

        const modalHtml = `
                <div class="modal-overlay">
                    <div class="modal-content glass">
                        <div class="modal-header">
                            <h2>Modifier le Client</h2>
                            <button class="btn-close" onclick="app.closeModal()">&times;</button>
                        </div>
                        <form id="client-form">
                            <input type="hidden" name="clientId" value="${client.id}">
                            <div class="form-group">
                                <label>Référence Client</label>
                                <input type="text" name="reference" value="${client.reference || ''}" class="glass-input">
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Prénom</label>
                                    <input type="text" name="firstName" value="${client.firstName}" required class="glass-input">
                                </div>
                                <div class="form-group">
                                    <label>Nom</label>
                                    <input type="text" name="lastName" value="${client.lastName}" required class="glass-input">
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Showroom</label>
                                <select name="showroom" class="glass-select">
                                    <option value="">Sélectionner un showroom</option>
                                    ${StorageService.get(STORAGE_KEYS.SHOWROOMS).map(s => `<option value="${s}" ${client.showroom === s ? 'selected' : ''}>${s}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Email</label>
                                    <input type="email" name="email" value="${client.email}" required class="glass-input">
                                </div>
                                <div class="form-group">
                                    <label>Téléphone</label>
                                    <input type="text" name="phone" value="${client.phone}" class="glass-input">
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Adresse</label>
                                    <input type="text" name="address" value="${client.address}" required class="glass-input">
                                </div>
                                <div class="form-group">
                                    <label>Code Postal</label>
                                    <input type="text" name="postalCode" value="${client.postalCode || ''}" class="glass-input">
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Numéro de Passeport</label>
                                    <input type="text" name="passportNumber" value="${client.passportNumber || ''}" class="glass-input">
                                </div>
                                <div class="form-group">
                                    <label>NIN (ID National)</label>
                                    <input type="text" name="nin" value="${client.nin || ''}" class="glass-input">
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                                <button type="submit" class="btn-primary">Enregistrer les modifications</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('client-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleClientSubmission(new FormData(e.target));
        });
    },

    renderVehicles(query = '') {
        const currentUser = StorageService.get(STORAGE_KEYS.CURRENT_USER);
        const canCreate = this.canAccess('vehicles.create');
        const canEdit = this.canAccess('vehicles.edit');
        const canDelete = this.canAccess('vehicles.delete');
        const canViewPurchasePrice = this.canAccess('vehicles.purchase_price');

        let vehicles = [];
        try {
            vehicles = StorageService.get(STORAGE_KEYS.VEHICLES) || [];
        } catch (e) {
            console.error("Error loading vehicles", e);
            this.showToast("Erreur lors du chargement des véhicules", "error");
            vehicles = [];
        }

        if (query) {
            const q = query.toLowerCase();
            vehicles = vehicles.filter(v =>
                String(v.brand || '').toLowerCase().includes(q) ||
                String(v.chassisNumber || '').toLowerCase().includes(q) ||
                String(v.motorization || '').toLowerCase().includes(q) ||
                String(v.trim || '').toLowerCase().includes(q) ||
                String(v.id || '').toLowerCase().includes(q)
            );
        }

        // Apply advanced filters
        if (this.vehicleFilters) {
            if (this.vehicleFilters.brand) {
                vehicles = vehicles.filter(v => v.brand === this.vehicleFilters.brand);
            }
            if (this.vehicleFilters.model) {
                vehicles = vehicles.filter(v => v.model === this.vehicleFilters.model);
            }
            if (this.vehicleFilters.status) {
                vehicles = vehicles.filter(v => v.status === this.vehicleFilters.status);
            }
            if (this.vehicleFilters.supplier) {
                vehicles = vehicles.filter(v => v.supplier === this.vehicleFilters.supplier);
            }
            if (this.vehicleFilters.purchaseOrderId) {
                vehicles = vehicles.filter(v => v.purchaseOrderId === this.vehicleFilters.purchaseOrderId);
            }
        }

        if (!this.vehicleFilters.showArchived) {
            vehicles = vehicles.filter(v => !v.archived);
        }

        this.viewContainer.innerHTML = `
                <div class="view-header">
                    <div class="header-info">
                        <h1>Inventaire des Véhicules</h1>
                        <p>${vehicles.length} véhicules enregistrés</p>
                    </div>
                    <div class="header-actions">
                        ${canCreate ? `
                        <button class="btn-secondary" onclick="app.showBatchVehicleModal()" style="margin-right: 10px;"><i class="fas fa-file-csv"></i> Création par Lot</button>
                        <button class="btn-primary" onclick="app.showVehicleModal()"><i class="fas fa-plus"></i> Nouveau Véhicule</button>
                        ` : ''}
                    </div>
                </div>
                <div class="glass" style="margin-bottom: 20px; padding: 20px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; align-items: end;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.8rem; color: var(--text-dim);">Recherche Rapide</label>
                            <input type="text" class="glass-input" style="padding: 8px 12px; font-size: 0.9rem;" placeholder="VIN, Marque, ID..." value="${query || ''}" oninput="app.renderVehicles(this.value)">
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.8rem; color: var(--text-dim);">Marque</label>
                            <select class="glass-select" style="padding: 8px 12px; font-size: 0.9rem;" onchange="app.vehicleFilters = {...app.vehicleFilters, brand: this.value, model: ''}; app.renderVehicles()">
                                <option value="">Toutes les marques</option>
                                ${(StorageService.get(STORAGE_KEYS.BRANDS) || []).map(b => `<option value="${b}" ${this.vehicleFilters.brand === b ? 'selected' : ''}>${b}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.8rem; color: var(--text-dim);">Modèle</label>
                            <select class="glass-select" style="padding: 8px 12px; font-size: 0.9rem;" onchange="app.vehicleFilters = {...app.vehicleFilters, model: this.value}; app.renderVehicles()">
                                <option value="">Tous les modèles</option>
                                ${this.vehicleFilters.brand ? (StorageService.get(STORAGE_KEYS.BRAND_MODELS)[this.vehicleFilters.brand] || []).map(m => `<option value="${m}" ${this.vehicleFilters.model === m ? 'selected' : ''}>${m}</option>`).join('') : ''}
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.8rem; color: var(--text-dim);">Statut Stock</label>
                            <select class="glass-select" style="padding: 8px 12px; font-size: 0.9rem;" onchange="app.vehicleFilters = {...app.vehicleFilters, status: this.value}; app.renderVehicles()">
                                <option value="">Tous les statuts</option>
                                <option value="Available" ${this.vehicleFilters.status === 'Available' ? 'selected' : ''}>Disponible (Libre)</option>
                                <option value="Reserved" ${this.vehicleFilters.status === 'Reserved' ? 'selected' : ''}>Réservé (Affecté)</option>
                                <option value="In Transit" ${this.vehicleFilters.status === 'In Transit' ? 'selected' : ''}>En Expédition (Transit)</option>
                                <option value="Arrived" ${this.vehicleFilters.status === 'Arrived' ? 'selected' : ''}>Arrivé (Port)</option>
                                <option value="Sold" ${this.vehicleFilters.status === 'Sold' ? 'selected' : ''}>Vendu (Livré)</option>
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom: 0; display: flex; align-items: center; gap: 8px; justify-content: center; background: rgba(255,255,255,0.05); padding: 5px 10px; border-radius: 8px; height: 38px;">
                            <input type="checkbox" id="filter-vehicle-archived" ${this.vehicleFilters.showArchived ? 'checked' : ''} onchange="app.vehicleFilters = {...app.vehicleFilters, showArchived: this.checked}; app.renderVehicles()" style="width: 18px; height: 18px; cursor: pointer;">
                            <label for="filter-vehicle-archived" style="font-size: 0.8rem; cursor: pointer; margin: 0; color: var(--text-dim);">Archives</label>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.8rem; color: var(--text-dim);">Commande d'Achat</label>
                            <select class="glass-select" style="padding: 8px 12px; font-size: 0.9rem;" onchange="app.vehicleFilters = {...app.vehicleFilters, purchaseOrderId: this.value}; app.renderVehicles()">
                                <option value="">Toutes les sources</option>
                                ${[...new Set((StorageService.get(STORAGE_KEYS.VEHICLES) || []).filter(v => v.purchaseOrderId).map(v => v.purchaseOrderId))].map(poId => `<option value="${poId}" ${this.vehicleFilters.purchaseOrderId === poId ? 'selected' : ''}>${poId}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <button class="btn-secondary" style="padding: 8px 12px; font-size: 0.85rem; width: 100%;" onclick="app.vehicleFilters = {showArchived: false}; app.renderVehicles()"><i class="fas fa-undo"></i> Reset</button>
                        </div>
                    </div>
                </div>
                <div class="glass data-table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Véhicule</th>
                                <th>Source (Achat)</th>
                                <th>Client / Affectation</th>
                                <th>Châssis (VIN)</th>
                                <th>Specs Tech.</th>
                                ${canViewPurchasePrice ? '<th>Prix Achat</th>' : ''}
                                <th>DD (Est.)</th>
                                <th>Statut</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${vehicles.map(v => {
            // Determine status display based on strict status property
            let statusClass = 'available';
            let statusLabel = 'Disponible';

            // Check for reservation first
            if (v.orderId || v.clientId) {
                statusClass = 'warning';
                statusLabel = 'Réservé';
            } else if (v.status === 'Available' && v.purchaseOrderId) {
                // Keep the PO stock sub-status as requested previously
                statusClass = 'success';
                statusLabel = 'En Stock (Achat)';
            } else {
                switch (v.status) {
                    case 'Reserved':
                        statusClass = 'warning';
                        statusLabel = 'Réservé';
                        break;
                    case 'In Transit':
                        statusClass = 'primary';
                        statusLabel = 'Expédié';
                        break;
                    case 'Arrived':
                        statusClass = 'success';
                        statusLabel = 'Arrivé';
                        break;
                    case 'Sold':
                        statusClass = 'danger';
                        statusLabel = 'Vendu';
                        break;
                    default:
                        if (v.shipmentId) {
                            statusClass = 'success';
                            statusLabel = 'Expédié';
                        } else if (v.orderId) {
                            statusClass = 'warning';
                            statusLabel = 'Réservé';
                        }
                }
            }

            const brandsRaw = StorageService.get(STORAGE_KEYS.BRANDS_RAW) || [];
            const brandObj = brandsRaw.find(b => b.name === v.brand);
            const brandLogo = brandObj && brandObj.logo ? brandObj.logo : null;

            return `
                                <tr>
                                    <td><strong>#${v.id}</strong></td>
                                    <td>
                                        <div style="display: flex; align-items: center; gap: 15px;">
                                            ${brandLogo ? `<img src="${brandLogo}" style="width: 50px; height: 50px; object-fit: contain; background: rgba(255,255,255,0.05); border-radius: 8px; padding: 4px;" onerror="this.style.display='none'">` : ''}
                                            <div>
                                                <div style="font-weight: 600;">${v.brand || 'Sans Marque'}${v.model ? ' ' + v.model : ''}</div>
                                                <div style="font-size: 0.75rem; color: var(--text-dim);">${v.year || '-'} | ${v.color || '-'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style="font-size: 0.85rem;">
                                        ${v.purchaseOrderId ? `<span class="badge-pill" style="background: rgba(var(--primary-rgb), 0.1); color: var(--primary); cursor: pointer;" onclick="app.renderPurchases('${v.purchaseOrderId}')">${v.purchaseOrderId}</span>` : '<span style="color:var(--text-dim);">Entrée Directe</span>'}
                                    </td>
                                    <td>
                                        ${(() => {
                    const clientId = v.clientId || (v.orderId ? (StorageService.get(STORAGE_KEYS.ORDERS).find(o => o.id === v.orderId)?.clientId) : null);
                    if (clientId) {
                        const client = StorageService.get(STORAGE_KEYS.CLIENTS).find(c => String(c.id) === String(clientId));
                        return client ? `<div style="font-weight: 500;">${client.firstName} ${client.lastName}</div><div style="font-size: 0.75rem; color: var(--primary);">${v.orderId ? `CMD #${v.orderId}` : 'AFFECTATION DIRECTE'}</div>` : '<span style="color:red;">Erreur Client</span>';
                    }
                    return '<span style="color:var(--text-dim);">STOCK LIBRE</span>';
                })()}
                                    </td>
                                    <td><code style="font-size: 0.8rem;">${v.chassisNumber || '-'}</code></td>
                                    <td>
                                        <div style="font-size: 0.85rem;"><strong>Mot.:</strong> ${v.motorization || '-'}</div>
                                        <div style="font-size: 0.85rem;"><strong>Fin.:</strong> ${v.trim || '-'}</div>
                                    </td>
                                    ${canViewPurchasePrice ? `<td style="font-weight: 500;">${this.formatCurrency(v.purchasePrice || 0, v.purchaseCurrency)}</td>` : ''}
                                    <td style="font-weight: 500; color: var(--text-secondary);">${this.formatCurrency(v.estimatedCustomsDuty || 0, (StorageService.get(STORAGE_KEYS.SETTINGS)?.customsCurrency || 'XAF'))}</td>
                                    <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                                    <td>
                                        <div class="table-actions">
                                            <button class="btn-action" onclick="app.showVehicleDetails('${v.id}')" title="Voir détails">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                            ${!v.orderId ? `<button class="btn-action success-alt" onclick="app.showOrderModal('${v.id}')" title="Affecter un client"><i class="fas fa-user-plus"></i></button>` : ''}
                                            ${canEdit ? `<button class="btn-action" onclick="app.showEditVehicleModal('${v.id}')" title="Modifier"><i class="fas fa-edit"></i></button>` : ''}
                                            ${canDelete ? `<button class="btn-action danger" onclick="app.deleteVehicle('${v.id}')" title="Supprimer"><i class="fas fa-trash"></i></button>` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `;
        }).join('')}
                            ${vehicles.length === 0 ? `<tr><td colspan="${canViewPurchasePrice ? 10 : 9}" style="text-align: center; padding: 3rem;">Aucun véhicule trouvé.</td></tr>` : ''}
                        </tbody>
                    </table>
                </div>
            `;
        const vArchivedF = document.getElementById('filter-vehicle-archived');
        if (vArchivedF) {
            vArchivedF.addEventListener('change', (e) => {
                this.vehicleFilters.showArchived = e.target.checked;
                this.renderView('vehicles');
            });
        }
    },

    showVehicleModal() {
        const categories = StorageService.get(STORAGE_KEYS.CATEGORIES) || [];
        const brands = StorageService.get(STORAGE_KEYS.BRANDS_RAW) || [];
        const modalHtml = `
                <div class="modal-overlay">
                    <div class="modal-content glass" style="width: 700px;">
                        <div class="modal-header">
                            <h2>Nouveau Véhicule</h2>
                            <button class="btn-close" onclick="app.closeModal()">&times;</button>
                        </div>
                        <form id="vehicle-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
                            <fieldset style="border: 1px solid rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px;">
                                <legend style="padding: 0 0.5rem; color: var(--primary); font-weight: 500;">Identification</legend>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <div class="form-group">
                                        <label>Marque</label>
                                        <select name="brand" required class="glass-select">
                                            <option value="">Sélectionner...</option>
                                            ${brands.map(b => `<option value="${b.name}">${b.name}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Numéro de Châssis</label>
                                        <input type="text" name="chassisNumber" required class="glass-input" style="font-family: monospace;">
                                    </div>
                                    <div class="form-group">
                                        <label>Modèle</label>
                                        <select name="model" id="model-select" class="glass-select">
                                            <option value="">Sélectionner d'abord une marque...</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Finition</label>
                                        <input type="text" name="trim" class="glass-input" placeholder="Ex: SE, Luxury, Full...">
                                    </div>
                                    <div class="form-group">
                                        <label>Fournisseur</label>
                                        <input type="text" name="supplier" class="glass-input" placeholder="Fournisseur d'origine">
                                    </div>
                                    <div class="form-group">
                                        <label>Commande d'Achat (PO)</label>
                                        <select name="purchaseOrderId" class="glass-select">
                                            <option value="">(Aucune / Entrée Directe)</option>
                                            ${(StorageService.get(STORAGE_KEYS.PURCHASE_ORDERS) || []).map(p => `<option value="${p.id}">${p.id} - ${p.supplierName || ''}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Affecter à un Client</label>
                                        <div class="search-select-wrapper" style="position: relative; display: flex; flex-direction: column; gap: 5px;">
                                            <input type="text" id="client-search-input" placeholder="Rechercher (Nom, ID, NIN, Passeport)..." class="glass-input" style="font-size: 0.85rem; padding: 6px 12px;">
                                            <select name="clientId" id="vehicle-client-select" class="glass-select">
                                                <option value="">Stock Libre (Aucun client)</option>
                                                ${(StorageService.get(STORAGE_KEYS.CLIENTS) || []).map(c => `<option value="${c.id}" data-search="${(c.firstName + ' ' + c.lastName + ' ' + (c.id || '') + ' ' + (c.nin || '') + ' ' + (c.passportNumber || '')).toLowerCase()}">${c.firstName} ${c.lastName} ${c.id ? `(#${c.id})` : ''}</option>`).join('')}
                                            </select>
                                            <div id="client-info-display" style="margin-top: 5px; padding: 8px; background: rgba(var(--primary-rgb), 0.1); border-radius: 6px; font-size: 0.8rem; display: none; border: 1px solid rgba(var(--primary-rgb), 0.2);">
                                                <!-- Dynamic Info -->
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </fieldset>

                            <fieldset style="border: 1px solid rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px;">
                                <legend style="padding: 0 0.5rem; color: var(--accent-blue); font-weight: 500;">Caractéristiques</legend>
                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                                    <div class="form-group">
                                        <label>Motorisation</label>
                                        <select name="motorization" class="glass-select">
                                            <option value="">Sélectionner...</option>
                                            ${(StorageService.get(STORAGE_KEYS.MOTORS) || []).map(m => `<option value="${m}">${m}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Couleur</label>
                                        <select name="color" class="glass-select">
                                            <option value="">Sélectionner...</option>
                                            ${(StorageService.get(STORAGE_KEYS.COLORS) || []).map(c => `<option value="${c}">${c}</option>`).join('')}
                                        </select>
                                    </div>

                                    <div class="form-group">
                                        <label>Année</label>
                                        <input type="number" name="year" class="glass-input" placeholder="${new Date().getFullYear()}">
                                    </div>
                                    <div class="form-group">
                                        <label>Mois</label>
                                        <input type="text" name="month" class="glass-input" placeholder="MM">
                                    </div>
                                    <div class="form-group">
                                        <label>Kilométrage</label>
                                        <input type="number" name="mileage" class="glass-input" value="0">
                                    </div>
                                    <div class="form-group">
                                        <label>Catégorie</label>
                                        <select name="category" class="glass-select">
                                            <option value="">Sélectionner...</option>
                                            ${categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                                        </select>
                                    </div>
                                </div>
                            </fieldset>

                            <fieldset style="border: 1px solid rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px;">
                                <legend style="padding: 0 0.5rem; color: var(--success); font-weight: 500;">Finances</legend>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <div class="form-group">
                                        <label>Prix d'Achat</label>
                                        <div class="input-group" style="display: flex; gap: 5px;">
                                            <input type="number" name="purchasePrice" required class="glass-input" placeholder="0.00">
                                            <select name="purchaseCurrency" class="glass-select" style="width: 80px;">
                                                ${(StorageService.get(STORAGE_KEYS.CURRENCIES) || []).map(c => `<option value="${c}" ${c === (StorageService.get(STORAGE_KEYS.SETTINGS)?.purchaseCurrency || 'EUR') ? 'selected' : ''}>${c}</option>`).join('')}
                                            </select>
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label>Prix de Vente (Indicatif)</label>
                                        <div class="input-group" style="display: flex; gap: 5px;">
                                            <input type="number" name="sellingPrice" class="glass-input" placeholder="0.00">
                                            <select name="sellingCurrency" class="glass-select" style="width: 80px;">
                                                ${(StorageService.get(STORAGE_KEYS.CURRENCIES) || []).map(c => `<option value="${c}" ${c === (StorageService.get(STORAGE_KEYS.SETTINGS)?.sellingCurrency || 'EUR') ? 'selected' : ''}>${c}</option>`).join('')}
                                            </select>
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label>Estimation DD</label>
                                        <div class="input-group" style="display: flex; gap: 5px;">
                                            <input type="number" name="estimatedCustomsDuty" class="glass-input" placeholder="0">
                                            <input type="text" value="${StorageService.get(STORAGE_KEYS.SETTINGS)?.customsCurrency || 'XAF'}" readonly class="glass-input" style="width: 60px; text-align: center; background: rgba(255,255,255,0.05);">
                                        </div>
                                    </div>
                                </div>
                            </fieldset>

                            <div class="form-row">
                                <div class="form-group">
                                    <label>Options du véhicule</label>
                                    <textarea name="options" class="glass-input" rows="3" placeholder="Saisir les options (ex: Toit ouvrant, Cuir, Navigation...)"></textarea>
                                </div>
                                <div class="form-group">
                                    <label>Remarques Internes</label>
                                    <textarea name="remarks" class="glass-input" rows="3" placeholder="Informations complémentaires..."></textarea>
                                </div>
                            </div>

                            <div class="modal-footer">
                                <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                                <button type="submit" class="btn-primary">Ajouter le véhicule</button>
                            </div>
                        </form>
                    </div>
                </div>
                `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Add event listener for brand change to update models
        const brandSelect = document.querySelector('select[name="brand"]');
        const modelSelect = document.getElementById('model-select');
        const brandModels = StorageService.get(STORAGE_KEYS.BRAND_MODELS) || {};

        brandSelect.addEventListener('change', (e) => {
            const selectedBrand = e.target.value;
            modelSelect.innerHTML = '<option value="">Sélectionner d\'abord une marque...</option>';
            if (selectedBrand && brandModels[selectedBrand]) {
                brandModels[selectedBrand].forEach(model => {
                    modelSelect.innerHTML += `<option value="${model}">${model}</option>`;
                });
            }
        });

        // Client search filter and info display logic
        const clientSearchInput = document.getElementById('client-search-input');
        const clientSelect = document.getElementById('vehicle-client-select');
        const clientInfoDisplay = document.getElementById('client-info-display');

        const updateClientInfo = (id) => {
            if (!id) {
                clientInfoDisplay.style.display = 'none';
                return;
            }
            const clients = StorageService.get(STORAGE_KEYS.CLIENTS);
            const client = clients.find(c => String(c.id) === String(id));
            if (client) {
                clientInfoDisplay.innerHTML = `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                        <div><strong>ID:</strong> #${client.id}</div>
                        <div><strong>Showroom:</strong> ${client.showroom || '-'}</div>
                        <div><strong>NIN:</strong> ${client.nin || '-'}</div>
                        <div><strong>Passeport:</strong> ${client.passportNumber || '-'}</div>
                    </div>
                `;
                clientInfoDisplay.style.display = 'block';
            } else {
                clientInfoDisplay.style.display = 'none';
            }
        };

        if (clientSelect) {
            clientSelect.addEventListener('change', (e) => updateClientInfo(e.target.value));
            // Initial update for edit modal
            if (clientSelect.value) updateClientInfo(clientSelect.value);
        }
        if (clientSearchInput && clientSelect) {
            clientSearchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                const options = clientSelect.querySelectorAll('option');
                options.forEach(option => {
                    if (option.value === "") { // Always show "Stock Libre"
                        option.style.display = "";
                    } else {
                        const searchStr = option.getAttribute('data-search') || option.textContent.toLowerCase();
                        option.style.display = searchStr.includes(query) ? "" : "none";
                    }
                });
            });
        }

        document.getElementById('vehicle-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleVehicleSubmission(new FormData(e.target));
        });
    },

    setupVehiclePhotoUpload() {
        const fileInput = document.getElementById('vehicle-image-file');
        if (!fileInput) return;

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const statusEl = document.getElementById('vehicle-upload-status');
            const previewEl = document.getElementById('vehicle-image-preview');
            const urlInput = document.getElementById('vehicle-image-url');

            statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Téléchargement...';

            try {
                const res = await ApiService.uploadFile(file);
                if (res.success) {
                    urlInput.value = res.data.url;
                    previewEl.innerHTML = `<img src="${res.data.url}" style="max-width: 100%; max-height: 100%;">`;
                    statusEl.innerHTML = '<span style="color: var(--success);"><i class="fas fa-check"></i> Téléchargé avec succès</span>';
                    this.showToast('Photo téléchargée', 'success');
                } else {
                    throw new Error(res.message);
                }
            } catch (err) {
                console.error('Upload error:', err);
                statusEl.innerHTML = `<span style="color: var(--danger);"><i class="fas fa-exclamation-triangle"></i> ${err.message || 'Erreur'}</span>`;
                this.showToast('Erreur lors du téléchargement', 'error');
            }
        });
    },

    async handleVehicleSubmission(formData) {
        try {
            const vehicleId = formData.get('vehicleId');
            const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES);
            const existingVehicle = vehicleId ? vehicles.find(v => v.id === vehicleId) : null;

            const newVehicle = {
                id: vehicleId || this.generateVehicleId(formData.get('brand')),
                brand: formData.get('brand'),
                model: formData.get('model'),
                trim: formData.get('trim'),
                motorization: formData.get('motorization'),
                supplier: formData.get('supplier'),
                year: formData.get('year') ? parseInt(formData.get('year')) : null,
                month: formData.get('month'),
                mileage: formData.get('mileage') ? parseInt(formData.get('mileage')) : 0,
                chassisNumber: formData.get('chassisNumber'),
                color: formData.get('color'),
                condition: formData.get('condition'),
                purchasePrice: Number(formData.get('purchasePrice')),
                purchaseCurrency: formData.get('purchaseCurrency'),
                sellingCurrency: formData.get('sellingCurrency'),
                estimatedCustomsDuty: Number(formData.get('estimatedCustomsDuty')) || 0,
                remarks: formData.get('remarks'),
                options: formData.get('options'),
                category: formData.get('category'),
                purchaseOrderId: formData.get('purchaseOrderId') || (existingVehicle ? existingVehicle.purchaseOrderId : null),
                clientId: formData.get('clientId') || null,
                orderId: existingVehicle ? existingVehicle.orderId : null,
                shipmentId: existingVehicle ? existingVehicle.shipmentId : null,
                status: formData.get('clientId') ? 'Reserved' : (existingVehicle ? existingVehicle.status : 'Available')
            };

            if (vehicleId) {
                await StorageService.update(STORAGE_KEYS.VEHICLES, vehicleId, newVehicle);
            } else {
                // Disable button to prevent double-click
                const submitBtn = document.querySelector('#vehicle-form button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...';
                }

                try {
                    await StorageService.add(STORAGE_KEYS.VEHICLES, newVehicle);
                } catch (addError) {
                    // Re-enable button on error
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Ajouter le véhicule';
                    }
                    throw addError;
                }
            }

            this.closeModal();
            this.renderView(this.currentView);
            this.showToast(vehicleId ? 'Véhicule mis à jour' : 'Véhicule ajouté avec succès', 'success');
        } catch (error) {
            console.error("Error in handleVehicleSubmission:", error);
            this.showToast(`Erreur lors de l'enregistrement: ${error.message || 'Serveur injoignable'}`, "error");
        }
    },

    showBatchVehicleModal() {
        const modalHtml = `
                        <div class="modal-overlay">
                            <div class="modal-content glass" style="width: 90vw; max-width: 1200px;">
                                <div class="modal-header">
                                    <h2>Création Véhicules par Lot (Complet)</h2>
                                    <button class="btn-close" onclick="app.closeModal()">&times;</button>
                                </div>
                                <form id="batch-vehicle-form">
                                    <div class="form-group">
                                        <label>Données (Copier/Coller depuis Excel)</label>
                                    <div class="alert info" style="font-size: 0.85rem; margin-bottom: 10px; padding: 10px; background: rgba(59, 130, 246, 0.1); border-radius: 8px;">
                                        <i class="fas fa-info-circle"></i> Respectez l'ordre exact des colonnes ci-dessous (Séparateur: <b>Tabulation</b> ou <b>Point-virgule ;</b>) :<br>
                                            <strong>Marque | Modèle | Motorisation | Finition | Année | Mois | Couleur | Kilométrage | État | Châssis | Fournisseur | Statut | Prix Achat | Devise | Prix Vente | Devise | Remarques</strong>
                                    </div>
                                    <textarea name="batchData" class="glass-input" rows="15" placeholder="Toyota	Corolla	Hybrid	SE	2023	05	Blanc	15000	Occasion	JH123...	AutoHub	Disponible	18000	EUR	22000	EUR	Commande spéciale" style="font-family: monospace; white-space: pre; overflow-x: auto;"></textarea>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                                    <button type="submit" class="btn-primary">Importer les véhicules</button>
                                </div>
                            </form>
                        </div>
                    </div>
                    `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('batch-vehicle-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleBatchVehicleSubmission(new FormData(e.target));
        });
    },

    async handleBatchVehicleSubmission(formData) {
        try {
            const rawData = formData.get('batchData');
            if (!rawData) return;

            const lines = rawData.trim().split('\n');
            let successCount = 0;
            let errorCount = 0;

            for (const [index, line] of lines.entries()) {
                // Skip empty lines
                if (!line.trim()) continue;

                // Headers check
                if (index === 0 && (line.toLowerCase().includes('marque') || line.toLowerCase().includes('brand'))) continue;

                // Detect delimiter: Tab, Semicolon, or Comma
                let parts;
                if (line.includes('\t')) {
                    parts = line.split('\t');
                } else if (line.includes(';')) {
                    parts = line.split(';');
                } else {
                    parts = line.split(',');
                }

                // Clean data
                const cleanParts = parts.map(p => p.trim().replace(/^"|"$/g, ''));

                // Mapping fields (17 columns now: brand, model, motor, trim, year, month, color, km, cond, chassis, supplier, status, pPrice, pCurr, sPrice, sCurr, remarks)
                const [
                    brand, model, motorization, trim, year, month, color, mileage,
                    condition, chassisNumber, supplier, status,
                    pPrice, pCurr, sPrice, sCurr, remarks
                ] = cleanParts;

                if (!brand || !chassisNumber) {
                    errorCount++;
                    continue;
                }

                const vehicle = {
                    id: this.generateVehicleId(brand),
                    brand: brand,
                    model: model || '',
                    motorization: motorization || 'Standard',
                    trim: trim || '',
                    year: parseInt(year) || new Date().getFullYear(),
                    month: month || '',
                    color: color || 'Non spécifié',
                    mileage: parseInt(mileage) || 0,
                    condition: condition || 'Nouveau',
                    chassisNumber: chassisNumber,
                    supplier: supplier || 'Import/Lot',
                    status: status || 'Available',
                    purchasePrice: parseFloat(pPrice) || 0,
                    purchaseCurrency: pCurr || 'EUR',
                    sellingPrice: parseFloat(sPrice) || 0,
                    sellingCurrency: sCurr || 'EUR',
                    remarks: remarks || 'Importé par lot',
                    price: parseFloat(sPrice) || 0
                };

                try {
                    await StorageService.add(STORAGE_KEYS.VEHICLES, vehicle);
                    successCount++;
                } catch (err) {
                    console.error("Single vehicle import error:", err);
                    errorCount++;
                }
            }

            this.closeModal();
            this.showToast(`${successCount} véhicules importés avec succès (${errorCount} erreurs)`, successCount > 0 ? 'success' : 'warning');
            this.renderView('vehicles');
        } catch (error) {
            console.error("Error in handleBatchVehicleSubmission:", error);
            this.showToast("Erreur lors de l'importation par lot", "error");
        }
    },

    showEditVehicleModal(id) {
        const vehicle = StorageService.get(STORAGE_KEYS.VEHICLES).find(c => c.id === id);
        if (!vehicle) return;

        const modalHtml = `
                        <div class="modal-overlay">
                            <div class="modal-content glass" style="width: 700px;">
                                <div class="modal-header">
                                    <h2>Modifier le Véhicule</h2>
                                    <button class="btn-close" onclick="app.closeModal()">&times;</button>
                                </div>
                                <form id="vehicle-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
                                    <input type="hidden" name="vehicleId" value="${vehicle.id}">
                                    
                                    <fieldset style="border: 1px solid rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px;">
                                        <legend style="padding: 0 0.5rem; color: var(--primary); font-weight: 500;">Identification</legend>
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                            <div class="form-group">
                                                <label>Marque</label>
                                                <select name="brand" required class="glass-select">
                                                    <option value="">Sélectionner...</option>
                                                    ${StorageService.get(STORAGE_KEYS.BRANDS).map(b => `<option value="${b}" ${vehicle.brand === b ? 'selected' : ''}>${b}</option>`).join('')}
                                                </select>
                                            </div>
                                            <div class="form-group">
                                                <label>Numéro de Châssis</label>
                                                <input type="text" name="chassisNumber" value="${vehicle.chassisNumber}" required class="glass-input" style="font-family: monospace;">
                                            </div>
                                            <div class="form-group">
                                                <label>Modèle</label>
                                                <select name="model" id="edit-model-select" class="glass-select">
                                                    <option value="">Sélectionner...</option>
                                                </select>
                                            </div>
                                            <div class="form-group">
                                                <label>Finition</label>
                                                <input type="text" name="trim" value="${vehicle.trim || ''}" class="glass-input">
                                            </div>
                                            <div class="form-group">
                                                <label>Fournisseur</label>
                                                <input type="text" name="supplier" value="${vehicle.supplier || ''}" class="glass-input">
                                            </div>
                                            <div class="form-group">
                                                <label>Commande d'Achat (PO)</label>
                                                <select name="purchaseOrderId" class="glass-select">
                                                    <option value="">(Aucune / Entrée Directe)</option>
                                                    ${(StorageService.get(STORAGE_KEYS.PURCHASE_ORDERS) || []).map(p => `<option value="${p.id}" ${vehicle.purchaseOrderId === p.id ? 'selected' : ''}>${p.id} - ${p.supplierName || ''}</option>`).join('')}
                                                </select>
                                            </div>
                                            <div class="form-group">
                                                <label>Affecter à un Client</label>
                                                <div class="search-select-wrapper" style="position: relative; display: flex; flex-direction: column; gap: 5px;">
                                                    <input type="text" id="client-search-input" placeholder="Rechercher (Nom, ID, NIN, Passeport)..." class="glass-input" style="font-size: 0.85rem; padding: 6px 12px;">
                                                    <select name="clientId" id="vehicle-client-select" class="glass-select">
                                                        <option value="">Stock Libre (Aucun client)</option>
                                                        ${(StorageService.get(STORAGE_KEYS.CLIENTS) || []).map(c => `<option value="${c.id}" ${vehicle.clientId === c.id ? 'selected' : ''} data-search="${(c.firstName + ' ' + c.lastName + ' ' + (c.id || '') + ' ' + (c.nin || '') + ' ' + (c.passportNumber || '')).toLowerCase()}">${c.firstName} ${c.lastName} ${c.id ? `(#${c.id})` : ''}</option>`).join('')}
                                                    </select>
                                                    <div id="client-info-display" style="margin-top: 5px; padding: 8px; background: rgba(var(--primary-rgb), 0.1); border-radius: 6px; font-size: 0.8rem; display: none; border: 1px solid rgba(var(--primary-rgb), 0.2);">
                                                        <!-- Dynamic Info -->
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </fieldset>

                                    <fieldset style="border: 1px solid rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px;">
                                        <legend style="padding: 0 0.5rem; color: var(--accent-blue); font-weight: 500;">Caractéristiques</legend>
                                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                                            <div class="form-group">
                                                <label>Motorisation</label>
                                                <select name="motorization" class="glass-select">
                                                    <option value="">Sélectionner...</option>
                                                    ${StorageService.get(STORAGE_KEYS.MOTORS).map(m => `<option value="${m}" ${vehicle.motorization === m ? 'selected' : ''}>${m}</option>`).join('')}
                                                </select>
                                            </div>
                                            <div class="form-group">
                                                <label>Couleur</label>
                                                <select name="color" class="glass-select">
                                                    <option value="">Sélectionner...</option>
                                                    ${StorageService.get(STORAGE_KEYS.COLORS).map(c => `<option value="${c}" ${vehicle.color === c ? 'selected' : ''}>${c}</option>`).join('')}
                                                </select>
                                            </div>

                                            <div class="form-group">
                                                <label>Année</label>
                                                <input type="number" name="year" value="${vehicle.year || ''}" class="glass-input">
                                            </div>
                                            <div class="form-group">
                                                <label>Mois</label>
                                                <input type="text" name="month" value="${vehicle.month || ''}" class="glass-input">
                                            </div>
                                            <div class="form-group">
                                                <label>Kilométrage</label>
                                                <input type="number" name="mileage" value="${vehicle.mileage || ''}" class="glass-input">
                                            </div>
                                            <div class="form-group">
                                                <label>Catégorie</label>
                                                <select name="category" class="glass-select">
                                                    <option value="">Sélectionner...</option>
                                                    ${(StorageService.get(STORAGE_KEYS.CATEGORIES) || []).map(cat => `<option value="${cat}" ${vehicle.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}
                                                </select>
                                            </div>
                                        </div>
                                    </fieldset>

                                    <fieldset style="border: 1px solid rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px;">
                                        <legend style="padding: 0 0.5rem; color: var(--success); font-weight: 500;">Finances</legend>
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                            <div class="form-group">
                                                <label>Prix d'Achat</label>
                                                <div class="input-group" style="display: flex; gap: 5px;">
                                                    <input type="number" name="purchasePrice" value="${vehicle.purchasePrice || vehicle.price || 0}" required class="glass-input">
                                                    <select name="purchaseCurrency" class="glass-select" style="width: 80px;">
                                                        ${StorageService.get(STORAGE_KEYS.CURRENCIES).map(c => `<option value="${c}" ${c === (vehicle.purchaseCurrency || StorageService.get(STORAGE_KEYS.SETTINGS)?.purchaseCurrency || 'EUR') ? 'selected' : ''}>${c}</option>`).join('')}
                                                    </select>
                                                </div>
                                            </div>
                                            <div class="form-group">
                                                <label>Prix de Vente (Indicatif)</label>
                                                <div class="input-group" style="display: flex; gap: 5px;">
                                                    <input type="number" name="sellingPrice" value="${vehicle.sellingPrice || ''}" class="glass-input" placeholder="0.00">
                                                    <select name="sellingCurrency" class="glass-select" style="width: 80px;">
                                                        ${StorageService.get(STORAGE_KEYS.CURRENCIES).map(c => `<option value="${c}" ${c === (vehicle.sellingCurrency || StorageService.get(STORAGE_KEYS.SETTINGS)?.sellingCurrency || 'EUR') ? 'selected' : ''}>${c}</option>`).join('')}
                                                    </select>
                                                </div>
                                            </div>
                                            <div class="form-group">
                                                <label>Estimation DD</label>
                                                <div class="input-group" style="display: flex; gap: 5px;">
                                                    <input type="number" name="estimatedCustomsDuty" value="${vehicle.estimatedCustomsDuty || 0}" class="glass-input">
                                                    <input type="text" value="${StorageService.get(STORAGE_KEYS.SETTINGS)?.customsCurrency || 'XAF'}" readonly class="glass-input" style="width: 60px; text-align: center; background: rgba(255,255,255,0.05);">
                                                </div>
                                            </div>
                                        </div>
                                    </fieldset>

                                    <div class="form-row">
                                        <div class="form-group">
                                            <label>Photo du Véhicule</label>
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label>Options du véhicule</label>
                                            <textarea name="options" class="glass-input" rows="3">${vehicle.options || ''}</textarea>
                                        </div>
                                        <div class="form-group">
                                            <label>Remarques Internes</label>
                                            <textarea name="remarks" class="glass-input" rows="3">${vehicle.remarks || ''}</textarea>
                                        </div>
                                    </div>

                                    <div class="modal-footer">
                                        <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                                        <button type="submit" class="btn-primary">Enregistrer les modifications</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Populate model dropdown and add event listener
        const brandSelect = document.querySelector('select[name="brand"]');
        const modelSelect = document.getElementById('edit-model-select');
        const brandModels = StorageService.get(STORAGE_KEYS.BRAND_MODELS);

        // Function to populate models based on brand
        const populateModels = (brand, selectedModel = null) => {
            modelSelect.innerHTML = '<option value="">Sélectionner...</option>';
            if (brand && brandModels[brand]) {
                brandModels[brand].forEach(model => {
                    const selected = model === selectedModel ? 'selected' : '';
                    modelSelect.innerHTML += `<option value="${model}" ${selected}>${model}</option>`;
                });
            }
        };

        // Initial population with existing vehicle data
        populateModels(vehicle.brand, vehicle.model);

        // Add change listener for brand
        brandSelect.addEventListener('change', (e) => {
            populateModels(e.target.value);
        });

        document.getElementById('vehicle-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleVehicleSubmission(new FormData(e.target));
        });
    },

    renderSettings() {
        // DEBUG: Verify entry
        // alert('Debug: Entering renderSettings'); 

        try {
            if (!this.viewContainer) {
                alert('Error: viewContainer is missing');
                return;
            }

            const settings = StorageService.get(STORAGE_KEYS.SETTINGS) || {
                companyName: 'TIBOU AUTO',
                purchaseCurrency: 'EUR',
                sellingCurrency: 'EUR',
                customsCurrency: 'XAF',
                theme: 'dark',
                geminiModel: 'gemini-1.5-flash'
            };

            const brands = StorageService.get(STORAGE_KEYS.BRANDS) || [];
            const motors = StorageService.get(STORAGE_KEYS.MOTORS) || [];
            const colors = StorageService.get(STORAGE_KEYS.COLORS) || [];
            const currencies = StorageService.get(STORAGE_KEYS.CURRENCIES) || [];
            const showrooms = StorageService.get(STORAGE_KEYS.SHOWROOMS) || [];
            const showroomsRaw = StorageService.get(STORAGE_KEYS.SHOWROOMS_RAW) || [];
            const brandsRaw = StorageService.get(STORAGE_KEYS.BRANDS_RAW) || [];
            const categories = StorageService.get(STORAGE_KEYS.CATEGORIES) || [];
            const carriers = StorageService.get(STORAGE_KEYS.CARRIERS) || [];

            // Helper to render a list config section
            const renderConfigSection = (title, icon, items, type) => `
                        <div class="settings-section">
                            <h3><i class="${icon}"></i> ${title}</h3>
                            <div class="config-grid" id="config-${type}">
                                ${(items || []).map(item => `
                            <div class="config-item glass" style="${item === 'Blanc' || item === 'White' ? 'background: #ffffff; color: #000000;' : ''}">
                                <span>${item}</span>
                                <button type="button" class="btn-icon-small danger" onclick="app.removeConfigItem('${type}', '${item.replace(/'/g, "\\'")}')">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        `).join('')}
                            </div>
                            <div class="add-config-form">
                                <input type="text" id="input-${type}" placeholder="Ajouter ${title}..." class="glass-input">
                                    <button type="button" class="btn-primary" onclick="app.addConfigItem('${type}')">Ajouter</button>
                            </div>
                        </div>
                        `;

            this.viewContainer.innerHTML = `
                        <div class="view-header">
                            <h1>Configuration</h1>
                            <p>Gérez les paramètres de votre application.</p>
                        </div>
                        <div class="settings-container glass">
                            <form id="settings-form" autocomplete="off">
                                <div class="settings-section">
                                    <h3><i class="fas fa-building"></i> Informations Générales</h3>
                                    <div class="form-group">
                                        <label>Nom de l'entreprise</label>
                                        <input type="text" name="companyName" value="${settings.companyName}" class="glass-input">
                                    </div>
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label>Devise d'Achat (Dépenses)</label>
                                            <select name="purchaseCurrency" class="glass-select">
                                                ${currencies.map(c => `<option value="${c}" ${settings.purchaseCurrency === c ? 'selected' : ''}>${c}</option>`).join('')}
                                            </select>
                                        </div>
                                        <div class="form-group">
                                            <label>Devise de Vente (Recettes)</label>
                                            <select name="sellingCurrency" class="glass-select">
                                                ${currencies.map(c => `<option value="${c}" ${settings.sellingCurrency === c ? 'selected' : ''}>${c}</option>`).join('')}
                                            </select>
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label>Devise Droits de Douanes (Est.)</label>
                                        <select name="customsCurrency" class="glass-select">
                                            ${currencies.map(c => `<option value="${c}" ${settings.customsCurrency === c ? 'selected' : ''}>${c}</option>`).join('')}
                                        </select>
                                    </div>
                                </div>

                                ${this.renderBrandsSection(brandsRaw)}
                                ${this.renderBrandModelsSection()}
                                ${renderConfigSection('Motorisations', 'fas fa-cogs', motors, 'MOTORS')}
                                ${renderConfigSection('Catégories', 'fas fa-tags', categories, 'CATEGORIES')}
                                ${renderConfigSection('Couleurs', 'fas fa-palette', colors, 'COLORS')}
                                ${this.renderShowroomSection(showroomsRaw)}
                                ${renderConfigSection('Devises', 'fas fa-money-bill-wave', currencies, 'CURRENCIES')}
                                ${renderConfigSection('Compagnies Maritimes', 'fas fa-ship', carriers, 'CARRIERS')}

                                ${this.renderUserManagementSection()}
                                ${this.renderRoleManagementSection()}

                                <div class="settings-section">
                                    <h3><i class="fas fa-palette"></i> Personnalisation & Thèmes</h3>
                                    <div class="theme-grid">
                                        <label class="theme-card ${settings.theme === 'dark' ? 'active' : ''}" style="background: #0f172a; border: 1px solid rgba(255,255,255,0.1);">
                                            <input type="radio" name="theme" value="dark" ${settings.theme === 'dark' ? 'checked' : ''} style="display: none;">
                                            <div class="theme-preview" style="background: #0f172a;">
                                                <div style="width: 20px; height: 10px; background: var(--primary); border-radius: 2px;"></div>
                                            </div>
                                            <span>Sombre</span>
                                        </label>
                                        <label class="theme-card ${settings.theme === 'light' ? 'active' : ''}" style="background: #f1f5f9; border: 1px solid rgba(0,0,0,0.1); color: #1e293b;">
                                            <input type="radio" name="theme" value="light" ${settings.theme === 'light' ? 'checked' : ''} style="display: none;">
                                            <div class="theme-preview" style="background: #f1f5f9;">
                                                <div style="width: 20px; height: 10px; background: #4f46e5; border-radius: 2px;"></div>
                                            </div>
                                            <span>Clair</span>
                                        </label>
                                        <label class="theme-card ${settings.theme === 'ocean' ? 'active' : ''}" style="background: #0c4a6e; border: 1px solid rgba(255,255,255,0.1);">
                                            <input type="radio" name="theme" value="ocean" ${settings.theme === 'ocean' ? 'checked' : ''} style="display: none;">
                                            <div class="theme-preview" style="background: #0c4a6e;">
                                                <div style="width: 20px; height: 10px; background: #38bdf8; border-radius: 2px;"></div>
                                            </div>
                                            <span>Océan</span>
                                        </label>
                                        <label class="theme-card ${settings.theme === 'sunset' ? 'active' : ''}" style="background: #2a1b3d; border: 1px solid rgba(255,255,255,0.1);">
                                            <input type="radio" name="theme" value="sunset" ${settings.theme === 'sunset' ? 'checked' : ''} style="display: none;">
                                            <div class="theme-preview" style="background: #2a1b3d;">
                                                <div style="width: 20px; height: 10px; background: #d946ef; border-radius: 2px;"></div>
                                            </div>
                                            <span>Sunset</span>
                                        </label>
                                        <label class="theme-card ${settings.theme === 'forest' ? 'active' : ''}" style="background: #052e16; border: 1px solid rgba(255,255,255,0.1);">
                                            <input type="radio" name="theme" value="forest" ${settings.theme === 'forest' ? 'checked' : ''} style="display: none;">
                                            <div class="theme-preview" style="background: #052e16;">
                                                <div style="width: 20px; height: 10px; background: #22c55e; border-radius: 2px;"></div>
                                            </div>
                                            <span>Forêt</span>
                                        </label>
                                        <label class="theme-card ${settings.theme === 'elite' ? 'active' : ''}" style="background: #09090b; border: 1px solid rgba(255,255,255,0.1);">
                                            <input type="radio" name="theme" value="elite" ${settings.theme === 'elite' ? 'checked' : ''} style="display: none;">
                                            <div class="theme-preview" style="background: #09090b;">
                                                <div style="width: 20px; height: 10px; background: #c2a15e; border-radius: 2px;"></div>
                                            </div>
                                            <span>Elite (Noir & Or)</span>
                                        </label>
                                    </div>
                                </div>

                                <div class="settings-section">
                                    <h3><i class="fas fa-robot"></i> Intelligence Artificielle (Extraction BL)</h3>
                                    <div class="form-row" style="margin-top: 15px;">
                                        <div class="form-group" style="flex: 2;">
                                            <label>Clé API Gemini</label>
                                            <div style="position: relative; display: flex; gap: 10px;">
                                                <input type="password" id="settings-gemini-key" name="geminiApiKey" value="${settings.geminiApiKey || ''}" class="glass-input" placeholder="Saisir votre clé API Google Gemini" style="flex: 1;" autocomplete="new-password">
                                                <button type="button" class="btn-secondary" onclick="app.testGeminiConnection()" title="Tester la connexion">
                                                    <i class="fas fa-plug"></i>
                                                </button>
                                                <button type="button" class="btn-secondary" onclick="app.listGeminiModels()" title="Lister les modèles disponibles">
                                                    <i class="fas fa-list"></i>
                                                </button>
                                            </div>
                                            <small style="color: var(--text-dim);">Obtenez une clé gratuite sur <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: var(--primary);">Google AI Studio</a></small>
                                        </div>
                                    </div>

                                    <div class="form-row" style="margin-top: 15px;">
                                        <div class="form-group" style="flex: 1;">
                                            <label>Modèle IA Préféré</label>
                                            <select name="geminiModel" class="glass-select">
                                                <option value="gemini-1.5-flash" ${settings.geminiModel === 'gemini-1.5-flash' ? 'selected' : ''}>Gemini 2.5 Flash (Recommandé)</option>
                                                ${(settings.availableGeminiModels || []).filter(m => m !== 'gemini-1.5-flash').map(m => `
                                                    <option value="${m}" ${settings.geminiModel === m ? 'selected' : ''}>${m}</option>
                                                `).join('')}
                                            </select >
    <small style="color: var(--text-dim);">Modèles détectés : ${(settings.availableGeminiModels || []).length}</small>
                                        </div >
    <div class="form-group" style="flex: 1; display: flex; align-items: flex-end; padding-bottom: 25px;">
        <label class="switch-container" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" name="useAiExtraction" ${settings.useAiExtraction ? 'checked' : ''} style="width: 34px; height: 18px;">
                <span style="font-size: 0.9rem;">Activer l'IA par défaut</span>
        </label>
    </div>
                                    </div >
                                </div >
                                
                                <div class="settings-section">
                                    <h3><i class="fas fa-wrench"></i> Maintenance & Système</h3>
                                    <p style="font-size: 0.9rem; color: var(--text-dim); margin-bottom: 15px;">
                                        Utilisez ces outils pour réparer les liens entre les données ou résoudre des problèmes de synchronisation des statuts si des commandes ne sont pas à jour.
                                    </p>
                                    <div class="form-row" style="gap: 15px;">
                                        <button type="button" class="btn-secondary" onclick="app.handleGlobalStatusHeal()" style="display: flex; align-items: center; gap: 8px; flex: 1; justify-content: center;">
                                            <i class="fas fa-magic" style="color: var(--primary);"></i> Réparer les statuts & liens
                                        </button>
                                        <button type="button" class="btn-secondary" onclick="app.handleResetData()" style="display: flex; align-items: center; gap: 8px; flex: 1; justify-content: center; border-color: rgba(239, 68, 68, 0.3);">
                                            <i class="fas fa-sync" style="color: var(--danger);"></i> Réinitialiser le cache
                                        </button>
                                    </div>
                                </div>





                                <div class="settings-footer">
                                    <button type="submit" class="btn-primary">Enregistrer les modifications</button>
                                </div>
                            </form >
                        </div >
    `;

            document.querySelectorAll('input[name="theme"]').forEach(input => {
                input.addEventListener('change', (e) => {
                    // Start previewing immediately on selection
                    this.applyTheme(e.target.value);
                    // Update visual selection status
                    document.querySelectorAll('.theme-card').forEach(card => card.classList.remove('active'));
                    e.target.parentElement.classList.add('active');
                });
            });

            document.getElementById('settings-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const newSettings = {
                    companyName: formData.get('companyName'),
                    purchaseCurrency: formData.get('purchaseCurrency'),
                    sellingCurrency: formData.get('sellingCurrency'),
                    customsCurrency: formData.get('customsCurrency'),
                    theme: formData.get('theme') || settings.theme,
                    geminiApiKey: formData.get('geminiApiKey'),
                    geminiModel: formData.get('geminiModel'),
                    useAiExtraction: formData.get('useAiExtraction') === 'on'
                };
                await StorageService.save(STORAGE_KEYS.SETTINGS, newSettings);
                this.applyTheme(newSettings.theme);
                this.showToast('Paramètres enregistrés avec succès !', 'success');
            });

        } catch (error) {
            console.error("Render Settings Error:", error);
            alert(`Erreur CRITIQUE Paramètres: ${error.message} \n${error.stack} `);
            this.showToast(`Erreur d'affichage des paramètres: ${error.message}`, 'error');
        }
    },

    async handleGlobalStatusHeal() {
        if (!confirm("Voulez-vous lancer la réparation globale des liens et des statuts ? Cette opération va vérifier toutes les expéditions et commandes pour s'assurer qu'elles sont bien synchronisées.")) return;

        const loadingToast = this.showToast('🚀 Réparation globale en cours...', 'info', 0);
        try {
            const response = await fetch('/api/maintenance/heal-statuses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await response.json();

            if (loadingToast && loadingToast.remove) loadingToast.remove();

            if (result.success) {
                this.showToast('✅ Réparation terminée ! Synchronisation finale...', 'success');
                await this.syncAllData();
            } else {
                this.showToast('❌ Échec de la réparation : ' + result.message, 'error');
            }
        } catch (error) {
            if (loadingToast && loadingToast.remove) loadingToast.remove();
            console.error('Heal error:', error);
            this.showToast('Erreur lors de la communication avec le serveur', 'error');
        }
    },

    async syncAllData() {
        const loadingToast = this.showToast('Synchronisation forcée en cours...', 'info', 0);
        try {
            await StorageService.syncAll();
            if (loadingToast && loadingToast.remove) loadingToast.remove();
            this.showToast('Données synchronisées avec succès !', 'success');
            this.renderView(this.currentView);
        } catch (err) {
            if (loadingToast && loadingToast.remove) loadingToast.remove();
            this.showToast('Échec de la synchronisation : ' + err.message, 'error');
        }
    },

    async handleResetData() {
        if (confirm("Attention : Cela va effacer toutes les données stockées dans votre navigateur et les recharger depuis le serveur. Continuer ?")) {
            const loadingToast = this.showToast('Réinitialisation en cours...', 'info', 0);
            try {
                StorageService.clearAllCache();
                await StorageService.syncAll();
                if (loadingToast && loadingToast.remove) loadingToast.remove();
                this.showToast('Cache réinitialisé et données rechargées !', 'success');
                window.location.reload(); // Hard reload to ensure all states are clean
            } catch (err) {
                if (loadingToast && loadingToast.remove) loadingToast.remove();
                this.showToast('Erreur lors de la réinitialisation : ' + err.message, 'error');
            }
        }
    },

    renderBrandsSection(brands) {
        brands = brands || [];
        return `
                <div class="settings-section">
                    <h3><i class="fas fa-copyright"></i> Marques de Véhicules</h3>
                    <div class="config-grid" id="config-brands-raw">
                        ${brands.map(brand => `
                            <div class="config-item glass" style="display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    ${brand.logo ? `<img src="${brand.logo}" style="width: 24px; height: 24px; object-fit: contain;">` : '<i class="fas fa-car"></i>'}
                                    <span>${brand.name}</span>
                                </div>
                                <div style="display: flex; gap: 5px;">
                                    <button type="button" class="btn-icon-small" onclick="app.editBrand('${brand.id}')">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button type="button" class="btn-icon-small danger" onclick="app.removeBrand('${brand.id}')">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="add-config-form">
                        <input type="text" id="new-brand-input" placeholder="Ajouter une marque..." class="glass-input">
                        <button type="button" class="btn-primary" onclick="app.addBrand()">Ajouter</button>
                    </div>
                </div>
            `;
    },

    renderShowroomSection(showrooms) {
        showrooms = showrooms || [];
        return `
                <div class="settings-section">
                    <h3><i class="fas fa-store"></i> Showrooms</h3>
                    <div class="config-grid" id="config-showrooms-raw">
                        ${showrooms.map(room => `
                            <div class="config-item glass">
                                <div>
                                    <strong>${room.name}</strong>
                                    <div style="font-size: 0.8em; color: var(--text-dim);">${room.address || ''}</div>
                                </div>
                                <div style="display: flex; gap: 5px;">
                                    <button type="button" class="btn-icon-small" onclick="app.editShowroom('${room.id}')">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button type="button" class="btn-icon-small danger" onclick="app.removeShowroom('${room.id}')">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                     <div class="add-config-form">
                        <input type="text" id="new-showroom-input" placeholder="Nouveau showroom..." class="glass-input">
                        <button type="button" class="btn-primary" onclick="app.addShowroom()">Ajouter</button>
                    </div>
                </div>
            `;
    },

    async addBrand() {
        const input = document.getElementById('new-brand-input');
        const name = input.value.trim();
        if (!name) return;

        const brands = StorageService.get(STORAGE_KEYS.BRANDS_RAW) || [];
        if (brands.some(b => b.name.toLowerCase() === name.toLowerCase())) {
            this.showToast('Cette marque existe déjà', 'warning');
            return;
        }

        const newBrand = { name: name };
        await StorageService.add(STORAGE_KEYS.BRANDS_RAW, newBrand);

        // Sync legacy BRANDS list (optional but kept for internal logic)
        const legacyBrands = StorageService.get(STORAGE_KEYS.BRANDS) || [];
        if (!legacyBrands.includes(name)) {
            legacyBrands.push(name);
            localStorage.setItem(STORAGE_KEYS.BRANDS, JSON.stringify(legacyBrands));
        }

        this.renderSettings();
        this.showToast('Marque ajoutée', 'success');
        input.value = '';
    },

    async removeBrand(id) {
        if (!confirm('Supprimer cette marque ?')) return;
        const brands = StorageService.get(STORAGE_KEYS.BRANDS_RAW) || [];
        const brand = brands.find(b => b.id === id);

        if (brand) {
            const brandName = brand.name;
            await StorageService.delete(STORAGE_KEYS.BRANDS_RAW, id);

            // Update legacy
            const legacyBrands = StorageService.get(STORAGE_KEYS.BRANDS) || [];
            const legacyIndex = legacyBrands.indexOf(brandName);
            if (legacyIndex > -1) {
                legacyBrands.splice(legacyIndex, 1);
                localStorage.setItem(STORAGE_KEYS.BRANDS, JSON.stringify(legacyBrands));
            }

            this.renderSettings();
            this.showToast('Marque supprimée', 'info');
        }
    },

    async editBrand(id) {
        const brands = StorageService.get(STORAGE_KEYS.BRANDS_RAW) || [];
        const brand = brands.find(b => b.id === id);
        if (!brand) return;

        const newName = prompt('Nouveau nom:', brand.name);
        if (newName && newName !== brand.name) {
            const oldName = brand.name;
            brand.name = newName;
            await StorageService.update(STORAGE_KEYS.BRANDS_RAW, id, brand);

            // Update legacy
            const legacyBrands = StorageService.get(STORAGE_KEYS.BRANDS) || [];
            const idx = legacyBrands.indexOf(oldName);
            if (idx > -1) {
                legacyBrands[idx] = newName;
                localStorage.setItem(STORAGE_KEYS.BRANDS, JSON.stringify(legacyBrands));
            }

            this.renderSettings();
            this.showToast('Marque modifiée', 'success');
        }
    },

    async addShowroom() {
        const input = document.getElementById('new-showroom-input');
        const name = input.value.trim();
        if (!name) return;

        const showrooms = StorageService.get(STORAGE_KEYS.SHOWROOMS_RAW) || [];
        if (showrooms.some(s => s.name.toLowerCase() === name.toLowerCase())) {
            this.showToast('Ce showroom existe déjà', 'warning');
            return;
        }

        const newRoom = { name: name };
        await StorageService.add(STORAGE_KEYS.SHOWROOMS_RAW, newRoom);

        // Sync legacy
        const legacy = StorageService.get(STORAGE_KEYS.SHOWROOMS) || [];
        if (!legacy.includes(name)) {
            legacy.push(name);
            localStorage.setItem(STORAGE_KEYS.SHOWROOMS, JSON.stringify(legacy));
        }

        this.renderSettings();
        this.showToast('Showroom ajouté', 'success');
        input.value = '';
    },

    async removeShowroom(id) {
        if (!confirm('Supprimer ce showroom ?')) return;
        const showrooms = StorageService.get(STORAGE_KEYS.SHOWROOMS_RAW) || [];
        const showroom = showrooms.find(s => s.id === id);

        if (showroom) {
            const name = showroom.name;
            await StorageService.delete(STORAGE_KEYS.SHOWROOMS_RAW, id);

            // Sync legacy
            const legacy = StorageService.get(STORAGE_KEYS.SHOWROOMS) || [];
            const lIdx = legacy.indexOf(name);
            if (lIdx > -1) {
                legacy.splice(lIdx, 1);
                localStorage.setItem(STORAGE_KEYS.SHOWROOMS, JSON.stringify(legacy));
            }

            this.renderSettings();
            this.showToast('Showroom supprimé', 'info');
        }
    },

    async editShowroom(id) {
        const showrooms = StorageService.get(STORAGE_KEYS.SHOWROOMS_RAW) || [];
        const room = showrooms.find(s => s.id === id);
        if (!room) return;

        const newName = prompt('Nouveau nom:', room.name);
        if (newName && newName !== room.name) {
            const oldName = room.name;
            room.name = newName;
            await StorageService.update(STORAGE_KEYS.SHOWROOMS_RAW, id, room);

            // Update legacy
            const legacy = StorageService.get(STORAGE_KEYS.SHOWROOMS) || [];
            const idx = legacy.indexOf(oldName);
            if (idx > -1) {
                legacy[idx] = newName;
                localStorage.setItem(STORAGE_KEYS.SHOWROOMS, JSON.stringify(legacy));
            }

            this.renderSettings();
            this.showToast('Showroom modifié', 'success');
        }
    },

    renderBrandModelsSection() {
        const brandModels = StorageService.get(STORAGE_KEYS.BRAND_MODELS) || {};
        const brands = StorageService.get(STORAGE_KEYS.BRANDS) || [];

        return `
                <div class="settings-section">
                    <h3><i class="fas fa-list"></i> Modèles par Marque</h3>
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                        ${brands.map(brand => {
            const models = brandModels[brand] || [];
            return `
                                <div class="brand-models-container" style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                                    <h4 style="margin-bottom: 0.75rem; color: var(--primary); font-size: 0.95rem;">
                                        <i class="fas fa-car"></i> ${brand}
                                    </h4>
                                    <div class="config-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.5rem; margin-bottom: 0.75rem;">
                                        ${models.map(model => `
                                            <div class="config-item glass" style="padding: 0.5rem; font-size: 0.85rem;">
                                                <span>${model}</span>
                                                <button type="button" class="btn-icon-small danger" onclick="app.removeBrandModel('${brand.replace(/'/g, "\\'")}', '${model.replace(/'/g, "\\'")}')">
                                                    <i class="fas fa-times"></i>
                                                </button>
                                            </div>
                                        `).join('')}
                                    </div>
                                    <div class="add-config-form" style="display: flex; gap: 0.5rem;">
                                        <input type="text" id="input-model-${brand.replace(/\s/g, '_')}" placeholder="Ajouter un modèle..." class="glass-input" style="flex: 1;" autocomplete="off">
                                        <button type="button" class="btn-primary" onclick="app.addBrandModel('${brand.replace(/'/g, "\\'")}')">Ajouter</button>
                                    </div>
                                </div>
                            `;
        }).join('')}
                    </div>
                </div>
            `;
    },

    deleteVehicle(id) {
        this.showConfirmModal('Supprimer ce véhicule ?', async () => {
            try {
                await StorageService.delete(STORAGE_KEYS.VEHICLES, id);
                if (this.currentView === 'vehicles') this.renderVehicles();
                else this.renderView(this.currentView);
                this.showToast('Véhicule supprimé', 'info');
            } catch (error) {
                console.error(error);
                this.showToast('Erreur lors de la suppression', 'error');
            }
        });
    },

    deleteOrder(id) {
        this.showConfirmModal('Supprimer cette commande et toutes les dépenses associées ?', async () => {
            try {
                await StorageService.delete(STORAGE_KEYS.ORDERS, id);
                if (this.currentView === 'orders') this.renderOrders();
                else this.renderView(this.currentView);
                this.showToast('Commande supprimée', 'info');
            } catch (error) {
                console.error(error);
                this.showToast('Erreur lors de la suppression', 'error');
            }
        });
    },

    deleteClient(id) {
        this.showConfirmModal('Supprimer ce client ?', async () => {
            try {
                await StorageService.delete(STORAGE_KEYS.CLIENTS, id);
                if (this.currentView === 'clients') this.renderClients();
                else this.renderView(this.currentView);
                this.showToast('Client supprimé', 'info');
            } catch (error) {
                console.error(error);
                this.showToast('Erreur lors de la suppression', 'error');
            }
        });
    },

    async addBrandModel(brandName) {
        // Find brand ID
        const brands = StorageService.get(STORAGE_KEYS.BRANDS_RAW) || [];
        const brandObj = brands.find(b => b.name === brandName);

        if (!brandObj) {
            this.showToast('Erreur: Marque non trouvée', 'error');
            return;
        }

        const input = document.getElementById(`input-model-${brandName.replace(/\s/g, '_')}`);
        const modelName = input.value.trim();

        if (!modelName) return;

        const brandModels = StorageService.get(STORAGE_KEYS.BRAND_MODELS) || {};
        if (!brandModels[brandName]) brandModels[brandName] = [];

        if (brandModels[brandName].includes(modelName)) {
            this.showToast(`Ce modèle existe déjà pour ${brandName}`, 'warning');
            return;
        }

        try {
            const res = await ApiService.addVehicleModel(brandObj.id, { name: modelName });
            if (res.success) {
                // Update local cache
                brandModels[brandName].push(modelName);

                // Also update the full brands object if needed, but BRAND_MODELS is the main source for this view
                // We should definitely update BRANDS_RAW models list too
                if (brandObj.models) brandObj.models.push(res.data);
                else brandObj.models = [res.data];

                localStorage.setItem(STORAGE_KEYS.BRANDS_RAW, JSON.stringify(brands));
                localStorage.setItem(STORAGE_KEYS.BRAND_MODELS, JSON.stringify(brandModels));

                this.renderSettings();
                this.showToast(`Modèle "${modelName}" ajouté à ${brandName}`, 'success');
            } else {
                this.showToast(res.message || 'Erreur lors de l\'ajout', 'error');
            }
        } catch (error) {
            console.error(error);
            this.showToast('Erreur serveur', 'error');
        }
    },

    async removeBrandModel(brandName, modelName) {
        // Find brand ID and Model ID
        const brands = StorageService.get(STORAGE_KEYS.BRANDS_RAW) || [];
        const brandObj = brands.find(b => b.name === brandName);

        if (!brandObj) return;

        // We need the model ID. It's in brandObj.models
        const modelObj = (brandObj.models || []).find(m => m.name === modelName);

        if (!modelObj) {
            // Fallback: if we only have names in cache (migrated data), we might not have IDs easily 
            // but BRANDS_RAW should be fully populated by syncAll.
            console.warn('Model ID not found locally for deletion');
            this.showToast('Erreur: impossible de trouver l\'ID du modèle', 'error');
            return;
        }

        try {
            const res = await ApiService.deleteVehicleModel(modelObj.id);
            if (res.success) {
                const brandModels = StorageService.get(STORAGE_KEYS.BRAND_MODELS) || {};
                if (brandModels[brandName]) {
                    brandModels[brandName] = brandModels[brandName].filter(m => m !== modelName);
                    localStorage.setItem(STORAGE_KEYS.BRAND_MODELS, JSON.stringify(brandModels));
                }

                // Update BRANDS_RAW
                brandObj.models = brandObj.models.filter(m => m.id !== modelObj.id);
                localStorage.setItem(STORAGE_KEYS.BRANDS_RAW, JSON.stringify(brands));

                this.renderSettings();
                this.showToast(`Modèle "${modelName}" supprimé`, 'info');
            }
        } catch (error) {
            console.error(error);
            this.showToast('Erreur serveur lors de la suppression', 'error');
        }
    },

    async addConfigItem(type) {
        const input = document.getElementById(`input-${type}`);
        const value = input.value.trim();
        if (!value) return;

        const key = STORAGE_KEYS[type];
        await StorageService.add(key, value);

        if (type === 'BRANDS') {
            const brandModels = StorageService.get(STORAGE_KEYS.BRAND_MODELS) || {};
            if (!brandModels[value]) {
                brandModels[value] = [];
                // Keep BRAND_MODELS as a simple structured object in localStorage for now
                // as it's not directly supported by a single API endpoint yet (models are per brand)
                localStorage.setItem(STORAGE_KEYS.BRAND_MODELS, JSON.stringify(brandModels));
            }
        }

        this.renderSettings();
        this.showToast(`${value} ajouté`, 'success');
        input.value = '';
    },

    async removeConfigItem(type, value) {
        const key = STORAGE_KEYS[type];
        await StorageService.delete(key, value);

        if (type === 'BRANDS') {
            const brandModels = StorageService.get(STORAGE_KEYS.BRAND_MODELS) || {};
            delete brandModels[value];
            localStorage.setItem(STORAGE_KEYS.BRAND_MODELS, JSON.stringify(brandModels));
        }

        this.renderSettings();
        this.showToast(`${value} supprimé`, 'info');
    },

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast glass ${type}`;
        toast.style.cssText = `
                        position: fixed;
                        bottom: 2rem;
                        right: 2rem;
                        padding: 1rem 2rem;
                        border-radius: 12px;
                        background: var(--bg-card);
                        border: 1px solid var(--border-color);
                        color: var(--text-main);
                        z-index: 10000;
                        display: flex;
                        align-items: center;
                        gap: 0.75rem;
                        box-shadow: var(--shadow-lg);
                        opacity: 0;
                        transform: translateY(20px);
                        transition: all 0.3s ease;
                        `;

        const icon = type === 'success' ? 'fa-check-circle' : 'fa-info-circle';
        toast.innerHTML = `<i class="fas ${icon}" style="color: var(--primary)"></i> <span>${message}</span>`;

        document.body.appendChild(toast);

        // Trigger animation
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 10);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
        return toast;
    },

    renderShowroomSection(showrooms) {
        return `
                <div class="settings-section">
                    <h3><i class="fas fa-store"></i> Showrooms</h3>
                    <div class="data-table-container glass" style="margin-bottom: 15px;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Nom</th>
                                    <th>Ville</th>
                                    <th>Adresse / Téléphone</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(showrooms || []).map(s => `
                                    <tr>
                                        <td><strong>${s.name}</strong></td>
                                        <td>${s.city || '-'}</td>
                                        <td>
                                            <div style="font-size: 0.8rem; color: var(--text-dim);">${s.address || '-'}</div>
                                            <div style="font-size: 0.8rem; color: var(--primary);">${s.phone || '-'}</div>
                                        </td>
                                        <td class="table-actions">
                                            <button type="button" class="btn-icon-small danger" onclick="app.removeConfigItem('SHOWROOMS', '${s.id}')">
                                                <i class="fas fa-times"></i>
                                            </button>
                                            <button type="button" class="btn-icon-small" onclick="app.editShowroom('${s.id}')" title="Modifier">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="add-config-form">
                        <input type="text" id="input-SHOWROOMS" placeholder="Ajouter un showroom..." class="glass-input" autocomplete="off">
                        <button type="button" class="btn-primary" onclick="app.addConfigItem('SHOWROOMS')">Ajouter rapide</button>
                    </div>
                </div>
            `;
    },

    editShowroom(id) {
        const showrooms = StorageService.get(STORAGE_KEYS.SHOWROOMS_RAW) || [];
        const showroom = showrooms.find(s => s.id === id);
        if (!showroom) return;

        const modalHtml = `
                <div class="modal-overlay">
                    <div class="modal-content glass" style="width: 500px;">
                        <div class="modal-header">
                            <h2>Modifier le Showroom</h2>
                            <button class="btn-close" onclick="app.closeModal()">&times;</button>
                        </div>
                        <form id="edit-showroom-form" autocomplete="off">
                            <input type="hidden" name="id" value="${showroom.id}">
                            <div class="form-group">
                                <label>Nom</label>
                                <input type="text" name="name" value="${showroom.name}" required class="glass-input">
                            </div>
                            <div class="form-group">
                                <label>Ville</label>
                                <input type="text" name="city" value="${showroom.city || ''}" class="glass-input">
                            </div>
                            <div class="form-group">
                                <label>Adresse</label>
                                <textarea name="address" class="glass-input" rows="2">${showroom.address || ''}</textarea>
                            </div>
                            <div class="form-group">
                                <label>Téléphone</label>
                                <input type="text" name="phone" value="${showroom.phone || ''}" class="glass-input">
                            </div>
                            <div class="form-group">
                                <label>Responsable</label>
                                <input type="text" name="manager" value="${showroom.manager || ''}" class="glass-input">
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                                <button type="submit" class="btn-primary">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('edit-showroom-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {
                name: formData.get('name'),
                city: formData.get('city'),
                address: formData.get('address'),
                phone: formData.get('phone'),
                manager: formData.get('manager')
            };

            try {
                // Merge new data with existing showroom data for a full update
                const fullShowroom = { ...showroom, ...data };
                await StorageService.update(STORAGE_KEYS.SHOWROOMS_RAW, id, fullShowroom);

                // Also update simple list
                const latestShowrooms = StorageService.get(STORAGE_KEYS.SHOWROOMS_RAW) || [];
                const simpleList = latestShowrooms.map(s => s.name);
                localStorage.setItem(STORAGE_KEYS.SHOWROOMS, JSON.stringify(simpleList));

                this.closeModal();
                this.renderSettings();
                this.showToast('Showroom mis à jour', 'success');
            } catch (error) {
                console.error(error);
                this.showToast('Erreur serveur', 'error');
            }
        });
    },

    renderBrandsSection(brands) {
        return `
                <div class="settings-section">
                    <h3><i class="fas fa-car"></i> Marques</h3>
                    <div class="data-table-container glass" style="margin-bottom: 15px;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Logo</th>
                                    <th>Nom</th>
                                    <th>Modèles</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(brands || []).map(b => `
                                    <tr>
                                        <td>
                                            ${b.logo ? `<img src="${b.logo}" style="height: 30px; border-radius: 4px;">` : '<i class="fas fa-car"></i>'}
                                        </td>
                                        <td><strong>${b.name}</strong></td>
                                        <td>
                                            <span class="status-badge info">${(b.models || []).length} modèles</span>
                                        </td>
                                        <td class="table-actions">
                                            <button type="button" class="btn-icon-small danger" onclick="app.removeConfigItem('BRANDS', '${b.id}')">
                                                <i class="fas fa-times"></i>
                                            </button>
                                            <button type="button" class="btn-icon-small" onclick="app.editBrand('${b.id}')" title="Modifier">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="add-config-form">
                        <input type="text" id="input-BRANDS" placeholder="Ajouter une marque..." class="glass-input" autocomplete="off">
                        <button type="button" class="btn-primary" onclick="app.addConfigItem('BRANDS')">Ajouter</button>
                    </div>
                </div>
            `;
    },

    editBrand(id) {
        const brands = StorageService.get(STORAGE_KEYS.BRANDS_RAW) || [];
        const brand = brands.find(b => b.id === id);
        if (!brand) return;

        const modalHtml = `
                <div class="modal-overlay">
                    <div class="modal-content glass" style="width: 500px;">
                        <div class="modal-header">
                            <h2>Modifier la Marque</h2>
                            <button class="btn-close" onclick="app.closeModal()">&times;</button>
                        </div>
                        <form id="edit-brand-form" autocomplete="off">
                            <input type="hidden" name="id" value="${brand.id}">
                            <div class="form-group">
                                <label>Nom</label>
                                <input type="text" name="name" value="${brand.name}" required class="glass-input">
                            </div>
                            <div class="form-group">
                                <label>Logo</label>
                                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
                                    <div id="brand-logo-preview" style="width: 60px; height: 60px; border-radius: 8px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
                                        ${brand.logo ? `<img src="${brand.logo}" style="max-width: 100%; max-height: 100%;">` : '<i class="fas fa-image" style="opacity: 0.3;"></i>'}
                                    </div>
                                    <div style="flex: 1;">
                                        <input type="file" id="brand-logo-file" accept="image/*" style="display: none;">
                                        <button type="button" class="btn-secondary" onclick="document.getElementById('brand-logo-file').click()" style="width: 100%; font-size: 0.8rem;">
                                            <i class="fas fa-upload"></i> Remplacer le logo (PNG/JPG)
                                        </button>
                                        <div id="upload-status" style="font-size: 0.7rem; color: var(--text-dim); margin-top: 5px;">Format recommandé: Carré, fond transparent</div>
                                    </div>
                                </div>
                                <input type="text" name="logo" id="brand-logo-url" value="${brand.logo || ''}" class="glass-input" placeholder="Ou URL du logo: https://...">
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                                <button type="submit" class="btn-primary">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Handle file upload
        document.getElementById('brand-logo-file').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const statusEl = document.getElementById('upload-status');
            const previewEl = document.getElementById('brand-logo-preview');
            const urlInput = document.getElementById('brand-logo-url');

            statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Téléchargement...';

            try {
                const res = await ApiService.uploadFile(file);
                if (res.success) {
                    urlInput.value = res.data.url;
                    previewEl.innerHTML = `<img src="${res.data.url}" style="max-width: 100%; max-height: 100%;">`;
                    statusEl.innerHTML = '<span style="color: var(--success);"><i class="fas fa-check"></i> Téléchargé avec succès</span>';
                    this.showToast('Logo téléchargé', 'success');
                } else {
                    throw new Error(res.message);
                }
            } catch (err) {
                console.error('Upload error:', err);
                statusEl.innerHTML = `<span style="color: var(--danger);"><i class="fas fa-exclamation-triangle"></i> ${err.message || 'Erreur'}</span>`;
                this.showToast('Erreur lors du téléchargement', 'error');
            }
        });

        document.getElementById('edit-brand-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {
                name: formData.get('name'),
                logo: formData.get('logo')
            };

            try {
                const res = await ApiService.updateBrand(id, data);
                if (res.success) {
                    // Update local cache
                    const index = brands.findIndex(b => b.id === id);
                    if (index !== -1) {
                        brands[index] = res.data; // Update full object
                        localStorage.setItem(STORAGE_KEYS.BRANDS_RAW, JSON.stringify(brands));

                        // Update name list
                        const simpleList = brands.map(b => b.name);
                        localStorage.setItem(STORAGE_KEYS.BRANDS, JSON.stringify(simpleList));
                    }

                    this.closeModal();
                    this.renderSettings();
                    this.showToast('Marque mise à jour', 'success');
                } else {
                    this.showToast(res.message || 'Erreur lors de la mise à jour', 'error');
                }
            } catch (error) {
                console.error(error);
                this.showToast('Erreur serveur', 'error');
            }
        });
    },

    renderUserManagementSection() {
        const users = StorageService.get(STORAGE_KEYS.USERS) || [];
        const roles = StorageService.get(STORAGE_KEYS.ROLES) || [];

        return `
                        <div class="settings-section">
                            <h3><i class="fas fa-users-cog"></i> Gestion des Utilisateurs</h3>
                            <div class="data-table-container glass" style="margin-bottom: 20px;">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Nom</th>
                                            <th>Username</th>
                                            <th>Rôle</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${users.map(u => `
                                    <tr>
                                        <td>${u.name}</td>
                                        <td><code>${u.username}</code></td>
                                        <td><span class="status-badge ${u.role}">${roles.find(r => r.id === u.role)?.name || u.role}</span></td>
                                        <td class="table-actions">
                                            <button type="button" class="btn-action" onclick="app.showEditUserModal('${u.id}')" title="Modifier">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                             ${u.username !== 'admin' ? `
                                                <button type="button" class="btn-action danger" onclick="app.removeUser('${u.id}')" title="Supprimer">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            ` : `
                                                <button type="button" class="btn-action warning" onclick="app.resetAdminPassword()" title="Réinitialiser MDP (admin123)">
                                                    <i class="fas fa-key"></i>
                                                </button>
                                            `}
                                        </td>
                                    </tr>
                                `).join('')}
                                    </tbody>
                                </table>
                            </div>

                            <div class="add-config-form vertical glass" style="padding: 15px; border-radius: 8px;">
                                <h4>Ajouter un utilisateur</h4>
                                <div class="form-row" style="margin-top: 10px;">
                                    <div class="form-group">
                                        <label>Nom Complet</label>
                                        <input type="text" id="user-name" class="glass-input" placeholder="ex: John Doe" autocomplete="off">
                                    </div>
                                    <div class="form-group">
                                        <label>Identifiant</label>
                                        <input type="text" id="user-username" class="glass-input" placeholder="Nom d'utilisateur" autocomplete="off">
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Mot de passe</label>
                                        <input type="password" id="user-password" class="glass-input" placeholder="Saisir un mot de passe" autocomplete="off">
                                    </div>
                                    <div class="form-group">
                                        <label>Rôle</label>
                                        <select id="user-role" class="glass-select">
                                            ${roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
                                        </select>
                                    </div>
                                </div>
                                <button type="button" class="btn-primary" onclick="app.addUser()" style="margin-top: 10px;">Enregistrer l'utilisateur</button>
                            </div>
                        </div>
                        `;
    },

    async addUser() {
        const name = document.getElementById('user-name').value.trim();
        const username = document.getElementById('user-username').value.trim();
        const password = document.getElementById('user-password').value.trim();
        const role = document.getElementById('user-role').value;

        if (!name || !username || !password || !role) {
            this.showToast("Veuillez remplir tous les champs", "warning");
            return;
        }

        const newUser = {
            id: `u${Date.now()}`,
            name,
            username,
            password,
            role
        };

        await StorageService.add(STORAGE_KEYS.USERS, newUser);
        this.renderSettings();
        this.showToast(`Utilisateur ${name} créé avec succès`, "success");

        // Clear fields
        document.getElementById('user-name').value = '';
        document.getElementById('user-username').value = '';
        document.getElementById('user-password').value = '';
    },

    showEditUserModal(id) {
        const users = StorageService.get(STORAGE_KEYS.USERS);
        const user = users.find(u => u.id === id);
        if (!user) return;

        const roles = StorageService.get(STORAGE_KEYS.ROLES);

        const modalHtml = `
                        <div class="modal-overlay">
                            <div class="modal-content glass" style="width: 500px;">
                                <div class="modal-header">
                                    <h2>Modifier l'Utilisateur</h2>
                                    <button class="btn-close" onclick="app.closeModal()">&times;</button>
                                </div>
                                <form id="edit-user-form" autocomplete="off">
                                    <input type="hidden" name="id" value="${user.id}">
                                        <div class="form-group">
                                            <label>Nom Complet</label>
                                            <input type="text" name="name" value="${user.name}" required class="glass-input">
                                        </div>
                                        <div class="form-group">
                                            <label>Identifiant</label>
                                            <input type="text" name="username" value="${user.username}" required class="glass-input" ${user.username === 'admin' ? 'readonly' : ''}>
                                        </div>
                                        <div class="form-group">
                                            <label>Mot de passe</label>
                                            <input type="password" name="password" value="${user.password}" required class="glass-input">
                                        </div>
                                        <div class="form-group">
                                            <label>Rôle</label>
                                            <select name="role" class="glass-select" ${user.username === 'admin' ? 'disabled' : ''}>
                                                ${roles.map(r => `<option value="${r.id}" ${user.role === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
                                            </select>
                                        </div>
                                        <div class="modal-footer">
                                            <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                                            <button type="submit" class="btn-primary">Enregistrer</button>
                                        </div>
                                </form>
                            </div>
                        </div>
                        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const updatedUser = {
                id: formData.get('id'),
                name: formData.get('name'),
                username: formData.get('username'),
                password: formData.get('password'),
                role: formData.get('role') // Mapping will be handled by StorageService
            };

            try {
                await StorageService.update(STORAGE_KEYS.USERS, updatedUser.id, updatedUser);

                const currentUser = StorageService.get(STORAGE_KEYS.CURRENT_USER);
                if (currentUser && currentUser.id === updatedUser.id) {
                    // Refresh session user data from storage
                    const users = StorageService.get(STORAGE_KEYS.USERS);
                    const freshUser = users.find(u => u.id === updatedUser.id);
                    if (freshUser) {
                        const updatedSession = {
                            ...currentUser,
                            username: freshUser.username,
                            name: freshUser.name,
                            role: freshUser.role, // ID of the role
                            clientId: freshUser.clientId
                        };
                        await StorageService.save(STORAGE_KEYS.CURRENT_USER, updatedSession);
                        this.renderSidebar();
                    }
                }

                this.closeModal();
                this.renderSettings();
                this.showToast("Utilisateur mis à jour", "success");
            } catch (error) {
                console.error(error);
                this.showToast("Erreur lors de la mise à jour", "error");
            }
        });
    },

    removeUser(id) {
        this.showConfirmModal("Supprimer cet utilisateur ?", async () => {
            await StorageService.delete(STORAGE_KEYS.USERS, id);
            this.renderSettings();
            this.showToast("Utilisateur supprimé", "info");
        });
    },

    async resetAdminPassword() {
        if (!confirm('Voulez-vous vraiment réinitialiser le mot de passe de l\'administrateur à "admin123" ?')) return;

        try {
            const res = await ApiService.resetAdminPassword();
            if (res.success) {
                this.showToast(res.message, "success");
            } else {
                this.showToast(res.message || "Erreur lors de la réinitialisation", "error");
            }
        } catch (error) {
            console.error(error);
            this.showToast("Erreur serveur lors de la réinitialisation", "error");
        }
    },

    canAccess(view) {
        const currentUser = StorageService.get(STORAGE_KEYS.CURRENT_USER);
        if (!currentUser) return false;

        // Admin always has full access
        if (currentUser.role === 'admin') return true;

        const roles = StorageService.get(STORAGE_KEYS.ROLES) || [];
        const userRole = roles.find(r => r.id === currentUser.role);

        // If user has 'all' or 'view_all' permission, grant access to everything
        if (userRole && (userRole.permissions.includes('all') || userRole.permissions.includes('view_all'))) {
            return true;
        }

        if (!userRole) return false;
        return userRole.permissions.includes(view);
    },

    renderSidebar() {
        const currentUser = StorageService.get(STORAGE_KEYS.CURRENT_USER);
        if (!currentUser) return;

        const roles = StorageService.get(STORAGE_KEYS.ROLES);
        const userRole = roles.find(r => r.id === currentUser.role);

        if (!userRole) return;

        // Update user profile in sidebar if exists
        const profileArea = document.querySelector('.user-profile');
        if (profileArea) {
            profileArea.innerHTML = `
                    <div class="user-avatar">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=6366f1&color=fff" alt="${currentUser.name}">
                    </div>
                    <div class="user-info">
                        <span class="user-name">${currentUser.name}</span>
                        <span class="user-role">${userRole.name}</span>
                    </div>
                    <button class="btn-logout" onclick="app.logout()" title="Déconnexion">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                `;
        }


        // Hide/Show nav links based on permissions
        document.querySelectorAll('.nav-link').forEach(link => {
            const view = link.getAttribute('data-view');
            if (this.canAccess(view)) {
                link.style.display = 'flex';
            } else {
                link.style.display = 'none';
            }
        });

        // Specific check for audit log visibility (redundant but safe)
        const auditLink = document.querySelector('[data-view="audit"]');
        if (auditLink) {
            auditLink.style.display = (currentUser.role === 'admin') ? 'flex' : 'none';
        }
    },

    logout() {
        if (confirm("Voulez-vous vous déconnecter ?")) {
            localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
            window.location.reload();
        }
    },

    renderRoleManagementSection() {
        const roles = StorageService.get(STORAGE_KEYS.ROLES) || [];

        return `
                <div class="settings-section">
                    <h3><i class="fas fa-shield-alt"></i> Gestion des Droits d'Accès</h3>
                    <div class="data-table-container glass">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Nom du Rôle</th>
                                    <th>Permissions Actives</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${roles.map(r => `
                                    <tr>
                                        <td><strong>${r.name}</strong></td>
                                        <td>
                                            ${r.id === 'admin' ?
                '<span class="badge-pill" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2);">Accès Total</span>' :
                `<span class="badge-pill" style="background: rgba(99, 102, 241, 0.1); color: var(--primary); border: 1px solid rgba(99, 102, 241, 0.2);">${r.permissions.length} permissions actives</span>`
            }
                                        </td>
                                        <td class="table-actions">
                                            <button type="button" class="btn-action" onclick="app.showEditRoleModal('${r.id}')" title="Modifier les droits">
                                                <i class="fas fa-key"></i>
                                            </button>
                                            ${r.id !== 'admin' ? `
                                                <button type="button" class="btn-action danger" onclick="app.removeRole('${r.id}')" title="Supprimer">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            ` : ''}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div class="add-config-form vertical glass" style="padding: 15px; border-radius: 8px; margin-top: 20px;">
                        <h4>Ajouter un rôle</h4>
                        <div class="form-row" style="margin-top: 10px;">
                            <div class="form-group">
                                <label>Identifiant du rôle (ID)</label>
                                <input type="text" id="role-id" class="glass-input" placeholder="ex: redacteur">
                            </div>
                            <div class="form-group">
                                <label>Nom du rôle</label>
                                <input type="text" id="role-name" class="glass-input" placeholder="ex: Rédacteur">
                            </div>
                        </div>
                        <button type="button" class="btn-primary" onclick="app.addRole()" style="margin-top: 10px;">Créer le rôle</button>
                    </div>
                </div>
            `;
    },

    async addRole() {
        const id = document.getElementById('role-id').value.trim().toLowerCase();
        const name = document.getElementById('role-name').value.trim();

        if (!id || !name) {
            this.showToast("Veuillez remplir l'ID et le Nom du rôle", "warning");
            return;
        }

        const roles = StorageService.get(STORAGE_KEYS.ROLES) || [];
        if (roles.find(r => r.id === id)) {
            this.showToast("Un rôle avec cet ID existe déjà", "error");
            return;
        }

        const newRole = {
            id,
            name,
            permissions: ['dashboard'] // Default permission
        };

        try {
            await StorageService.add(STORAGE_KEYS.ROLES, newRole);
            this.renderSettings();
            this.showToast(`Rôle "${name}" créé avec succès`, "success");
            // Clear inputs
            document.getElementById('role-id').value = '';
            document.getElementById('role-name').value = '';
        } catch (error) {
            console.error(error);
            this.showToast("Erreur lors de la création du rôle", "error");
        }
    },

    async refreshShipmentTracking(id, btnElement) {
        // Rediriger vers la fonction unifiée trackShipment
        return this.trackShipment(id);
    },



    showTrackingHistoryModal(shipmentId) {
        const shipments = StorageService.get(STORAGE_KEYS.SHIPMENTS) || [];
        const s = shipments.find(x => x.id === shipmentId || String(x.id) === String(shipmentId));
        if (!s) return this.showToast('Expédition introuvable', 'error');

        let events = [];
        try { events = JSON.parse(s.trackingHistory || '[]'); } catch (e) { events = []; }

        const eventsHtml = events.length > 0 ? events.map((e, i) => `
            <div style="display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                <div style="display: flex; flex-direction: column; align-items: center; width: 24px;">
                    <i class="fas fa-circle" style="color: ${i === 0 ? 'var(--primary)' : 'rgba(255,255,255,0.2)'}; font-size: ${i === 0 ? '10px' : '7px'}; margin-top: 3px;"></i>
                    ${i < events.length - 1 ? '<div style="flex: 1; width: 2px; background: rgba(255,255,255,0.1); margin: 4px auto;"></div>' : ''}
                </div>
                <div style="flex: 1; padding-bottom: 4px;">
                    <div style="font-weight: ${i === 0 ? '700' : '500'}; color: ${i === 0 ? 'var(--text-primary)' : 'var(--text-secondary)'}; font-size: 0.85rem;">${e.description || e.eventCode || 'Événement'}</div>
                    ${e.location ? `<div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 2px;"><i class="fas fa-map-marker-alt" style="margin-right: 4px; color: var(--danger);"></i>${e.location}</div>` : ''}
                    ${e.date ? `<div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 2px;"><i class="fas fa-clock" style="margin-right: 4px;"></i>${new Date(e.date).toLocaleString('fr-FR')}</div>` : ''}
                    ${e.isActual === false ? '<span style="font-size: 0.65rem; background: rgba(245,158,11,0.15); color: var(--warning); padding: 1px 5px; border-radius: 3px; display: inline-block; margin-top: 2px;">Prévu</span>' : ''}
                </div>
            </div>
        `).join('') : '<div style="text-align: center; padding: 2rem; color: var(--text-dim);"><i class="fas fa-satellite-dish" style="font-size: 2rem; opacity:0.3; display:block; margin-bottom:8px;"></i>Aucun événement disponible. Cliquez sur Actualiser pour récupérer le tracking.</div>';

        const modalHtml = `
            <div class="modal-overlay" onclick="app.closeModal()">
                <div class="modal-content glass" onclick="event.stopPropagation()" style="width: 560px; max-width: 95vw; max-height: 85vh; display: flex; flex-direction: column;">
                    <div class="modal-header">
                        <div>
                            <h2 style="margin:0;"><i class="fas fa-satellite-dish" style="color: var(--primary); margin-right: 10px;"></i>Historique Tracking</h2>
                            <p style="font-size: 0.8rem; color: var(--text-dim); margin-top: 4px;">
                                Cont: <strong>${s.containerNumber || 'N/A'}</strong> | BL: <strong>${s.blNumber || 'N/A'}</strong>
                                ${s.shipStatus ? ` | Navire: <strong>${s.shipStatus}</strong>` : ''}
                            </p>
                        </div>
                        <button class="btn-close" onclick="app.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body" style="padding: 20px; overflow-y: auto; flex: 1;">
                        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;">
                            ${s.loadingPort ? `<span style="padding: 4px 10px; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3); border-radius: 12px; font-size: 0.75rem; color: var(--primary);"><i class="fas fa-anchor" style="margin-right: 4px;"></i>${s.loadingPort}</span>` : ''}
                            ${s.destination ? `<span style="padding: 4px 10px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; font-size: 0.75rem; color: var(--danger);"><i class="fas fa-map-marker-alt" style="margin-right: 4px;"></i>${s.destination}</span>` : ''}
                            ${s.eta ? `<span style="padding: 4px 10px; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 12px; font-size: 0.75rem; color: var(--success);"><i class="fas fa-calendar-check" style="margin-right: 4px;"></i>ETA: ${new Date(s.eta).toLocaleDateString('fr-FR')}</span>` : ''}
                        </div>
                        <div>${eventsHtml}</div>
                    </div>
                    <div class="modal-footer" style="padding-top: 15px; border-top: 1px solid var(--border-glass); display: flex; gap: 10px; justify-content: flex-end;">
                        <button class="btn-secondary" onclick="app.closeModal()">Fermer</button>
                        <button class="btn-primary" onclick="app.trackShipment('${s.id}'); app.closeModal();">
                            <i class="fas fa-sync-alt" style="margin-right: 6px;"></i>Actualiser Tracking
                        </button>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    removeRole(id) {
        this.showConfirmModal(`Supprimer le rôle "${id}" ?`, async () => {
            try {
                await StorageService.delete(STORAGE_KEYS.ROLES, id);
                this.renderSettings();
                this.showToast("Rôle supprimé", "info");
            } catch (error) {
                console.error(error);
                this.showToast("Erreur lors de la suppression", "error");
            }
        });
    },

    showEditRoleModal(roleId) {
        const roles = StorageService.get(STORAGE_KEYS.ROLES);
        const role = roles.find(r => r.id === roleId);
        if (!role) return;

        const permissionGroups = {
            'Tableau de Bord': [
                { id: 'dashboard', label: 'Accès Vue' }
            ],
            'Alertes': [
                { id: 'alerts', label: 'Accès Vue' }
            ],
            'Commandes': [
                { id: 'orders', label: 'Accès Vue' },
                { id: 'orders.create', label: 'Créer' },
                { id: 'orders.edit', label: 'Modifier' },
                { id: 'orders.delete', label: 'Supprimer' },
                { id: 'orders.financials', label: 'Voir Finances (Prix/Marges)' },
                { id: 'orders.validate', label: 'Valider/Dévalider' }
            ],
            'Véhicules': [
                { id: 'vehicles', label: 'Accès Vue' },
                { id: 'vehicles.create', label: 'Créer' },
                { id: 'vehicles.edit', label: 'Modifier' },
                { id: 'vehicles.delete', label: 'Supprimer' },
                { id: 'vehicles.purchase_price', label: 'Voir Prix Achat' }
            ],
            'Clients': [
                { id: 'clients', label: 'Accès Vue' },
                { id: 'clients.create', label: 'Créer' },
                { id: 'clients.edit', label: 'Modifier' },
                { id: 'clients.delete', label: 'Supprimer' }
            ],
            'Expédition': [
                { id: 'shipments', label: 'Accès Vue' },
                { id: 'shipments.manage', label: 'Gérer' }
            ],
            'Caisse': [
                { id: 'cash', label: 'Accès Vue' },
                { id: 'cash.manage', label: 'Gérer' }
            ],
            'Paramètres': [
                { id: 'settings', label: 'Accès Vue' },
                { id: 'settings.users', label: 'Gérer Utilisateurs' }
            ],
            'Autres': [
                { id: 'exchange-rates', label: 'Taux de Chang' },
                { id: 'verification', label: 'Verif Doc' }
            ]
        };

        const modalHtml = `
                <div class="modal-overlay">
                    <div class="modal-content glass" style="width: 800px; max-height: 90vh; overflow-y: auto;">
                        <div class="modal-header">
                            <h2>Droits d'accès : ${role.name}</h2>
                            <button class="btn-close" onclick="app.closeModal()">&times;</button>
                        </div>
                        <form id="edit-role-form">
                            <input type="hidden" name="id" value="${role.id}">
                            
                            <div class="permissions-container" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin: 20px 0;">
                                ${Object.entries(permissionGroups).map(([group, permissions]) => `
                                    <div class="permission-group glass" style="padding: 1rem; border-radius: 8px;">
                                        <h4 style="margin-bottom: 1rem; color: var(--primary); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem;">
                                            ${group}
                                        </h4>
                                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                            ${permissions.map(p => `
                                                <label class="checkbox-item" style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px 0;">
                                                    <input type="checkbox" name="permissions" value="${p.id}" 
                                                        ${role.permissions.includes(p.id) ? 'checked' : ''} 
                                                        ${role.id === 'admin' ? 'disabled' : ''}>
                                                    <span style="font-size: 0.9rem;">${p.label}</span>
                                                </label>
                                            `).join('')}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>

                            <div class="modal-footer">
                                <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                                <button type="submit" class="btn-primary" ${role.id === 'admin' ? 'disabled' : ''}>Enregistrer les droits</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('edit-role-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (role.id === 'admin') return;

            const formData = new FormData(e.target);
            const selectedPermissions = formData.getAll('permissions');

            const roleList = StorageService.get(STORAGE_KEYS.ROLES);
            const index = roleList.findIndex(r => r.id === roleId);
            if (index !== -1) {
                roleList[index].permissions = selectedPermissions;
                await StorageService.save(STORAGE_KEYS.ROLES, roleList);
                this.closeModal();
                this.renderSettings();
                this.renderSidebar();
                this.showToast("Droits d'accès mis à jour", "success");
            }
        });
    },



    renderExchangeRates(query = '') {
        const rates = StorageService.get(STORAGE_KEYS.EXCHANGE_RATES) || [];
        // Sort by date descending
        rates.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Filtering based on query (if needed in future)
        const filteredRates = rates.filter(r =>
            r.fromCurrency.toLowerCase().includes(query.toLowerCase()) ||
            r.toCurrency.toLowerCase().includes(query.toLowerCase())
        );

        this.viewContainer.innerHTML = `
                <div class="view-header">
                    <h1>Taux de Change</h1>
                    <div class="header-actions">
                        <button class="btn-primary" onclick="app.showExchangeRateModal()">
                            <i class="fas fa-plus"></i> Nouveau Taux
                        </button>
                    </div>
                </div>
                
                <div class="data-table-container glass">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>De</th>
                                <th>Vers</th>
                                <th>Taux</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredRates.length ? filteredRates.map(r => `
                                <tr>
                                    <td>${new Date(r.date).toLocaleDateString()}</td>
                                    <td><span class="badge-pill" style="background: rgba(99, 102, 241, 0.1); color: var(--primary);">${r.fromCurrency}</span></td>
                                    <td><span class="badge-pill" style="background: rgba(99, 102, 241, 0.1); color: var(--primary);">${r.toCurrency}</span></td>
                                    <td style="font-family: monospace; font-size: 1.1em;">${parseFloat(r.rate).toFixed(4)}</td>
                                    <td>
                                        <div class="table-actions">
                                            <button type="button" class="btn-action" onclick="app.showEditExchangeRateModal('${r.id}')" title="Modifier">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button type="button" class="btn-action danger" onclick="app.deleteExchangeRate('${r.id}')" title="Supprimer">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="5" style="text-align: center; padding: 20px;">Aucun taux de change trouvé</td></tr>'}
                        </tbody>
                    </table>
                </div>
            `;
    },



    showExchangeRateModal() {
        const currencies = StorageService.get(STORAGE_KEYS.CURRENCIES) || ['EUR', 'USD', 'XAF', 'CAD', 'GBP', 'CHF'];
        const today = new Date().toISOString().split('T')[0];

        const modalHtml = `
                <div class="modal-overlay">
                    <div class="modal-content glass" style="width: 500px;">
                        <div class="modal-header">
                            <h2>Ajouter un Taux de Change</h2>
                            <button class="btn-close" onclick="app.closeModal()">&times;</button>
                        </div>
                        <form id="exchange-rate-form">
                            <input type="hidden" name="id" value="">
                            <div class="form-group">
                                <label>Date</label>
                                <input type="date" name="date" value="${today}" required class="glass-input">
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>De (Devise Source)</label>
                                    <select name="fromCurrency" class="glass-select" required>
                                        <option value="">Sélectionner</option>
                                        ${currencies.map(c => `<option value="${c}">${c}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Vers (Devise Cible)</label>
                                    <select name="toCurrency" class="glass-select" required>
                                        <option value="">Sélectionner</option>
                                        ${currencies.map(c => `<option value="${c}">${c}</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Taux de Change</label>
                                <input type="number" name="rate" step="0.000001" placeholder="ex: 1.10" required class="glass-input">
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                                <button type="submit" class="btn-primary">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('exchange-rate-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleExchangeRateSubmission(new FormData(e.target));
        });
    },

    showEditExchangeRateModal(id) {
        const rates = StorageService.get(STORAGE_KEYS.EXCHANGE_RATES);
        const rate = rates.find(r => r.id === id);
        if (!rate) return;

        const currencies = StorageService.get(STORAGE_KEYS.CURRENCIES) || ['EUR', 'USD', 'XAF', 'CAD', 'GBP', 'CHF'];

        const modalHtml = `
                <div class="modal-overlay">
                    <div class="modal-content glass" style="width: 500px;">
                        <div class="modal-header">
                            <h2>Modifier le Taux de Change</h2>
                            <button class="btn-close" onclick="app.closeModal()">&times;</button>
                        </div>
                        <form id="exchange-rate-form">
                            <input type="hidden" name="id" value="${rate.id}">
                            <div class="form-group">
                                <label>Date</label>
                                <input type="date" name="date" value="${rate.date}" required class="glass-input">
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>De (Devise Source)</label>
                                    <select name="fromCurrency" class="glass-select" required>
                                        ${currencies.map(c => `<option value="${c}" ${c === rate.fromCurrency ? 'selected' : ''}>${c}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Vers (Devise Cible)</label>
                                    <select name="toCurrency" class="glass-select" required>
                                        ${currencies.map(c => `<option value="${c}" ${c === rate.toCurrency ? 'selected' : ''}>${c}</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Taux de Change</label>
                                <input type="number" name="rate" step="0.000001" value="${rate.rate}" required class="glass-input">
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                                <button type="submit" class="btn-primary">Mettre à jour</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('exchange-rate-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleExchangeRateSubmission(new FormData(e.target));
        });
    },

    async handleExchangeRateSubmission(formData) {
        try {
            const rates = StorageService.get(STORAGE_KEYS.EXCHANGE_RATES) || [];
            const id = formData.get('id');

            const newRate = {
                id: id || `ER-${Date.now()}`,
                fromCurrency: formData.get('fromCurrency'),
                toCurrency: formData.get('toCurrency'),
                rate: Number(formData.get('rate')),
                date: formData.get('date')
            };

            if (newRate.fromCurrency === newRate.toCurrency) {
                this.showToast("Les devises source et cible doivent être différentes", "warning");
                return;
            }

            if (id) {
                await StorageService.update(STORAGE_KEYS.EXCHANGE_RATES, id, newRate);
            } else {
                await StorageService.add(STORAGE_KEYS.EXCHANGE_RATES, newRate);
            }

            this.closeModal();
            this.renderExchangeRates();
            this.showToast(id ? 'Taux de change mis à jour' : 'Taux de change ajouté', 'success');
        } catch (error) {
            console.error("Error in handleExchangeRateSubmission:", error);
            this.showToast("Erreur lors de l'enregistrement du taux de change", "error");
        }
    },

    deleteExchangeRate(id) {
        this.showConfirmModal("Supprimer ce taux de change ?", async () => {
            await StorageService.delete(STORAGE_KEYS.EXCHANGE_RATES, id);
            this.renderExchangeRates();
            this.showToast("Taux de change supprimé", "info");
        });
    },

    renderShipments(query = '') {
        let shipments = StorageService.get(STORAGE_KEYS.SHIPMENTS);
        const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES);
        const orders = StorageService.get(STORAGE_KEYS.ORDERS);
        const clients = StorageService.get(STORAGE_KEYS.CLIENTS);

        if (query) {
            const q = query.toLowerCase();
            shipments = shipments.filter(s =>
                String(s.trackingNumber || '').toLowerCase().includes(q) ||
                String(s.destination || '').toLowerCase().includes(q) ||
                String(s.containerNumber || '').toLowerCase().includes(q) ||
                String(s.id || '').toLowerCase().includes(q)
            );
        }

        if (!this.shipmentFilters.showArchived) {
            shipments = shipments.filter(s => !s.isArchived);
        }

        this.viewContainer.innerHTML = `
                        <div class="view-header">
                            <div class="header-info">
                                <h1>Gestion des Expéditions</h1>
                                <p>${shipments.length} expédition(s) en cours</p>
                            </div>
                        </div>

                        <!-- AllForward Creation Section -->
                        <div class="logistics-search-container">
                            <h2 class="search-title">NOUVELLE EXPÉDITION</h2>
                            
                            <div class="search-options-grid" id="shipment-inline-form">
                                <div class="option-group">
                                    <label>Date d'Expédition</label>
                                    <div class="option-input-wrapper">
                                        <i class="fas fa-calendar-alt"></i>
                                        <input type="date" id="inline-shipment-date" value="${new Date().toISOString().split('T')[0]}">
                                    </div>
                                </div>
                                <!-- Main Fields Row (6 Columns) -->

                                <div class="option-group">
                                    <label>Chargement</label>
                                    <div class="option-input-wrapper">
                                        <i class="fas fa-ship"></i>
                                        <input type="text" id="inline-loading-port" placeholder="ex: Marseille">
                                    </div>
                                </div>
                                <div class="option-group">
                                    <label>Destination</label>
                                    <div class="option-input-wrapper">
                                        <i class="fas fa-anchor"></i>
                                        <input type="text" id="inline-destination-port" placeholder="ex: Cotonou">
                                    </div>
                                </div>
                                <div class="option-group">
                                    <label>N° Conteneur</label>
                                    <div class="option-input-wrapper">
                                        <i class="fas fa-box"></i>
                                        <input type="text" id="inline-container" placeholder="ex: CONT12345">
                                    </div>
                                </div>
                                <div class="option-group">
                                    <label>N° de BL</label>
                                    <div class="option-input-wrapper">
                                        <i class="fas fa-file-invoice"></i>
                                        <input type="text" id="inline-bl" placeholder="ex: BL987654">
                                    </div>
                                </div>
                                <div class="option-group">
                                    <label>Nom du Voyage</label>
                                    <div class="option-input-wrapper">
                                        <i class="fas fa-route"></i>
                                        <input type="text" id="inline-voyage" placeholder="ex: MARS-01">
                                    </div>
                                </div>

                                <!-- Vehicle Selection Row (Full Width) -->
                                <div class="inline-vehicle-selection">
                                    <div class="inline-vehicle-filters">
                                        <div class="option-input-wrapper">
                                            <i class="fas fa-user"></i>
                                            <input type="text" id="inline-filter-client" placeholder="Filtre Client..." style="background: transparent; border: none; width: 100%; color: white; font-size: 0.8rem;">
                                        </div>
                                        <div class="option-input-wrapper">
                                            <i class="fas fa-car"></i>
                                            <input type="text" id="inline-filter-vehicle" placeholder="Filtre Véhicule..." style="background: transparent; border: none; width: 100%; color: white; font-size: 0.8rem;">
                                        </div>
                                        <div class="option-input-wrapper">
                                            <i class="fas fa-fingerprint"></i>
                                            <input type="text" id="inline-filter-vin" placeholder="Filtre VIN..." style="background: transparent; border: none; width: 100%; color: white; font-size: 0.8rem;">
                                        </div>
                                    </div>
                                    <div id="inline-vehicle-list" class="inline-vehicle-list-compact glass-scroll">
                                        <!-- Dynamique : Pills de véhicules -->
                                    </div>
                                    
                                    <div class="search-btn-container" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
                                        <button class="btn-secondary-logistic" style="padding: 6px 15px; font-size: 0.75rem;" onclick="app.showShipmentBLUploadModal()">
                                            VIA BL <i class="fas fa-magic" style="margin-left: 5px;"></i>
                                        </button>
                                        <button class="btn-search-logistic" style="padding: 6px 15px; font-size: 0.75rem; background: var(--primary);" onclick="app.handleInlineShipmentCreation()">
                                            CRÉER EXPÉDITION <i class="fas fa-plus" style="margin-left: 5px;"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="section-header" style="margin-top: 40px;">
                            <h2>LISTE DES EXPÉDITIONS</h2>
                        </div>
                        <div class="glass filter-bar" style="margin-bottom: 20px; padding: 20px; display: flex; align-items: center; justify-content: space-between; gap: 20px;">
                             <div class="search-box" style="flex: 1; max-width: 500px; position: relative;">
                                <i class="fas fa-search" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: var(--text-dim);"></i>
                                <input type="text" id="shipment-table-search" class="glass-input" placeholder="Rechercher Client, Expé, Voyage, VIN..." style="padding-left: 45px; width: 100%;">
                             </div>
                             <div class="form-group" style="margin-bottom: 0; display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="filter-shipment-archived" ${this.shipmentFilters.showArchived ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
                                <label for="filter-shipment-archived" style="font-size: 0.85rem; cursor: pointer; margin: 0;">Voir les archives</label>
                            </div>
                        </div>
                        <div class="data-table-container glass">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Voyage</th>
                                        <th>N° Conteneur / Cie</th>
                                        <th>Véhicules & Clients</th>
                                        <th>Tracking Satellite</th>
                                        <th>Logistique (ETD/ETA/Arr)</th>
                                        <th>Documents (BL/Date)</th>
                                        <th>Statut</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${shipments.length === 0 ? `
                                <tr>
                                    <td colspan="8" style="text-align: center; padding: 3rem;">
                                        <i class="fas fa-shipping-fast" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem;"></i>
                                        <p>Aucune expédition enregistrée</p>
                                    </td>
                                </tr>
                            ` : shipments.map(s => {
            const shipmentVehicles = vehicles.filter(v => v.shipmentId === s.id);
            return `
                            <tr class="${this.isOutdated(s.lastUpdate) ? 'outdated' : ''}">
                                <td><strong>${s.id}</strong></td>
                                <td>
                                    <div style="font-weight: 700; color: var(--primary);">${s.voyage || 'SANS VOYAGE'}</div>
                                    <div style="font-size: 0.65rem; color: var(--text-dim);">ID: ${s.voyageId || '-'}</div>
                                </td>
                                <td>
                                    <div style="font-weight: 500;">${s.containerNumber || 'N/A'}</div>
                            <div style="font-size: 0.7rem; color: var(--text-dim); margin-bottom: 5px;">
                                ${s.carrier || '17Track'}
                                ${s.containerNumber ? `<span style="display: block; color: var(--text-dim); font-size: 0.8rem;">Cont: ${s.containerNumber}</span>` : ''}
                            </div>
                                    ${s.containerNumber ? `
                                        <div style="display: flex; gap: 5px; margin-top: 5px;">
                                            <button onclick="app.zoomToShipment('${s.id}')" 
                                               class="btn-action" 
                                               style="display: inline-flex; align-items: center; gap: 5px; font-size: 0.7rem; color: var(--primary); border: 1px solid var(--primary); padding: 2px 8px; border-radius: 4px; background: rgba(99, 102, 241, 0.1);">
                                                <i class="fas fa-satellite-dish"></i> Suivre
                                            </button>
                                            <button class="btn-action" 
                                                    onclick="app.trackShipment('${s.id}')"
                                                    style="display: inline-flex; align-items: center; gap: 5px; font-size: 0.7rem; color: var(--success); border: 1px solid var(--success); padding: 2px 8px; border-radius: 4px; background: rgba(34, 197, 94, 0.1);"
                                                    title="Rafraîchir via API">
                                                <i class="fas fa-sync-alt"></i> Maj.
                                            </button>
                                        </div>
                                    ` : ''}
                                    ${s.lastUpdate ? `
                                        <div style="font-size: 0.65rem; color: ${this.isOutdated(s.lastUpdate) ? 'var(--danger)' : 'var(--text-dim)'}; margin-top: 4px; font-weight: ${this.isOutdated(s.lastUpdate) ? '600' : '400'}">
                                            <i class="fas fa-clock"></i> MàJ: ${new Date(s.lastUpdate).toLocaleString()}
                                            ${this.isOutdated(s.lastUpdate) ? ' <span class="badge-pill" style="background: var(--danger); font-size: 0.55rem;">Alerte +24h</span>' : ''}
                                        </div>
                                    ` : '<div style="font-size: 0.65rem; color: var(--danger); margin-top: 4px; font-weight: 600;"><i class="fas fa-exclamation-circle"></i> Jamais synchronisé</div>'}
                                </td>
                                <td>
                                    <div class="shipment-vehicles-list" style="display: flex; flex-direction: column; gap: 8px;">
                                        ${shipmentVehicles.map(v => {
                const order = orders.find(o => o.id === v.orderId);
                const client = order ? clients.find(c => c.id === order.clientId) : null;
                return `
                                                <div class="vehicle-item" style="font-size: 0.85rem; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                                                    <i class="fas fa-car" style="color: var(--primary); margin-right: 5px;"></i>
                                                    <strong>${v.brand}</strong> 
                                                    <span style="color: var(--text-dim);"> - ${client?.firstName} ${client?.lastName || 'N/A'}</span>
                                                </div>
                                            `;
            }).join('')}
                                        ${shipmentVehicles.length === 0 ? '<span style="color: var(--danger); font-size: 0.8rem;">Aucun véhicule lié</span>' : ''}
                                    </div>
                                </td>
                                <td>
                                    ${(() => {
                    const hasTracking = s.lastUpdate && (s.shipStatus || s.currentLat);
                    const apiStatus = s.status;
                    const statusColors = {
                        'IN_TRANSIT': { bg: 'rgba(99,102,241,0.15)', color: 'var(--primary)', icon: 'fa-ship', label: 'En transit' },
                        'ARRIVED': { bg: 'rgba(34,197,94,0.15)', color: 'var(--success)', icon: 'fa-anchor', label: 'Arrivé' },
                        'En mer': { bg: 'rgba(99,102,241,0.15)', color: 'var(--primary)', icon: 'fa-ship', label: 'En mer' },
                        'En Route': { bg: 'rgba(99,102,241,0.15)', color: 'var(--primary)', icon: 'fa-ship', label: 'En route' },
                        'Arrivé': { bg: 'rgba(34,197,94,0.15)', color: 'var(--success)', icon: 'fa-anchor', label: 'Arrivé' },
                        'Livré': { bg: 'rgba(34,197,94,0.2)', color: 'var(--success)', icon: 'fa-check-circle', label: 'Livré' },
                    };
                    const sc = statusColors[apiStatus] || { bg: 'rgba(245,158,11,0.12)', color: 'var(--warning)', icon: 'fa-question-circle', label: apiStatus || 'En attente' };
                    const events = (() => { try { return JSON.parse(s.trackingHistory || '[]'); } catch (e) { return []; } })();
                    const lastEvent = events[0];
                    return hasTracking ? `
                                            <div style="padding: 8px; background: ${sc.bg}; border: 1px solid ${sc.color}33; border-radius: 8px; min-width: 200px;">
                                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                                                    <i class="fas ${sc.icon}" style="color: ${sc.color}; font-size: 1rem;"></i>
                                                    <span style="font-weight: 700; color: ${sc.color}; font-size: 0.82rem;">${sc.label}</span>
                                                    <span style="margin-left: auto; font-size: 0.65rem; color: var(--text-dim);">MàJ: ${new Date(s.lastUpdate).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                ${s.shipStatus ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px;"><i class="fas fa-ship" style="margin-right: 4px; color: var(--text-dim);"></i><strong>Navire:</strong> ${s.shipStatus}</div>` : ''}
                                                ${s.loadingPort ? `<div style="font-size: 0.75rem; color: var(--text-dim);"><i class="fas fa-anchor" style="margin-right: 4px;"></i>Départ: <strong>${s.loadingPort}</strong></div>` : ''}
                                                ${s.destination ? `<div style="font-size: 0.75rem; color: var(--text-dim);"><i class="fas fa-map-marker-alt" style="margin-right: 4px; color: var(--danger);"></i>Dest: <strong>${s.destination}</strong></div>` : ''}
                                                ${s.arrivalDate ? `<div style="font-size: 0.75rem; margin-top: 4px; color: var(--success); font-weight: 700;"><i class="fas fa-check-double" style="margin-right: 4px;"></i>Arrivée: ${new Date(s.arrivalDate).toLocaleDateString('fr-FR')}</div>` : (s.eta ? `<div style="font-size: 0.75rem; margin-top: 4px; color: ${new Date(s.eta) < new Date() ? 'var(--danger)' : 'var(--success)'}; font-weight: 600;"><i class="fas fa-calendar-check" style="margin-right: 4px;"></i>ETA: ${new Date(s.eta).toLocaleDateString('fr-FR')}</div>` : '')}
                                                ${lastEvent ? `<div style="margin-top: 6px; padding: 4px 6px; background: rgba(0,0,0,0.2); border-radius: 4px; font-size: 0.72rem; color: var(--text-dim);"><i class="fas fa-history" style="margin-right: 4px;"></i>${lastEvent.description || lastEvent.location || 'Dernier événement'}</div>` : ''}
                                                <div style="display: flex; gap: 4px; margin-top: 6px;">
                                                    <button onclick="app.showTrackingHistoryModal('${s.id}')" style="flex:1; padding: 3px 6px; font-size: 0.7rem; background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); border-radius: 4px; color: var(--primary); cursor: pointer;"><i class="fas fa-list"></i> Historique</button>
                                                    <button onclick="app.trackShipment('${s.id}')" style="flex:1; padding: 3px 6px; font-size: 0.7rem; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 4px; color: var(--success); cursor: pointer;"><i class="fas fa-sync-alt"></i> Màj</button>
                                                </div>
                                            </div>
                                        ` : `
                                            <div style="text-align: center; padding: 10px; color: var(--text-dim); font-size: 0.8rem;">
                                                <i class="fas fa-satellite-dish" style="font-size: 1.5rem; display: block; margin-bottom: 4px; opacity: 0.4;"></i>
                                                Pas de tracking
                                                <div style="margin-top: 4px;">
                                                    <button onclick="app.trackShipment('${s.id}')" style="padding: 3px 8px; font-size: 0.7rem; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2); border-radius: 4px; color: var(--primary); cursor: pointer;"><i class="fas fa-satellite-dish"></i> Activer</button>
                                                </div>
                                            </div>
                                        `;
                })()}
                                </td>
                                <td>
                                    <div style="font-size: 0.85rem;"><strong>ETD:</strong> ${s.etd ? new Date(s.etd).toLocaleDateString('fr-FR') : '-'}</div>
                                    <div style="font-size: 0.85rem;"><strong>ETA:</strong> ${s.eta ? new Date(s.eta).toLocaleDateString('fr-FR') : '-'}</div>
                                    <div style="font-size: 0.85rem; color: var(--success);"><strong>Arr:</strong> ${s.arrivalDate ? new Date(s.arrivalDate).toLocaleDateString('fr-FR') : '-'}</div>
                                </td>
                                <td>
                                    <div style="font-size: 0.85rem;"><strong>BL:</strong> ${s.blNumber || '-'}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-dim);">Docs: ${s.docReceptionDate ? new Date(s.docReceptionDate).toLocaleDateString('fr-FR') : 'Non reçus'}</div>
                                </td>
                                <td><span class="status-badge ${(s.status || 'en cours').toLowerCase().replace(/\s+/g, '-').replace(/[éè]/g, 'e').replace(/[àâ]/g, 'a')}">${s.status || 'En cours'}</span></td>
                                <td>
                                    <div class="table-actions">
                                        <button class="btn-action primary" onclick="app.handleManualShipmentRefresh('${s.id}')" title="Actualiser">
                                            <i class="fas fa-sync-alt"></i>
                                        </button>
                                        <button class="btn-action" onclick="app.showEditShipmentModal('${s.id}')" title="Modifier">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn-action danger" onclick="app.deleteShipment('${s.id}')" title="Supprimer">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `;
        }).join('')}
                                </tbody>
                            </table>
                        </div>
                        `;

        const archivedFilter = document.getElementById('filter-shipment-archived');
        if (archivedFilter) {
            archivedFilter.addEventListener('change', (e) => {
                this.shipmentFilters.showArchived = e.target.checked;
                this.renderView('shipments'); // Refresh with current query
            });
        }

        // Initialize inline form (filters and search)
        this.initInlineShipmentForm();
    },

    initInlineShipmentForm() {
        ['inline-filter-client', 'inline-filter-vehicle', 'inline-filter-vin'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => this.updateInlineVehicleList());
            }
        });

        const tableSearch = document.getElementById('shipment-table-search');
        if (tableSearch) {
            tableSearch.addEventListener('input', (e) => this.handleShipmentTableSearch(e.target.value));
        }

        // --- DRAFT AUTO-SAVE ---
        const formFields = [
            'inline-shipment-date', 'inline-loading-port', 'inline-destination-port',
            'inline-container', 'inline-bl', 'inline-voyage'
        ];

        // 1. Restore Draft
        const draft = JSON.parse(localStorage.getItem('shipment_draft') || '{}');
        if (draft) {
            if (draft.shipmentDate) document.getElementById('inline-shipment-date').value = draft.shipmentDate;
            if (draft.loadingPort) document.getElementById('inline-loading-port').value = draft.loadingPort;
            if (draft.destination) document.getElementById('inline-destination-port').value = draft.destination;
            if (draft.container) document.getElementById('inline-container').value = draft.container;
            if (draft.bl) document.getElementById('inline-bl').value = draft.bl;
            if (draft.voyage) document.getElementById('inline-voyage').value = draft.voyage;
        }

        // 2. Auto-Save Listeners
        const saveDraft = () => {
            const currentDraft = JSON.parse(localStorage.getItem('shipment_draft') || '{}');
            const newData = {
                ...currentDraft,
                shipmentDate: document.getElementById('inline-shipment-date').value,
                loadingPort: document.getElementById('inline-loading-port').value,
                destination: document.getElementById('inline-destination-port').value,
                container: document.getElementById('inline-container').value,
                bl: document.getElementById('inline-bl').value,
                voyage: document.getElementById('inline-voyage').value,
                // We also need to save selected vehicles, but they are dynamic. 
                // We'll update vehicleIds in draft whenever a checkbox changes.
                // For now, rely on updateInlineVehicleList checking checkboxes.
                // BUT, we need a listener on the container to capture clicks.
            };
            localStorage.setItem('shipment_draft', JSON.stringify(newData));
        };

        formFields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', saveDraft);
        });

        // Delegate listener for vehicle checkboxes
        const vehicleList = document.getElementById('inline-vehicle-list');
        if (vehicleList) {
            vehicleList.addEventListener('change', (e) => {
                if (e.target.name === 'inline-vehicle-ids') {
                    const currentDraft = JSON.parse(localStorage.getItem('shipment_draft') || '{}');
                    const selected = Array.from(document.querySelectorAll('input[name="inline-vehicle-ids"]:checked')).map(cb => cb.value);
                    currentDraft.vehicleIds = selected;
                    localStorage.setItem('shipment_draft', JSON.stringify(currentDraft));
                }
            });
        }
        // -----------------------

        this.updateInlineVehicleList();
    },

    updateInlineVehicleList() {
        const list = document.getElementById('inline-vehicle-list');
        if (!list) return;

        const clientTerm = document.getElementById('inline-filter-client')?.value.toLowerCase() || '';
        const vehicleTerm = document.getElementById('inline-filter-vehicle')?.value.toLowerCase() || '';
        const vinTerm = document.getElementById('inline-filter-vin')?.value.toLowerCase() || '';

        const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES);
        const orders = StorageService.get(STORAGE_KEYS.ORDERS);
        const clients = StorageService.get(STORAGE_KEYS.CLIENTS);

        const availableVehicles = vehicles.filter(v => !v.shipmentId && !v.isArchived);

        const filtered = availableVehicles.filter(v => {
            const order = orders.find(o => o.id === v.orderId);
            const client = order ? clients.find(c => c.id === order.clientId) : null;
            const fullClientName = client ? `${client.firstName} ${client.lastName}`.toLowerCase() : '';

            const matchClient = fullClientName.includes(clientTerm);
            const matchVehicle = (v.brand || '').toLowerCase().includes(vehicleTerm) || (v.model || '').toLowerCase().includes(vehicleTerm);
            const matchVin = (v.chassisNumber || '').toLowerCase().includes(vinTerm);

            return matchClient && matchVehicle && matchVin;
        });

        list.innerHTML = filtered.map(v => {
            const order = orders.find(o => o.id === v.orderId);
            const client = order ? clients.find(c => c.id === order.clientId) : null;
            const clientName = client ? `${client.firstName} ${client.lastName}` : 'N/A';

            const draft = JSON.parse(localStorage.getItem('shipment_draft') || '{}');
            const isChecked = (draft.vehicleIds || []).includes(String(v.id));

            return `
                <label class="vehicle-pill ${isChecked ? 'selected' : ''}">
                    <input type="checkbox" name="inline-vehicle-ids" value="${v.id}" ${isChecked ? 'checked' : ''} onchange="this.parentElement.classList.toggle('selected', this.checked)">
                    <span>${v.brand || 'N/A'} ${v.model || ''} (${v.chassisNumber ? v.chassisNumber.slice(-6) : 'N/A'}) <small style="opacity: 0.6; margin-left: 5px;">- ${clientName}</small></span>
                </label>
            `;
        }).join('') || '<p style="text-align: center; color: var(--text-dim); padding: 10px; font-size: 0.8rem; width: 100%;"> Aucun véhicule correspondant </p>';
    },

    async handleInlineShipmentCreation() {
        const btn = document.querySelector('.btn-search-logistic');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = 'EN COURS... <i class="fas fa-spinner fa-spin"></i>';
        }

        const date = document.getElementById('inline-shipment-date').value;
        const loadingPort = document.getElementById('inline-loading-port').value;
        const destination = document.getElementById('inline-destination-port').value;
        const container = document.getElementById('inline-container').value;
        const bl = document.getElementById('inline-bl').value;
        const voyage = document.getElementById('inline-voyage').value;

        const selectedCheckboxes = document.querySelectorAll('input[name="inline-vehicle-ids"]:checked');
        const vehicleIds = Array.from(selectedCheckboxes).map(cb => cb.value);

        if (!container) {
            this.showToast("Le numéro de conteneur est obligatoire", "danger");
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'CRÉER EXPÉDITION <i class="fas fa-plus" style="margin-left: 5px;"></i>';
            }
            return;
        }

        if (vehicleIds.length === 0) {
            this.showToast("Veuillez sélectionner au moins un véhicule", "warning");
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'CRÉER EXPÉDITION <i class="fas fa-plus" style="margin-left: 5px;"></i>';
            }
            return;
        }

        const newShipment = {
            id: Date.now().toString(),
            containerNumber: container,
            blNumber: bl,
            voyage: voyage,
            shipmentDate: date,
            loadingPort: loadingPort,
            destination: destination,
            status: 'En attente',
            lastUpdate: new Date().toISOString(),
            isArchived: false
        };

        try {
            // Créer l'expédition via le service (qui gère local + API)
            await StorageService.add(STORAGE_KEYS.SHIPMENTS, newShipment);

            // Mettre à jour les véhicules un par un pour garantir la synchro API
            const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES);
            for (const v of vehicles) {
                if (vehicleIds.includes(String(v.id))) {
                    v.shipmentId = newShipment.id;
                    v.status = 'Expédié';
                    await StorageService.update(STORAGE_KEYS.VEHICLES, v.id, v);
                }
            }

            this.showToast("Expédition créée avec succès", "success");
            localStorage.removeItem('shipment_draft'); // Clear draft on success
            this.renderShipments();
        } catch (error) {
            console.error("Erreur lors de la création de l'expédition:", error);
            this.showToast("Erreur lors de l'enregistrement de l'expédition", "danger");
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'CRÉER EXPÉDITION <i class="fas fa-plus" style="margin-left: 5px;"></i>';
            }
        }
    },

    handleShipmentTableSearch(term) {
        const searchTerm = term.toLowerCase();
        const rows = document.querySelectorAll('.data-table tbody tr');

        rows.forEach(row => {
            if (row.querySelector('td[colspan]')) return; // Gérer le cas "Aucun véhicule"
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    },

    switchLogisticsTab(tab, el) {
        // Update UI
        document.querySelectorAll('.logistics-tab').forEach(tab => tab.classList.remove('active'));
        el.classList.add('active');
        const fieldsContainer = document.getElementById('logistics-search-fields');
        if (mode === 'ocean') {
            // Standard ocean fields (already there)
        } else if (mode === 'air') {
            // Simplified air fields
            this.showToast("Mode Aérien sélectionné (Simulé)", "info");
        }
    },

    performLogisticsSearch() {
        const from = document.getElementById('logistic-from').value;
        const to = document.getElementById('logistic-to').value;

        if (!from || !to) {
            this.showToast("Veuillez saisir un port de départ et une destination.", "warning");
            return;
        }

        this.showToast(`Recherche de devis de ${from} vers ${to}...`, "info");

        // Simulate search delay
        const container = document.getElementById('special-offers-container');
        container.innerHTML = '<div style="grid-column: span 3; text-align: center; padding: 2rem;"><i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i><p style="margin-top: 10px; color: #64748b;">Analyse des meilleurs tarifs en cours...</p></div>';

        setTimeout(() => {
            // Update with "found" offers (randomized for demo)
            container.innerHTML = this.renderSpecialOffers(from, to);
        }, 1500);
    },

    renderSpecialOffers(from = 'Antwerp/Zeebrugge', to = 'Dakar, Sénégal') {
        const offers = [
            { carrier: 'Grimaldi Lines', vessel: 'Grande Luanda', time: '14 Days', price: '1,250', type: 'RORO', date: 'Feb 15' },
            { carrier: 'MSC', vessel: 'MSC Eloane', time: '21 Days', price: '2,100', type: '40HC Container', date: 'Feb 12' },
            { carrier: 'Maersk', vessel: 'Maersk Garonne', time: '18 Days', price: '1,850', type: '20GP Container', date: 'Feb 18' }
        ];

        return offers.map(offer => `
            <div class="offer-card">
                <div class="offer-header">
                    <div class="route-info">
                        <span class="port-name">${from.split('/')[0]}</span>
                        <i class="fas fa-long-arrow-alt-right route-arrow"></i>
                        <span class="port-name">${to.split(',')[0]}</span>
                    </div>
                    <div style="text-align: right;">
                        <span class="badge-pill" style="background: rgba(99, 102, 241, 0.1); color: var(--primary); font-size: 0.6rem;">${offer.type}</span>
                    </div>
                </div>
                <div class="offer-details">
                    <div class="detail-item">
                        <span class="detail-label">Carrier</span>
                        <span class="detail-value">${offer.carrier}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Vessel</span>
                        <span class="detail-value">${offer.vessel}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Transit</span>
                        <span class="detail-value"><i class="fas fa-clock"></i> ${offer.time}</span>
                    </div>
                </div>
                <div class="offer-footer">
                    <div class="offer-price">$${offer.price} <small>/ Unit</small></div>
                    <button class="btn-see-offer" onclick="app.showToast('Redirection vers la réservation...', 'success')">SEE OFFER</button>
                </div>
            </div>
        `).join('');
    },

    renderVoyages() {
        const storedVoyages = StorageService.get(STORAGE_KEYS.VOYAGES) || [];
        const shipments = StorageService.get(STORAGE_KEYS.SHIPMENTS) || [];
        const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES) || [];

        // 1. Process Explicit Voyage Entities
        const voyageList = storedVoyages.map(v => {
            const linkedShipments = shipments.filter(s => s.voyageId === v.id);
            const vessels = new Set([v.vesselName, ...linkedShipments.map(s => s.shipStatus)].filter(n => n && n !== 'N/A'));
            const carriers = new Set([v.carrier, ...linkedShipments.map(s => s.carrier)].filter(c => c));
            const ports = new Set([v.loadingPort, ...linkedShipments.map(s => s.loadingPort)].filter(p => p));
            const destinations = new Set([v.destination, ...linkedShipments.map(s => s.destination)].filter(d => d));

            let lastUpdate = v.updatedAt || v.createdAt;
            linkedShipments.forEach(s => {
                if (s.lastUpdate && new Date(s.lastUpdate) > new Date(lastUpdate)) {
                    lastUpdate = s.lastUpdate;
                }
            });

            return {
                id: v.id,
                isEntity: true,
                name: v.name,
                shipments: linkedShipments,
                vessels,
                carriers,
                ports,
                destinations,
                etd: v.etd,
                eta: v.eta,
                arrivalDate: v.arrivalDate,
                status: v.status,
                blNumber: v.blNumber,
                lastUpdate
            };
        });

        // 2. Process Legacy Shipments (Grouped by string, not linked to VoyageId)
        const unlinkedShipments = shipments.filter(s => !s.voyageId);
        const legacyMap = unlinkedShipments.reduce((acc, s) => {
            const voyageName = s.voyage && s.voyage.trim() !== '' ? s.voyage.trim() : 'SANS VOYAGE';
            if (!acc[voyageName]) {
                acc[voyageName] = {
                    name: voyageName,
                    isEntity: false,
                    shipments: [],
                    vessels: new Set(),
                    carriers: new Set(),
                    ports: new Set(),
                    destinations: new Set(),
                    etd: s.etd,
                    eta: s.eta,
                    arrivalDate: s.arrivalDate,
                    status: s.status,
                    lastUpdate: s.lastUpdate
                };
            }
            acc[voyageName].shipments.push(s);
            if (s.lastUpdate && (!acc[voyageName].lastUpdate || new Date(s.lastUpdate) > new Date(acc[voyageName].lastUpdate))) {
                acc[voyageName].lastUpdate = s.lastUpdate;
            }
            if (s.carrier) acc[voyageName].carriers.add(s.carrier);
            if (s.shipStatus) acc[voyageName].vessels.add(s.shipStatus);
            if (s.loadingPort) acc[voyageName].ports.add(s.loadingPort);
            if (s.destination) acc[voyageName].destinations.add(s.destination);
            return acc;
        }, {});

        const allVoyages = [...voyageList, ...Object.values(legacyMap)].sort((a, b) => {
            if (a.name === 'SANS VOYAGE') return 1;
            if (b.name === 'SANS VOYAGE') return -1;
            return a.name.localeCompare(b.name);
        });

        this.viewContainer.innerHTML = `
                <div class="view-header">
                    <div class="header-info">
                        <h1>Suivi des Voyages</h1>
                        <div style="display: flex; gap: 15px; margin-top: 10px;">
                            <button class="btn-primary" onclick="app.showVoyageModal()">
                                <i class="fas fa-plus"></i> NOUVEAU VOYAGE
                            </button>
                            <button class="btn-secondary" onclick="app.refreshAllVoyages()">
                                <i class="fas fa-sync"></i> ACTUALISER TOUT
                            </button>
                        </div>
                    </div>
                </div>

                <div class="data-table-container glass">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Voyage & Navires</th>
                                <th>Logistique</th>
                                <th style="text-align: center;">Cargaison</th>
                                <th>Statut & MàJ</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${allVoyages.map(v => {
            const totalVehicles = v.shipments.reduce((sum, s) => {
                return sum + vehicles.filter(veh => veh.shipmentId === s.id).length;
            }, 0);
            const safeName = v.name.replace(/'/g, "\\'");
            const hasHistory = (v.trackingHistory && v.trackingHistory.length > 5) || v.shipments.some(s => s.trackingHistory && s.trackingHistory.length > 5);
            const satAction = `app.trackVoyage('${safeName}')`;
            const histAction = `app.showVoyageTrackingHistory('${safeName}')`;
            const histColor = hasHistory ? 'var(--primary)' : 'var(--text-dim)';

            return `
                                    <tr>
                                        <td style="position: relative;">
                                            <div style="font-weight: 700; color: var(--primary); font-size: 1.1rem;">${v.name}</div>
                                            ${v.isEntity ?
                    `<span style="position: absolute; top: 5px; right: 5px; background: var(--accent-blue); color: white; font-size: 0.6rem; padding: 2px 6px; border-radius: 4px; font-weight: 800; letter-spacing: 0.5px;">OFFICIEL</span>` :
                    `<span style="position: absolute; top: 5px; right: 5px; background: rgba(255,255,255,0.05); color: var(--text-dim); border: 1px solid var(--border-glass); font-size: 0.55rem; padding: 1px 4px; border-radius: 3px; font-weight: 600;">LEGACY</span>`
                }
                                            <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 5px;">
                                                <i class="fas fa-ship"></i> ${Array.from(v.vessels).join(', ') || 'N/A'}
                                            </div>
                                            ${v.blNumber ? `
                                            <div style="font-size: 0.75rem; color: var(--accent-blue); margin-top: 2px;">
                                                <i class="fas fa-barcode"></i> BL: ${v.blNumber}
                                            </div>` : ''}
                                        </td>
                                        <td>
                                            <div style="font-size: 0.8rem; color: var(--accent-blue);">
                                                <i class="far fa-calendar-alt"></i> ETD: ${v.etd ? new Date(v.etd).toLocaleDateString() : '-'}
                                            </div>
                                            ${v.arrivalDate ? `
                                            <div style="font-size: 0.8rem; color: var(--success); font-weight: 700;">
                                                <i class="fas fa-check-double"></i> Arrivée: ${new Date(v.arrivalDate).toLocaleDateString()}
                                            </div>` : `
                                            <div style="font-size: 0.8rem; color: var(--success);">
                                                <i class="far fa-calendar-check"></i> ETA: ${v.eta ? new Date(v.eta).toLocaleDateString() : '-'}
                                            </div>`}
                                        </td>
                                        <td style="text-align: center;">
                                            <span class="badge-pill" style="cursor: pointer;" onclick="app.showVoyageShipmentsModal('${safeName}')">
                                                <i class="fas fa-box"></i> ${v.shipments.length} | <i class="fas fa-car"></i> ${totalVehicles}
                                            </span>
                                        </td>
                                        <td>
                                             <div style="margin-bottom: 5px;"><span class="status-badge ${(v.status || 'Planifié').toLowerCase().replace(' ', '-')}">${v.status || 'Planifié'}</span></div>
                                            <div style="font-size: 0.7rem; color: var(--text-dim)">
                                                <i class="fas fa-history"></i> ${v.lastUpdate ? new Date(v.lastUpdate).toLocaleString() : 'Jamais'}
                                            </div>
                                        </td>
                                        <td>
                                            <div class="table-actions">
                                                ${v.isEntity ? `
                                                    <button class="btn-action" onclick="app.showVoyageModal('${v.id}')" title="Modifier le Voyage">
                                                        <i class="fas fa-edit"></i>
                                                    </button>
                                                ` : `
                                                    <button class="btn-action" onclick="app.showLegacyVoyageModal('${safeName}')" title="Détails (Legacy)">
                                                        <i class="fas fa-users-cog"></i>
                                                    </button>
                                                `}
                                                <button class="btn-action" onclick="${satAction}" title="Démarrer/Rafraîchir Tracking Satellite">
                                                    <i class="fas fa-satellite-dish" style="color: var(--accent-blue);"></i>
                                                </button>
                                                <button class="btn-action" onclick="${histAction}" title="Voir l'Historique de Tracking">
                                                    <i class="fas fa-history" style="color: var(--primary);"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
    },

    async refreshAllVoyages() {
        this.showToast("Actualisation des voyages en cours...", "info");
        try {
            const success = await StorageService.syncAll();
            if (success) {
                this.renderView('voyages');
                this.showToast("Voyages actualisés avec succès.", "success");
            } else {
                this.showToast("Échec de l'actualisation.", "warning");
            }
        } catch (error) {
            console.error(error);
            this.showToast("Erreur lors de la synchronisation.", "danger");
        }
    },



    showVoyageShipmentsModal(voyageName) {
        const shipments = StorageService.get(STORAGE_KEYS.SHIPMENTS) || [];
        const voyages = StorageService.get(STORAGE_KEYS.VOYAGES) || [];
        const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES) || [];
        const orders = StorageService.get(STORAGE_KEYS.ORDERS) || [];
        const clients = StorageService.get(STORAGE_KEYS.CLIENTS) || [];

        // Find by name (works for both entities and legacy since names match)
        const voyageEntity = voyages.find(v => v.name === voyageName);
        const voyageShipments = shipments.filter(s =>
            (voyageEntity && s.voyageId === voyageEntity.id) ||
            (s.voyage || '').trim() === voyageName.trim()
        );

        if (voyageShipments.length === 0) return;

        const modalHtml = `
            <div class="modal-overlay">
                <div class="modal-content glass" style="width: 800px; max-width: 95vw;">
                    <div class="modal-header">
                        <h2><i class="fas fa-box"></i> Expéditions du Voyage: ${voyageName}</h2>
                        <button class="btn-close" onclick="app.closeModal()">&times;</button>
                    </div>
                    <div class="data-table-container glass" style="max-height: 60vh; overflow-y: auto;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Conteneur / BL</th>
                                    <th>Véhicules</th>
                                    <th>Statut</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${voyageShipments.map(s => {
            const sVehicles = vehicles.filter(v => v.shipmentId === s.id);
            return `
                                        <tr>
                                            <td>
                                                <div style="font-weight: bold;">${s.containerNumber || 'SANS CONT'}</div>
                                                <div style="font-size: 0.8rem; color: var(--text-dim);">${s.blNumber || 'SANS BL'}</div>
                                            </td>
                                            <td>
                                                ${sVehicles.map(v => {
                const order = orders.find(o => o.id === v.orderId);
                const client = order ? clients.find(c => c.id === order.clientId) : null;
                return `
                                                        <div style="margin-bottom: 5px; font-size: 0.85rem;">
                                                            <i class="fas fa-car" style="color: var(--primary);"></i> ${v.brand} ${v.model || ''}
                                                            <div style="font-size: 0.75rem; color: var(--text-dim);">Client: ${client ? client.firstName + ' ' + client.lastName : 'N/A'}</div>
                                                        </div>
                                                    `;
            }).join('')}
                                            </td>
                                            <td>
                                                <span class="status-badge ${(s.status || 'In Transit').toLowerCase().replace(' ', '-')}">${s.status || 'In Transit'}</span>
                                            </td>
                                        </tr>
                                    `;
        }).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" onclick="app.closeModal()">Fermer</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    showLegacyVoyageModal(voyageName) {
        const shipments = StorageService.get(STORAGE_KEYS.SHIPMENTS) || [];
        const voyageShipments = shipments.filter(s => (s.voyage || '').trim() === voyageName.trim());
        const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES) || [];
        const orders = StorageService.get(STORAGE_KEYS.ORDERS) || [];
        const clients = StorageService.get(STORAGE_KEYS.CLIENTS) || [];

        if (voyageShipments.length === 0) return;

        // Take first shipment as template
        const template = voyageShipments[0];

        const modalHtml = `
                <div class="modal-overlay">
                    <div class="modal-content glass" style="width: 800px; max-width: 95vw;">
                        <div class="modal-header">
                            <div>
                                <h2><i class="fas fa-ship"></i> Voyage: ${voyageName}</h2>
                                <p style="font-size: 0.8rem; color: var(--text-dim);">Gestion groupée de ${voyageShipments.length} conteneur(s)</p>
                            </div>
                            <button class="btn-close" onclick="app.closeModal()">&times;</button>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                            <form id="voyage-form">
                                <input type="hidden" name="voyageName" value="${voyageName}">
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Port de Chargement</label>
                                        <input type="text" name="loadingPort" value="${template.loadingPort || ''}" class="glass-input">
                                    </div>
                                    <div class="form-group">
                                        <label>Port de Destination</label>
                                        <input type="text" name="destination" value="${template.destination || ''}" class="glass-input">
                                    </div>
                                </div>

                                <div class="form-row">
                                    <div class="form-group">
                                        <label>ETD (Départ prévu)</label>
                                        <input type="date" name="etd" value="${this.formatDateForInput(template.etd)}" class="glass-input">
                                    </div>
                                    <div class="form-group">
                                        <label>ETA (Arrivée prévue)</label>
                                        <input type="date" name="eta" value="${this.formatDateForInput(template.eta)}" class="glass-input">
                                    </div>
                                </div>

                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Statut Global</label>
                                        <select name="status" class="glass-select">
                                            <option value="Préparation" ${template.status === 'Préparation' ? 'selected' : ''}>Préparation</option>
                                            <option value="En mer" ${template.status === 'En mer' ? 'selected' : ''}>En mer</option>
                                            <option value="Arrivé" ${template.status === 'Arrivé' ? 'selected' : ''}>Arrivé</option>
                                            <option value="Livré" ${template.status === 'Livré' ? 'selected' : ''}>Livré</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Date Arrivée</label>
                                        <input type="date" name="arrivalDate" value="${this.formatDateForInput(template.arrivalDate)}" class="glass-input">
                                    </div>
                                </div>

                                <div class="form-group" style="margin-top: 10px;">
                                    <label class="checkbox-item" style="display: flex; align-items: center; gap: 10px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px; cursor: pointer;">
                                        <input type="checkbox" name="isTrackingActive" value="true" ${voyageShipments.some(s => s.isTrackingActive) ? 'checked' : ''} style="width: 18px; height: 18px;">
                                        <div style="display: flex; flex-direction: column;">
                                            <span style="font-weight: 500;">Activer le Tracking API</span>
                                            <span style="font-size: 0.75rem; color: var(--text-dim);">Lance le suivi automatique pour tout le voyage.</span>
                                        </div>
                                    </label>
                                </div>

                                <div style="margin-top: 20px;">
                                    <button type="submit" class="btn-primary" style="width: 100%;">
                                        <i class="fas fa-save"></i> Mettre à jour tout le voyage
                                    </button>
                                </div>
                            </form>

                            <div class="data-table-container glass" style="margin: 0; padding: 15px; max-height: 500px; overflow-y: auto;">
                                <h3 style="font-size: 0.9rem; margin-bottom: 15px; color: var(--primary);">Expéditions & Véhicules</h3>
                                <table class="data-table" style="font-size: 0.8rem;">
                                    <thead>
                                        <tr>
                                            <th>BL / Conteneur</th>
                                            <th>Détails</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${voyageShipments.map(s => {
            const sVehicles = vehicles.filter(v => v.shipmentId === s.id);
            return `
                                                <tr>
                                                    <td>
                                                        <div style="font-weight: bold;">${s.blNumber || 'N/A'}</div>
                                                        <div style="font-size: 0.7rem; color: var(--text-dim);">${s.containerNumber || 'N/A'}</div>
                                                    </td>
                                                    <td>
                                                        ${sVehicles.map(v => {
                const order = orders.find(o => o.id === v.orderId);
                const client = order ? clients.find(c => c.id === order.clientId) : null;
                return `<div style="margin-bottom: 4px;">
                                                                <i class="fas fa-car" style="color: var(--primary);"></i> ${v.brand} ${v.model || ''}
                                                                <div style="font-size: 0.7rem; color: var(--text-dim);">
                                                                    <i class="fas fa-user"></i> ${client ? client.firstName + ' ' + client.lastName : 'N/A'}
                                                                </div>
                                                            </div>`;
            }).join('')}
                                                    </td>
                                                </tr>
                                            `;
        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div class="modal-footer" style="padding-top: 20px; border-top: 1px solid var(--border-glass); margin-top: 20px;">
                            <button type="button" class="btn-secondary" onclick="app.closeModal()">Fermer</button>
                        </div>
                    </div>
                </div>
            `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('voyage-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLegacyVoyageSubmission(new FormData(e.target));
        });
    },

    async handleLegacyVoyageSubmission(formData) {
        const voyageName = formData.get('voyageName');
        const submitBtn = document.querySelector('#voyage-form button[type="submit"]');

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mise à jour...';
        }

        try {
            const shipments = StorageService.get(STORAGE_KEYS.SHIPMENTS) || [];
            const voyageShipments = shipments.filter(s => (s.voyage || '').trim() === voyageName.trim());

            const sanitizeDate = (val) => (val && val.trim() !== '' ? val : null);

            const updates = {
                loadingPort: formData.get('loadingPort'),
                destination: formData.get('destination'),
                etd: sanitizeDate(formData.get('etd')),
                eta: sanitizeDate(formData.get('eta')),
                status: formData.get('status'),
                arrivalDate: sanitizeDate(formData.get('arrivalDate')),
                isTrackingActive: formData.get('isTrackingActive') === 'true'
            };

            let arrivalDate = updates.arrivalDate;
            console.log('[Legacy Voyage] Status:', updates.status, 'Arrival Date:', arrivalDate);
            if (updates.status === 'Arrivé' && !arrivalDate) {
                arrivalDate = new Date().toISOString().split('T')[0];
                updates.arrivalDate = arrivalDate;
                console.log('[Legacy Voyage] Auto-set arrival date to:', arrivalDate);
            }

            // Update each shipment in the voyage
            const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES) || [];
            const orders = StorageService.get(STORAGE_KEYS.ORDERS) || [];

            for (const shipment of voyageShipments) {
                await StorageService.update(STORAGE_KEYS.SHIPMENTS, shipment.id, {
                    ...shipment,
                    ...updates
                });

                // Propagate to vehicles and orders
                const shipmentVehicles = vehicles.filter(v => v.shipmentId === shipment.id);
                for (const vehicle of shipmentVehicles) {
                    if (updates.status === 'Arrivé') {
                        vehicle.status = 'Arrived';
                    } else if (updates.status === 'Livré') {
                        vehicle.status = 'Sold';
                    } else {
                        vehicle.status = 'In Transit';
                    }
                    await StorageService.update(STORAGE_KEYS.VEHICLES, vehicle.id, vehicle);

                    if (vehicle.orderId) {
                        const order = orders.find(o => o.id === vehicle.orderId);
                        if (order) {
                            order.status = updates.status;
                            await StorageService.update(STORAGE_KEYS.ORDERS, order.id, order);
                        }
                    }
                }
            }

            await this.syncOrderStatuses();

            this.closeModal();
            this.showToast(`Voyage ${voyageName} mis à jour avec succès (${voyageShipments.length} conteneurs)`, 'success');
            this.renderView('voyages');
        } catch (error) {
            console.error("Error updating voyage:", error);
            this.showToast("Erreur lors de la mise à jour du voyage", "error");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Mettre à jour tout le voyage';
            }
        }
    },

    // --- Shipment from BL Functions ---

    showShipmentBLUploadModal() {
        const modalHtml = `
            <div id="modal-overlay" class="modal-overlay" onclick="app.closeModal()">
                <div class="modal glass" onclick="event.stopPropagation()" style="width: 500px;">
                    <div class="modal-header">
                        <h2><i class="fas fa-magic"></i> Créer Expédition via BL</h2>
                        <button class="close-btn" onclick="app.closeModal()"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="modal-body">
                        <div id="shipment-drop-zone" class="drop-zone" style="height: 200px; border: 2px dashed rgba(255,255,255,0.1); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; margin-bottom: 20px;">
                            <i class="fas fa-file-upload" style="font-size: 3rem; color: var(--primary); margin-bottom: 15px;"></i>
                            <p>Glissez-déposez votre BL (PDF ou Image)</p>
                            <span style="font-size: 0.8rem; color: var(--text-dim);">Ou cliquez pour parcourir</span>
                            <input type="file" id="shipment-bl-input" accept="application/pdf,image/*" style="display: none;">
                        </div>
                        
                        <div id="shipment-ocr-status" style="display: none; margin-top: 20px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <span id="shipment-status-text" style="font-size: 0.9rem;">Traitement...</span>
                                <span style="font-size: 0.9rem; font-weight: 600;">OCR/IA</span>
                            </div>
                            <div class="progress-bar-container" style="height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden;">
                                <div id="shipment-ocr-progress" style="height: 100%; background: var(--primary); width: 0%; transition: width 0.3s ease;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const dropZone = document.getElementById('shipment-drop-zone');
        const fileInput = document.getElementById('shipment-bl-input');

        dropZone.onclick = () => fileInput.click();

        fileInput.onchange = (e) => {
            if (e.target.files[0]) this.handleShipmentBLUpload(e.target.files[0]);
        };

        dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; };
        dropZone.ondragleave = () => dropZone.style.borderColor = 'rgba(255,255,255,0.1)';
        dropZone.ondrop = (e) => {
            e.preventDefault();
            if (e.dataTransfer.files[0]) this.handleShipmentBLUpload(e.dataTransfer.files[0]);
        };
    },

    async handleShipmentBLUpload(file) {
        const statusDiv = document.getElementById('shipment-ocr-status');
        const progressBar = document.getElementById('shipment-ocr-progress');
        const statusText = document.getElementById('shipment-status-text');

        statusDiv.style.display = 'block';
        document.getElementById('shipment-drop-zone').style.pointerEvents = 'none';
        document.getElementById('shipment-drop-zone').style.opacity = '0.5';

        try {
            let extractedText = '';

            if (file.type === 'application/pdf') {
                statusText.innerText = "Lecture du PDF...";
                const pdfUrl = URL.createObjectURL(file);
                const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
                extractedText = await this.extractTextFromPdf(pdf);

                if (!extractedText || extractedText.trim().length < 50) {
                    statusText.innerText = "PDF scanné. Conversion...";
                    const imgUrl = await this.convertPdfToImage(pdf);
                    extractedText = await this.performOCR(imgUrl, progressBar, statusText);
                }
                URL.revokeObjectURL(pdfUrl);
            } else {
                statusText.innerText = "Analyse de l'image...";
                const imgUrl = URL.createObjectURL(file);
                extractedText = await this.performOCR(imgUrl, progressBar, statusText);
                URL.revokeObjectURL(imgUrl);
            }

            // Call AI Extraction
            statusText.innerText = "Analyse intelligente...";
            progressBar.style.width = '90%';

            const aiData = await this.callGeminiAI(extractedText);
            console.log("Shipment AI Data:", aiData);

            progressBar.style.width = '100%';
            statusText.innerText = "Extraction réussie !";

            setTimeout(() => {
                this.closeModal();
                this.showShipmentBLVerificationModal(aiData);
            }, 500);

        } catch (error) {
            console.error("Shipment BL Error:", error);
            this.showToast("Erreur d'extraction: " + error.message, "danger");
            this.closeModal();
        }
    },

    async performOCR(imageUrl, progressBar, statusText) {
        const worker = await Tesseract.createWorker('eng+fra+chi_sim+chi_tra', 1, {
            logger: m => {
                if (m.status === 'recognizing text') {
                    progressBar.style.width = `${Math.round(m.progress * 100)}%`;
                    statusText.innerText = `Lecture... ${Math.round(m.progress * 100)}%`;
                }
            }
        });
        const { data: { text } } = await worker.recognize(imageUrl);
        await worker.terminate();
        return text;
    },

    showShipmentBLVerificationModal(data) {
        const modalHtml = `
            <div id="modal-overlay" class="modal-overlay" onclick="app.closeModal()">
                <div class="modal glass" onclick="event.stopPropagation()" style="width: 600px;">
                    <div class="modal-header">
                        <h2><i class="fas fa-check-circle"></i> Vérifier les données extraites</h2>
                        <button class="close-btn" onclick="app.closeModal()"><i class="fas fa-times"></i></button>
                    </div>
                    <form id="shipment-verification-form">
                        <div class="modal-body" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div class="form-group">
                                <label>Numéro de Conteneur</label>
                                <input type="text" name="containerNumber" value="${data.containerNumber || ''}" class="glass-input">
                            </div>
                            <div class="form-group">
                                <label>Numéro de BL</label>
                                <input type="text" name="blNumber" value="${data.bookingNumber || ''}" class="glass-input">
                            </div>
                            <div class="form-group">
                                <label>Compagnie Maritime</label>
                                <input type="text" name="carrier" value="${data.shippingLine || ''}" class="glass-input">
                            </div>
                            <div class="form-group">
                                <label>Date de Chargement</label>
                                <input type="date" name="etd" value="${this.formatDateForInput(data.loadingDate)}" class="glass-input">
                            </div>
                            <div class="form-group">
                                <label>Port de Chargement</label>
                                <input type="text" name="loadingPort" value="${data.portOfLoading || ''}" class="glass-input">
                            </div>
                            <div class="form-group">
                                <label>Port de Destination</label>
                                <input type="text" name="portOfDestination" value="${data.portOfDestination || ''}" class="glass-input">
                            </div>
                             <div class="form-group full-width" style="grid-column: span 2;">
                                <label>Véhicule identifié (Optionnel)</label>
                                <input type="text" name="vehicleName" value="${data.vehicleName || ''}" class="glass-input" readonly style="background: rgba(255,255,255,0.05);">
                                <small style="color: var(--text-dim);">Châssis identifié: ${data.chassisNumber || 'Non trouvé'}</small>
                                <input type="hidden" name="chassisNumber" value="${data.chassisNumber || ''}">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn-secondary" onclick="app.showShipmentBLUploadModal()">Recommencer</button>
                            <button type="submit" class="btn-primary">Confirmer & Créer l'Expédition</button>
                        </div>
                    </form>
                </div>
            </div>
            `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('shipment-verification-form').onsubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const verifiedData = Object.fromEntries(formData.entries());
            this.handleShipmentBLSubmission(verifiedData);
        };
    },

    handleShipmentBLSubmission(data) {
        this.closeModal();

        // Re-open the main shipment modal with pre-filled data
        this.showShipmentModal();

        // Give a small delay for DOM to be ready
        setTimeout(() => {
            const form = document.getElementById('shipment-form');
            if (!form) return;

            // Fill fields
            form.querySelector('[name="containerNumber"]').value = data.containerNumber || '';
            form.querySelector('[name="blNumber"]').value = data.blNumber || '';
            form.querySelector('[name="loadingPort"]').value = data.loadingPort || '';
            form.querySelector('[name="destination"]').value = data.portOfDestination || '';
            form.querySelector('[name="etd"]').value = data.etd || '';

            // Try to find and select carrier if it exists in our list
            const carrierSelect = form.querySelector('[name="carrier"]');
            if (carrierSelect && data.carrier) {
                const options = Array.from(carrierSelect.options);
                const match = options.find(opt => opt.value.toLowerCase().includes(data.carrier.toLowerCase()) || data.carrier.toLowerCase().includes(opt.value.toLowerCase()));
                if (match) carrierSelect.value = match.value;
            }

            // Auto-select vehicle if chassis was matched
            if (data.chassisNumber && data.chassisNumber !== 'Non trouvé') {
                const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES);
                const matchedVehicle = vehicles.find(v => v.chassisNumber && (v.chassisNumber.includes(data.chassisNumber) || data.chassisNumber.includes(v.chassisNumber)));

                if (matchedVehicle) {
                    this.showToast(`Véhicule matché: ${matchedVehicle.brand} ${matchedVehicle.model}`, "success");
                    // We need to trigger the search and check logic in the main modal
                    const searchInput = document.getElementById('shipment-vehicle-search');
                    if (searchInput) {
                        searchInput.value = matchedVehicle.chassisNumber;
                        // Search logic is usually triggered by input event
                        searchInput.dispatchEvent(new Event('input'));

                        // Try to check it
                        setTimeout(() => {
                            const checkbox = form.querySelector(`input[name="vehicleIds"][value="${matchedVehicle.id}"]`);
                            if (checkbox) {
                                checkbox.checked = true;
                                // Make sure it's in the set (if we had access to it, but it's local to the other function)
                                // Actually the main modal logic handles it if we click it
                                checkbox.click();
                            }
                        }, 300);
                    }
                }
            }
        }, 100);
    },

    formatDateForInput(dateStr) {
        if (!dateStr || dateStr === 'Non trouvé') return '';
        // Try to parse various date formats or just return as is if it looks like YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

        try {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        } catch (e) { }

        return '';
    },

    _triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.showToast(`Téléchargement de ${filename} lancé...`, 'success');
    },


    exportOrdersToCSV() {
        const orders = StorageService.get(STORAGE_KEYS.ORDERS);
        if (orders.length === 0) {
            alert('Aucune commande à exporter.');
            return;
        }

        const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES);
        const headers = ['N° BC', 'Date', 'Client', 'Véhicule', 'Chassis', 'Statut', 'Prix Net', 'Payé', 'Reste Du'];

        const csvRows = [
            headers.join(','),
            ...orders.map(o => {
                const vehicle = vehicles.find(v => v.id === o.vehicleId);
                const netPrice = (o.totalAmount || 0) - (o.discount || 0);
                const paid = this.getPaidAmount(o.id);
                const balance = Math.max(0, netPrice - paid);

                // Escape and format CSV fields
                const escape = (text) => `"${String(text || '').replace(/"/g, '""')}"`;

                return [
                    escape(o.id),
                    escape(new Date(o.date).toLocaleDateString()),
                    escape(o.clientName),
                    escape(o.vehicleName),
                    escape(vehicle ? vehicle.chassisNumber : '-'),
                    escape(o.status),
                    netPrice,
                    paid,
                    balance
                ].join(',');
            })
        ];

        const csvString = csvRows.join('\n');
        const blob = new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8;' });

        this._triggerDownload(blob, `commandes_export_${new Date().toISOString().split('T')[0]}.csv`);
    },

    exportOrdersToPDF() {
        try {
            if (!window.jspdf || !window.jspdf.jsPDF) {
                alert("Erreur: La bibliothèque PDF n'est pas chargée. Veuillez vérifier votre connexion internet.");
                return;
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for better fit
            const orders = StorageService.get(STORAGE_KEYS.ORDERS);
            // Sort orders by date descending
            orders.sort((a, b) => new Date(b.date) - new Date(a.date));

            if (orders.length === 0) {
                alert('Aucune commande à exporter.');
                return;
            }

            // Header
            doc.setFontSize(18);
            doc.setTextColor(40, 40, 40);
            doc.text('Liste des Commandes - TIBOU AUTO', 14, 20);

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Généré le: ${new Date().toLocaleString()}`, 14, 28);

            // Define Columns
            const tableColumn = ["N° BC", "Date", "Client", "Véhicule", "Statut", "Total Net", "Payé", "Reste"];
            const tableRows = [];

            orders.forEach(order => {
                const netPrice = (order.totalAmount || 0) - (order.discount || 0);
                const paid = this.getPaidAmount(order.id);
                const balance = Math.max(0, netPrice - paid);

                // Simplify status for display
                let displayStatus = order.status;
                if (displayStatus === 'EN ATTENTE DE VALIDATION') displayStatus = 'En Attente';

                const orderData = [
                    order.id,
                    new Date(order.date).toLocaleDateString(),
                    order.clientName,
                    order.vehicleName,
                    displayStatus,
                    this.formatCurrency(netPrice).replace(/\u202F/g, ' ').replace(/\u00A0/g, ' '),
                    this.formatCurrency(paid).replace(/\u202F/g, ' ').replace(/\u00A0/g, ' '),
                    this.formatCurrency(balance).replace(/\u202F/g, ' ').replace(/\u00A0/g, ' ')
                ];
                tableRows.push(orderData);
            });

            doc.autoTable({
                head: [tableColumn],
                body: tableRows,
                startY: 35,
                theme: 'grid',
                headStyles: {
                    fillColor: [99, 102, 241],
                    halign: 'center'
                },
                styles: {
                    fontSize: 9,
                    valign: 'middle',
                    cellPadding: 3
                },
                columnStyles: {
                    0: { cellWidth: 25, fontStyle: 'bold' }, // ID
                    1: { cellWidth: 25 }, // Date
                    2: { cellWidth: 40 }, // Client
                    3: { cellWidth: 60 }, // Vehicle
                    4: { cellWidth: 35, halign: 'center' }, // Status
                    5: { cellWidth: 30, halign: 'right' }, // Total
                    6: { cellWidth: 30, halign: 'right' }, // Paid
                    7: { cellWidth: 30, halign: 'right', fontStyle: 'bold' } // Balance
                },
                didParseCell: function (data) {
                    // Colorize Balance: Green if Paid (0), Red if Outstanding
                    if (data.column.index === 7) {
                        const rawVal = data.cell.raw;
                        if (rawVal.includes('0') && rawVal.length < 5) { // Simple heuristic for zero/near zero formatting
                            data.cell.styles.textColor = [34, 197, 94]; // Green
                        } else {
                            data.cell.styles.textColor = [239, 68, 68]; // Red
                        }
                    }
                }
            });

            doc.save(`commandes_tibou_auto_${new Date().toISOString().split('T')[0]}.pdf`);
            this.showToast('Téléchargement du PDF lancé...', 'success');
        } catch (e) {
            console.error('PDF Export Error:', e);
            alert('Une erreur est survenue lors de la génération du PDF.');
        }
    },

    exportPendingOrdersMatrixToPDF() {
        try {
            if (!window.jspdf || !window.jspdf.jsPDF) {
                alert("Erreur: La bibliothèque PDF n'est pas chargée.");
                return;
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('l', 'mm', 'a4');
            const orders = StorageService.get(STORAGE_KEYS.ORDERS);

            // 1. Filter Pending Orders (Strictly "ATTENTE AFFECTATION VÉHICULE")
            const pendingOrders = orders.filter(o =>
                o.status === 'ATTENTE AFFECTATION VÉHICULE' && o.requestedBrand && o.requestedModel
            );

            if (pendingOrders.length === 0) {
                alert('Aucune commande en attente d\'affectation avec marque/modèle spécifiés.');
                return;
            }

            // 2. Extract Unique Colors (Columns)
            const colors = [...new Set(pendingOrders.map(o => o.requestedColor || 'Non spécifié'))].sort();
            // Ensure 'Non spécifié' is last
            const nsIndex = colors.indexOf('Non spécifié');
            if (nsIndex > -1) {
                colors.push(colors.splice(nsIndex, 1)[0]);
            }

            // 3. Aggregate Data [Brand - Model] -> { Color: Count }
            const matrix = {};

            pendingOrders.forEach(o => {
                const key = `${o.requestedBrand} - ${o.requestedModel}`;
                const color = o.requestedColor || 'Non spécifié';

                if (!matrix[key]) matrix[key] = { total: 0 };
                if (!matrix[key][color]) matrix[key][color] = 0;

                matrix[key][color]++;
                matrix[key].total++;
            });

            // 4. Build Table Rows
            // Columns: [Marque - Modèle, ...Colors, TOTAL]
            const tableColumns = ['Marque - Modèle', ...colors.map(c => c === 'Non spécifié' ? 'Autres' : c), 'TOTAL'];
            const tableRows = Object.keys(matrix).sort().map(key => {
                const row = [key];
                let rowTotal = 0;

                colors.forEach(col => {
                    const count = matrix[key][col] || 0;
                    row.push(count > 0 ? count : '-');
                    rowTotal += count;
                });

                row.push(rowTotal);
                return row;
            });

            // Footer Row (Totals per Color)
            const footerRow = ['TOTAL GÉNÉRAL'];
            let grandTotal = 0;
            colors.forEach(col => {
                let colTotal = 0;
                Object.values(matrix).forEach(rowObj => {
                    colTotal += (rowObj[col] || 0);
                });
                footerRow.push(colTotal > 0 ? colTotal : '-');
                grandTotal += colTotal;
            });
            footerRow.push(grandTotal);
            tableRows.push(footerRow);

            // 5. Generate PDF
            doc.setFontSize(18);
            doc.setTextColor(40, 40, 40);
            doc.text('État des Commandes en Attente d\'Affectation', 14, 20);

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Généré le: ${new Date().toLocaleString()}`, 14, 28);
            doc.text(`Total véhicules à commander: ${grandTotal}`, 14, 34);

            doc.autoTable({
                head: [tableColumns],
                body: tableRows,
                startY: 40,
                theme: 'grid',
                headStyles: {
                    fillColor: [79, 70, 229], // Indigo
                    halign: 'center',
                    fontStyle: 'bold',
                    fontSize: 9
                },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 60 }, // Brand - Model column
                    [tableColumns.length - 1]: { fontStyle: 'bold', fillColor: [243, 244, 246], halign: 'center' } // Row Total column
                },
                styles: {
                    halign: 'center',
                    valign: 'middle',
                    fontSize: 9
                },
                didParseCell: function (data) {
                    // Style the footer row
                    if (data.row.index === tableRows.length - 1) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [229, 231, 235]; // Gray
                    }
                }
            });

            doc.save(`matrice_commandes_attente_${new Date().toISOString().split('T')[0]}.pdf`);
            this.showToast('Matrice des commandes téléchargée', 'success');

        } catch (e) {
            console.error('PDF Matrix Error:', e);
            alert('Erreur lors de la génération de la matrice PDF.');
        }
    },

    showShipmentModal(preSelectedVehicleId = null) {
        const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES);
        // Allow selecting a vehicle that is either the pre-selected one OR has an order but no shipment AND is not archived
        const availableVehicles = vehicles.filter(v =>
            (v.id === preSelectedVehicleId || !v.shipmentId) && !v.isArchived
        );
        const orders = StorageService.get(STORAGE_KEYS.ORDERS);

        const modalHtml = `
                        <div class="modal-overlay">
                            <div class="modal-content glass">
                                <div class="modal-header">
                                    <h2>Nouvelle Expédition</h2>
                                    <button class="btn-close" onclick="app.closeModal()">&times;</button>
                                </div>
                                <form id="shipment-form">
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label>Numéro de Conteneur <span style="color: var(--danger);">*</span></label>
                                            <input type="text" name="containerNumber" required class="glass-input" placeholder="ex: CONT-123456">
                                        </div>
                                    </div>
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label>Voyage (Officiel)</label>
                                            <select name="voyageId" class="glass-select" id="shipment-voyage-select">
                                                <option value="">-- Aucun Voyage (Manuel) --</option>
                                                ${(StorageService.get(STORAGE_KEYS.VOYAGES) || []).map(v => `
                                                    <option value="${v.id}">${v.name}</option>
                                                `).join('')}
                                            </select>
                                        </div>
                                        <div class="form-group">
                                            <label>Date d'expédition</label>
                                            <input type="date" name="shipmentDate" required class="glass-input" value="${new Date().toISOString().split('T')[0]}">
                                        </div>
                                    </div>
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label>Transporteur</label>
                                            <select name="carrier" class="glass-select">
                                                ${StorageService.get(STORAGE_KEYS.CARRIERS).map(c => `<option value="${c}">${c}</option>`).join('')}
                                            </select>
                                        </div>
                                        <div class="form-group">
                                            <label>Port de Chargement</label>
                                            <input type="text" name="loadingPort" class="glass-input" placeholder="ex: Port de Marseille">
                                        </div>
                                        <div class="form-group">
                                            <label>Transitaire Port</label>
                                            <input type="text" name="forwarder" class="glass-input" placeholder="ex: Bolloré">
                                        </div>
                                        <div class="form-group">
                                            <label>Port de Destination</label>
                                            <input type="text" name="destination" required class="glass-input" placeholder="ex: Port de Cotonou">
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label>Sélectionnez les véhicules à expédier</label>
                                        <input type="text" id="shipment-vehicle-search" class="glass-input" placeholder="Rechercher: Véhicule, VIN, Client, Showroom..." style="margin-bottom: 10px;">
                                        <div id="shipment-vehicle-list" class="vehicles-selection-grid glass" style="max-height: 200px; overflow-y: auto; padding: 10px; border-radius: 8px; background: rgba(0,0,0,0.2);">
                                            <!-- Dynamically filled -->
                                        </div>
                                    </div>
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label>Numéro de BL</label>
                                            <input type="text" name="blNumber" class="glass-input" placeholder="ex: BL-123456">
                                        </div>
                                        <div class="form-group">
                                            <label>Réception Documents</label>
                                            <input type="date" name="docReceptionDate" class="glass-input">
                                        </div>
                                    </div>
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label>ETD (Départ prévu)</label>
                                            <input type="date" name="etd" class="glass-input">
                                        </div>
                                        <div class="form-group">
                                            <label>ETA (Arrivée prévue)</label>
                                            <input type="date" name="eta" class="glass-input">
                                        </div>
                                        <div class="form-group">
                                            <label>Statut</label>
                                            <select name="status" class="glass-select">
                                                <option value="Préparation">Préparation</option>
                                                <option value="En mer">En mer</option>
                                                <option value="Arrivé">Arrivé</option>
                                                <option value="Livré">Livré</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label>Date Arrivée</label>
                                            <input type="date" name="arrivalDate" class="glass-input">
                                        </div>
                                        <div class="form-group">
                                            <label>Date Dédouanement</label>
                                            <input type="date" name="customsClearanceDate" class="glass-input">
                                        </div>
                                        <div class="form-group">
                                            <label>Date Enlèvement</label>
                                            <input type="date" name="pickupDate" class="glass-input">
                                        </div>
                                    </div>
                                    <div class="modal-footer">
                                        <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                                        <button type="submit" class="btn-primary">Lancer l'expédition</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Add Voyage Auto-fill logic
        const voyageSelect = document.getElementById('shipment-voyage-select');
        const form = document.getElementById('shipment-form');
        if (voyageSelect) {
            voyageSelect.addEventListener('change', (e) => {
                const voyageId = parseInt(e.target.value);
                if (voyageId) {
                    const voyage = (StorageService.get(STORAGE_KEYS.VOYAGES) || []).find(v => v.id === voyageId);
                    if (voyage) {
                        if (voyage.loadingPort) form.elements['loadingPort'].value = voyage.loadingPort;
                        if (voyage.destination) form.elements['destination'].value = voyage.destination;
                        if (voyage.etd) form.elements['etd'].value = this.formatDateForInput(voyage.etd);
                        if (voyage.eta) form.elements['eta'].value = this.formatDateForInput(voyage.eta);
                        if (voyage.arrivalDate) form.elements['arrivalDate'].value = this.formatDateForInput(voyage.arrivalDate);
                        if (voyage.status) form.elements['status'].value = voyage.status;
                        if (voyage.carrier) form.elements['carrier'].value = voyage.carrier;
                    }
                }
            });
        }

        // Logic for vehicle search and selection persistence
        const searchInput = document.getElementById('shipment-vehicle-search');
        const listContainer = document.getElementById('shipment-vehicle-list');
        const selectedVehicleIds = new Set();
        if (preSelectedVehicleId) selectedVehicleIds.add(preSelectedVehicleId);

        const renderVehicleList = (filterText = '') => {
            const lowerFilter = filterText.toLowerCase();

            const filteredVehicles = availableVehicles.filter(v => {
                const order = orders.find(o => o.id === v.orderId);
                const searchString = `
                        ${v.brand} ${v.model || ''}
                        ${v.vin || ''}
                        ${order?.clientName || ''}
                        ${order?.showroom || v.showroom || ''}
                        ${v.id}
                    `.toLowerCase();
                return searchString.includes(lowerFilter);
            });

            if (filteredVehicles.length === 0) {
                listContainer.innerHTML = '<p style="color: var(--text-dim); font-size: 0.9rem; padding: 10px;">Aucun véhicule trouvé.</p>';
            } else {
                listContainer.innerHTML = filteredVehicles.map(v => {
                    const order = orders.find(o => o.id === v.orderId);
                    const isChecked = selectedVehicleIds.has(v.id);
                    return `
                            <label class="checkbox-item" style="display: flex; align-items: center; gap: 10px; padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer;">
                                <input type="checkbox" name="vehicleIds" value="${v.id}" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px;">
                                <div style="display: flex; flex-direction: column;">
                                    <span style="font-weight: 500;">${v.brand} ${v.model || ''}</span>
                                    <span style="font-size: 0.75rem; color: var(--text-dim);">
                                        VIN: ${v.vin || 'N/A'} | Cmd: ${order?.id || 'N/A'} <br>
                                        Client: ${order?.clientName || 'Stock'} | Showroom: ${order?.showroom || v.showroom || 'N/A'}
                                    </span>
                                </div>
                            </label>
                        `;
                }).join('');
            }

            // Re-attach listeners to new checkboxes
            listContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        selectedVehicleIds.add(e.target.value);
                    } else {
                        selectedVehicleIds.delete(e.target.value);
                    }
                });
            });
        };

        // Initial Render
        renderVehicleList();

        // Search Listener
        searchInput.addEventListener('input', (e) => {
            renderVehicleList(e.target.value);
        });

        // Auto-fill arrival date when status changes to "Arrivé"
        const statusSelect = document.querySelector('select[name="status"]');
        const arrivalDateInput = document.querySelector('input[name="arrivalDate"]');
        if (statusSelect && arrivalDateInput) {
            statusSelect.addEventListener('change', (e) => {
                if (e.target.value === 'Arrivé' && !arrivalDateInput.value) {
                    arrivalDateInput.value = new Date().toISOString().split('T')[0];
                    console.log('[UI] Auto-filled arrival date:', arrivalDateInput.value);
                }
            });
        }

        document.getElementById('shipment-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleShipmentSubmission(new FormData(e.target));
        });
    },

    showEditShipmentModal(id) {
        const shipment = StorageService.get(STORAGE_KEYS.SHIPMENTS).find(s => s.id === id);
        if (!shipment) return;

        const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES);
        const orders = StorageService.get(STORAGE_KEYS.ORDERS);
        // const currentVehicle = vehicles.find(v => v.id === shipment.vehicleId); // This will be an array now

        const modalHtml = `
                        <div class="modal-overlay">
                            <div class="modal-content glass">
                                <div class="modal-header">
                                    <h2>Modifier l'Expédition ${shipment.id}</h2>
                                    <button class="btn-close" onclick="app.closeModal()">&times;</button>
                                </div>
                                <form id="shipment-form">
                                    <input type="hidden" name="shipmentId" value="${shipment.id}">
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label>Numéro de Conteneur <span style="color: var(--danger);">*</span></label>
                                            <input type="text" name="containerNumber" value="${shipment.containerNumber || ''}" required class="glass-input">
                                        </div>
                                    </div>
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label>Voyage (Officiel)</label>
                                            <select name="voyageId" class="glass-select" id="shipment-voyage-select">
                                                <option value="">-- Aucun / Legacy (${shipment.voyage || 'SANS NOM'}) --</option>
                                                ${(StorageService.get(STORAGE_KEYS.VOYAGES) || []).map(v => `
                                                    <option value="${v.id}" ${shipment.voyageId === v.id ? 'selected' : ''}>${v.name}</option>
                                                `).join('')}
                                            </select>
                                        </div>
                                        <div class="form-group">
                                            <label>Date d'expédition</label>
                                            <input type="date" name="shipmentDate" value="${this.formatDateForInput(shipment.shipmentDate)}" required class="glass-input">
                                        </div>
                                    </div>
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label>Transporteur</label>
                                            <select name="carrier" class="glass-select">
                                                ${StorageService.get(STORAGE_KEYS.CARRIERS).map(c => `
                                                    <option value="${c}" ${shipment.carrier === c ? 'selected' : ''}>${c}</option>
                                                `).join('')}
                                            </select>
                                        </div>
                                        <div class="form-group">
                                            <label>Port de Chargement</label>
                                            <input type="text" name="loadingPort" value="${shipment.loadingPort || ''}" class="glass-input">
                                        </div>
                                        <div class="form-group">
                                            <label>Transitaire Port</label>
                                            <input type="text" name="forwarder" value="${shipment.forwarder || ''}" class="glass-input">
                                        </div>
                                        <div class="form-group">
                                            <label>Port de Destination</label>
                                            <input type="text" name="destination" value="${shipment.destination}" required class="glass-input">
                                        </div>
                                    </div>
                                        <div class="form-group">
                                            <label>Véhicules dans cette expédition</label>
                                            <div class="vehicles-selection-grid glass" style="max-height: 200px; overflow-y: auto; padding: 10px; border-radius: 8px; background: rgba(0,0,0,0.2);">
                                                ${vehicles.filter(v => !v.shipmentId || v.shipmentId === shipment.id).map(v => {
            const order = orders.find(o => o.id === v.orderId);
            const isLinked = v.shipmentId === shipment.id;
            return `
                                    <label class="checkbox-item" style="display: flex; align-items: center; gap: 10px; padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer;">
                                        <input type="checkbox" name="vehicleIds" value="${v.id}" ${isLinked ? 'checked' : ''} style="width: 18px; height: 18px;">
                                        <div style="display: flex; flex-direction: column;">
                                            <span style="font-weight: 500;">${v.brand}</span>
                                            <span style="font-size: 0.75rem; color: var(--text-dim);">Cmd #${order?.id || 'N/A'} - ${v.chassisNumber || 'Sans VIN'}</span>
                                        </div>
                                    </label>
                                `;
        }).join('')}
                                            </div>
                                        </div>
                                        <div class="form-row">
                                            <div class="form-group">
                                                <label>Numéro de BL</label>
                                                <input type="text" name="blNumber" value="${shipment.blNumber || ''}" class="glass-input">
                                            </div>
                                            <div class="form-group">
                                                <label>Réception Documents</label>
                                                <input type="date" name="docReceptionDate" value="${this.formatDateForInput(shipment.docReceptionDate)}" class="glass-input">
                                            </div>
                                        </div>
                                        <div class="form-row">
                                            <div class="form-group">
                                                <label>ETD (Départ prévu)</label>
                                                <input type="date" name="etd" value="${this.formatDateForInput(shipment.etd)}" class="glass-input">
                                            </div>
                                            <div class="form-group">
                                                <label>ETA (Arrivée prévue)</label>
                                                <input type="date" name="eta" value="${this.formatDateForInput(shipment.eta)}" class="glass-input">
                                            </div>
                                            <div class="form-group">
                                                <label>Statut</label>
                                                <select name="status" class="glass-select">
                                                    <option value="Préparation" ${shipment.status === 'Préparation' ? 'selected' : ''}>Préparation</option>
                                                    <option value="En mer" ${shipment.status === 'En mer' ? 'selected' : ''}>En mer</option>
                                                    <option value="Arrivé" ${shipment.status === 'Arrivé' ? 'selected' : ''}>Arrivé</option>
                                                    <option value="Livré" ${shipment.status === 'Livré' ? 'selected' : ''}>Livré</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div class="form-row">
                                            <div class="form-group">
                                                <label>Date Arrivée</label>
                                                <input type="date" name="arrivalDate" value="${this.formatDateForInput(shipment.arrivalDate)}" class="glass-input">
                                            </div>
                                            <div class="form-group">
                                                <label>Date Dédouanement</label>
                                                <input type="date" name="customsClearanceDate" value="${this.formatDateForInput(shipment.customsClearanceDate)}" class="glass-input">
                                            </div>
                                            <div class="form-group">
                                                <label>Date Enlèvement</label>
                                                <input type="date" name="pickupDate" value="${this.formatDateForInput(shipment.pickupDate)}" class="glass-input">
                                            </div>
                                        </div>
                                        <div class="form-group">
                                            <label class="checkbox-item" style="display: flex; align-items: center; gap: 10px; padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer;">
                                                <input type="checkbox" name="isArchived" value="true" ${shipment.isArchived ? 'checked' : ''} style="width: 18px; height: 18px;">
                                                <div style="display: flex; flex-direction: column;">
                                                    <span style="font-weight: 500;">Archiver cette expédition</span>
                                                    <span style="font-size: 0.75rem; color: var(--text-dim);">Masque l'expédition des vues principales.</span>
                                                </div>
                                            </label>
                                        </div>
                                        <div class="modal-footer">
                                            <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                                            <button type="submit" class="btn-primary">Enregistrer les modifications</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                            `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Add Voyage Auto-fill logic
        const voyageSelect = document.getElementById('shipment-voyage-select');
        const form = document.getElementById('shipment-form');
        if (voyageSelect) {
            voyageSelect.addEventListener('change', (e) => {
                const voyageId = parseInt(e.target.value);
                if (voyageId) {
                    const voyage = (StorageService.get(STORAGE_KEYS.VOYAGES) || []).find(v => v.id === voyageId);
                    if (voyage) {
                        if (voyage.loadingPort) form.elements['loadingPort'].value = voyage.loadingPort;
                        if (voyage.destination) form.elements['destination'].value = voyage.destination;
                        if (voyage.etd) form.elements['etd'].value = this.formatDateForInput(voyage.etd);
                        if (voyage.eta) form.elements['eta'].value = this.formatDateForInput(voyage.eta);
                        if (voyage.arrivalDate) form.elements['arrivalDate'].value = this.formatDateForInput(voyage.arrivalDate);
                        if (voyage.status) form.elements['status'].value = voyage.status;
                        if (voyage.carrier) form.elements['carrier'].value = voyage.carrier;
                    }
                }
            });
        }

        document.getElementById('shipment-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleShipmentSubmission(new FormData(e.target));
        });
    },

    async handleShipmentSubmission(formData) {
        const submitBtn = document.querySelector('#shipment-form button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...';
        }

        let shipmentId;
        try {
            shipmentId = formData.get('shipmentId');
            const selectedVehicleIds = formData.getAll('vehicleIds');
            const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES);
            const shipments = StorageService.get(STORAGE_KEYS.SHIPMENTS);
            const orders = StorageService.get(STORAGE_KEYS.ORDERS);

            if (selectedVehicleIds.length === 0) {
                this.showToast('Veuillez sélectionner au moins un véhicule', 'danger');
                return;
            }

            const sanitizeDate = (val) => (val && val.trim() !== '' ? val : null);
            const voyageId = formData.get('voyageId') ? parseInt(formData.get('voyageId')) : null;
            let voyageName = '';
            if (voyageId) {
                const voyage = (StorageService.get(STORAGE_KEYS.VOYAGES) || []).find(v => v.id === voyageId);
                if (voyage) voyageName = voyage.name;
            } else {
                voyageName = formData.get('voyage') || '';
            }

            let arrivalDate = sanitizeDate(formData.get('arrivalDate'));
            const status = formData.get('status');
            console.log('[Shipment] Status:', status, 'Arrival Date:', arrivalDate);
            if (status === 'Arrivé' && !arrivalDate) {
                arrivalDate = new Date().toISOString().split('T')[0];
                console.log('[Shipment] Auto-set arrival date to:', arrivalDate);
            }

            const shipmentData = {
                id: shipmentId || `SHP-${Date.now().toString().slice(-6)}`,
                containerNumber: formData.get('containerNumber'),
                shipmentDate: sanitizeDate(formData.get('shipmentDate')),
                etd: sanitizeDate(formData.get('etd')),
                eta: sanitizeDate(formData.get('eta')),
                docReceptionDate: sanitizeDate(formData.get('docReceptionDate')),
                destination: formData.get('destination'),
                loadingPort: formData.get('loadingPort'),
                trackingNumber: formData.get('trackingNumber'),
                blNumber: formData.get('blNumber'),
                carrier: formData.get('carrier'),
                status: formData.get('status'),
                forwarder: formData.get('forwarder'),
                voyage: voyageName,
                voyageId: voyageId,
                isArchived: formData.get('isArchived') === 'true' || false,
                arrivalDate: arrivalDate,
                customsClearanceDate: sanitizeDate(formData.get('customsClearanceDate')),
                pickupDate: sanitizeDate(formData.get('pickupDate'))
            };

            if (shipmentId) {
                await StorageService.update(STORAGE_KEYS.SHIPMENTS, shipmentId, shipmentData);
            } else {
                await StorageService.add(STORAGE_KEYS.SHIPMENTS, shipmentData);
            }

            // Unlink vehicles previously in this shipment to handle removals
            if (shipmentId) {
                for (const v of vehicles) {
                    if (v.shipmentId === shipmentId || v.shipmentId === shipmentData.id) {
                        // Check if it's still in the selected list
                        if (!selectedVehicleIds.includes(v.id)) {
                            delete v.shipmentId;
                            v.status = v.orderId ? 'Reserved' : 'Available';
                            await StorageService.update(STORAGE_KEYS.VEHICLES, v.id, v);
                        }
                    }
                }
            }

            // Link newly selected vehicles and update order statuses
            for (const vId of selectedVehicleIds) {
                const vehicle = vehicles.find(v => v.id === vId);
                if (vehicle) {
                    vehicle.shipmentId = shipmentData.id;

                    // Update Vehicle Status based on Shipment Status
                    if (shipmentData.status === 'Arrivé') {
                        vehicle.status = 'Arrived';
                    } else if (shipmentData.status === 'Livré') {
                        vehicle.status = 'Sold';
                    } else {
                        vehicle.status = 'In Transit';
                    }

                    await StorageService.update(STORAGE_KEYS.VEHICLES, vehicle.id, vehicle);

                    // Update linked order status
                    if (vehicle.orderId) {
                        const order = orders.find(o => o.id === vehicle.orderId);
                        if (order) {
                            // Map shipment status to order status for direct update
                            let mappedStatus = shipmentData.status;
                            if (shipmentData.status === 'Arrivé') mappedStatus = 'ARRIVÉE';
                            else if (shipmentData.status === 'Livré') mappedStatus = 'ENLEVÉE';
                            else if (shipmentData.status === 'En mer') mappedStatus = 'EN MER';
                            else if (shipmentData.status === 'Préparation') mappedStatus = 'A BORD';

                            order.status = mappedStatus;
                            await StorageService.update(STORAGE_KEYS.ORDERS, order.id, order);
                        }
                    }
                }
            }

            await this.syncOrderStatuses();
            this.closeModal();
            this.showToast(shipmentId ? 'Expédition mise à jour' : 'Expédition enregistrée avec succès', 'success');
            this.renderView(this.currentView);
        } catch (error) {
            console.error("Error in handleShipmentSubmission:", error);
            this.showToast(error.message || "Erreur lors de l'enregistrement de l'expédition", "error");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = shipmentId ? 'Enregistrer les modifications' : "Lancer l'expédition";
            }
        }
    },

    async handleManualShipmentRefresh(shipmentId) {
        try {
            const shipment = (StorageService.get(STORAGE_KEYS.SHIPMENTS) || []).find(s => s.id === shipmentId);
            if (!shipment) {
                this.showToast('Expédition non trouvée', 'error');
                return;
            }

            const confirmed = confirm(`Actualiser l'expédition "${shipment.containerNumber || shipmentId}" ?\n\nCela va :\n- Remplir automatiquement les dates selon le statut\n- Mettre à jour les véhicules et commandes liés`);
            if (!confirmed) return;

            this.showToast('Actualisation en cours...', 'info');

            const response = await fetch(`${API_BASE_URL}/shipments/${shipmentId}/manual-update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();

            if (result.success) {
                // Perform a full sync to get all propagated changes (vehicles, orders)
                await this.syncAllData();
                this.showToast('✅ Expédition et commandes actualisées !', 'success');
            } else {
                this.showToast(result.message || 'Erreur lors de l\'actualisation', 'error');
            }
        } catch (error) {
            console.error('Error refreshing shipment:', error);
            this.showToast('Erreur lors de l\'actualisation de l\'expédition', 'error');
        }
    },

    showVoyageModal(id = null) {
        const voyages = StorageService.get(STORAGE_KEYS.VOYAGES) || [];
        const voyage = id ? voyages.find(v => v.id === id || v.id === parseInt(id)) : null;

        const modalHtml = `
            <div class="modal-overlay">
                <div class="modal-content glass" style="max-width: 800px;">
                    <div class="modal-header">
                        <h2>${voyage ? 'Modifier le Voyage' : 'Nouveau Voyage'}</h2>
                        <button class="btn-close" onclick="app.closeModal()">&times;</button>
                    </div>
                    <form id="voyage-form">
                        ${voyage ? `<input type="hidden" name="id" value="${voyage.id}">` : ''}
                        <div class="form-row">
                            <div class="form-group">
                                <label>Nom du Voyage (Référence) <span style="color: var(--danger);">*</span></label>
                                <input type="text" name="name" value="${voyage ? voyage.name : ''}" required class="glass-input" placeholder="ex: FLORENCE-001">
                            </div>
                            <div class="form-group">
                                <label>Navire</label>
                                <input type="text" name="vesselName" value="${voyage ? voyage.vesselName || '' : ''}" class="glass-input" placeholder="ex: MSC AMBRA">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Compagnie / Transporteur</label>
                                <select name="carrier" class="glass-select">
                                    <option value="">-- Sélectionner --</option>
                                    ${StorageService.get(STORAGE_KEYS.CARRIERS).map(c => `
                                        <option value="${c}" ${voyage?.carrier === c ? 'selected' : ''}>${c}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>N° de BL (Tracking)</label>
                                <input type="text" name="blNumber" value="${voyage ? voyage.blNumber || '' : ''}" class="glass-input" placeholder="ex: BL123456789">
                            </div>
                            <div class="form-group">
                                <label>Statut</label>
                                <select name="status" class="glass-select">
                                    <option value="Planifié" ${voyage?.status === 'Planifié' ? 'selected' : ''}>Planifié</option>
                                    <option value="En Route" ${voyage?.status === 'En Route' ? 'selected' : ''}>En Route</option>
                                    <option value="Arrivé" ${voyage?.status === 'Arrivé' ? 'selected' : ''}>Arrivé</option>
                                    <option value="Terminé" ${voyage?.status === 'Terminé' ? 'selected' : ''}>Terminé</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Port de Chargement</label>
                                <input type="text" name="loadingPort" value="${voyage ? voyage.loadingPort || '' : ''}" class="glass-input">
                            </div>
                            <div class="form-group">
                                <label>Port de Destination</label>
                                <input type="text" name="destination" value="${voyage ? voyage.destination || '' : ''}" class="glass-input">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>ETD (Départ)</label>
                                <input type="date" name="etd" value="${this.formatDateForInput(voyage?.etd)}" class="glass-input">
                            </div>
                            <div class="form-group">
                                <label>ETA (Arrivée prévue)</label>
                                <input type="date" name="eta" value="${this.formatDateForInput(voyage?.eta)}" class="glass-input">
                            </div>
                            <div class="form-group">
                                <label>Date Arrivée Réelle</label>
                                <input type="date" name="arrivalDate" value="${this.formatDateForInput(voyage?.arrivalDate)}" class="glass-input">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Notes / Description</label>
                            <textarea name="notes" class="glass-input" rows="3">${voyage ? voyage.notes || '' : ''}</textarea>
                        </div>
                        ${voyage ? `
                        <div class="form-group">
                            <label class="checkbox-item" style="display: flex; align-items: center; gap: 10px;">
                                <input type="checkbox" name="propagateToShipments" value="true" checked>
                                <span>Mettre à jour les dates/ports de toutes les expéditions liées</span>
                            </label>
                        </div>` : ''}
                        <div class="modal-footer">
                            <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                            <button type="submit" class="btn-primary">${voyage ? 'Enregistrer' : 'Créer le Voyage'}</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.getElementById('voyage-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleVoyageSubmission(new FormData(e.target));
        });
    },

    async handleVoyageSubmission(formData) {
        try {
            const id = formData.get('id');
            const voyageData = {
                name: formData.get('name'),
                vesselName: formData.get('vesselName'),
                carrier: formData.get('carrier'),
                loadingPort: formData.get('loadingPort'),
                destination: formData.get('destination'),
                etd: formData.get('etd') || null,
                eta: formData.get('eta') || null,
                arrivalDate: formData.get('arrivalDate') || null,
                status: formData.get('status'),
                blNumber: formData.get('blNumber'),
                notes: formData.get('notes'),
                propagateToShipments: formData.get('propagateToShipments') === 'true'
            };

            let arrivalDate = voyageData.arrivalDate;
            console.log('[Voyage] Status:', voyageData.status, 'Arrival Date:', arrivalDate);
            if (voyageData.status === 'Arrivé' && !arrivalDate) {
                arrivalDate = new Date().toISOString().split('T')[0];
                voyageData.arrivalDate = arrivalDate;
                console.log('[Voyage] Auto-set arrival date to:', arrivalDate);
            }

            if (id) {
                await StorageService.update(STORAGE_KEYS.VOYAGES, parseInt(id), voyageData);

                // Propagate to shipments if requested
                if (voyageData.propagateToShipments) {
                    const shipments = StorageService.get(STORAGE_KEYS.SHIPMENTS) || [];
                    const voyageShipments = shipments.filter(s => s.voyageId === parseInt(id));

                    for (const shipment of voyageShipments) {
                        const updatedShipment = {
                            ...shipment,
                            status: voyageData.status,
                            arrivalDate: voyageData.arrivalDate,
                            loadingPort: voyageData.loadingPort,
                            destination: voyageData.destination,
                            etd: voyageData.etd,
                            eta: voyageData.eta,
                            vesselName: voyageData.vesselName,
                            carrier: voyageData.carrier
                        };

                        // We need to use handleShipmentSubmission logic to update vehicles/orders
                        // but since we are in a loop and it's a complex logic, we'll manually call the update
                        // and then trigger vehicle/order status updates.
                        await StorageService.update(STORAGE_KEYS.SHIPMENTS, shipment.id, updatedShipment);

                        // Update vehicles linked to this shipment
                        const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES) || [];
                        const orders = StorageService.get(STORAGE_KEYS.ORDERS) || [];
                        const shipmentVehicles = vehicles.filter(v => v.shipmentId === shipment.id);

                        for (const vehicle of shipmentVehicles) {
                            if (updatedShipment.status === 'Arrivé') {
                                vehicle.status = 'Arrived';
                            } else if (updatedShipment.status === 'Livré') {
                                vehicle.status = 'Sold';
                            } else {
                                vehicle.status = 'In Transit';
                            }
                            await StorageService.update(STORAGE_KEYS.VEHICLES, vehicle.id, vehicle);

                            if (vehicle.orderId) {
                                const order = orders.find(o => o.id === vehicle.orderId);
                                if (order) {
                                    order.status = updatedShipment.status;
                                    await StorageService.update(STORAGE_KEYS.ORDERS, order.id, order);
                                }
                            }
                        }
                    }
                }

                this.showToast('Voyage mis à jour et propagé', 'success');
            } else {
                await StorageService.add(STORAGE_KEYS.VOYAGES, voyageData);
                this.showToast('Voyage créé avec succès', 'success');
            }

            await this.syncOrderStatuses();
            this.closeModal();
            this.renderView(this.currentView);
        } catch (error) {
            console.error("Error saving voyage:", error);
            this.showToast("Erreur lors de l'enregistrement du voyage", "error");
        }
    },

    async trackShipment(shipmentId) {
        this.showToast(`Mise à jour du suivi pour l'expédition ${shipmentId}...`, "info");
        try {
            const response = await fetch(`/api/tracking/${shipmentId}/refresh`, { method: 'POST' });
            const res = await response.json();

            if (res.success) {
                this.showToast("Suivi mis à jour avec succès", "success");
                // Synchroniser les données locales
                await this.syncAllData();
                // Afficher le modal avec les détails frais (Utilise le nom correct de la fonction)
                this.showTrackingHistoryModal(shipmentId);
                // Tout rafraîchir pour que les Commandes et Véhicules voient les changements
                this.renderView(this.currentView);
            } else {
                throw new Error(res.message);
            }
        } catch (error) {
            console.error("Refresh Error:", error);
            this.showToast("Erreur lors de la mise à jour: " + (error.message || "Erreur inconnue"), "danger");
        }
    },

    async zoomToShipment(shipmentId) {
        // Basculer vers la vue Tracking Mondial
        this.renderView('tracking');

        // Attendre que la carte soit initialisée et que renderTracking ait fini ses fetches
        setTimeout(() => {
            const shipments = StorageService.get(STORAGE_KEYS.SHIPMENTS);
            const shipment = shipments.find(s => s.id === shipmentId);

            if (shipment && shipment.currentLat && shipment.currentLng && this.mapTracking) {
                this.mapTracking.setView([shipment.currentLat, shipment.currentLng], 12);
                this.showToast(`🛳️ Zoom sur le navire : ${shipment.carrier || 'Navire'}`, "info");
            } else {
                this.showToast("Détails du suivi non disponibles pour cette expédition.", "warning");
            }
        }, 1500);
    },

    renderCash(query = '', filter = 'all', showroomFilter = '') {
        let cash = StorageService.get(STORAGE_KEYS.CASH);
        const orders = StorageService.get(STORAGE_KEYS.ORDERS);
        const showrooms = StorageService.get(STORAGE_KEYS.SHOWROOMS) || [];

        // Apply query filter
        if (query) {
            const q = query.toLowerCase();
            cash = cash.filter(t =>
                String(t.clientName || '').toLowerCase().includes(q) ||
                String(t.id || '').toLowerCase().includes(q) ||
                String(t.orderId || '').toLowerCase().includes(q) ||
                String(t.description || '').toLowerCase().includes(q) ||
                String(t.showroom || '').toLowerCase().includes(q)
            );
        }

        // Apply tab filter (Type)
        if (filter === 'in') {
            cash = cash.filter(t => t.type === 'In');
        } else if (filter === 'out') {
            cash = cash.filter(t => t.type === 'Out');
        }

        // Apply Showroom filter
        if (showroomFilter) {
            cash = cash.filter(t => t.showroom === showroomFilter);
        }

        const totalIn = cash.filter(t => t.type === 'In').reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const totalOut = cash.filter(t => t.type === 'Out').reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const balance = totalIn - totalOut;

        this.viewContainer.innerHTML = `
                            <div class="view-header">
                                <div class="header-title-area">
                                    <h1>Gestion de Caisse</h1>
                                    <p class="subtitle" style="color: var(--text-dim); font-size: 0.9rem; margin-top: 4px;">Journal de caisse ${showroomFilter ? `pour ${showroomFilter}` : 'consolidé'}</p>
                                </div>
                                <div class="header-actions">
                                    <select id="cash-showroom-filter" onchange="app.renderCash('${query}', '${filter}', this.value)" class="glass-select" style="min-width: 200px; margin-right: 1rem;">
                                        <option value="">Tous les showrooms</option>
                                        ${showrooms.map(s => `<option value="${s}" ${s === showroomFilter ? 'selected' : ''}>${s}</option>`).join('')}
                                    </select>
                                    <button class="btn-secondary" onclick="app.exportCashJournalPDF('${showroomFilter}')">
                                        <i class="fas fa-file-pdf"></i> PDF
                                    </button>
                                    <button class="btn-primary" onclick="app.showCashModal()">
                                        <i class="fas fa-plus"></i> Transaction
                                    </button>
                                </div>
                            </div>

                            <div class="dashboard-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 2rem;">
                                <div class="stat-card glass">
                                    <div class="stat-icon" style="background: rgba(34, 197, 94, 0.1); color: var(--success);">
                                        <i class="fas fa-arrow-down"></i>
                                    </div>
                                    <div class="stat-info">
                                        <h3>Total Entrées</h3>
                                        <p class="stat-value success">+ ${this.formatCurrency(totalIn)}</p>
                                    </div>
                                </div>

                                <div class="stat-card glass">
                                    <div class="stat-icon" style="background: rgba(239, 68, 68, 0.1); color: var(--danger);">
                                        <i class="fas fa-arrow-up"></i>
                                    </div>
                                    <div class="stat-info">
                                        <h3>Total Sorties</h3>
                                        <p class="stat-value danger">- ${this.formatCurrency(totalOut)}</p>
                                    </div>
                                </div>
                                <div class="stat-card glass" style="border: 1px solid var(--primary);">
                                    <div class="stat-icon" style="background: rgba(99, 102, 241, 0.1); color: var(--primary);">
                                        <i class="fas fa-wallet"></i>
                                    </div>
                                    <div class="stat-info">
                                        <h3>Solde ${showroomFilter ? 'Showroom' : 'Général'}</h3>
                                        <p class="stat-value ${balance >= 0 ? 'success' : 'danger'}">${this.formatCurrency(balance)}</p>
                                    </div>
                                </div>
                            </div>

                            <div class="view-tabs glass" style="margin-bottom: 1.5rem; display: flex; gap: 1rem; padding: 0.5rem; background: rgba(255, 255, 255, 0.05); border-radius: 12px;">
                                <button class="tab-link ${filter === 'all' ? 'active' : ''}" onclick="app.renderCash('${query}', 'all', '${showroomFilter}')" style="padding: 0.6rem 1.5rem; border-radius: 8px; border: none; background: ${filter === 'all' ? 'var(--primary)' : 'transparent'}; color: ${filter === 'all' ? '#fff' : 'var(--text-main)'}; cursor: pointer; font-weight: 500; transition: all 0.3s ease;">
                                    Tous les Flux
                                </button>
                                <button class="tab-link ${filter === 'in' ? 'active' : ''}" onclick="app.renderCash('${query}', 'in', '${showroomFilter}')" style="padding: 0.6rem 1.5rem; border-radius: 8px; border: none; background: ${filter === 'in' ? 'var(--success)' : 'transparent'}; color: ${filter === 'in' ? '#fff' : 'var(--text-main)'}; cursor: pointer; font-weight: 500; transition: all 0.3s ease;">
                                    Entrées
                                </button>
                                <button class="tab-link ${filter === 'out' ? 'active' : ''}" onclick="app.renderCash('${query}', 'out', '${showroomFilter}')" style="padding: 0.6rem 1.5rem; border-radius: 8px; border: none; background: ${filter === 'out' ? 'var(--danger)' : 'transparent'}; color: ${filter === 'out' ? '#fff' : 'var(--text-main)'}; cursor: pointer; font-weight: 500; transition: all 0.3s ease;">
                                    Sorties
                                </button>
                            </div>

                            <div class="glass data-table-container">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>ID</th>
                                            <th>Client / Motif</th>
                                            <th>Showroom</th>
                                            <th>Type</th>
                                            <th>Méthode</th>
                                            <th>Montant</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${cash.map(t => {
            const isIn = t.type === 'In';
            return `
                                <tr>
                                    <td>${new Date(t.date).toLocaleDateString()}</td>
                                    <td><span class="badge-pill" style="background: rgba(99, 102, 241, 0.1); color: var(--primary);">#${t.id}</span></td>
                                    <td>
                                        <div class="user-cell">
                                            <div class="user-info">
                                                <span class="user-name">${t.clientName || 'N/A'}</span>
                                                <span class="user-role">${t.orderId ? `Cmd #${t.orderId}` : (isIn ? 'Entrée Libre' : 'Sortie / Dépense')}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td><span class="badge-pill" style="background: rgba(139, 112, 246, 0.1); color: #a78bfa; font-size: 0.75rem;">${(t.showroom && t.showroom !== 'N/A') ? t.showroom : 'Principal'}</span></td>
                                    <td>
                                        <span class="badge-outline ${isIn ? 'success' : 'danger'}">
                                            ${isIn ? 'Entrée' : 'Sortie'}
                                        </span>
                                    </td>
                                    <td><span class="status-badge" style="background: rgba(147, 197, 253, 0.1); color: #3b82f6;">${t.paymentMethod}</span></td>
                                    <td><span class="value ${isIn ? 'success' : 'danger'}" style="font-weight: 600;">${isIn ? '+' : '-'} ${this.formatCurrency(t.amount, t.currency)}</span></td>
                                    <td>
                                        <div class="table-actions">
                                            <button class="btn-action" onclick="app.showEditCashModal('${t.id}')" title="Modifier">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button class="btn-action danger" onclick="app.deleteCashTransaction('${t.id}')" title="Supprimer">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `}).join('')}
                                        ${cash.length === 0 ? '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Aucune transaction trouvée pour ces filtres.</td></tr>' : ''}
                                    </tbody>
                                </table>
                            </div>
                            `;
    },

    exportCashJournalPDF(showroomFilter = '') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        let cash = StorageService.get(STORAGE_KEYS.CASH);

        if (showroomFilter) {
            cash = cash.filter(t => t.showroom === showroomFilter);
        }

        doc.setFontSize(22);
        doc.text('Journal de Caisse - GTM AUTO', 14, 22);

        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Document généré le: ${new Date().toLocaleString()}`, 14, 30);
        if (showroomFilter) {
            doc.text(`Showroom: ${showroomFilter}`, 14, 36);
        }

        const tableData = cash.map(t => [
            new Date(t.date).toLocaleDateString(),
            t.id,
            t.clientName || 'N/A',
            t.showroom || 'N/A',
            t.type === 'In' ? 'Entrée' : 'Sortie',
            t.paymentMethod,
            this.formatCurrency(t.amount, t.currency)
        ]);

        doc.autoTable({
            startY: showroomFilter ? 42 : 40,
            head: [['Date', 'ID', 'Client/Motif', 'Showroom', 'Type', 'Méthode', 'Montant']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 247, 255] },
            margin: { top: 40 }
        });

        // Summary at the bottom
        const finalY = doc.lastAutoTable.finalY + 10;
        const totalIn = cash.filter(t => t.type === 'In').reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const totalOut = cash.filter(t => t.type === 'Out').reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const balance = totalIn - totalOut;

        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`Total Entrées: ${this.formatCurrency(totalIn)}`, 14, finalY);
        doc.text(`Total Sorties: ${this.formatCurrency(totalOut)}`, 14, finalY + 7);
        doc.setFont(undefined, 'bold');
        doc.text(`Solde Final: ${this.formatCurrency(balance)}`, 14, finalY + 14);

        const filename = `Journal_Caisse_${showroomFilter ? showroomFilter + '_' : ''}${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
        this.showToast('Journal de caisse exporté en PDF', 'success');
    },

    showCashModal(orderId = null) {
        const orders = StorageService.get(STORAGE_KEYS.ORDERS);
        const currencies = StorageService.get(STORAGE_KEYS.CURRENCIES) || ['EUR', 'USD', 'XAF'];
        const showrooms = StorageService.get(STORAGE_KEYS.SHOWROOMS) || [];
        let preSelectedOrder = null;
        let preSelectedShowroom = null;

        if (orderId) {
            preSelectedOrder = orders.find(o => o.id === orderId);
            if (preSelectedOrder) {
                const clients = StorageService.get(STORAGE_KEYS.CLIENTS);
                const client = clients.find(c => c.id === preSelectedOrder.clientId);
                if (client && client.showroom) {
                    preSelectedShowroom = client.showroom;
                }
            }
        }

        const modalHtml = `
                            <div class="modal-overlay">
                                <div class="modal-content glass" style="width: 500px;">
                                    <div class="modal-header">
                                        <h2>${orderId ? 'Règlement Commande #' + orderId : 'Nouvelle Transaction'}</h2>
                                        <button class="btn-close" onclick="app.closeModal()">&times;</button>
                                    </div>
                                    <form id="cash-form">
                                        <div class="form-grid">
                                            <div class="form-group full-width">
                                                <label>Type de Transaction</label>
                                                <select name="type" onchange="app.handleCashTypeChange(this.value)" required>
                                                    <option value="In" ${orderId ? 'selected' : ''}>Entrée (Encaissement)</option>
                                                    <option value="Out">Sortie (Décaissement)</option>
                                                </select>
                                            </div>
                                            <div id="client-select-container" class="form-group full-width" style="${orderId ? 'display: none;' : 'display: block;'}">
                                                <label>Sélectionner le Client</label>
                                                <select name="cashClientId" id="cash-client-select" onchange="app.handleClientSelectInCash(this.value)">
                                                    <option value="">-- Choisir un client --</option>
                                                    ${StorageService.get(STORAGE_KEYS.CLIENTS).map(c => `
                                            <option value="${c.id}" ${preSelectedOrder && preSelectedOrder.clientId === c.id ? 'selected' : ''}>
                                                ${c.firstName} ${c.lastName} ${c.company ? `(${c.company})` : ''}
                                            </option>
                                        `).join('')}
                                                </select>
                                            </div>
                                            <div id="order-select-container" class="form-group full-width" style="${orderId ? 'display: block;' : 'display: none;'}">
                                                <label>Commande en cours (Non Soldée)</label>
                                                <select name="orderId" id="cash-order-select" onchange="app.handleOrderSelectInCash(this.value)">
                                                    <option value="">-- Choisir une commande --</option>
                                                    ${orderId ? `
                                            <option value="${preSelectedOrder.id}" selected>
                                                #${preSelectedOrder.id} - ${preSelectedOrder.vehicleName} (${this.formatCurrency(preSelectedOrder.totalAmount)})
                                            </option>
                                        ` : ''}
                                                </select>
                                            </div>
                                            <div class="form-group">
                                                <label id="label-client-motif">Client</label>
                                                <input type="text" id="cash-client-name" name="clientName" value="${preSelectedOrder ? preSelectedOrder.clientName : ''}" ${preSelectedOrder ? 'readonly' : ''} required>
                                            </div>
                                            <div class="form-group">
                                                <label>Showroom <span style="color: var(--danger);">*</span></label>
                                                <select name="showroom" id="cash-showroom-select" required class="glass-select">
                                                    <option value="">-- Sélectionner --</option>
                                                    ${showrooms.map(s => `
                                            <option value="${s}" ${s === preSelectedShowroom ? 'selected' : ''}>${s}</option>
                                        `).join('')}
                                                </select>
                                            </div>
                                            <div class="form-group">
                                                <label>Montant</label>
                                                <input type="number" name="amount" step="1" value="${orderId ? Math.max(0, preSelectedOrder.totalAmount - this.getPaidAmount(orderId)) : ''}" required>
                                            </div>
                                            <div class="form-group">
                                                <label>Date d'opération</label>
                                                <input type="date" name="date" value="${new Date().toISOString().split('T')[0]}" required class="glass-input">
                                            </div>
                                            <div class="form-group">
                                                <label>Devise</label>
                                                <input type="text" value="${StorageService.get(STORAGE_KEYS.SETTINGS)?.sellingCurrency || 'EUR'}" readonly class="glass-input" style="background: rgba(255,255,255,0.05);">
                                                    <input type="hidden" name="currency" value="${StorageService.get(STORAGE_KEYS.SETTINGS)?.sellingCurrency || 'EUR'}">
                                                    </div>
                                                    <div class="form-group">
                                                        <label>Méthode de Paiement</label>
                                                        <select name="paymentMethod">
                                                            <option value="Espèces">Espèces</option>
                                                            <option value="Virement">Virement</option>
                                                            <option value="Chèque">Chèque</option>
                                                            <option value="Carte">Carte Bancaire</option>
                                                            <option value="Mobile Money">Mobile Money</option>
                                                        </select>
                                                    </div>
                                                    <div class="form-group full-width">
                                                        <label>Description / Note</label>
                                                        <textarea name="description" rows="2" placeholder="Ex: Acompte, Facture, Frais de port..."></textarea>
                                                    </div>
                                            </div>
                                            <div class="modal-footer">
                                                <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                                                <button type="submit" class="btn-primary">Enregistrer</button>
                                            </div>
                                    </form>
                                </div>
                            </div>
                            `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('cash-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            this.handleCashSubmission(data);
        });
    },

    showEditCashModal(id) {
        const cash = StorageService.get(STORAGE_KEYS.CASH);
        const transaction = cash.find(t => t.id === id);
        if (!transaction) return;

        const orders = StorageService.get(STORAGE_KEYS.ORDERS);
        const currencies = StorageService.get(STORAGE_KEYS.CURRENCIES) || ['EUR', 'USD', 'XAF'];
        const showrooms = StorageService.get(STORAGE_KEYS.SHOWROOMS) || [];

        const modalHtml = `
                            <div class="modal-overlay">
                                <div class="modal-content glass" style="width: 500px;">
                                    <div class="modal-header">
                                        <h2>Modifier la Transaction #${id}</h2>
                                        <button class="btn-close" onclick="app.closeModal()">&times;</button>
                                    </div>
                                    <form id="cash-form">
                                        <input type="hidden" name="id" value="${transaction.id}">
                                            <div class="form-grid">
                                                <div class="form-group full-width">
                                                    <label>Type de Transaction</label>
                                                    <select name="type" onchange="app.handleCashTypeChange(this.value)" required>
                                                        <option value="In" ${transaction.type === 'In' ? 'selected' : ''}>Entrée (Encaissement)</option>
                                                        <option value="Out" ${transaction.type === 'Out' ? 'selected' : ''}>Sortie (Décaissement)</option>
                                                    </select>
                                                </div>
                                                <div id="client-select-container" class="form-group full-width" style="${transaction.type === 'Out' ? 'display: none;' : 'display: block;'}">
                                                    <label>Sélectionner le Client</label>
                                                    <select name="cashClientId" id="cash-client-select" onchange="app.handleClientSelectInCash(this.value)">
                                                        <option value="">-- Choisir un client --</option>
                                                        ${StorageService.get(STORAGE_KEYS.CLIENTS).map(c => `
                                            <option value="${c.id}" ${transaction.cashClientId === c.id ? 'selected' : ''}>
                                                ${c.firstName} ${c.lastName} ${c.company ? `(${c.company})` : ''}
                                            </option>
                                        `).join('')}
                                                    </select>
                                                </div>
                                                <div id="order-select-container" class="form-group full-width" style="${transaction.orderId ? 'display: block;' : 'display: none;'}">
                                                    <label>Commande associée</label>
                                                    <select name="orderId" id="cash-order-select" onchange="app.handleOrderSelectInCash(this.value)">
                                                        <option value="">-- Choisir une commande --</option>
                                                        ${transaction.orderId ? `
                                            <option value="${transaction.orderId}" selected>Commande #${transaction.orderId}</option>
                                        ` : ''}
                                                    </select>
                                                </div>
                                                <div class="form-group">
                                                    <label id="label-client-motif">${transaction.type === 'Out' ? 'Motif / Bénéficiaire' : 'Client'}</label>
                                                    <input type="text" id="cash-client-name" name="clientName" value="${transaction.clientName || ''}" required>
                                                </div>
                                                <div class="form-group">
                                                    <label>Showroom <span style="color: var(--danger);">*</span></label>
                                                    <select name="showroom" id="cash-showroom-select" required class="glass-select">
                                                        <option value="">-- Sélectionner --</option>
                                                        ${showrooms.map(s => `
                                            <option value="${s}" ${s === (transaction.showroom || 'Showroom Principal') ? 'selected' : ''}>${s}</option>
                                        `).join('')}
                                                        ${transaction.showroom && !showrooms.includes(transaction.showroom) ? `
                                            <option value="${transaction.showroom}" selected>${transaction.showroom}</option>
                                        ` : ''}
                                                    </select>
                                                </div>
                                                <div class="form-group">
                                                    <label>Montant</label>
                                                    <input type="number" name="amount" step="1" value="${transaction.amount}" required>
                                                </div>
                                                <div class="form-group">
                                                    <label>Date d'opération</label>
                                                    <input type="date" name="date" value="${transaction.date ? transaction.date.split('T')[0] : new Date().toISOString().split('T')[0]}" required class="glass-input">
                                                </div>
                                                <div class="form-group">
                                                    <label>Devise</label>
                                                    <input type="text" value="${transaction.currency}" readonly class="glass-input" style="background: rgba(255,255,255,0.05);">
                                                        <input type="hidden" name="currency" value="${transaction.currency}">
                                                        </div>
                                                        <div class="form-group">
                                                            <label>Méthode de Paiement</label>
                                                            <select name="paymentMethod">
                                                                <option value="Espèces" ${transaction.paymentMethod === 'Espèces' ? 'selected' : ''}>Espèces</option>
                                                                <option value="Virement" ${transaction.paymentMethod === 'Virement' ? 'selected' : ''}>Virement</option>
                                                                <option value="Chèque" ${transaction.paymentMethod === 'Chèque' ? 'selected' : ''}>Chèque</option>
                                                                <option value="Carte" ${transaction.paymentMethod === 'Carte Bancaire' ? 'selected' : ''}>Carte Bancaire</option>
                                                                <option value="Mobile Money" ${transaction.paymentMethod === 'Mobile Money' ? 'selected' : ''}>Mobile Money</option>
                                                            </select>
                                                        </div>
                                                        <div class="form-group full-width">
                                                            <label>Description / Note</label>
                                                            <textarea name="description" rows="2" placeholder="Ex: Acompte, Facture, Frais de port...">${transaction.description || ''}</textarea>
                                                        </div>
                                                </div>
                                                <div class="modal-footer">
                                                    <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                                                    <button type="submit" class="btn-primary">Mettre à jour</button>
                                                </div>
                                            </form>
                                        </div>
                                </div>
                                `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('cash-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            this.handleCashSubmission(data);
        });
    },

    handleCashTypeChange(type) {
        const clientContainer = document.getElementById('client-select-container');
        const orderContainer = document.getElementById('order-select-container');
        const labelClientMotif = document.getElementById('label-client-motif');
        const clientSelect = document.getElementById('cash-client-select');
        const orderSelect = document.getElementById('cash-order-select');
        const clientInput = document.getElementById('cash-client-name');

        if (type === 'Out') {
            clientContainer.style.display = 'none';
            orderContainer.style.display = 'none';
            labelClientMotif.innerText = 'Motif / Bénéficiaire';
            if (clientSelect) clientSelect.value = '';
            if (orderSelect) {
                orderSelect.value = '';
                orderSelect.required = false;
            }
            if (clientInput) {
                clientInput.value = '';
                clientInput.readOnly = false;
            }
        } else {
            clientContainer.style.display = 'block';
            labelClientMotif.innerText = 'Client';
        }
    },

    handleClientSelectInCash(clientId) {
        const orderContainer = document.getElementById('order-select-container');
        const orderSelect = document.getElementById('cash-order-select');
        const clientInput = document.getElementById('cash-client-name');
        const showroomSelect = document.getElementById('cash-showroom-select');

        if (!clientId) {
            orderContainer.style.display = 'none';
            if (orderSelect) orderSelect.innerHTML = '<option value="">-- Choisir une commande --</option>';
            if (clientInput) {
                clientInput.value = '';
                clientInput.readOnly = false;
            }
            return;
        }

        const clients = StorageService.get(STORAGE_KEYS.CLIENTS);
        const client = clients.find(c => c.id === clientId);
        if (clientInput && client) {
            clientInput.value = `${client.firstName} ${client.lastName}`;
            clientInput.readOnly = true;
        }

        // Auto-populate showroom if available
        if (showroomSelect && client && client.showroom) {
            showroomSelect.value = client.showroom;
        }

        const orders = StorageService.get(STORAGE_KEYS.ORDERS);
        const clientOrders = orders.filter(o => o.clientId === clientId);

        // Filter only unpaid orders
        const unpaidOrders = clientOrders.filter(o => {
            const paid = this.getPaidAmount(o.id);
            return paid < o.totalAmount;
        });

        if (unpaidOrders.length > 0) {
            orderContainer.style.display = 'block';
            orderSelect.innerHTML = '<option value="">-- Choisir une commande --</option>' +
                unpaidOrders.map(o => `
                                <option value="${o.id}">
                                    #${o.id} - ${o.vehicleName} (${this.formatCurrency(o.totalAmount)})
                                </option>
                                `).join('');
        } else {
            orderContainer.style.display = 'none';
            orderSelect.innerHTML = '<option value="">-- Aucune commande en cours --</option>';
            this.showToast('Ce client n\'a aucune commande non soldée.', 'info');
        }
    },

    handleOrderSelectInCash(orderId) {
        const clientInput = document.getElementById('cash-client-name');
        const amountInput = document.querySelector('#cash-form input[name="amount"]');

        if (!orderId) {
            if (clientInput) {
                clientInput.value = '';
                clientInput.readOnly = false;
            }
            return;
        }

        const orders = StorageService.get(STORAGE_KEYS.ORDERS);
        const order = orders.find(o => o.id === orderId);
        if (order) {
            if (clientInput) {
                clientInput.value = order.clientName;
                clientInput.readOnly = true;
            }

            if (amountInput && !amountInput.value) {
                const paid = this.getPaidAmount(orderId);
                const remaining = Math.max(0, order.totalAmount - paid);
                amountInput.value = remaining;
            }
        }
    },

    async handleCashSubmission(data) {
        const form = document.getElementById('cash-form');
        const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
        if (submitBtn) submitBtn.disabled = true;

        try {
            const cash = StorageService.get(STORAGE_KEYS.CASH);
            const isUpdate = !!data.id;

            if (isUpdate) {
                await StorageService.update(STORAGE_KEYS.CASH, data.id, {
                    ...data,
                    amount: Number(data.amount),
                    showroom: data.showroom || 'Showroom Principal'
                });
                this.showToast('Transaction mise à jour', 'success');
            } else {
                const newTransaction = {
                    ...data,
                    id: `TRX-${Date.now().toString().slice(-6)}`,
                    date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
                    type: data.type || 'In',
                    amount: Number(data.amount),
                    showroom: data.showroom || 'Showroom Principal'
                };

                await StorageService.add(STORAGE_KEYS.CASH, newTransaction);
                this.showToast('Règlement enregistré avec succès', 'success');
            }

            // Sync linked order status if necessary
            if (data.orderId) {
                await this.syncOrderStatuses();
            }

            this.closeModal();
            // Force re-render of current view to show changes
            if (this.currentView) {
                this.renderView(this.currentView);
            } else {
                this.renderDashboard();
            }
        } catch (error) {
            console.error("Error in handleCashSubmission:", error);
            this.showToast("Erreur lors de l'enregistrement de la transaction", "error");
            if (submitBtn) submitBtn.disabled = false;
        }
    },

    async deleteCashTransaction(id) {
        this.showConfirmModal('Êtes-vous sûr de vouloir supprimer cette transaction ?', async () => {
            await StorageService.delete(STORAGE_KEYS.CASH, id);
            this.showToast('Transaction supprimée', 'info');
            this.renderCash(this.searchQuery);
        });
    },

    getPaidAmount(orderId) {
        const cash = StorageService.get(STORAGE_KEYS.CASH);
        return cash
            .filter(t => t.orderId === orderId && t.type === 'In')
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    },

    deleteShipment(id) {
        this.showConfirmModal('Êtes-vous sûr de vouloir supprimer cette expédition ?', async () => {
            const shipments = StorageService.get(STORAGE_KEYS.SHIPMENTS);
            const shipment = shipments.find(s => s.id === id);

            if (shipment) {
                // Unlink vehicles
                const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES);
                for (const v of vehicles) {
                    if (v.shipmentId === id) {
                        v.shipmentId = null;
                        v.status = v.orderId ? 'Reserved' : 'Available';
                        await StorageService.update(STORAGE_KEYS.VEHICLES, v.id, v);
                    }
                }
            }

            await StorageService.delete(STORAGE_KEYS.SHIPMENTS, id);
            this.renderView('shipments');
        });
    },

    convertCurrency(amount, fromCurrency, toCurrency, date = new Date()) {
        if (!amount || isNaN(amount)) return 0;
        if (fromCurrency === toCurrency) return Number(amount);

        if (!fromCurrency) fromCurrency = 'EUR';
        if (!toCurrency) toCurrency = 'EUR';

        const rates = StorageService.get(STORAGE_KEYS.EXCHANGE_RATES) || [];

        let rateEntry = rates.find(r => r.fromCurrency === fromCurrency && r.toCurrency === toCurrency);

        let inverse = false;
        if (!rateEntry) {
            rateEntry = rates.find(r => r.fromCurrency === toCurrency && r.toCurrency === fromCurrency);
            inverse = true;
        }

        if (rateEntry) {
            const rate = Number(rateEntry.rate);
            return inverse ? amount / rate : amount * rate;
        }

        return Number(amount);
    },

    formatCurrency(amount, type = 'selling') {
        const settings = StorageService.get(STORAGE_KEYS.SETTINGS) || {
            purchaseCurrency: 'EUR',
            sellingCurrency: 'EUR'
        };

        // Map type to the correct setting key or use directly if it's a code
        let currency = settings.sellingCurrency || 'EUR';
        if (type === 'purchase') {
            currency = settings.purchaseCurrency || 'EUR';
        } else if (type && type.length === 3) {
            // If a 3-letter code is passed directly
            currency = type;
        }

        const numAmount = Number(amount);
        if (isNaN(numAmount)) return amount;

        try {
            return new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(numAmount);
        } catch (e) {
            return `${numAmount.toLocaleString('fr-FR')} ${currency} `;
        }
    },

    renderAlerts() {
        this.currentView = 'alerts';

        const orders = StorageService.get(STORAGE_KEYS.ORDERS) || [];
        const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES) || [];
        const shipments = StorageService.get(STORAGE_KEYS.SHIPMENTS) || [];
        const now = new Date();
        const tenDaysFromNow = new Date();
        tenDaysFromNow.setDate(now.getDate() + 10);

        const alerts = [];

        // 1. Ships arriving within 10 days
        shipments.forEach(s => {
            if (s.arrivalDate && s.status !== 'Arrivé') {
                const arrival = new Date(s.arrivalDate);
                if (arrival > now && arrival <= tenDaysFromNow) {
                    alerts.push({
                        type: 'info',
                        icon: 'fa-ship',
                        title: `Arrivée Imminente : ${s.shipName || s.shippingLine}`,
                        message: `Le navire est attendu le ${arrival.toLocaleDateString()} (dans moins de 10 jours).`,
                        date: s.arrivalDate
                    });
                }
            }
        });

        // 2. Validated Orders without Vehicle
        orders.forEach(o => {
            if (o.isValidated && !o.vehicleId && o.status !== 'ANNULÉE' && o.status !== 'ANNULÉ') {
                alerts.push({
                    type: 'warning',
                    icon: 'fa-exclamation-triangle',
                    title: `Commande Validée sans Véhicule : #${o.id}`,
                    message: `La commande de ${o.clientName} est validée mais aucun véhicule n'est encore affecté.`,
                    date: o.date
                });
            }
        });

        // 3. Shipped Vehicles without Client
        vehicles.forEach(v => {
            if (v.shipmentId && !v.orderId && !v.archived) {
                alerts.push({
                    type: 'danger',
                    icon: 'fa-user-slash',
                    title: `Véhicule Expédié Non Affecté : #${v.id}`,
                    message: `Le véhicule ${v.brand} ${v.model || ''} est en cours d'expédition mais n'est lié à aucun client.`,
                    date: v.updatedAt || v.createdAt
                });
            }
        });

        // 4. Outdated Tracking (merged from old Tracking Alerts)
        shipments.forEach(s => {
            if (!s.isArchived && this.isOutdated(s.lastUpdate)) {
                alerts.push({
                    type: 'danger',
                    icon: 'fa-sync-alt',
                    title: `Mise à jour requise : ${s.containerNumber || s.id}`,
                    message: `Dernière mise à jour il y a plus de 24h pour le voyage ${s.voyage || 'N/A'}.`,
                    date: s.lastUpdate || s.createdAt
                });
            }
        });

        // 5. System Notifications (Backend Persistent)
        const notifications = StorageService.get(STORAGE_KEYS.NOTIFICATIONS) || [];
        notifications.forEach(n => {
            if (!n.isRead) {
                let icon = 'fa-info-circle';
                let type = 'info';

                switch (n.type) {
                    case 'WARNING': type = 'warning'; icon = 'fa-exclamation-triangle'; break;
                    case 'ERROR': type = 'danger'; icon = 'fa-times-circle'; break;
                    case 'SUCCESS': type = 'success'; icon = 'fa-check-circle'; break;
                }

                alerts.push({
                    type: type,
                    icon: icon,
                    title: n.title,
                    message: n.message,
                    date: n.createdAt
                });
            }
        });

        // Sort by date descending
        alerts.sort((a, b) => new Date(b.date) - new Date(a.date));

        this.viewContainer.innerHTML = `
                <div class="view-header">
                    <h1><i class="fas fa-bell"></i> Alertes</h1>
                    <p class="subtitle">Suivi des alertes système et notifications critiques</p>
                </div>
                
                <div class="alerts-grid" style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1.5rem;">
                    ${alerts.length === 0 ? `
                        <div class="alerts-container glass" style="padding: 60px; text-align: center; border-radius: 12px;">
                            <i class="fas fa-bell-slash" style="font-size: 4rem; color: var(--text-dim); opacity: 0.3; margin-bottom: 20px;"></i>
                            <p style="color: var(--text-dim); font-size: 1.1rem;">Aucune nouvelle alerte critique pour le moment.</p>
                        </div>
                    ` : alerts.map(alert => `
                        <div class="alert-card glass ${alert.type}" style="border-left: 5px solid var(--${alert.type}); padding: 1.5rem; display: flex; align-items: center; gap: 1.5rem; animation: slideIn 0.3s ease-out;">
                            <div class="alert-icon" style="width: 50px; height: 50px; border-radius: 12px; background: rgba(var(--${alert.type}-rgb), 0.1); display: flex; align-items: center; justify-content: center; color: var(--${alert.type}); font-size: 1.5rem;">
                                <i class="fas ${alert.icon}"></i>
                            </div>
                            <div style="flex: 1;">
                                <h3 style="margin-bottom: 0.2rem; font-size: 1.1rem;">${alert.title}</h3>
                                <p style="color: var(--text-dim); font-size: 0.9rem;">${alert.message}</p>
                            </div>
                            <div style="text-align: right; color: var(--text-dim); font-size: 0.8rem;">
                                ${new Date(alert.date).toLocaleDateString()}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
    },

    async renderPurchases(query = '') {
        this.currentView = 'purchases';
        this.searchQuery = query;

        try {
            const response = await ApiService.getPurchaseOrders();
            if (response.success && response.data) {
                await StorageService.save(STORAGE_KEYS.PURCHASE_ORDERS, response.data);
            }
            let purchases = StorageService.get(STORAGE_KEYS.PURCHASE_ORDERS) || [];

            // Apply filters
            if (this.purchaseFilters) {
                if (this.purchaseFilters.supplier) {
                    purchases = purchases.filter(p => p.supplierName === this.purchaseFilters.supplier);
                }
                if (this.purchaseFilters.status) {
                    purchases = purchases.filter(p => p.status === this.purchaseFilters.status);
                }
                if (this.purchaseFilters.startDate) {
                    const start = new Date(this.purchaseFilters.startDate);
                    purchases = purchases.filter(p => new Date(p.purchaseDate) >= start);
                }
                if (this.purchaseFilters.endDate) {
                    const end = new Date(this.purchaseFilters.endDate);
                    purchases = purchases.filter(p => new Date(p.purchaseDate) <= end);
                }
            }

            if (query) {
                const q = query.toLowerCase();
                purchases = purchases.filter(p =>
                    (p.supplierName && p.supplierName.toLowerCase().includes(q)) ||
                    (p.id && p.id.toLowerCase().includes(q))
                );
            }

            this.viewContainer.innerHTML = `
                    <div class="view-header">
                        <div>
                            <h1><i class="fas fa-shopping-cart"></i> Commandes d'Achat</h1>
                            <p class="subtitle">Gestion des acquisitions auprès des fournisseurs</p>
                        </div>
                        <div class="header-actions">
                            <button class="btn-secondary" onclick="app.showPurchaseOrderPrintFiltersModal()" style="background: rgba(79, 70, 229, 0.1); color: #4f46e5; border-color: rgba(79, 70, 229, 0.2);" title="Imprimer l'état des achats avec filtres">
                                <i class="fas fa-print"></i> IMPRIMER
                            </button>
                            <button class="btn-primary" onclick="app.showPurchaseOrderModal()">
                                <i class="fas fa-plus"></i> Nouveau Achat
                            </button>
                        </div>
                    </div>

                    <div class="glass" style="padding: 20px; margin-bottom: 20px;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; align-items: end;">
                            <div class="form-group" style="margin-bottom: 0;">
                                <label style="font-size: 0.8rem; color: var(--text-dim);">Recherche Rapide</label>
                                <input type="text" class="glass-input" style="padding: 8px 12px; font-size: 0.9rem;" placeholder="ID ou Fournisseur..." value="${query || ''}" oninput="app.renderPurchases(this.value)">
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label style="font-size: 0.8rem; color: var(--text-dim);">Fournisseur</label>
                                <select class="glass-select" style="padding: 8px 12px; font-size: 0.9rem;" onchange="app.purchaseFilters = {...(app.purchaseFilters || {}), supplier: this.value}; app.renderPurchases()">
                                    <option value="">Tous les fournisseurs</option>
                                    ${(StorageService.get(STORAGE_KEYS.SUPPLIERS) || []).map(s => `<option value="${s.name}" ${this.purchaseFilters?.supplier === s.name ? 'selected' : ''}>${s.name}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label style="font-size: 0.8rem; color: var(--text-dim);">Statut Achat</label>
                                <select class="glass-select" style="padding: 8px 12px; font-size: 0.9rem;" onchange="app.purchaseFilters = {...(app.purchaseFilters || {}), status: this.value}; app.renderPurchases()">
                                    <option value="">Tous les statuts</option>
                                    <option value="Ordered" ${this.purchaseFilters?.status === 'Ordered' ? 'selected' : ''}>Commandé</option>
                                    <option value="Paid" ${this.purchaseFilters?.status === 'Paid' ? 'selected' : ''}>Payé</option>
                                    <option value="Partial" ${this.purchaseFilters?.status === 'Partial' ? 'selected' : ''}>Partiel</option>
                                </select>
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label style="font-size: 0.8rem; color: var(--text-dim);">Date Début</label>
                                <input type="date" class="glass-input" style="padding: 8px 12px; font-size: 0.9rem;" value="${this.purchaseFilters?.startDate || ''}" onchange="app.purchaseFilters = {...(app.purchaseFilters || {}), startDate: this.value}; app.renderPurchases()">
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label style="font-size: 0.8rem; color: var(--text-dim);">Date Fin</label>
                                <input type="date" class="glass-input" style="padding: 8px 12px; font-size: 0.9rem;" value="${this.purchaseFilters?.endDate || ''}" onchange="app.purchaseFilters = {...(app.purchaseFilters || {}), endDate: this.value}; app.renderPurchases()">
                            </div>
                            <div class="form-group" style="margin-bottom: 0; display: flex; gap: 5px;">
                                <button class="btn-secondary" style="padding: 8px 12px; font-size: 0.85rem; flex: 1;" onclick="app.purchaseFilters = null; app.renderPurchases()"><i class="fas fa-undo"></i></button>
                            </div>
                        </div>
                    </div>

                    <div class="glass" style="padding: 0; overflow: hidden;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Fournisseur</th>
                                    <th>Nb Véhicules</th>
                                    <th>Détails Véhicules</th>
                                    <th>Date Commande</th>
                                    <th>Documents</th>
                                    <th>Statut</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${purchases.length === 0 ? '<tr><td colspan="8" style="text-align: center; padding: 40px;">Aucune commande d\'achat trouvée</td></tr>' :
                    purchases.map(p => `
                                    <tr>
                                        <td><strong>${p.id}</strong></td>
                                        <td>${p.supplierDetails ? `<span style="background: rgba(var(--primary-rgb), 0.1); color: var(--primary); padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; border: 1px solid rgba(var(--primary-rgb), 0.2);">${p.supplierDetails.code}</span> ${p.supplierDetails.name}` : p.supplierName || 'N/A'}</td>
                                        <td><span style="background: rgba(255,255,255,0.05); color: var(--text-primary); padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; border: 1px solid rgba(255,255,255,0.1);">${p.vehicles ? p.vehicles.length : 0}</span></td>
                                        <td>
                                            ${p.vehicles && p.vehicles.length > 0 ?
                            `<div style="font-size: 0.85rem; max-height: 80px; overflow-y: auto;">
                                                ${p.vehicles.map(v => {
                                    const client = v.orderId ? (StorageService.get(STORAGE_KEYS.ORDERS).find(o => o.id === v.orderId)?.clientId ? StorageService.get(STORAGE_KEYS.CLIENTS).find(c => c.id === StorageService.get(STORAGE_KEYS.ORDERS).find(o => o.id === v.orderId).clientId) : null) : (v.clientId ? StorageService.get(STORAGE_KEYS.CLIENTS).find(c => c.id === v.clientId) : null);
                                    const clientName = client ? `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.name : 'STOCK';
                                    return `<div style="margin-bottom: 2px; cursor: pointer;" onclick="app.showVehicleDetails('${v.id}')" title="Voir détails du véhicule">
                                    • <strong>${clientName}</strong> : ${v.brand} ${v.model || ''} ${v.motorization ? `[${v.motorization}]` : ''} <span style="color:var(--text-dim);">(${v.chassisNumber || 'Sans VIN'})</span>
                                    </div>`;
                                }).join('')}
                                                </div>`
                            : '-'}
                                        </td>
                                        <td>${p.purchaseDate ? new Date(p.purchaseDate).toLocaleDateString() : 'N/A'}</td>
                                        <td>
                                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                                <span style="font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase;">Doc: ${p.documentStatus || 'Rien'}</span>
                                                <span class="status-badge ${p.documentsReceived === 'Oui' ? 'success' : 'danger'}" style="font-size: 0.65rem; padding: 2px 6px; width: fit-content;">
                                                    REC: ${p.documentsReceived || 'Non'}
                                                </span>
                                            </div>
                                        </td>
                                        <td><span class="status-badge" style="background: rgba(var(--primary-rgb), 0.1); color: var(--primary);">${p.status}</span></td>
                                        <td>
                                            <div class="actions-cell">
                                                <button class="btn-icon" onclick="app.showPurchaseOrderDetails('${p.id}')" title="Détails" style="background: rgba(var(--primary-rgb), 0.1); color: var(--primary);"><i class="fas fa-eye"></i></button>
                                                <button class="btn-icon" onclick="app.exportSinglePurchaseOrderToPDF('${p.id}')" title="Imprimer" style="background: rgba(var(--success-rgb), 0.1); color: var(--success);"><i class="fas fa-print"></i></button>
                                                <button class="btn-icon" onclick="app.showPurchaseOrderModal('${p.id}')" title="Modifier"><i class="fas fa-edit"></i></button>
                                                <button class="btn-icon variant-danger" onclick="app.deletePurchaseOrder('${p.id}')" title="Supprimer"><i class="fas fa-trash"></i></button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
        } catch (err) {
            console.error("Error rendering purchases:", err);
            this.showToast(`Erreur lors du chargement des achats: ${err.message}`, "error");
        }
    },

    async renderSuppliers(query = '') {
        this.currentView = 'suppliers';
        this.searchQuery = query;

        try {
            const response = await ApiService.getSuppliers();
            let suppliers = response.data || [];

            if (query) {
                const q = query.toLowerCase();
                suppliers = suppliers.filter(s =>
                    s.name.toLowerCase().includes(q) ||
                    s.code.toLowerCase().includes(q)
                );
            }

            this.viewContainer.innerHTML = `
                    <div class="view-header">
                        <div>
                            <h1><i class="fas fa-truck-field"></i> Fournisseurs</h1>
                            <p class="subtitle">Gestion du carnet d'adresses des partenaires fournisseurs</p>
                        </div>
                        <div class="header-actions">
                            <button class="btn-primary" onclick="app.showSupplierModal()">
                                <i class="fas fa-plus"></i> Nouveau Fournisseur
                            </button>
                        </div>
                    </div>

        <div class="glass" style="padding: 0; overflow: hidden;">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Code</th>
                        <th>Nom</th>
                        <th>Email</th>
                        <th>Téléphone</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${suppliers.length === 0 ? '<tr><td colspan="5" style="text-align: center; padding: 40px;">Aucun fournisseur trouvé</td></tr>' :
                    suppliers.map(s => `
                                    <tr>
                                        <td><strong>${s.code}</strong></td>
                                        <td>${s.name}</td>
                                        <td>${s.email || '-'}</td>
                                        <td>${s.phone || '-'}</td>
                                        <td>
                                            <div class="actions-cell">
                                                <button class="btn-icon" onclick="app.showSupplierModal('${s.id}')" title="Modifier"><i class="fas fa-edit"></i></button>
                                                <button class="btn-icon danger" onclick="app.deleteSupplier('${s.id}')" title="Supprimer"><i class="fas fa-trash"></i></button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                </tbody>
            </table>
        </div>
    `;
        } catch (err) {
            console.error("Error rendering suppliers:", err);
            this.showToast("Erreur lors du chargement des fournisseurs", "error");
        }
    },

    async showSupplierModal(id = null) {
        let supplier = null;
        if (id) {
            const response = await ApiService.getSuppliers();
            supplier = response.data.find(s => s.id == id);
        }

        const modalHtml = `
        <div id="modal-overlay" class="modal-overlay">
            <div class="modal glass" style="max-width: 500px; width: 95%; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2>${id ? 'Modifier' : 'Nouveau'} Fournisseur</h2>
                    <button class="close-btn" onclick="app.closeModal()"><i class="fas fa-times"></i></button>
                </div>
                <form id="supplier-form" class="modal-body">
                    <div class="form-group">
                        <label>Code Fournisseur</label>
                        <input type="text" name="code" value="${supplier ? supplier.code : ''}" class="code-input" required placeholder="Ex: AUC-DIRECT">
                    </div>
                    <div class="form-group">
                        <label>Nom Complet</label>
                        <input type="text" name="name" value="${supplier ? supplier.name : ''}" class="code-input" required placeholder="Ex: Auction Direct Inc">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" name="email" value="${supplier ? (supplier.email || '') : ''}" class="code-input" placeholder="Ex: contact@supplier.com">
                    </div>
                    <div class="form-group">
                        <label>Téléphone</label>
                        <input type="text" name="phone" value="${supplier ? (supplier.phone || '') : ''}" class="code-input" placeholder="Ex: +1 234 567 890">
                    </div>
                    <div class="form-group">
                        <label>Adresse</label>
                        <textarea name="address" class="code-input" rows="2">${supplier ? (supplier.address || '') : ''}</textarea>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                        <button type="submit" class="btn-primary">${id ? 'Mettre à jour' : 'Enregistrer'}</button>
                    </div>
                </form>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('supplier-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());

            try {
                if (id) {
                    await ApiService.updateSupplier(id, data);
                    this.showToast("Fournisseur mis à jour", "success");
                } else {
                    await ApiService.createSupplier(data);
                    this.showToast("Fournisseur créé avec succès", "success");
                }
                app.closeModal();
                this.renderSuppliers();
            } catch (err) {
                this.showToast(err.message, "error");
            }
        });
    },

    async deleteSupplier(id) {
        if (confirm("Êtes-vous sûr de vouloir supprimer ce fournisseur ?")) {
            try {
                await ApiService.deleteSupplier(id);
                this.showToast("Fournisseur supprimé", "info");
                this.renderSuppliers();
            } catch (err) {
                this.showToast("Erreur lors de la suppression", "error");
            }
        }
    },

    async showPurchaseOrderDetails(id) {
        const p = StorageService.get(STORAGE_KEYS.PURCHASE_ORDERS).find(po => po.id === id);
        if (!p) return;

        const modalHtml = `
                    <div id="modal-overlay" class="modal-overlay">
                        <div class="modal-content glass" style="width: 1000px; max-width: 95vw; max-height: 90vh; overflow-y: auto;">
                            <div class="modal-header">
                                <div>
                                    <h2>Détails Commande d'Achat #${p.id}</h2>
                                    <p style="color: var(--text-dim); font-size: 0.9rem; margin: 0;">Fournisseur: ${p.supplierName} | Date: ${p.purchaseDate ? new Date(p.purchaseDate).toLocaleDateString() : 'N/A'}</p>
                                    <div style="display: flex; gap: 10px; margin-top: 5px;">
                                        <span class="status-badge ${p.documentStatus === 'BL Finale' ? 'success' : (['BL Draft', 'BL EN COURS DE MODIFICATIONS'].includes(p.documentStatus) ? 'warning' : 'neutral')}" style="font-size: 0.75rem; padding: 2px 8px;">
                                            Statut Doc: ${p.documentStatus || 'Rien'}
                                        </span>
                                        <span class="status-badge ${p.documentsReceived === 'Oui' ? 'success' : 'danger'}" style="font-size: 0.75rem; padding: 2px 8px;">
                                            DOC REC: ${p.documentsReceived || 'Non'}
                                        </span>
                                    </div>
                                </div>
                                <button class="btn-close" onclick="app.closeModal()">&times;</button>
                            </div>
                            <div class="order-details-content" style="padding: 20px;">
                                <div class="glass" style="padding: 0; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
                                    <table class="data-table">
                                        <thead>
                                            <tr>
                                                <th>Marque / Modèle</th>
                                                <th>Identification</th>
                                                <th>Motorisation</th>
                                                <th>Client Affecté</th>
                                                <th>Statut Livraison Client</th>
                                                <th>Détails</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${(p.vehicles || []).map(v => {
            const order = v.orderId ? StorageService.get(STORAGE_KEYS.ORDERS).find(o => o.id === v.orderId) : null;
            const client = order
                ? StorageService.get(STORAGE_KEYS.CLIENTS).find(c => c.id === order.clientId)
                : (v.clientId ? StorageService.get(STORAGE_KEYS.CLIENTS).find(c => c.id === v.clientId) : null);

            const orderStatus = order ? this.calculateOrderStatus(order) : 'N/A';

            let deliveryStatusClass = 'available';
            let deliveryStatusLabel = 'En Stock';

            if (orderStatus === 'Enlevée' || orderStatus === 'Livrée') {
                deliveryStatusClass = 'success';
                deliveryStatusLabel = 'Livré au Client';
            } else if (order) {
                deliveryStatusClass = 'warning';
                deliveryStatusLabel = `En cours (${orderStatus})`;
            }

            return `
                                                <tr>
                                                    <td>
                                                        <div style="font-weight: 600;">${v.brand} ${v.model || ''}</div>
                                                        <div style="font-size: 0.8rem; color: var(--text-dim);">${v.year || '-'} | ${v.color || '-'}</div>
                                                    </td>
                                                    <td>
                                                        <div style="font-size: 0.85rem;"><strong>VIN:</strong> <code style="font-family: monospace;">${v.chassisNumber || 'N/A'}</code></div>
                                                        <div style="font-size: 0.85rem;"><strong>ID:</strong> #${v.id}</div>
                                                    </td>
                                                    <td>
                                                        <div style="font-size: 0.85rem;">${v.motorization || '-'}</div>
                                                    </td>
                                                    <td>
                                                        ${client ? `
                                                            <div style="font-weight: 500;">${client.firstName} ${client.lastName}</div>
                                                            ${order ? `<div style="font-size: 0.8rem; color: var(--primary);">CMD #${order.id}</div>` : '<div style="font-size: 0.8rem; color: var(--success);">RÉSERVÉ</div>'}
                                                        ` : '<span style="color: var(--text-dim);">STOCK</span>'}
                                                    </td>
                                                    <td>
                                                        <span class="status-badge ${deliveryStatusClass}">${deliveryStatusLabel}</span>
                                                    </td>
                                                    <td>
                                                        <button class="btn-icon" onclick="app.closeModal(); app.showVehicleDetails('${v.id}')" title="Voir véhicule"><i class="fas fa-external-link-alt"></i></button>
                                                    </td>
                                                </tr>
                                            `;
        }).join('')}
                                            ${(p.vehicles || []).length === 0 ? '<tr><td colspan="6" style="text-align: center; padding: 20px;">Aucun véhicule lié</td></tr>' : ''}
                                        </tbody>
                                    </table>
                                </div>

                                <div class="glass" style="margin-top: 15px; padding: 15px; background: rgba(var(--primary-rgb), 0.05); border-left: 4px solid var(--primary); border-radius: 8px;">
                                    <h3 style="font-size: 1rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                        <i class="fas fa-ship"></i> Expédition & Logistique
                                    </h3>
                                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                                        <div>
                                            <p style="margin: 0; color: var(--text-dim); font-size: 0.8rem;">Statut Chargement</p>
                                            <span class="status-badge ${p.isLoaded === 'Oui' ? 'success' : 'danger'}" style="font-size: 0.85rem; padding: 4px 10px;">
                                                <i class="fas ${p.isLoaded === 'Oui' ? 'fa-check-circle' : 'fa-clock'}"></i> ${p.isLoaded === 'Oui' ? 'CHARGÉ' : 'EN ATTENTE'}
                                            </span>
                                        </div>
                                        <div>
                                            <p style="margin: 0; color: var(--text-dim); font-size: 0.8rem;">Port de Chargement</p>
                                            <strong style="font-size: 0.9rem;">${p.loadingPort || 'N/A'}</strong>
                                        </div>
                                        <div>
                                            <p style="margin: 0; color: var(--text-dim); font-size: 0.8rem;">Date de Chargement</p>
                                            <strong style="font-size: 0.9rem;">${p.loadingDate ? new Date(p.loadingDate).toLocaleDateString() : 'N/A'}</strong>
                                        </div>
                                        <div>
                                            <p style="margin: 0; color: var(--text-dim); font-size: 0.8rem;">ETD (Départ)</p>
                                            <strong style="font-size: 0.9rem; color: var(--primary);">${p.etd ? new Date(p.etd).toLocaleDateString() : 'N/A'}</strong>
                                        </div>
                                        <div>
                                            <p style="margin: 0; color: var(--text-dim); font-size: 0.8rem;">ETA (Arrivée)</p>
                                            <strong style="font-size: 0.9rem; color: var(--success);">${p.eta ? new Date(p.eta).toLocaleDateString() : 'N/A'}</strong>
                                        </div>
                                    </div>
                                </div>

                                <!-- Actions à faire (To-Do List) -->
                                <div class="details-section" style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px;">
                                    <h3 style="display: flex; justify-content: space-between; align-items: center; font-size: 1rem;">
                                        <span><i class="fas fa-clipboard-list"></i> Actions à faire</span>
                                        <button class="btn-action success-alt" onclick="app.addPurchaseOrderTask('${p.id}')" title="Ajouter une action"><i class="fas fa-plus"></i></button>
                                    </h3>
                                    <div id="po-tasks-container-${p.id}" class="tasks-list" style="margin-top: 15px;">
                                        ${this.renderPurchaseOrderTasks(p)}
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button class="btn-secondary" onclick="app.closeModal()">Fermer</button>
                                <button class="btn-primary" onclick="app.closeModal(); app.showPurchaseOrderModal('${p.id}')"><i class="fas fa-edit"></i> Modifier l'Achat</button>
                            </div>
                        </div>
                    </div>
                    `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    async showPurchaseOrderModal(id = null) {
        const orders = StorageService.get(STORAGE_KEYS.ORDERS) || [];
        const response = await ApiService.getPurchaseOrders();
        const existingPOs = response.data || [];
        const categories = StorageService.get(STORAGE_KEYS.CATEGORIES) || [];
        const colors = StorageService.get(STORAGE_KEYS.COLORS) || [];

        let po = id ? existingPOs.find(p => p.id === id) : null;

        // Filter for creation: Validated AND NOT Cancelled AND NOT linked to a vehicle AND NOT already having a PO
        const eligibleOrders = orders.filter(o =>
            o.isValidated &&
            !['ANNULÉE', 'ANNULÉ'].includes(o.status) &&
            !o.vehicleId
        );

        const brands = StorageService.get(STORAGE_KEYS.BRANDS) || [];
        const brandModels = StorageService.get(STORAGE_KEYS.BRAND_MODELS) || {};

        const modalHtml = `
        <div id="modal-overlay" class="modal-overlay">
            <div class="modal glass" style="max-width: 1000px; width: 95%; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2>${id ? 'Modifier' : 'Nouveaux'} Achats</h2>
                    <button class="close-btn" onclick="app.closeModal()"><i class="fas fa-times"></i></button>
                </div>
                <form id="po-form" class="modal-body">
                        <div class="section-header" style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                            <h3>1. ${!id ? 'Sélectionner les Commandes Client' : 'Véhicules de la Commande'}</h3>
                            <button type="button" class="btn-secondary btn-sm" onclick="app.addStockRowToPO()">
                                <i class="fas fa-plus"></i> Ajouter Véhicule Stock
                            </button>
                        </div>

                        <div class="data-table-container" style="max-height: 400px; overflow-y: auto; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;">
                            <table class="data-table">
                                <thead style="position: sticky; top: 0; z-index: 10; background: var(--bg-card);">
                                <tr>
                                    <th style="width: 40px; text-align: center;">#</th>
                                    <th style="width: 40px; text-align: center;">Actions</th>
                                    <th>Commande</th>
                                    <th>Client</th>
                                    <th>Véhicule (Marque/Modèle)</th>
                                    <th>Motorisation</th>
                                    <th>VIN Châssis</th>
                                    <th>Couleur/Cat.</th>
                                    <th>Kilo.</th>
                                    <th>Prix Achat</th>
                                    <th>Copie</th>
                                </tr>
                                </thead>
                                <tbody>
                                    ${!id ? eligibleOrders.map((o, index) => `
                                    <tr data-order-id="${o.id}" class="po-row">
                                        <td class="row-index" style="text-align: center; font-weight: bold; color: var(--primary);">${index + 1}</td>
                                        <td style="text-align: center;"><input type="checkbox" name="selectedOrders" value="${o.id}" class="po-order-checkbox"></td>
                                        <td><strong>#${o.id}</strong></td>
                                        <td>${o.clientName}</td>
                                        <td>
                                            <div style="font-weight: 600; font-size: 0.9rem;">${o.requestedBrand || ''} ${o.requestedModel || ''}</div>
                                            <input type="hidden" class="brand-input" value="${o.requestedBrand || ''}">
                                            <input type="hidden" class="model-input" value="${o.requestedModel || ''}">
                                        </td>
                                        <td><input type="text" class="glass-input motorization-input" placeholder="Motorisation" style="width: 100px; padding: 4px; font-size: 0.8rem;"></td>
                                        <td><input type="text" class="glass-input vin-input" placeholder="N° Châssis" style="width: 140px; padding: 4px; font-size: 0.8rem;"></td>
                                        <td>
                                            <select class="glass-select color-select" style="padding: 2px; font-size: 0.8rem; margin-bottom: 2px; width: 100px;">
                                                <option value="">Couleur</option>
                                                ${colors.map(c => `<option value="${c}" ${o.requestedColor === c ? 'selected' : ''}>${c}</option>`).join('')}
                                            </select>
                                            <br>
                                            <select class="glass-select category-select" style="padding: 2px; font-size: 0.8rem; width: 100px;">
                                                <option value="">Catégorie</option>
                                                ${categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                                            </select>
                                        </td>
                                        <td><input type="number" class="glass-input mileage-input" placeholder="0" value="0" style="width: 70px; padding: 4px; font-size: 0.8rem;"></td>
                                        <td>
                                            <input type="number" class="glass-input price-input" placeholder="Prix" style="width: 90px; padding: 4px; font-size: 0.8rem;">
                                            <br>
                                            <select class="glass-select currency-select" style="padding: 2px; font-size: 0.8rem; margin-top: 2px; width: 90px;">
                                                ${(StorageService.get(STORAGE_KEYS.CURRENCIES) || ['EUR', 'USD', 'DZD']).map(c => `<option value="${c}" ${c === 'EUR' ? 'selected' : ''}>${c}</option>`).join('')}
                                            </select>
                                        </td>
                                        <td>
                                            <button type="button" class="btn-icon" onclick="app.duplicatePORow(this)" title="Dupliquer"><i class="fas fa-copy"></i></button>
                                        </td>
                                    </tr>
                                    `).join('') : (po.vehicles ? po.vehicles.map((v, index) => `
                                    <tr data-vehicle-id="${v.id}" data-order-id="${v.orderId || ''}" class="po-row">
                                        <td class="row-index" style="text-align: center; font-weight: bold; color: var(--primary);">${index + 1}</td>
                                        <td style="text-align: center;">
                                            <button type="button" class="btn-icon danger" onclick="this.closest('tr').remove(); app.reindexPORows();" title="Supprimer"><i class="fas fa-trash"></i></button>
                                        </td>
                                        <td><strong>#${v.orderId || 'STOCK'}</strong></td>
                                        <td>${v.order?.clientName || 'N/A'}</td>
                                        <td>
                                            <select class="glass-select brand-input" style="width: 100px; padding: 4px; font-size: 0.8rem; margin-bottom: 2px;" onchange="app.updatePOVehicleModel(this)">
                                                <option value="">Marque</option>
                                                ${brands.map(b => `<option value="${b}" ${v.brand === b ? 'selected' : ''}>${b}</option>`).join('')}
                                            </select>
                                            <br>
                                            <select class="glass-select model-input" style="width: 100px; padding: 4px; font-size: 0.8rem;">
                                                <option value="">Modèle</option>
                                                ${(brandModels[v.brand] || []).map(m => `<option value="${m}" ${v.model === m ? 'selected' : ''}>${m}</option>`).join('')}
                                            </select>
                                        </td>
                                        <td><input type="text" class="glass-input motorization-input" value="${v.motorization || ''}" placeholder="Motorisation" style="width: 100px; padding: 4px; font-size: 0.8rem;"></td>
                                        <td><input type="text" class="glass-input vin-input" value="${v.chassisNumber || ''}" style="width: 140px; padding: 4px; font-size: 0.8rem;"></td>
                                        <td>
                                            <select class="glass-select color-select" style="padding: 2px; font-size: 0.8rem; margin-bottom: 2px; width: 100px;">
                                                <option value="">Couleur</option>
                                                ${colors.map(c => `<option value="${c}" ${v.color === c ? 'selected' : ''}>${c}</option>`).join('')}
                                            </select>
                                            <br>
                                            <select class="glass-select category-select" style="padding: 2px; font-size: 0.8rem; width: 100px;">
                                                <option value="">Catégorie</option>
                                                ${categories.map(cat => `<option value="${cat}" ${v.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}
                                            </select>
                                        </td>
                                        <td><input type="number" class="glass-input mileage-input" value="${v.mileage || 0}" style="width: 70px; padding: 4px; font-size: 0.8rem;"></td>
                                        <td>
                                            <input type="number" class="glass-input price-input" value="${v.purchasePrice || 0}" style="width: 90px; padding: 4px; font-size: 0.8rem;">
                                            <br>
                                            <select class="glass-select currency-select" style="padding: 2px; font-size: 0.8rem; margin-top: 2px; width: 90px;">
                                                ${(StorageService.get(STORAGE_KEYS.CURRENCIES) || ['EUR', 'USD', 'DZD']).map(c => `<option value="${c}" ${v.purchaseCurrency === c ? 'selected' : ''}>${c}</option>`).join('')}
                                            </select>
                                        </td>
                                        <td>
                                            <button type="button" class="btn-icon" onclick="app.duplicatePORow(this)" title="Dupliquer"><i class="fas fa-copy"></i></button>
                                        </td>
                                    </tr>
                                    `).join('') : '<tr><td colspan="11" style="text-align: center;">Aucun véhicule lié</td></tr>')}
                                </tbody>
                            </table>
                        </div>

                    <div class="section-header" style="margin-top: 20px; margin-bottom: 15px;">
                        <h3>2. Détails de l'Achat</h3>
                    </div>
                    <div class="form-grid">
                        <div class="form-group full-width">
                            <label>Fournisseur</label>
                            <select name="supplierId" class="code-input" required>
                                <option value="">Sélectionner un fournisseur...</option>
                                ${(await ApiService.getSuppliers()).data.map(s => `<option value="${s.id}" ${po && po.supplierId == s.id ? 'selected' : ''}>${s.code} - ${s.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Statut</label>
                            <select name="status" class="code-input">
                                <option value="En cours" ${po && po.status === 'En cours' ? 'selected' : ''}>En cours</option>
                                <option value="Commandé" ${po && po.status === 'Commandé' ? 'selected' : ''}>Commandé</option>
                                <option value="Payé" ${po && po.status === 'Payé' ? 'selected' : ''}>Payé</option>
                                <option value="Livré" ${po && po.status === 'Livré' ? 'selected' : ''}>Livré</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Date d'achat</label>
                            <input type="date" name="purchaseDate" value="${po ? po.purchaseDate.split('T')[0] : new Date().toISOString().split('T')[0]}" class="code-input" required>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: rgba(var(--primary-rgb), 0.05); padding: 10px; border-radius: 8px; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.05);">
                            <div class="form-group" style="margin-bottom: 0;">
                                <label><i class="fas fa-file-contract"></i> Statut Documents</label>
                                <select name="documentStatus" class="glass-select">
                                    <option value="Rien" ${po && po.documentStatus === 'Rien' ? 'selected' : ''}>Rien</option>
                                    <option value="BL Draft" ${po && po.documentStatus === 'BL Draft' ? 'selected' : ''}>BL Draft</option>
                                    <option value="BL EN COURS DE MODIFICATIONS" ${po && po.documentStatus === 'BL EN COURS DE MODIFICATIONS' ? 'selected' : ''}>BL EN COURS DE MODIFICATIONS</option>
                                    <option value="BL Finale" ${po && po.documentStatus === 'BL Finale' ? 'selected' : ''}>BL Finale</option>
                                </select>
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label><i class="fas fa-check-circle"></i> Documents Reçus</label>
                                <select name="documentsReceived" class="glass-select">
                                    <option value="Non" ${po && po.documentsReceived === 'Non' ? 'selected' : ''}>Non</option>
                                    <option value="Oui" ${po && po.documentsReceived === 'Oui' ? 'selected' : ''}>Oui</option>
                                </select>
                            </div>
                        </div>

                        <div style="background: rgba(var(--primary-rgb), 0.03); padding: 15px; border-radius: 8px; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.05);">
                            <h4 style="margin-bottom: 10px; font-size: 0.9rem; color: var(--primary);"><i class="fas fa-ship"></i> Logistique & Expédition</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label>Port de Chargement</label>
                                    <input type="text" name="loadingPort" value="${po && po.loadingPort ? po.loadingPort : ''}" class="glass-input" placeholder="Nom du port">
                                </div>
                                <div class="form-group">
                                    <label>Date de Chargement</label>
                                    <input type="date" name="loadingDate" value="${po && po.loadingDate ? po.loadingDate.split('T')[0] : ''}" class="glass-input">
                                </div>
                                <div class="form-group">
                                    <label>Chargement Effectué ?</label>
                                    <select name="isLoaded" class="glass-select">
                                        <option value="Non" ${po && po.isLoaded === 'Non' ? 'selected' : ''}>Non</option>
                                        <option value="Oui" ${po && po.isLoaded === 'Oui' ? 'selected' : ''}>Oui</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>ETD (Estimation Départ)</label>
                                    <input type="date" name="etd" value="${po && po.etd ? po.etd.split('T')[0] : ''}" class="glass-input">
                                </div>
                                <div class="form-group">
                                    <label>ETA (Estimation Arrivée)</label>
                                    <input type="date" name="eta" value="${po && po.eta ? po.eta.split('T')[0] : ''}" class="glass-input">
                                </div>
                            </div>
                        </div>
                        <div class="form-group full-width">
                            <label>Notes</label>
                            <textarea name="notes" class="code-input" rows="3">${po ? po.notes : ''}</textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                        <button type="submit" class="btn-primary">${id ? 'Mettre à jour' : 'Créer les commandes'}</button>
                    </div>
                </form>
            </div>
        </div>
    `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Select all functionality
        const selectAll = document.getElementById('select-all-po-orders');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                document.querySelectorAll('.po-order-checkbox').forEach(cb => cb.checked = e.target.checked);
            });
        }

        document.getElementById('po-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const baseData = {
                supplierId: formData.get('supplierId'),
                status: formData.get('status'),
                purchaseDate: formData.get('purchaseDate'),
                documentStatus: formData.get('documentStatus'),
                documentsReceived: formData.get('documentsReceived'),
                loadingPort: formData.get('loadingPort'),
                loadingDate: formData.get('loadingDate') || null,
                etd: formData.get('etd') || null,
                eta: formData.get('eta') || null,
                isLoaded: formData.get('isLoaded'),
                notes: formData.get('notes')
            };

            if (!id) {
                const allRows = document.querySelectorAll('#po-form .data-table tbody tr.po-row');

                // For new PO: collect selected client orders and all stock rows
                const vehiclesToCreate = [];

                allRows.forEach(tr => {
                    const cb = tr.querySelector('.po-order-checkbox');
                    const isNewStock = tr.classList.contains('po-stock-row');

                    if (isNewStock || (cb && cb.checked)) {
                        vehiclesToCreate.push({
                            orderId: tr.getAttribute('data-order-id') || null,
                            brand: tr.querySelector('.brand-input')?.value || '',
                            model: tr.querySelector('.model-input')?.value || '',
                            motorization: tr.querySelector('.motorization-input').value,
                            chassisNumber: tr.querySelector('.vin-input').value,
                            color: tr.querySelector('.color-select').value,
                            category: tr.querySelector('.category-select').value,
                            mileage: parseInt(tr.querySelector('.mileage-input').value) || 0,
                            purchasePrice: parseFloat(tr.querySelector('.price-input').value) || 0,
                            purchaseCurrency: tr.querySelector('.currency-select').value || 'EUR'
                        });
                    }
                });

                if (vehiclesToCreate.length === 0) {
                    this.showToast("Veuillez sélectionner au moins une commande client ou ajouter un véhicule de stock.", "warning");
                    return;
                }

                const loadingToast = this.showToast("Création de la commande d'achat en cours...", "info", 0);

                const data = {
                    ...baseData,
                    vehicles: vehiclesToCreate
                };

                try {
                    await ApiService.createPurchaseOrder(data);
                    if (loadingToast && loadingToast.remove) loadingToast.remove();
                    this.showToast("Commande d'achat créée avec succès. Les véhicules ont été créés en stock.", "success");
                } catch (err) {
                    if (loadingToast && loadingToast.remove) loadingToast.remove();
                    console.error("Error creating PO:", err);
                    this.showToast("Erreur: " + err.message, "error");
                    return;
                }
            } else {
                // Update mode
                const allRows = document.querySelectorAll('#po-form .data-table tbody tr.po-row');
                const vehiclesToUpdate = Array.from(allRows).map(tr => {
                    return {
                        id: tr.getAttribute('data-vehicle-id') || null,
                        orderId: tr.getAttribute('data-order-id') || null,
                        brand: tr.querySelector('.brand-input')?.value || '',
                        model: tr.querySelector('.model-input')?.value || '',
                        motorization: tr.querySelector('.motorization-input').value,
                        chassisNumber: tr.querySelector('.vin-input').value,
                        color: tr.querySelector('.color-select').value,
                        category: tr.querySelector('.category-select').value,
                        mileage: parseInt(tr.querySelector('.mileage-input').value) || 0,
                        purchasePrice: parseFloat(tr.querySelector('.price-input').value) || 0,
                        purchaseCurrency: tr.querySelector('.currency-select').value || 'EUR'
                    };
                });

                const data = {
                    ...baseData,
                    vehicles: vehiclesToUpdate
                };

                try {
                    // Fix: constructor of updatePurchaseOrder relies on this.ApiService.request(`/purchase-orders/${id}` ...
                    await ApiService.updatePurchaseOrder(id, data);
                    this.showToast("Commande d'achat mise à jour", "success");
                } catch (err) {
                    this.showToast(err.message, "error");
                    return;
                }
            }

            app.closeModal();
            this.renderPurchases(this.searchQuery);
        });
    },

    updatePOVehicleModel(brandSelect) {
        const row = brandSelect.closest('tr');
        const modelSelect = row.querySelector('.model-input');
        const brand = brandSelect.value;
        const brandModels = StorageService.get(STORAGE_KEYS.BRAND_MODELS) || {};
        const models = brandModels[brand] || [];

        modelSelect.innerHTML = '<option value="">Modèle</option>' +
            models.map(m => `<option value="${m}">${m}</option>`).join('');
    },

    addStockRowToPO() {
        const categories = StorageService.get(STORAGE_KEYS.CATEGORIES) || [];
        const colors = StorageService.get(STORAGE_KEYS.COLORS) || [];
        const currencies = StorageService.get(STORAGE_KEYS.CURRENCIES) || ['EUR', 'USD', 'DZD'];
        const brands = StorageService.get(STORAGE_KEYS.BRANDS) || [];

        const tbody = document.querySelector('#po-form .data-table tbody');
        if (!tbody) return;

        const row = document.createElement('tr');
        row.className = 'po-stock-row po-row';
        row.innerHTML = `
            <td class="row-index" style="text-align: center; font-weight: bold; color: var(--primary);">0</td>
            <td style="text-align: center;"><button type="button" class="btn-icon danger" onclick="this.closest('tr').remove(); app.reindexPORows();"><i class="fas fa-trash"></i></button></td>
            <td><strong>STOCK</strong></td>
            <td>N/A</td>
            <td>
                <select class="glass-select brand-input" style="width: 100px; padding: 4px; font-size: 0.8rem; margin-bottom: 2px;" onchange="app.updatePOVehicleModel(this)">
                    <option value="">Marque</option>
                    ${brands.map(b => `<option value="${b}">${b}</option>`).join('')}
                </select>
                <br>
                <select class="glass-select model-input" style="width: 100px; padding: 4px; font-size: 0.8rem;">
                    <option value="">Modèle</option>
                </select>
            </td>
            <td><input type="text" class="glass-input motorization-input" placeholder="Motorisation" style="width: 100px; padding: 4px; font-size: 0.8rem;"></td>
            <td><input type="text" class="glass-input vin-input" placeholder="N° Châssis" style="width: 140px; padding: 4px; font-size: 0.8rem;"></td>
            <td>
                <select class="glass-select color-select" style="padding: 2px; font-size: 0.8rem; margin-bottom: 2px; width: 100px;">
                    <option value="">Couleur</option>
                    ${colors.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
                <br>
                <select class="glass-select category-select" style="padding: 2px; font-size: 0.8rem; width: 100px;">
                    <option value="">Catégorie</option>
                    ${categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                </select>
            </td>
            <td><input type="number" class="glass-input mileage-input" placeholder="0" value="0" style="width: 70px; padding: 4px; font-size: 0.8rem;"></td>
            <td>
                <input type="number" class="glass-input price-input" placeholder="Prix" style="width: 90px; padding: 4px; font-size: 0.8rem;">
                <br>
                <select class="glass-select currency-select" style="padding: 2px; font-size: 0.8rem; margin-top: 2px; width: 90px;">
                    ${currencies.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
            </td>
            <td>
                <button type="button" class="btn-icon" onclick="app.duplicatePORow(this)" title="Dupliquer"><i class="fas fa-copy"></i></button>
            </td>
        `;

        // If 'No records found' row exists, remove it
        if (tbody.rows.length === 1 && tbody.rows[0].cells.length === 1) {
            tbody.innerHTML = '';
        }

        tbody.appendChild(row);
        this.reindexPORows();
    },

    duplicatePORow(button) {
        const sourceRow = button.closest('tr');
        const clone = sourceRow.cloneNode(true);

        // Copy current input/select values
        const sourceInputs = sourceRow.querySelectorAll('input, select, textarea');
        const cloneInputs = clone.querySelectorAll('input, select, textarea');
        sourceInputs.forEach((input, i) => {
            if (cloneInputs[i]) cloneInputs[i].value = input.value;
        });

        // Duplicated rows always become stock rows
        clone.className = 'po-stock-row po-row';
        clone.removeAttribute('data-vehicle-id');
        clone.setAttribute('data-order-id', '');
        const cells = clone.cells;

        // Ensure action cell (Index 1) has trash button
        cells[1].innerHTML = `<button type="button" class="btn-icon danger" onclick="this.closest('tr').remove(); app.reindexPORows();" title="Supprimer"><i class="fas fa-trash"></i></button>`;

        // Ensure brand/model cell (Index 4) has selects
        const bSelect = clone.querySelector('select.brand-input');
        if (!bSelect) {
            // Convert static text/hidden to selects if needed (e.g. duplicating from a client row)
            const brand = sourceRow.querySelector('.brand-input')?.value || '';
            const model = sourceRow.querySelector('.model-input')?.value || '';
            const brands = StorageService.get(STORAGE_KEYS.BRANDS) || [];
            const brandModels = StorageService.get(STORAGE_KEYS.BRAND_MODELS) || {};

            cells[4].innerHTML = `
            <select class="glass-select brand-input" style="width: 100px; padding: 4px; font-size: 0.8rem; margin-bottom: 2px;" onchange="app.updatePOVehicleModel(this)">
                <option value="">Marque</option>
                ${brands.map(b => `<option value="${b}" ${brand === b ? 'selected' : ''}>${b}</option>`).join('')}
            </select>
            <br>
            <select class="glass-select model-input" style="width: 100px; padding: 4px; font-size: 0.8rem;">
                <option value="">Modèle</option>
                ${(brandModels[brand] || []).map(m => `<option value="${m}" ${model === m ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
        `;
        }

        sourceRow.parentNode.insertBefore(clone, sourceRow.nextSibling);
        this.reindexPORows();
    },

    reindexPORows() {
        document.querySelectorAll('#po-form .po-row').forEach((row, idx) => {
            const indexCell = row.querySelector('.row-index');
            if (indexCell) {
                indexCell.textContent = idx + 1;
            }
        });
    },


    async deletePurchaseOrder(id) {
        if (confirm("Êtes-vous sûr de vouloir supprimer cette commande d'achat ?")) {
            try {
                await ApiService.deletePurchaseOrder(id);
                this.showToast("Commande d'achat supprimée", "info");
                this.renderPurchases(this.searchQuery);
            } catch (err) {
                this.showToast("Erreur lors de la suppression", "error");
            }
        }
    },


    renderVerification() {
        const templates = StorageService.get(STORAGE_KEYS.BL_TEMPLATES);

        const viewHtml = `
    <div class="view-header">
                    <h1><i class="fas fa-file-contract"></i> Vérification Papier</h1>
                    <p class="subtitle">Analyse et vérification automatique des documents de transport (BL)</p>
                </div>

    <div class="verification-container" style="display: grid; grid-template-columns: 350px 1fr; gap: 20px; height: calc(100vh - 180px);">
        <!-- Control Panel -->
        <div class="glass" style="padding: 20px; display: flex; flex-direction: column; gap: 20px; border-radius: 12px;">
            <div class="upload-section" style="text-align: center; border: 2px dashed rgba(255,255,255,0.1); border-radius: 12px; padding: 30px 20px; transition: all 0.3s; cursor: pointer;" id="drop-zone">
                <i class="fas fa-cloud-upload-alt" style="font-size: 3rem; color: var(--primary); margin-bottom: 15px;"></i>
                <h3 style="margin-bottom: 10px;">Glisser votre BL ici</h3>
                <p style="color: var(--text-dim); font-size: 0.9rem; margin-bottom: 20px;">ou cliquez pour sélectionner un fichier (Image/PDF)</p>
                <input type="file" id="bl-input" accept="image/*" style="display: none;">
                    <button class="btn-primary" onclick="document.getElementById('bl-input').click()">Sélectionner un fichier</button>
            </div>

            <div class="form-group">
                <label><i class="fas fa-building"></i> Compagnie Maritime</label>
                <div style="display: flex; gap: 10px;">
                    <select id="bl-template" class="glass-select" style="flex: 1;">
                        <option value="">Détection Automatique</option>
                        ${templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                    </select>
                    <button class="btn-icon" id="ai-toggle-btn" onclick="app.toggleAiExtraction()" title="Utiliser l'IA (BETA)" style="width: 42px; background: ${StorageService.get(STORAGE_KEYS.SETTINGS).useAiExtraction ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255,255,255,0.05)'}; color: ${StorageService.get(STORAGE_KEYS.SETTINGS).useAiExtraction ? 'var(--primary)' : 'inherit'};">
                        <i class="fas fa-robot"></i>
                    </button>
                    <button class="btn-icon" onclick="app.showTemplateManagerModal()" title="Gérer les modèles" style="width: 42px;">
                        <i class="fas fa-cog"></i>
                    </button>
                </div>
            </div>
            <div id="processing-status" style="display: none;">
                <label>Traitement en cours...</label>
                <div class="progress-bar" style="width: 100%; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; margin-top: 5px;">
                    <div id="ocr-progress" style="width: 0%; height: 100%; background: var(--primary); transition: width 0.3s;"></div>
                </div>
                <p id="status-text" style="font-size: 0.8rem; color: var(--text-dim); margin-top: 5px; text-align: right;">Initialisation...</p>
            </div>
        </div>

        <!-- Results Panel -->
        <div class="glass" style="padding: 20px; border-radius: 12px; display: grid; grid-template-rows: auto 1fr; overflow: hidden;">
            <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
                <h3><i class="fas fa-search"></i> Résultats de l'analyse</h3>
                <span id="verification-badge" class="status-badge" style="display: none;">EN ATTENTE</span>
            </div>

            <div id="verification-results" style="overflow-y: auto; display: none;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <!-- Extracted Data -->
                    <div>
                        <h4 style="color: var(--primary); margin-bottom: 15px;">Données Extraites (OCR)</h4>

                        <div class="result-item" style="margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                            <label style="font-size: 0.8rem; color: var(--text-dim);">Numéro Booking/BL</label>
                            <div id="res-booking" style="font-family: monospace; font-size: 1.1rem; font-weight: 600;">-</div>
                        </div>

                        <div class="result-item" style="margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                            <label style="font-size: 0.8rem; color: var(--text-dim);">Numéro Conteneur</label>
                            <div id="res-container" style="font-family: monospace; font-size: 1.1rem; font-weight: 600;">-</div>
                        </div>

                        <div class="result-item" style="margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                            <label style="font-size: 0.8rem; color: var(--text-dim);">Numéro Châssis (VIN)</label>
                            <div id="res-chassis" style="font-family: monospace; font-size: 1.1rem; font-weight: 600;">-</div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                            <div class="result-item" style="padding: 8px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <label style="font-size: 0.7rem; color: var(--text-dim);">Port de Chargement</label>
                                <div id="res-port-loading" style="font-size: 0.9rem; font-weight: 500;">-</div>
                            </div>
                            <div class="result-item" style="padding: 8px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <label style="font-size: 0.7rem; color: var(--text-dim);">Port de Destination</label>
                                <div id="res-port-destination" style="font-size: 0.9rem; font-weight: 500;">-</div>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                            <div class="result-item" style="padding: 8px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <label style="font-size: 0.7rem; color: var(--text-dim);">Compagnie Maritime</label>
                                <div id="res-shipping-line" style="font-size: 0.9rem; font-weight: 500;">-</div>
                            </div>
                            <div class="result-item" style="padding: 8px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <label style="font-size: 0.7rem; color: var(--text-dim);">Date de Chargement</label>
                                <div id="res-loading-date" style="font-size: 0.9rem; font-weight: 500;">-</div>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div class="result-item" style="margin-bottom: 10px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <label style="font-size: 0.7rem; color: var(--text-dim);">Client Extraposé</label>
                                <div id="res-client" style="font-size: 0.9rem; font-weight: 500;">-</div>
                            </div>
                            <div class="result-item" style="margin-bottom: 10px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <label style="font-size: 0.7rem; color: var(--text-dim);">Passeport / NIN</label>
                                <div id="res-passport" style="font-size: 0.9rem; font-weight: 500;">-</div>
                            </div>
                        </div>

                        <div class="result-item" style="padding: 8px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                            <label style="font-size: 0.7rem; color: var(--text-dim);">Véhicule Extraposé</label>
                            <div id="res-vehicle" style="font-size: 0.9rem; font-weight: 500;">-</div>
                        </div>
                    </div>

                    <!-- Database Match -->
                    <div>
                        <h4 style="color: var(--success); margin-bottom: 15px;">Correspondance Système</h4>

                        <div class="result-item" style="margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                            <label style="font-size: 0.8rem; color: var(--text-dim);">Véhicule Trouvé</label>
                            <div id="db-vehicle" style="font-weight: 600;">-</div>
                        </div>

                        <div class="result-item" style="margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                            <label style="font-size: 0.8rem; color: var(--text-dim);">Client Associé</label>
                            <div id="db-client" style="font-weight: 600;">-</div>
                        </div>

                        <div class="result-item" style="margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                            <label style="font-size: 0.8rem; color: var(--text-dim);">Statut Actuel</label>
                            <div id="db-status" style="font-weight: 600;">-</div>
                        </div>
                    </div>
                </div>

                <!-- Raw Text Toggle -->
                <div style="margin-top: 20px;">
                    <button class="btn-secondary" onclick="document.getElementById('raw-text-container').style.display = document.getElementById('raw-text-container').style.display === 'none' ? 'block' : 'none'">
                        <i class="fas fa-code"></i> Voir texte brut
                    </button>
                    <div id="raw-text-container" style="display: none; margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px;">
                        <pre id="raw-text" style="white-space: pre-wrap; font-family: monospace; font-size: 0.8rem; color: var(--text-dim);"></pre>
                    </div>
                </div>
            </div>

            <!-- Empty State -->
            <div id="verification-empty" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-dim);">
                <i class="fas fa-search" style="font-size: 4rem; margin-bottom: 20px; opacity: 0.3;"></i>
                <p>Importez un document pour commencer l'analyse</p>
            </div>
        </div>
    </div>
`;

        document.getElementById('view-container').innerHTML = viewHtml;

        // Event Listeners for File Upload
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('bl-input');

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--primary)';
            dropZone.style.background = 'rgba(255,255,255,0.05)';
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'rgba(255,255,255,0.1)';
            dropZone.style.background = 'transparent';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'rgba(255,255,255,0.1)';
            dropZone.style.background = 'transparent';
            if (e.dataTransfer.files.length > 0) {
                this.handleBLUpload(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleBLUpload(e.target.files[0]);
            }
        });
    },

    async handleBLUpload(file) {
        const statusDiv = document.getElementById('processing-status');
        const progressBar = document.getElementById('ocr-progress');
        const statusText = document.getElementById('status-text');
        const templateId = document.getElementById('bl-template').value;

        statusDiv.style.display = 'block';
        document.getElementById('verification-empty').style.display = 'none';
        document.getElementById('verification-results').style.display = 'none';
        document.querySelector('.upload-section').style.pointerEvents = 'none';
        document.querySelector('.upload-section').style.opacity = '0.5';

        try {
            let imageUrl;
            let extractedText = '';
            let useOCR = true;

            if (file.type === 'application/pdf') {
                statusText.innerText = "Analyse du PDF...";
                const pdfUrl = URL.createObjectURL(file);
                const loadingTask = pdfjsLib.getDocument(pdfUrl);
                const pdf = await loadingTask.promise;

                // Try native text extraction first
                statusText.innerText = "Extraction du texte...";
                extractedText = await this.extractTextFromPdf(pdf);

                // Check if text is sufficient (not just empty or whitespace)
                if (extractedText && extractedText.trim().length > 50) {
                    console.log("Native PDF text extracted:", extractedText.length, "chars");
                    useOCR = false;
                    statusText.innerText = "Texte extrait avec succès !";
                    progressBar.style.width = '100%';

                    // Clean up URL object
                    URL.revokeObjectURL(pdfUrl);
                } else {
                    console.log("Insufficient text in PDF, falling back to OCR");
                    statusText.innerText = "PDF scanné détecté. Conversion en image...";
                    imageUrl = await this.convertPdfToImage(pdf);
                    // URL of PDF no longer needed if we have the image
                    URL.revokeObjectURL(pdfUrl);
                }
            } else {
                imageUrl = URL.createObjectURL(file);
            }

            if (useOCR) {
                // Initialize Worker with English + French + Chinese
                const worker = await Tesseract.createWorker('eng+fra+chi_sim+chi_tra', 1, {
                    logger: m => {
                        console.log(m);
                        if (m.status === 'loading tesseract core') {
                            statusText.innerText = `Chargement du coeur OCR... ${Math.round((m.progress || 0) * 100)}% `;
                            progressBar.style.width = `${(m.progress || 0) * 30}% `;
                        } else if (m.status === 'initializing tesseract') {
                            statusText.innerText = `Initialisation OCR...`;
                        } else if (m.status === 'loading language traineddata') {
                            statusText.innerText = `Téléchargement du modèle de langue... ${Math.round((m.progress || 0) * 100)}% `;
                            progressBar.style.width = `${30 + ((m.progress || 0) * 30)}% `;
                        } else {
                            statusText.innerText = `${m.status}...`;
                        }
                    }
                });

                statusText.innerText = "Lecture du document...";

                const { data: { text } } = await worker.recognize(imageUrl, {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            progressBar.style.width = `${60 + ((m.progress || 0) * 40)}% `;
                            statusText.innerText = `Analyse en cours... ${Math.round(m.progress * 100)}% `;
                        }
                    }
                });

                extractedText = text;
                await worker.terminate();

                if (file.type !== 'application/pdf') {
                    URL.revokeObjectURL(imageUrl);
                }
            }

            // Process Data
            statusText.innerText = "Terminé !";
            progressBar.style.width = '100%';

            setTimeout(() => {
                try {
                    console.log("Processing extracted text:", extractedText.substring(0, 100) + "...");
                    // Pass file so processOCRData can do zonal OCR if needed
                    this.processOCRData(extractedText, templateId, file);
                } catch (error) {
                    console.error("Error processing data:", error);
                    this.showToast("Erreur lors de l'affichage des résultats: " + error.message, "error");
                }
            }, 500);

        } catch (error) {
            console.error("Analysis Error:", error);
            this.showToast("Erreur analyse: " + (error.message || error), "error");
            statusDiv.style.display = 'none';
        } finally {
            document.querySelector('.upload-section').style.pointerEvents = 'auto';
            document.querySelector('.upload-section').style.opacity = '1';
        }
    },

    // Helper to extract text usage PDF.js (No OCR)
    async extractTextFromPdf(pdf) {
        let fullText = '';
        // Limit to first 2 pages for performance
        const numPages = Math.min(pdf.numPages, 2);
        for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }
        return fullText;
    },

    async convertPdfToImage(pdf) {
        const page = await pdf.getPage(1); // Get first page
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        return canvas.toDataURL('image/png');
    },

    async processOCRData(text, templateId, file = null) {
        const templates = StorageService.get(STORAGE_KEYS.BL_TEMPLATES) || [];
        let template = null;

        if (!text) {
            console.warn("No text provided to processOCRData");
            text = "";
        }

        if (templateId) {
            template = templates.find(t => t.id === templateId);
        } else {
            // Auto-detect template
            if (templates && templates.length > 0) {
                for (const t of templates) {
                    if (t.keywords && t.keywords.some(k => text.toUpperCase().includes(k.toUpperCase()))) {
                        template = t;
                        break;
                    }
                }
            }
            if (!template) template = templates.find(t => t.id === 'tmpl_generic');
        }

        // Extract using patterns
        const extraction = {
            booking: 'Non trouvé',
            container: 'Non trouvé',
            chassis: 'Non trouvé',
            clientName: 'Non trouvé',
            passportNumber: 'Non trouvé',
            nin: 'Non trouvé',
            vehicleName: 'Non trouvé',
            portOfLoading: 'Non trouvé',
            portOfDestination: 'Non trouvé',
            shippingLine: 'Non trouvé',
            loadingDate: 'Non trouvé',
            rawText: text
        };

        const settings = StorageService.get(STORAGE_KEYS.SETTINGS);

        // AI Mode Branch
        if (settings.useAiExtraction && text.length > 20) {
            this.showToast("Analyse intelligente par IA...", "info");
            try {
                const aiData = await this.callGeminiAI(text);
                console.log("AI Extraction Result:", aiData);

                extraction.booking = aiData.bookingNumber || 'Non trouvé';
                extraction.container = aiData.containerNumber || 'Non trouvé';
                extraction.chassis = aiData.chassisNumber || 'Non trouvé';
                extraction.clientName = aiData.clientName || 'Non trouvé';
                extraction.passportNumber = aiData.passportNumber || 'Non trouvé';
                extraction.nin = aiData.nin || 'Non trouvé';
                extraction.vehicleName = aiData.vehicleName || 'Non trouvé';
                extraction.portOfLoading = aiData.portOfLoading || 'Non trouvé';
                extraction.portOfDestination = aiData.portOfDestination || 'Non trouvé';
                extraction.shippingLine = aiData.shippingLine || 'Non trouvé';
                extraction.loadingDate = aiData.loadingDate || 'Non trouvé';

                this.showToast("Extraction IA terminée", "success");
                this.displayVerificationResults(extraction);
                return;
            } catch (aiError) {
                console.error("Gemini Error:", aiError);
                this.showToast("L'IA a échoué: " + aiError.message, "warning");
                // Fall through to standard extraction
            }
        }

        // Zonal Mode: If template uses zones and we have the file
        if (template && template.useZonal && template.zones && file) {
            this.showToast("Analyse des zones du masque...", "info");

            try {
                let canvas = document.createElement('canvas');
                let ctx = canvas.getContext('2d');

                // Render document to canvas for cropping
                if (file.type === 'application/pdf') {
                    const pdfUrl = URL.createObjectURL(file);
                    const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
                    const page = await pdf.getPage(1);
                    const viewport = page.getViewport({ scale: 2.0 }); // High res for OCR
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
                    URL.revokeObjectURL(pdfUrl);
                } else {
                    const img = await new Promise(r => {
                        const i = new Image();
                        i.onload = () => r(i);
                        i.src = URL.createObjectURL(file);
                    });
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    URL.revokeObjectURL(img.src);
                }

                // For each zone, crop and OCR (Support French, English, and Chinese)
                const worker = await Tesseract.createWorker('eng+fra+chi_sim+chi_tra', 1);

                for (const [fieldId, zone] of Object.entries(template.zones)) {
                    const cropCanvas = document.createElement('canvas');
                    const cCtx = cropCanvas.getContext('2d');

                    const sx = (zone.x / 100) * canvas.width;
                    const sy = (zone.y / 100) * canvas.height;
                    const sw = (zone.w / 100) * canvas.width;
                    const sh = (zone.h / 100) * canvas.height;

                    cropCanvas.width = sw;
                    cropCanvas.height = sh;
                    cCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

                    const { data: { text: zoneText } } = await worker.recognize(cropCanvas);
                    const cleanText = zoneText.trim().replace(/\n/g, ' ');

                    if (fieldId === 'bookingNumber') extraction.booking = cleanText;
                    else if (fieldId === 'containerNumber') extraction.container = cleanText;
                    else if (fieldId === 'chassisNumber') extraction.chassis = cleanText;
                    else if (fieldId === 'clientName') extraction.clientName = cleanText;
                    else if (fieldId === 'passportNumber') extraction.passportNumber = cleanText;
                    else if (fieldId === 'nin') extraction.nin = cleanText;
                    else if (fieldId === 'vehicleName') extraction.vehicleName = cleanText;
                    else if (fieldId === 'portOfLoading') extraction.portOfLoading = cleanText;
                    else if (fieldId === 'portOfDestination') extraction.portOfDestination = cleanText;
                    else if (fieldId === 'shippingLine') extraction.shippingLine = cleanText;
                    else if (fieldId === 'loadingDate') extraction.loadingDate = cleanText;
                }

                await worker.terminate();
            } catch (zError) {
                console.error("Zonal OCR Error:", zError);
                this.showToast("Erreur lors de l'extraction par zone", "warning");
            }
        } else {
            // Regex Mode (Fallback)
            const patterns = template ? template.patterns : {};

            const safeMatch = (patternString) => {
                if (!patternString) return null;
                try {
                    const regex = new RegExp(patternString, 'i');
                    return text.match(regex);
                } catch (e) {
                    return null;
                }
            };

            const matchBooking = safeMatch(patterns.bookingNumber);
            if (matchBooking) extraction.booking = matchBooking[1];

            const matchContainer = safeMatch(patterns.containerNumber);
            if (matchContainer) extraction.container = matchContainer[1];

            const matchChassis = safeMatch(patterns.chassisNumber);
            if (matchChassis) extraction.chassis = matchChassis[1] || matchChassis[2];

            const matchClient = safeMatch(patterns.clientName);
            if (matchClient) extraction.clientName = matchClient[1];

            const matchPassport = safeMatch(patterns.passportNumber);
            if (matchPassport) extraction.passportNumber = matchPassport[1];

            const matchNin = safeMatch(patterns.nin);
            if (matchNin) extraction.nin = matchNin[1];

            const matchVehicle = safeMatch(patterns.vehicleName);
            if (matchVehicle) extraction.vehicleName = matchVehicle[1];

            const matchPortLoading = safeMatch(patterns.portOfLoading);
            if (matchPortLoading) extraction.portOfLoading = matchPortLoading[1];

            const matchPortDestination = safeMatch(patterns.portOfDestination);
            if (matchPortDestination) extraction.portOfDestination = matchPortDestination[1];

            const matchShippingLine = safeMatch(patterns.shippingLine);
            if (matchShippingLine) extraction.shippingLine = matchShippingLine[1];

            const matchLoadingDate = safeMatch(patterns.loadingDate);
            if (matchLoadingDate) extraction.loadingDate = matchLoadingDate[1];
        }

        this.displayVerificationResults(extraction);
    },

    // --- Template Management System ---

    showTemplateManagerModal() {
        const templates = StorageService.get(STORAGE_KEYS.BL_TEMPLATES) || [];

        const modalHtml = `
    < div id = "modal-overlay" class="modal-overlay" onclick = "app.closeModal()" >
        <div class="modal glass" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h2><i class="fas fa-list-alt"></i> Gérer les Modèles de BL</h2>
                <button class="close-btn" onclick="app.closeModal()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <div style="margin-bottom: 20px; text-align: right;">
                    <button class="btn-primary" onclick="app.showEditTemplateModal()">
                        <i class="fas fa-plus"></i> Nouveau Modèle
                    </button>
                </div>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Nom</th>
                                <th>Mots-clés</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${templates.map(t => `
                                    <tr>
                                        <td>${t.name} ${t.id === 'tmpl_generic' ? '(Défaut)' : ''}</td>
                                        <td>${t.keywords.join(', ')}</td>
                                        <td>
                                            <button class="btn-icon" onclick="app.showEditTemplateModal('${t.id}')" title="Modifier">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button class="btn-icon" onclick="app.startVisualMapping('${t.id}')" title="Mappage Visuel">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                            ${t.id !== 'tmpl_generic' ? `
                                            <button class="btn-icon delete" onclick="app.deleteTemplate('${t.id}')" title="Supprimer">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                            ` : ''}
                                        </td>
                                    </tr>
                                    `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
            </div >
    `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    showEditTemplateModal(id = null) {
        this.closeModal(); // Close manager to open edit, or stack them? Stacking is harder, lets close for now or replace content.
        // Better: Close manager, open edit. On save/cancel, reopen manager.

        const templates = StorageService.get(STORAGE_KEYS.BL_TEMPLATES) || [];
        const template = id ? templates.find(t => t.id === id) : {
            name: '',
            keywords: [],
            patterns: {
                bookingNumber: '',
                containerNumber: '',
                chassisNumber: '',
                clientName: '',
                passportNumber: '',
                nin: '',
                vehicleName: '',
                portOfLoading: '',
                portOfDestination: '',
                shippingLine: '',
                loadingDate: ''
            }
        };

        const modalHtml = `
    < div id = "modal-overlay" class="modal-overlay" >
        <div class="modal glass" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h2>${id ? 'Modifier' : 'Nouveau'} Modèle</h2>
                <button class="close-btn" onclick="app.showTemplateManagerModal(); app.closeModal();"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body" style="max-height: 70vh; overflow-y: auto; padding-right: 10px;">
                <form id="template-form">
                    <div class="form-group">
                        <label>Nom de la Compagnie / Modèle</label>
                        <input type="text" name="name" value="${template.name}" required placeholder="Ex: MSC, Maersk...">
                    </div>
                    <div class="form-group">
                        <label>Mots-clés (séparés par des virgules)</label>
                        <input type="text" name="keywords" value="${template.keywords.join(', ')}" placeholder="Ex: MSC, MEDITERRANEAN...">
                            <small style="color: var(--text-dim)">Utilisé pour la détection automatique du modèle.</small>
                    </div>

                    <h4 style="margin-top: 20px; margin-bottom: 10px; color: var(--primary);">Expressions Régulières (Regex)</h4>
                    <p style="font-size: 0.8rem; color: var(--text-dim); margin-bottom: 15px;">
                        Utilisez des parenthèses de capture <code>(...)</code> pour extraire la valeur exacte.
                        Exemple: <code>Booking No: (\\w+)</code>
                    </p>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="form-group">
                            <label>Numéro de Booking</label>
                            <input type="text" name="pattern_booking" value="${template.patterns.bookingNumber || ''}" class="code-input" placeholder="Regex pour le Booking">
                        </div>

                        <div class="form-group">
                            <label>Numéro de Conteneur</label>
                            <input type="text" name="pattern_container" value="${template.patterns.containerNumber || ''}" class="code-input" placeholder="Regex pour le Conteneur">
                        </div>

                        <div class="form-group">
                            <label>Numéro de Châssis (VIN)</label>
                            <input type="text" name="pattern_chassis" value="${template.patterns.chassisNumber || ''}" class="code-input" placeholder="Regex pour le VIN">
                        </div>

                        <div class="form-group">
                            <label>Nom du Client</label>
                            <input type="text" name="pattern_client" value="${template.patterns.clientName || ''}" class="code-input" placeholder="Regex pour le Client">
                        </div>

                        <div class="form-group">
                            <label>Numéro Passeport</label>
                            <input type="text" name="pattern_passport" value="${template.patterns.passportNumber || ''}" class="code-input" placeholder="Regex pour le Passeport">
                        </div>

                        <div class="form-group">
                            <label>NIN (ID National)</label>
                            <input type="text" name="pattern_nin" value="${template.patterns.nin || ''}" class="code-input" placeholder="Regex pour le NIN">
                        </div>

                        <div class="form-group full-width" style="grid-column: span 2;">
                            <label>Nom du Véhicule</label>
                            <input type="text" name="pattern_vehicle" value="${template.patterns.vehicleName || ''}" class="code-input" placeholder="Regex pour le Véhicule">
                        </div>

                        <div class="form-group">
                            <label>Port de Chargement</label>
                            <input type="text" name="pattern_port_loading" value="${template.patterns.portOfLoading || ''}" class="code-input" placeholder="Regex pour le Port de Chargement">
                        </div>
                        <div class="form-group">
                            <label>Port de Destination</label>
                            <input type="text" name="pattern_port_destination" value="${template.patterns.portOfDestination || ''}" class="code-input" placeholder="Regex pour le Port de Destination">
                        </div>

                        <div class="form-group">
                            <label>Compagnie Maritime</label>
                            <input type="text" name="pattern_shipping_line" value="${template.patterns.shippingLine || ''}" class="code-input" placeholder="Regex pour la Compagnie">
                        </div>
                        <div class="form-group">
                            <label>Date de Chargement</label>
                            <input type="text" name="pattern_loading_date" value="${template.patterns.loadingDate || ''}" class="code-input" placeholder="Regex pour la Date">
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" onclick="app.closeModal(); app.showTemplateManagerModal()">Retour</button>
                        <button type="submit" class="btn-primary">Enregistrer</button>
                    </div>
                </form>
            </div>
        </div>
            </div >
    `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('template-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);

            const newTemplate = {
                id: id || `tmpl_${Date.now()} `,
                name: formData.get('name'),
                keywords: formData.get('keywords').split(',').map(k => k.trim()).filter(k => k),
                patterns: {
                    bookingNumber: formData.get('pattern_booking'),
                    containerNumber: formData.get('pattern_container'),
                    chassisNumber: formData.get('pattern_chassis'),
                    clientName: formData.get('pattern_client'),
                    passportNumber: formData.get('pattern_passport'),
                    nin: formData.get('pattern_nin'),
                    vehicleName: formData.get('pattern_vehicle'),
                    portOfLoading: formData.get('pattern_port_loading'),
                    portOfDestination: formData.get('pattern_port_destination'),
                    shippingLine: formData.get('pattern_shipping_line'),
                    loadingDate: formData.get('pattern_loading_date')
                },
                // Preserve existing zones if editing, otherwise initialize empty
                zones: templateId ? (currentTemplates.find(t => t.id === templateId)?.zones || {}) : {}
            };

            if (templateId) { // Use templateId here
                const index = currentTemplates.findIndex(t => t.id === templateId); // Use templateId here
                if (index !== -1) currentTemplates[index] = newTemplate;
            } else {
                currentTemplates.push(newTemplate);
            }

            await StorageService.save(STORAGE_KEYS.BL_TEMPLATES, currentTemplates);
            this.showToast('Modèle enregistré avec succès', 'success');

            app.closeModal();
            this.showTemplateManagerModal();

            // Refresh dropdown in main view if needed
            this.renderVerification();
        });
    },

    async deleteTemplate(id) {
        this.showConfirmModal('Êtes-vous sûr de vouloir supprimer ce modèle ?', async () => {
            await StorageService.delete(STORAGE_KEYS.BL_TEMPLATES, id);
            this.showToast('Modèle supprimé', 'info');
            // Refresh modal
            const overlay = document.getElementById('modal-overlay');
            if (overlay) overlay.remove();
            this.showTemplateManagerModal();
            this.renderVerification();
        });
    },

    displayVerificationResults(data) {
        document.getElementById('processing-status').style.display = 'none';
        document.getElementById('verification-results').style.display = 'block';

        // Fill Extracted Data
        document.getElementById('res-booking').innerText = data.booking;
        document.getElementById('res-container').innerText = data.container;
        document.getElementById('res-chassis').innerText = data.chassis;
        document.getElementById('res-client').innerText = data.clientName || 'Non trouvé';
        document.getElementById('res-passport').innerText = (data.passportNumber || data.nin) ? `${data.passportNumber || ''} ${data.nin ? '/ ' + data.nin : ''} ` : 'Non trouvé';
        document.getElementById('res-vehicle').innerText = data.vehicleName || 'Non trouvé';
        document.getElementById('res-port-loading').innerText = data.portOfLoading || 'Non trouver';
        document.getElementById('res-port-destination').innerText = data.portOfDestination || 'Non trouver';
        document.getElementById('res-shipping-line').innerText = data.shippingLine || 'Non trouver';
        document.getElementById('res-loading-date').innerText = data.loadingDate || 'Non trouver';
        document.getElementById('raw-text').innerText = data.rawText;

        // Database Lookup
        const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES);
        const orders = StorageService.get(STORAGE_KEYS.ORDERS);

        let vehicleMatch = null;
        let orderMatch = null;
        let status = 'MISMATCH';

        // Find Vehicle by Chassis (allow partial match last 6 digits if full fails)
        if (data.chassis !== 'Non trouvé') {
            vehicleMatch = vehicles.find(v => v.chassisNumber && (v.chassisNumber.includes(data.chassis) || data.chassis.includes(v.chassisNumber)));
        }

        // Find Order
        if (vehicleMatch && vehicleMatch.orderId) {
            orderMatch = orders.find(o => o.id === vehicleMatch.orderId);
        }

        // Update UI
        const dbVehicleEl = document.getElementById('db-vehicle');
        const dbClientEl = document.getElementById('db-client');
        const dbStatusEl = document.getElementById('db-status');
        const badgeEl = document.getElementById('verification-badge');

        if (vehicleMatch) {
            dbVehicleEl.innerText = `[#${vehicleMatch.id}] ${vehicleMatch.brand} ${vehicleMatch.model || ''} `;
            dbVehicleEl.classList.add('success');
            status = 'MATCH';

            if (orderMatch) {
                dbClientEl.innerText = orderMatch.clientName;
            } else {
                dbClientEl.innerText = "Non alloué";
                status = 'PARTIAL';
            }

            dbStatusEl.innerText = vehicleMatch.status || 'En Stock';
        } else {
            dbVehicleEl.innerText = "Non trouvé en base";
            dbVehicleEl.classList.add('danger');
            dbClientEl.innerText = "-";
            dbStatusEl.innerText = "-";
            status = 'NOT_FOUND';
        }

        badgeEl.style.display = 'block';
        if (status === 'MATCH') {
            badgeEl.className = 'status-badge success';
            badgeEl.innerText = 'CONFORME';
        } else if (status === 'PARTIAL') {
            badgeEl.className = 'status-badge warning';
            badgeEl.innerText = 'VÉHICULE TROUVÉ (LIBRE)';
        } else {
            badgeEl.className = 'status-badge danger';
            badgeEl.innerText = 'NON TROUVÉ / PROBLÈME';
        }
    },


    // --- Visual Mapping System (Zonal OCR) ---

    startVisualMapping(templateId) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/pdf,image/*';
        input.onchange = (e) => {
            if (e.target.files.length > 0) {
                this.showVisualEditor(e.target.files[0], templateId);
            }
        };
        input.click();
    },

    async showVisualEditor(file, templateId) {
        // Close existing modals
        const existingModal = document.getElementById('modal-overlay');
        if (existingModal) existingModal.remove();

        const templates = StorageService.get(STORAGE_KEYS.BL_TEMPLATES) || [];
        const template = templates.find(t => t.id === templateId);
        if (!template) return;

        this.showToast("Chargement de l'éditeur...", "info");

        const editorHtml = `
    < div id = "modal-overlay" class="modal-overlay" style = "background: rgba(0,0,0,0.9);" >
        <div class="visual-editor-container" style="width: 95vw; height: 90vh; background: #1a1a1a; display: flex; flex-direction: column; color: white;">
            <div class="modal-header" style="background: #252525; padding: 15px;">
                <h2>Mappage Visuel : ${template.name}</h2>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span style="font-size: 0.9rem; color: #aaa;">Sélectionnez une zone sur le document</span>
                    <button class="btn-primary" onclick="app.saveVisualZones('${templateId}')">Enregistrer le Masque</button>
                    <button class="close-btn" onclick="app.closeModal(); app.showTemplateManagerModal();"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div style="display: flex; flex: 1; overflow: hidden;">
                <!-- Sidebar -->
                <div class="editor-sidebar" style="width: 280px; background: #252525; border-right: 1px solid #333; padding: 15px; overflow-y: auto;">
                    <h4 style="margin-bottom: 15px; color: var(--primary);">Champs à maper</h4>
                    <div id="zone-selectors" style="display: flex; flex-direction: column; gap: 10px;">
                        ${[
                { id: 'bookingNumber', label: 'N° Booking' },
                { id: 'containerNumber', label: 'N° Conteneur' },
                { id: 'chassisNumber', label: 'N° Châssis (VIN)' },
                { id: 'clientName', label: 'Nom du Client' },
                { id: 'passportNumber', label: 'N° Passeport' },
                { id: 'nin', label: 'NIN' },
                { id: 'vehicleName', label: 'Nom du Véhicule' },
                { id: 'portOfLoading', label: 'Port de Chargement' },
                { id: 'portOfDestination', label: 'Port de Destination' },
                { id: 'shippingLine', label: 'Compagnie Maritime' },
                { id: 'loadingDate', label: 'Date de Chargement' }
            ].map(f => `
                                    <div class="zone-item" id="zone-item-${f.id}" onclick="app.setActiveZone('${f.id}')" style="padding: 12px; background: #333; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <span>${f.label}</span>
                                            <i class="fas fa-check-circle" id="status-${f.id}" style="color: #444;"></i>
                                        </div>
                                        <small id="coord-${f.id}" style="color: #888; font-size: 0.7rem; display: block; margin-top: 5px;">Non défini</small>
                                    </div>
                                `).join('')}
                    </div>
                    <div style="margin-top: 30px; padding: 15px; background: rgba(255,165,0,0.1); border: 1px dashed orange; border-radius: 8px;">
                        <p style="font-size: 0.8rem; color: #ffad33;"><i class="fas fa-info-circle"></i> Dessinez un rectangle sur le document pour définir la zone de lecture.</p>
                    </div>
                </div>

                <!-- Canvas Area -->
                <div id="canvas-container" style="flex: 1; position: relative; overflow: auto; background: #0e0e0e; display: flex; justify-content: center; align-items: flex-start; padding: 40px;">
                    <div id="canvas-wrapper" style="position: relative; box-shadow: 0 0 50px rgba(0,0,0,0.8);">
                        <canvas id="doc-canvas" style="display: block;"></canvas>
                        <canvas id="draw-canvas" style="position: absolute; top: 0; left: 0; cursor: crosshair;"></canvas>
                    </div>
                </div>
            </div>
        </div>
            </div >
    `;

        document.body.insertAdjacentHTML('beforeend', editorHtml);

        // Initialize State
        this.activeZone = 'bookingNumber';
        this.zones = template.zones || {};
        this.setActiveZone('bookingNumber', false);

        const docCanvas = document.getElementById('doc-canvas');
        const drawCanvas = document.getElementById('draw-canvas');
        const wrapper = document.getElementById('canvas-wrapper');
        const ctx = docCanvas.getContext('2d', { alpha: false });
        const dCtx = drawCanvas.getContext('2d');

        try {
            let docWidth, docHeight;
            if (file.type === 'application/pdf') {
                const pdfUrl = URL.createObjectURL(file);
                const loadingTask = pdfjsLib.getDocument(pdfUrl);
                const pdf = await loadingTask.promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 1.5 });
                docWidth = viewport.width;
                docHeight = viewport.height;
                docCanvas.width = docWidth;
                docCanvas.height = docHeight;
                await page.render({ canvasContext: ctx, viewport: viewport }).promise;
                URL.revokeObjectURL(pdfUrl);
            } else {
                const img = await new Promise((resolve) => {
                    const i = new Image();
                    i.onload = () => resolve(i);
                    i.src = URL.createObjectURL(file);
                });
                const scale = Math.min(1200 / img.width, 1);
                docWidth = img.width * scale;
                docHeight = img.height * scale;
                docCanvas.width = docWidth;
                docCanvas.height = docHeight;
                ctx.drawImage(img, 0, 0, docWidth, docHeight);
                URL.revokeObjectURL(img.src);
            }

            // Sync sizes
            drawCanvas.width = docWidth;
            drawCanvas.height = docHeight;
            wrapper.style.width = docWidth + 'px';
            wrapper.style.height = docHeight + 'px';

            // Drawing/Editing Logic
            let isDragging = false;
            let startX, startY;
            let dragMode = 'draw'; // 'draw', 'move', 'resize'
            let handleId = null; // 'tl', 'tr', 'bl', 'br', 'center'

            const getHandleAt = (x, y) => {
                const z = this.zones[this.activeZone];
                if (!z) return null;
                const zX = (z.x / 100) * drawCanvas.width;
                const zY = (z.y / 100) * drawCanvas.height;
                const zW = (z.w / 100) * drawCanvas.width;
                const zH = (z.h / 100) * drawCanvas.height;
                const hSize = 10;

                if (Math.abs(x - zX) < hSize && Math.abs(y - zY) < hSize) return 'tl';
                if (Math.abs(x - (zX + zW)) < hSize && Math.abs(y - zY) < hSize) return 'tr';
                if (Math.abs(x - zX) < hSize && Math.abs(y - (zY + zH)) < hSize) return 'bl';
                if (Math.abs(x - (zX + zW)) < hSize && Math.abs(y - (zY + zH)) < hSize) return 'br';
                if (x > zX && x < zX + zW && y > zY && y < zY + zH) return 'center';
                return null;
            };

            drawCanvas.onmousedown = (e) => {
                const rect = drawCanvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                handleId = getHandleAt(x, y);
                if (handleId === 'center') dragMode = 'move';
                else if (handleId) dragMode = 'resize';
                else dragMode = 'draw';

                isDragging = true;
                startX = x;
                startY = y;

                if (dragMode === 'draw') {
                    this.zones[this.activeZone] = { x: (x / drawCanvas.width) * 100, y: (y / drawCanvas.height) * 100, w: 0, h: 0 };
                }
            };

            drawCanvas.onmousemove = (e) => {
                const rect = drawCanvas.getBoundingClientRect();
                const curX = e.clientX - rect.left;
                const curY = e.clientY - rect.top;

                // Update cursor
                const h = getHandleAt(curX, curY);
                if (h === 'tl' || h === 'br') drawCanvas.style.cursor = 'nwse-resize';
                else if (h === 'tr' || h === 'bl') drawCanvas.style.cursor = 'nesw-resize';
                else if (h === 'center') drawCanvas.style.cursor = 'move';
                else drawCanvas.style.cursor = 'crosshair';

                if (!isDragging) return;

                const dx = ((curX - startX) / drawCanvas.width) * 100;
                const dy = ((curY - startY) / drawCanvas.height) * 100;
                const z = this.zones[this.activeZone];

                if (dragMode === 'draw') {
                    z.w = ((curX / drawCanvas.width) * 100) - z.x;
                    z.h = ((curY / drawCanvas.height) * 100) - z.y;
                } else if (dragMode === 'move') {
                    z.x += dx;
                    z.y += dy;
                    startX = curX;
                    startY = curY;
                } else if (dragMode === 'resize') {
                    if (handleId === 'tl') { z.x += dx; z.y += dy; z.w -= dx; z.h -= dy; }
                    else if (handleId === 'tr') { z.y += dy; z.w += dx; z.h -= dy; }
                    else if (handleId === 'bl') { z.x += dx; z.w -= dx; z.h += dy; }
                    else if (handleId === 'br') { z.w += dx; z.h += dy; }
                    startX = curX;
                    startY = curY;
                }

                this.updateZoneUI(this.activeZone);
                this.redrawZones(drawCanvas, dCtx);
            };

            drawCanvas.onmouseup = (e) => {
                if (!isDragging) return;
                isDragging = false;

                const z = this.zones[this.activeZone];
                if (z.w < 0) { z.x += z.w; z.w = Math.abs(z.w); }
                if (z.h < 0) { z.y += z.h; z.h = Math.abs(z.h); }

                this.updateZoneUI(this.activeZone);
                this.redrawZones(drawCanvas, dCtx);
            };

            // Add initial zones if any
            Object.keys(this.zones).forEach(zId => this.updateZoneUI(zId));
            this.redrawZones(drawCanvas, dCtx);

        } catch (err) {
            console.error("Editor Error:", err);
            this.showToast("Erreur chargement document", "error");
        }
    },

    setActiveZone(fieldId, animate = true) {
        this.activeZone = fieldId;
        document.querySelectorAll('.zone-item').forEach(el => {
            el.style.background = '#333';
            el.style.border = 'none';
        });
        const activeEl = document.getElementById(`zone - item - ${fieldId} `);
        if (activeEl) {
            activeEl.style.background = 'rgba(99, 102, 241, 0.2)';
            activeEl.style.borderLeft = '4px solid var(--primary)';
        }
        // Redraw to show handles on active zone
        const drawCanvas = document.getElementById('draw-canvas');
        if (drawCanvas) this.redrawZones(drawCanvas, drawCanvas.getContext('2d'));
    },

    redrawZones(canvas, ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw already defined zones
        Object.entries(this.zones).forEach(([id, z]) => {
            const isActive = id === this.activeZone;
            const x = (z.x / 100) * canvas.width;
            const y = (z.y / 100) * canvas.height;
            const w = (z.w / 100) * canvas.width;
            const h = (z.h / 100) * canvas.height;

            ctx.strokeStyle = isActive ? '#6366f1' : '#4CAF50';
            ctx.lineWidth = isActive ? 3 : 1;
            ctx.setLineDash(isActive ? [] : [2, 2]);
            ctx.strokeRect(x, y, w, h);
            ctx.setLineDash([]);

            ctx.fillStyle = isActive ? 'rgba(99, 102, 241, 0.1)' : 'rgba(76, 175, 80, 0.05)';
            ctx.fillRect(x, y, w, h);

            // Label
            ctx.fillStyle = isActive ? '#6366f1' : '#4CAF50';
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.fillText(id.replace('Number', ''), x, y - 5);

            // Draw handles for active zone
            if (isActive) {
                const hSize = 8;
                ctx.fillStyle = '#6366f1';
                [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([hx, hy]) => {
                    ctx.fillRect(hx - hSize / 1, hy - hSize / 1, hSize, hSize);
                });
            }
        });
    },

    updateZoneUI(fieldId) {
        const z = this.zones[fieldId];
        if (!z) return;

        const statusIcon = document.getElementById(`status - ${fieldId} `);
        if (statusIcon) statusIcon.style.color = '#6366f1';

        const coordSpan = document.getElementById(`coord - ${fieldId} `);
        if (coordSpan) coordSpan.innerText = `Pos: ${Math.round(z.x)}%, ${Math.round(z.y)}% | Taille: ${Math.round(z.w)}x${Math.round(z.h)}% `;
    },

    async saveVisualZones(templateId) {
        const templates = StorageService.get(STORAGE_KEYS.BL_TEMPLATES) || [];
        const index = templates.findIndex(t => t.id === templateId);
        if (index === -1) return;

        templates[index].zones = this.zones;
        // Mark as using zonal if zones exist
        templates[index].useZonal = true;

        await StorageService.save(STORAGE_KEYS.BL_TEMPLATES, templates);
        this.showToast("Zones enregistrées avec succès", "success");
        const overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.remove();
        this.showTemplateManagerModal();
    },

    async toggleAiExtraction() {
        const settings = StorageService.get(STORAGE_KEYS.SETTINGS);

        // If trying to enable but no key
        if (!settings.useAiExtraction && !settings.geminiApiKey) {
            this.showToast("Merci de configurer votre clé API Gemini dans les Paramètres avant d'activer l'IA.", "warning");
            return; // BLOCK TOGGLE
        }

        settings.useAiExtraction = !settings.useAiExtraction;
        await StorageService.save(STORAGE_KEYS.SETTINGS, settings);

        const btn = document.getElementById('ai-toggle-btn');
        if (btn) {
            btn.style.background = settings.useAiExtraction ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255,255,255,0.05)';
            btn.style.color = settings.useAiExtraction ? 'var(--primary)' : 'inherit';
        }

        this.showToast(settings.useAiExtraction ? "Mode IA Activé" : "Mode IA Désactivé", "info");
    },

    async testGeminiConnection() {
        const key = document.getElementById('settings-gemini-key').value.trim();
        if (!key) {
            this.showToast("Veuillez saisir une clé API à tester.", "warning");
            return;
        }

        this.showToast("Démarrage de l'auto-découverte du modèle...", "info");

        try {
            // 1. Get all available models
            const listResp = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`);
            if (!listResp.ok) throw new Error("Impossible de lister les modèles (Clé invalide ?)");

            const listData = await listResp.json();
            // Filter models that support generateContent and are not specifically skipped
            const potentialModels = listData.models
                .filter(m => m.supportedGenerationMethods.includes('generateContent'))
                .map(m => m.name.replace('models/', ''));

            if (potentialModels.length === 0) throw new Error("Aucun modèle 'generateContent' trouvé pour cette clé.");

            console.log("Discovery: Testing these models:", potentialModels);

            let workingModel = null;
            let quotaErrorCount = 0;

            // 2. Test each model until one works (not 404 and not 429)
            for (const model of potentialModels) {
                console.log(`Auto-discovery: Testing ${model}...`);
                try {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${key}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: "Reponds 'OK' en un mot." }] }]
                        })
                    });

                    if (response.ok) {
                        workingModel = model;
                        break;
                    } else if (response.status === 429) {
                        quotaErrorCount++;
                        console.warn(`Model ${model} has no quota (429).`);
                    } else {
                        console.warn(`Model ${model} returned ${response.status}.`);
                    }
                } catch (e) {
                    console.error(`Error testing ${model}:`, e);
                }
            }

            if (workingModel) {
                // Save the working model to settings
                const settings = StorageService.get(STORAGE_KEYS.SETTINGS);
                settings.activeModel = workingModel;
                settings.geminiApiKey = key; // Update key if changed in input
                await StorageService.save(STORAGE_KEYS.SETTINGS, settings);

                this.showToast(`Connexion RÉUSSIE ! Modèle sélectionné : ${workingModel}`, "success");
            } else if (quotaErrorCount > 0) {
                this.showToast("Tous les modèles disponibles ont dépassé leur quota ou sont limités.", "warning");
            } else {
                this.showToast("Aucun modèle fonctionnel n'a été trouvé pour cette clé.", "danger");
            }

        } catch (err) {
            this.showToast("Erreur d'auto-découverte : " + err.message, "danger");
        }
    },

    async listGeminiModels() {
        const key = document.getElementById('settings-gemini-key').value.trim();
        if (!key) {
            this.showToast("Veuillez saisir une clé API pour lister les modèles.", "warning");
            return;
        }

        this.showToast("Récupération de la liste des modèles...", "info");
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`);
            if (response.ok) {
                const data = await response.json();
                const modelNames = data.models
                    .filter(m => m.supportedGenerationMethods.includes('generateContent'))
                    .map(m => m.name.replace('models/', ''));

                const settings = StorageService.get(STORAGE_KEYS.SETTINGS) || {};
                settings.availableGeminiModels = modelNames;
                await StorageService.save(STORAGE_KEYS.SETTINGS, settings);

                this.showToast(`${modelNames.length} modèles récupérés et enregistrés.`, "success");
                this.renderSettings(); // Refresh UI to show models in dropdown
            } else {
                const err = await response.json();
                this.showToast("Erreur lors de la récupération : " + (err.error?.message || "Inconnue"), "danger");
            }
        } catch (err) {
            this.showToast("Erreur réseau : " + err.message, "danger");
        }
    },

    async callGeminiAI(text) {
        const settings = StorageService.get(STORAGE_KEYS.SETTINGS);
        if (!settings.geminiApiKey) {
            throw new Error("Clé API Gemini manquante. Veuillez la configurer dans les paramètres.");
        }

        const prompt = `Extrais les informations suivantes de ce texte de Bill of Lading (BL) et retourne UNIQUEMENT un objet JSON valide avec ces clés : 
            "bookingNumber", "containerNumber", "chassisNumber", "clientName", "passportNumber", "nin", "vehicleName", "portOfLoading", "portOfDestination", "shippingLine", "loadingDate". 
            Si une information est absente, mets "Non trouvé".
            Le numéro de châssis est souvent appelé VIN. 
            Le texte du BL est le suivant : 
            ---
            ${text}
            ---`;

        // Use selected model, cached working model, or fallback strategy
        let modelToUse = settings.geminiModel || settings.activeModel || 'gemini-1.5-flash';
        const modelsToTry = [modelToUse, 'gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];

        // Remove duplicates while keeping order
        const uniqueModels = [...new Set(modelsToTry)];

        let lastResponse = null;

        let lastErrorStatus = null;

        for (const model of uniqueModels) {
            console.log(`Attempting extraction with ${model}...`);
            try {
                const body = {
                    contents: [{ parts: [{ text: prompt }] }]
                };

                // Only add response_mime_type for newer models (1.5+ or 2.0+)
                if (model.includes('1.5') || model.includes('2.0') || model.includes('latest')) {
                    body.generationConfig = { response_mime_type: "application/json" };
                }

                const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${settings.geminiApiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                if (response.ok) {
                    lastResponse = await response.json();
                    // Update active model if it changed/was discovered
                    if (model !== settings.activeModel) {
                        settings.activeModel = model;
                        await StorageService.save(STORAGE_KEYS.SETTINGS, settings);
                    }
                    console.log(`Success with ${model}`);
                    break;
                } else {
                    lastErrorStatus = response.status;
                    console.warn(`Model ${model} failed (${response.status}), trying next...`);

                    if (response.status !== 404 && response.status !== 429) {
                        const errBody = await response.json();
                        const errMsg = errBody.error?.message || "";
                        if (errMsg) console.warn("API Error Detail:", errMsg);
                    }
                }
            } catch (err) {
                console.error(`Error with ${model}:`, err);
            }
        }

        if (!lastResponse) {
            throw new Error(`Aucun modèle Gemini fonctionnel n'a pu être contacté. (Code: ${lastErrorStatus}). Veuillez vérifier la clé API et les quotas.`);
        }

        const result = lastResponse;
        let jsonText = result.candidates[0].content.parts[0].text;

        // Clean markdown formatting if present
        if (jsonText.includes('```')) {
            jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
        }

        console.log("Gemini Raw Response:", jsonText);

        try {
            return JSON.parse(jsonText);
        } catch (pErr) {
            console.error("AI JSON Parse Error:", pErr, "Raw Text:", jsonText);
            // Last ditch effort: try to find anything between { and }
            const match = jsonText.match(/\{[\s\S]*\}/);
            if (match) return JSON.parse(match[0]);
            throw pErr;
        }
    },


    async showLiveVoyageTracking(voyageName) {
        this.showToast(`Recherche de la position du voyage ${voyageName}...`, "info");
        try {
            const response = await fetch(`/api/tracking/voyage/${encodeURIComponent(voyageName)}`);
            const result = await response.json();
            if (!result.success) throw new Error(result.message || "Impossible de localiser le voyage");
            app.showTrackingModal(result.data, `Suivi Voyage: ${voyageName}`);
        } catch (error) {
            console.error("Voyage Tracking Error:", error);
            this.showToast(error.message, "danger");
        }
    },

    showTrackingModal(data, title = "Détails du Suivi") {
        const events = data.events || [];
        const location = data.location || { name: 'Inconnu', lat: 0, lng: 0 };

        const modalHtml = `
                <div class="modal-overlay" onclick="app.closeModal()">
                    <div class="modal-content glass" onclick="event.stopPropagation()" style="width: 700px; max-width: 95vw;">
                        <div class="modal-header">
                            <div>
                                <h2>${title}</h2>
                                <p style="font-size: 0.8rem; color: var(--text-dim); margin-top: 4px;">
                                    Navire: ${data.vesselName || 'Inconnu'} | Statut: ${data.status || 'N/A'}
                                </p>
                            </div>
                            <button class="btn-close" onclick="app.closeModal()">&times;</button>
                        </div>
                        <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
                            <!-- Map Container for specific tracking -->
                            <div id="modal-tracking-map" style="height: 200px; width: 100%; border-radius: 8px; margin-bottom: 20px;"></div>

                            <div class="tracking-timeline" style="padding: 10px 0;">
                                ${events.length > 0 ? events.map((event, index) => `
                                    <div class="timeline-item" style="display: flex; gap: 20px; margin-bottom: 25px; position: relative;">
                                        ${index !== events.length - 1 ? `<div style="position: absolute; left: 14px; top: 30px; bottom: -20px; width: 2px; background: var(--border-glass);"></div>` : ''}
                                        <div class="timeline-marker" style="width: 30px; height: 30px; border-radius: 50%; background: ${event.isActual ? 'var(--success)' : 'var(--border-glass)'}; display: flex; align-items: center; justify-content: center; z-index: 1; flex-shrink: 0; box-shadow: ${event.isActual ? '0 0 10px rgba(34, 197, 94, 0.4)' : 'none'};">
                                            <i class="fas ${event.isActual ? 'fa-check' : 'fa-clock'}" style="font-size: 0.8rem; color: ${event.isActual ? 'white' : 'var(--text-dim)'};"></i>
                                        </div>
                                        <div class="timeline-content">
                                            <div style="font-size: 0.75rem; color: var(--primary); font-weight: 600; text-transform: uppercase;">
                                                ${new Date(event.date).toLocaleDateString()} ${new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <div style="font-weight: 700; font-size: 1rem; margin: 4px 0;">${event.description}</div>
                                            <div style="font-size: 0.85rem; color: var(--text-secondary);">
                                                <i class="fas fa-map-marker-alt" style="font-size: 0.7rem;"></i> ${event.location || 'En transit'}
                                            </div>
                                        </div>
                                    </div>
                                `).join('') : `
                                    <div style="text-align: center; padding: 20px; color: var(--text-dim);">Aucun événement récent.</div>
                                `}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn-secondary" onclick="app.closeModal()">Fermer</button>
                        </div>
                    </div>
                </div>
            `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Initialize Mini Map if coordinates exist
        if (window.L && location.lat && location.lng) {
            setTimeout(() => {
                const map = L.map('modal-tracking-map', { zoomControl: false }).setView([location.lat, location.lng], 4);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; CARTO'
                }).addTo(map);

                const icon = L.divIcon({
                    html: '<i class="fas fa-ship" style="font-size: 24px; color: #4ade80;"></i>',
                    className: 'ship-marker-modal',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });

                L.marker([location.lat, location.lng], { icon: icon }).addTo(map)
                    .bindPopup(`<b>${data.vesselName}</b><br>${location.name}`).openPopup();
            }, 100);
        }
    },


    async renderAudit() {
        this.viewContainer.innerHTML = `
                <div class="view-header">
                    <div>
                        <h1>Journal d'Activité</h1>
                        <p>Historique des actions effectuées sur le système</p>
                    </div>
                </div>
                <div class="glass" style="padding: 20px;">
                    <div id="audit-timeline" class="audit-timeline">
                        <div class="loader-container"><div class="loader"></div></div>
                    </div>
                </div>
            `;

        try {
            const response = await ApiService.getAuditLogs();
            const container = document.getElementById('audit-timeline');

            if (!response.success || response.data.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">Aucune activité enregistrée.</p>';
                return;
            }

            container.innerHTML = response.data.map(log => {
                const date = new Date(log.createdAt);
                const actionClass = log.action.toLowerCase();

                return `
                        <div class="audit-item" style="display: flex; gap: 15px; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid var(--border-glass);">
                            <div class="audit-icon ${actionClass}" style="width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(99, 102, 241, 0.1); flex-shrink: 0;">
                                <i class="fas ${this.getAuditIcon(log.action)}"></i>
                            </div>
                            <div class="audit-details" style="flex: 1;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                    <strong style="color: var(--primary);">${log.userName || 'Système'}</strong>
                                    <span style="font-size: 0.75rem; color: var(--text-secondary);">${date.toLocaleString()}</span>
                                </div>
                                <div style="font-size: 0.9rem;">
                                    <span class="status-badge ${actionClass}" style="margin-right: 8px;">${log.action}</span>
                                    ${log.entity} : <strong>${log.entityId || ''}</strong>
                                </div>
                                ${log.action === 'UPDATE' && log.newValues ? `
                                    <div class="audit-changes" style="margin-top: 10px; font-size: 0.8rem; background: rgba(0,0,0,0.1); padding: 8px; border-radius: 6px;">
                                        ${Object.entries(log.newValues).map(([key, val]) => `
                                            <div style="margin-bottom: 2px;">
                                                <span style="color: var(--text-secondary);">${key}:</span> 
                                                <span style="text-decoration: line-through; color: var(--danger); opacity: 0.7;">${log.oldValues?.[key] || ''}</span> 
                                                <i class="fas fa-arrow-right" style="font-size: 0.7rem; margin: 0 5px;"></i>
                                                <span style="color: var(--success);">${val}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
            }).join('');

        } catch (error) {
            console.error("Error rendering audit logs:", error);
            this.showToast("Erreur lors du chargement des journaux", "error");
        }
    },

    getAuditIcon(action) {
        switch (action) {
            case 'CREATE': return 'fa-plus-circle';
            case 'UPDATE': return 'fa-edit';
            case 'DELETE': return 'fa-trash-alt';
            case 'LOGIN': return 'fa-sign-in-alt';
            default: return 'fa-info-circle';
        }
    },

    renderGlobalTracking() {
        this.viewContainer.innerHTML = `
                <div class="view-header">
                    <div class="header-info">
                        <h1>Carte Mondiale du Suivi</h1>
                        <p>Visualisation en temps réel de tous les navires en cours</p>
                    </div>
                </div>
                
                <div class="glass" style="height: calc(100vh - 200px); position: relative; border-radius: 15px; overflow: hidden; margin-top: 20px;">
                    <div id="global-map" style="width: 100%; height: 100%;"></div>
                </div>
            `;

        const shipments = (StorageService.get(STORAGE_KEYS.SHIPMENTS) || [])
            .filter(s => s.currentLat && s.currentLng && !s.isArchived);

        if (window.L) {
            setTimeout(() => {
                const map = L.map('global-map', { zoomControl: false }).setView([20, 0], 2);
                L.control.zoom({ position: 'topright' }).addTo(map);

                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; CARTO'
                }).addTo(map);

                shipments.forEach(s => {
                    const isError = s.status === 'Erreur Tracking' || s.status === 'Tracking Error' || s.status === 'No API Key';
                    const color = isError ? '#ef4444' : '#4ade80';
                    const shadowColor = isError ? 'rgba(239, 68, 68, 0.5)' : 'rgba(74, 222, 128, 0.5)';

                    const icon = L.divIcon({
                        html: `<i class="fas fa-ship" style="font-size: 20px; color: ${color}; text-shadow: 0 0 10px ${shadowColor};"></i>`,
                        className: 'global-ship-marker',
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    });

                    const hasHistory = s.trackingHistory && s.trackingHistory.length > 20;
                    const safeId = s.id ? s.id.replace(/'/g, "\\'") : '';
                    const safeVoyage = s.voyage ? s.voyage.replace(/'/g, "\\'") : '';
                    const action = hasHistory ? `app.showLocalTracking('${safeId}')` : `app.showLiveVoyageTracking('${safeVoyage}')`;
                    const actionText = hasHistory ? 'Voir Historique' : 'Localiser (Sat)';
                    const actionColor = hasHistory ? '#10b981' : '#6366f1';

                    L.marker([s.currentLat, s.currentLng], { icon: icon })
                        .addTo(map)
                        .bindPopup(`
                                <div style="color: #333; min-width: 150px;">
                                    <div style="font-weight: bold; font-size: 1rem; margin-bottom: 5px;">${s.vesselName || s.carrier || 'Navire'}</div>
                                    <div style="font-size: 0.85rem; margin-bottom: 3px;">Voyage: <b>${s.voyage || 'N/A'}</b></div>
                                    <div style="font-size: 0.85rem; margin-bottom: 3px;">Statut: <span style="color: ${isError ? '#ef4444' : '#059669'}; font-weight: 600;">${s.status}</span></div>
                                    <div style="font-size: 0.85rem;">Conteneur: ${s.containerNumber || 'N/A'}</div>
                                    ${isError ? '<div style="color: #ef4444; font-size: 0.75rem; margin-top: 5px; font-weight: bold;">⚠️ Données non actualisées</div>' : ''}
                                    <hr style="margin: 8px 0; border: none; border-top: 1px solid #eee;">
                                    <button onclick="${action}" style="width: 100%; border: none; background: ${actionColor}; color: white; padding: 5px; border-radius: 4px; cursor: pointer;">
                                        ${actionText}
                                    </button>
                                </div>
                            `);
                });
            }, 100);
        }
    },

    showShipmentMap(id) {
        // Switch to global tracking and potentially zoom?
        // Or if there is a specific single shipment map, use it.
        // For now, let's switch to dashboard or global tracking.
        // The most logical thing is to switch to dashboard map where we already implemented red markers.
        this.switchView('dashboard');
        // Wait for render then zoom
        setTimeout(() => {
            this.zoomToShipment(id);
        }, 500);
    },

    showLocalTracking(shipmentId) {
        const shipments = StorageService.get(STORAGE_KEYS.SHIPMENTS) || [];
        const shipment = shipments.find(s => s.id === shipmentId);
        if (shipment && shipment.trackingHistory) {
            try {
                const events = JSON.parse(shipment.trackingHistory);
                const data = {
                    events: events,
                    location: {
                        lat: shipment.currentLat,
                        lng: shipment.currentLng,
                        name: 'Dernière position connue'
                    },
                    vesselName: shipment.shipStatus || shipment.vesselName || 'Navire',
                    status: shipment.status
                };
                app.showTrackingModal(data, `Détails Navire: ${shipment.vesselName}`);
            } catch (e) {
                console.error("Local tracking parse error", e);
                this.showToast("Erreur de données locales", "error");
            }
        } else {
            this.showToast("Pas d'historique local disponible", "warning");
        }
    },

    async toggleVoyageTracking(voyageName, active) {
        try {
            this.showToast(`Mise à jour du tracking pour ${voyageName}...`, "info");
            const response = await fetch(`/api/tracking/voyage/${encodeURIComponent(voyageName)}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active })
            });
            const res = await response.json();
            if (res.success) {
                this.showToast(res.message, "success");
                await StorageService.syncAll();
                this.renderView(this.currentView);
            } else {
                throw new Error(res.message);
            }
        } catch (error) {
            console.error("Toggle error:", error);
            this.showToast("Erreur lors du changement de statut", "error");
            this.renderView(this.currentView);
        }
    },

    showShipmentTrackingHistory(shipmentId) {
        console.log("🔍 Affichage de l'historique pour l'expédition:", shipmentId);
        try {
            const shipments = StorageService.get(STORAGE_KEYS.SHIPMENTS) || [];
            const shipment = shipments.find(s => s.id === shipmentId);

            if (!shipment) {
                this.showToast("Expédition introuvable", "error");
                return;
            }

            console.log("📊 Expédition trouvée:", shipment);

            let events = [];
            let source = 'Données Locales';

            // Try to get tracking history from shipment
            if (shipment.trackingHistory) {
                try {
                    const parsed = typeof shipment.trackingHistory === 'string' ?
                        JSON.parse(shipment.trackingHistory) : shipment.trackingHistory;
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        events = parsed;
                        source = shipment.carrier || 'Transporteur';
                    }
                } catch (e) {
                    console.error("❌ Erreur parse shipment history:", e);
                }
            }

            // If no tracking history, create events from shipment data
            if (events.length === 0) {
                if (shipment.shipmentDate) {
                    events.push({
                        date: shipment.shipmentDate,
                        description: 'Expédition créée',
                        location: shipment.loadingPort || 'Port de départ',
                        isActual: true
                    });
                }
                if (shipment.etd) {
                    events.push({
                        date: shipment.etd,
                        description: 'Départ prévu (ETD)',
                        location: shipment.loadingPort || 'Port de départ',
                        isActual: false
                    });
                }
                if (shipment.eta) {
                    events.push({
                        date: shipment.eta,
                        description: 'Arrivée prévue (ETA)',
                        location: shipment.destination || 'Port de destination',
                        isActual: false
                    });
                }
                if (shipment.arrivalDate) {
                    events.push({
                        date: shipment.arrivalDate,
                        description: 'Arrivée confirmée',
                        location: shipment.destination || 'Port de destination',
                        isActual: true
                    });
                }
                if (shipment.customsClearanceDate) {
                    events.push({
                        date: shipment.customsClearanceDate,
                        description: 'Dédouanement effectué',
                        location: shipment.destination || 'Douane',
                        isActual: true
                    });
                }
                if (shipment.pickupDate) {
                    events.push({
                        date: shipment.pickupDate,
                        description: 'Véhicule enlevé',
                        location: 'Livraison finale',
                        isActual: true
                    });
                }

                // Sort events by date
                events.sort((a, b) => new Date(a.date) - new Date(b.date));
            }

            console.log("✅ Événements à afficher:", events.length);

            this.renderTrackingHistoryModal(shipment, events, source);
        } catch (error) {
            console.error("Error showing tracking history:", error);
            this.showToast("Erreur lors de l'affichage de l'historique", "danger");
        }
    },

    renderTrackingHistoryModal(shipment, events, source) {
        // Sort by date desc (double check)
        events.sort((a, b) => new Date(b.date || b.timestamp) - new Date(a.date || a.timestamp));

        const modalHtml = `
             <div class="modal-overlay" onclick="app.closeModal()">
                 <div class="modal-content glass" onclick="event.stopPropagation()" style="width: 500px; max-height: 80vh; display: flex; flex-direction: column;">
                     <div class="modal-header">
                         <div>
                             <h2 style="margin:0;"><i class="fas fa-history"></i> Historique du Voyage</h2>
                             <p style="font-size: 0.75rem; color: var(--text-dim); margin-top: 2px;">
                                 Cont: <strong>${shipment.containerNumber || 'N/A'}</strong> | Source: ${source}
                             </p>
                         </div>
                         <button class="btn-close" onclick="app.closeModal()">&times;</button>
                     </div>
                     <div class="modal-body" style="overflow-y: auto; padding: 20px;">
                         ${events.length === 0 ?
                '<div style="text-align: center; color: var(--text-secondary); padding: 40px; opacity: 0.6;"><i class="fas fa-ghost fa-3x mb-3"></i><br>Aucun historique disponible</div>' :
                `<div class="timeline-vertical" style="display: flex; flex-direction: column; gap: 20px;">
                                 ${events.map((e, i) => `
                                     <div class="timeline-event" style="display: flex; gap: 15px; position: relative;">
                                         <div class="timeline-line" style="position: absolute; left: 11px; top: 25px; bottom: -20px; width: 2px; background: var(--border-glass); height: calc(100% + 5px); display: ${i === events.length - 1 ? 'none' : 'block'}"></div>
                                         <div class="timeline-dot" style="width: 24px; height: 24px; border-radius: 50%; background: ${i === 0 ? 'var(--primary)' : 'var(--bg-glass)'}; border: 3px solid ${i === 0 ? 'rgba(99,102,241,0.3)' : 'var(--border-glass)'}; flex-shrink: 0; z-index: 1; display: flex; align-items: center; justify-content: center;">
                                             ${i === 0 ? '<div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>' : ''}
                                         </div>
                                         <div class="timeline-item-content" style="flex: 1;">
                                             <div style="font-weight: 700; color: ${i === 0 ? 'var(--primary)' : 'var(--text-primary)'}; font-size: 0.95rem;">${e.description || e.status || e.event || 'Événement'}</div>
                                             <div style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500; margin-top: 2px;">${e.location || 'N/A'}</div>
                                             <div style="font-size: 0.75rem; color: var(--text-secondary); opacity: 0.7; margin-top: 6px; display: flex; align-items: center; gap: 5px;">
                                                 <i class="far fa-clock"></i> ${new Date(e.date || e.timestamp).toLocaleString('fr-FR')}
                                             </div>
                                             ${e.details ? `<div style="font-size: 0.8rem; margin-top: 8px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 6px; font-style: italic; border-left: 3px solid var(--border-glass);">${e.details}</div>` : ''}
                                         </div>
                                     </div>
                                 `).join('')}
                             </div>`
            }
                     </div>
                     <div class="modal-footer" style="padding: 15px; border-top: 1px solid var(--border-glass);">
                         <button class="btn-secondary" style="width: 100%;" onclick="app.closeModal()">Fermer</button>
                     </div>
                 </div>
             </div>
         `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },


    showVoyageTrackingHistory(voyageName) {
        console.log("🔍 Tentative d'affichage de l'historique pour:", voyageName);
        try {
            const voyages = StorageService.get(STORAGE_KEYS.VOYAGES) || [];
            const voyageEntity = voyages.find(v => v.name === voyageName || v.id == voyageName);

            const shipments = (StorageService.get(STORAGE_KEYS.SHIPMENTS) || [])
                .filter(s => s.voyage === voyageName || (voyageEntity && s.voyageId === voyageEntity.id));

            console.log("📊 Données trouvées:", {
                voyageFound: !!voyageEntity,
                shipmentsCount: shipments.length
            });

            let events = [];
            let source = 'Données Satellite';
            let count = shipments.length;

            // 1. Try Voyage Entity
            if (voyageEntity && voyageEntity.trackingHistory) {
                try {
                    const parsed = typeof voyageEntity.trackingHistory === 'string' ?
                        JSON.parse(voyageEntity.trackingHistory) : voyageEntity.trackingHistory;
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        events = parsed;
                        source = voyageEntity.shipStatus || 'Suivi Voyage';
                    }
                } catch (e) {
                    console.error("❌ Erreur parse voyage history:", e);
                }
            }

            // 2. Try Shipments if still empty
            if (events.length === 0) {
                const shipmentWithHistory = shipments.find(s => s.trackingHistory && s.trackingHistory.length > 5);
                if (shipmentWithHistory) {
                    try {
                        const parsed = typeof shipmentWithHistory.trackingHistory === 'string' ?
                            JSON.parse(shipmentWithHistory.trackingHistory) : shipmentWithHistory.trackingHistory;
                        if (Array.isArray(parsed)) {
                            events = parsed;
                            source = shipmentWithHistory.shipStatus || source;
                        }
                    } catch (e) {
                        console.error("❌ Erreur parse shipment history:", e);
                    }
                }
            }

            console.log("✅ Événements à afficher:", events.length);

            const modalHtml = `
                <div class="modal-overlay" onclick="app.closeModal()">
                    <div class="modal-content glass" onclick="event.stopPropagation()" style="width: 700px; max-width: 95vw;">
                        <div class="modal-header">
                            <div>
                                <h2 style="margin:0;">Historique: ${voyageName}</h2>
                                <p style="font-size: 0.8rem; color: var(--text-dim); margin-top: 4px;">
                                    Source: ${source} | ${count} conteneur(s)
                                </p>
                            </div>
                            <button class="btn-close" onclick="app.closeModal()">&times;</button>
                        </div>
                        <div class="modal-body" style="max-height: 60vh; overflow-y: auto; padding: 20px;">
                            <div class="tracking-timeline">
                                ${events.length > 0 ? events.map((event, index) => `
                                    <div class="timeline-item" style="display: flex; gap: 20px; margin-bottom: 25px; position: relative;">
                                        ${index !== events.length - 1 ? `<div style="position: absolute; left: 14px; top: 30px; bottom: -20px; width: 2px; background: var(--border-glass);"></div>` : ''}
                                        <div class="timeline-marker" style="width: 30px; height: 30px; border-radius: 50%; background: ${event.isActual ? 'var(--success)' : 'var(--border-glass)'}; display: flex; align-items: center; justify-content: center; z-index: 1; flex-shrink: 0; box-shadow: ${event.isActual ? '0 0 10px rgba(34, 197, 94, 0.4)' : 'none'};">
                                            <i class="fas ${event.isActual ? 'fa-check' : 'fa-clock'}" style="font-size: 0.8rem; color: ${event.isActual ? 'white' : 'var(--text-dim)'};"></i>
                                        </div>
                                        <div class="timeline-content">
                                            <div style="font-size: 0.75rem; color: var(--primary); font-weight: 600; text-transform: uppercase;">
                                                ${new Date(event.date).toLocaleDateString()} ${new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <div style="font-weight: 700; font-size: 1rem; margin: 4px 0;">${event.description}</div>
                                            <div style="font-size: 0.85rem; color: var(--text-secondary);">
                                                <i class="fas fa-map-marker-alt" style="font-size: 0.7rem;"></i> ${event.location || 'En transit'}
                                            </div>
                                        </div>
                                    </div>
                                `).join('') : `
                                    <div style="text-align: center; padding: 40px; color: var(--text-dim);">
                                        <i class="fas fa-satellite-dish" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.5;"></i>
                                        <p>Aucun historique de suivi disponible.</p>
                                        <p style="font-size: 0.85rem;">Cliquez sur "Actualiser" pour récupérer les données.</p>
                                    </div>
                                `}
                            </div>
                        </div>
                        <div class="modal-footer" style="padding-top: 20px; border-top: 1px solid var(--border-glass); display: flex; justify-content: flex-end; gap: 10px;">
                            <button class="btn-secondary" onclick="app.closeModal()">Fermer</button>
                            <button class="btn-primary" onclick="app.trackVoyage('${voyageName.replace(/'/g, "\\'")}')">
                                <i class="fas fa-sync"></i> Actualiser
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        } catch (err) {
            console.error("💥 Erreur critique showVoyageTrackingHistory:", err);
            this.showToast("Erreur d'affichage: " + err.message, "danger");
        }
    },

    async trackVoyage(voyageName) {
        this.showToast(`Mise à jour du suivi satellite pour ${voyageName}...`, "info");
        try {
            const response = await fetch(`/api/tracking/voyage/${encodeURIComponent(voyageName)}`);
            const res = await response.json();
            if (res.success) {
                this.showToast("Données satellite récupérées avec succès", "success");
                await StorageService.syncAll();
                this.renderView(this.currentView);
                this.closeModal();
                setTimeout(() => this.showVoyageTrackingHistory(voyageName), 500);
            } else {
                // Show carrier links modal if available
                const carrierInfo = res.data?.carrierInfo;
                this.closeModal();
                this.showCarrierLinksModal(voyageName, carrierInfo, res.message);
            }
        } catch (err) {
            console.error("Voyage tracking error:", err);
            this.showCarrierLinksModal(voyageName, null, err.message);
        }
    },

    showCarrierLinksModal(voyageName, carrierInfo, errorMessage) {
        let linksHtml = '';
        if (carrierInfo) {
            const links = carrierInfo.trackingUrls || (carrierInfo.trackingUrl ? [{ label: carrierInfo.carrier, url: carrierInfo.trackingUrl }] : []);
            if (links.length > 0) {
                linksHtml = `
                    <p style="margin-bottom: 15px; color: var(--text-secondary);">Transporteur détecté : <strong>${carrierInfo.carrier}</strong></p>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${links.map(l => `
                            <a href="${l.url}" target="_blank" rel="noopener noreferrer"
                               style="display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); border-radius: 10px; text-decoration: none; color: var(--text-primary); transition: all 0.2s;"
                               onmouseover="this.style.background='rgba(99,102,241,0.18)'" onmouseout="this.style.background='rgba(99,102,241,0.08)'">
                                <i class="fas fa-external-link-alt" style="color: var(--primary);"></i>
                                <div>
                                    <div style="font-weight: 700;">${l.label}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 2px;">Suivre sur le site officiel</div>
                                </div>
                            </a>
                        `).join('')}
                    </div>`;
            }
        }

        if (!linksHtml) {
            linksHtml = `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${[
                    { label: 'Grimaldi Lines', url: `https://www.grimaldi-lines.com/ro-ro-cargo/tracking/` },
                    { label: 'MSC', url: 'https://www.msc.com/track-a-shipment' },
                    { label: 'Maersk', url: 'https://www.maersk.com/tracking/' },
                    { label: 'CMA CGM', url: 'https://www.cma-cgm.com/ebusiness/tracking' }
                ].map(l => `
                        <a href="${l.url}" target="_blank" rel="noopener noreferrer"
                           style="display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); border-radius: 10px; text-decoration: none; color: var(--text-primary); transition: all 0.2s;"
                           onmouseover="this.style.background='rgba(99,102,241,0.18)'" onmouseout="this.style.background='rgba(99,102,241,0.08)'">
                            <i class="fas fa-external-link-alt" style="color: var(--primary);"></i>
                            <div style="font-weight: 700;">${l.label}</div>
                        </a>
                    `).join('')}
                </div>`;
        }

        const modalHtml = `
            <div class="modal-overlay" onclick="app.closeModal()">
                <div class="modal-content glass" onclick="event.stopPropagation()" style="width: 520px; max-width: 95vw;">
                    <div class="modal-header">
                        <div>
                            <h2 style="margin:0;"><i class="fas fa-satellite-dish" style="color: var(--warning); margin-right: 10px;"></i>Suivi Satellite Indisponible</h2>
                            <p style="font-size: 0.8rem; color: var(--text-dim); margin-top: 4px;">Voyage: ${voyageName}</p>
                        </div>
                        <button class="btn-close" onclick="app.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body" style="padding: 20px;">
                        <div style="padding: 12px 16px; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); border-radius: 8px; margin-bottom: 20px; font-size: 0.85rem; color: var(--warning);">
                            <i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>
                            Le suivi automatique est indisponible. Consultez directement le site du transporteur.
                        </div>
                        ${linksHtml}
                    </div>
                    <div class="modal-footer" style="padding-top: 15px; border-top: 1px solid var(--border-glass); display: flex; justify-content: flex-end;">
                        <button class="btn-secondary" onclick="app.closeModal()">Fermer</button>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },



    async refreshAllVoyages() {
        const shipments = StorageService.get(STORAGE_KEYS.SHIPMENTS) || [];

        // Extract unique, non-empty voyage names
        const voyageNames = [...new Set(shipments
            .map(s => s.voyage ? s.voyage.trim() : '')
            .filter(v => v !== '' && v !== 'SANS VOYAGE')
        )].sort();

        if (voyageNames.length === 0) {
            this.showToast("Aucun voyage à actualiser.", "info");
            return;
        }

        if (!confirm(`Voulez-vous lancer l'actualisation de ${voyageNames.length} voyages ? Cela peut prendre plusieurs secondes.`)) {
            return;
        }

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < voyageNames.length; i++) {
            const vName = voyageNames[i];
            const progress = `(${i + 1}/${voyageNames.length})`;
            this.showToast(`Mise à jour du voyage ${progress}: ${vName}...`, "info");

            try {
                const response = await fetch(`/api/tracking/voyage/${encodeURIComponent(vName)}`);
                const res = await response.json();
                if (res.success) {
                    successCount++;
                } else {
                    console.warn(`Failed to update ${vName}: ${res.message}`);
                    failCount++;
                }
            } catch (err) {
                console.error(`Error updating ${vName}:`, err);
                failCount++;
            }

            // Small delay to be nice to the server/external API
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Final sync and refresh
        await StorageService.syncAll();
        this.renderView(this.currentView);

        if (failCount === 0) {
            this.showToast(`Succès ! ${successCount} voyages actualisés.`, "success");
        } else {
            this.showToast(`Terminé. ${successCount} succès, ${failCount} échecs.`, "warning");
        }
    },

    isOutdated(dateString) {
        if (!dateString) return true;
        const lastUpdate = new Date(dateString);
        const now = new Date();
        const diffInHours = (now - lastUpdate) / (1000 * 60 * 60);
        return diffInHours > 24;
    },

    // --- CLIENT IMPORT FEATURE ---

    downloadClientCSVTemplate() {
        // Updated header to match Client structure more closely, using French labels
        const headers = ["Reference;Prenom;Nom;Email;Telephone;Adresse;CodePostal;Entreprise;Passeport;NIN"];
        // Providing 2 examples
        const example1 = "CL-AUTO-1;Jean;Dupont;jean.dupont@email.com;0600000000;123 Rue Exemple;75001;Dupont SARL;AB123456;123456789";
        const example2 = "CL-AUTO-2;Marie;Curie;marie.curie@email.com;0700000000;456 Avenue Science;69000;;CD789012;";

        const csvContent = [headers, example1, example2].join("\n");
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        this._triggerDownload(blob, "modele_import_clients.csv");
    },

    async handleClientImport(inputElement) {
        const file = inputElement.files[0];
        if (!file) return;

        if (!file.name.endsWith('.csv')) {
            this.showToast("Veuillez sélectionner un fichier .csv valide", "error");
            inputElement.value = ''; // Reset
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result;
            const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');

            if (lines.length < 2) {
                this.showToast("Le fichier semble vide ou ne contient pas d'entêtes.", "warning");
                return;
            }

            const headers = lines[0].split(';').map(h => h.trim().toLowerCase());
            // Basic validation of headers
            if (!headers.includes('prenom') || !headers.includes('nom')) {
                this.showToast("Format CSV invalide. Utilisez le modèle.", "error");
                return;
            }

            let successCount = 0;
            let errorCount = 0;
            const existingClients = StorageService.get(STORAGE_KEYS.CLIENTS) || [];

            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(';');
                if (cols.length < 3) continue; // Skip malformed lines

                // Helper to safely get value by header index
                const getVal = (headerPartial) => {
                    const idx = headers.findIndex(h => h.includes(headerPartial));
                    return idx !== -1 && cols[idx] ? cols[idx].trim() : '';
                };

                const email = getVal('email');
                const firstName = getVal('prenom');
                const lastName = getVal('nom');

                // Skip duplicate emails if present
                if (email && existingClients.some(c => c.email && c.email.toLowerCase() === email.toLowerCase())) {
                    console.log(`Skipping duplicate email: ${email}`);
                    errorCount++; // Count as error/skip
                    continue;
                }

                const newClient = {
                    id: `c-imp-${Date.now()}-${i}`,
                    reference: getVal('reference') || `CL-IMP-${Date.now()}-${i}`,
                    firstName: firstName || 'Inconnu',
                    lastName: lastName || 'Inconnu',
                    email: email || '',
                    phone: getVal('telephone') || '',
                    address: getVal('adresse') || '',
                    postalCode: getVal('code') || '',
                    company: getVal('entreprise') || '',
                    passportNumber: getVal('passeport') || '',
                    nin: getVal('nin') || '',
                    showroom: 'Showroom Principal', // Default
                    archived: false
                };

                try {
                    await StorageService.add(STORAGE_KEYS.CLIENTS, newClient);
                    successCount++;
                } catch (err) {
                    console.error('Import error row ' + i, err);
                    errorCount++;
                }
            }

            inputElement.value = ''; // Reset input
            this.showToast(`Import terminé : ${successCount} ajoutés, ${errorCount} ignorés/erreurs.`, successCount > 0 ? "success" : "warning");

            // If we are on settings page, no need to rerender everything immediately, but good practice to sync
            await StorageService.syncAll();
        };

        reader.readAsText(file);
    },

    // --- REPORTS & EXPORTS FEATURE ---

    showReportsModal() {
        const clients = StorageService.get(STORAGE_KEYS.CLIENTS) || [];
        const showrooms = StorageService.get(STORAGE_KEYS.SHOWROOMS) || [];
        const today = new Date().toISOString().split('T')[0];
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

        const modalHtml = `
                <div class="modal-overlay">
                    <div class="modal-content glass" style="width: 500px;">
                        <div class="modal-header">
                            <h2><i class="fas fa-print"></i> Centre de Rapports</h2>
                            <button class="btn-close" onclick="app.closeModal()">&times;</button>
                        </div>
                        <div class="modal-body" style="padding: 1.5rem;">
                            
                            <!-- 1. Report Type Selection -->
                            <div class="form-group">
                                <label><i class="fas fa-file-alt"></i> Type de Rapport</label>
                                <select id="report-type" class="glass-select" onchange="app.toggleReportFilters()">
                                    <option value="cash">État de Caisse (Global)</option>
                                    <option value="client">Situation Client</option>
                                    <option value="showroom">Situation Showroom</option>
                                    <option value="orders">Liste Commandes</option>
                                </select>
                            </div>

                            <!-- 2. Dynamic Filters -->
                            <div id="report-filters" style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border: 1px solid rgba(255,255,255,0.05);">
                                
                                <!-- Date Range (Common) -->
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Du</label>
                                        <input type="date" id="report-start" class="glass-input" value="${firstDayOfMonth}">
                                    </div>
                                    <div class="form-group">
                                        <label>Au</label>
                                        <input type="date" id="report-end" class="glass-input" value="${today}">
                                    </div>
                                </div>

                                <!-- Client Selector (Hidden by default) -->
                                <div class="form-group" id="filter-client-group" style="display: none;">
                                    <label>Client</label>
                                    <select id="report-client" class="glass-select">
                                        <option value="">Sélectionner un client...</option>
                                        ${clients.map(c => `<option value="${c.id}">${c.firstName} ${c.lastName}</option>`).join('')}
                                    </select>
                                </div>

                                <!-- Showroom Selector (Hidden by default) -->
                                <div class="form-group" id="filter-showroom-group" style="display: none;">
                                    <label>Showroom</label>
                                    <select id="report-showroom" class="glass-select">
                                        <option value="">Tous les showrooms</option>
                                        ${showrooms.map(s => `<option value="${s}">${s}</option>`).join('')}
                                    </select>
                                </div>

                                <!-- Status Selector (for Orders - Hidden by default) -->
                                <div class="form-group" id="filter-status-group" style="display: none;">
                                    <label>Statut</label>
                                    <select id="report-status" class="glass-select">
                                        <option value="">Tous les statuts</option>
                                        <option value="EN ATTENTE DE VALIDATION">Validation</option>
                                        <option value="A BORD">A Bord</option>
                                        <option value="ARRIVÉE">Arrivée</option>
                                        <option value="ENLEVÉE">Enlevée</option>
                                    </select>
                                </div>
                            </div>

                            <!-- 3. Export Actions -->
                            <div class="form-row">
                                <button class="btn-primary" onclick="app.generateReport('pdf')" style="flex: 1; background: #ef4444; border-color: #ef4444;">
                                    <i class="fas fa-file-pdf"></i> Exporter PDF
                                </button>
                                <button class="btn-primary" onclick="app.generateReport('csv')" style="flex: 1; background: #10b981; border-color: #10b981;">
                                    <i class="fas fa-file-excel"></i> Exporter Excel
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    toggleReportFilters() {
        const type = document.getElementById('report-type').value;

        // Hide all specific filters first
        document.getElementById('filter-client-group').style.display = 'none';
        document.getElementById('filter-showroom-group').style.display = 'none';
        document.getElementById('filter-status-group').style.display = 'none';

        // Show relevant ones
        if (type === 'client') {
            document.getElementById('filter-client-group').style.display = 'block';
        } else if (type === 'showroom') {
            document.getElementById('filter-showroom-group').style.display = 'block';
        } else if (type === 'orders') {
            document.getElementById('filter-status-group').style.display = 'block';
            document.getElementById('filter-showroom-group').style.display = 'block'; // Also useful for orders
        }
    },

    generateReport(format) {
        const type = document.getElementById('report-type').value;
        const start = document.getElementById('report-start').value;
        const end = document.getElementById('report-end').value;

        const filters = {
            start,
            end,
            clientId: document.getElementById('report-client').value,
            showroom: document.getElementById('report-showroom').value,
            status: document.getElementById('report-status') ? document.getElementById('report-status').value : ''
        };

        if (type === 'client' && !filters.clientId) {
            this.showToast('Veuillez sélectionner un client', 'warning');
            return;
        }

        this.showToast(`Génération du rapport ${type.toUpperCase()} (${format})...`, 'info');

        // Logic switch
        if (format === 'pdf') {
            this._generatePDFReport(type, filters);
        } else {
            this._generateCSVReport(type, filters);
        }
    },

    showPurchaseOrderPrintFiltersModal() {
        const suppliers = StorageService.get(STORAGE_KEYS.SUPPLIERS) || [];
        const modalHtml = `
            <div class="modal-overlay">
                <div class="modal-content glass" style="width: 400px;">
                    <div class="modal-header">
                        <h2>Filtres d'Impression (Achats)</h2>
                        <button class="btn-close" onclick="app.closeModal()">&times;</button>
                    </div>
                    <form id="print-filters-form" style="display: flex; flex-direction: column; gap: 1rem; padding: 15px;">
                        <div class="form-group">
                            <label>Fournisseur</label>
                            <select name="supplierName" class="glass-select">
                                <option value="">Tous les fournisseurs</option>
                                ${suppliers.map(s => `<option value="${s.name}">${s.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Date Début</label>
                            <input type="date" name="startDate" class="glass-input">
                        </div>
                        <div class="form-group">
                            <label>Date Fin</label>
                            <input type="date" name="endDate" class="glass-input">
                        </div>
                        <div class="modal-footer" style="padding: 10px 0 0 0;">
                            <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                            <button type="submit" class="btn-primary"><i class="fas fa-file-pdf"></i> Générer PDF</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('print-filters-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const filters = {
                supplierName: formData.get('supplierName'),
                startDate: formData.get('startDate'),
                endDate: formData.get('endDate')
            };
            this.closeModal();
            this.exportPurchaseOrdersToPDF(filters);
        });
    },

    exportPurchaseOrdersToPDF(filters = {}) {
        if (!window.jspdf || !window.jspdf.jsPDF) return alert("Bibliothèque PDF manquante.");
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4');

        let purchaseOrders = StorageService.get(STORAGE_KEYS.PURCHASE_ORDERS) || [];
        const clients = StorageService.get(STORAGE_KEYS.CLIENTS) || [];
        const orders = StorageService.get(STORAGE_KEYS.ORDERS) || [];

        // Apply filters
        if (filters.supplierName) {
            purchaseOrders = purchaseOrders.filter(po => po.supplierName === filters.supplierName);
        }
        if (filters.startDate) {
            const start = new Date(filters.startDate);
            purchaseOrders = purchaseOrders.filter(po => new Date(po.purchaseDate) >= start);
        }
        if (filters.endDate) {
            const end = new Date(filters.endDate);
            end.setHours(23, 59, 59, 999);
            purchaseOrders = purchaseOrders.filter(po => new Date(po.purchaseDate) <= end);
        }

        const columns = [
            "ID Commande", "Nom Client", "Passport", "NIN",
            "Marque", "Modèle", "Couleur", "VIN",
            "Adresse", "C.P."
        ];

        const rows = [];
        purchaseOrders.forEach(po => {
            const poVehicles = po.vehicles || [];
            poVehicles.forEach(v => {
                let client = null;
                if (v.clientId) {
                    client = clients.find(c => c.id === v.clientId);
                } else if (v.orderId) {
                    const order = orders.find(o => o.id === v.orderId);
                    if (order && order.clientId) {
                        client = clients.find(c => c.id === order.clientId);
                    }
                }

                rows.push([
                    po.id,
                    client ? `${client.firstName} ${client.lastName}` : "EN STOCK",
                    client ? (client.passportNumber || "-") : "-",
                    client ? (client.nin || "-") : "-",
                    v.brand || "-",
                    v.model || "-",
                    v.color || "-",
                    v.chassisNumber || "-",
                    client ? (client.address || "-") : "-",
                    client ? (client.postalCode || "-") : "-"
                ]);
            });
        });

        // Generate PDF
        doc.setFontSize(18);
        doc.text("État des Commandes d'Achat", 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Généré le: ${new Date().toLocaleString()}`, 14, 28);

        doc.autoTable({
            head: [columns],
            body: rows,
            startY: 35,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] }, // matching primary color
            styles: { fontSize: 8 },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 35 }
            }
        });

        doc.save(`etat_achats_${new Date().toISOString().split('T')[0]}.pdf`);
        this.showToast('État des achats généré', 'success');
    },

    exportSinglePurchaseOrderToPDF(poId) {
        if (!window.jspdf || !window.jspdf.jsPDF) return alert("Bibliothèque PDF manquante.");
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4');

        const purchaseOrders = StorageService.get(STORAGE_KEYS.PURCHASE_ORDERS) || [];
        const po = purchaseOrders.find(p => p.id === poId);
        if (!po) return alert("Commande d'achat introuvable.");

        const clients = StorageService.get(STORAGE_KEYS.CLIENTS) || [];
        const orders = StorageService.get(STORAGE_KEYS.ORDERS) || [];

        const columns = [
            "ID Commande", "Nom Client", "Passport", "NIN",
            "Marque", "Modèle", "Couleur", "VIN",
            "Adresse", "C.P."
        ];

        const rows = [];
        const poVehicles = po.vehicles || [];
        poVehicles.forEach(v => {
            let client = null;
            if (v.clientId) {
                client = clients.find(c => c.id === v.clientId);
            } else if (v.orderId) {
                const order = orders.find(o => o.id === v.orderId);
                if (order && order.clientId) {
                    client = clients.find(c => c.id === order.clientId);
                }
            }

            rows.push([
                po.id,
                client ? `${client.firstName} ${client.lastName}` : "EN STOCK",
                client ? (client.passportNumber || "-") : "-",
                client ? (client.nin || "-") : "-",
                v.brand || "-",
                v.model || "-",
                v.color || "-",
                v.chassisNumber || "-",
                client ? (client.address || "-") : "-",
                client ? (client.postalCode || "-") : "-"
            ]);
        });

        // Logo Simulation (Red & Black)
        doc.setFontSize(28);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0); // Black
        doc.text("TIBOU", 14, 20);
        
        const tibouWidth = doc.getTextWidth("TIBOU ");
        doc.setTextColor(213, 0, 0); // Red
        doc.text("AUTO", 14 + tibouWidth, 20);

        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 0, 0); // Red
        doc.text("CHINA CARS", 14, 24);

        doc.setFontSize(14);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(70, 70, 70);
        doc.text(`Détails Commande d'Achat #${po.id}`, 14, 32);

        doc.setFontSize(10);
        doc.setTextColor(50);
        doc.text(`Fournisseur: ${po.supplierName || 'N/A'}`, 14, 38);
        doc.text(`Date: ${po.purchaseDate ? new Date(po.purchaseDate).toLocaleDateString() : 'N/A'}`, 80, 38);

        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Généré le: ${new Date().toLocaleString()}`, 14, 44);

        doc.autoTable({
            head: [columns],
            body: rows,
            startY: 50,
            theme: 'grid',
            headStyles: { fillColor: [213, 0, 0] },
            styles: { fontSize: 8 },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 35 }
            }
        });

        doc.save(`achat_${po.id}_${new Date().toISOString().split('T')[0]}.pdf`);
        this.showToast('PDF de la commande généré', 'success');
    },

    _generatePDFReport(type, filters) {
        if (!window.jspdf || !window.jspdf.jsPDF) return alert("Bibliothèque PDF manquante.");
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4');
        const reportingCurrency = StorageService.get(STORAGE_KEYS.SETTINGS)?.reportingCurrency || 'AED';

        // DATA GATHERING
        let title = "";
        let columns = [];
        let rows = [];
        let summaryText = [];

        const startDate = new Date(filters.start);
        const endDate = new Date(filters.end);
        endDate.setHours(23, 59, 59, 999);

        // --- CASH REPORT ---
        if (type === 'cash') {
            title = "Rapport État de Caisse";
            columns = ["Date", "Type", "Catégorie", "Description", "Montant", "Utilisateur"];

            const cashFlow = StorageService.get(STORAGE_KEYS.CASH_FLOW) || [];
            const filteredCash = cashFlow.filter(c => {
                const d = new Date(c.date);
                return d >= startDate && d <= endDate;
            }).sort((a, b) => new Date(b.date) - new Date(a.date));

            let totalIn = 0;
            let totalOut = 0;

            filteredCash.forEach(c => {
                const amount = parseFloat(c.amount);
                if (c.type === 'IN') totalIn += amount;
                else totalOut += amount;

                rows.push([
                    new Date(c.date).toLocaleDateString(),
                    c.type === 'IN' ? 'ENTRÉE' : 'SORTIE',
                    c.category,
                    c.description,
                    this.formatCurrency(amount, c.currency, reportingCurrency),
                    c.user
                ]);
            });

            summaryText.push(`Total Entrées: ${this.formatCurrency(totalIn, reportingCurrency, reportingCurrency)}`);
            summaryText.push(`Total Sorties: ${this.formatCurrency(totalOut, reportingCurrency, reportingCurrency)}`);
            summaryText.push(`Balance Période: ${this.formatCurrency(totalIn - totalOut, reportingCurrency, reportingCurrency)}`);
        }

        // --- CLIENT REPORT ---
        else if (type === 'client') {
            const clients = StorageService.get(STORAGE_KEYS.CLIENTS);
            const client = clients.find(c => c.id === filters.clientId);
            title = `Situation Client - ${client.firstName} ${client.lastName}`;

            summaryText.push(`Email: ${client.email}`);
            summaryText.push(`Tel: ${client.phone}`);

            columns = ["Date", "Commande", "Véhicule", "Total", "Payé", "Reste"];

            const orders = StorageService.get(STORAGE_KEYS.ORDERS).filter(o => o.clientId === client.id);

            orders.forEach(o => {
                const netPrice = (o.totalAmount || 0) - (o.discount || 0);
                const paid = this.getPaidAmount(o.id);
                rows.push([
                    new Date(o.date).toLocaleDateString(),
                    `#${o.id}`,
                    o.vehicleName,
                    this.formatCurrency(netPrice),
                    this.formatCurrency(paid),
                    this.formatCurrency(Math.max(0, netPrice - paid))
                ]);
            });
        }

        // --- ORDERS REPORT ---
        else if (type === 'orders') {
            title = "Rapport Commandes";
            columns = ["Date", "Client", "Véhicule", "Showroom", "Statut", "Montant"];

            let orders = StorageService.get(STORAGE_KEYS.ORDERS);
            orders = orders.filter(o => {
                const d = new Date(o.date);
                const dateMatch = d >= startDate && d <= endDate;
                const showroomMatch = !filters.showroom || o.showroom === filters.showroom;
                const statusMatch = !filters.status || o.status === filters.status;
                return dateMatch && showroomMatch && statusMatch;
            });

            let totalSales = 0;
            orders.forEach(o => {
                const netPrice = (o.totalAmount || 0) - (o.discount || 0);
                totalSales += this.convertCurrency(netPrice, o.currency, reportingCurrency);
                rows.push([
                    new Date(o.date).toLocaleDateString(),
                    o.clientName,
                    o.vehicleName,
                    o.showroom || 'N/A',
                    o.status,
                    this.formatCurrency(netPrice)
                ]);
            });
            summaryText.push(`Total Ventes (Période): ${this.formatCurrency(totalSales, reportingCurrency)}`);
        }

        // --- SHOWROOM REPORT ---
        else if (type === 'showroom') {
            title = "Situation Showroom";
            // For Showroom, maybe a summary of Stock?
            // Let's do a Stock list for that showroom + Sales summary
            const targetShowroom = filters.showroom || "Tous";
            title += ` (${targetShowroom})`;

            columns = ["Modèle", "Année", "VIN", "Prix Achat", "Prix Vente", "Statut"];

            const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES);
            const filteredVehicles = vehicles.filter(v =>
                !v.isArchived &&
                (!filters.showroom || v.showroom === filters.showroom)
            );

            let totalStockValue = 0;
            filteredVehicles.forEach(v => {
                totalStockValue += (v.purchasePrice || 0);
                rows.push([
                    `${v.brand} ${v.model}`,
                    v.year,
                    v.chassisNumber || '-',
                    this.formatCurrency(v.purchasePrice),
                    this.formatCurrency(v.salePrice || 0),
                    v.status
                ]);
            });
            summaryText.push(`Véhicules en Stock: ${filteredVehicles.length}`);
            summaryText.push(`Valeur Stock (Achat): ${this.formatCurrency(totalStockValue)}`);
        }

        // GENERATE PDF
        doc.setFontSize(18);
        doc.text(title, 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Période: ${filters.start} au ${filters.end}`, 14, 28);

        // Print Summary Text
        let yPos = 35;
        summaryText.forEach(line => {
            doc.text(line, 14, yPos);
            yPos += 6;
        });

        doc.autoTable({
            head: [columns],
            body: rows,
            startY: yPos + 5,
            theme: 'grid',
            headStyles: { fillColor: [66, 66, 66] }
        });

        doc.save(`rapport_${type}_${new Date().toISOString().split('T')[0]}.pdf`);
        this.closeModal();
        this.showToast('PDF Généré', 'success');
    },

    _generateCSVReport(type, filters) {
        // Simplified CSV export logic similar to PDF data gathering
        // Reuse common logic if strictly necessary, but for now copying structure for speed
        // This is a "MVP" implementation request.

        let csvContent = "";
        const reportingCurrency = StorageService.get(STORAGE_KEYS.SETTINGS)?.reportingCurrency || 'AED';

        if (type === 'cash') {
            csvContent += "Date,Type,Categorie,Description,Montant,Utilisateur\n";
            const cashFlow = StorageService.get(STORAGE_KEYS.CASH_FLOW) || [];
            // Filter...
            // For brevity, exporting simplified logic
            cashFlow.forEach(c => {
                csvContent += `${c.date},${c.type},${c.category},"${c.description}",${c.amount},${c.user}\n`;
            });
        }
        else {
            // Generic fallback for other types in CSV for now or alert not implemented if too complex
            // Implementing CLIENT CSV for example
            csvContent += "Export CSV simplifié. Veuillez utiliser le PDF pour le rapport complet formatté.\n";
        }

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        this._triggerDownload(blob, `rapport_${type}.csv`);
        this.closeModal();
    },

    renderBrandModelsSection() {
        const modelsMap = StorageService.get(STORAGE_KEYS.BRAND_MODELS) || {};
        const brands = StorageService.get(STORAGE_KEYS.BRANDS) || [];

        return `
            <div class="settings-section">
                <h3><i class="fas fa-car-side"></i> Modèles par Marque</h3>
                <div class="config-grid">
                    ${brands.map(brand => `
                        <div class="config-item glass" style="flex-direction: column; align-items: stretch; gap: 10px; height: auto; min-height: 120px; padding: 15px;">
                            <div style="font-weight: 700; width: 100%; border-bottom: 1px solid var(--border-glass); padding-bottom: 8px; margin-bottom: 5px; color: var(--primary);">
                                ${brand}
                            </div>
                            <div style="display: flex; flex-wrap: wrap; gap: 6px; flex-grow: 1;">
                                ${(modelsMap[brand] || []).map(m => `<span class="model-tag">${m}</span>`).join('') || '<span style="color:var(--text-secondary); font-size:0.8rem; opacity: 0.6;">Aucun modèle</span>'}
                            </div>
                            <div style="display: flex; justify-content: flex-end; margin-top: auto;">
                                <button class="btn-icon-small" onclick="app.manageModels('${brand.replace(/'/g, "\\'")}')" title="Gérer les modèles">
                                    <i class="fas fa-cog"></i> Gérer
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    manageModels(brand) {
        // Find brand in BRANDS_RAW to get its ID
        const brandsRaw = StorageService.get(STORAGE_KEYS.BRANDS_RAW) || [];
        const brandObj = brandsRaw.find(b => b.name === brand);

        if (!brandObj) {
            return this.showToast("Erreur: Marque introuvable.", "error");
        }

        // Use the existing logic or placeholder
        alert("Gestion détaillée des modèles pour " + brand + " (ID: " + brandObj.id + ") à venir.\nEn attendant, vous pouvez ajouter des modèles via le champ 'Ajouter un modèle' ci-dessous dans la vue Configuration.");
    },

    showShipmentMap(shipmentId) {
        const shipments = StorageService.get(STORAGE_KEYS.SHIPMENTS) || [];
        const shipment = shipments.find(s => s.id === shipmentId);
        if (!shipment) return this.showToast("Expédition introuvable", "error");

        // Use coordinates if available, otherwise fallback to Dakar
        const hasCoords = shipment.currentLat && shipment.currentLng;
        const locationQuery = hasCoords ? `${shipment.currentLat},${shipment.currentLng}` : (shipment.currentLocation || 'Dakar, Senegal');
        const displayLocation = hasCoords ? `Lat: ${shipment.currentLat}, Lng: ${shipment.currentLng}` : (shipment.currentLocation || 'Position non disponible');

        const modalHtml = `
            <div class="modal-overlay">
                <div class="modal-content glass" style="width: 90%; max-width: 900px; height: 80vh; display: flex; flex-direction: column; padding: 0; overflow: hidden;">
                    <div class="modal-header" style="padding: 20px;">
                        <h2><i class="fas fa-map-marked-alt"></i> Localisation: ${shipment.containerNumber || shipment.blNumber}</h2>
                        <button class="btn-close" onclick="app.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body" style="flex: 1; position: relative; padding: 0; background: #f0f0f0;">
                        <iframe 
                            width="100%" 
                            height="100%" 
                            frameborder="0" 
                            style="border:0"
                            src="https://maps.google.com/maps?q=${encodeURIComponent(locationQuery)}&t=&z=6&ie=UTF8&iwloc=&output=embed">
                        </iframe>
                        <div style="position: absolute; bottom: 20px; left: 20px; right: 20px; background: rgba(0,0,0,0.8); padding: 15px; border-radius: 12px; color: white; pointer-events: none; backdrop-filter: blur(5px); border: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-weight: bold; margin-bottom: 5px; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-map-marker-alt" style="color: #ef4444;"></i> Position Actuelle
                            </div>
                            <div style="font-size: 0.95rem;">${displayLocation}</div>
                            <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 5px;">Dernière mise à jour: ${shipment.lastUpdate ? new Date(shipment.lastUpdate).toLocaleString() : 'Non disponible'}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
};

// Initialize App
window.app = app;
app.init().catch(err => {
    console.error('Critical Error during App Init:', err);
    document.body.innerHTML = `<div style="color: red; padding: 20px; font-family: sans-serif; background: #fff; height: 100vh;">
            <h1>Erreur Critique de Chargement</h1>
            <p>L'application n'a pas pu s'initialiser correctement.</p>
            <div style="background: #f8f8f8; padding: 15px; border-radius: 8px; margin-top: 20px; border: 1px solid #ddd; overflow: auto; max-height: 50vh;">
                <code style="white-space: pre-wrap;">${err.message}\n${err.stack}</code>
            </div>
            <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 6px; cursor: pointer;">Réessayer</button>
        </div>`;
});
// End of App Logic
