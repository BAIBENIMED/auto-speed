/**
 * Centralized API Service for TIBOU AUTO
 */
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.protocol === 'file:')
    ? 'http://localhost:5000'
    : window.location.origin;

console.log('📡 API Service initialized using:', API_BASE_URL);

const ApiService = {
    async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}/api${endpoint}`;
        const defaultHeaders = {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true' // Bypass ngrok landing page for API calls
        };

        // Add auth token if available (though currently we rely on session/cors)
        const currentUser = JSON.parse(localStorage.getItem('gtm_current_user') || 'null');
        if (currentUser && currentUser.token) {
            defaultHeaders['Authorization'] = `Bearer ${currentUser.token}`;
        }

        const config = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            }
        };

        if (config.body && typeof config.body !== 'string' && !(config.body instanceof FormData)) {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);

            // Handle non-JSON or empty responses
            const contentType = response.headers.get("content-type");
            let result;
            if (contentType && contentType.includes("application/json")) {
                result = await response.json();
            } else {
                result = { success: response.ok, message: await response.text() };
            }

            if (!response.ok) {
                // If token expired or unauthorized, clear session to force re-login
                if (response.status === 401) {
                    console.warn("🔐 Session expired or unauthorized. Clearing local state.");
                    localStorage.removeItem('gtm_current_user');
                }

                console.error(`API Error Response (${endpoint}):`, result);
                throw new Error(result.message || `API request failed with status ${response.status}`);
            }

            return result;
        } catch (error) {
            console.error(`API Fetch Error (${endpoint}):`, error);
            throw error;
        }
    },

    // Auth
    login: (credentials) => ApiService.request('/auth/login', { method: 'POST', body: credentials }),
    logout: () => ApiService.request('/auth/logout', { method: 'POST' }),
    getRoles: () => ApiService.request('/roles'),
    createRole: (data) => ApiService.request('/roles', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    updateRole: (id, data) => ApiService.request(`/roles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),
    deleteRole: (id) => ApiService.request(`/roles/${id}`, {
        method: 'DELETE'
    }),

    // Clients
    getClients: () => ApiService.request('/clients'),
    createClient: (data) => ApiService.request('/clients', { method: 'POST', body: data }),
    updateClient: (id, data) => ApiService.request(`/clients/${encodeURIComponent(id)}`, { method: 'PUT', body: data }),
    deleteClient: (id) => ApiService.request(`/clients/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    sendClientTestEmail: (id) => ApiService.request(`/clients/${encodeURIComponent(id)}/test-email`, { method: 'POST' }),

    // Vehicles
    getVehicles: (archived) => ApiService.request(`/vehicles${archived !== undefined ? `?archived=${archived}` : ''}`),
    getVehicleById: (id) => ApiService.request(`/vehicles/${encodeURIComponent(id)}`),
    createVehicle: (data) => ApiService.request('/vehicles', { method: 'POST', body: data }),
    updateVehicle: (id, data) => ApiService.request(`/vehicles/${encodeURIComponent(id)}`, { method: 'PUT', body: data }),
    deleteVehicle: (id) => ApiService.request(`/vehicles/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    archiveVehicle: (id) => ApiService.request(`/vehicles/${encodeURIComponent(id)}/archive`, { method: 'PATCH' }),
    transferVehicle: (id, data) => ApiService.request(`/vehicles/${encodeURIComponent(id)}/transfer`, { method: 'POST', body: data }),
    updateVehicleTransfer: (id, data) => ApiService.request(`/vehicles/transfers/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
    getVehicleTransfers: (id) => ApiService.request(`/vehicles/${encodeURIComponent(id)}/transfers`),
    getAllTransfers: () => ApiService.request('/vehicles/transfers/all'),

    // Orders
    getOrders: (archived) => ApiService.request(`/orders${archived !== undefined ? `?archived=${archived}` : ''}`),
    getOrderById: (id) => ApiService.request(`/orders/${encodeURIComponent(id)}`),
    createOrder: (data) => ApiService.request('/orders', { method: 'POST', body: data }),
    updateOrder: (id, data) => ApiService.request(`/orders/${encodeURIComponent(id)}`, { method: 'PUT', body: data }),
    deleteOrder: (id) => ApiService.request(`/orders/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    validateOrder: (id) => ApiService.request(`/orders/${encodeURIComponent(id)}/validate`, { method: 'PATCH' }),
    resendOrderConfirmation: (id) => ApiService.request(`/orders/${encodeURIComponent(id)}/resend-confirmation`, { method: 'PATCH' }),

    // Shipments
    getShipments: (archived) => ApiService.request(`/shipments${archived !== undefined ? `?archived=${archived}` : ''}`),
    getShipmentById: (id) => ApiService.request(`/shipments/${encodeURIComponent(id)}`),
    createShipment: (data) => ApiService.request('/shipments', { method: 'POST', body: data }),
    updateShipment: (id, data) => ApiService.request(`/shipments/${encodeURIComponent(id)}`, { method: 'PUT', body: data }),
    deleteShipment: (id) => ApiService.request(`/shipments/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    getTrackingData: () => ApiService.request('/shipments/tracking'),

    // Cash
    getCashTransactions: () => ApiService.request('/cash'),
    createCashTransaction: (data) => ApiService.request('/cash', { method: 'POST', body: data }),
    updateCashTransaction: (id, data) => ApiService.request(`/cash/${id}`, { method: 'PUT', body: data }),
    deleteCashTransaction: (id) => ApiService.request(`/cash/${id}`, { method: 'DELETE' }),

    // Settings & Attributes
    getSettings: () => ApiService.request('/settings'),
    updateSettings: (data) => ApiService.request('/settings', { method: 'PUT', body: data }),
    getAttributes: (category) => ApiService.request(`/settings/attributes${category ? `?category=${category}` : ''}`),
    addAttribute: (data) => ApiService.request('/settings/attributes', { method: 'POST', body: data }),
    updateAttribute: (id, data) => ApiService.request(`/settings/attributes/${id}`, { method: 'PUT', body: data }),
    deleteAttribute: (id) => ApiService.request(`/settings/attributes/${id}`, { method: 'DELETE' }),

    // Exchange Rates
    getExchangeRates: () => ApiService.request('/exchange-rates'),
    createExchangeRate: (data) => ApiService.request('/exchange-rates', { method: 'POST', body: data }),
    updateExchangeRate: (id, data) => ApiService.request(`/exchange-rates/${id}`, { method: 'PUT', body: data }),
    deleteExchangeRate: (id) => ApiService.request(`/exchange-rates/${id}`, { method: 'DELETE' }),

    // Brands & Models
    getBrands: () => ApiService.request('/brands'),
    createBrand: (data) => ApiService.request('/brands', { method: 'POST', body: data }),
    updateBrand: (id, data) => ApiService.request(`/brands/${id}`, { method: 'PUT', body: data }),
    deleteBrand: (id) => ApiService.request(`/brands/${id}`, { method: 'DELETE' }),
    addVehicleModel: (brandId, data) => ApiService.request(`/brands/${brandId}/models`, { method: 'POST', body: data }),
    deleteVehicleModel: (modelId) => ApiService.request(`/brands/models/${modelId}`, { method: 'DELETE' }),
    addVehicleTrim: (modelId, data) => ApiService.request(`/brands/models/${modelId}/trims`, { method: 'POST', body: data }),
    deleteVehicleTrim: (trimId) => ApiService.request(`/brands/trims/${trimId}`, { method: 'DELETE' }),
    updateVehicleTrim: (trimId, data) => ApiService.request(`/brands/trims/${trimId}`, { method: 'PUT', body: data }),

    // Showrooms
    getShowrooms: () => ApiService.request('/showrooms'),
    createShowroom: (data) => ApiService.request('/showrooms', { method: 'POST', body: data }),
    updateShowroom: (id, data) => ApiService.request(`/showrooms/${id}`, { method: 'PUT', body: data }),
    deleteShowroom: (id) => ApiService.request(`/showrooms/${id}`, { method: 'DELETE' }),

    // Voyages
    getVoyages: () => ApiService.request('/voyages'),
    createVoyage: (data) => ApiService.request('/voyages', { method: 'POST', body: data }),
    updateVoyage: (id, data) => ApiService.request(`/voyages/${id}`, { method: 'PUT', body: data }),
    deleteVoyage: (id) => ApiService.request(`/voyages/${id}`, { method: 'DELETE' }),

    // Users (Admin Only)
    getUsers: () => ApiService.request('/users'),
    createUser: (data) => ApiService.request('/users', { method: 'POST', body: data }),
    updateUser: (id, data) => ApiService.request(`/users/${id}`, { method: 'PUT', body: data }),
    deleteUser: (id) => ApiService.request(`/users/${id}`, { method: 'DELETE' }),
    resetAdminPassword: () => ApiService.request('/users/reset-admin', { method: 'POST' }),

    // Audit
    getAuditLogs: (limit = 50, offset = 0) => ApiService.request(`/audit?limit=${limit}&offset=${offset}`),

    // Purchase Orders
    getPurchaseOrders: () => ApiService.request('/purchase-orders'),
    createPurchaseOrder: (data) => ApiService.request('/purchase-orders', { method: 'POST', body: data }),
    updatePurchaseOrder: (id, data) => ApiService.request(`/purchase-orders/${encodeURIComponent(id)}`, { method: 'PUT', body: data }),
    deletePurchaseOrder: (id) => ApiService.request(`/purchase-orders/${encodeURIComponent(id)}`, { method: 'DELETE' }),

    // Suppliers
    getSuppliers: () => ApiService.request('/suppliers'),
    createSupplier: (data) => ApiService.request('/suppliers', { method: 'POST', body: data }),
    updateSupplier: (id, data) => ApiService.request(`/suppliers/${id}`, { method: 'PUT', body: data }),
    deleteSupplier: (id) => ApiService.request(`/suppliers/${id}`, { method: 'DELETE' }),
    
    // Vehicle Prices
    getVehiclePrices: () => ApiService.request('/vehicle-prices'),
    getVehiclePricesDashboard: () => ApiService.request('/vehicle-prices/dashboard'),
    createVehiclePrice: (data) => ApiService.request('/vehicle-prices', { method: 'POST', body: data }),
    updateVehiclePrice: (id, data) => ApiService.request(`/vehicle-prices/${id}`, { method: 'PUT', body: data }),
    deleteVehiclePrice: (id) => ApiService.request(`/vehicle-prices/${id}`, { method: 'DELETE' }),

    // Bulk Sync
    syncAllBulk: () => ApiService.request('/sync/sync-all'),

    // Upload
    uploadFile: (file) => {
        const formData = new FormData();
        formData.append('logo', file);
        return ApiService.request('/upload', {
            method: 'POST',
            body: formData,
            headers: {} // Fetch will set correct boundary with FormData
        });
    }
};
