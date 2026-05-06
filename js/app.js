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

    getStatusColor(status) {
        switch (status) {
            case 'Draft': return 'var(--text-dim)';
            case 'Pending': return 'var(--warning)';
            case 'Validated': return 'var(--success)';
            case 'Paid': return 'var(--success)';
            case 'Shipped': return 'var(--primary)';
            case 'Delivered': return 'var(--success)';
            case 'Cancelled': return 'var(--danger)';
            default: return 'var(--primary)';
        }
    },

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

    formatDate(dateStr) {
        if (!dateStr) return '--';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    },

    isOutdated(dateStr) {
        if (!dateStr) return true;
        const lastUpdate = new Date(dateStr);
        const now = new Date();
        const diffHours = (now - lastUpdate) / (1000 * 60 * 60);
        return diffHours > 24;
    },

    initDatePickers() {
        if (typeof flatpickr === 'undefined') return;
        
        document.querySelectorAll('input[type="date"]').forEach(el => {
            if (el.classList.contains('flatpickr-input')) return; // Already initialized
            
            flatpickr(el, {
                locale: 'fr',
                altInput: true,
                altFormat: 'd/m/Y',
                dateFormat: 'Y-m-d',
                allowInput: true
            });
        });
    },

    initMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            let needsInit = false;
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            if (node.querySelector('input[type="date"]') || (node.tagName === 'INPUT' && node.type === 'date')) {
                                needsInit = true;
                            }
                        }
                    });
                }
            });
            if (needsInit) {
                this.initDatePickers();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
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
            this.initMutationObserver();
            this.initDatePickers();
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
                            <div class="logo-text-wrapper" style="font-size: 3.5rem; letter-spacing: -2px; flex-direction: row; gap: 15px; width: auto;">
                                <span class="tibou" style="color: white;">TIBOU</span>
                                <span class="auto" style="color: #D32F2F;">AUTO</span>
                            </div>
                            <div style="color: #D32F2F; font-size: 0.9rem; font-weight: 600; letter-spacing: 6px; margin-top: -10px; text-transform: uppercase; opacity: 0.9;">SHOWROOMS</div>
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

    async resendOrderConfirmationEmail(id, btnElement) {
        if (!confirm("Voulez-vous renvoyer l'email de confirmation à ce client ?")) return;
        
        const originalHtml = btnElement.innerHTML;
        btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi...';
        btnElement.disabled = true;

        try {
            const response = await ApiService.resendOrderConfirmation(id);
            if (response.success) {
                this.showToast('Email renvoyé avec succès', 'success');
                btnElement.innerHTML = '<i class="fas fa-check"></i> Envoyé';
                btnElement.style.color = 'var(--success)';
                btnElement.style.borderColor = 'var(--success)';
                btnElement.style.background = 'rgba(34, 197, 94, 0.1)';
            } else {
                this.showToast(response.message || 'Erreur lors du renvoi', 'error');
                btnElement.innerHTML = originalHtml;
                btnElement.disabled = false;
            }
        } catch (error) {
            console.error('Error resending email:', error);
            this.showToast("Erreur serveur lors du renvoi de l'email", 'error');
            btnElement.innerHTML = originalHtml;
            btnElement.disabled = false;
        }
    },

    async sendTestEmail(clientId, btnElement) {
        if (!confirm('Voulez-vous envoyer un email de test à ce client ?')) return;
        
        const originalHtml = btnElement.innerHTML;
        btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi...';
        btnElement.disabled = true;

        try {
            const response = await ApiService.sendClientTestEmail(clientId);
            if (response.success) {
                this.showToast('Email de test envoyé avec succès', 'success');
                btnElement.innerHTML = '<i class="fas fa-check"></i> Envoyé';
                btnElement.style.color = 'var(--success)';
                btnElement.style.borderColor = 'var(--success)';
                btnElement.style.background = 'rgba(34, 197, 94, 0.1)';
            } else {
                this.showToast(response.message || "Erreur lors de l'envoi", 'error');
                btnElement.innerHTML = originalHtml;
                btnElement.disabled = false;
            }
        } catch (error) {
            console.error('Error sending test email:', error);
            this.showToast("Erreur serveur lors de l'envoi de l'email", 'error');
            btnElement.innerHTML = originalHtml;
            btnElement.disabled = false;
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
                            <div class="form-group" style="display: none;">
                                <label style="color: var(--primary); font-weight: 600;"><i class="fas fa-hashtag"></i> Numéro de Commande</label>
                                <input type="text" name="orderIdOverride" id="order-id-override" class="glass-input" required style="font-weight: bold; font-family: monospace; font-size: 1.1rem; color: var(--primary);">
                            </div>
                            <div class="form-group" style="background: rgba(var(--primary-rgb), 0.05); padding: 10px; border-radius: 8px; border: 1px dashed rgba(var(--primary-rgb), 0.3);">
                                <label style="color: var(--primary); font-weight: 600;"><i class="fas fa-link"></i> Référence Drive</label>
                                <input type="text" name="referenceDrive" class="glass-input" placeholder="Lien ou référence libre..." style="font-size: 1rem;">
                            </div>
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
                                        <label>Finition (Version)</label>
                                        <select name="requestedTrim" id="filter-trim" class="glass-select">
                                            <option value="">Toutes les finitions</option>
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
                                            ${StorageService.get(STORAGE_KEYS.SHOWROOMS).map(s => `<option value="${s}" ${s.toUpperCase() === 'TOUGGOURT' ? 'selected' : ''}>${s}</option>`).join('')}
                                        </select>
                                    </div>
                                </div>
                            </fieldset>

                            <div class="form-group">
                                <label>Véhicule Sélectionné (Stock)</label>
                                <div class="validation-notice" style="background: rgba(var(--primary-rgb), 0.1); color: var(--primary); padding: 8px; border-radius: 6px; font-size: 0.8rem; margin-bottom: 8px; border: 1px solid rgba(var(--primary-rgb), 0.2);">
                                    <i class="fas fa-info-circle"></i> Sélectionnez un véhicule en stock pour l'affecter immédiatement.
                                </div>
                                <!-- Vehicle Search Input -->
                                <div style="position: relative; margin-bottom: 8px;">
                                    <i class="fas fa-search" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-dim); font-size: 0.8rem;"></i>
                                    <input type="text" id="vehicle-search" class="glass-input" placeholder="Rechercher par Châssis, Marque ou Modèle..." style="padding-left: 30px; font-size: 0.85rem;" autocomplete="off">
                                </div>
                                <select name="vehicleId" id="order-vehicle-select" class="glass-select">
                                    <option value="">Choisir un véhicule...</option>
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
            if (v.trim) {
                const trimSel = document.getElementById('filter-trim');
                if (trimSel) {
                    const opt = document.createElement('option');
                    opt.value = v.trim;
                    opt.textContent = v.trim;
                    trimSel.appendChild(opt);
                    trimSel.value = v.trim;
                }
            }
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
        const trimFilter = document.getElementById('filter-trim');
        const categoryFilter = document.getElementById('filter-category');
        const showroomFilter = document.getElementById('filter-showroom');
        const vehicleSelect = document.getElementById('order-vehicle-select');

        const vehicleSearch = document.getElementById('vehicle-search');
        const refreshVehicles = () => {
            const brand = brandFilter.value;
            const model = modelFilter.value;
            const category = categoryFilter.value;
            const showroom = showroomFilter.value;
            const searchText = vehicleSearch ? vehicleSearch.value.toLowerCase() : '';
            const currentSelectedClientId = clientSelect ? clientSelect.value : '';

            let filtered = allAvailableVehicles;

            if (brand) filtered = filtered.filter(v => v.brand === brand);
            if (model) filtered = filtered.filter(v => (v.model || '') === model);
            
            const trim = trimFilter ? trimFilter.value : '';
            if (trim) filtered = filtered.filter(v => (v.trim || '') === trim);

            if (showroom) filtered = filtered.filter(v => v.showroom === showroom);
            
            if (category === 'Neuf') {
                filtered = filtered.filter(v => v.condition === 'Neuf');
            } else if (category === 'Recent') {
                filtered = filtered.filter(v => v.year >= (currentYear - 3));
            }

            if (searchText) {
                filtered = filtered.filter(v => 
                    (v.brand || '').toLowerCase().includes(searchText) ||
                    (v.model || '').toLowerCase().includes(searchText) ||
                    (v.chassisNumber || '').toLowerCase().includes(searchText) ||
                    (String(v.id)).toLowerCase().includes(searchText)
                );
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
                
                let text = `[#${v.id}] ${v.brand} ${v.model || ''} (${v.year}) | ${vin} | ${color} | ${km} | ${category} - ${this.formatCurrency(v.sellingPrice || v.price, v.sellingCurrency)}`;
                if (v.soldRegistration) {
                    text += ` (VENDU CG: ${v.soldRegistrationOwner || 'N/A'})`;
                }
                
                option.textContent = text;
                vehicleSelect.appendChild(option);
            });
        };

        if (vehicleSearch) {
            vehicleSearch.addEventListener('input', refreshVehicles);
        }

        brandFilter.addEventListener('change', () => {
            const brand = brandFilter.value;
            modelFilter.innerHTML = '<option value="">Tous les modèles</option>';
            const trimSel = document.getElementById('filter-trim');
            if (trimSel) trimSel.innerHTML = '<option value="">Toutes les finitions</option>';

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

        modelFilter.addEventListener('change', () => {
            const brand = brandFilter.value;
            const model = modelFilter.value;
            const trimSel = document.getElementById('filter-trim');
            
            if (trimSel) {
                trimSel.innerHTML = '<option value="">Toutes les finitions</option>';
                if (brand && model) {
                    const brandsRaw = StorageService.get(STORAGE_KEYS.BRANDS_RAW) || [];
                    const brandObj = brandsRaw.find(b => b.name === brand);
                    if (brandObj && brandObj.models) {
                        const modelObj = brandObj.models.find(m => m.name === model);
                        if (modelObj && modelObj.trims) {
                            modelObj.trims.forEach(t => {
                                const opt = document.createElement('option');
                                opt.value = t.name;
                                opt.textContent = t.name;
                                trimSel.appendChild(opt);
                            });
                        }
                    }
                }
            }
            refreshVehicles();
        });

        if (trimFilter) {
            trimFilter.addEventListener('change', refreshVehicles);
        }
        // Initial population of vehicles
        refreshVehicles();
        
        // Setup initial order ID and auto-update it on showroom change IF it's a new order
        const updateOrderId = () => {
            const currentVal = document.getElementById('order-id-override').value;
            // Only update if empty or if it seems to map to the old showroom formula
            document.getElementById('order-id-override').value = this.generateNextOrderId(showroomFilter.value);
        };
        
        showroomFilter.addEventListener('change', () => {
            refreshVehicles();
            updateOrderId();
        });
        
        // Initial set with slight delay to ensure storage is ready if needed
        setTimeout(updateOrderId, 50);

        document.getElementById('order-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleOrderSubmission(new FormData(e.target));
        });
    },

    closeModal() {
        const modal = document.getElementById('modal-overlay') || document.querySelector('.modal-overlay');
        if (modal) modal.remove();
    },

    generateNextOrderId(showroomName) {
        const year = new Date().getFullYear();
        // Get first 3 letters of showroom, default to SHR if not provided
        const showroomCode = (showroomName && showroomName.trim() !== '') 
            ? showroomName.trim().substring(0, 3).toUpperCase() 
            : 'SHR';
        
        const orders = StorageService.get(STORAGE_KEYS.ORDERS) || [];
        
        // Find existing orders for this showroom and year
        const prefix = `${showroomCode}/${year}/`;
        const relevantOrders = orders.filter(o => o.id && o.id.startsWith(prefix));
        
        let maxSeq = 0;
        for (const order of relevantOrders) {
            const parts = order.id.split('/');
            if (parts.length === 3) {
                const seq = parseInt(parts[2], 10);
                if (!isNaN(seq) && seq > maxSeq) {
                    maxSeq = seq;
                }
            }
        }
        
        const nextSeq = maxSeq + 1;
        // Pad with zeros to 4 positions
        const paddedSeq = String(nextSeq).padStart(4, '0');
        
        return `${prefix}${paddedSeq}`;
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
            const referenceDrive = formData.get('referenceDrive');

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
                        vehicleName: vehicle ? `${vehicle.brand} ${vehicle.model || ''} ${vehicle.trim || ''} (${vehicle.year})`.trim().replace(/\s+/g, ' ') : `${formData.get('requestedBrand') || 'N/A'} ${formData.get('requestedModel') || ''} ${formData.get('requestedTrim') || ''}`.trim(),
                        requestedBrand: formData.get('requestedBrand') || '',
                        requestedModel: formData.get('requestedModel') || '',
                        requestedTrim: formData.get('requestedTrim') || '',
                        requestedColor: formData.get('requestedColor') || '',
                        totalAmount: vehicle ? (vehicle.sellingPrice || vehicle.price) : manualPrice,
                        discount: 0,
                        date: (formData.get('date') && formData.get('date').trim() !== '') ? new Date(formData.get('date')).toISOString() : orders[orderIndex].date,
                        remarks: formData.get('remarks') || '',
                        showroom: formData.get('showroom') || orders[orderIndex].showroom || 'Showroom Principal',
                        status: formData.get('status') || orders[orderIndex].status,
                        documentStatus: formData.get('documentStatus') || orders[orderIndex].documentStatus || 'Rien',
                        documentsReceived: formData.get('documentsReceived') || orders[orderIndex].documentsReceived || 'Non',
                        referenceDrive: referenceDrive || orders[orderIndex].referenceDrive || ''
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
                const selectedShowroom = formData.get('showroom') || 'Showroom Principal';
                finalOrderId = formData.get('orderIdOverride') && formData.get('orderIdOverride').trim() !== '' ? formData.get('orderIdOverride').trim() : this.generateNextOrderId(selectedShowroom);
                const newOrder = {
                    id: finalOrderId,
                    clientId: client.id,
                    clientName: `${client.firstName} ${client.lastName}`,
                    vehicleId: vehicleId || null,
                    vehicleName: vehicle ? `${vehicle.brand} ${vehicle.model || ''} (${vehicle.year})` : `${formData.get('requestedBrand') || 'N/A'} ${formData.get('requestedModel') || ''} ${formData.get('requestedTrim') || ''}`.trim(),
                    requestedBrand: formData.get('requestedBrand') || '',
                    requestedModel: formData.get('requestedModel') || '',
                    requestedTrim: formData.get('requestedTrim') || '',
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
                    referenceDrive: referenceDrive || '',
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

        // Check for amendments/transfers
        const transfers = StorageService.get(STORAGE_KEYS.TRANSFERS) || [];
        const vehicleTransfer = vehicle ? transfers.find(t => String(t.vehicleId) === String(vehicle.id)) : null;

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
                            <div style="display: flex; flex-direction: column;">
                                <h2 style="margin-bottom: 4px;">Détails de la Commande #${order.id}</h2>
                                ${order.trackingCode ? `<div style="font-size: 0.8rem; color: var(--primary); font-family: monospace; font-weight: 600; letter-spacing: 1px;"><i class="fas fa-barcode"></i> CODE DE SUIVI: ${order.trackingCode}</div>` : ''}
                            </div>
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
                                <p><strong>Nom:</strong> ${order.clientName || (client ? `${client.lastName} ${client.firstName}` : 'Client Inconnu')}</p>
                                <p style="display: flex; align-items: center; gap: 10px;">
                                    <strong>Email:</strong> 
                                    ${client ? `<a href="mailto:${client.email}" style="color: var(--primary); text-decoration: underline;">${client.email}</a> 
                                    <button class="btn-action" style="font-size: 0.7rem; padding: 2px 8px; margin-left: 5px; color: #3b82f6; border: 1px solid #3b82f6; background: rgba(59, 130, 246, 0.1); border-radius: 4px;" onclick="app.resendOrderConfirmationEmail('${order.id}', this)" title="Renvoyer confirmation par mail"><i class="fas fa-paper-plane"></i> Envoyer Conf.</button>` : 'N/A'}
                                </p>
                                <p><strong>Téléphone:</strong> ${client ? client.phone : 'N/A'}</p>
                                <p><strong>Passeport:</strong> ${client ? (client.passportNumber || 'N/A') : 'N/A'} ${client && client.passportDriveLink ? `<a href="${client.passportDriveLink}" target="_blank" style="color: var(--primary); margin-left: 8px;" title="Voir Passeport (Drive)"><i class="fab fa-google-drive"></i></a>` : ''}</p>
                                
                                ${vehicleTransfer ? `
                                    <div style="margin-top: 15px; padding: 12px; border-radius: 12px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2);">
                                        <h4 style="margin-bottom: 8px; color: #d97706; font-size: 0.9rem;"><i class="fas fa-exchange-alt"></i> AMENDEMENT / TRANSFERT</h4>
                                        <p style="font-size: 0.85rem; margin-bottom: 5px;"><strong>Nouveau Client :</strong> <span class="badge-pill" style="background: #d97706; color: #fff; border: none; font-weight: 600;">${vehicleTransfer.toClient ? `${vehicleTransfer.toClient.lastName} ${vehicleTransfer.toClient.firstName}` : 'Client ' + vehicleTransfer.toClientId}</span></p>
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                                            <span style="font-size: 0.75rem; color: var(--text-dim);">Transféré le : ${this.formatDate(vehicleTransfer.transferDate)}</span>
                                            <span class="badge-pill" style="font-size: 0.65rem; background: ${vehicleTransfer.newBLReceived ? 'var(--success)' : 'var(--warning)'}22; color: ${vehicleTransfer.newBLReceived ? 'var(--success)' : 'var(--warning)'}; border: none;">
                                                ${vehicleTransfer.newBLReceived ? 'BL Reçu' : 'BL Attendu'}
                                            </span>
                                        </div>
                                        ${vehicleTransfer.notes ? `<p style="font-size: 0.75rem; font-style: italic; margin-top: 8px; color: var(--text-dim); padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05);">"${vehicleTransfer.notes}"</p>` : ''}
                                    </div>
                                ` : ''}
                            </div>
                            <div class="details-section">
                                <h3><i class="fas fa-car"></i> Véhicule</h3>
                                <p><strong>Désignation:</strong> ${order.vehicleName || 'N/A'}</p>
                                ${vehicle ? `
                                    <p><strong>Marque/Modèle:</strong> ${vehicle.brand} ${vehicle.model || ''} (${vehicle.year})</p>
                                    <p><strong>Châssis:</strong> <code style="font-size: 0.85rem;">${vehicle.chassisNumber || 'N/A'}</code></p>
                                    <p><strong>Finition:</strong> ${vehicle.trim || 'N/A'}</p>
                                    <p><strong>Couleur:</strong> ${vehicle.color || 'N/A'}</p>
                                    ${vehicle.videoLink ? `<p><strong>Vidéo (Drive):</strong> <a href="${vehicle.videoLink}" target="_blank" style="color: var(--primary); font-weight: 600; text-decoration: none;"><i class="fab fa-google-drive"></i> Consulter la vidéo</a></p>` : ''}
                                    ${vehicle.blLink ? `<p><strong>BL (Drive):</strong> <a href="${vehicle.blLink}" target="_blank" style="color: var(--primary); font-weight: 600; text-decoration: none;"><i class="fab fa-google-drive"></i> Consulter le BL</a></p>` : ''}
                                ` : `
                                    <p><strong>Marque Souhaitée:</strong> ${order.requestedBrand || 'N/A'}</p>
                                    <p><strong>Modèle Souhaité:</strong> ${order.requestedModel || 'N/A'}</p>
                                    <p><strong>Finition Souhaitée:</strong> ${order.requestedTrim || 'N/A'}</p>
                                    <p><strong>Couleur Souhaitée:</strong> ${order.requestedColor || 'N/A'}</p>
                                `}
                                ${vehicle && vehicle.options ? `<p><strong>Options:</strong> <span style="font-size: 0.85rem; color: var(--text-dim);">${vehicle.options}</span></p>` : ''}
                                
                                ${shipment ? `
                                <div style="margin-top: 15px; padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.03); border-left: 3px solid var(--primary);">
                                    <h4 style="font-size: 0.9rem; margin-bottom: 8px; color: var(--primary);"><i class="fas fa-shipping-fast"></i> Situation du Transport</h4>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem;">
                                        <div><strong>Port de Chargement:</strong> ${shipment.loadingPort || 'N/A'}</div>
                                        <div><strong>Port d'Arrivée:</strong> ${shipment.destination || 'N/A'}</div>
                                        <div><strong>Départ Navire (ETD):</strong> ${shipment.etd ? this.formatDate(shipment.etd) : 'N/A'}</div>
                                        <div><strong>Arrivée Prévue (ETA):</strong> ${shipment.eta ? this.formatDate(shipment.eta) : 'N/A'}</div>
                                        <div><strong>Transitaire:</strong> ${shipment.forwarder || 'N/A'}</div>
                                        <div><strong>Transporteur:</strong> ${shipment.carrier || 'N/A'}</div>
                                    </div>
                                    <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.1); display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem;">
                                        <div><strong>Dédouanement:</strong> ${shipment.customsClearanceDate ? this.formatDate(shipment.customsClearanceDate) : 'N/A'}</div>
                                        <div><strong>Enlèvement:</strong> ${shipment.pickupDate ? this.formatDate(shipment.pickupDate) : 'N/A'}</div>
                                    </div>
                                    <div style="margin-top: 8px; font-size: 0.8rem; color: var(--text-dim);">
                                        <strong>Conteneur:</strong> ${shipment.containerNumber} | 
                                        <strong>N° BL:</strong> ${shipment.blNumber || 'N/A'}
                                        ${shipment.voyage ? ` | <strong>Voyage:</strong> ${shipment.voyage}` : ''}
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
                                                        <td>${this.formatDate(t.date)}</td>
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
                                <p><strong>Date Bc:</strong> ${this.formatDate(order.date)}</p>
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
                            <button class="btn-action warning-alt" style="margin-right: auto;" onclick="app.showOrderAmendmentModal('${order.id}')">
                                <i class="fas fa-edit"></i> Amendement (Changer Client)
                            </button>
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
                            <div style="display: flex; flex-direction: column;">
                                <h2 style="margin-bottom: 4px;">Modifier la Commande #${order.id}</h2>
                                ${order.trackingCode ? `<div style="font-size: 0.8rem; color: var(--primary); font-family: monospace; font-weight: 600; letter-spacing: 1px;"><i class="fas fa-barcode"></i> CODE DE SUIVI: ${order.trackingCode}</div>` : ''}
                            </div>
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
                            <div class="form-group" style="border: 1px solid rgba(var(--primary-rgb), 0.2); padding: 15px; border-radius: 12px; background: rgba(var(--primary-rgb), 0.02); margin-bottom: 1.5rem;">
                                <label style="font-weight: 700; color: var(--primary); margin-bottom: 12px; display: block; font-size: 0.95rem;">
                                    <i class="fas fa-car-side"></i> Véhicule Sélectionné (Stock)
                                </label>
                                
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                                    <div>
                                        <label style="font-size: 0.75rem; color: var(--text-dim);">Filtrer par Marque</label>
                                        <select id="edit-filter-brand" class="glass-select" style="font-size: 0.85rem; padding: 6px 10px;">
                                            <option value="">Toutes</option>
                                            ${brands.map(b => `<option value="${b}">${b}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div>
                                        <label style="font-size: 0.75rem; color: var(--text-dim);">Catégorie</label>
                                        <select id="edit-filter-category" class="glass-select" style="font-size: 0.85rem; padding: 6px 10px;">
                                            <option value="">Toutes</option>
                                            <option value="Neuf">Neuf</option>
                                            <option value="Recent">Moins de 3 ans</option>
                                        </select>
                                    </div>
                                </div>

                                <div style="position: relative; margin-bottom: 12px;">
                                    <i class="fas fa-search" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-dim); font-size: 0.8rem;"></i>
                                    <input type="text" id="edit-vehicle-search" class="glass-input" placeholder="Rechercher par Châssis, Modèle..." style="padding-left: 30px; font-size: 0.85rem;" autocomplete="off">
                                </div>

                                <select name="vehicleId" id="edit-order-vehicle-select" class="glass-select" style="border-color: var(--primary); border-width: 1.5px;">
                                    <option value="">[SANS VÉHICULE EN STOCK]</option>
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
                                    <div>
                                        <label style="font-size: 0.8rem;">Finition Souhaitée</label>
                                        <select name="requestedTrim" id="edit-requested-trim" class="glass-select">
                                            <option value="">Sélectionner...</option>
                                            ${(() => {
                                                if (!order.requestedBrand || !order.requestedModel) return '';
                                                const brandsRaw = StorageService.get(STORAGE_KEYS.BRANDS_RAW) || [];
                                                const b = brandsRaw.find(br => br.name === order.requestedBrand);
                                                const m = b?.models?.find(md => md.name === order.requestedModel);
                                                return m?.trims?.map(t => `<option value="${t.name}" ${order.requestedTrim === t.name ? 'selected' : ''}>${t.name}</option>`).join('') || '';
                                            })()}
                                        </select>
                                    </div>
                                    <div>
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
                                <label>Référence Drive</label>
                                <input type="text" name="referenceDrive" class="glass-input" value="${order.referenceDrive || ''}" placeholder="Lien ou référence libre...">
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

        // --- VEHICLE SELECTION LOGIC (EDIT MODAL) ---
        const editVehicleSelect = document.getElementById('edit-order-vehicle-select');
        const editFilterBrand = document.getElementById('edit-filter-brand');
        const editFilterCategory = document.getElementById('edit-filter-category');
        const editVehicleSearch = document.getElementById('edit-vehicle-search');
        
        const refreshEditVehicles = () => {
            const brand = editFilterBrand.value;
            const category = editFilterCategory.value;
            const searchText = editVehicleSearch.value.toLowerCase();
            const currentYear = new Date().getFullYear();
            const selectedClientId = document.querySelector('#order-form [name="clientId"]').value;

            // Get fresh list of available vehicles
            // Include: vehicles with no orderId OR vehicles belonging to this specific order
            let filtered = StorageService.get(STORAGE_KEYS.VEHICLES).filter(v => 
                !v.archived && (!v.orderId || v.orderId === order.id)
            );

            if (brand) filtered = filtered.filter(v => v.brand === brand);
            if (category === 'Neuf') {
                filtered = filtered.filter(v => v.condition === 'Neuf');
            } else if (category === 'Recent') {
                filtered = filtered.filter(v => v.year >= (currentYear - 3));
            }

            if (searchText) {
                filtered = filtered.filter(v => {
                    const vClient = v.clientId ? StorageService.get(STORAGE_KEYS.CLIENTS).find(c => c.id === v.clientId) : null;
                    const vClientName = vClient ? (vClient.lastName + ' ' + vClient.firstName).toLowerCase() : '';
                    const vClientNIN = vClient ? (vClient.nin || '').toLowerCase() : '';
                    return (v.brand || '').toLowerCase().includes(searchText) ||
                        (v.model || '').toLowerCase().includes(searchText) ||
                        (v.chassisNumber || '').toLowerCase().includes(searchText) ||
                        (String(v.id)).toLowerCase().includes(searchText) ||
                        vClientName.includes(searchText) ||
                        vClientNIN.includes(searchText)
                    ;
                });
            }

            // Client check: Free or assigned to this client (Relaxed if search text is used)
            if (!searchText) {
                filtered = filtered.filter(v => !v.clientId || v.clientId === selectedClientId);
            }

            editVehicleSelect.innerHTML = '<option value="">[SANS VÉHICULE EN STOCK]</option>';
            filtered.forEach(v => {
                const option = document.createElement('option');
                option.value = v.id;
                if (v.id === order.vehicleId) option.selected = true;
                
                const vin = v.chassisNumber ? `VIN: ${v.chassisNumber}` : 'VIN: N/A';
                const color = v.color ? `${v.color}` : 'N/A';
                const km = v.mileage ? `${v.mileage.toLocaleString()} km` : '0 km';
                const cond = v.category || v.condition || 'N/A';
                
                const vClient = v.clientId ? StorageService.get(STORAGE_KEYS.CLIENTS).find(c => c.id === v.clientId) : null;
                const clientSuffix = vClient ? ` | RÉSERVÉ: ${vClient.lastName.toUpperCase()} ${vClient.firstName.toUpperCase()} ${vClient.nin ? `(NIN: ${vClient.nin})` : ''}` : '';

                option.textContent = `[#${v.id}] ${v.brand} ${v.model || ''} (${v.year}) | ${vin} | ${color} | ${km} | ${cond} ${clientSuffix} - ${this.formatCurrency(v.sellingPrice || v.price, v.sellingCurrency)}`;
                editVehicleSelect.appendChild(option);
            });
        };

        // Initialize filters with requested values if available
        if (order.requestedBrand) editFilterBrand.value = order.requestedBrand;
        // Category is not explicitly stored in order but we can try to infer or let user choose
        
        editFilterBrand.addEventListener('change', refreshEditVehicles);
        editFilterCategory.addEventListener('change', refreshEditVehicles);
        editVehicleSearch.addEventListener('input', refreshEditVehicles);
        document.querySelector('#order-form [name="clientId"]').addEventListener('change', refreshEditVehicles);

        // Initial populate
        refreshEditVehicles();
        // --------------------------------------------

        // Dynamic model population for Requested Fields
        const reqBrandSelect = document.getElementById('edit-requested-brand');
        const reqModelSelect = document.getElementById('edit-requested-model');

        if (reqBrandSelect && reqModelSelect) {
            reqBrandSelect.addEventListener('change', () => {
                const brand = reqBrandSelect.value;
                reqModelSelect.innerHTML = '<option value="">Sélectionner...</option>';
                const trimSel = document.getElementById('edit-requested-trim');
                if (trimSel) trimSel.innerHTML = '<option value="">Sélectionner...</option>';

                if (brand && brandModels[brand]) {
                    brandModels[brand].forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = m;
                        opt.textContent = m;
                        reqModelSelect.appendChild(opt);
                    });
                }
            });

            reqModelSelect.addEventListener('change', () => {
                const brand = reqBrandSelect.value;
                const model = reqModelSelect.value;
                const trimSel = document.getElementById('edit-requested-trim');
                
                if (trimSel) {
                    trimSel.innerHTML = '<option value="">Sélectionner...</option>';
                    if (brand && model) {
                        const brandsRaw = StorageService.get(STORAGE_KEYS.BRANDS_RAW) || [];
                        const brandObj = brandsRaw.find(b => b.name === brand);
                        if (brandObj && brandObj.models) {
                            const modelObj = brandObj.models.find(m => m.name === model);
                            if (modelObj && modelObj.trims) {
                                modelObj.trims.forEach(t => {
                                    const opt = document.createElement('option');
                                    opt.value = t.name;
                                    opt.textContent = t.name;
                                    trimSel.appendChild(opt);
                                });
                            }
                        }
                    }
                }
            });
        }



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

    getAmendmentStatus(vehicleId) {
        const transfers = StorageService.get(STORAGE_KEYS.TRANSFERS) || [];
        const vehicleTransfers = transfers.filter(t => String(t.vehicleId) === String(vehicleId) && (t.withBL === true || t.withBL === 1));
        
        if (vehicleTransfers.length === 0) return null;

        // Priority 1: Any transfer where request is not sent
        const toRequest = vehicleTransfers.find(t => !t.amendmentRequestSent);
        if (toRequest) return { status: 'pending', label: 'Amend. à demander', color: 'var(--warning)', id: toRequest.id };
        
        // Priority 2: Any transfer where request is sent but BL not received
        const toReceive = vehicleTransfers.find(t => !t.newBLReceived);
        if (toReceive) return { status: 'sent', label: 'Amend. envoyé', color: 'var(--primary)', id: toReceive.id };

        // Priority 3: Completed amendment
        return { status: 'completed', label: 'AMENDEMENT', color: 'var(--danger)', id: vehicleTransfers[0].id };
    },

    showVehicleDetails(id) {
        const vehicle = StorageService.get(STORAGE_KEYS.VEHICLES).find(v => v.id === id);
        if (!vehicle) return;

        const order = vehicle.orderId ? StorageService.get(STORAGE_KEYS.ORDERS).find(o => o.id === vehicle.orderId) : null;
        const clientId = vehicle.clientId || (order ? order.clientId : null);
        const client = clientId ? StorageService.get(STORAGE_KEYS.CLIENTS).find(c => String(c.id) === String(clientId)) : null;

        const brandsRaw = StorageService.get(STORAGE_KEYS.BRANDS_RAW) || [];
        const brandObj = brandsRaw.find(b => b.name === vehicle.brand);
        const modelObj = brandObj?.models?.find(m => m.name === vehicle.model);
        const trimObj = modelObj?.trims?.find(t => t.id === vehicle.trimId);
        const c = trimObj?.characteristics || null;

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
                                        <p><strong>Nom:</strong> <span class="badge-pill" style="background: rgba(var(--primary-rgb), 0.1); color: var(--primary); font-weight: 600;">${client.lastName} ${client.firstName}</span></p>
                                        <p><strong>ID Client:</strong> #${client.id || 'N/A'}</p>
                                        <p><strong>Showroom:</strong> ${client.showroom || 'N/A'}</p>
                                        <p><strong>NIN:</strong> ${client.nin || 'N/A'}</p>
                                        <p><strong>Passeport:</strong> ${client.passportNumber || 'N/A'} ${client.passportDriveLink ? `<a href="${client.passportDriveLink}" target="_blank" style="color: var(--primary); margin-left: 8px;" title="Voir Passeport (Drive)"><i class="fab fa-google-drive"></i></a>` : ''}</p>
                                    </div>
                                </div>` : ''}
                                <p><strong>Provenance/Fournisseur:</strong> ${vehicle.supplier || 'N/A'}</p>
                                ${vehicle.purchaseOrderId ? `<p><strong>Commande d'Achat (PO):</strong> <span class="badge-pill" style="background: rgba(var(--primary-rgb), 0.1); color: var(--primary); cursor: pointer;" onclick="app.closeModal(); app.renderPurchases('${vehicle.purchaseOrderId}')">${vehicle.purchaseOrderId}</span></p>` : ''}
                                <p><strong>Châssis (VIN):</strong> <code class="chassis">${vehicle.chassisNumber || 'N/A'}</code></p>
                                <p><strong>Année/Mois:</strong> ${vehicle.year || 'N/A'} ${vehicle.month ? '/ ' + vehicle.month : ''}</p>
                                ${vehicle.videoLink ? `<p><strong>Vidéo (Drive):</strong> <a href="${vehicle.videoLink}" target="_blank" style="color: var(--primary); font-weight: 600; text-decoration: none;"><i class="fab fa-google-drive"></i> Consulter la vidéo</a></p>` : ''}
                                ${vehicle.blLink ? `<p><strong>BL (Drive):</strong> <a href="${vehicle.blLink}" target="_blank" style="color: var(--primary); font-weight: 600; text-decoration: none;"><i class="fab fa-google-drive"></i> Consulter le BL</a></p>` : ''}
                            </div>
                            
                            <div class="details-section">
                                <h3><i class="fas fa-list-ul"></i> Options Libre</h3>
                                <div style="white-space: pre-line; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; font-size: 0.9rem; color: var(--text-secondary); max-height: 200px; overflow-y: auto;">
                                    ${vehicle.options || 'Aucune option renseignée.'}
                                </div>
                            </div>

                            <div class="details-section">
                                <h3><i class="fas fa-cogs"></i> Spécifications</h3>
                                <p><strong>Finition:</strong> ${vehicle.trim || 'N/A'}</p>
                                <p><strong>Couleur:</strong> ${vehicle.color || 'N/A'}</p>
                                <p><strong>Kilométrage:</strong> ${vehicle.mileage ? vehicle.mileage.toLocaleString() + ' km' : 'N/A'}</p>
                                
                                ${c ? `
                                <div style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
                                    <h4 style="margin-bottom: 10px; font-size: 0.95rem; color: var(--primary);"><i class="fas fa-star"></i> Équipements de la Finition</h4>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem; background: rgba(var(--primary-rgb), 0.05); padding: 12px; border-radius: 6px;">
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
                                    </div>
                                    ${c.remarks ? `<div style="margin-top: 10px; font-size: 0.85rem; font-style: italic; opacity: 0.8;"><i class="fas fa-comment-alt"></i> Remarques de finition: ${c.remarks}</div>` : ''}
                                </div>
                                ` : ''}
                            </div>

                            ${vehicle.remarks ? `
                            <div class="details-section">
                                <h3><i class="fas fa-comment-alt"></i> Remarques</h3>
                                <p style="font-style: italic;">${vehicle.remarks}</p>
                            </div>
                            ` : ''}

                            ${vehicle.soldRegistrationOwner ? `
                            <div class="details-section" style="background: rgba(var(--danger-rgb, 239, 68, 68), 0.05); border-left: 4px solid var(--danger); padding: 10px; border-radius: 4px;">
                                <h3 style="color: var(--danger);"><i class="fas fa-user-tag"></i> Nouveau Propriétaire (C.G)</h3>
                                <div style="white-space: pre-line; font-size: 0.9rem;">${vehicle.soldRegistrationOwner}</div>
                            </div>
                            ` : ''}
                        </div>
                        <div class="modal-footer">
                            <button class="btn-secondary" onclick="app.closeModal()">Fermer</button>
                            ${!vehicle.orderId ? `
                            <button class="btn-action warning-alt" style="margin-right: auto;" onclick="app.showTransferModal('${vehicle.id}')">
                                <i class="fas fa-edit"></i> Amendement (Changer Client)
                            </button>
                            ` : ''}
                            <button class="btn-primary" onclick="app.showEditVehicleModal('${vehicle.id}')">
                                <i class="fas fa-edit"></i> Modifier
                            </button>
                        </div>
                        <div id="transfer-history-container" style="padding: 20px; border-top: 1px solid rgba(255,255,255,0.1); display: none;">
                            <h3 style="font-size: 1rem; margin-bottom: 10px;"><i class="fas fa-history"></i> Historique des Transferts</h3>
                            <div id="transfer-history-list" style="font-size: 0.85rem;">
                                <!-- History items will be loaded here -->
                            </div>
                        </div>

                    </div>
                </div>
            `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.loadTransferHistory(id);
    },

    async loadTransferHistory(vehicleId) {
        try {
            const response = await ApiService.getVehicleTransfers(vehicleId);
            const container = document.getElementById('transfer-history-container');
            const list = document.getElementById('transfer-history-list');

            if (response.success && response.data && response.data.length > 0) {
                container.style.display = 'block';
                list.innerHTML = response.data.map(t => `
                    <div style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600;">Transfert vers : ${t.toClient?.lastName || 'Client Supprimé'} ${t.toClient?.firstName || ''}</div>
                            <div style="color: var(--text-dim); font-size: 0.8rem;">
                                ${this.formatDate(t.transferDate)} | ${t.withBL ? '<span style="color: var(--success);">Avec BL</span>' : '<span style="color: var(--warning);">Sans BL</span>'}
                            </div>
                            <div style="margin-top: 6px; margin-bottom: 6px; font-size: 0.85rem; display: flex; flex-direction: column; gap: 4px; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px; color: var(--text-dim);">
                                <label style="color: ${t.amendmentRequestSent ? 'var(--warning)' : 'inherit'}; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" ${t.amendmentRequestSent ? 'checked' : ''} onchange="app.toggleTransferStatus('${t.id}', 'amendmentRequestSent', this.checked, '${vehicleId}')"> 
                                    Amendement demandé
                                    ${t.amendmentRequestSent ? `<span style="font-size: 0.75rem; margin-left: 5px;">(Date : ${this.formatDate(t.transferDate)})</span>` : ''}
                                </label>
                                <label style="color: ${t.newBLReceived ? 'var(--success)' : 'inherit'}; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" ${t.newBLReceived ? 'checked' : ''} onchange="app.toggleTransferStatus('${t.id}', 'newBLReceived', this.checked, '${vehicleId}')"> 
                                    Nouveau BL reçu
                                </label>
                            </div>
                            ${t.notes ? `<div style="font-style: italic; margin-top: 4px;">"${t.notes}"</div>` : ''}
                        </div>
                        <div style="text-align: right; color: var(--text-dim);">
                            Précédent : ${t.fromClient?.lastName || 'Stock/N/A'} ${t.fromClient?.firstName || ''}
                        </div>
                    </div>
                `).join('');
            }
        } catch (err) {
            console.error("Error loading transfer history:", err);
        }
    },

    async toggleTransferStatus(transferId, field, newValue, vehicleId) {
        try {
            const data = {};
            data[field] = newValue;
            const response = await ApiService.updateVehicleTransfer(transferId, data);
            if (response.success) {
                this.showToast('Statut mis à jour', 'success');
                
                // Refresh dashboard if on dashboard
                if (this.currentView === 'dashboard') {
                    this.renderDashboard();
                }
                
                // Refresh transfer history list if it exists in an open modal
                if (document.getElementById('transfer-history-list')) {
                    this.loadTransferHistory(vehicleId);
                }
            } else {
                this.showToast(response.message || 'Erreur', 'error');
                if (document.getElementById('transfer-history-list')) {
                    this.loadTransferHistory(vehicleId);
                }
            }
        } catch (e) {
            console.error(e);
            this.showToast('Erreur serveur', 'error');
            if (document.getElementById('transfer-history-list')) {
                this.loadTransferHistory(vehicleId);
            }
        }
    },

    showOrderAmendmentModal(orderId) {
        const order = StorageService.get(STORAGE_KEYS.ORDERS).find(o => o.id === orderId);
        if (!order) return;
        this.showGenericTransferModal({
            targetId: orderId,
            type: 'order',
            title: `Amender la Commande #${orderId}`,
            vehicleId: order.vehicleId,
            currentClientId: order.clientId
        });
    },

    showTransferModal(vehicleId) {
        const vehicle = StorageService.get(STORAGE_KEYS.VEHICLES).find(v => v.id === vehicleId);
        if (!vehicle) return;
        this.showGenericTransferModal({
            targetId: vehicleId,
            type: 'vehicle',
            title: `Transférer le Véhicule #${vehicle.id}`,
            vehicleId: vehicleId,
            currentClientId: vehicle.clientId
        });
    },

    showGenericTransferModal({ targetId, type, title, vehicleId, currentClientId }) {
        const clients = StorageService.get(STORAGE_KEYS.CLIENTS) || [];
        
        const modalHtml = `
            <div id="transfer-modal-overlay" class="modal-overlay" style="z-index: 1100;">
                <div class="modal-content glass" style="width: 500px;">
                    <div class="modal-header">
                        <h2>${title}</h2>
                        <button class="btn-close" onclick="document.getElementById('transfer-modal-overlay').remove()">&times;</button>
                    </div>
                    <form id="transfer-form" style="padding: 20px;">
                        <input type="hidden" name="targetId" value="${targetId}">
                        <input type="hidden" name="transferType" value="${type}">
                        
                        <div class="form-group" id="client-selection-group">
                            <label>Nouveau Client</label>
                            <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 5px;">
                                <select name="toClientId" id="transfer-client-select" class="glass-select" style="flex: 1;">
                                    <option value="">Sélectionner un client existant...</option>
                                    ${clients.filter(c => String(c.id) !== String(currentClientId)).map(c => `<option value="${c.id}">${c.firstName} ${c.lastName}</option>`).join('')}
                                </select>
                                <button type="button" class="btn-secondary" onclick="app.toggleNewClientFields()" title="Créer un nouveau client">
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>
                        </div>

                        <div id="new-client-fields" style="display: none; background: rgba(255,255,255,0.03); padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px dashed rgba(255,255,255,0.1);">
                            <h3 style="font-size: 0.9rem; margin-bottom: 10px; color: var(--primary);">Informations Nouveau Client</h3>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <div class="form-group">
                                    <label>Nom</label>
                                    <input type="text" name="newClientLastName" class="glass-input">
                                </div>
                                <div class="form-group">
                                    <label>Prénom</label>
                                    <input type="text" name="newClientFirstName" class="glass-input">
                                </div>
                                <div class="form-group">
                                    <label>Téléphone</label>
                                    <input type="text" name="newClientPhone" class="glass-input">
                                </div>
                                <div class="form-group">
                                    <label>Showroom</label>
                                    <select name="newClientShowroom" class="glass-select">
                                        ${(StorageService.get(STORAGE_KEYS.SHOWROOMS) || []).map(s => `<option value="${s}">${s}</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                            <button type="button" class="btn-secondary" style="margin-top: 10px; width: 100%;" onclick="app.toggleNewClientFields(false)">
                                Annuler et choisir client existant
                            </button>
                        </div>

                        <div class="form-group" style="background: rgba(255,193,7,0.05); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,193,7,0.1); margin-bottom: 15px;">
                            <label style="color: var(--warning); font-weight: 600; font-size: 0.85rem; margin-bottom: 10px; display: block;">
                                <i class="fas fa-tasks"></i> Suivi de l'Amendement
                            </label>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.9rem;">
                                    <input type="checkbox" name="amendmentRequestSent" value="true"> 1. Demande d'amendement envoyée
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.9rem;">
                                    <input type="checkbox" name="newBLReceived" value="true"> 2. Nouveau BL reçu
                                </label>
                            </div>
                        </div>

                        ${type === 'vehicle' ? `
                        <div class="form-group">
                            <label>Option de Transfert</label>
                            <div style="display: flex; gap: 20px; margin-top: 10px;">
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                    <input type="radio" name="withBL" value="true" checked> Avec BL
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                    <input type="radio" name="withBL" value="false"> Sans BL
                                </label>
                            </div>
                        </div>
                        ` : ''}

                        <div class="form-group">
                            <label>Notes / Motif</label>
                            <textarea name="notes" class="glass-input" rows="2" placeholder="Ex: Transfert suite à désistement..."></textarea>
                        </div>

                        ${type === 'vehicle' ? `
                        <div class="form-group" style="margin-top: 10px;">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--warning);">
                                <input type="checkbox" name="transferOrderAsWell" value="true" checked> Transférer également la commande liée ?
                            </label>
                        </div>
                        ` : ''}

                        <div class="modal-footer" style="padding: 0; margin-top: 20px;">
                            <button type="button" class="btn-secondary" onclick="document.getElementById('transfer-modal-overlay').remove()">Annuler</button>
                            <button type="submit" class="btn-primary">Confirmer le ${type === 'vehicle' ? 'Transfert' : 'Amendement'}</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('transfer-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleGenericTransferSubmission(new FormData(e.target));
        });
    },

    toggleNewClientFields(show = true) {
        const fields = document.getElementById('new-client-fields');
        const selection = document.getElementById('client-selection-group');
        const select = document.getElementById('transfer-client-select');

        if (show) {
            fields.style.display = 'block';
            selection.style.display = 'none';
            select.value = ''; // Reset select
        } else {
            fields.style.display = 'none';
            selection.style.display = 'block';
        }
    },

    async handleGenericTransferSubmission(formData) {
        const targetId = formData.get('targetId');
        const transferType = formData.get('transferType');
        const submitBtn = document.querySelector('#transfer-form button[type="submit"]');
        
        const data = {
            toClientId: formData.get('toClientId'),
            withBL: formData.get('withBL') === 'true',
            amendmentRequestSent: formData.get('amendmentRequestSent') === 'true',
            newBLReceived: formData.get('newBLReceived') === 'true',
            notes: formData.get('notes'),
            transferOrderAsWell: formData.get('transferOrderAsWell') === 'true'
        };

        // If new client info provided
        if (formData.get('newClientFirstName')) {
            data.newClient = {
                firstName: formData.get('newClientFirstName'),
                lastName: formData.get('newClientLastName'),
                phone: formData.get('newClientPhone'),
                showroom: formData.get('newClientShowroom')
            };
        }

        if (!data.toClientId && !data.newClient) {
            return this.showToast("Veuillez sélectionner ou créer un client", "error");
        }

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traitement...';

            let result;
            if (transferType === 'vehicle') {
                result = await ApiService.transferVehicle(targetId, data);
            } else {
                // If it's an order amendment, we need the vehicleId first
                const order = StorageService.get(STORAGE_KEYS.ORDERS).find(o => o.id === targetId);
                if (order && order.vehicleId) {
                    // For orders, we force transferOrderAsWell to true because that's the point of the amendment
                    data.transferOrderAsWell = true;
                    result = await ApiService.transferVehicle(order.vehicleId, data);
                } else {
                    // Simple client change on order without vehicle? 
                    // (Backend might need a direct order transfer endpoint if vehicle is not assigned)
                    // For now, let's assume vehicles are usually assigned or we need a direct endpoint.
                    // Let's assume the user wants to change client on the order.
                    // We'll reuse the vehicle transfer logic if vehicleId exists, otherwise we'd need a new endpoint.
                    throw new Error("Cette commande n'a pas de véhicule affecté. Transfert direct non supporté dans cet amendement.");
                }
            }
            
            if (result.success) {
                this.showToast(transferType === 'vehicle' ? "Véhicule transféré avec succès" : "Commande amendée avec succès", "success");
                const overlay = document.getElementById('transfer-modal-overlay');
                if (overlay) overlay.remove();
                this.closeModal(); // Close vehicle details or order details
                
                // Sync data and refresh view
                await StorageService.syncAll();
                this.renderView(this.currentView);
            } else {
                throw new Error(result.message);
            }
        } catch (err) {
            this.showToast(err.message || "Erreur lors du traitement", "error");
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Confirmer';
        }
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
        this.initDatePickers(); // Pre-emptive cleanup if needed (though observer handles additions)

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
            case 'vehicle-prices':
                this.renderVehiclePrices();
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

            // Amendment tracking - Start with cached data if available, then fetch fresh in background
            let pendingAmendments = StorageService.get(STORAGE_KEYS.TRANSFERS).filter(t => !t.amendmentRequestSent) || [];
            let missingNewBLs = StorageService.get(STORAGE_KEYS.TRANSFERS).filter(t => t.amendmentRequestSent && !t.newBLReceived) || [];
            
            // Trigger background refresh
            setTimeout(() => this.refreshDashboardTransfers(), 100);


            const tibouVehicles = vehicles.filter(v => {
                // Exclude archived, truly sold (status), or marked as 'Vendu Carte Grise'
                if (v.archived || v.status === 'Sold' || v.soldRegistration) return false;

                const vShowroom = (v.showroom || '').trim().toUpperCase();

                // If vehicle is explicitly marked TIBOU → include
                if (vShowroom === 'TIBOU' || vShowroom.includes('TIBOU')) return true;

                // If vehicle has another explicit showroom (e.g. "COTONOU", "PARIS") → exclude
                if (vShowroom !== '') return false;

                // Vehicle showroom is empty → check order and client showrooms
                let orderShowroom = '';
                let clientShowroom = '';

                if (v.orderId) {
                    const order = orders.find(o => String(o.id) === String(v.orderId));
                    if (order) {
                        orderShowroom = (order.showroom || '').trim().toUpperCase();
                        const clientId = v.clientId || order.clientId;
                        if (clientId) {
                            const client = clients.find(c => String(c.id) === String(clientId));
                            clientShowroom = (client?.showroom || '').trim().toUpperCase();
                        }
                    }
                } else if (v.clientId) {
                    const client = clients.find(c => String(c.id) === String(v.clientId));
                    clientShowroom = (client?.showroom || '').trim().toUpperCase();
                }

                // Exclude if order or client explicitly belongs to another showroom
                const isTibouOrder = orderShowroom === '' || orderShowroom.includes('TIBOU');
                const isTibouClient = clientShowroom === '' || clientShowroom.includes('TIBOU');
                return isTibouOrder && isTibouClient;
            });
            console.log(`📊 Tibou vehicles found: ${tibouVehicles.length}`);

            // Fetch purchases for sorting and display
            const purchases = StorageService.get(STORAGE_KEYS.PURCHASE_ORDERS) || [];

            // Sort tibouVehicles by PO date (oldest to newest)
            tibouVehicles.sort((a, b) => {
                const poA = purchases.find(p => String(p.id) === String(a.purchaseOrderId));
                const poB = purchases.find(p => String(p.id) === String(b.purchaseOrderId));
                const dateA = poA ? new Date(poA.purchaseDate || poA.date) : new Date(0);
                const dateB = poB ? new Date(poB.purchaseDate || poB.date) : new Date(0);
                return dateA - dateB;
            });


            // --- Tibou Pivot Table Calculation ---
            const pivotData = {};
            const colorsSet = new Set();
            const modelsSet = new Set();
            tibouVehicles.forEach(v => {
                const model = (v.model || 'Inconnu').trim();
                const color = (v.color || 'Inconnu').trim();
                modelsSet.add(model);
                colorsSet.add(color);
                if (!pivotData[model]) pivotData[model] = {};
                pivotData[model][color] = (pivotData[model][color] || 0) + 1;
            });
            const sortedModels = Array.from(modelsSet).sort();
            const sortedColors = Array.from(colorsSet).sort();


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
                                                <span class="item-time">${this.formatDate(o.date)}</span>
                                            </div>
                                            <div class="item-desc">${o.clientName} - ${o.vehicleName}</div>
                                        </div>
                                    </div>
                                `).join('')}
                                ${orders.length === 0 ? '<p style="text-align: center; color: var(--text-dim);">Aucune activité récente</p>' : ''}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Amendment & Tibou Section -->
                    <div class="main-grid" style="margin-top: 30px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
                        <div class="chart-section glass animate delay-3">
                            <div class="section-title">
                                <h2><i class="fas fa-file-signature"></i> Amendements à demander</h2>
                                <span class="badge-pill" id="pending-amendments-count" style="background: var(--warning); color: #000; font-size: 0.8rem; padding: 2px 10px; font-weight: bold;">${pendingAmendments.length}</span>
                            </div>
                            <div class="glass-scroll" id="pending-amendments-list" style="max-height: 400px; padding: 15px; overflow-y: auto;">
                                ${pendingAmendments.length === 0 ? '<div style="text-align: center; padding: 40px; color: var(--text-dim); opacity: 0.6;"><i class="fas fa-sync fa-spin" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i> Chargement des amendements...</div>' : `
                                    <ul style="list-style: none; padding: 0;">
                                        ${pendingAmendments.map(pa => `
                                            <li style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                                                <input type="checkbox" onchange="app.toggleTransferStatus('${pa.id}', 'amendmentRequestSent', this.checked, '${pa.vehicleId}')" style="cursor: pointer; width: 20px; height: 20px; accent-color: var(--warning);">
                                                <div style="flex: 1;">
                                                    <div style="font-weight: 600; color: var(--primary); font-size: 0.95rem;">${pa.vehicle ? pa.vehicle.brand + ' ' + (pa.vehicle.model || '') : pa.vehicleId}</div>
                                                    <div style="font-size: 0.8rem; color: var(--text-dim); margin-top: 2px;">
                                                        <i class="fas fa-user-arrow-right"></i> Vers: <strong>${pa.toClient ? pa.toClient.firstName + ' ' + pa.toClient.lastName : 'Client ' + pa.toClientId}</strong>
                                                    </div>
                                                </div>
                                                <div style="font-size: 0.7rem; text-align: right; color: var(--text-dim); background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 6px;">
                                                    ${this.formatDate(pa.transferDate)}
                                                </div>
                                            </li>
                                        `).join('')}
                                    </ul>
                                `}
                            </div>
                        </div>
                        <div class="chart-section glass animate delay-3">
                            <div class="section-title">
                                <h2><i class="fas fa-file-import"></i> BL Amendement attendu</h2>
                                <span class="badge-pill" id="missing-bl-count" style="background: var(--primary); color: #fff; font-size: 0.8rem; padding: 2px 10px; font-weight: bold;">${missingNewBLs.length}</span>
                            </div>
                            <div class="glass-scroll" id="missing-bl-list" style="max-height: 400px; padding: 15px; overflow-y: auto;">
                                ${missingNewBLs.length === 0 ? '<div style="text-align: center; padding: 40px; color: var(--text-dim); opacity: 0.6;"><i class="fas fa-sync fa-spin" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i> Chargement...</div>' : `
                                    <ul style="list-style: none; padding: 0;">
                                        ${missingNewBLs.map(mbl => `
                                            <li style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                                                <input type="checkbox" onchange="app.toggleTransferStatus('${mbl.id}', 'newBLReceived', this.checked, '${mbl.vehicleId}')" style="cursor: pointer; width: 20px; height: 20px; accent-color: var(--success);">
                                                <div style="flex: 1;">
                                                    <div style="font-weight: 600; color: var(--success); font-size: 0.95rem;">${mbl.vehicle ? mbl.vehicle.brand + ' ' + (mbl.vehicle.model || '') : mbl.vehicleId}</div>
                                                    <div style="font-size: 0.8rem; color: var(--text-dim); margin-top: 2px;">
                                                        <i class="fas fa-user-check"></i> Pour: <strong>${mbl.toClient ? mbl.toClient.firstName + ' ' + mbl.toClient.lastName : 'Client ' + mbl.toClientId}</strong>
                                                    </div>
                                                </div>
                                                <div style="font-size: 0.7rem; text-align: right; color: var(--text-dim); background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 6px;">
                                                    ${this.formatDate(mbl.transferDate)}
                                                </div>
                                            </li>
                                        `).join('')}
                                    </ul>
                                `}
                            </div>
                        </div>
                        <div class="chart-section glass animate delay-3">
                            <div class="section-title">
                                <h2><i class="fas fa-warehouse"></i> Stock Tibou</h2>
                                <span class="badge-pill" style="background: var(--success); color: #fff; font-size: 0.8rem; padding: 2px 10px; font-weight: bold;">${tibouVehicles.length}</span>
                            </div>
                            <div class="glass-scroll" style="max-height: 400px; padding: 15px; overflow-y: auto;">
                                ${tibouVehicles.length === 0 ? '<div style="text-align: center; padding: 40px; color: var(--text-dim); opacity: 0.6;"><i class="fas fa-box-open" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i> Aucun véhicule à Tibou</div>' : `
                                    <ul style="list-style: none; padding: 0;">
                                        ${tibouVehicles.map(v => `
                                            <li style="margin-bottom: 10px; background: rgba(255,255,255,0.03); padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); cursor: pointer;" onclick="app.showVehicleDetails('${v.id}')">
                                                <div style="display: flex; justify-content: space-between; align-items: start;">
                                                    <div style="font-weight: 600; color: var(--text-primary);">
                                                        ${v.brand} ${v.model || ''}
                                                        <div style="display: flex; gap: 8px;">
                                                            ${v.videoLink ? `<a href="${v.videoLink}" target="_blank" style="color: var(--primary);" title="Vidéo"><i class="fas fa-video"></i></a>` : ''}
                                                            ${v.blLink ? `<a href="${v.blLink}" target="_blank" style="color: var(--primary);" title="BL"><i class="fas fa-file-invoice"></i></a>` : ''}
                                                        </div>
                                                    </div>
                                                    <span style="font-size: 0.65rem; background: rgba(var(--primary-rgb), 0.1); color: var(--primary); padding: 2px 6px; border-radius: 4px;">${v.year || '-'}</span>
                                                </div>
                                                <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 4px;">
                                                    <i class="fas fa-barcode"></i> ${v.chassisNumber || 'Sans VIN'}
                                                </div>
                                                <div style="margin-top: 6px; display: flex; gap: 5px;">
                                                    <span class="badge-pill" style="font-size: 0.6rem; background: ${v.status === 'Available' ? 'var(--success)22' : 'var(--warning)22'}; color: ${v.status === 'Available' ? 'var(--success)' : 'var(--warning)'}; border: none;">${v.status}</span>
                                                    ${v.color ? `<span class="badge-pill" style="font-size: 0.6rem; background: rgba(255,255,255,0.05); color: var(--text-dim); border: none;">${v.color}</span>` : ''}
                                                </div>
                                            </li>
                                        `).join('')}
                                    </ul>
                                `}
                            </div>
                        </div>
                    </div>

                    <!-- Tibou Pivot Table -->
                    <div class="chart-section glass animate delay-3" style="margin-top: 30px;">
                        <div class="section-title">
                            <h2><i class="fas fa-th"></i> Tableau Croisé : Modèles vs Couleurs (Tibou)</h2>
                        </div>
                        <div class="glass-scroll" style="overflow-x: auto; padding: 15px;">
                            <table class="pivot-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem; color: var(--text-primary);">
                                <thead>
                                    <tr>
                                        <th style="text-align: left; padding: 12px; border-bottom: 2px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02);">Modèle / Couleur</th>
                                        ${sortedColors.map(c => `<th style="text-align: center; padding: 12px; border-bottom: 2px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02); min-width: 80px;">${c}</th>`).join('')}
                                        <th style="text-align: center; padding: 12px; border-bottom: 2px solid rgba(255,255,255,0.1); font-weight: bold; background: rgba(var(--primary-rgb), 0.1); color: var(--primary);">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${sortedModels.map(m => {
                                        let rowTotal = 0;
                                        return `
                                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                                                <td style="padding: 12px; font-weight: 600; color: var(--primary); border-right: 1px solid rgba(255,255,255,0.05);">${m}</td>
                                                ${sortedColors.map(c => {
                                                    const count = pivotData[m][c] || 0;
                                                    rowTotal += count;
                                                    return `<td style="text-align: center; padding: 12px; ${count > 0 ? 'color: var(--success); font-weight: 700;' : 'opacity: 0.2;'}">${count || '-'}</td>`;
                                                }).join('')}
                                                <td style="text-align: center; padding: 12px; font-weight: bold; background: rgba(var(--primary-rgb), 0.05); color: var(--primary);">${rowTotal}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                                <tfoot>
                                    <tr style="background: rgba(255,255,255,0.05); font-weight: bold;">
                                        <td style="padding: 12px; border-top: 2px solid rgba(255,255,255,0.1);">TOTAL GÉNÉRAL</td>
                                        ${sortedColors.map(c => {
                                            const colTotal = sortedModels.reduce((sum, m) => sum + (pivotData[m][c] || 0), 0);
                                            return `<td style="text-align: center; padding: 12px; border-top: 2px solid rgba(255,255,255,0.1);">${colTotal}</td>`;
                                        }).join('')}
                                        <td style="text-align: center; padding: 12px; border-top: 2px solid rgba(255,255,255,0.1); color: var(--primary); font-size: 1rem; background: rgba(var(--primary-rgb), 0.1);">${tibouVehicles.length}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <!-- Tibou Detailed List -->
                    <div class="chart-section glass animate delay-3" style="margin-top: 30px;">
                        <div class="section-title">
                            <h2><i class="fas fa-list-ul"></i> Détails des Véhicules Tibou</h2>
                        </div>
                        <div class="glass-scroll" style="overflow-x: auto; padding: 15px;">
                            <table class="pivot-table" style="width: 100%; border-collapse: collapse; font-size: 0.8rem; color: var(--text-primary);">
                                <thead>
                                    <tr style="background: rgba(255,255,255,0.02);">
                                        <th style="text-align: left; padding: 12px; border-bottom: 2px solid rgba(255,255,255,0.1);">Véhicule</th>
                                        <th style="text-align: left; padding: 12px; border-bottom: 2px solid rgba(255,255,255,0.1);">Châssis (VIN)</th>
                                        <th style="text-align: center; padding: 12px; border-bottom: 2px solid rgba(255,255,255,0.1);">PO (Achat)</th>
                                        <th style="text-align: center; padding: 12px; border-bottom: 2px solid rgba(255,255,255,0.1);">Date Achat</th>
                                        <th style="text-align: left; padding: 12px; border-bottom: 2px solid rgba(255,255,255,0.1);">Client Affecté</th>
                                        <th style="text-align: center; padding: 12px; border-bottom: 2px solid rgba(255,255,255,0.1);">Date Charg.</th>
                                        <th style="text-align: center; padding: 12px; border-bottom: 2px solid rgba(255,255,255,0.1);">Chargé</th>
                                        <th style="text-align: center; padding: 12px; border-bottom: 2px solid rgba(255,255,255,0.1);">Vidéo</th>
                                        <th style="text-align: center; padding: 12px; border-bottom: 2px solid rgba(255,255,255,0.1);">BL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tibouVehicles.map(v => {
                                        const order = v.orderId ? orders.find(o => String(o.id) === String(v.orderId)) : null;
                                        const client = (v.clientId || order?.clientId) ? clients.find(c => String(c.id) === String(v.clientId || order.clientId)) : null;
                                        const shipment = v.shipmentId ? shipments.find(s => String(s.id) === String(v.shipmentId)) : null;
                                        
                                        const po = v.purchaseOrderId ? purchases.find(p => String(p.id) === String(v.purchaseOrderId)) : null;

                                        const transfers = StorageService.get(STORAGE_KEYS.TRANSFERS) || [];
                                        const vehicleTransfer = transfers.find(t => String(t.vehicleId) === String(v.id));
                                        const isAmendmentPending = vehicleTransfer && vehicleTransfer.withBL && !vehicleTransfer.newBLReceived;
                                        
                                        return `
                                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                                                <td style="padding: 12px; font-weight: 600; color: var(--primary); cursor: pointer;" onclick="app.showVehicleDetails('${v.id}')">
                                                    ${v.brand} ${v.model || ''}
                                                </td>
                                                <td style="padding: 12px; font-family: monospace; font-size: 0.75rem; color: var(--text-dim);">${v.chassisNumber || 'N/A'}</td>
                                                <td style="padding: 12px; text-align: center; color: var(--text-dim);">${v.purchaseOrderId || 'N/A'}</td>
                                                <td style="padding: 12px; text-align: center; color: var(--warning); font-weight: 600;">${po ? this.formatDate(po.purchaseDate || po.date) : '-'}</td>
                                                <td style="padding: 12px;">
                                                    ${client ? `<span class="badge-pill" style="background: rgba(${isAmendmentPending ? 'var(--warning-rgb, 245, 158, 11)' : 'var(--primary-rgb, 99, 102, 241)'}, 0.1); color: ${isAmendmentPending ? 'var(--warning)' : 'var(--primary)'}; border: none; font-weight: 600;">${client.lastName} ${client.firstName}</span>` : '<span style="opacity: 0.4; font-style: italic;">DISPONIBLE (STOCK)</span>'}
                                                </td>
                                                <td style="padding: 12px; text-align: center; color: var(--text-dim);">
                                                    ${shipment ? this.formatDate(shipment.date) : '-'}
                                                </td>
                                                <td style="padding: 12px; text-align: center;">
                                                    ${shipment ? '<span style="color: var(--success); font-weight: bold;"><i class="fas fa-check-circle"></i> OUI</span>' : '<span style="opacity: 0.3;">NON</span>'}
                                                </td>
                                                <td style="padding: 12px; text-align: center;">
                                                    ${v.videoLink ? `<a href="${v.videoLink}" target="_blank" style="color: var(--primary); font-size: 1.1rem;"><i class="fab fa-google-drive"></i></a>` : '<i class="fas fa-minus" style="opacity: 0.2;"></i>'}
                                                </td>
                                                <td style="padding: 12px; text-align: center;">
                                                    ${v.blLink ? `<a href="${v.blLink}" target="_blank" style="color: var(--primary); font-size: 1.1rem;"><i class="fas fa-file-pdf"></i></a>` : '<i class="fas fa-minus" style="opacity: 0.2;"></i>'}
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
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
                                <div class="alert-icon bg-success-soft"><i class="fas fa-hand-holding-usd"></i></div>
                                <div class="alert-content">
                                    <div class="alert-title">
                                        Paiements Attendus
                                        <span class="alert-badge bg-success-soft">Trésorerie</span>
                                    </div>
                                    <div class="alert-desc">
                                        <strong>${unpaidAmount > 0 ? this.formatCurrency(unpaidAmount, reportingCurrency) : '0'}</strong> à recouvrer sur l'ensemble des commandes actives.
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

    async refreshDashboardTransfers() {
        const pendingList = document.getElementById('pending-amendments-list');
        const pendingCount = document.getElementById('pending-amendments-count');
        const missingList = document.getElementById('missing-bl-list');
        const missingCount = document.getElementById('missing-bl-count');

        try {
            console.log("🔄 Background refresh of transfers for dashboard...");
            const response = await ApiService.getAllTransfers();
            if (response.success) {
                const allTransfers = response.data || [];
                console.log(`✅ Fetched ${allTransfers.length} transfers from server.`);
                if (allTransfers.length > 0) {
                    console.log("🔍 Sample transfer record:", allTransfers[0]);
                }
                
                // Save to local storage for future use
                localStorage.setItem(STORAGE_KEYS.TRANSFERS, JSON.stringify(allTransfers));

                // Filter logic: relax the !!t.withBL requirement if no results found with it, 
                // but prioritize it if it was selected. 
                // Actually, let's show ALL pending amendments regardless of withBL for maximum visibility.
                const pendingAmendments = allTransfers.filter(t => !t.amendmentRequestSent);
                const missingNewBLs = allTransfers.filter(t => t.amendmentRequestSent && !t.newBLReceived);

                if (pendingCount) pendingCount.textContent = pendingAmendments.length;
                if (pendingList) {
                    pendingList.innerHTML = pendingAmendments.length === 0 ? 
                        '<div style="text-align: center; padding: 40px; color: var(--text-dim); opacity: 0.6;"><i class="fas fa-check-circle" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i> Aucun amendement en attente</div>' : `
                        <ul style="list-style: none; padding: 0;">
                            ${pendingAmendments.map(pa => `
                                <li style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                                    <input type="checkbox" onchange="app.toggleTransferStatus('${pa.id}', 'amendmentRequestSent', this.checked, '${pa.vehicleId}')" style="cursor: pointer; width: 20px; height: 20px; accent-color: var(--warning);">
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600; color: var(--primary); font-size: 0.9rem;">${pa.vehicle ? pa.vehicle.brand + ' ' + (pa.vehicle.model || '') : pa.vehicleId}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 2px; line-height: 1.4;">
                                            <div><i class="fas fa-user-arrow-right"></i> Vers: <strong>${pa.toClient ? pa.toClient.firstName + ' ' + pa.toClient.lastName : 'Client ' + pa.toClientId}</strong> ${!pa.withBL ? '<span style="font-size: 0.6rem; opacity: 0.6;">(Sans BL)</span>' : ''}</div>
                                            <div style="display: flex; gap: 10px; opacity: 0.8; font-size: 0.7rem; margin-top: 2px;">
                                                <span><i class="fas fa-truck"></i> ${pa.vehicle?.supplier || 'N/A'}</span>
                                                <span><i class="fas fa-file-invoice"></i> ${pa.vehicle?.purchaseOrderId || 'N/A'}</span>
                                                <span><i class="fas fa-ship"></i> ${pa.vehicle?.shipment?.forwarder || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div style="font-size: 0.65rem; text-align: right; color: var(--text-dim); background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 6px; align-self: flex-start;">
                                        ${this.formatDate(pa.transferDate)}
                                    </div>
                                </li>
                            `).join('')}
                        </ul>
                    `;
                }

                if (missingCount) missingCount.textContent = missingNewBLs.length;
                if (missingList) {
                    missingList.innerHTML = missingNewBLs.length === 0 ? 
                        '<div style="text-align: center; padding: 40px; color: var(--text-dim); opacity: 0.6;"><i class="fas fa-envelope-open" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i> Tous les BL ont été reçus</div>' : `
                        <ul style="list-style: none; padding: 0;">
                            ${missingNewBLs.map(mbl => `
                                <li style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                                    <input type="checkbox" onchange="app.toggleTransferStatus('${mbl.id}', 'newBLReceived', this.checked, '${mbl.vehicleId}')" style="cursor: pointer; width: 20px; height: 20px; accent-color: var(--success);">
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600; color: var(--success); font-size: 0.9rem;">${mbl.vehicle ? mbl.vehicle.brand + ' ' + (mbl.vehicle.model || '') : mbl.vehicleId}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 2px; line-height: 1.4;">
                                            <div><i class="fas fa-user-check"></i> Pour: <strong>${mbl.toClient ? mbl.toClient.firstName + ' ' + mbl.toClient.lastName : 'Client ' + mbl.toClientId}</strong></div>
                                            <div style="display: flex; gap: 10px; opacity: 0.8; font-size: 0.7rem; margin-top: 2px;">
                                                <span><i class="fas fa-truck"></i> ${mbl.vehicle?.supplier || 'N/A'}</span>
                                                <span><i class="fas fa-file-invoice"></i> ${mbl.vehicle?.purchaseOrderId || 'N/A'}</span>
                                                <span><i class="fas fa-ship"></i> ${mbl.vehicle?.shipment?.forwarder || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div style="font-size: 0.65rem; text-align: right; color: var(--text-dim); background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 6px; align-self: flex-start;">
                                        ${this.formatDate(mbl.transferDate)}
                                    </div>
                                </li>
                            `).join('')}
                        </ul>
                    `;
                }
            }
        } catch (err) {
            console.warn("⚠️ Failed to background refresh transfers:", err);
            if (pendingList && pendingList.innerHTML.includes('fa-spin')) {
                pendingList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--danger); opacity: 0.6;"><i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i> Erreur de chargement API</div>';
            }
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
                    String(o.trackingCode || '').toLowerCase().includes(q) ||
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
            
            const transfers = StorageService.get(STORAGE_KEYS.TRANSFERS) || [];
            const vehicleTransfer = vehicle ? transfers.find(t => String(t.vehicleId) === String(vehicle.id)) : null;
            const isAmendmentPending = vehicleTransfer && vehicleTransfer.withBL && !vehicleTransfer.newBLReceived;

            const vehicleName = vehicle ? `${vehicle.brand} ${vehicle.model || ''} ${vehicle.trim || ''} (${vehicle.year})`.trim().replace(/\s+/g, ' ') : (order.vehicleName || 'Sans véhicule');
            const shipment = vehicle && vehicle.shipmentId ? shipments.find(s => s.id === vehicle.shipmentId) : null;
            const isShipped = !!shipment;

            const paid = this.getPaidAmount(order.id);
            const netPrice = (order.totalAmount || 0) - (order.discount || 0);
            const balance = Math.max(0, netPrice - paid);
            const isPaid = balance <= 0;

            return `
                                <tr>
                                    <td style="font-weight: 600;">
                                        <div style="color: var(--primary);">#${order.id}</div>
                                        ${order.trackingCode ? `<div style="font-size: 0.65rem; color: var(--text-dim); margin-top: 2px; font-family: monospace; letter-spacing: 1px;">SUIVI: ${order.trackingCode}</div>` : ''}
                                    </td>
                                    <td>
                                        <div style="font-weight: 500; color: ${isAmendmentPending ? 'var(--warning)' : 'inherit'};">
                                            ${client ? (client.lastName + ' ' + client.firstName).toUpperCase() : 'CLIENT INCONNU'}
                                        </div>
                                        ${client && client.passportDriveLink ? `<div style="font-size: 0.7rem;"><i class="fab fa-google-drive"></i> <a href="${client.passportDriveLink}" target="_blank" style="color: var(--primary);">Passeport</a></div>` : ''}
                                        ${client && client.company ? `<div style="font-size: 0.75rem; color: var(--text-dim);">${client.company}</div>` : ''}
                                        ${client && client.reference ? `<div style="font-size: 0.75rem; color: var(--text-dim);">Réf: ${client.reference}</div>` : ''}
                                    </td>
                                    <td>
                                        <div style="font-family: monospace; color: var(--text-dim); display: flex; align-items: center; gap: 5px;">
                                            #${order.vehicleId || 'N/A'}
                                            ${(() => {
                                                if (!order.vehicleId) return '';
                                                const amend = this.getAmendmentStatus(order.vehicleId);
                                                return amend ? `<span class="badge-pill" style="font-size: 0.6rem; background: ${amend.color}22; color: ${amend.color}; padding: 1px 4px; border: 1px solid ${amend.color}33;" title="${amend.label}">AMEND.</span>` : '';
                                            })()}
                                        </div>
                                    </td>
                                    <td>${vehicleName}</td>
                                    <td>${this.formatDate(order.date)}</td>
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
                                    <td>
                                        <!-- Documents column (Placeholder or logic) -->
                                        <span style="font-size: 0.8rem; color: var(--text-dim);">-</span>
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
                                <h3>${client.lastName} ${client.firstName}</h3>
                                <div class="client-details">
                                    <span><i class="fas fa-envelope"></i> <a href="mailto:${client.email}" style="color: inherit;">${client.email}</a></span>
                                    <span><i class="fas fa-phone"></i> ${client.phone}</span>
                                    <span><i class="fas fa-map-marker-alt"></i> ${client.address}</span>
                                    <span><i class="fas fa-id-card"></i> Passeport: ${client.passportNumber || '-'} ${client.passportDriveLink ? `<a href="${client.passportDriveLink}" target="_blank" style="color: var(--primary); margin-left: 8px;" title="Voir Passeport (Drive)"><i class="fab fa-google-drive"></i></a>` : ''}</span>
                                    <span><i class="fas fa-fingerprint"></i> NIN: ${client.nin || '-'}</span>
                                    <span><i class="fas fa-hashtag"></i> Réf: ${client.reference || '-'}</span>
                                    <span><i class="fas fa-store"></i> ${client.showroom || 'Non assigné'}</span>
                                </div>
                            </div>
                            <div class="client-actions">
                                <button class="btn-action info" onclick="app.showClientDetails('${client.id}')" title="Détails du client"><i class="fas fa-info-circle"></i></button>
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
                                <input type="text" name="reference" value="${app.generateClientReference()}" class="glass-input" required>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Nom</label>
                                    <input type="text" name="lastName" required class="glass-input">
                                </div>
                                <div class="form-group">
                                    <label>Prénom</label>
                                    <input type="text" name="firstName" required class="glass-input">
                                </div>
                            </div>
                             <div class="form-group">
                                <label>Showroom</label>
                                <select name="showroom" class="glass-select">
                                    <option value="">Sélectionner un showroom</option>
                                    ${StorageService.get(STORAGE_KEYS.SHOWROOMS).map(s => `<option value="${s}" ${s.toUpperCase() === 'TOUGGOURT' ? 'selected' : ''}>${s}</option>`).join('')}
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
                            <div class="form-group">
                                <label><i class="fab fa-google-drive"></i> Lien Drive Passeport (URL)</label>
                                <input type="url" name="passportDriveLink" class="glass-input" placeholder="https://drive.google.com/...">
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
                passportDriveLink: formData.get('passportDriveLink'),
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
                                <strong>Référence | Nom | Prénom | Email | Téléphone | Adresse | Code Postal | Passeport | NIN | Showroom | Entreprise | Lien Drive</strong>
                            </div>
                            <div class="form-group">
                                <label>Données Clients (Une ligne par client)</label>
                                <textarea name="batchData" class="glass-input" rows="15" 
                                    placeholder="REF001	Dupont	Jean	jean@email.com	0601020304	Paris	A1234567	123456789	Showroom A	MaSociété"
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
                    reference, lastName, firstName, email, phone,
                    address, postalCode, passport, nin, showroom, company, driveLink
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
                    company: company || '',
                    passportDriveLink: driveLink || ''
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


    showClientDetails(id) {
        const client = StorageService.get(STORAGE_KEYS.CLIENTS).find(c => c.id === id);
        if (!client) return;

        const orders = StorageService.get(STORAGE_KEYS.ORDERS).filter(o => o.clientId === id);
        const vehicles = StorageService.get(STORAGE_KEYS.VEHICLES).filter(v => v.clientId === id || (v.orderId && orders.some(o => o.id === v.orderId)));

        const modalHtml = `
            <div class="modal-overlay">
                <div class="modal-content glass" style="width: 90vw; max-width: 900px; max-height: 85vh; overflow-y: auto;">
                    <div class="modal-header">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(client.firstName + ' ' + client.lastName)}&background=6366f1&color=fff" 
                                 style="width: 50px; height: 50px; border-radius: 12px; border: 2px solid var(--primary);">
                            <div>
                                <h2 style="margin: 0;">${client.lastName} ${client.firstName}</h2>
                                <span style="font-size: 0.85rem; color: var(--text-dim);"><i class="fas fa-hashtag"></i> ${client.reference || 'Sans réf'} | <i class="fas fa-store"></i> ${client.showroom || 'Showroom Principal'}</span>
                                ${client.email ? `
                                <div style="margin-top: 5px; display: flex; align-items: center; gap: 10px;">
                                    <span style="font-size: 0.85rem; color: var(--text-dim);"><i class="fas fa-envelope"></i> ${client.email}</span>
                                    <button class="btn-action" style="font-size: 0.7rem; padding: 2px 8px; color: #3b82f6; border: 1px solid #3b82f6; background: rgba(59, 130, 246, 0.1); border-radius: 4px;" onclick="app.sendTestEmail('${client.id}', this)" title="Envoyer un email de test"><i class="fas fa-paper-plane"></i> Tester l'email</button>
                                </div>` : ''}
                            </div>
                        </div>
                        <button class="btn-close" onclick="app.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body" style="padding: 20px;">
                        
                        <!-- Commandes de Vente Section -->
                        <div class="section-title" style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                            <h3><i class="fas fa-file-invoice-dollar" style="color: var(--primary);"></i> Commandes de Vente</h3>
                            <span class="badge-pill" style="background: rgba(var(--primary-rgb), 0.1); color: var(--primary);">${orders.length}</span>
                        </div>
                        
                        <div class="glass-scroll" style="margin-bottom: 30px; background: rgba(255,255,255,0.02); border-radius: 15px; border: 1px solid var(--border-glass);">
                            ${orders.length === 0 ? `
                                <div style="padding: 30px; text-align: center; color: var(--text-dim);">
                                    <i class="fas fa-folder-open" style="font-size: 2rem; margin-bottom: 10px; display: block; opacity: 0.5;"></i>
                                    Aucune commande trouvée pour ce client.
                                </div>
                            ` : `
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>ID Commande</th>
                                            <th>Date</th>
                                            <th>Véhicule</th>
                                            <th>Montant</th>
                                            <th>Statut</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${orders.map(o => `
                                            <tr style="cursor: pointer;" onclick="app.showOrderDetails('${o.id}')">
                                                <td><strong style="color: var(--primary);">#${o.id}</strong></td>
                                                <td>${this.formatDate(o.date)}</td>
                                                <td>${o.vehicleName || '-'}</td>
                                                <td>${this.formatCurrency(o.totalAmount, o.currency)}</td>
                                                <td><span class="badge-pill" style="background: ${this.getStatusColor(o.status)}22; color: ${this.getStatusColor(o.status)}; border: none;">${o.status}</span></td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            `}
                        </div>

                        <!-- Véhicules Affectés Section -->
                        <div class="section-title" style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                            <h3><i class="fas fa-car" style="color: var(--success);"></i> Véhicules Affectés</h3>
                            <span class="badge-pill" style="background: rgba(34, 197, 94, 0.1); color: var(--success);">${vehicles.length}</span>
                        </div>
                        
                        <div class="glass-scroll" style="background: rgba(255,255,255,0.02); border-radius: 15px; border: 1px solid var(--border-glass);">
                            ${vehicles.length === 0 ? `
                                <div style="padding: 30px; text-align: center; color: var(--text-dim);">
                                    <i class="fas fa-car-side" style="font-size: 2rem; margin-bottom: 10px; display: block; opacity: 0.5;"></i>
                                    Aucun véhicule affecté à ce client.
                                </div>
                            ` : `
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Véhicule / VIN</th>
                                            <th>Fournisseur / PO</th>
                                            <th>Dates (ETD / ETA)</th>
                                            <th>Chargement</th>
                                            <th>Statut</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${vehicles.map(v => {
                                            const shipments = StorageService.get(STORAGE_KEYS.SHIPMENTS) || [];
                                            let shipment = shipments.find(s => String(s.id) === String(v.shipmentId));
                                            if (!shipment && v.shipment) shipment = v.shipment;

                                            const purchases = StorageService.get(STORAGE_KEYS.PURCHASE_ORDERS) || [];
                                            const po = v.purchaseOrderId ? purchases.find(p => String(p.id) === String(v.purchaseOrderId)) : null;

                                            const amend = this.getAmendmentStatus(v.id);
                                            return `
                                            <tr style="cursor: pointer;" onclick="app.showVehicleDetails('${v.id}')">
                                                <td>
                                                    <div style="font-weight: 600;">
                                                        ${v.brand} ${v.model || ''}
                                                        <div style="display: flex; gap: 8px;">
                                                            ${v.videoLink ? `<a href="${v.videoLink}" target="_blank" style="color: var(--primary);" title="Vidéo"><i class="fas fa-video"></i></a>` : ''}
                                                            ${v.blLink ? `<a href="${v.blLink}" target="_blank" style="color: var(--primary);" title="BL"><i class="fas fa-file-invoice"></i></a>` : ''}
                                                        </div>
                                                        ${amend ? `<span class="badge-pill" style="font-size: 0.65rem; background: ${amend.color}22; color: ${amend.color}; border: 1px solid ${amend.color}33; margin-left: 5px;">${amend.label}</span>` : ''}
                                                    </div>
                                                    <div style="font-size: 0.75rem; font-family: monospace; color: var(--primary);">
                                                        ${v.chassisNumber || 'SANS VIN'}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style="font-size: 0.85rem;"><strong>F:</strong> ${v.supplier || (po ? po.supplierName : '-')}</div>
                                                    <div style="font-size: 0.75rem; color: var(--text-dim);">PO: ${v.purchaseOrderId || '-'}</div>
                                                </td>
                                                <td>
                                                    <div style="font-size: 0.8rem;">ETD: ${shipment && shipment.etd ? this.formatDate(shipment.etd) : (po && po.etd ? this.formatDate(po.etd) : '-')}</div>
                                                    <div style="font-size: 0.8rem;">ETA: ${shipment && shipment.eta ? this.formatDate(shipment.eta) : (po && po.eta ? this.formatDate(po.eta) : '-')}</div>
                                                </td>
                                                <td>
                                                    <div style="font-size: 0.8rem;">${shipment && shipment.date ? this.formatDate(shipment.date) : (po && po.loadingDate ? this.formatDate(po.loadingDate) : '-')}</div>
                                                    <div style="font-size: 0.7rem; color: var(--text-dim);">${shipment ? (shipment.loadingPort || '-') : (po && po.loadingPort ? po.loadingPort : '-')}</div>
                                                </td>

                                                <td><span class="badge-pill" style="background: ${v.status === 'Sold' ? 'var(--success)22' : 'var(--warning)22'}; color: ${v.status === 'Sold' ? 'var(--success)' : 'var(--warning)'}; border: none;">${v.status}</span></td>
                                            </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            `}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="app.closeModal()">Fermer</button>
                        <button class="btn-primary" onclick="app.showEditClientModal('${client.id}')">Modifier Client</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
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
                                    <label>Nom</label>
                                    <input type="text" name="lastName" value="${client.lastName}" required class="glass-input">
                                </div>
                                <div class="form-group">
                                    <label>Prénom</label>
                                    <input type="text" name="firstName" value="${client.firstName}" required class="glass-input">
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
                            <div class="form-group">
                                <label><i class="fab fa-google-drive"></i> Lien Drive Passeport (URL)</label>
                                <input type="url" name="passportDriveLink" value="${client.passportDriveLink || ''}" class="glass-input" placeholder="https://drive.google.com/...">
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

    renderClientSelectionTable(selectedId = null) {
        const clients = StorageService.get(STORAGE_KEYS.CLIENTS) || [];
        return `
            <div class="excel-table-wrapper" style="max-height: 250px; overflow-y: auto;">
                <table class="excel-like-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                    <thead style="position: sticky; top: 0; background: var(--bg-dark); z-index: 10;">
                        <tr style="background: rgba(255,255,255,0.05);">
                            <th style="padding: 10px; border: 1px solid rgba(255,255,255,0.1); text-align: left;">ID</th>
                            <th style="padding: 10px; border: 1px solid rgba(255,255,255,0.1); text-align: left;">Nom</th>
                            <th style="padding: 10px; border: 1px solid rgba(255,255,255,0.1); text-align: left;">Showroom</th>
                            <th style="padding: 10px; border: 1px solid rgba(255,255,255,0.1); text-align: left;">NIN</th>
                            <th style="padding: 10px; border: 1px solid rgba(255,255,255,0.1); text-align: left;">Passeport</th>
                        </tr>
                        <tr class="filter-row" style="background: rgba(255,255,255,0.02);">
                            <th style="padding: 5px; border: 1px solid rgba(255,255,255,0.1);"><input type="text" class="multi-filter-input glass-input" style="width: 100%; font-size: 0.75rem; padding: 4px;" data-col-index="0" placeholder="Filtre ID..."></th>
                            <th style="padding: 5px; border: 1px solid rgba(255,255,255,0.1);"><input type="text" class="multi-filter-input glass-input" style="width: 100%; font-size: 0.75rem; padding: 4px;" data-col-index="1" placeholder="Filtre Nom..."></th>
                            <th style="padding: 5px; border: 1px solid rgba(255,255,255,0.1);"><input type="text" class="multi-filter-input glass-input" style="width: 100%; font-size: 0.75rem; padding: 4px;" data-col-index="2" placeholder="Filtre Showroom..."></th>
                            <th style="padding: 5px; border: 1px solid rgba(255,255,255,0.1);"><input type="text" class="multi-filter-input glass-input" style="width: 100%; font-size: 0.75rem; padding: 4px;" data-col-index="3" placeholder="Filtre NIN..."></th>
                            <th style="padding: 5px; border: 1px solid rgba(255,255,255,0.1);"><input type="text" class="multi-filter-input glass-input" style="width: 100%; font-size: 0.75rem; padding: 4px;" data-col-index="4" placeholder="Filtre Passeport..."></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="client-row ${!selectedId || selectedId === '' ? 'selected-row' : ''}" data-id="" style="cursor: pointer; transition: all 0.2s;">
                            <td colspan="5" style="padding: 10px; text-align: center; border: 1px solid rgba(255,255,255,0.1); font-style: italic;">Stock Libre (Aucun client)</td>
                        </tr>
                        ${clients.map(c => `
                            <tr class="client-row ${String(selectedId) === String(c.id) ? 'selected-row' : ''}" data-id="${c.id}" style="cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <td style="padding: 8px 10px; border-right: 1px solid rgba(255,255,255,0.1);">#${c.id}</td>
                                <td style="padding: 8px 10px; border-right: 1px solid rgba(255,255,255,0.1); font-weight: 500;">${c.lastName} ${c.firstName}</td>
                                <td style="padding: 8px 10px; border-right: 1px solid rgba(255,255,255,0.1);">${c.showroom || '-'}</td>
                                <td style="padding: 8px 10px; border-right: 1px solid rgba(255,255,255,0.1);">${c.nin || '-'}</td>
                                <td style="padding: 8px 10px;">${c.passportNumber || '-'} ${c.passportDriveLink ? `<a href="${c.passportDriveLink}" target="_blank" style="color: var(--primary); margin-left: 5px;" title="Voir Passeport (Drive)"><i class="fab fa-google-drive"></i></a>` : ''}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <style>
                .client-row:hover { background: rgba(255, 255, 255, 0.05); }
                .client-row.selected-row { 
                    background: var(--primary, #6366f1) !important; 
                    color: #fff !important;
                }
                .client-row.selected-row td {
                    color: #fff !important;
                    border-right-color: rgba(255,255,255,0.2) !important;
                }
                .multi-filter-input:focus { border-color: var(--primary) !important; outline: none; }
            </style>
        `;
    },

    initClientSelectionTable() {
        const tableContainer = document.getElementById('client-selection-table-container');
        if (!tableContainer) return;

        const hiddenInput = document.getElementById('selected-client-id');
        const searchInputs = tableContainer.querySelectorAll('.multi-filter-input');
        const rows = tableContainer.querySelectorAll('.client-row');

        const filterRows = () => {
            const filters = Array.from(searchInputs).map(input => ({
                index: input.dataset.colIndex,
                value: input.value.toLowerCase()
            }));

            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length < 5) {
                    // Skip "Stock Libre" or handle differently (always show or ignore)
                    row.style.display = ''; 
                    return;
                }
                const match = filters.every(f => (cells[f.index]?.textContent || '').toLowerCase().includes(f.value));
                row.style.display = match ? '' : 'none';
            });
        };

        searchInputs.forEach(input => input.addEventListener('input', filterRows));

        rows.forEach(row => {
            row.addEventListener('click', (e) => {
                // Prevent click on input from triggering row select
                if (e.target.tagName === 'INPUT') return;
                
                rows.forEach(r => r.classList.remove('selected-row'));
                row.classList.add('selected-row');
                const clientId = row.dataset.id || '';
                hiddenInput.value = clientId;
                console.log('Selected client ID:', clientId);
            });
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
                String(v.trim || '').toLowerCase().includes(q) ||
                String(v.id || '').toLowerCase().includes(q)
            );
        }

        // Apply advanced filters
        if (this.vehicleFilters) {
            if (this.vehicleFilters.brand && this.vehicleFilters.brand.length > 0) {
                const brands = Array.isArray(this.vehicleFilters.brand) ? this.vehicleFilters.brand : [this.vehicleFilters.brand];
                vehicles = vehicles.filter(v => brands.includes(v.brand));
            }
            if (this.vehicleFilters.model && this.vehicleFilters.model.length > 0) {
                const models = Array.isArray(this.vehicleFilters.model) ? this.vehicleFilters.model : [this.vehicleFilters.model];
                vehicles = vehicles.filter(v => models.includes(v.model));
            }
            if (this.vehicleFilters.status && this.vehicleFilters.status.length > 0) {
                const statuses = Array.isArray(this.vehicleFilters.status) ? this.vehicleFilters.status : [this.vehicleFilters.status];
                vehicles = vehicles.filter(v => statuses.includes(v.status));
            }
            if (this.vehicleFilters.color && this.vehicleFilters.color.length > 0) {
                const colors = Array.isArray(this.vehicleFilters.color) ? this.vehicleFilters.color : [this.vehicleFilters.color];
                vehicles = vehicles.filter(v => colors.includes(v.color));
            }
            if (this.vehicleFilters.supplier && this.vehicleFilters.supplier.length > 0) {
                const suppliers = Array.isArray(this.vehicleFilters.supplier) ? this.vehicleFilters.supplier : [this.vehicleFilters.supplier];
                vehicles = vehicles.filter(v => suppliers.includes(v.supplier));
            }
            if (this.vehicleFilters.purchaseOrderId && this.vehicleFilters.purchaseOrderId.length > 0) {
                const pos = Array.isArray(this.vehicleFilters.purchaseOrderId) ? this.vehicleFilters.purchaseOrderId : [this.vehicleFilters.purchaseOrderId];
                vehicles = vehicles.filter(v => pos.includes(v.purchaseOrderId));
            }
            if (this.vehicleFilters.showroom && this.vehicleFilters.showroom.length > 0) {
                const targetShowrooms = Array.isArray(this.vehicleFilters.showroom) ? this.vehicleFilters.showroom : [this.vehicleFilters.showroom];
                
                const orders = StorageService.get(STORAGE_KEYS.ORDERS) || [];
                const clients = StorageService.get(STORAGE_KEYS.CLIENTS) || [];

                vehicles = vehicles.filter(v => {
                    let rawShowroom = v.showroom || '';
                    const clientId = v.clientId || (v.orderId ? (orders.find(o => o.id === v.orderId)?.clientId) : null);
                    if (clientId) {
                        const client = clients.find(c => String(c.id) === String(clientId));
                        if (client && client.showroom) rawShowroom = client.showroom;
                    } else if (v.orderId && !rawShowroom) {
                        const order = orders.find(o => o.id === v.orderId);
                        if (order && order.showroom) rawShowroom = order.showroom;
                    }

                    // Compute normalized display showroom matching the badges
                    let displayShowroom = '';
                    if (v.soldRegistration) {
                        displayShowroom = 'VENDU CG';
                    } else {
                        const s = String(rawShowroom).toUpperCase();
                        if (s.includes('TOUG')) displayShowroom = 'TOUGGOURT';
                        else if (s.includes('ALGER')) displayShowroom = 'ALGER';
                        else if (s.includes('ORAN')) displayShowroom = 'ORAN';
                        else if (s.includes('TIBOU')) displayShowroom = 'TIBOU';
                        else if (s.trim() !== '' && rawShowroom) displayShowroom = rawShowroom;
                        else displayShowroom = 'VIDE';
                    }

                    return targetShowrooms.some(target => {
                        if (target === 'TIBOU_STOCK') {
                            if (v.soldRegistration) return false;
                            const s = (v.showroom || '').trim().toUpperCase();
                            return s === '' || s.includes('TIBOU');
                        }
                        return displayShowroom.toUpperCase() === target.toUpperCase();
                    });
                });
            }
        }

        if (!this.vehicleFilters.showArchived) {
            vehicles = vehicles.filter(v => !v.archived);
        }

        // --- Compute available filter options based on remaining vehicles ---
        const remainingBrands = new Set(vehicles.map(v => v.brand));
        const remainingModels = new Set(vehicles.map(v => v.model));
        const remainingColors = new Set(vehicles.map(v => v.color));
        const remainingSuppliers = new Set(vehicles.map(v => v.supplier));
        const remainingPOs = new Set(vehicles.map(v => v.purchaseOrderId));
        
        const remainingShowrooms = new Set();
        const allOrders = StorageService.get(STORAGE_KEYS.ORDERS) || [];
        const allClients = StorageService.get(STORAGE_KEYS.CLIENTS) || [];
        vehicles.forEach(v => {
            if (v.soldRegistration) {
                remainingShowrooms.add('VENDU CG');
            } else {
                let rawShowroom = v.showroom;
                if (v.orderId && !rawShowroom) {
                    const o = allOrders.find(x => x.id === v.orderId);
                    if (o && o.showroom) rawShowroom = o.showroom;
                }
                const clientId = v.clientId || (v.orderId ? allOrders.find(x => x.id === v.orderId)?.clientId : null);
                if (clientId && !rawShowroom) {
                    const c = allClients.find(x => String(x.id) === String(clientId));
                    if (c && c.showroom) rawShowroom = c.showroom;
                }

                if (rawShowroom) {
                    const s = String(rawShowroom).toUpperCase();
                    if (s.includes('TOUG')) remainingShowrooms.add('TOUGGOURT');
                    else if (s.includes('ALGER')) remainingShowrooms.add('ALGER');
                    else if (s.includes('ORAN')) remainingShowrooms.add('ORAN');
                    else if (s.includes('TIBOU')) remainingShowrooms.add('TIBOU');
                    else remainingShowrooms.add(rawShowroom);
                } else {
                    remainingShowrooms.add('VIDE');
                }
            }
        });

        // Always include the currently selected value so the dropdown doesn't blank out
        const ensureRemaining = (val, set) => {
            if (!val) return;
            if (Array.isArray(val)) val.forEach(v => set.add(v));
            else set.add(val);
        };
        ensureRemaining(this.vehicleFilters?.brand, remainingBrands);
        ensureRemaining(this.vehicleFilters?.model, remainingModels);
        ensureRemaining(this.vehicleFilters?.color, remainingColors);
        ensureRemaining(this.vehicleFilters?.supplier, remainingSuppliers);
        ensureRemaining(this.vehicleFilters?.purchaseOrderId, remainingPOs);
        
        if (this.vehicleFilters?.showroom) {
            const shws = Array.isArray(this.vehicleFilters.showroom) ? this.vehicleFilters.showroom : [this.vehicleFilters.showroom];
            shws.forEach(s => {
                if (s !== 'TIBOU_STOCK') remainingShowrooms.add(s);
            });
        }

        const isSelected = (filterVal, optionVal) => {
            if (!filterVal) return false;
            return Array.isArray(filterVal) ? filterVal.includes(optionVal) : filterVal === optionVal;
        };

        const showroomOptions = [...new Set([...(StorageService.get(STORAGE_KEYS.SHOWROOMS) || []), 'VIDE', 'VENDU CG'])];

        if (!app._hasMultiselectListener) {
            document.addEventListener('click', () => {
                if (app.activeDropdown) {
                    app.activeDropdown = null;
                    app.renderVehicles();
                }
            });
            app._hasMultiselectListener = true;
        }

        if (!app.handleMultiSelect) {
            app._filterTimeout = null;
            app.handleMultiSelect = function(key, value, isChecked, isBrand) {
                let current = app.vehicleFilters[key] || [];
                if (!Array.isArray(current)) current = [current];
                if (isChecked) {
                    if (!current.includes(value)) current.push(value);
                } else {
                    current = current.filter(v => String(v) !== String(value));
                }
                if (isBrand) app.vehicleFilters.model = [];
                app.vehicleFilters[key] = current;
                
                // Debounce re-render to allow multiple selections
                if (app._filterTimeout) clearTimeout(app._filterTimeout);
                
                // Show a small hint that update is pending in the header if possible
                const header = document.querySelector(`.custom-multiselect.open .multiselect-header span`);
                if (header) header.innerHTML = '<i class="fas fa-sync fa-spin"></i> Mise à jour...';

                app._filterTimeout = setTimeout(() => {
                    app.renderVehicles();
                }, 5000); // 5 seconds delay
            };
        }

        const renderMultiSelect = (key, label, options, currentFilters) => {
            const isOpen = app.activeDropdown === key;
            const current = currentFilters[key] || [];
            const currentArr = Array.isArray(current) ? current : [current];
            const selectedCount = currentArr.filter(Boolean).length;
            const headerText = selectedCount > 0 ? `${selectedCount} sélection(s)` : `Tous`;
            
            return `
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 0.8rem; color: var(--text-dim);">${label}</label>
                <div class="custom-multiselect ${isOpen ? 'open' : ''}" onclick="app.activeDropdown = app.activeDropdown === '${key}' ? null : '${key}'; app.renderVehicles(); event.stopPropagation()">
                    <div class="multiselect-header">
                        <span>${headerText}</span>
                        <i class="fas fa-chevron-${isOpen ? 'up' : 'down'}"></i>
                    </div>
                    <div class="multiselect-dropdown" onclick="event.stopPropagation()">
                        ${options.length === 0 ? '<div style="font-size: 0.8rem; color: var(--text-dim); text-align: center;">Aucune option</div>' : ''}
                        <div class="multiselect-options-list" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;">
                            ${options.map(opt => `
                                <label class="multiselect-option">
                                    <input type="checkbox" value="${String(opt.value).replace(/"/g, '&quot;')}" ${isSelected(currentFilters[key], opt.value) ? 'checked' : ''} 
                                        onchange="app.handleMultiSelect('${key}', this.value, this.checked, ${key === 'brand'})">
                                    ${opt.label}
                                </label>
                            `).join('')}
                        </div>
                        <button class="btn-primary" style="width: 100%; padding: 6px; font-size: 0.75rem; margin-top: 5px;" onclick="if(app._filterTimeout) clearTimeout(app._filterTimeout); app.activeDropdown = null; app.renderVehicles();">
                            <i class="fas fa-check"></i> Valider
                        </button>
                    </div>
                </div>
            </div>
            `;
        };

        const brandOptions = (StorageService.get(STORAGE_KEYS.BRANDS) || []).filter(b => remainingBrands.has(b)).map(b => ({value: b, label: b}));
        const modelOptions = (this.vehicleFilters.brand ? (StorageService.get(STORAGE_KEYS.BRAND_MODELS)[Array.isArray(this.vehicleFilters.brand) ? this.vehicleFilters.brand[0] : this.vehicleFilters.brand] || []) : []).filter(m => remainingModels.has(m)).map(m => ({value: m, label: m}));
        const statusOptions = [
            {value: 'Available', label: 'Disponible (Libre)'},
            {value: 'Reserved', label: 'Réservé (Affecté)'},
            {value: 'In Transit', label: 'En Expédition (Transit)'},
            {value: 'Arrived', label: 'Arrivé (Port)'},
            {value: 'Sold', label: 'Vendu (Livré)'}
        ];
        const colorOptions = (StorageService.get(STORAGE_KEYS.COLORS) || []).filter(c => remainingColors.has(c)).map(c => ({value: c, label: c}));
        const supplierOptions = (StorageService.get(STORAGE_KEYS.SUPPLIERS) || []).map(s => s.name).filter(s => remainingSuppliers.has(s)).map(s => ({value: s, label: s}));
        const showroomOpts = showroomOptions.filter(s => remainingShowrooms.has(s)).map(s => ({value: s, label: s}));
        const poOptions = [...new Set((StorageService.get(STORAGE_KEYS.VEHICLES) || []).filter(v => v.purchaseOrderId).map(v => v.purchaseOrderId))].filter(poId => remainingPOs.has(poId)).map(poId => ({value: poId, label: poId}));

        this.viewContainer.innerHTML = `
                <div class="view-header">
                    <div class="header-info">
                        <h1>Inventaire des Véhicules</h1>
                        <p>${vehicles.length} véhicules enregistrés</p>
                    </div>
                    <div class="header-actions">
                        <button class="btn-secondary" style="background: ${this.vehicleFilters.showroom === 'TIBOU_STOCK' ? 'var(--primary)' : 'var(--bg-glass)'}; color: ${this.vehicleFilters.showroom === 'TIBOU_STOCK' ? 'white' : 'var(--text-primary)'}; border-color: ${this.vehicleFilters.showroom === 'TIBOU_STOCK' ? 'var(--primary)' : 'var(--border-glass)'};" onclick="app.vehicleFilters = {...app.vehicleFilters, showroom: app.vehicleFilters.showroom === 'TIBOU_STOCK' ? '' : 'TIBOU_STOCK', showArchived: false}; app.renderVehicles()">
                            <i class="fas fa-store"></i> ${this.vehicleFilters.showroom === 'TIBOU_STOCK' ? 'Filtré: Stock Tibou' : 'Stock Tibou'}
                        </button>
                        ${canCreate ? `
                        <button class="btn-secondary" onclick="app.showBatchVehicleModal()" style="margin-right: 10px;"><i class="fas fa-file-csv"></i> Création par Lot</button>
                        <button class="btn-primary" onclick="app.showVehicleModal()"><i class="fas fa-plus"></i> Nouveau Véhicule</button>
                        ` : ''}
                    </div>
                </div>
                <div class="glass" style="margin-bottom: 20px; padding: 20px; position: relative; z-index: 1000;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; align-items: end;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.8rem; color: var(--text-dim);">Recherche Rapide</label>
                            <input type="text" class="glass-input" style="padding: 8px 12px; font-size: 0.9rem;" placeholder="VIN, Marque, ID..." value="${query || ''}" oninput="app.renderVehicles(this.value)">
                        </div>
                        ${renderMultiSelect('brand', 'Marque', brandOptions, this.vehicleFilters)}
                        ${renderMultiSelect('model', 'Modèle', modelOptions, this.vehicleFilters)}
                        ${renderMultiSelect('status', 'Statut Stock', statusOptions, this.vehicleFilters)}
                        ${renderMultiSelect('color', 'Couleur', colorOptions, this.vehicleFilters)}
                        ${renderMultiSelect('supplier', 'Fournisseur', supplierOptions, this.vehicleFilters)}
                        ${renderMultiSelect('showroom', 'Showroom', showroomOpts, this.vehicleFilters)}
                        ${renderMultiSelect('purchaseOrderId', "Commande d'Achat", poOptions, this.vehicleFilters)}
                        <div class="form-group" style="margin-bottom: 0; display: flex; flex-direction: column; gap: 10px;">
                            <div style="display: flex; align-items: center; gap: 8px; justify-content: center; background: rgba(255,255,255,0.05); padding: 5px 10px; border-radius: 8px; height: 38px;">
                                <input type="checkbox" id="filter-vehicle-archived" ${this.vehicleFilters.showArchived ? 'checked' : ''} onchange="app.vehicleFilters = {...app.vehicleFilters, showArchived: this.checked}; app.renderVehicles()" style="width: 18px; height: 18px; cursor: pointer;">
                                <label for="filter-vehicle-archived" style="font-size: 0.8rem; cursor: pointer; margin: 0; color: var(--text-dim);">Archives</label>
                            </div>
                            <button class="btn-secondary" style="padding: 8px 12px; font-size: 0.85rem; width: 100%;" onclick="app.vehicleFilters = {showArchived: false}; app.renderVehicles()"><i class="fas fa-undo"></i> Reset Filtres</button>
                        </div>
                    </div>
                </div>
                <div class="glass data-table-container" style="position: relative; z-index: 1;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th style="width: 40px;">#</th>
                                <th>ID</th>
                                <th>Véhicule</th>
                                <th>Source (Achat)</th>
                                <th>Client</th>
                                <th>Showroom</th>
                                <th>N° Vente</th>
                                <th>Châssis (VIN)</th>
                                <th>Specs Tech.</th>
                                ${canViewPurchasePrice ? '<th>Prix Achat</th>' : ''}
                                <th>DD (Est.)</th>
                                <th>Statut</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${vehicles.map((v, idx) => {
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
                                <tr ${v.archived ? 'style="opacity: 0.6;"' : ''}>
                                    <td style="color: var(--text-dim); font-size: 0.8rem; font-weight: 500;">${idx + 1}</td>
                                    <td><strong>#${v.id}</strong></td>
                                    <td>
                                        <div style="display: flex; align-items: center; gap: 15px;">
                                            ${brandLogo ? `<img src="${brandLogo}" style="width: 50px; height: 50px; object-fit: contain; background: rgba(255,255,255,0.05); border-radius: 8px; padding: 4px;" onerror="this.style.display='none'">` : ''}
                                            <div>
                                                <div style="font-weight: 600;">
                                                    ${v.brand || 'Sans Marque'}${v.model ? ' ' + v.model : ''}
                                                    ${(() => {
                                                        const amend = this.getAmendmentStatus(v.id);
                                                        return amend ? `<span class="badge-pill" style="font-size: 0.65rem; background: ${amend.color}22; color: ${amend.color}; margin-left: 5px; border: 1px solid ${amend.color}44;">${amend.label}</span>` : '';
                                                    })()}
                                                </div>
                                                <div style="font-size: 0.75rem; color: var(--text-dim);">${v.year || '-'} | ${v.color || '-'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style="font-size: 0.85rem;">
                                        ${v.purchaseOrderId ? `<span class="badge-pill" style="background: rgba(var(--primary-rgb), 0.1); color: var(--primary); cursor: pointer;" onclick="app.renderPurchases('${v.purchaseOrderId}')">${v.purchaseOrderId}</span>` : '<span style="color:var(--text-dim);">Entrée Directe</span>'}
                                    </td>
                                    ${(() => {
                                        const clientId = v.clientId || (v.orderId ? (StorageService.get(STORAGE_KEYS.ORDERS).find(o => o.id === v.orderId)?.clientId) : null);
                                        let clientName = '<span style="color:var(--text-dim);">STOCK LIBRE</span>';
                                        
                                        let rawShowroom = v.showroom || '';

                                        if (clientId) {
                                            const client = StorageService.get(STORAGE_KEYS.CLIENTS).find(c => String(c.id) === String(clientId));
                                            if (client) {
                                                clientName = `
                                                    <div style="font-weight: 500;">${(client.lastName + ' ' + client.firstName).toUpperCase()}</div>
                                                    ${client.passportDriveLink ? `<div style="font-size: 0.7rem;"><i class="fab fa-google-drive"></i> <a href="${client.passportDriveLink}" target="_blank" style="color: var(--primary);">Passeport</a></div>` : ''}
                                                `;
                                                if (!rawShowroom && client.showroom) rawShowroom = client.showroom;
                                            } else {
                                                clientName = '<span style="color:red;">Erreur Client</span>';
                                            }
                                        } else if (v.orderId && !rawShowroom) {
                                            const order = StorageService.get(STORAGE_KEYS.ORDERS).find(o => o.id === v.orderId);
                                            if (order && order.showroom) rawShowroom = order.showroom;
                                        }
                                        
                                        let showroomDisplay = '';
                                        if (v.soldRegistration) {
                                            showroomDisplay = '<span class="badge-pill" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; font-size: 0.75rem; font-weight: 800;">VENDUE CG</span>';
                                        } else {
                                            const s = String(rawShowroom).toUpperCase();
                                            if (s.includes('TOUG')) {
                                                showroomDisplay = '<span class="badge-pill" style="background: rgba(168, 85, 247, 0.2); color: #a855f7; font-weight: bold;">TOUGGOURT</span>';
                                            } else if (s.includes('ALGER')) {
                                                showroomDisplay = '<span class="badge-pill" style="background: rgba(59, 130, 246, 0.2); color: #3b82f6; font-weight: bold;">ALGER</span>';
                                            } else if (s.includes('ORAN')) {
                                                showroomDisplay = '<span class="badge-pill" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; font-weight: bold;">ORAN</span>';
                                            } else if (s.includes('TIBOU')) {
                                                showroomDisplay = '<span class="badge-pill" style="background: rgba(99, 102, 241, 0.2); color: var(--primary); font-weight: bold;">TIBOU</span>';
                                            } else if (rawShowroom && String(rawShowroom).trim() !== '') {
                                                showroomDisplay = `<span class="badge-pill" style="background: rgba(255, 255, 255, 0.05); color: var(--text-secondary); border: 1px solid rgba(255,255,255,0.1);">${rawShowroom}</span>`;
                                            } else {
                                                showroomDisplay = '<span style="color: var(--text-dim); font-style: italic; font-size: 0.8rem;">VIDE</span>';
                                            }
                                        }

                                        return `
                                            <td style="font-size: 0.85rem;">${clientName}</td>
                                            <td style="font-size: 0.85rem; text-align: center;">
                                                ${showroomDisplay}
                                            </td>
                                            <td style="font-size: 0.85rem; font-weight: 600; color: var(--primary);">
                                                ${v.orderId ? `<span class="badge-pill" style="background: rgba(var(--primary-rgb), 0.1); padding: 2px 6px;">#${v.orderId}</span>` : '-'}
                                            </td>
                                        `;
                                    })()}
                                    <td>
                                        <code style="font-size: 0.8rem;">${v.chassisNumber || '-'}</code>
                                        ${v.videoLink ? `<a href="${v.videoLink}" target="_blank" style="color: var(--primary); margin-left: 8px;" title="Voir Vidéo (Drive)" onclick="event.stopPropagation()"><i class="fas fa-video"></i></a>` : ''}
                                        ${v.blLink ? `<a href="${v.blLink}" target="_blank" style="color: var(--primary); margin-left: 8px;" title="Voir BL (Drive)" onclick="event.stopPropagation()"><i class="fas fa-file-invoice"></i></a>` : ''}
                                    </td>
                                    <td>
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
                                        <select name="trim" id="trim-select" class="glass-select">
                                            <option value="">Sélectionner d'abord un modèle...</option>
                                        </select>
                                        <input type="hidden" name="trimId" id="trim-id-input">
                                        <div id="trim-info-box" style="margin-top: 10px; font-size: 0.8rem; background: rgba(var(--primary-rgb), 0.1); border-radius: 6px; padding: 10px; display: none; border: 1px solid rgba(var(--primary-rgb), 0.2);"></div>
                                    </div>
                                    <div class="form-group">
                                        <label>Lien Vidéo (Drive)</label>
                                        <input type="url" name="videoLink" class="glass-input" placeholder="https://drive.google.com/...">
                                    </div>
                                    <div class="form-group">
                                        <label>Lien BL (Drive)</label>
                                        <input type="url" name="blLink" class="glass-input" placeholder="https://drive.google.com/...">
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
                                    <div class="form-group" style="grid-column: span 2;">
                                        <label>Affecter à un Client (Sélection par Tableau)</label>
                                        <div id="client-selection-table-container" class="glass" style="margin-top: 5px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
                                            ${this.renderClientSelectionTable()}
                                        </div>
                                        <input type="hidden" name="clientId" id="selected-client-id">
                                    </div>
                                </div>
                            </fieldset>

                            <fieldset style="border: 1px solid rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px;">
                                <legend style="padding: 0 0.5rem; color: var(--accent-blue); font-weight: 500;">Caractéristiques</legend>
                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
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
                            
                            <div class="form-group" style="display: flex; align-items: center; gap: 10px; margin-top: 10px; padding: 10px; background: rgba(var(--danger-rgb, 239, 68, 68), 0.1); border-radius: 8px; border: 1px solid rgba(var(--danger-rgb, 239, 68, 68), 0.2);">
                                <input type="checkbox" name="soldRegistration" id="soldRegistration" style="width: 20px; height: 20px;" onchange="document.getElementById('sold-owner-container').style.display = this.checked ? 'block' : 'none'">
                                <label for="soldRegistration" style="color: var(--danger); font-weight: bold; margin: 0; cursor: pointer;">
                                    Vendu Carte Grise (Affiche 'VENDU C.G' au lieu du Showroom)
                                </label>
                            </div>
                            
                            <div id="sold-owner-container" class="form-group" style="display: none; margin-top: 10px; background: rgba(var(--primary-rgb), 0.05); padding: 15px; border-radius: 8px; border: 1px solid rgba(var(--primary-rgb), 0.1);">
                                <label style="color: var(--primary); font-weight: 600;"><i class="fas fa-user-check"></i> Sélectionner le Propriétaire</label>
                                <div style="position: relative; margin-bottom: 8px;">
                                    <i class="fas fa-search" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-dim); font-size: 0.8rem;"></i>
                                    <input type="text" id="sold-client-search" class="glass-input" placeholder="Rechercher par Nom ou NIN..." style="padding-left: 30px; font-size: 0.85rem;" autocomplete="off">
                                </div>
                                <select name="soldRegistrationOwnerId" id="sold-client-select" class="glass-select">
                                    <option value="">-- Sélectionner un client --</option>
                                    ${StorageService.get(STORAGE_KEYS.CLIENTS).map(c => `<option value="${c.id}" data-name="${c.lastName} ${c.firstName} (NIN: ${c.nin || 'N/A'})">${c.lastName} ${c.firstName} | NIN: ${c.nin || 'N/A'}</option>`).join('')}
                                </select>
                                <div id="sold-order-selection-container" style="margin-top: 10px; display: none;">
                                    <label style="color: var(--primary); font-size: 0.8rem; font-weight: 600;"><i class="fas fa-file-invoice"></i> Lier à une commande existante (Optionnel)</label>
                                    <select name="soldRegistrationOrderId" id="sold-order-select" class="glass-select">
                                        <option value="">-- Pas de commande spécifique --</option>
                                    </select>
                                </div>
                                <input type="hidden" name="soldRegistrationOwner" id="sold-registration-owner-text">
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

        // Add event listeners for cascading selects
        const brandSelect = document.querySelector('select[name="brand"]');
        const modelSelect = document.getElementById('model-select');
        const trimSelect = document.getElementById('trim-select');
        const trimIdInput = document.getElementById('trim-id-input');
        const brandsRaw = StorageService.get(STORAGE_KEYS.BRANDS_RAW) || [];

        brandSelect.addEventListener('change', (e) => {
            const selectedBrandName = e.target.value;
            modelSelect.innerHTML = '<option value="">Sélectionner d\'abord une marque...</option>';
            trimSelect.innerHTML = '<option value="">Sélectionner d\'abord un modèle...</option>';
            
            const brandObj = brandsRaw.find(b => b.name === selectedBrandName);
            if (brandObj && brandObj.models) {
                modelSelect.innerHTML = '<option value="">Sélectionner le modèle...</option>';
                brandObj.models.forEach(model => {
                    modelSelect.innerHTML += `<option value="${model.name}" data-id="${model.id}">${model.name}</option>`;
                });
            }
        });

        modelSelect.addEventListener('change', (e) => {
            const selectedModelName = e.target.value;
            const selectedOption = e.target.options[e.target.selectedIndex];
            const modelId = selectedOption.getAttribute('data-id');
            
            trimSelect.innerHTML = '<option value="">Sélectionner d\'abord un modèle...</option>';
            
            const selectedBrandName = brandSelect.value;
            const brandObj = brandsRaw.find(b => b.name === selectedBrandName);
            const modelObj = brandObj?.models?.find(m => m.id === modelId || m.name === selectedModelName);
            
            if (modelObj && modelObj.trims) {
                trimSelect.innerHTML = '<option value="">Sélectionner la finition...</option>';
                modelObj.trims.forEach(trim => {
                    trimSelect.innerHTML += `<option value="${trim.name}" data-id="${trim.id}">${trim.name}</option>`;
                });
            } else if (modelObj) {
                trimSelect.innerHTML = '<option value="">Aucune finition disponible</option>';
            }
        });

        trimSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const trimId = selectedOption.getAttribute('data-id');
            const trimName = e.target.value;
            if (trimIdInput) trimIdInput.value = trimId || '';

            const infoBox = document.getElementById('trim-info-box');
            if (infoBox && trimId) {
                const brandName = brandSelect.value;
                const modelName = modelSelect.value;
                const brandObj = brandsRaw.find(b => b.name === brandName);
                const modelObj = brandObj?.models?.find(m => m.name === modelName);
                const trimObj = modelObj?.trims?.find(t => t.id === trimId);

                if (trimObj && trimObj.characteristics) {
                    const c = trimObj.characteristics;
                    infoBox.style.display = 'block';
                    infoBox.innerHTML = `
                        <div style="font-weight: 700; margin-bottom: 5px; color: var(--primary);"><i class="fas fa-info-circle"></i> Options de série (${trimName}) :</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                            <div>Moteur: <strong>${c.engine || 'N/A'}</strong></div>
                            <div>Boîte: <strong>${c.gearbox || 'N/A'}</strong></div>
                            <div>Turbo: <strong>${c.turbo || 'N/A'}</strong></div>
                            <div>Caméra: <strong>${c.camera || 'N/A'}</strong></div>
                            <div>Sièges élec.: <strong>${c.electricSeats || 'N/A'}</strong></div>
                            <div>Malle élec.: <strong>${c.electricTrunk || 'N/A'}</strong></div>
                            <div>Toit: <strong>${c.roof || 'N/A'}</strong></div>
                            <div>Roue secours: <strong>${c.spareWheel || 'N/A'}</strong></div>
                            <div>Keyless: <strong>${c.keyless || 'N/A'}</strong></div>
                            <div>Start & Stop: <strong>${c.startStop || 'N/A'}</strong></div>
                        </div>
                        ${c.remarks ? `<div style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 5px;">
                            <strong>Remarques :</strong> <span style="font-style: italic; opacity: 0.8;">${c.remarks}</span>
                        </div>` : ''}
                    `;
                } else {
                    infoBox.style.display = 'none';
                }
            } else if (infoBox) {
                infoBox.style.display = 'none';
            }
        });



        this.initClientSelectionTable();

        // Client search in Add Vehicle modal (for Sold CG)
        const soldClientSearch = document.getElementById('sold-client-search');
        const soldClientSelect = document.getElementById('sold-client-select');
        const soldRegistrationOwnerText = document.getElementById('sold-registration-owner-text');

        if (soldClientSearch && soldClientSelect) {
            const allClients = StorageService.get(STORAGE_KEYS.CLIENTS);
            soldClientSearch.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const filtered = allClients.filter(c => 
                    (c.lastName + ' ' + c.firstName).toLowerCase().includes(term) ||
                    (c.nin || '').toLowerCase().includes(term)
                );
                
                let opts = '<option value="">-- Sélectionner un client --</option>';
                opts += filtered.map(c => `<option value="${c.id}" data-name="${c.lastName} ${c.firstName} (NIN: ${c.nin || 'N/A'})">${c.lastName} ${c.firstName} | NIN: ${c.nin || 'N/A'}</option>`).join('');
                soldClientSelect.innerHTML = opts;
            });

            soldClientSelect.addEventListener('change', (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                const clientId = e.target.value;
                soldRegistrationOwnerText.value = selectedOption.value ? selectedOption.getAttribute('data-name') : '';
                
                // Populate orders for this client
                const orderContainer = document.getElementById('sold-order-selection-container');
                const orderSelect = document.getElementById('sold-order-select');
                if (orderContainer && orderSelect) {
                    if (clientId) {
                        const orders = StorageService.get(STORAGE_KEYS.ORDERS) || [];
                        const clientOrders = orders.filter(o => o.clientId === clientId && o.status !== 'ANNULÉE');
                        if (clientOrders.length > 0) {
                            orderContainer.style.display = 'block';
                            orderSelect.innerHTML = '<option value="">-- Pas de commande spécifique --</option>' + 
                                clientOrders.map(o => `<option value="${o.id}">${o.id} | ${o.vehicleName || 'N/A'} (${this.formatDate(o.date)})</option>`).join('');
                        } else {
                            orderContainer.style.display = 'none';
                        }
                    } else {
                        orderContainer.style.display = 'none';
                    }
                }
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
                trimId: formData.get('trimId'),
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
                videoLink: formData.get('videoLink'),
                blLink: formData.get('blLink'),
                category: formData.get('category'),
                purchaseOrderId: formData.get('purchaseOrderId') || (existingVehicle ? existingVehicle.purchaseOrderId : null),
                clientId: formData.get('clientId') || null,
                orderId: existingVehicle ? existingVehicle.orderId : null,
                shipmentId: existingVehicle ? existingVehicle.shipmentId : null,
                soldRegistration: formData.get('soldRegistration') === 'on' || formData.get('soldRegistration') === 'true',
                soldRegistrationOwner: formData.get('soldRegistrationOwner') || '',
                originalClientId: existingVehicle ? existingVehicle.originalClientId : null,
                originalOwnerName: existingVehicle ? existingVehicle.originalOwnerName : null,
                showroom: formData.get('showroom') || null,
                status: formData.get('clientId') ? 'Reserved' : (existingVehicle ? existingVehicle.status : 'Available')
            };

            // ALWAYS re-capture the original owner from DB state (before any CG logic changes things)
            // This runs every time soldRegistration is checked, using the UNMODIFIED existingVehicle data
            if (newVehicle.soldRegistration && existingVehicle) {
                // Only capture if not already locked (i.e., originalClientId already set from a previous CORRECT save)
                const alreadyHasCorrectOwner = existingVehicle.originalClientId &&
                    String(existingVehicle.originalClientId) !== String(existingVehicle.clientId);

                if (!alreadyHasCorrectOwner) {
                    let oldClient = null;
                    // Use the vehicle's ORIGINAL orderId (from DB, BEFORE CG logic changes it)
                    if (existingVehicle.orderId) {
                        const originalOrder = StorageService.get(STORAGE_KEYS.ORDERS).find(o => o.id === existingVehicle.orderId);
                        if (originalOrder) {
                            oldClient = StorageService.get(STORAGE_KEYS.CLIENTS).find(c => String(c.id) === String(originalOrder.clientId));
                        }
                    }
                    // Fallback: direct clientId in DB
                    if (!oldClient && existingVehicle.clientId) {
                        oldClient = StorageService.get(STORAGE_KEYS.CLIENTS).find(c => String(c.id) === String(existingVehicle.clientId));
                    }
                    if (oldClient) {
                        newVehicle.originalClientId = oldClient.id;
                        newVehicle.originalOwnerName = `${oldClient.lastName} ${oldClient.firstName}`.toUpperCase();
                    } else {
                        newVehicle.originalOwnerName = 'STOCK';
                    }
                }
            }

            // Linking Logic for Vendu CG
            const soldRegistrationOwnerId = formData.get('soldRegistrationOwnerId');
            const soldRegistrationOrderId = formData.get('soldRegistrationOrderId');
            
            if (newVehicle.soldRegistration) {
                if (soldRegistrationOwnerId) {
                    newVehicle.clientId = soldRegistrationOwnerId;
                }
                if (soldRegistrationOrderId) {
                    // NOTE: Do NOT overwrite orderId — the original orderId links to the ancien propriétaire
                    // Just link the CG order bidirectionally
                    newVehicle.status = 'Reserved';
                    const orders = StorageService.get(STORAGE_KEYS.ORDERS) || [];
                    const cgOrder = orders.find(o => o.id === soldRegistrationOrderId);
                    if (cgOrder && cgOrder.vehicleId !== newVehicle.id) {
                        cgOrder.vehicleId = newVehicle.id;
                        cgOrder.vehicleName = `${newVehicle.brand} ${newVehicle.model || ''} ${newVehicle.trim || ''} (${newVehicle.year})`.trim().replace(/\s+/g, ' ');
                        await StorageService.update(STORAGE_KEYS.ORDERS, cgOrder.id, cgOrder);
                    }
                }
            }

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
                                <form id="vehicle-form" style="display: flex; flex-direction: column; gap: 1.5rem">
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
                                                <select name="trim" id="edit-trim-select" class="glass-select">
                                                    <option value="">Sélectionner d'abord un modèle...</option>
                                                </select>
                                                <input type="hidden" name="trimId" id="edit-trim-id-input" value="${vehicle.trimId || ''}">
                                                <div id="edit-trim-info-box" style="margin-top: 10px; font-size: 0.8rem; background: rgba(var(--primary-rgb), 0.1); border-radius: 6px; padding: 10px; display: none; border: 1px solid rgba(var(--primary-rgb), 0.2);"></div>
                                            </div>
                                            <div class="form-group">
                                                <label>Lien Vidéo (Drive)</label>
                                                <input type="url" name="videoLink" value="${vehicle.videoLink || ''}" class="glass-input" placeholder="https://drive.google.com/...">
                                            </div>
                                            <div class="form-group">
                                                <label>Lien BL (Drive)</label>
                                                <input type="url" name="blLink" value="${vehicle.blLink || ''}" class="glass-input" placeholder="https://drive.google.com/...">
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
                                            <div class="form-group" style="grid-column: span 2;">
                                                <label>Showroom d'Affectation (Stock)</label>
                                                <select name="showroom" class="glass-select">
                                                    <option value="">(Non spécifié)</option>
                                                    ${(StorageService.get(STORAGE_KEYS.SHOWROOMS) || []).map(s => `<option value="${s}" ${vehicle.showroom === s ? 'selected' : ''}>${s}</option>`).join('')}
                                                </select>
                                            </div>
                                            <div class="form-group" style="grid-column: span 2;">
                                                <label>Affecter à un Client (Sélection par Tableau)</label>
                                                <div id="client-selection-table-container" class="glass" style="margin-top: 5px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
                                                    ${this.renderClientSelectionTable(vehicle.clientId)}
                                                </div>
                                                <input type="hidden" name="clientId" id="selected-client-id" value="${vehicle.clientId || ''}">
                                            </div>
                                        </div>
                                    </fieldset>

                                    <fieldset style="border: 1px solid rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px;">
                                        <legend style="padding: 0 0.5rem; color: var(--accent-blue); font-weight: 500;">Caractéristiques</legend>
                                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
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
                                            <label>Options du véhicule</label>
                                            <textarea name="options" class="glass-input" rows="3">${vehicle.options || ''}</textarea>
                                        </div>
                                        <div class="form-group">
                                            <label>Remarques Internes</label>
                                            <textarea name="remarks" class="glass-input" rows="3">${vehicle.remarks || ''}</textarea>
                                        </div>
                                    </div>

                                    <div class="form-group" style="display: flex; align-items: center; gap: 10px; margin-top: 10px; padding: 10px; background: rgba(var(--danger-rgb, 239, 68, 68), 0.1); border-radius: 8px; border: 1px solid rgba(var(--danger-rgb, 239, 68, 68), 0.2);">
                                        <input type="checkbox" name="soldRegistration" id="editSoldRegistration" style="width: 20px; height: 20px;" ${vehicle.soldRegistration ? 'checked' : ''} onchange="document.getElementById('edit-sold-owner-container').style.display = this.checked ? 'block' : 'none'">
                                        <label for="editSoldRegistration" style="color: var(--danger); font-weight: bold; margin: 0; cursor: pointer;">
                                            Vendu Carte Grise (Affiche 'VENDU C.G' au lieu du Showroom)
                                        </label>
                                    </div>

                                    <div id="edit-sold-owner-container" class="form-group" style="display: ${vehicle.soldRegistration ? 'block' : 'none'}; margin-top: 10px; background: rgba(var(--primary-rgb), 0.05); padding: 15px; border-radius: 8px; border: 1px solid rgba(var(--primary-rgb), 0.1);">
                                        <label style="color: var(--primary); font-weight: 600;"><i class="fas fa-user-check"></i> Propriétaire Actuel: ${vehicle.soldRegistrationOwner || 'N/A'}</label>
                                        <div style="position: relative; margin-bottom: 8px;">
                                            <i class="fas fa-search" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-dim); font-size: 0.8rem;"></i>
                                            <input type="text" id="edit-sold-client-search" class="glass-input" placeholder="Changer de propriétaire (Nom ou NIN)..." style="padding-left: 30px; font-size: 0.85rem;" autocomplete="off">
                                        </div>
                                        <select name="soldRegistrationOwnerId" id="edit-sold-client-select" class="glass-select">
                                            <option value="">-- Garder le propriétaire actuel --</option>
                                            ${StorageService.get(STORAGE_KEYS.CLIENTS).map(c => `<option value="${c.id}" data-name="${c.lastName} ${c.firstName} (NIN: ${c.nin || 'N/A'})">${c.lastName} ${c.firstName} | NIN: ${c.nin || 'N/A'}</option>`).join('')}
                                        </select>
                                        <div id="edit-sold-order-selection-container" style="margin-top: 10px; display: none;">
                                            <label style="color: var(--primary); font-size: 0.8rem; font-weight: 600;"><i class="fas fa-file-invoice"></i> Lier à une commande existante (Optionnel)</label>
                                            <select name="soldRegistrationOrderId" id="edit-sold-order-select" class="glass-select">
                                                <option value="">-- Pas de commande spécifique --</option>
                                            </select>
                                        </div>
                                        <input type="hidden" name="soldRegistrationOwner" id="edit-sold-registration-owner-text" value="${vehicle.soldRegistrationOwner || ''}">
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
        const trimSelect = document.getElementById('edit-trim-select');
        const trimIdInput = document.getElementById('edit-trim-id-input');
        const brandsRaw = StorageService.get(STORAGE_KEYS.BRANDS_RAW) || [];

        // Function to populate models based on brand
        const populateModels = (brandName, selectedModelName = null) => {
            modelSelect.innerHTML = '<option value="">Sélectionner le modèle...</option>';
            trimSelect.innerHTML = '<option value="">Sélectionner d\'abord un modèle...</option>';
            
            const brandObj = brandsRaw.find(b => b.name === brandName);
            if (brandObj && brandObj.models) {
                brandObj.models.forEach(model => {
                    const selected = model.name === selectedModelName ? 'selected' : '';
                    modelSelect.innerHTML += `<option value="${model.name}" data-id="${model.id}" ${selected}>${model.name}</option>`;
                });
            }
        };

        // Function to populate trims based on model
        const populateTrims = (brandName, modelName, selectedTrimName = null) => {
            trimSelect.innerHTML = '<option value="">Sélectionner la finition...</option>';
            
            const brandObj = brandsRaw.find(b => b.name === brandName);
            const modelObj = brandObj?.models?.find(m => m.name === modelName);
            
            if (modelObj && modelObj.trims) {
                modelObj.trims.forEach(trim => {
                    const selected = trim.name === selectedTrimName ? 'selected' : '';
                    trimSelect.innerHTML += `<option value="${trim.name}" data-id="${trim.id}" ${selected}>${trim.name}</option>`;
                    if (selected && trimIdInput) {
                        trimIdInput.value = trim.id;
                    }
                });
            } else if (modelObj) {
                trimSelect.innerHTML = '<option value="">Aucune finition disponible</option>';
            }
        };

        // Add change listener for brand
        brandSelect.addEventListener('change', (e) => {
            populateModels(e.target.value);
        });

        // Add change listener for model
        modelSelect.addEventListener('change', (e) => {
            populateTrims(brandSelect.value, e.target.value);
        });

        // Add change listener for trim
        trimSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const trimId = selectedOption.getAttribute('data-id');
            const trimName = e.target.value;
            if (trimIdInput) trimIdInput.value = trimId || '';

            const infoBox = document.getElementById('edit-trim-info-box');
            if (infoBox && trimId) {
                const brandName = brandSelect.value;
                const modelName = modelSelect.value;
                const brandObj = brandsRaw.find(b => b.name === brandName);
                const modelObj = brandObj?.models?.find(m => m.name === modelName);
                const trimObj = modelObj?.trims?.find(t => t.id === trimId);

                if (trimObj && trimObj.characteristics) {
                    const c = trimObj.characteristics;
                    infoBox.style.display = 'block';
                    infoBox.innerHTML = `
                        <div style="font-weight: 700; margin-bottom: 5px; color: var(--primary);"><i class="fas fa-info-circle"></i> Options de série (${trimName}) :</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                            <div>Moteur: <strong>${c.engine || 'N/A'}</strong></div>
                            <div>Boîte: <strong>${c.gearbox || 'N/A'}</strong></div>
                            <div>Turbo: <strong>${c.turbo || 'N/A'}</strong></div>
                            <div>Caméra: <strong>${c.camera || 'N/A'}</strong></div>
                            <div>Sièges élec.: <strong>${c.electricSeats || 'N/A'}</strong></div>
                            <div>Malle élec.: <strong>${c.electricTrunk || 'N/A'}</strong></div>
                            <div>Toit: <strong>${c.roof || 'N/A'}</strong></div>
                            <div>Roue secours: <strong>${c.spareWheel || 'N/A'}</strong></div>
                            <div>Keyless: <strong>${c.keyless || 'N/A'}</strong></div>
                            <div>Start & Stop: <strong>${c.startStop || 'N/A'}</strong></div>
                        </div>
                        ${c.remarks ? `<div style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 5px;">
                            <strong>Remarques :</strong> <span style="font-style: italic; opacity: 0.8;">${c.remarks}</span>
                        </div>` : ''}
                    `;
                } else {
                    infoBox.style.display = 'none';
                }
            } else if (infoBox) {
                infoBox.style.display = 'none';
            }
        });

        // Initial population with existing vehicle data
        populateModels(vehicle.brand, vehicle.model);
        if (vehicle.model) {
            populateTrims(vehicle.brand, vehicle.model, vehicle.trim);
            if (vehicle.trim) {
                const event = new Event('change');
                trimSelect.dispatchEvent(event);
            }
        }

        this.initClientSelectionTable();

        // Client search in Edit Vehicle modal
        const editSoldClientSearch = document.getElementById('edit-sold-client-search');
        const editSoldClientSelect = document.getElementById('edit-sold-client-select');
        const editSoldRegistrationOwnerText = document.getElementById('edit-sold-registration-owner-text');

        if (editSoldClientSearch && editSoldClientSelect) {
            const allClients = StorageService.get(STORAGE_KEYS.CLIENTS);
            editSoldClientSearch.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const filtered = allClients.filter(c => 
                    (c.lastName + ' ' + c.firstName).toLowerCase().includes(term) ||
                    (c.nin || '').toLowerCase().includes(term)
                );
                
                let opts = '<option value="">-- Sélectionner un client --</option>';
                opts += filtered.map(c => `<option value="${c.id}" data-name="${c.lastName} ${c.firstName} (NIN: ${c.nin || 'N/A'})">${c.lastName} ${c.firstName} | NIN: ${c.nin || 'N/A'}</option>`).join('');
                editSoldClientSelect.innerHTML = opts;
            });

            editSoldClientSelect.addEventListener('change', (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                const clientId = e.target.value;
                if (editSoldRegistrationOwnerText) {
                    // Always update (clear if deselected, set if selected)
                    editSoldRegistrationOwnerText.value = selectedOption.value
                        ? selectedOption.getAttribute('data-name')
                        : '';
                }
                
                // Populate orders for this client
                const orderContainer = document.getElementById('edit-sold-order-selection-container');
                const orderSelect = document.getElementById('edit-sold-order-select');
                if (orderContainer && orderSelect) {
                    if (clientId) {
                        const orders = StorageService.get(STORAGE_KEYS.ORDERS) || [];
                        const clientOrders = orders.filter(o => o.clientId === clientId && o.status !== 'ANNULÉE');
                        if (clientOrders.length > 0) {
                            orderContainer.style.display = 'block';
                            orderSelect.innerHTML = '<option value="">-- Pas de commande spécifique --</option>' + 
                                clientOrders.map(o => `<option value="${o.id}">${o.id} | ${o.vehicleName || 'N/A'} (${this.formatDate(o.date)})</option>`).join('');
                        } else {
                            orderContainer.style.display = 'none';
                        }
                    } else {
                        orderContainer.style.display = 'none';
                    }
                }
            });
        }

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
                                        <td><span class="status-badge ${((typeof u.role === 'object' && u.role !== null) ? u.role.id : u.role)}">${roles.find(r => r.id === ((typeof u.role === 'object' && u.role !== null) ? u.role.id : u.role))?.name || u.role}</span></td>
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
                                            ${roles.map(r => `<option value="${r.id}" ${r.name.toUpperCase() === 'COMMERCIAL' ? 'selected' : ''}>${r.name}</option>`).join('')}
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
                                                ${roles.map(r => {
                                                    const userRoleId = (typeof user.role === 'object' && user.role !== null) ? user.role.id : user.role;
                                                    return `<option value="${r.id}" ${userRoleId === r.id ? 'selected' : ''}>${r.name}</option>`;
                                                }).join('')}
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

    isAdmin() {
        const currentUser = StorageService.get(STORAGE_KEYS.CURRENT_USER);
        if (!currentUser) return false;

        // 1. Check by Role ID (Common defaults)
        const adminIds = ['admin', 'ADMIN', 'superadmin', 'SUPERADMIN', 'root'];
        if (adminIds.includes(currentUser.role)) return true;

        // 2. Check by Role Name and Permissions
        const roles = StorageService.get(STORAGE_KEYS.ROLES) || [];
        const userRole = roles.find(r => String(r.id) === String(currentUser.role));

        if (userRole) {
            const name = (userRole.name || '').toUpperCase();
            const adminKeywords = ['ADMIN', 'GÉRANT', 'DIRECTEUR', 'PROPRIÉTAIRE', 'BOSS', 'SUPER'];
            
            // If name contains any admin keyword
            if (adminKeywords.some(key => name.includes(key))) return true;
            
            // If permissions include 'all'
            if (userRole.permissions && (userRole.permissions.includes('all') || userRole.permissions.includes('view_all'))) {
                return true;
            }
        }

        return false;
    },

    canAccess(view) {
        const currentUser = StorageService.get(STORAGE_KEYS.CURRENT_USER);
        if (!currentUser) return false;

        // Admin always has full access
        if (this.isAdmin()) return true;

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

        // Specific check for audit log visibility
        const auditLink = document.querySelector('[data-view="audit"]');
        if (auditLink) {
            auditLink.style.display = (this.isAdmin()) ? 'flex' : 'none';
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
                            ${s.eta ? `<span style="padding: 4px 10px; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 12px; font-size: 0.75rem; color: var(--success);"><i class="fas fa-calendar-check" style="margin-right: 4px;"></i>ETA: ${this.formatDate(s.eta)}</span>` : ''}
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
            'Achats (Fournisseurs)': [
                { id: 'purchases', label: 'Accès Vue' },
                { id: 'purchases.create', label: 'Créer' },
                { id: 'purchases.edit', label: 'Modifier' },
                { id: 'purchases.delete', label: 'Supprimer' },
                { id: 'purchases.manage_tasks', label: 'Gérer les tâches' }
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
                                    <td>${this.formatDate(r.date)}</td>
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
                                                ${s.arrivalDate ? `<div style="font-size: 0.75rem; margin-top: 4px; color: var(--success); font-weight: 700;"><i class="fas fa-check-double" style="margin-right: 4px;"></i>Arrivée: ${this.formatDate(s.arrivalDate)}</div>` : (s.eta ? `<div style="font-size: 0.75rem; margin-top: 4px; color: ${this.formatDate(s.eta) < new Date() ? 'var(--danger)' : 'var(--success)'}; font-weight: 600;"><i class="fas fa-calendar-check" style="margin-right: 4px;"></i>ETA: ${new Date(s.eta)}</div>` : '')}
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
                                    <div style="font-size: 0.85rem;"><strong>ETD:</strong> ${s.etd ? this.formatDate(s.etd) : '-'}</div>
                                    <div style="font-size: 0.85rem;"><strong>ETA:</strong> ${s.eta ? this.formatDate(s.eta) : '-'}</div>
                                    <div style="font-size: 0.85rem; color: var(--success);"><strong>Arr:</strong> ${s.arrivalDate ? this.formatDate(s.arrivalDate) : '-'}</div>
                                </td>
                                <td>
                                    <div style="font-size: 0.85rem;"><strong>BL:</strong> ${s.blNumber || '-'}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-dim);">Docs: ${s.docReceptionDate ? this.formatDate(s.docReceptionDate) : 'Non reçus'}</div>
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
                                                <i class="far fa-calendar-alt"></i> ETD: ${v.etd ? this.formatDate(v.etd) : '-'}
                                            </div>
                                            ${v.arrivalDate ? `
                                            <div style="font-size: 0.8rem; color: var(--success); font-weight: 700;">
                                                <i class="fas fa-check-double"></i> Arrivée: ${this.formatDate(v.arrivalDate)}
                                            </div>` : `
                                            <div style="font-size: 0.8rem; color: var(--success);">
                                                <i class="far fa-calendar-check"></i> ETA: ${v.eta ? this.formatDate(v.eta) : '-'}
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
                    escape(this.formatDate(o.date)),
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
                    this.formatDate(order.date),
                    (order.clientName || '').toUpperCase(),
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
            const colors = [...new Set(pendingOrders.map(o => this.translateColorToEnglish(o.requestedColor) || 'Non spécifié'))].sort();
            // Ensure 'Non spécifié' is last
            const nsIndex = colors.indexOf('Non spécifié');
            if (nsIndex > -1) {
                colors.push(colors.splice(nsIndex, 1)[0]);
            }

            // 3. Aggregate Data [Brand - Model] -> { Color: Count }
            const matrix = {};

            pendingOrders.forEach(o => {
                const key = `${o.requestedBrand} - ${o.requestedModel}`;
                const color = this.translateColorToEnglish(o.requestedColor) || 'Non spécifié';

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
                                    <td>${this.formatDate(t.date)}</td>
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
            this.formatDate(t.date),
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
                                                <input type="date" name="date" value="${preSelectedOrder && preSelectedOrder.date ? new Date(preSelectedOrder.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}" required class="glass-input">
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
                        message: `Le navire est attendu le ${this.formatDate(arrival)} (dans moins de 10 jours).`,
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
                                ${this.formatDate(alert.date)}
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

            const canCreate = this.canAccess('purchases.create');
            const canEdit = this.canAccess('purchases.edit');
            const canDelete = this.canAccess('purchases.delete');
            const canManageTasks = this.canAccess('purchases.manage_tasks');

            if (query) {
                const q = query.toLowerCase();
                purchases = purchases.filter(p =>
                    (p.supplierName && p.supplierName.toLowerCase().includes(q)) ||
                    (p.id && String(p.id).toLowerCase().includes(q))
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
                            ${canCreate ? `
                            <button class="btn-primary" onclick="app.showPurchaseOrderModal()">
                                <i class="fas fa-plus"></i> Nouveau Achat
                            </button>
                            ` : ''}
                        </div>
                    </div>

                    <div class="glass" style="padding: 20px; margin-bottom: 20px;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; align-items: end;">
                            <div class="form-group" style="margin-bottom: 0;">
                                <label style="font-size: 0.8rem; color: var(--text-dim); font-weight: 600; text-transform: uppercase; margin-bottom: 5px; display: block;">
                                    <i class="fas fa-search"></i> Recherche Rapide
                                </label>
                                <input type="text" class="glass-input" style="padding: 10px 12px; font-size: 0.9rem;" placeholder="ID ou Fournisseur..." value="${query || ''}" oninput="app.renderPurchases(this.value)">
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label style="font-size: 0.8rem; color: var(--text-dim); font-weight: 600; text-transform: uppercase; margin-bottom: 5px; display: block;">
                                    <i class="fas fa-truck"></i> Fournisseur
                                </label>
                                <select class="glass-select" style="padding: 10px 12px; font-size: 0.9rem;" onchange="app.purchaseFilters = {...(app.purchaseFilters || {}), supplier: this.value}; app.renderPurchases()">
                                    <option value="">Tous les fournisseurs</option>
                                    ${(StorageService.get(STORAGE_KEYS.SUPPLIERS) || []).map(s => `<option value="${s.name}" ${this.purchaseFilters?.supplier === s.name ? 'selected' : ''}>${s.name}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label style="font-size: 0.8rem; color: var(--text-dim); font-weight: 600; text-transform: uppercase; margin-bottom: 5px; display: block;">
                                    <i class="fas fa-info-circle"></i> Statut Achat
                                </label>
                                <select class="glass-select" style="padding: 10px 12px; font-size: 0.9rem;" onchange="app.purchaseFilters = {...(app.purchaseFilters || {}), status: this.value}; app.renderPurchases()">
                                    <option value="">Tous les statuts</option>
                                    <option value="Ordered" ${this.purchaseFilters?.status === 'Ordered' ? 'selected' : ''}>Commandé</option>
                                    <option value="Paid" ${this.purchaseFilters?.status === 'Paid' ? 'selected' : ''}>Payé</option>
                                    <option value="Partial" ${this.purchaseFilters?.status === 'Partial' ? 'selected' : ''}>Partiel</option>
                                </select>
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label style="font-size: 0.8rem; color: var(--text-dim); font-weight: 600; text-transform: uppercase; margin-bottom: 5px; display: block;">
                                    <i class="fas fa-calendar-alt"></i> Période
                                </label>
                                <div style="display: flex; gap: 8px;">
                                    <input type="date" class="glass-input" style="padding: 10px 12px; font-size: 0.9rem; flex: 1;" value="${this.purchaseFilters?.startDate || ''}" onchange="app.purchaseFilters = {...(app.purchaseFilters || {}), startDate: this.value}; app.renderPurchases()" title="Date début">
                                    <input type="date" class="glass-input" style="padding: 10px 12px; font-size: 0.9rem; flex: 1;" value="${this.purchaseFilters?.endDate || ''}" onchange="app.purchaseFilters = {...(app.purchaseFilters || {}), endDate: this.value}; app.renderPurchases()" title="Date fin">
                                </div>
                            </div>
                            <div class="form-group" style="margin-bottom: 0; display: flex; gap: 10px;">
                                <button class="btn-secondary" style="padding: 10px; height: 42px; width: 42px; min-width: 42px;" onclick="app.purchaseFilters = null; app.renderPurchases()" title="Réinitialiser les filtres">
                                    <i class="fas fa-sync-alt"></i>
                                </button>
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
                                    • <strong>${clientName}</strong> : ${v.brand} ${v.model || ''} ${v.trim ? `[${v.trim}]` : ''} 
                                    ${(() => {
                                        const amend = this.getAmendmentStatus(v.id);
                                        return amend ? `<span class="badge-pill" style="font-size: 0.6rem; background: ${amend.color}22; color: ${amend.color}; padding: 1px 4px; border: 1px solid ${amend.color}33;" title="${amend.label}">AMEND.</span>` : '';
                                    })()}
                                    <span style="color:var(--text-dim);">(${v.chassisNumber || 'Sans VIN'})</span>
                                    </div>`;
                                }).join('')}
                                                </div>`
                            : '-'}
                                        </td>
                                        <td>${p.purchaseDate ? this.formatDate(p.purchaseDate) : 'N/A'}</td>
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
                                                ${canEdit ? `<button class="btn-icon" onclick="app.showPurchaseOrderModal('${p.id}')" title="Modifier"><i class="fas fa-edit"></i></button>` : ''}
                                                ${canDelete ? `<button class="btn-icon variant-danger" onclick="app.deletePurchaseOrder('${p.id}')" title="Supprimer"><i class="fas fa-trash"></i></button>` : ''}
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

        let allTransfers = [];
        try {
            const trRes = await ApiService.getAllTransfers();
            if (trRes && trRes.success) allTransfers = trRes.data || [];
        } catch (e) {
            console.warn("Failed to fetch transfers for PO details:", e);
        }

        const modalHtml = `
                    <div id="modal-overlay" class="modal-overlay">
                        <div class="modal-content glass" style="width: 1000px; max-width: 95vw; max-height: 90vh; overflow-y: auto;">
                            <div class="modal-header">
                                <div>
                                    <h2>Détails Commande d'Achat #${p.id}</h2>
                                    <p style="color: var(--text-dim); font-size: 0.9rem; margin: 0;">Fournisseur: ${p.supplierName} | Date: ${p.purchaseDate ? this.formatDate(p.purchaseDate) : 'N/A'}</p>
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
                                                <th>#</th>
                                                <th>Marque / Modèle</th>
                                                <th>Identification</th>
                                                <th>Finition</th>
                                                <th>Client Affecté</th>
                                                <th>Amendement</th>
                                                <th>Statut Livraison Client</th>
                                                <th>Détails</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${(p.vehicles || []).map((v, index) => {
            const order = v.orderId ? StorageService.get(STORAGE_KEYS.ORDERS).find(o => o.id === v.orderId) : null;
            
            // For Vendu CG vehicles: displayClient = NEW owner (via clientId/orderId after transfer)
            let displayClient = order
                ? StorageService.get(STORAGE_KEYS.CLIENTS).find(c => c.id === order.clientId)
                : (v.clientId ? StorageService.get(STORAGE_KEYS.CLIENTS).find(c => c.id === v.clientId) : null);

            // For Vendu CG: resolve ORIGINAL owner separately (before the CG transfer)
            let ancienClient = null;
            if (v.soldRegistration) {
                // Step 1: try stored originalClientId
                if (v.originalClientId) {
                    const candidate = StorageService.get(STORAGE_KEYS.CLIENTS).find(c => String(c.id) === String(v.originalClientId));
                    // Only use if it's a DIFFERENT person from the new CG owner
                    if (candidate && String(candidate.id) !== String(v.clientId)) {
                        ancienClient = candidate;
                    }
                }
                // Step 2: if not found or same as new owner, try the vehicle's orderId → original order client
                if (!ancienClient && v.orderId) {
                    const originalOrder = StorageService.get(STORAGE_KEYS.ORDERS).find(o => o.id === v.orderId);
                    if (originalOrder && String(originalOrder.clientId) !== String(v.clientId)) {
                        ancienClient = StorageService.get(STORAGE_KEYS.CLIENTS).find(c => String(c.id) === String(originalOrder.clientId));
                    }
                }
                // Step 3: scan ALL orders that still point to this vehicle but belong to a different client
                // This recovers the original buyer when orderId was overwritten by the CG save
                if (!ancienClient) {
                    const allOrders = StorageService.get(STORAGE_KEYS.ORDERS) || [];
                    const originalOrderByVehicle = allOrders.find(o =>
                        String(o.vehicleId) === String(v.id) &&
                        String(o.clientId) !== String(v.clientId)
                    );
                    if (originalOrderByVehicle) {
                        ancienClient = StorageService.get(STORAGE_KEYS.CLIENTS).find(c => String(c.id) === String(originalOrderByVehicle.clientId));
                    }
                }
            }

            let isAmendmentRevertedDisplay = false;
            let amendmentHtml = '';

            // Handle Amendment Display Logic
            const transfers = StorageService.get(STORAGE_KEYS.TRANSFERS) || [];
            const vTransfers = transfers.filter(t => String(t.vehicleId) === String(v.id));
            if (vTransfers.length > 0) {
                // Find latest transfer that requested an amendment (withBL)
                const latestTransfer = vTransfers.find(t => !!t.withBL) || vTransfers[0];
                
                const hasAmendment = !!latestTransfer.withBL;
                const amendmentRequested = !!latestTransfer.amendmentRequestSent;
                const oldClientObj = latestTransfer.fromClient || 
                    StorageService.get(STORAGE_KEYS.CLIENTS).find(c => c.id === latestTransfer.fromClientId);

                let oldClientText = '';
                if (oldClientObj) {
                    oldClientText = `<br><span style="color: red; font-size: 0.7rem; font-weight: bold;">Ancien: ${oldClientObj.lastName} ${oldClientObj.firstName}</span>`;
                } else if (latestTransfer.fromClientId) {
                    oldClientText = `<br><span style="color: red; font-size: 0.7rem; font-weight: bold;">Ancien ID: ${latestTransfer.fromClientId}</span>`;
                }

                if (hasAmendment) {
                    if (amendmentRequested) {
                        amendmentHtml = `<span style="color: var(--primary); font-weight: bold;">OUI (Envoyé)</span>${oldClientText}`;
                    } else {
                        amendmentHtml = `<span style="color: var(--warning); font-weight: bold;">OUI (À demander)</span>${oldClientText}`;
                    }
                } else {
                    amendmentHtml = `<span style="color: var(--text-dim); font-weight: bold;">NON</span>`;
                }

                if (latestTransfer.withBL && !latestTransfer.newBLReceived) {
                    isAmendmentRevertedDisplay = true;
                }

            } else {
                amendmentHtml = `<span style="color: var(--text-dim); font-weight: bold;">NON</span>`;
            }

            const orderStatus = order ? this.calculateOrderStatus(order) : 'N/A';

            let showroomText = '-';
            if (v.soldRegistration) {
                showroomText = 'VENDU C.G';
            } else if (displayClient) {
                let rawShowroom = displayClient.showroom || '-';
                showroomText = String(rawShowroom).toUpperCase() === 'TOUGGOURT' ? 'TOUG' : rawShowroom;
            }

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
                                                    <td style="text-align: center; font-weight: bold; color: var(--primary);">${index + 1}</td>
                                                    <td>
                                                        <div style="font-weight: 600;">${v.brand} ${v.model || ''}</div>
                                                        <div style="font-size: 0.8rem; color: var(--text-dim);">${v.year || '-'} | ${v.color || '-'}</div>
                                                        ${(() => {
                                                            const currentYear = new Date().getFullYear();
                                                            const vYear = parseInt(v.year);
                                                            if (!vYear || vYear >= currentYear) {
                                                                return '<div style="font-size: 0.75rem; font-weight: 800; color: #10b981; margin-top: 2px;">VEHICULE NEUF</div>';
                                                            } else if (vYear >= currentYear - 3) {
                                                                return '<div style="font-size: 0.75rem; font-weight: 800; color: #e67e22; margin-top: 2px;">MOINS DE TROIS ANS</div>';
                                                            } else {
                                                                return '<div style="font-size: 0.75rem; font-weight: 800; color: var(--text-dim); margin-top: 2px;">OCCASION</div>';
                                                            }
                                                        })()}
                                                    </td>
                                                    <td>
                                                        <div style="font-size: 0.85rem;"><strong>VIN:</strong> <code style="font-family: monospace;">${v.chassisNumber || 'N/A'}</code></div>
                                                        <div style="font-size: 0.85rem;"><strong>ID:</strong> #${v.id}</div>
                                                    </td>
                                                    <td>
                                                        <div style="font-size: 0.85rem;">${v.trim || '-'}</div>
                                                    </td>
                                                    <td>
                                                        ${v.soldRegistration ? `
                                                            <div style="margin-bottom: 5px;">
                                                                <span style="font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; font-weight: bold;">Ancien Propriétaire:</span>
                                                                <div style="font-weight: 600; color: var(--warning); text-decoration: line-through;">${
                                                                    ancienClient 
                                                                        ? (ancienClient.lastName + ' ' + ancienClient.firstName).toUpperCase()
                                                                        : (v.originalOwnerName || 'INCONNU').toUpperCase()
                                                                }</div>
                                                                <span class="status-badge danger" style="font-size: 0.6rem; padding: 1px 4px;">VENDU C.G</span>
                                                            </div>
                                                            <div>
                                                                <span style="font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; font-weight: bold;">Nouveau Propriétaire:</span>
                                                                <div style="font-weight: 600; color: var(--success);">${(v.soldRegistrationOwner || (displayClient ? (displayClient.lastName + ' ' + displayClient.firstName) : 'NON SPÉCIFIÉ')).toUpperCase()}</div>
                                                                ${order ? `<div style="font-size: 0.75rem; color: var(--primary);">CMD #${order.id}</div>` : ''}
                                                            </div>
                                                        ` : (displayClient ? `
                                                            <div style="font-weight: 600; color: ${isAmendmentRevertedDisplay ? 'var(--warning)' : 'inherit'};">${(displayClient.lastName + ' ' + displayClient.firstName).toUpperCase()}</div>
                                                            <div style="font-size: 0.8rem; font-weight: bold; color: var(--info); padding: 2px 0;">
                                                                <i class="fas fa-store"></i> ${showroomText}
                                                            </div>
                                                            ${order ? `<div style="font-size: 0.8rem; color: var(--primary);">CMD #${order.id}</div>` : '<div style="font-size: 0.8rem; color: var(--success);">RÉSERVÉ</div>'}
                                                            ${isAmendmentRevertedDisplay ? '<div style="font-size: 0.75rem; color: var(--warning);"><i class="fas fa-exclamation-triangle"></i> Sans chang. BL</div>' : ''}
                                                        ` : '<span style="color: var(--text-dim);">STOCK</span>')}
                                                    </td>
                                                    <td style="text-align: center;">
                                                        ${amendmentHtml}
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
                                            ${(p.vehicles || []).length === 0 ? '<tr><td colspan="8" style="text-align: center; padding: 20px;">Aucun véhicule lié</td></tr>' : ''}
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
                                            <strong style="font-size: 0.9rem;">${p.loadingDate ? this.formatDate(p.loadingDate) : 'N/A'}</strong>
                                        </div>
                                        <div>
                                            <p style="margin: 0; color: var(--text-dim); font-size: 0.8rem;">ETD (Départ)</p>
                                            <strong style="font-size: 0.9rem;">${p.etd ? this.formatDate(p.etd) : 'N/A'}</strong>
                                        </div>
                                        <div>
                                            <p style="margin: 0; color: var(--text-dim); font-size: 0.8rem;">ETA (Arrivée)</p>
                                            <strong style="font-size: 0.9rem; color: var(--success);">${p.eta ? this.formatDate(p.eta) : 'N/A'}</strong>
                                        </div>
                                        <div>
                                            <p style="margin: 0; color: var(--text-dim); font-size: 0.8rem;">Transitaire (Forwarder)</p>
                                            <strong style="font-size: 0.9rem;">${p.forwarder || 'N/A'}</strong>
                                        </div>
                                        <div>
                                            <p style="margin: 0; color: var(--text-dim); font-size: 0.8rem;">Compagnie Maritime</p>
                                            <strong style="font-size: 0.9rem;">${p.carrier || 'N/A'}</strong>
                                        </div>
                                        <div>
                                            <p style="margin: 0; color: var(--text-dim); font-size: 0.8rem;">Dégroupeur</p>
                                            <strong style="font-size: 0.9rem;">${p.unbundler || 'N/A'}</strong>
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
        this.closeModal();
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
                                    <th>Finition</th>
                                    <th>VIN Châssis</th>
                                    <th>Couleur/Cat.</th>
                                    <th>Kilo.</th>
                                    <th>Prix Achat</th>
                                    <th>Vidéo</th>
                                    <th>BL</th>
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
                                            <div style="font-size: 0.75rem; color: var(--text-dim);">${o.requestedTrim || ''}</div>
                                            <input type="hidden" class="brand-input" value="${o.requestedBrand || ''}">
                                            <input type="hidden" class="model-input" value="${o.requestedModel || ''}">
                                            <input type="hidden" class="trim-input" value="${o.requestedTrim || ''}">
                                        </td>
                                        <td>
                                            <select class="glass-select trim-input" style="width: 100px; padding: 4px; font-size: 0.8rem;">
                                                <option value="">Finition</option>
                                                ${(() => {
                                                    const brandsRaw = StorageService.get(STORAGE_KEYS.BRANDS_RAW) || [];
                                                    const b = brandsRaw.find(br => br.name === o.requestedBrand);
                                                    const m = b?.models?.find(md => md.name === o.requestedModel);
                                                    return m?.trims?.map(t => `<option value="${t.name}" ${o.requestedTrim === t.name ? 'selected' : ''}>${t.name}</option>`).join('') || (o.requestedTrim ? `<option value="${o.requestedTrim}" selected>${o.requestedTrim}</option>` : '');
                                                })()}
                                            </select>
                                        </td>
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
                                            <select class="glass-select currency-select" style="padding: 2px; font-size: 0.8rem; margin-top: 2px; width: 90px;">
                                                ${(StorageService.get(STORAGE_KEYS.CURRENCIES) || ['EUR', 'USD', 'DZD']).map(c => `<option value="${c}" ${c === 'EUR' ? 'selected' : ''}>${c}</option>`).join('')}
                                            </select>
                                        </td>
                                        <td><input type="url" class="glass-input video-link-input" placeholder="Lien Vidéo" style="width: 100px; padding: 4px; font-size: 0.8rem;"></td>
                                        <td><input type="url" class="glass-input bl-link-input" placeholder="Lien BL" style="width: 100px; padding: 4px; font-size: 0.8rem;"></td>
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
                                            <select class="glass-select model-input" style="width: 100px; padding: 4px; font-size: 0.8rem;" onchange="app.updatePOVehicleTrim(this)">
                                                <option value="">Modèle</option>
                                                ${(brandModels[v.brand] || []).map(m => `<option value="${m}" ${v.model === m ? 'selected' : ''}>${m}</option>`).join('')}
                                            </select>
                                        </td>
                                        <td>
                                            <select class="glass-select trim-input" style="width: 100px; padding: 4px; font-size: 0.8rem;">
                                                <option value="">Finition</option>
                                                ${(() => {
                                                    const brandsRaw = StorageService.get(STORAGE_KEYS.BRANDS_RAW) || [];
                                                    const b = brandsRaw.find(br => br.name === v.brand);
                                                    const m = b?.models?.find(md => md.name === v.model);
                                                    return m?.trims?.map(t => `<option value="${t.name}" ${v.trim === t.name ? 'selected' : ''}>${t.name}</option>`).join('') || (v.trim ? `<option value="${v.trim}" selected>${v.trim}</option>` : '');
                                                })()}
                                            </select>
                                        </td>
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
                                            <select class="glass-select currency-select" style="padding: 2px; font-size: 0.8rem; margin-top: 2px; width: 90px;">
                                                ${(StorageService.get(STORAGE_KEYS.CURRENCIES) || ['EUR', 'USD', 'DZD']).map(c => `<option value="${c}" ${v.purchaseCurrency === c ? 'selected' : ''}>${c}</option>`).join('')}
                                            </select>
                                        </td>
                                        <td><input type="url" class="glass-input video-link-input" value="${v.videoLink || ''}" placeholder="Lien Vidéo" style="width: 100px; padding: 4px; font-size: 0.8rem;"></td>
                                        <td><input type="url" class="glass-input bl-link-input" value="${v.blLink || ''}" placeholder="Lien BL" style="width: 100px; padding: 4px; font-size: 0.8rem;"></td>
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
                                <div class="form-group">
                                    <label>Transitaire (Forwarder)</label>
                                    <input type="text" name="forwarder" value="${po && po.forwarder ? po.forwarder : ''}" class="glass-input" placeholder="Transitaire">
                                </div>
                                <div class="form-group">
                                    <label>Compagnie Maritime (Carrier)</label>
                                    <input type="text" name="carrier" value="${po && po.carrier ? po.carrier : ''}" class="glass-input" placeholder="CMA, MSC, Maersk...">
                                </div>
                                <div class="form-group">
                                    <label>Dégroupeur</label>
                                    <input type="text" name="unbundler" value="${po && po.unbundler ? po.unbundler : ''}" class="glass-input" placeholder="Dégroupeur">
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
            
            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (submitBtn.disabled) return;
            
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traitement...';

            try {
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
                forwarder: formData.get('forwarder'),
                carrier: formData.get('carrier'),
                unbundler: formData.get('unbundler'),
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
                            trim: tr.querySelector('.trim-input').value,
                            chassisNumber: tr.querySelector('.vin-input').value,
                            color: tr.querySelector('.color-select').value,
                            category: tr.querySelector('.category-select').value,
                            mileage: parseInt(tr.querySelector('.mileage-input').value) || 0,
                            purchasePrice: parseFloat(tr.querySelector('.price-input').value) || 0,
                            purchaseCurrency: tr.querySelector('.currency-select').value || 'EUR',
                            videoLink: tr.querySelector('.video-link-input').value,
                            blLink: tr.querySelector('.bl-link-input').value
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
                        trim: tr.querySelector('.trim-input').value,
                        chassisNumber: tr.querySelector('.vin-input').value,
                        color: tr.querySelector('.color-select').value,
                        category: tr.querySelector('.category-select').value,
                        mileage: parseInt(tr.querySelector('.mileage-input').value) || 0,
                        purchasePrice: parseFloat(tr.querySelector('.price-input').value) || 0,
                        purchaseCurrency: tr.querySelector('.currency-select').value || 'EUR',
                        videoLink: tr.querySelector('.video-link-input').value,
                        blLink: tr.querySelector('.bl-link-input').value
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
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
            }
        });
    },

    updatePOVehicleModel(brandSelect) {
        const row = brandSelect.closest('tr');
        const modelSelect = row.querySelector('.model-input');
        const trimSelect = row.querySelector('.trim-input');
        const brand = brandSelect.value;
        const brandModels = StorageService.get(STORAGE_KEYS.BRAND_MODELS) || {};
        const models = brandModels[brand] || [];

        modelSelect.innerHTML = '<option value="">Modèle</option>' +
            models.map(m => `<option value="${m}">${m}</option>`).join('');

        if (trimSelect) {
            trimSelect.innerHTML = '<option value="">Finition</option>';
        }
    },

    updatePOVehicleTrim(modelSelect) {
        const row = modelSelect.closest('tr');
        const brandSelect = row.querySelector('.brand-input');
        const trimSelect = row.querySelector('.trim-input');
        const brand = brandSelect?.value || row.querySelector('.brand-input')?.textContent || '';
        const model = modelSelect.value;

        if (!trimSelect) return;
        trimSelect.innerHTML = '<option value="">Finition</option>';

        if (brand && model) {
            const brandsRaw = StorageService.get(STORAGE_KEYS.BRANDS_RAW) || [];
            const bObj = brandsRaw.find(b => b.name === brand);
            const mObj = bObj?.models?.find(m => m.name === model);
            if (mObj?.trims) {
                mObj.trims.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.name;
                    opt.textContent = t.name;
                    trimSelect.appendChild(opt);
                });
            }
        }
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
                <select class="glass-select model-input" style="width: 100px; padding: 4px; font-size: 0.8rem;" onchange="app.updatePOVehicleTrim(this)">
                    <option value="">Modèle</option>
                </select>
            </td>
            <td>
                <select class="glass-select trim-input" style="width: 100px; padding: 4px; font-size: 0.8rem;">
                    <option value="">Finition</option>
                </select>
            </td>
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
            <td><input type="url" class="glass-input video-link-input" placeholder="Lien Vidéo" style="width: 100px; padding: 4px; font-size: 0.8rem;"></td>
            <td><input type="url" class="glass-input bl-link-input" placeholder="Lien BL" style="width: 100px; padding: 4px; font-size: 0.8rem;"></td>
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
                                                ${this.formatDate(event.date)} ${new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                                                ${this.formatDate(event.date)} ${new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
            "N°", "ID Achat", "Showroom", "N° Vente", "Nom Client", "Passport", "NIN",
            "Marque", "Modèle", "Couleur", "VIN",
            "Adresse", "C.P."
        ].map(c => c.toUpperCase());

        const rows = [];
        let rowNum = 1;
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

                const rawShowroom = client ? (client.showroom || "-") : "-";
                const displayShowroom = String(rawShowroom).toUpperCase() === 'TOUGGOURT' ? 'TOUG' : rawShowroom;

                const row = [
                    rowNum++,
                    po.id,
                    displayShowroom,
                    v.orderId || "-",
                    client ? `${client.firstName} ${client.lastName}` : "EN STOCK",
                    client ? (client.passportNumber || "-") : "-",
                    client ? (client.nin || "-") : "-",
                    v.brand || "-",
                    v.model || "-",
                    this.translateColorToEnglish(v.color),
                    v.chassisNumber || "-",
                    client ? (client.address || "-") : "-",
                    client ? (client.postalCode || "-") : "-"
                ].map(val => String(val || "-").toUpperCase());

                rows.push(row);
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
            rowPageBreak: 'avoid',
            columnStyles: {
                0: { cellWidth: 8, halign: 'center' }, // N°
                1: { cellWidth: 15 }, // ID Achat
                2: { cellWidth: 20 }, // Showroom
                3: { cellWidth: 15 }, // N° Vente
                4: { cellWidth: 30 }  // Nom Client
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
            "N°", "ID Achat", "Showroom", "N° Vente", "Nom Client", "Passport", "NIN",
            "Marque", "Modèle", "Couleur", "VIN",
            "Adresse", "C.P."
        ].map(c => c.toUpperCase());

        const rows = [];
        let rowNum = 1;
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

            const rawShowroom = client ? (client.showroom || "-") : "-";
            const displayShowroom = String(rawShowroom).toUpperCase() === 'TOUGGOURT' ? 'TOUG' : rawShowroom;

            const row = [
                rowNum++,
                po.id,
                displayShowroom,
                v.orderId || "-",
                v.soldRegistration ? (v.originalOwnerName || "VENDU C.G") : (client ? `${client.firstName} ${client.lastName}` : "EN STOCK"),
                client ? (client.passportNumber || "-") : "-",
                client ? (client.nin || "-") : "-",
                v.brand || "-",
                v.model || "-",
                this.translateColorToEnglish(v.color),
                v.chassisNumber || "-",
                client ? (client.address || "-") : "-",
                client ? (client.postalCode || "-") : "-"
            ].map(val => String(val || "-").toUpperCase());

            rows.push(row);
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
        doc.text(`Date: ${po.purchaseDate ? this.formatDate(po.purchaseDate) : 'N/A'}`, 80, 38);

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
            rowPageBreak: 'avoid',
            columnStyles: {
                0: { cellWidth: 8, halign: 'center' }, // N°
                1: { cellWidth: 15 }, // ID Achat
                2: { cellWidth: 20 }, // Showroom
                3: { cellWidth: 15 }, // N° Vente
                4: { cellWidth: 30 }  // Nom Client
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
                    this.formatDate(c.date),
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
                    this.formatDate(o.date),
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
                    this.formatDate(o.date),
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
        const brandsRaw = StorageService.get(STORAGE_KEYS.BRANDS_RAW) || [];

        return `
            <div class="settings-section">
                <h3><i class="fas fa-car-side"></i> Modèles & Finitions par Marque</h3>
                <div class="config-grid">
                    ${brandsRaw.map(brand => `
                        <div class="config-item glass" style="flex-direction: column; align-items: stretch; gap: 10px; height: auto; min-height: 150px; padding: 15px;">
                            <div style="font-weight: 700; width: 100%; border-bottom: 1px solid var(--border-glass); padding-bottom: 8px; margin-bottom: 5px; color: var(--primary); display: flex; justify-content: space-between; align-items: center;">
                                <span>${brand.name}</span>
                                <span style="font-size: 0.7rem; opacity: 0.6;">${(brand.models || []).length} modèles</span>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 8px; flex-grow: 1;">
                                ${(brand.models || []).slice(0, 5).map(m => `
                                    <div style="font-size: 0.85rem; display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-caret-right" style="font-size: 0.7rem; opacity: 0.5;"></i>
                                        <span style="font-weight: 500;">${m.name}</span>
                                        <span style="font-size: 0.7rem; color: var(--text-dim);">(${(m.trims || []).length} finitions)</span>
                                    </div>
                                `).join('')}
                                ${brand.models?.length > 5 ? `<div style="font-size: 0.75rem; color: var(--text-dim); font-style: italic;">+ ${brand.models.length - 5} autres modèles...</div>` : ''}
                                ${(!brand.models || brand.models.length === 0) ? '<div style="color:var(--text-secondary); font-size:0.8rem; opacity: 0.6;">Aucun modèle</div>' : ''}
                            </div>
                            <div style="display: flex; justify-content: flex-end; margin-top: auto; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05);">
                                <button class="btn-icon-small" onclick="app.manageModels('${brand.name.replace(/'/g, "\\'")}')" title="Gérer les modèles et finitions">
                                    <i class="fas fa-cog"></i> Gérer
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    async manageModels(brand) {
        const brandsRaw = StorageService.get(STORAGE_KEYS.BRANDS_RAW) || [];
        const brandObj = brandsRaw.find(b => b.name === brand);

        if (!brandObj) {
            return this.showToast("Erreur: Marque introuvable.", "error");
        }

        const models = brandObj.models || [];

        const modalHtml = `
            <div class="modal-overlay">
                <div class="modal-content glass" style="width: 600px; max-height: 90vh; display: flex; flex-direction: column;">
                    <div class="modal-header">
                        <h2><i class="fas fa-car"></i> Modèles & Finitions : ${brand}</h2>
                        <button class="btn-close" onclick="app.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body" style="padding: 20px; overflow-y: auto;">
                        <div style="margin-bottom: 25px; background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                            <label style="font-size: 0.85rem; color: var(--primary); margin-bottom: 10px; display: block; font-weight: 600;">AJOUTER UN NOUVEAU MODÈLE</label>
                            <div class="add-config-form" style="display: flex; gap: 10px;">
                                <input type="text" id="modal-new-model-name" placeholder="Ex: RS6, Golf 8, Q7..." class="glass-input" style="flex: 1;">
                                <button class="btn-primary" onclick="app.addNewModelFromModal('${brandObj.id}', '${brand.replace(/'/g, "\\'")}')">
                                    <i class="fas fa-plus"></i> Ajouter
                                </button>
                            </div>
                        </div>
                        
                        <div style="border-top: 1px solid var(--border-glass); padding-top: 5px;">
                            <label style="font-size: 0.85rem; color: var(--text-dim); margin-bottom: 15px; display: block; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Modèles existants (${models.length})</label>
                            <div id="modal-model-list" style="display: flex; flex-direction: column; gap: 12px;">
                                ${models.length > 0 ? models.map(m => `
                                    <div class="config-item glass" style="display: flex; flex-direction: column; padding: 0; background: rgba(255,255,255,0.02); overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
                                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05);">
                                            <span style="font-weight: 700; color: white;">${m.name}</span>
                                            <div style="display: flex; gap: 8px;">
                                                <button class="btn-icon-small" onclick="app.toggleTrimsList('${m.id}')" title="Gérer les finitions">
                                                    <i class="fas fa-list"></i>
                                                </button>
                                                <button class="btn-icon-small danger" onclick="app.removeModelFromModal('${m.id}', '${brand.replace(/'/g, "\\'")}')" title="Supprimer le modèle">
                                                    <i class="fas fa-trash-alt"></i>
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <!-- Finitions Section -->
                                        <div id="trims-section-${m.id}" style="padding: 12px; background: rgba(0,0,0,0.1); display: none;">
                                            <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                                                <input type="text" id="input-new-trim-${m.id}" placeholder="Nouvelle finition (ex: Luxury, Sport...)" class="glass-input" style="font-size: 0.8rem; padding: 6px 12px;">
                                                <button class="btn-primary" style="padding: 5px 12px; font-size: 0.75rem;" onclick="app.addTrimFromModal('${m.id}', '${brand.replace(/'/g, "\\'")}')">
                                                    <i class="fas fa-plus"></i>
                                                </button>
                                            </div>
                                            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                                ${(m.trims || []).length > 0 ? m.trims.map(trim => `
                                                    <span class="status-badge info" style="font-size: 0.7rem; display: flex; align-items: center; gap: 8px; padding: 4px 10px;">
                                                        ${trim.name}
                                                        <i class="fas fa-edit" style="cursor: pointer; opacity: 0.8; font-size: 0.7rem;" onclick="app.showTrimDetailsModal('${trim.id}', '${brand.replace(/'/g, "\\'")}')" title="Caractéristiques"></i>
                                                        <i class="fas fa-times" style="cursor: pointer; opacity: 0.6; font-size: 0.6rem;" onclick="app.removeTrimFromModal('${trim.id}', '${brand.replace(/'/g, "\\'")}')" title="Supprimer"></i>
                                                    </span>
                                                `).join('') : '<span style="font-size: 0.75rem; color: var(--text-dim); opacity: 0.5;">Aucune finition enregistrée</span>'}
                                            </div>
                                        </div>
                                    </div>
                                `).join('') : `
                                    <div style="text-align: center; padding: 40px 10px; color: var(--text-dim); background: rgba(255,255,255,0.02); border-radius: 12px; border: 2px dashed rgba(255,255,255,0.05);">
                                        <i class="fas fa-info-circle" style="display: block; font-size: 2rem; margin-bottom: 10px; opacity: 0.3;"></i>
                                        <p>Aucun modèle enregistré pour cette marque.</p>
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="app.closeModal()">Fermer</button>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        this.closeModal();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Focus input
        setTimeout(() => {
            const input = document.getElementById('modal-new-model-name');
            if (input) input.focus();
        }, 100);
    },

    async addNewModelFromModal(brandId, brandName) {
        const input = document.getElementById('modal-new-model-name');
        const name = input.value.trim();
        if (!name) return;

        try {
            // Find the button to show loading state
            const btn = document.querySelector('.modal-body .btn-primary');
            const originalContent = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            btn.disabled = true;

            const res = await ApiService.addVehicleModel(brandId, { name });
            if (res.success) {
                this.showToast(`Modèle "${name}" ajouté`, "success");
                await StorageService.syncAll();
                // Re-render modal to show new list
                this.manageModels(brandName);
                // Refresh settings in background if visible
                if (this.currentView === 'settings') this.renderSettings();
            } else {
                this.showToast(res.message || "Erreur lors de l'ajout", "error");
                btn.innerHTML = originalContent;
                btn.disabled = false;
            }
        } catch (error) {
            console.error(error);
            this.showToast("Erreur serveur", "error");
        }
    },

    toggleTrimsList(modelId) {
        const section = document.getElementById(`trims-section-${modelId}`);
        if (section) {
            section.style.display = section.style.display === 'none' ? 'block' : 'none';
        }
    },

    async addTrimFromModal(modelId, brandName) {
        const input = document.getElementById(`input-new-trim-${modelId}`);
        const name = input.value.trim();
        if (!name) return;

        try {
            const res = await ApiService.addVehicleTrim(modelId, { name });
            if (res.success) {
                this.showToast(`Finition "${name}" ajoutée`, "success");
                await StorageService.syncAll();
                this.manageModels(brandName);
            } else {
                this.showToast(res.error || res.message || "Erreur lors de l'ajout", "error");
            }
        } catch (error) {
            console.error(error);
            this.showToast("Erreur serveur", "error");
        }
    },

    async showTrimDetailsModal(trimId, brandName) {
        // Find the trim in local storage raw data
        const brandsRaw = StorageService.get(STORAGE_KEYS.BRANDS_RAW) || [];
        let foundTrim = null;
        for (const b of brandsRaw) {
            for (const m of (b.models || [])) {
                foundTrim = (m.trims || []).find(t => t.id === trimId);
                if (foundTrim) break;
            }
            if (foundTrim) break;
        }

        if (!foundTrim) return this.showToast("Finition introuvable", "error");

        const chars = foundTrim.characteristics || {};

        const modalHtml = `
            <div class="modal-overlay" id="trim-details-overlay" style="z-index: 2000;">
                <div class="modal-content glass" style="width: 500px;">
                    <div class="modal-header">
                        <h2><i class="fas fa-list-ul"></i> Caractéristiques : ${foundTrim.name}</h2>
                        <button class="btn-close" onclick="document.getElementById('trim-details-overlay').remove()">&times;</button>
                    </div>
                    <form id="trim-chars-form" style="padding: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <input type="hidden" name="trimId" value="${trimId}">
                        
                        <div class="form-group">
                            <label>Moteur (ex: 2.0 TDI, V8...)</label>
                            <input type="text" name="engine" class="glass-input" value="${chars.engine || ''}" placeholder="Cylindrée / Type">
                        </div>

                        <div class="form-group">
                            <label>Type de Boîte</label>
                            <select name="gearbox" class="glass-select">
                                <option value="" ${!chars.gearbox ? 'selected' : ''}>Non spécifié</option>
                                <option value="Manuelle" ${chars.gearbox === 'Manuelle' ? 'selected' : ''}>Manuelle</option>
                                <option value="Automatique" ${chars.gearbox === 'Automatique' ? 'selected' : ''}>Automatique</option>
                                <option value="DSG/S-Tronic" ${chars.gearbox === 'DSG/S-Tronic' ? 'selected' : ''}>DSG / S-Tronic</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Moteur Turbo</label>
                            <select name="turbo" class="glass-select">
                                <option value="Non" ${chars.turbo === 'Non' ? 'selected' : ''}>Non</option>
                                <option value="Oui" ${chars.turbo === 'Oui' ? 'selected' : ''}>Oui</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Caméra de recul</label>
                            <select name="camera" class="glass-select">
                                <option value="Non" ${chars.camera === 'Non' ? 'selected' : ''}>Non</option>
                                <option value="Oui" ${chars.camera === 'Oui' ? 'selected' : ''}>Oui (Standard)</option>
                                <option value="360" ${chars.camera === '360' ? 'selected' : ''}>Vision 360°</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Sièges Électriques</label>
                            <select name="electricSeats" class="glass-select">
                                <option value="Non" ${chars.electricSeats === 'Non' ? 'selected' : ''}>Non</option>
                                <option value="Oui" ${chars.electricSeats === 'Oui' ? 'selected' : ''}>Oui</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Malle Électrique</label>
                            <select name="electricTrunk" class="glass-select">
                                <option value="Non" ${chars.electricTrunk === 'Non' ? 'selected' : ''}>Non</option>
                                <option value="Oui" ${chars.electricTrunk === 'Oui' ? 'selected' : ''}>Oui</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Type de Toit</label>
                            <select name="roof" class="glass-select">
                                <option value="Non" ${chars.roof === 'Non' ? 'selected' : ''}>Non (Tôlé)</option>
                                <option value="Ouvrant" ${chars.roof === 'Ouvrant' ? 'selected' : ''}>Toit Ouvrant</option>
                                <option value="Panoramique" ${chars.roof === 'Panoramique' ? 'selected' : ''}>Toit Panoramique</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Roue de Secours</label>
                            <select name="spareWheel" class="glass-select">
                                <option value="Non" ${chars.spareWheel === 'Non' ? 'selected' : ''}>Non</option>
                                <option value="Oui" ${chars.spareWheel === 'Oui' ? 'selected' : ''}>Oui</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Main Libre (Keyless)</label>
                            <select name="keyless" class="glass-select">
                                <option value="Non" ${chars.keyless === 'Non' ? 'selected' : ''}>Non</option>
                                <option value="Oui" ${chars.keyless === 'Oui' ? 'selected' : ''}>Oui</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Start & Stop</label>
                            <select name="startStop" class="glass-select">
                                <option value="Non" ${chars.startStop === 'Non' ? 'selected' : ''}>Non</option>
                                <option value="Oui" ${chars.startStop === 'Oui' ? 'selected' : ''}>Oui</option>
                            </select>
                        </div>
                        
                        <div class="form-group" style="grid-column: span 2;">
                            <label>Remarques (Champ libre)</label>
                            <textarea name="remarks" class="glass-input" style="width: 100%; height: 80px; padding: 10px; resize: vertical;" placeholder="Autres équipements, détails spécifiques...">${chars.remarks || ''}</textarea>
                        </div>

                        <div class="modal-footer" style="grid-column: span 2; margin-top: 10px;">
                            <button type="button" class="btn-secondary" onclick="document.getElementById('trim-details-overlay').remove()">Annuler</button>
                            <button type="submit" class="btn-primary">Enregistrer</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('trim-chars-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const characteristics = {};
            formData.forEach((value, key) => {
                if (key !== 'trimId') characteristics[key] = value;
            });

            try {
                // We'll need a new API method for this or use updateBrand which is not ideal
                // For now, let's assume we use addVehicleTrim with an update logic or a new route
                const res = await ApiService.updateVehicleTrim(trimId, { characteristics });
                if (res.success) {
                    this.showToast("Caractéristiques mises à jour", "success");
                    document.getElementById('trim-details-overlay').remove();
                    await StorageService.syncAll();
                    this.manageModels(brandName);
                } else {
                    this.showToast(res.message || "Erreur lors de la mise à jour", "error");
                }
            } catch (error) {
                console.error(error);
                this.showToast("Erreur serveur", "error");
            }
        });
    },

    async removeTrimFromModal(trimId, brandName) {
        if (!confirm("Voulez-vous vraiment supprimer cette finition ?")) return;

        try {
            const res = await ApiService.deleteVehicleTrim(trimId);
            if (res.success) {
                this.showToast("Finition supprimée", "info");
                await StorageService.syncAll();
                this.manageModels(brandName);
            } else {
                this.showToast(res.message || "Erreur lors de la suppression", "error");
            }
        } catch (error) {
            console.error(error);
            this.showToast("Erreur serveur", "error");
        }
    },

    async removeModelFromModal(modelId, brandName) {
        if (!confirm("Voulez-vous vraiment supprimer ce modèle ?")) return;

        try {
            const res = await ApiService.deleteVehicleModel(modelId);
            if (res.success) {
                this.showToast("Modèle supprimé", "info");
                await StorageService.syncAll();
                this.manageModels(brandName);
                if (this.currentView === 'settings') this.renderSettings();
            } else {
                this.showToast(res.message || "Erreur lors de la suppression", "error");
            }
        } catch (error) {
            console.error(error);
            this.showToast("Erreur serveur", "error");
        }
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
    },

    async renderVehiclePrices() {
        const isAdmin = this.isAdmin();

        this.viewContainer.innerHTML = `
            <div class="view-header">
                <div>
                    <h1><i class="fas fa-tags"></i> Prix Véhicules</h1>
                    <p>Comparatif des prix fournisseurs et configuration des prix de vente DZD</p>
                </div>
                ${isAdmin ? `
                <button class="btn-primary" onclick="app.showVehiclePriceModal()">
                    <i class="fas fa-plus"></i> Nouvel Achat (USD)
                </button>` : ''}
            </div>

            <div class="filters-container glass-card" style="margin-top: 20px; padding: 15px; display: flex; gap: 15px; flex-wrap: wrap; align-items: center;">
                <div style="flex: 1; min-width: 250px;">
                    <div class="search-bar" style="margin-bottom: 0;">
                        <i class="fas fa-search"></i>
                        <input type="text" id="filter-vp-search" class="glass-input" placeholder="Rechercher par Marque, Modèle, Finition..." onkeyup="app.filterVehiclePrices()">
                    </div>
                </div>
                ${isAdmin ? `
                <div style="flex: 1; min-width: 200px;">
                    <select id="filter-vp-supplier" class="glass-select" onchange="app.filterVehiclePrices()">
                        <option value="">Tous les fournisseurs</option>
                    </select>
                </div>` : ''}
            </div>

            <div class="glass-card" style="margin-top: 20px; overflow: hidden;">
                <div class="table-responsive">
                    <table class="data-table bordered">
                        <thead>
                            <!-- Dynamic headers -->
                        </thead>
                        <tbody id="prices-table-body">
                            <tr><td colspan="6" style="text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin"></i> Chargement...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        try {
            const dashboardRes = await ApiService.getVehiclePricesDashboard();
            
            if (dashboardRes.success) {
                // Sort by TrimName (Brand/Model), then by bestPrice
                const sortedData = dashboardRes.data.sort((a, b) => {
                    const nameA = a.trimName.toLowerCase();
                    const nameB = b.trimName.toLowerCase();
                    if (nameA < nameB) return -1;
                    if (nameA > nameB) return 1;
                    
                    const priceA = a.bestPrice ? Number(a.bestPrice.priceUSD) : Infinity;
                    const priceB = b.bestPrice ? Number(b.bestPrice.priceUSD) : Infinity;
                    return priceA - priceB;
                });

                this.vehiclePricingDashboardData = sortedData;
                
                // Populate supplier filter if admin
                const supplierSelect = document.getElementById('filter-vp-supplier');
                if (supplierSelect) {
                    const uniqueSuppliers = new Set();
                    dashboardRes.data.forEach(trim => {
                        trim.history.forEach(p => {
                            if (p.supplierName) uniqueSuppliers.add(p.supplierName);
                        });
                    });
                    Array.from(uniqueSuppliers).sort().forEach(sup => {
                        supplierSelect.insertAdjacentHTML('beforeend', `<option value="${sup}">${sup}</option>`);
                    });
                }

                this.renderVehiclePricesTable(dashboardRes.data);
            } else {
                document.getElementById('prices-table-body').innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-dim);">Aucun prix enregistré.</td></tr>`;
            }
        } catch (error) {
            console.error('Error rendering vehicle prices:', error);
            this.showToast("Erreur lors du chargement des prix", "error");
        }
    },

    filterVehiclePrices() {
        if (!this.vehiclePricingDashboardData) return;
        
        const searchTerm = document.getElementById('filter-vp-search').value.toLowerCase();
        const supplierSelect = document.getElementById('filter-vp-supplier');
        const supplierTerm = supplierSelect ? supplierSelect.value : '';

        const filtered = this.vehiclePricingDashboardData.filter(trim => {
            const matchesSearch = trim.trimName.toLowerCase().includes(searchTerm);
            
            let matchesSupplier = true;
            if (supplierTerm) {
                // Check if the trim history contains the selected supplier
                matchesSupplier = trim.history.some(p => p.supplierName === supplierTerm);
            }

            return matchesSearch && matchesSupplier;
        });

        this.renderVehiclePricesTable(filtered);
    },

    renderVehiclePricesTable(data) {
        const isAdmin = this.isAdmin();

        const thead = document.querySelector('.data-table.bordered thead');
        const tbody = document.getElementById('prices-table-body');
        
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 40px; color: var(--text-dim);">Aucun résultat trouvé.</td></tr>`;
            return;
        }

        // Get all unique suppliers from the global dashboard data to keep columns consistent
        const suppliersList = [];
        if (isAdmin && this.vehiclePricingDashboardData) {
            const globalSuppliers = new Set();
            this.vehiclePricingDashboardData.forEach(trim => {
                trim.history.forEach(p => {
                    if (p.supplierName) globalSuppliers.add(p.supplierName);
                });
            });
            suppliersList.push(...Array.from(globalSuppliers).sort());
        }

        // Render table headers
        let headerHtml = `
            <tr>
                <th>Marque</th>
                <th>Véhicule (Finition)</th>
                <th>Prix Vente (Neuf)</th>
                <th>Prix Vente (-3 Ans)</th>
        `;
        if (isAdmin) {
            suppliersList.forEach(sup => {
                headerHtml += `<th>${sup} (USD)</th>`;
            });
        }
        headerHtml += `<th>Actions</th></tr>`;
        thead.innerHTML = headerHtml;

        // Render table body
        // To handle merging, we'll pre-calculate rowspans for brands
        const brandRowspans = {};
        data.forEach(trim => {
            brandRowspans[trim.brandName] = (brandRowspans[trim.brandName] || 0) + 1;
        });

        const brandCounts = {}; // Track how many rows of a brand we've rendered

        tbody.innerHTML = data.map((trim, index) => {
            // Find the best overall price for highlighting (only if admin)
            const prices = isAdmin ? trim.history.map(p => Number(p.priceUSD)).filter(val => !isNaN(val)) : [];
            const bestPriceValue = prices.length > 0 ? Math.min(...prices) : null;

            const brandName = trim.brandName;
            const isFirstOfBrand = !brandCounts[brandName];
            brandCounts[brandName] = (brandCounts[brandName] || 0) + 1;

            let rowHtml = `
                <tr>
                    ${isFirstOfBrand ? `
                    <td rowspan="${brandRowspans[brandName]}" style="vertical-align: middle; text-align: center; border-right: 1px solid rgba(255,255,255,0.1); background: rgba(var(--primary-rgb), 0.05);">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                            ${trim.brandLogo ? `<img src="${trim.brandLogo}" style="width: 40px; height: 40px; object-fit: contain;">` : ''}
                            <div style="font-weight: 800; font-size: 0.8rem; color: var(--text-bright); text-transform: uppercase;">${brandName}</div>
                        </div>
                    </td>
                    ` : ''}
                    <td>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <div style="font-weight: 600;">${trim.trimName}</div>
                            <button class="btn-xs" onclick="app.showTrimCharacteristicsModal('${trim.trimId}')" style="align-self: flex-start; padding: 2px 8px; font-size: 0.65rem; background: rgba(14, 165, 233, 0.1); color: #0ea5e9; border: 1px solid rgba(14, 165, 233, 0.2); border-radius: 4px; cursor: pointer;">
                                <i class="fas fa-list-ul"></i> Voir Options
                            </button>
                        </div>
                    </td>
                    <td style="font-weight: 700; color: var(--info);">${trim.priceDzdNeuf ? Number(trim.priceDzdNeuf).toLocaleString() + ' DA' : '--'}</td>
                    <td style="font-weight: 700; color: var(--warning);">${trim.priceDzd3Ans ? Number(trim.priceDzd3Ans).toLocaleString() + ' DA' : '--'}</td>
            `;

            // For each supplier, find the latest price for this trim (only if admin)
            if (isAdmin) {
                suppliersList.forEach(sup => {
                    const supplierPrices = trim.history.filter(p => p.supplierName === sup);
                    if (supplierPrices.length > 0) {
                        // Sort by date DESC to get the latest
                        supplierPrices.sort((a, b) => new Date(b.date) - new Date(a.date));
                        const latestPrice = supplierPrices[0];
                        const isBest = Number(latestPrice.priceUSD) === bestPriceValue;
                        const priceColor = isBest ? 'var(--success)' : 'var(--primary)';
                        
                        rowHtml += `
                            <td style="font-weight: 700; color: ${priceColor};">
                                $ ${Number(latestPrice.priceUSD).toLocaleString()}
                                <div style="font-size: 0.7rem; color: var(--text-dim); font-weight: normal;">${this.formatDate(latestPrice.date)}</div>
                            </td>`;
                    } else {
                        rowHtml += `<td style="color: var(--text-dim);">--</td>`;
                    }
                });
            }

            rowHtml += `
                    <td>
                        <div class="actions">
                            ${isAdmin ? `
                            <button class="btn-icon" onclick="app.showVehiclePriceModal(null, '${trim.trimId}')" title="Ajouter un prix d'achat"><i class="fas fa-plus-circle" style="color: var(--success);"></i></button>
                            ` : ''}
                            <button class="btn-icon" onclick="app.showTrimPriceModal('${trim.trimId}', '${trim.priceDzdNeuf || ''}', '${trim.priceDzd3Ans || ''}')" title="Configurer prix de vente DZD"><i class="fas fa-money-bill-wave" style="color: var(--primary);"></i></button>
                            ${isAdmin ? `
                            <button class="btn-icon" onclick="app.showTrimHistoryModal('${trim.trimId}')" title="Historique & Comparatif"><i class="fas fa-chart-line" style="color: #0ea5e9;"></i></button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
            return rowHtml;
        }).join('');
    },

    showTrimCharacteristicsModal(trimId) {
        const trim = this.vehiclePricingDashboardData.find(t => t.trimId === trimId);
        if (!trim) return;

        const chars = trim.characteristics || {};
        const categories = {
            'Moteur & Performance': ['Moteur', 'Puissance', 'Transmission', 'Transmission Type', 'Cylindre'],
            'Dimensions & Poids': ['Dimensions', 'Poids', 'Rservoir'],
            'Extrieur': ['Jantes', 'Phares', 'Toit'],
            'Intrieur & Confort': ['Sellerie', 'Siges', 'Climatisation', 'Systme Audio'],
            'Scurit & Aide': ['Airbags', 'Aide Conduite', 'Camra']
        };

        let contentHtml = '';
        
        // Group characteristics by category
        Object.entries(categories).forEach(([catName, fields]) => {
            const catFields = Object.entries(chars).filter(([key]) => fields.some(f => key.includes(f)));
            if (catFields.length > 0) {
                contentHtml += `
                    <div style="margin-bottom: 20px;">
                        <h4 style="color: var(--primary); margin-bottom: 10px; border-bottom: 1px solid rgba(var(--primary-rgb), 0.2); padding-bottom: 5px;">${catName}</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;">
                            ${catFields.map(([key, val]) => `
                                <div style="background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 6px;">
                                    <div style="font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase;">${key}</div>
                                    <div style="font-weight: 600;">${val || '--'}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        });

        // Add remaining characteristics not in categories
        const categorizedKeys = Object.values(categories).flat();
        const otherFields = Object.entries(chars).filter(([key]) => !categorizedKeys.some(f => key.includes(f)));
        
        if (otherFields.length > 0) {
            contentHtml += `
                <div>
                    <h4 style="color: var(--primary); margin-bottom: 10px; border-bottom: 1px solid rgba(var(--primary-rgb), 0.2); padding-bottom: 5px;">Autres Options</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;">
                        ${otherFields.map(([key, val]) => `
                            <div style="background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 6px;">
                                <div style="font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase;">${key}</div>
                                <div style="font-weight: 600;">${val || '--'}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (!contentHtml) contentHtml = '<div style="text-align: center; padding: 40px; color: var(--text-dim);">Aucune option détaillée enregistrée.</div>';

        const modalHtml = `
            <div class="modal-overlay" onclick="app.closeModal()">
                <div class="modal-content large" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            ${trim.brandLogo ? `<img src="${trim.brandLogo}" style="width: 40px; height: 40px; object-fit: contain;">` : ''}
                            <div>
                                <h2 style="margin: 0;">Options & Caractéristiques</h2>
                                <div style="color: var(--primary); font-weight: 600;">${trim.trimName}</div>
                            </div>
                        </div>
                        <button class="close-modal" onclick="app.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body" style="max-height: 70vh; overflow-y: auto; padding: 20px;">
                        ${contentHtml}
                    </div>
                    <div class="modal-footer">
                        <button class="btn-primary" onclick="app.closeModal()">Fermer</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    async showVehiclePriceModal(priceId = null, defaultTrimId = null) {
        const [brandsRes, suppliersRes, pricesRes] = await Promise.all([
            ApiService.getBrands(),
            ApiService.getSuppliers(),
            priceId ? ApiService.getVehiclePrices() : Promise.resolve({ success: true, data: [] })
        ]);

        const price = priceId ? pricesRes.data.find(p => p.id === priceId) : null;
        const brands = brandsRes.success ? brandsRes.data : [];
        const suppliers = suppliersRes.success ? suppliersRes.data : [];

        // If we have a defaultTrimId, we should try to find its brand to pre-select it
        let defaultBrandId = '';
        if (defaultTrimId && brands.length > 0) {
            for (const b of brands) {
                if (b.models) {
                    for (const m of b.models) {
                        if (m.trims && m.trims.find(t => t.id === defaultTrimId)) {
                            defaultBrandId = b.id;
                            break;
                        }
                    }
                }
                if (defaultBrandId) break;
            }
        }

        const selectedBrandId = price?.trim?.model?.brandId || defaultBrandId;
        const selectedTrimId = price?.trimId || defaultTrimId;

        const modalHtml = `
            <div id="modal-overlay" class="modal-overlay">
                <div class="modal-content glass" style="width: 500px;">
                    <div class="modal-header">
                        <h2>${priceId ? 'Modifier Prix d\'Achat' : 'Nouvel Achat Fournisseur'}</h2>
                        <button class="btn-close" onclick="app.closeModal()">&times;</button>
                    </div>
                    <form id="price-form">
                        <div class="form-group">
                            <label>Marque & Modèle</label>
                            <select id="modal-brand-select" class="glass-select" required>
                                <option value="">Sélectionner une marque</option>
                                ${brands.map(b => `<option value="${b.id}" ${selectedBrandId === b.id ? 'selected' : ''}>${b.name}</option>`).join('')}
                            </select>
                            <select id="modal-trim-select" name="trimId" class="glass-select" style="margin-top: 10px;" required>
                                <option value="">Sélectionner une finition</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Fournisseur</label>
                            <select name="supplierId" class="glass-select" required>
                                <option value="">Sélectionner un fournisseur</option>
                                ${suppliers.map(s => `<option value="${s.id}" ${price?.supplierId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Prix d'Achat (USD)</label>
                            <input type="number" name="priceUSD" class="glass-input" step="0.01" value="${price?.priceUSD || ''}" required>
                        </div>
                        <div class="form-group">
                            <label>Date de l'offre / achat</label>
                            <input type="date" name="date" class="glass-input" value="${price?.date || new Date().toISOString().split('T')[0]}" required>
                        </div>
                        <div class="form-group">
                            <label>Notes</label>
                            <textarea name="notes" class="glass-input" rows="3">${price?.notes || ''}</textarea>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn-secondary" onclick="app.closeModal()">Annuler</button>
                            <button type="submit" class="btn-primary">${priceId ? 'Mettre à jour' : 'Enregistrer'}</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const brandSelect = document.getElementById('modal-brand-select');
        const trimSelect = document.getElementById('modal-trim-select');

        brandSelect.onchange = () => {
            const selectedBrand = brands.find(b => b.id === brandSelect.value);
            if (selectedBrand && selectedBrand.models) {
                let options = '<option value="">Sélectionner une finition</option>';
                selectedBrand.models.forEach(m => {
                    if (m.trims) {
                        m.trims.forEach(t => {
                            options += `<option value="${t.id}">${m.name} - ${t.name}</option>`;
                        });
                    }
                });
                trimSelect.innerHTML = options;
            } else {
                trimSelect.innerHTML = '<option value="">Sélectionner une finition</option>';
            }
        };

        if (selectedBrandId) {
            brandSelect.onchange();
            if (selectedTrimId) {
                trimSelect.value = selectedTrimId;
            }
        }

        document.getElementById('price-form').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());

            try {
                const res = priceId 
                    ? await ApiService.updateVehiclePrice(priceId, data)
                    : await ApiService.createVehiclePrice(data);

                if (res.success) {
                    this.showToast(priceId ? "Prix mis à jour" : "Prix ajouté", "success");
                    this.closeModal();
                    this.renderVehiclePrices();
                } else {
                    this.showToast(res.message || "Erreur lors de l'enregistrement", "error");
                }
            } catch (error) {
                console.error(error);
                this.showToast("Erreur serveur", "error");
            }
        };
    },

    async deleteVehiclePrice(id) {
        if (!confirm("Voulez-vous vraiment supprimer ce tarif ?")) return;
        try {
            const res = await ApiService.deleteVehiclePrice(id);
            if (res.success) {
                this.showToast("Tarif supprimé", "info");
                this.renderVehiclePrices();
            } else {
                this.showToast(res.message || "Erreur lors de la suppression", "error");
            }
        } catch (error) {
            console.error(error);
            this.showToast("Erreur serveur", "error");
        }
    },

    showTrimPriceModal(trimId, currentNeuf, current3Ans) {
        const modalHtml = `
            <div id="modal-overlay" class="modal-overlay">
                <div class="modal-content glass" style="width: 400px;">
                    <div class="modal-header">
                        <h2>Configurer Prix de Vente DZD</h2>
                        <button class="btn-close" onclick="app.closeModal()">&times;</button>
                    </div>
                    <form id="trim-price-form">
                        <div class="form-group">
                            <label>Prix DZD (Neuf)</label>
                            <input type="number" name="priceDzdNeuf" class="glass-input" step="0.01" value="${currentNeuf || ''}">
                            <small style="color: var(--text-dim);">Laissez vide si non applicable</small>
                        </div>
                        <div class="form-group">
                            <label>Prix DZD (-3 Ans)</label>
                            <input type="number" name="priceDzd3Ans" class="glass-input" step="0.01" value="${current3Ans || ''}">
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

        document.getElementById('trim-price-form').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());

            try {
                const res = await ApiService.updateVehicleTrim(trimId, data);
                if (res.success) {
                    this.showToast("Prix de vente configuré", "success");
                    this.closeModal();
                    this.renderVehiclePrices();
                } else {
                    this.showToast(res.message || "Erreur lors de l'enregistrement", "error");
                }
            } catch (error) {
                console.error(error);
                this.showToast("Erreur serveur", "error");
            }
        };
    },

    showTrimHistoryModal(trimId) {
        if (!this.vehiclePricingDashboardData) return;
        const trimData = this.vehiclePricingDashboardData.find(t => t.trimId === trimId);
        if (!trimData) return;

        // Determine best price value
        const prices = trimData.history.map(p => Number(p.priceUSD)).filter(val => !isNaN(val));
        const bestPriceValue = prices.length > 0 ? Math.min(...prices) : null;

        const historyRows = trimData.history.map(p => {
            const isBest = Number(p.priceUSD) === bestPriceValue;
            const priceColor = isBest ? 'var(--success)' : 'var(--primary)';
            const bestBadge = isBest ? ' <span class="badge-outline success" style="margin-left: 5px;"><i class="fas fa-star"></i> Meilleur</span>' : '';

            return `
                <tr>
                    <td>${this.formatDate(p.date)}</td>
                    <td>${p.supplierName || 'N/A'}</td>
                    <td style="font-weight: 700; color: ${priceColor};">$ ${Number(p.priceUSD).toLocaleString()}${bestBadge}</td>
                    <td style="font-size: 0.85rem; color: var(--text-dim);">${p.notes || ''}</td>
                    <td>
                        <div class="actions">
                            <button class="btn-icon" onclick="app.closeModal(); app.showVehiclePriceModal('${p.id}', '${trimId}');" title="Modifier"><i class="fas fa-edit"></i></button>
                            <button class="btn-icon danger" onclick="app.deleteVehiclePrice('${p.id}'); app.closeModal();" title="Supprimer"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        const modalHtml = `
            <div id="modal-overlay" class="modal-overlay">
                <div class="modal-content glass" style="width: 700px;">
                    <div class="modal-header">
                        <h2>Historique d'Achat : ${trimData.trimName}</h2>
                        <button class="btn-close" onclick="app.closeModal()">&times;</button>
                    </div>
                    <div class="table-responsive" style="margin-top: 15px;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Fournisseur</th>
                                    <th>Prix (USD)</th>
                                    <th>Notes</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${historyRows || '<tr><td colspan="5" style="text-align: center; color: var(--text-dim);">Aucun historique</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },
    translateColorToEnglish(color) {
        if (!color) return "-";
        const c = String(color).trim().toUpperCase();
        const map = {
            'BLANC': 'WHITE',
            'NOIR': 'BLACK',
            'GRIS': 'GREY',
            'ROUGE': 'RED',
            'BLEU': 'BLUE',
            'VERT': 'GREEN',
            'JAUNE': 'YELLOW',
            'ARGENT': 'SILVER',
            'MARRON': 'BROWN',
            'OR': 'GOLD',
            'BEIGE': 'BEIGE',
            'VIOLET': 'PURPLE',
            'ORANGE': 'ORANGE'
        };
        return map[c] || c;
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
