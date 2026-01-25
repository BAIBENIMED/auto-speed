/**
 * Script de synchronisation forcée à exécuter dans la console du navigateur
 * Ouvrez l'application (http://localhost:5000), puis ouvrez la console (F12)
 * et collez ce script complet
 */

(async function forceSyncData() {
    const API_BASE = 'http://localhost:5000/api';

    console.log('%c🔄 SYNCHRONISATION FORCÉE DES DONNÉES', 'font-size: 20px; font-weight: bold; color: #667eea;');
    console.log('═══════════════════════════════════════════════════════════');

    try {
        // Step 1: Login
        console.log('\n1️⃣ Connexion au serveur...');
        const loginResponse = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'admin',
                password: 'admin123'
            })
        });

        const loginData = await loginResponse.json();

        if (!loginData.success) {
            console.error('❌ Échec de connexion:', loginData.message);
            return;
        }

        console.log(`✅ Connecté en tant que: ${loginData.user.name}`);
        console.log(`   Rôle: ${loginData.user.role}`);

        const token = loginData.token;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        // Step 2: Fetch all data
        console.log('\n2️⃣ Récupération des données depuis le serveur...');

        const endpoints = [
            { key: 'gtm_roles', url: '/roles', name: 'Rôles' },
            { key: 'gtm_users', url: '/users', name: 'Utilisateurs' },
            { key: 'gtm_clients', url: '/clients', name: 'Clients' },
            { key: 'gtm_orders', url: '/orders', name: 'Commandes' },
            { key: 'gtm_vehicles', url: '/vehicles', name: 'Véhicules' },
            { key: 'gtm_shipments', url: '/shipments', name: 'Expéditions' },
            { key: 'gtm_brands_raw', url: '/brands', name: 'Marques' },
            { key: 'gtm_showrooms_raw', url: '/showrooms', name: 'Showrooms' },
            { key: 'gtm_settings', url: '/settings', name: 'Paramètres' },
            { key: 'gtm_exchange_rates', url: '/exchange-rates', name: 'Taux de change' },
            { key: 'gtm_cash', url: '/cash', name: 'Transactions' }
        ];

        let totalItems = 0;

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(`${API_BASE}${endpoint.url}`, { headers });
                const data = await response.json();

                if (data.success) {
                    localStorage.setItem(endpoint.key, JSON.stringify(data.data));
                    const count = Array.isArray(data.data) ? data.data.length : 1;
                    totalItems += count;
                    console.log(`   ✅ ${endpoint.name}: ${count} élément(s)`);
                } else {
                    console.warn(`   ⚠️ ${endpoint.name}: ${data.message}`);
                }
            } catch (error) {
                console.error(`   ❌ ${endpoint.name}:`, error.message);
            }
        }

        // Step 3: Process derived data
        console.log('\n3️⃣ Traitement des données dérivées...');

        // Process brands
        const brandsRaw = JSON.parse(localStorage.getItem('gtm_brands_raw') || '[]');
        const brandNames = brandsRaw.map(b => b.name);
        localStorage.setItem('gtm_brands', JSON.stringify(brandNames));
        console.log(`   ✅ Marques simplifiées: ${brandNames.length}`);

        // Process brand models
        const brandModels = {};
        brandsRaw.forEach(b => {
            brandModels[b.name] = b.models ? b.models.map(m => m.name) : [];
        });
        localStorage.setItem('gtm_brand_models', JSON.stringify(brandModels));
        console.log(`   ✅ Modèles de marques traités`);

        // Process showrooms
        const showroomsRaw = JSON.parse(localStorage.getItem('gtm_showrooms_raw') || '[]');
        const showroomNames = showroomsRaw.map(s => s.name);
        localStorage.setItem('gtm_showrooms', JSON.stringify(showroomNames));
        console.log(`   ✅ Showrooms simplifiés: ${showroomNames.length}`);

        // Process attributes (if available)
        try {
            const attrResponse = await fetch(`${API_BASE}/settings/attributes`, { headers });
            const attrData = await attrResponse.json();

            if (attrData.success) {
                localStorage.setItem('gtm_attributes_raw', JSON.stringify(attrData.data));

                const cats = {
                    'colors': 'gtm_colors',
                    'carriers': 'gtm_carriers',
                    'motors': 'gtm_motors',
                    'currencies': 'gtm_currencies'
                };

                Object.values(cats).forEach(key => localStorage.setItem(key, JSON.stringify([])));

                attrData.data.forEach(attr => {
                    const key = cats[attr.category];
                    if (key) {
                        const list = JSON.parse(localStorage.getItem(key) || '[]');
                        list.push(attr.value);
                        localStorage.setItem(key, JSON.stringify(list));
                    }
                });

                console.log(`   ✅ Attributs dynamiques traités`);
            }
        } catch (error) {
            console.warn('   ⚠️ Attributs dynamiques non disponibles');
        }

        // Save user session
        const sessionUser = {
            id: loginData.user.id,
            username: loginData.user.username,
            name: loginData.user.name,
            role: loginData.user.role,
            clientId: loginData.user.clientId,
            token: loginData.token
        };
        localStorage.setItem('gtm_current_user', JSON.stringify(sessionUser));
        console.log(`   ✅ Session utilisateur sauvegardée`);

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('%c✅ SYNCHRONISATION TERMINÉE !', 'font-size: 18px; font-weight: bold; color: #10b981;');
        console.log(`%c📊 Total: ${totalItems} éléments synchronisés`, 'font-size: 14px; color: #3b82f6;');
        console.log('═══════════════════════════════════════════════════════════');

        console.log('\n🔄 Rechargement de la page dans 2 secondes...');

        setTimeout(() => {
            location.reload();
        }, 2000);

    } catch (error) {
        console.error('\n❌ ERREUR:', error);
        console.log('\n⚠️ Vérifiez que le serveur est démarré sur le port 5000');
        console.log('   Commande: cd server && node server.js');
    }
})();
