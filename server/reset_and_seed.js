const { Client, User, Order, Vehicle, Shipment, CashTransaction, ExchangeRate, Role, Settings, DynamicAttribute } = require('./src/models');
const sequelize = require('./src/config/database');
const bcrypt = require('bcrypt');

async function resetAndSeed() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connexion établie\n');

        // Désactiver les contraintes de clés étrangères temporairement
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

        // Vider toutes les tables
        console.log('🗑️  Suppression des données existantes...');
        await CashTransaction.destroy({ where: {}, force: true });
        await Vehicle.destroy({ where: {}, force: true });
        await Shipment.destroy({ where: {}, force: true });
        await Order.destroy({ where: {}, force: true });
        await User.destroy({ where: {}, force: true });
        await Client.destroy({ where: {}, force: true });
        await ExchangeRate.destroy({ where: {}, force: true });
        await Settings.destroy({ where: {}, force: true });
        await Role.destroy({ where: {}, force: true });
        await DynamicAttribute.destroy({ where: {}, force: true });
        console.log('✅ Toutes les tables vidées\n');

        // Réactiver les contraintes
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

        // 0. Créer les paramètres et attributs par défaut
        console.log('⚙️  Création des paramètres par défaut...');
        await Settings.create({
            companyName: 'AUTO SPEED',
            purchaseCurrency: 'EUR',
            sellingCurrency: 'EUR',
            theme: 'dark'
        });

        console.log('🎨 Création des attributs dynamiques...');
        await DynamicAttribute.bulkCreate([
            // Marques et modèles
            { id: 'brand_audi', category: 'brands', value: 'Audi', metadata: { models: ['A1', 'A3', 'A4', 'A5', 'A6', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron'] }, sortOrder: 1 },
            { id: 'brand_bmw', category: 'brands', value: 'BMW', metadata: { models: ['Serie 1', 'Serie 2', 'Serie 3', 'Serie 4', 'Serie 5', 'X1', 'X3', 'X5', 'X6', 'i4'] }, sortOrder: 2 },
            { id: 'brand_mercedes', category: 'brands', value: 'Mercedes-Benz', metadata: { models: ['Classe A', 'Classe C', 'Classe E', 'Classe S', 'GLA', 'GLC', 'GLE', 'EQS'] }, sortOrder: 3 },
            { id: 'brand_porsche', category: 'brands', value: 'Porsche', metadata: { models: ['911', 'Cayenne', 'Macan', 'Panamera', 'Taycan'] }, sortOrder: 4 },
            { id: 'brand_tesla', category: 'brands', value: 'Tesla', metadata: { models: ['Model 3', 'Model S', 'Model X', 'Model Y'] }, sortOrder: 5 },
            { id: 'brand_vw', category: 'brands', value: 'Volkswagen', metadata: { models: ['Golf', 'Polo', 'Tiguan', 'Passat', 'ID.3', 'ID.4'] }, sortOrder: 6 },
            { id: 'brand_landrover', category: 'brands', value: 'Range Rover', metadata: { models: ['Evoque', 'Sport', 'Vogue', 'Velar'] }, sortOrder: 7 },
            { id: 'brand_toyota', category: 'brands', value: 'Toyota', metadata: { models: ['Corolla', 'Camry', 'RAV4', 'Land Cruiser', 'Hilux'] }, sortOrder: 8 },
            { id: 'brand_hyundai', category: 'brands', value: 'Hyundai', metadata: { models: ['i20', 'i30', 'Tucson', 'Santa Fe', 'Ioniq 5'] }, sortOrder: 9 },
            { id: 'brand_kia', category: 'brands', value: 'Kia', metadata: { models: ['Rio', 'Ceed', 'Sportage', 'Sorento', 'EV6'] }, sortOrder: 10 },

            // Couleurs
            { id: 'color_black', category: 'colors', value: 'Noir', sortOrder: 1 },
            { id: 'color_white', category: 'colors', value: 'Blanc', sortOrder: 2 },
            { id: 'color_grey', category: 'colors', value: 'Gris', sortOrder: 3 },
            { id: 'color_blue', category: 'colors', value: 'Bleu', sortOrder: 4 },
            { id: 'color_red', category: 'colors', value: 'Rouge', sortOrder: 5 },
            { id: 'color_silver', category: 'colors', value: 'Argent', sortOrder: 6 },
            { id: 'color_green', category: 'colors', value: 'Vert', sortOrder: 7 },

            // Showrooms
            { id: 'showroom_centre', category: 'showrooms', value: 'CENTRE', sortOrder: 1 },
            { id: 'showroom_est', category: 'showrooms', value: 'EST', sortOrder: 2 },

            // Transporteurs
            { id: 'carrier_maersk', category: 'carriers', value: 'Maersk', sortOrder: 1 },
            { id: 'carrier_cma', category: 'carriers', value: 'CMA CGM', sortOrder: 2 },
            { id: 'carrier_hapag', category: 'carriers', value: 'Hapag-Lloyd', sortOrder: 3 },
            { id: 'carrier_msc', category: 'carriers', value: 'MSC', sortOrder: 4 },
            { id: 'carrier_cosco', category: 'carriers', value: 'COSCO', sortOrder: 5 },

            // Devises
            { id: 'curr_eur', category: 'currencies', value: 'EUR', sortOrder: 1 },
            { id: 'curr_usd', category: 'currencies', value: 'USD', sortOrder: 2 },
            { id: 'curr_xaf', category: 'currencies', value: 'XAF', sortOrder: 3 },
            { id: 'curr_gbp', category: 'currencies', value: 'GBP', sortOrder: 4 },

            // Motorisations
            { id: 'motor_diesel', category: 'motors', value: 'Diesel', sortOrder: 1 },
            { id: 'motor_essence', category: 'motors', value: 'Essence', sortOrder: 2 },
            { id: 'motor_hybrid', category: 'motors', value: 'Hybride', sortOrder: 3 },
            { id: 'motor_electric', category: 'motors', value: 'Électrique', sortOrder: 4 }
        ]);

        // 0.5. Créer les rôles
        console.log('🛡️ Création des rôles...');
        await Role.bulkCreate([
            { id: 'admin', name: 'Administrateur', permissions: ['all'] },
            { id: 'manager', name: 'Manager', permissions: ['dashboard', 'clients', 'orders', 'vehicles', 'tracking', 'shipments', 'cash', 'verification'] },
            { id: 'user', name: 'Utilisateur', permissions: ['dashboard', 'clients', 'orders', 'vehicles', 'tracking'] },
            { id: 'commercial', name: 'Commercial', permissions: ['dashboard', 'clients', 'orders'] }
        ]);

        // 1. Créer des clients (10 clients)
        console.log('📋 Création des clients...');
        const clients = await Client.bulkCreate([
            { id: 'C001', firstName: 'Jean', lastName: 'Dupont', email: 'jean.dupont@email.com', phone: '+33612345678', company: 'Auto Import France', address: '123 Rue de Paris, 75001 Paris', passportNumber: 'FR123456', showroom: 'CENTRE', reference: 'CLI-001' },
            { id: 'C002', firstName: 'Marie', lastName: 'Martin', email: 'marie.martin@email.com', phone: '+33698765432', company: 'Garage Martin & Fils', address: '45 Avenue des Champs, 69000 Lyon', passportNumber: 'FR789012', showroom: 'EST', reference: 'CLI-002' },
            { id: 'C003', firstName: 'Ahmed', lastName: 'Benali', email: 'ahmed.benali@email.com', phone: '+33687654321', company: 'Benali Motors', address: '78 Boulevard du Commerce, 13000 Marseille', passportNumber: 'FR345678', showroom: 'CENTRE', reference: 'CLI-003' },
            { id: 'C004', firstName: 'Sophie', lastName: 'Leroy', email: 'sophie.leroy@email.com', phone: '+33623456789', company: 'Leroy Automobiles', address: '56 Rue de la République, 33000 Bordeaux', passportNumber: 'FR456789', showroom: 'EST', reference: 'CLI-004' },
            { id: 'C005', firstName: 'Pierre', lastName: 'Moreau', email: 'pierre.moreau@email.com', phone: '+33634567890', company: 'Moreau Auto Trading', address: '89 Boulevard Haussmann, 75008 Paris', passportNumber: 'FR567890', showroom: 'CENTRE', reference: 'CLI-005' },
            { id: 'C006', firstName: 'Lucie', lastName: 'Bernard', email: 'lucie.bernard@email.com', phone: '+33645678901', company: 'Bernard Cars', address: '12 Rue de la liberté, 59000 Lille', passportNumber: 'FR678901', showroom: 'EST', reference: 'CLI-006' },
            { id: 'C007', firstName: 'Thomas', lastName: 'Dubois', email: 'thomas.dubois@email.com', phone: '+33656789012', company: 'Dubois & Co', address: '34 Avenue Jean Jaurès, 67000 Strasbourg', passportNumber: 'FR789012', showroom: 'CENTRE', reference: 'CLI-007' },
            { id: 'C008', firstName: 'Emma', lastName: 'Petit', email: 'emma.petit@email.com', phone: '+33667890123', company: 'Petit Auto', address: '56 Rue Victor Hugo, 31000 Toulouse', passportNumber: 'FR890123', showroom: 'EST', reference: 'CLI-008' },
            { id: 'C009', firstName: 'Nicolas', lastName: 'Roux', email: 'nicolas.roux@email.com', phone: '+33678901234', company: 'Roux Imports', address: '78 Rue de la Gare, 44000 Nantes', passportNumber: 'FR901234', showroom: 'CENTRE', reference: 'CLI-009' },
            { id: 'C010', firstName: 'Camille', lastName: 'Fournier', email: 'camille.fournier@email.com', phone: '+33689012345', company: 'Fournier Prestige', address: '90 Avenue Foch, 06000 Nice', passportNumber: 'FR012345', showroom: 'EST', reference: 'CLI-010' }
        ]);
        console.log(`✅ ${clients.length} clients créés`);

        // 2. Créer des utilisateurs pour les clients
        console.log('\n👥 Création des utilisateurs...');
        const hashedPassword = await bcrypt.hash('password123', 10);
        const adminPassword = await bcrypt.hash('admin123', 10);
        const users = await User.bulkCreate([
            { id: 'U_ADMIN', username: 'admin', password: adminPassword, name: 'Administrateur', roleId: 'admin', clientId: null },
            { id: 'U001', username: 'jean.dupont', password: hashedPassword, name: 'Jean Dupont', roleId: 'user', clientId: 'C001' },
            { id: 'U002', username: 'marie.martin', password: hashedPassword, name: 'Marie Martin', roleId: 'user', clientId: 'C002' },
            { id: 'U003', username: 'commercial1', password: hashedPassword, name: 'Sophie Commercial', roleId: 'commercial', clientId: null },
            { id: 'U004', username: 'ahmed.benali', password: hashedPassword, name: 'Ahmed Benali', roleId: 'user', clientId: 'C003' },
            { id: 'U005', username: 'sophie.leroy', password: hashedPassword, name: 'Sophie Leroy', roleId: 'user', clientId: 'C004' },
            { id: 'U006', username: 'pierre.moreau', password: hashedPassword, name: 'Pierre Moreau', roleId: 'user', clientId: 'C005' },
            { id: 'U007', username: 'lucie.bernard', password: hashedPassword, name: 'Lucie Bernard', roleId: 'user', clientId: 'C006' },
            { id: 'U008', username: 'thomas.dubois', password: hashedPassword, name: 'Thomas Dubois', roleId: 'user', clientId: 'C007' },
            { id: 'U009', username: 'emma.petit', password: hashedPassword, name: 'Emma Petit', roleId: 'user', clientId: 'C008' },
            { id: 'U010', username: 'nicolas.roux', password: hashedPassword, name: 'Nicolas Roux', roleId: 'user', clientId: 'C009' },
            { id: 'U011', username: 'camille.fournier', password: hashedPassword, name: 'Camille Fournier', roleId: 'user', clientId: 'C010' }
        ]);
        console.log(`✅ ${users.length} utilisateurs créés`);

        // 3. Créer des commandes (12 commandes)
        console.log('\n📦 Création des commandes...');
        const orders = await Order.bulkCreate([
            { id: 'ORD-001', clientId: 'C001', date: new Date('2024-01-15'), status: 'Processing', totalAmount: 45000.00, remarks: 'Commande urgente - Livraison prioritaire', isValidated: true, isArchived: false },
            { id: 'ORD-002', clientId: 'C002', date: new Date('2024-01-20'), status: 'Shipped', totalAmount: 78000.00, remarks: 'Client VIP - Suivi rapproché', isValidated: true, isArchived: false },
            { id: 'ORD-003', clientId: 'C003', date: new Date('2024-02-01'), status: 'Processing', totalAmount: 32000.00, remarks: 'Première commande client', isValidated: false, isArchived: false },
            { id: 'ORD-004', clientId: 'C001', date: new Date('2023-12-10'), status: 'Delivered', totalAmount: 55000.00, remarks: 'Commande livrée avec succès', isValidated: true, isArchived: true },
            { id: 'ORD-005', clientId: 'C004', date: new Date('2024-02-05'), status: 'Pending', totalAmount: 95000.00, remarks: 'Commande de luxe - 2 véhicules premium', isValidated: false, isArchived: false },
            { id: 'ORD-006', clientId: 'C005', date: new Date('2024-02-10'), status: 'Processing', totalAmount: 67000.00, remarks: 'Commande standard', isValidated: true, isArchived: false },
            { id: 'ORD-007', clientId: 'C006', date: new Date('2024-02-12'), status: 'Pending', totalAmount: 24000.00, remarks: 'Véhicule utilitaire léger', isValidated: false, isArchived: false },
            { id: 'ORD-008', clientId: 'C007', date: new Date('2024-02-15'), status: 'Shipped', totalAmount: 110000.00, remarks: 'Flotte entreprise (3 véhicules)', isValidated: true, isArchived: false },
            { id: 'ORD-009', clientId: 'C008', date: new Date('2024-02-18'), status: 'Processing', totalAmount: 39000.00, remarks: 'Financement leasing', isValidated: true, isArchived: false },
            { id: 'ORD-010', clientId: 'C009', date: new Date('2024-02-20'), status: 'Delivered', totalAmount: 28000.00, remarks: 'Livraison express', isValidated: true, isArchived: false },
            { id: 'ORD-011', clientId: 'C010', date: new Date('2024-02-22'), status: 'Pending', totalAmount: 56000.00, remarks: 'SUV familial', isValidated: false, isArchived: false },
            { id: 'ORD-012', clientId: 'C002', date: new Date('2024-02-25'), status: 'Processing', totalAmount: 82000.00, remarks: 'Renouvellement parc', isValidated: true, isArchived: false }
        ]);
        console.log(`✅ ${orders.length} commandes créées`);

        // 4. Créer des véhicules (15 véhicules)
        console.log('\n🚗 Création des véhicules...');
        const vehicles = await Vehicle.bulkCreate([
            { id: 'VEH-001', brand: 'Mercedes-Benz', model: 'Classe C', year: 2023, month: 'Janvier', supplier: 'Auto Import GmbH', mileage: 5000, chassisNumber: 'WDD2050071F123456', color: 'Noir', motorization: 'Diesel', trim: 'AMG Line', condition: 'Excellent', purchasePrice: 42000.00, purchaseCurrency: 'EUR', sellingPrice: 45000.00, sellingCurrency: 'EUR', estimatedCustomsDuty: 3000.00, orderId: 'ORD-001', remarks: 'Véhicule premium - État impeccable' },
            { id: 'VEH-002', brand: 'BMW', model: 'Serie 5', year: 2022, month: 'Mars', supplier: 'BMW Deutschland', mileage: 12000, chassisNumber: 'WBA5A5C50ED123789', color: 'Bleu', motorization: 'Essence', trim: 'M Sport', condition: 'Très bon', purchasePrice: 38000.00, purchaseCurrency: 'EUR', sellingPrice: 42000.00, sellingCurrency: 'EUR', estimatedCustomsDuty: 2800.00, orderId: 'ORD-002', remarks: 'Entretien complet effectué' },
            { id: 'VEH-003', brand: 'Audi', model: 'A4', year: 2023, month: 'Juin', supplier: 'Audi AG', mileage: 8000, chassisNumber: 'WAUZZZ8K8DA123456', color: 'Gris', motorization: 'Essence', trim: 'S-Line', condition: 'Excellent', purchasePrice: 35000.00, purchaseCurrency: 'EUR', sellingPrice: 38000.00, sellingCurrency: 'EUR', estimatedCustomsDuty: 2500.00, orderId: 'ORD-002', remarks: 'Pack technologie inclus' },
            { id: 'VEH-004', brand: 'Volkswagen', model: 'Golf', year: 2023, month: 'Février', supplier: 'VW Import', mileage: 3000, chassisNumber: 'WVWZZZ1KZEW123456', color: 'Rouge', motorization: 'Essence', trim: 'GTI Performance', condition: 'Neuf', purchasePrice: 28000.00, purchaseCurrency: 'EUR', sellingPrice: 32000.00, sellingCurrency: 'EUR', estimatedCustomsDuty: 2200.00, orderId: 'ORD-003', remarks: 'Garantie constructeur 2 ans' },
            { id: 'VEH-005', brand: 'Porsche', model: 'Cayenne', year: 2022, month: 'Septembre', supplier: 'Porsche Center', mileage: 15000, chassisNumber: 'WP1ZZZ92ZKDA123456', color: 'Blanc', motorization: 'Essence', trim: 'S', condition: 'Excellent', purchasePrice: 52000.00, purchaseCurrency: 'EUR', sellingPrice: 55000.00, sellingCurrency: 'EUR', estimatedCustomsDuty: 4000.00, orderId: 'ORD-004', remarks: 'Options premium - Toit panoramique' },
            { id: 'VEH-006', brand: 'Range Rover', model: 'Sport', year: 2023, month: 'Avril', supplier: 'Land Rover UK', mileage: 6000, chassisNumber: 'SALWA2RK5LA123456', color: 'Gris', motorization: 'Diesel', trim: 'HSE Dynamic', condition: 'Excellent', purchasePrice: 72000.00, purchaseCurrency: 'GBP', sellingPrice: 85000.00, sellingCurrency: 'EUR', estimatedCustomsDuty: 6000.00, orderId: 'ORD-005', remarks: 'Pack luxe complet' },
            { id: 'VEH-007', brand: 'Tesla', model: 'Model S', year: 2023, month: 'Mai', supplier: 'Tesla Europe', mileage: 2000, chassisNumber: '5YJSA1E26KF123456', color: 'Blanc', motorization: 'Électrique', trim: 'Long Range', condition: 'Neuf', purchasePrice: 68000.00, purchaseCurrency: 'EUR', sellingPrice: 75000.00, sellingCurrency: 'EUR', estimatedCustomsDuty: 0.00, orderId: 'ORD-005', remarks: 'Véhicule électrique - Autopilot inclus' },
            { id: 'VEH-008', brand: 'Audi', model: 'Q7', year: 2022, month: 'Octobre', supplier: 'Audi AG', mileage: 18000, chassisNumber: 'WAUZZZ4M8DD123456', color: 'Noir', motorization: 'Diesel', trim: 'S-Line', condition: 'Très bon', purchasePrice: 58000.00, purchaseCurrency: 'EUR', sellingPrice: 62000.00, sellingCurrency: 'EUR', estimatedCustomsDuty: 4200.00, orderId: 'ORD-006', remarks: '7 places - Parfait état' },
            { id: 'VEH-009', brand: 'Toyota', model: 'Hilux', year: 2023, month: 'Juillet', supplier: 'Toyota Japan', mileage: 100, chassisNumber: 'JTEBU25J900012345', color: 'Blanc', motorization: 'Diesel', trim: 'Invincible', condition: 'Neuf', purchasePrice: 32000.00, purchaseCurrency: 'USD', sellingPrice: 24000.00, sellingCurrency: 'EUR', estimatedCustomsDuty: 5000.00, orderId: 'ORD-007', remarks: 'Véhicule utilitaire robuste' },
            { id: 'VEH-010', brand: 'Renault', model: 'Clio', year: 2021, month: 'Novembre', supplier: 'Renault Occasion', mileage: 45000, chassisNumber: 'VF1RJA00165432109', color: 'Bleu', motorization: 'Essence', trim: 'Intens', condition: 'Bon', purchasePrice: 9000.00, purchaseCurrency: 'EUR', sellingPrice: 12000.00, sellingCurrency: 'EUR', estimatedCustomsDuty: 800.00, orderId: 'ORD-008', remarks: 'Flotte 1/3' },
            { id: 'VEH-011', brand: 'Renault', model: 'Clio', year: 2021, month: 'Novembre', supplier: 'Renault Occasion', mileage: 42000, chassisNumber: 'VF1RJA00165432110', color: 'Gris', motorization: 'Essence', trim: 'Intens', condition: 'Bon', purchasePrice: 9200.00, purchaseCurrency: 'EUR', sellingPrice: 12000.00, sellingCurrency: 'EUR', estimatedCustomsDuty: 800.00, orderId: 'ORD-008', remarks: 'Flotte 2/3' },
            { id: 'VEH-012', brand: 'Peugeot', model: '208', year: 2022, month: 'Janvier', supplier: 'Peugeot Pro', mileage: 25000, chassisNumber: 'VF3UP567890123456', color: 'Blanc', motorization: 'Diesel', trim: 'Allure', condition: 'Très bon', purchasePrice: 14000.00, purchaseCurrency: 'EUR', sellingPrice: 18000.00, sellingCurrency: 'EUR', estimatedCustomsDuty: 1000.00, orderId: 'ORD-008', remarks: 'Flotte 3/3' },
            { id: 'VEH-013', brand: 'BMW', model: 'X5', year: 2023, month: 'Août', supplier: 'BMW Munich', mileage: 4000, chassisNumber: '5UXCR6C05L9876543', color: 'Noir', motorization: 'Hybride', trim: 'M Sport', condition: 'Excellent', purchasePrice: 65000.00, purchaseCurrency: 'EUR', sellingPrice: 75000.00, sellingCurrency: 'EUR', estimatedCustomsDuty: 0.00, orderId: 'ORD-009', remarks: 'Hybride rechargeable' },
            { id: 'VEH-014', brand: 'Mercedes-Benz', model: 'Classe A', year: 2020, month: 'Décembre', supplier: 'Occasion Plus', mileage: 60000, chassisNumber: 'WDD1771121N123456', color: 'Argent', motorization: 'Diesel', trim: 'Progressive', condition: 'Moyen', purchasePrice: 18000.00, purchaseCurrency: 'EUR', sellingPrice: 22000.00, sellingCurrency: 'EUR', estimatedCustomsDuty: 1500.00, orderId: 'ORD-010', remarks: 'Quelques rayures pare-choc' },
            { id: 'VEH-015', brand: 'Kia', model: 'Sportage', year: 2023, month: 'Septembre', supplier: 'Kia Korea', mileage: 1000, chassisNumber: 'KNAH81LM3P5123456', color: 'Vert', motorization: 'Hybride', trim: 'GT Line', condition: 'Neuf', purchasePrice: 30000.00, purchaseCurrency: 'USD', sellingPrice: 36000.00, sellingCurrency: 'EUR', estimatedCustomsDuty: 3000.00, orderId: 'ORD-011', remarks: 'Modèle de démonstration' }
        ]);
        console.log(`✅ ${vehicles.length} véhicules créés`);

        // 5. Créer des expéditions (5 expéditions)
        console.log('\n🚢 Création des expéditions...');
        const shipments = await Shipment.bulkCreate([
            { id: 'SHIP-001', containerNumber: 'MSCU1234567', blNumber: 'BL-2024-001', carrier: 'Maersk', forwarder: 'DHL Global Forwarding', loadingPort: 'Hamburg', destination: 'Le Havre', etd: new Date('2024-01-25'), eta: new Date('2024-02-05'), arrivalDate: new Date('2024-02-06'), docReceptionDate: new Date('2024-02-08'), status: 'In Transit', trackingNumber: 'MAEU123456789' },
            { id: 'SHIP-002', containerNumber: 'CMAU9876543', blNumber: 'BL-2024-002', carrier: 'CMA CGM', forwarder: 'Kuehne + Nagel', loadingPort: 'Bremerhaven', destination: 'Marseille', etd: new Date('2024-02-10'), eta: new Date('2024-02-20'), status: 'Pending', trackingNumber: 'CMAU987654321' },
            { id: 'SHIP-003', containerNumber: 'HLCU5555555', blNumber: 'BL-2024-003', carrier: 'Hapag-Lloyd', forwarder: 'DB Schenker', loadingPort: 'Rotterdam', destination: 'Le Havre', etd: new Date('2024-02-15'), eta: new Date('2024-02-25'), status: 'Pending', trackingNumber: 'HLCU555555555' },
            { id: 'SHIP-004', containerNumber: 'MSCU9988776', blNumber: 'BL-2024-004', carrier: 'MSC', forwarder: 'Bolloré Logistics', loadingPort: 'Antwerp', destination: 'Dunkerque', etd: new Date('2024-02-20'), eta: new Date('2024-03-01'), status: 'In Transit', trackingNumber: 'MSCU123123123' },
            { id: 'SHIP-005', containerNumber: 'COSU1122334', blNumber: 'BL-2024-005', carrier: 'COSCO', forwarder: 'Geodis', loadingPort: 'Shanghai', destination: 'Le Havre', etd: new Date('2024-01-05'), eta: new Date('2024-02-15'), status: 'Customs Clearance', trackingNumber: 'COSU456456456' }
        ]);
        console.log(`✅ ${shipments.length} expéditions créées`);

        // Lier les véhicules aux expéditions
        await Vehicle.update({ shipmentId: 'SHIP-001' }, { where: { id: 'VEH-001' } });
        await Vehicle.update({ shipmentId: 'SHIP-002' }, { where: { id: ['VEH-002', 'VEH-003'] } });
        await Vehicle.update({ shipmentId: 'SHIP-003' }, { where: { id: ['VEH-006', 'VEH-007'] } });
        await Vehicle.update({ shipmentId: 'SHIP-004' }, { where: { id: ['VEH-010', 'VEH-011', 'VEH-012'] } }); // Flotte
        await Vehicle.update({ shipmentId: 'SHIP-005' }, { where: { id: 'VEH-015' } }); // Kia de Corée/Chine

        // 6. Créer des transactions de caisse (15 transactions)
        console.log('\n💰 Création des transactions de caisse...');
        const cashTransactions = await CashTransaction.bulkCreate([
            { id: 'CASH-001', orderId: 'ORD-001', clientName: 'Jean Dupont', showroom: 'CENTRE', amount: 15000.00, currency: 'EUR', date: new Date('2024-01-16'), paymentMethod: 'Virement bancaire', description: 'Acompte 30% commande ORD-001', type: 'In' },
            { id: 'CASH-002', orderId: 'ORD-002', clientName: 'Marie Martin', showroom: 'EST', amount: 78000.00, currency: 'EUR', date: new Date('2024-01-22'), paymentMethod: 'Chèque', description: 'Paiement intégral commande ORD-002', type: 'In' },
            { id: 'CASH-003', orderId: 'ORD-001', clientName: 'Fournisseur Auto Import', showroom: 'CENTRE', amount: 42000.00, currency: 'EUR', date: new Date('2024-01-18'), paymentMethod: 'Virement SWIFT', description: 'Paiement fournisseur véhicule VEH-001', type: 'Out' },
            { id: 'CASH-004', orderId: 'ORD-003', clientName: 'Ahmed Benali', showroom: 'CENTRE', amount: 10000.00, currency: 'EUR', date: new Date('2024-02-02'), paymentMethod: 'Espèces', description: 'Acompte initial commande ORD-003', type: 'In' },
            { id: 'CASH-005', orderId: 'ORD-004', clientName: 'Jean Dupont', showroom: 'CENTRE', amount: 55000.00, currency: 'EUR', date: new Date('2023-12-15'), paymentMethod: 'Virement bancaire', description: 'Paiement final commande ORD-004', type: 'In' },
            { id: 'CASH-006', orderId: 'ORD-002', clientName: 'Fournisseur BMW', showroom: 'EST', amount: 38000.00, currency: 'EUR', date: new Date('2024-01-19'), paymentMethod: 'Virement SWIFT', description: 'Paiement fournisseur véhicule VEH-002', type: 'Out' },
            { id: 'CASH-007', orderId: 'ORD-005', clientName: 'Sophie Leroy', showroom: 'EST', amount: 50000.00, currency: 'EUR', date: new Date('2024-02-06'), paymentMethod: 'Virement bancaire', description: 'Acompte 50% commande ORD-005', type: 'In' },
            { id: 'CASH-008', orderId: 'ORD-006', clientName: 'Pierre Moreau', showroom: 'CENTRE', amount: 67000.00, currency: 'EUR', date: new Date('2024-02-10'), paymentMethod: 'Virement bancaire', description: 'Paiement intégral ORD-006', type: 'In' },
            { id: 'CASH-009', orderId: 'ORD-006', clientName: 'Audi AG', showroom: 'CENTRE', amount: 58000.00, currency: 'EUR', date: new Date('2024-02-12'), paymentMethod: 'Virement SWIFT', description: 'Paiement fournisseur véhicule VEH-008', type: 'Out' },
            { id: 'CASH-010', orderId: 'ORD-007', clientName: 'Lucie Bernard', showroom: 'EST', amount: 5000.00, currency: 'EUR', date: new Date('2024-02-13'), paymentMethod: 'Carte Bancaire', description: 'Réservation ORD-007', type: 'In' },
            { id: 'CASH-011', orderId: 'ORD-008', clientName: 'Thomas Dubois', showroom: 'CENTRE', amount: 110000.00, currency: 'EUR', date: new Date('2024-02-15'), paymentMethod: 'Virement bancaire', description: 'Paiement flotte ORD-008', type: 'In' },
            { id: 'CASH-012', orderId: 'ORD-008', clientName: 'Renault Occasion', showroom: 'CENTRE', amount: 32200.00, currency: 'EUR', date: new Date('2024-02-16'), paymentMethod: 'Virement SWIFT', description: 'Achat véhicules flotte', type: 'Out' },
            { id: 'CASH-013', orderId: 'ORD-009', clientName: 'Emma Petit', showroom: 'EST', amount: 15000.00, currency: 'EUR', date: new Date('2024-02-18'), paymentMethod: 'Virement bancaire', description: 'Acompte leasing ORD-009', type: 'In' },
            { id: 'CASH-014', orderId: 'ORD-010', clientName: 'Nicolas Roux', showroom: 'CENTRE', amount: 28000.00, currency: 'EUR', date: new Date('2024-02-20'), paymentMethod: 'Espèces', description: 'Paiement solde ORD-010', type: 'In' },
            { id: 'CASH-015', orderId: 'ORD-012', clientName: 'Marie Martin', showroom: 'EST', amount: 20000.00, currency: 'EUR', date: new Date('2024-02-25'), paymentMethod: 'Virement bancaire', description: 'Acompte renouvellement parc', type: 'In' }

        ]);
        console.log(`✅ ${cashTransactions.length} transactions créées`);

        // 7. Créer des taux de change
        console.log('\n💱 Création des taux de change...');
        const exchangeRates = await ExchangeRate.bulkCreate([
            { id: 'EXR-001', fromCurrency: 'EUR', toCurrency: 'XAF', rate: 655.957, date: new Date('2024-01-15') },
            { id: 'EXR-002', fromCurrency: 'USD', toCurrency: 'EUR', rate: 0.92, date: new Date('2024-01-15') },
            { id: 'EXR-003', fromCurrency: 'GBP', toCurrency: 'EUR', rate: 1.15, date: new Date('2024-01-15') },
            { id: 'EXR-004', fromCurrency: 'EUR', toCurrency: 'USD', rate: 1.09, date: new Date('2024-02-01') },
            { id: 'EXR-005', fromCurrency: 'EUR', toCurrency: 'XAF', rate: 658.123, date: new Date('2024-02-01') }
        ]);
        console.log(`✅ ${exchangeRates.length} taux de change créés`);

        console.log('\n✅ ========================================');
        console.log('✅ BASE DE DONNÉES RÉINITIALISÉE ET REMPLIE !');
        console.log('✅ ========================================\n');

        console.log('📊 RÉSUMÉ :');
        console.log(`   - Paramètres par défaut créés`);
        console.log(`   - Attributs dynamiques créés`);
        console.log(`   - ${clients.length} clients`);
        console.log(`   - ${users.length} utilisateurs`);
        console.log(`   - ${orders.length} commandes`);
        console.log(`   - ${vehicles.length} véhicules`);
        console.log(`   - ${shipments.length} expéditions`);
        console.log(`   - ${cashTransactions.length} transactions de caisse`);
        console.log(`   - ${exchangeRates.length} taux de change`);

        console.log('\n🔐 COMPTES DE TEST :');
        console.log('   Admin:');
        console.log('     - Username: admin / admin123');
        console.log('   Clients (Echantillon):');
        console.log('     - Username: jean.dupont / password123');
        console.log('     - Username: marie.martin / password123');
        console.log('     - Username: lucie.bernard / password123');

        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    }
}

resetAndSeed();
