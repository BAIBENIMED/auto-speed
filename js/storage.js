/**
 * Storage Service for TIBOU AUTO - Integrated with API
 */

const STORAGE_KEYS = {
    ORDERS: 'gtm_orders',
    CLIENTS: 'gtm_clients',
    VEHICLES: 'gtm_vehicles',
    SHIPMENTS: 'gtm_shipments',
    SETTINGS: 'gtm_settings',
    USERS: 'gtm_users',
    ROLES: 'gtm_roles',
    CURRENT_USER: 'gtm_current_user',
    CASH: 'gtm_cash',
    BRANDS: 'gtm_brands',
    MOTORS: 'gtm_motors',
    COLORS: 'gtm_colors',
    CURRENCIES: 'gtm_currencies',
    SHOWROOMS: 'gtm_showrooms',
    SHOWROOMS_RAW: 'gtm_showrooms_raw',
    CARRIERS: 'gtm_carriers',
    EXCHANGE_RATES: 'gtm_exchange_rates',
    BRAND_MODELS: 'gtm_brand_models',
    BRANDS_RAW: 'gtm_brands_raw',
    BL_TEMPLATES: 'gtm_bl_templates',
    PURCHASE_ORDERS: 'tib_purchase_orders',
    CATEGORIES: 'gtm_categories',
    SUPPLIERS: 'tib_suppliers',
    NOTIFICATIONS: 'tib_notifications',
    VOYAGES: 'gtm_voyages'
};

