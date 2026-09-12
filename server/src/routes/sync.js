const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const models = require('../models');

// Endpoint to get all data at once for synchronization
router.get('/sync-all', authMiddleware, async (req, res) => {
    const echecs = [];

    /**
     * Une table en echec ne doit pas emporter toute la synchronisation :
     * on renvoie null pour cette entite, ce que le client interprete comme
     * « garde ce que tu as » au lieu d'ecraser son cache avec du vide.
     */
    const sansCasser = (nom, promesse) => promesse.catch((err) => {
        console.error(`[Sync] Lecture de ${nom} impossible :`, err.message);
        echecs.push({ entite: nom, message: err.message });
        return null;
    });

    try {
        console.log('📥 Sync request from:', req.user?.username);

        // Fetch all data in parallel
        const [
            roles,
            users,
            clients,
            orders,
            vehicles,
            shipments,
            brands,
            showrooms,
            settings,
            exchangeRates,
            cashTransactions,
            attributes,
            purchaseOrders,
            suppliers,
            notifications,
            voyages,
            transfers
        ] = await Promise.all([
            sansCasser('roles', models.Role.findAll()),
            sansCasser('utilisateurs', models.User.findAll({ include: [{ model: models.Role, as: 'role' }] })),
            sansCasser('clients', models.Client.findAll()),
            sansCasser('commandes', models.Order.findAll()),
            sansCasser('vehicules', models.Vehicle.findAll()),
            sansCasser('expeditions', models.Shipment.findAll()),
            models.Brand.findAll({ 
                include: [{ 
                    model: models.VehicleModel, 
                    as: 'models',
                    include: [{ model: models.VehicleTrim, as: 'trims' }]
                }] 
            }).catch(async (err) => {
                console.warn('⚠️ Could not fetch trims for sync, falling back to brands/models only:', err.message);
                return sansCasser('marques', models.Brand.findAll({ include: [{ model: models.VehicleModel, as: 'models' }] }));
            }),
            sansCasser('showrooms', models.Showroom.findAll()),
            sansCasser('parametres', models.Settings.findOne()),
            sansCasser('taux de change', models.ExchangeRate.findAll({ order: [['date', 'DESC']] })),
            sansCasser('caisse', models.CashTransaction.findAll()),
            sansCasser('listes', models.DynamicAttribute.findAll({ order: [['sortOrder', 'ASC']] })),
            sansCasser('achats fournisseurs', models.PurchaseOrder.findAll({
                include: [{
                    model: models.Vehicle,
                    as: 'vehicles',
                    include: [{ model: models.Order, as: 'order' }]
                }]
            })),
            sansCasser('fournisseurs', models.Supplier.findAll()),
            sansCasser('notifications', models.Notification.findAll({ order: [['createdAt', 'DESC']], limit: 100 })),
            sansCasser('voyages', models.Voyage.findAll({
                include: [{ model: models.Shipment, as: 'shipments' }],
                order: [['createdAt', 'DESC']]
            })),
            sansCasser('transferts', models.VehicleTransfer.findAll({
                include: [
                    { model: models.Client, as: 'fromClient', attributes: ['id', 'firstName', 'lastName'] },
                    { model: models.Client, as: 'toClient', attributes: ['id', 'firstName', 'lastName'] },
                    { model: models.Vehicle, as: 'vehicle', attributes: ['id', 'brand', 'model', 'chassisNumber'] }
                ],
                order: [['transferDate', 'DESC']]
            }))
        ]);

        const syncData = {
            roles,
            users: users ? users.map(u => ({
                id: u.id,
                username: u.username,
                name: u.name,
                roleId: u.roleId,
                clientId: u.clientId,
                role: u.role
            })) : null,
            clients,
            orders,
            vehicles,
            shipments,
            brands,
            showrooms,
            settings: settings || {},
            // Les entites absentes ci-dessus valent null : le client conserve
            // alors ses donnees locales au lieu de les effacer.
            echecs: echecs.length ? echecs : undefined,
            exchangeRates,
            cashTransactions,
            attributes,
            purchaseOrders,
            suppliers,
            notifications,
            voyages,
            transfers
        };

        // Une entite en echec vaut null : lire .length dessus ferait echouer
        // toute la synchronisation pour une seule table indisponible.
        const compte = (v) => (v === null || v === undefined ? 'ECHEC' : (Array.isArray(v) ? v.length : 1));

        console.log('✅ Sync data prepared:', {
            roles: compte(roles),
            users: compte(users),
            clients: compte(clients),
            orders: compte(orders),
            vehicles: compte(vehicles),
            shipments: compte(shipments),
            brands: compte(brands),
            showrooms: compte(showrooms),
            purchaseOrders: compte(purchaseOrders),
            suppliers: compte(suppliers),
            voyages: compte(voyages),
            transfers: compte(transfers),
            caisse: compte(cashTransactions),
            listes: compte(attributes),
            parametres: compte(settings)
        });

        res.json({
            success: true,
            data: syncData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Sync error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la synchronisation',
            error: error.message
        });
    }
});

module.exports = router;
