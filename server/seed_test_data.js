const { Client, User, Order, Vehicle, Shipment, CashTransaction, ExchangeRate } = require('./src/models');
const sequelize = require('./src/config/database');
const bcrypt = require('bcrypt');

async function createTestData() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connexion établie\n');

        // 1. Créer des clients
        console.log('📋 Création des clients...');
        const clients = await Client.bulkCreate([
            {
                id: 'C001',
                firstName: 'Jean',
                lastName: 'Dupont',
                email: 'jean.dupont@email.com',
                phone: '+33612345678',
                company: 'Auto Import France',
                address: '123 Rue de Paris, 75001 Paris',
                passportNumber: 'FR123456',
                showroom: 'CENTRE',
                reference: 'CLI-001'
            },
            {
                id: 'C002',
                firstName: 'Marie',
                lastName: 'Martin',
                email: 'marie.martin@email.com',
                phone: '+33698765432',
                company: 'Garage Martin & Fils',
                address: '45 Avenue des Champs, 69000 Lyon',
                passportNumber: 'FR789012',
                showroom: 'EST',
                reference: 'CLI-002'
            },
            {
                id: 'C003',
                firstName: 'Ahmed',
                lastName: 'Benali',
                email: 'ahmed.benali@email.com',
                phone: '+33687654321',
                company: 'Benali Motors',
                address: '78 Boulevard du Commerce, 13000 Marseille',
                passportNumber: 'FR345678',
                showroom: 'CENTRE',
                reference: 'CLI-003'
            }
        ]);
        console.log(`✅ ${clients.length} clients créés`);

        // 2. Créer des utilisateurs pour les clients
        console.log('\n👥 Création des utilisateurs...');
        const hashedPassword = await bcrypt.hash('password123', 10);
        const users = await User.bulkCreate([
            {
                id: 'U001',
                username: 'jean.dupont',
                password: hashedPassword,
                name: 'Jean Dupont',
                roleId: 'user',
                clientId: 'C001'
            },
            {
                id: 'U002',
                username: 'marie.martin',
                password: hashedPassword,
                name: 'Marie Martin',
                roleId: 'user',
                clientId: 'C002'
            },
            {
                id: 'U003',
                username: 'commercial1',
                password: hashedPassword,
                name: 'Sophie Commercial',
                roleId: 'commercial',
                clientId: null
            }
        ]);
        console.log(`✅ ${users.length} utilisateurs créés (mot de passe: password123)`);

        // 3. Créer des commandes
        console.log('\n📦 Création des commandes...');
        const orders = await Order.bulkCreate([
            {
                id: 'ORD-001',
                clientId: 'C001',
                date: new Date('2024-01-15'),
                status: 'Processing',
                totalAmount: 45000.00,
                remarks: 'Commande urgente - Livraison prioritaire',
                isValidated: true,
                isArchived: false
            },
            {
                id: 'ORD-002',
                clientId: 'C002',
                date: new Date('2024-01-20'),
                status: 'Shipped',
                totalAmount: 78000.00,
                remarks: 'Client VIP - Suivi rapproché',
                isValidated: true,
                isArchived: false
            },
            {
                id: 'ORD-003',
                clientId: 'C003',
                date: new Date('2024-02-01'),
                status: 'Processing',
                totalAmount: 32000.00,
                remarks: 'Première commande client',
                isValidated: false,
                isArchived: false
            },
            {
                id: 'ORD-004',
                clientId: 'C001',
                date: new Date('2023-12-10'),
                status: 'Delivered',
                totalAmount: 55000.00,
                remarks: 'Commande livrée avec succès',
                isValidated: true,
                isArchived: true
            }
        ]);
        console.log(`✅ ${orders.length} commandes créées`);

        // 4. Créer des véhicules
        console.log('\n🚗 Création des véhicules...');
        const vehicles = await Vehicle.bulkCreate([
            {
                id: 'VEH-001',
                brand: 'Mercedes-Benz C-Class',
                year: 2023,
                month: 'Janvier',
                supplier: 'Auto Import GmbH',
                mileage: 5000,
                chassisNumber: 'WDD2050071F123456',
                color: 'Noir Obsidienne',
                motorization: '2.0L Turbo Diesel',
                trim: 'AMG Line',
                condition: 'Excellent',
                purchasePrice: 42000.00,
                purchaseCurrency: 'EUR',
                sellingPrice: 45000.00,
                sellingCurrency: 'EUR',
                estimatedCustomsDuty: 3000.00,
                orderId: 'ORD-001',
                remarks: 'Véhicule premium - État impeccable'
            },
            {
                id: 'VEH-002',
                brand: 'BMW Serie 5',
                year: 2022,
                month: 'Mars',
                supplier: 'BMW Deutschland',
                mileage: 12000,
                chassisNumber: 'WBA5A5C50ED123789',
                color: 'Bleu Métallisé',
                motorization: '3.0L 6 Cylindres',
                trim: 'M Sport',
                condition: 'Très bon',
                purchasePrice: 38000.00,
                purchaseCurrency: 'EUR',
                sellingPrice: 42000.00,
                sellingCurrency: 'EUR',
                estimatedCustomsDuty: 2800.00,
                orderId: 'ORD-002',
                remarks: 'Entretien complet effectué'
            },
            {
                id: 'VEH-003',
                brand: 'Audi A4',
                year: 2023,
                month: 'Juin',
                supplier: 'Audi AG',
                mileage: 8000,
                chassisNumber: 'WAUZZZ8K8DA123456',
                color: 'Gris Nardo',
                motorization: '2.0L TFSI',
                trim: 'S-Line',
                condition: 'Excellent',
                purchasePrice: 35000.00,
                purchaseCurrency: 'EUR',
                sellingPrice: 38000.00,
                sellingCurrency: 'EUR',
                estimatedCustomsDuty: 2500.00,
                orderId: 'ORD-002',
                remarks: 'Pack technologie inclus'
            },
            {
                id: 'VEH-004',
                brand: 'Volkswagen Golf GTI',
                year: 2023,
                month: 'Février',
                supplier: 'VW Import',
                mileage: 3000,
                chassisNumber: 'WVWZZZ1KZEW123456',
                color: 'Rouge Tornado',
                motorization: '2.0L TSI',
                trim: 'GTI Performance',
                condition: 'Neuf',
                purchasePrice: 28000.00,
                purchaseCurrency: 'EUR',
                sellingPrice: 32000.00,
                sellingCurrency: 'EUR',
                estimatedCustomsDuty: 2200.00,
                orderId: 'ORD-003',
                remarks: 'Garantie constructeur 2 ans'
            },
            {
                id: 'VEH-005',
                brand: 'Porsche Cayenne',
                year: 2022,
                month: 'Septembre',
                supplier: 'Porsche Center',
                mileage: 15000,
                chassisNumber: 'WP1ZZZ92ZKDA123456',
                color: 'Blanc Carrara',
                motorization: '3.0L V6 Turbo',
                trim: 'S',
                condition: 'Excellent',
                purchasePrice: 52000.00,
                purchaseCurrency: 'EUR',
                sellingPrice: 55000.00,
                sellingCurrency: 'EUR',
                estimatedCustomsDuty: 4000.00,
                orderId: 'ORD-004',
                remarks: 'Options premium - Toit panoramique'
            }
        ]);
        console.log(`✅ ${vehicles.length} véhicules créés`);

        // 5. Créer des expéditions
        console.log('\n🚢 Création des expéditions...');
        const shipments = await Shipment.bulkCreate([
            {
                id: 'SHIP-001',
                containerNumber: 'MSCU1234567',
                blNumber: 'BL-2024-001',
                carrier: 'Maersk',
                forwarder: 'DHL Global Forwarding',
                loadingPort: 'Hamburg',
                destination: 'Le Havre',
                etd: new Date('2024-01-25'),
                eta: new Date('2024-02-05'),
                arrivalDate: new Date('2024-02-06'),
                docReceptionDate: new Date('2024-02-08'),
                status: 'In Transit',
                trackingNumber: 'MAEU123456789'
            },
            {
                id: 'SHIP-002',
                containerNumber: 'CMAU9876543',
                blNumber: 'BL-2024-002',
                carrier: 'CMA CGM',
                forwarder: 'Kuehne + Nagel',
                loadingPort: 'Bremerhaven',
                destination: 'Marseille',
                etd: new Date('2024-02-10'),
                eta: new Date('2024-02-20'),
                status: 'Pending',
                trackingNumber: 'CMAU987654321'
            }
        ]);
        console.log(`✅ ${shipments.length} expéditions créées`);

        // Lier les véhicules aux expéditions
        await Vehicle.update({ shipmentId: 'SHIP-001' }, { where: { id: 'VEH-001' } });
        await Vehicle.update({ shipmentId: 'SHIP-002' }, { where: { id: ['VEH-002', 'VEH-003'] } });

        // 6. Créer des transactions de caisse
        console.log('\n💰 Création des transactions de caisse...');
        const cashTransactions = await CashTransaction.bulkCreate([
            {
                id: 'CASH-001',
                orderId: 'ORD-001',
                clientName: 'Jean Dupont',
                showroom: 'CENTRE',
                amount: 15000.00,
                currency: 'EUR',
                date: new Date('2024-01-16'),
                paymentMethod: 'Virement bancaire',
                description: 'Acompte 30% commande ORD-001',
                type: 'In'
            },
            {
                id: 'CASH-002',
                orderId: 'ORD-002',
                clientName: 'Marie Martin',
                showroom: 'EST',
                amount: 78000.00,
                currency: 'EUR',
                date: new Date('2024-01-22'),
                paymentMethod: 'Chèque',
                description: 'Paiement intégral commande ORD-002',
                type: 'In'
            },
            {
                id: 'CASH-003',
                orderId: 'ORD-001',
                clientName: 'Fournisseur Auto Import',
                showroom: 'CENTRE',
                amount: 42000.00,
                currency: 'EUR',
                date: new Date('2024-01-18'),
                paymentMethod: 'Virement SWIFT',
                description: 'Paiement fournisseur véhicule VEH-001',
                type: 'Out'
            }
        ]);
        console.log(`✅ ${cashTransactions.length} transactions créées`);

        // 7. Créer des taux de change
        console.log('\n💱 Création des taux de change...');
        const exchangeRates = await ExchangeRate.bulkCreate([
            {
                id: 'EXR-001',
                fromCurrency: 'EUR',
                toCurrency: 'XAF',
                rate: 655.957,
                date: new Date('2024-01-15')
            },
            {
                id: 'EXR-002',
                fromCurrency: 'USD',
                toCurrency: 'EUR',
                rate: 0.92,
                date: new Date('2024-01-15')
            },
            {
                id: 'EXR-003',
                fromCurrency: 'GBP',
                toCurrency: 'EUR',
                rate: 1.15,
                date: new Date('2024-01-15')
            }
        ]);
        console.log(`✅ ${exchangeRates.length} taux de change créés`);

        console.log('\n✅ ========================================');
        console.log('✅ DONNÉES DE TEST CRÉÉES AVEC SUCCÈS !');
        console.log('✅ ========================================\n');

        console.log('📊 RÉSUMÉ :');
        console.log(`   - ${clients.length} clients`);
        console.log(`   - ${users.length} utilisateurs (mot de passe: password123)`);
        console.log(`   - ${orders.length} commandes`);
        console.log(`   - ${vehicles.length} véhicules`);
        console.log(`   - ${shipments.length} expéditions`);
        console.log(`   - ${cashTransactions.length} transactions de caisse`);
        console.log(`   - ${exchangeRates.length} taux de change`);

        console.log('\n🔐 COMPTES DE TEST :');
        console.log('   Admin:');
        console.log('     - Username: admin');
        console.log('     - Password: admin123');
        console.log('   Client 1:');
        console.log('     - Username: jean.dupont');
        console.log('     - Password: password123');
        console.log('   Client 2:');
        console.log('     - Username: marie.martin');
        console.log('     - Password: password123');
        console.log('   Commercial:');
        console.log('     - Username: commercial1');
        console.log('     - Password: password123');

        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    }
}

createTestData();