const StorageService = {
    /**
     * Get data from local storage (Synchronous for compatibility)
     */
    get(key) {
        const data = localStorage.getItem(key);
        if (!data) return key === STORAGE_KEYS.SETTINGS ? null : [];
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error('Error parsing storage data for key:', key);
            return [];
        }
    },

    /**
     * Save data to local storage and sync with API
     */
    async save(key, data) {
        // Save locally first for immediate UI feedback
        localStorage.setItem(key, JSON.stringify(data));

        // Sync with API based on key
        try {
            switch (key) {
                case STORAGE_KEYS.SETTINGS:
                    await ApiService.updateSettings(data);
                    break;
                case STORAGE_KEYS.BRANDS_RAW:
                    // Syncing the whole list might be expensive, usually individual add/update/delete are used.
                    // But if needed, we could implement a bulk sync here.
                    break;
                case STORAGE_KEYS.SHOWROOMS_RAW:
                    break;
                case STORAGE_KEYS.BRAND_MODELS:
                    // Sync brand models to attribute metadata
                    const rawAttrs = JSON.parse(localStorage.getItem('gtm_attributes_raw') || '[]');
                    for (const brand in data) {
                        const attr = rawAttrs.find(a => a.category === 'brands' && a.value === brand);
                        if (attr) {
                            await ApiService.updateAttribute(attr.id, { metadata: { models: data[brand] } });
                        }
                    }
                    break;
                case STORAGE_KEYS.USERS:
                    // Usually users are updated individually, but if we save the whole list:
                    // This is a bit inefficient for users, but kept for compatibility with existing app.js logic
                    // Better to use individual updates where possible.
                    break;
                case STORAGE_KEYS.ROLES:
                    // Sync roles individually
                    if (Array.isArray(data)) {
                        for (const role of data) {
                            await ApiService.updateRole(role.id, role);
                        }
                    }
                    break;
                // Add other keys if they represent single objects that can be saved entirely
            }
        } catch (e) {
            console.warn(`Background sync failed for ${key}:`, e);
        }
    },

    /**
     * Add item and sync with API
     */
    async add(key, item) {
        const data = this.get(key);
        data.unshift(item);
        localStorage.setItem(key, JSON.stringify(data));

        try {
            let res;
            switch (key) {
                case STORAGE_KEYS.VEHICLES:
                    await ApiService.createVehicle(item);
                    break;
                case STORAGE_KEYS.ORDERS:
                    await ApiService.createOrder(item);
                    break;
                case STORAGE_KEYS.CLIENTS:
                    await ApiService.createClient(item);
                    break;
                case STORAGE_KEYS.SHIPMENTS:
                    await ApiService.createShipment(item);
                    break;
                case STORAGE_KEYS.CASH:
                    await ApiService.createCashTransaction(item);
                    break;
                case STORAGE_KEYS.EXCHANGE_RATES:
                    await ApiService.createExchangeRate(item);
                    break;
                case STORAGE_KEYS.BRANDS:
                    res = await ApiService.createBrand({ name: item });
                    break;
                case STORAGE_KEYS.BRANDS_RAW:
                    res = await ApiService.createBrand(item);
                    // Update local item with server ID
                    if (res && res.success && res.data) {
                        const localBrands = this.get(key);
                        // Assuming the item added at the beginning (unshift) matches, or we find by name
                        // Ideally, we should find the temp item and replace it.
                        // Since 'add' did unshift(item), the first item is the one we just added locally.
                        // We update it in place.
                        if (localBrands.length > 0 && localBrands[0].name === item.name) {
                            localBrands[0] = res.data;
                            localStorage.setItem(key, JSON.stringify(localBrands));
                        }
                    }
                    break;
                case STORAGE_KEYS.SHOWROOMS:
                    res = await ApiService.createShowroom({ name: item });
                    break;
                case STORAGE_KEYS.SHOWROOMS_RAW:
                    res = await ApiService.createShowroom(item);
                    // Update local with server ID
                    if (res && res.success && res.data) {
                        const localRooms = this.get(key);
                        if (localRooms.length > 0 && localRooms[0].name === item.name) {
                            localRooms[0] = res.data;
                            localStorage.setItem(key, JSON.stringify(localRooms));
                        }
                    }
                    break;
                case STORAGE_KEYS.COLORS:
                    res = await ApiService.addAttribute({ category: 'colors', value: item });
                    break;
                case STORAGE_KEYS.MOTORS:
                    res = await ApiService.addAttribute({ category: 'motors', value: item });
                    break;
                case STORAGE_KEYS.SHOWROOMS:
                    res = await ApiService.createShowroom({ name: item });
                    break;
                case STORAGE_KEYS.CARRIERS:
                    res = await ApiService.addAttribute({ category: 'carriers', value: item });
                    break;
                case STORAGE_KEYS.CURRENCIES:
                    res = await ApiService.addAttribute({ category: 'currencies', value: item });
                    break;
                case STORAGE_KEYS.USERS:
                    // Map frontend 'role' to backend 'roleId'
                    const userToSync = { ...item };
                    if (userToSync.role && !userToSync.roleId) {
                        userToSync.roleId = userToSync.role;
                    }
                    res = await ApiService.createUser(userToSync);
                    break;
                case STORAGE_KEYS.PURCHASE_ORDERS:
                    await ApiService.createPurchaseOrder(item);
                    break;
                case STORAGE_KEYS.ROLES:
                    res = await ApiService.createRole(item);
                    break;
                case STORAGE_KEYS.CATEGORIES:
                    res = await ApiService.addAttribute({ category: 'categories', value: item });
                    break;
                case STORAGE_KEYS.SUPPLIERS:
                    await ApiService.createSupplier(item);
                    break;
                case STORAGE_KEYS.VOYAGES:
                    res = await ApiService.createVoyage(item);
                    if (res && res.success && res.data) {
                        const localVoyages = this.get(key);
                        if (localVoyages.length > 0 && localVoyages[0].name === item.name) {
                            localVoyages[0] = res.data;
                            localStorage.setItem(key, JSON.stringify(localVoyages));
                        }
                    }
                    break;
            }

            // Update raw attributes cache if an attribute was added
            if (res && res.success && res.data) {
                const raw = JSON.parse(localStorage.getItem('gtm_attributes_raw') || '[]');
                raw.push(res.data);
                localStorage.setItem('gtm_attributes_raw', JSON.stringify(raw));
            }
        } catch (e) {
            console.error(`Error adding ${key} to server:`, e);
            // Rollback local change if possible or at least notify the UI
            throw e;
        }
    },

    /**
     * Update item and sync with API
     */
    async update(key, id, item) {
        const data = this.get(key);
        const index = data.findIndex(i => (i.id === id || i === id));
        if (index !== -1) {
            data[index] = item;
            localStorage.setItem(key, JSON.stringify(data));
        }

        try {
            switch (key) {
                case STORAGE_KEYS.VEHICLES:
                    await ApiService.updateVehicle(id, item);
                    break;
                case STORAGE_KEYS.ORDERS:
                    await ApiService.updateOrder(id, item);
                    break;
                case STORAGE_KEYS.CLIENTS:
                    await ApiService.updateClient(id, item);
                    break;
                case STORAGE_KEYS.SHIPMENTS:
                    await ApiService.updateShipment(id, item);
                    break;
                case STORAGE_KEYS.CASH:
                    await ApiService.updateCashTransaction(id, item);
                    break;
                case STORAGE_KEYS.EXCHANGE_RATES:
                    await ApiService.updateExchangeRate(id, item);
                    break;
                case STORAGE_KEYS.USERS:
                    // Map frontend 'role' to backend 'roleId'
                    const userForUpdate = { ...item };
                    if (userForUpdate.role && !userForUpdate.roleId) {
                        userForUpdate.roleId = userForUpdate.role;
                    }
                    await ApiService.updateUser(id, userForUpdate);
                    break;
                case STORAGE_KEYS.BRANDS_RAW:
                    await ApiService.updateBrand(id, item);
                    break;
                case STORAGE_KEYS.SHOWROOMS_RAW:
                    await ApiService.updateShowroom(id, item);
                    break;
                case STORAGE_KEYS.PURCHASE_ORDERS:
                    await ApiService.updatePurchaseOrder(id, item);
                    break;
                case STORAGE_KEYS.SUPPLIERS:
                    await ApiService.updateSupplier(id, item);
                    break;
                case STORAGE_KEYS.VOYAGES:
                    await ApiService.updateVoyage(id, item);
                    break;
            }
        } catch (e) {
            console.error(`Error updating ${key} on server:`, e);
            throw e;
        }
    },

    /**
     * Delete item and sync with API
     */
    async delete(key, id) {
        let data = this.get(key);

        // Dynamic attributes are stored as simple strings, others as objects with id
        const isAttribute = [
            STORAGE_KEYS.BRANDS, STORAGE_KEYS.COLORS, STORAGE_KEYS.MOTORS,
            STORAGE_KEYS.SHOWROOMS, STORAGE_KEYS.CARRIERS, STORAGE_KEYS.CURRENCIES,
            STORAGE_KEYS.CATEGORIES
        ].includes(key);

        if (isAttribute) {
            data = data.filter(item => item !== id);
        } else {
            data = data.filter(item => item.id !== id);
        }

        localStorage.setItem(key, JSON.stringify(data));

        try {
            switch (key) {
                case STORAGE_KEYS.VEHICLES:
                    await ApiService.deleteVehicle(id);
                    break;
                case STORAGE_KEYS.ORDERS:
                    await ApiService.deleteOrder(id);
                    break;
                case STORAGE_KEYS.CLIENTS:
                    await ApiService.deleteClient(id);
                    break;
                case STORAGE_KEYS.SHIPMENTS:
                    await ApiService.deleteShipment(id);
                    break;
                case STORAGE_KEYS.CASH:
                    await ApiService.deleteCashTransaction(id);
                    break;
                case STORAGE_KEYS.EXCHANGE_RATES:
                    await ApiService.deleteExchangeRate(id);
                    break;
                case STORAGE_KEYS.BRANDS:
                    // Find actual ID if we are passing name
                    const brands = this.get(STORAGE_KEYS.BRANDS_RAW);
                    const brandObj = brands.find(b => b.name === id || b.id === id);
                    if (brandObj) await ApiService.deleteBrand(brandObj.id);
                    break;
                case STORAGE_KEYS.SHOWROOMS:
                    const showrooms = this.get(STORAGE_KEYS.SHOWROOMS_RAW);
                    const showObj = showrooms.find(s => s.name === id || s.id === id);
                    if (showObj) await ApiService.deleteShowroom(showObj.id);
                    break;
                case STORAGE_KEYS.CURRENCIES:
                case STORAGE_KEYS.CATEGORIES:
                    // Find the actual attribute ID from the cached raw data
                    const categoryMap = {
                        [STORAGE_KEYS.COLORS]: 'colors',
                        [STORAGE_KEYS.MOTORS]: 'motors',
                        [STORAGE_KEYS.CARRIERS]: 'carriers',
                        [STORAGE_KEYS.CURRENCIES]: 'currencies',
                        [STORAGE_KEYS.CATEGORIES]: 'categories'
                    };
                    const category = categoryMap[key];
                    const rawAttrs = JSON.parse(localStorage.getItem('gtm_attributes_raw') || '[]');
                    const attr = rawAttrs.find(a => a.category === category && a.value === id);
                    if (attr) {
                        await ApiService.deleteAttribute(attr.id);
                    }
                    break;
                case STORAGE_KEYS.USERS:
                    await ApiService.deleteUser(id);
                    break;
                case STORAGE_KEYS.BRANDS_RAW:
                    await ApiService.deleteBrand(id);
                    break;
                case STORAGE_KEYS.SHOWROOMS_RAW:
                    await ApiService.deleteShowroom(id);
                    break;
                case STORAGE_KEYS.ROLES:
                    await ApiService.deleteRole(id);
                    break;
                case STORAGE_KEYS.PURCHASE_ORDERS:
                    await ApiService.deletePurchaseOrder(id);
                    break;
                case STORAGE_KEYS.SUPPLIERS:
                    await ApiService.deleteSupplier(id);
                    break;
                case STORAGE_KEYS.VOYAGES:
                    await ApiService.deleteVoyage(id);
                    break;
            }
        } catch (e) {
            console.error(`Error deleting ${key} from server:`, e);
            throw e; // Re-throw to handle in UI
        }
    },

    /**
     * Pull all data from server to local storage using Bulk Sync
     */
    async syncAll() {
        console.log('🔄 Bulk Syncing data with server...');
        try {
            const response = await ApiService.syncAllBulk();
            if (response.success && response.data) {
                const data = response.data;

                // Simple mappings
                if (data.vehicles) localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(data.vehicles));
                if (data.orders) localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(data.orders));
                if (data.clients) localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(data.clients));
                if (data.shipments) localStorage.setItem(STORAGE_KEYS.SHIPMENTS, JSON.stringify(data.shipments));
                if (data.cashTransactions) localStorage.setItem(STORAGE_KEYS.CASH, JSON.stringify(data.cashTransactions));
                if (data.exchangeRates) localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATES, JSON.stringify(data.exchangeRates));
                if (data.users) localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(data.users));
                if (data.roles) localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(data.roles));
                if (data.purchaseOrders) localStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, JSON.stringify(data.purchaseOrders));
                if (data.suppliers) localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(data.suppliers));
                if (data.notifications) localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(data.notifications));
                if (data.voyages) localStorage.setItem(STORAGE_KEYS.VOYAGES, JSON.stringify(data.voyages));

                // Settings (don't overwrite with empty)
                if (data.settings && Object.keys(data.settings).length > 0) {
                    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
                }

                // Attributes processing
                if (data.attributes) {
                    localStorage.setItem('gtm_attributes_raw', JSON.stringify(data.attributes));
                    const cats = {
                        'colors': STORAGE_KEYS.COLORS,
                        'carriers': STORAGE_KEYS.CARRIERS,
                        'motors': STORAGE_KEYS.MOTORS,
                        'currencies': STORAGE_KEYS.CURRENCIES,
                        'categories': STORAGE_KEYS.CATEGORIES
                    };

                    // Reset lists items
                    Object.values(cats).forEach(key => localStorage.setItem(key, JSON.stringify([])));

                    data.attributes.forEach(attr => {
                        const key = cats[attr.category];
                        if (key) {
                            const list = JSON.parse(localStorage.getItem(key) || '[]');
                            list.push(attr.value);
                            localStorage.setItem(key, JSON.stringify(list));
                        }
                    });
                }

                // Brands & Models
                if (data.brands) {
                    localStorage.setItem(STORAGE_KEYS.BRANDS_RAW, JSON.stringify(data.brands));
                    localStorage.setItem(STORAGE_KEYS.BRANDS, JSON.stringify(data.brands.map(b => b.name)));

                    const modelMap = {};
                    data.brands.forEach(b => {
                        modelMap[b.name] = (b.models || []).map(m => m.name);
                    });
                    localStorage.setItem(STORAGE_KEYS.BRAND_MODELS, JSON.stringify(modelMap));
                }

                // Showrooms
                if (data.showrooms) {
                    localStorage.setItem(STORAGE_KEYS.SHOWROOMS_RAW, JSON.stringify(data.showrooms));
                    localStorage.setItem(STORAGE_KEYS.SHOWROOMS, JSON.stringify(data.showrooms.map(s => s.name)));
                }

                console.log('✅ Bulk Sync process finished successfully');
                return true;
            }
        } catch (e) {
            console.error('❌ Bulk sync failure:', e);
            throw e; // Rethrow to allow app.js to show error toast
        }
        return false;
    },

    /**
     * Clear all application data from local storage (Force refresh)
     */
    clearAllCache() {
        console.warn('🧹 Clearing all local cache...');
        Object.values(STORAGE_KEYS).forEach(key => {
            // We keep CURRENT_USER to avoid forced logout immediately, 
            // unless the user really wants to wipe everything
            if (key !== STORAGE_KEYS.CURRENT_USER) {
                localStorage.removeItem(key);
            }
        });
        // Also clear internal/raw keys
        localStorage.removeItem('gtm_attributes_raw');
        localStorage.removeItem('gtm_showrooms_raw');
        localStorage.removeItem('gtm_brands_raw');
    },

    /**
     * Initial detection and setup
     */
    init() {
        // We keep the old init logic for fallback or if we're offline
        // but the main way now is syncAll()
        const existingData = localStorage.getItem(STORAGE_KEYS.VEHICLES);
        if (!existingData) {
            console.log('Initial setup - will sync from server');
        }
    }
};

// Initial sync is now managed by app.js after session check or login
// StorageService.syncAll();
