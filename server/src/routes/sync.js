const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const models = require('../models');

// Endpoint to get all data at once for synchronization
router.get('/sync-all', authMiddleware, async (req, res) => {
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
            voyages
        ] = await Promise.all([
            models.Role.findAll(),
            models.User.findAll({ include: [{ model: models.Role, as: 'role' }] }),
            models.Client.findAll(),
            models.Order.findAll(),
            models.Vehicle.findAll(),
            models.Shipment.findAll(),
            models.Brand.findAll({ include: [{ model: models.VehicleModel, as: 'models' }] }),
            models.Showroom.findAll(),
            models.Settings.findOne(),
            models.ExchangeRate.findAll({ order: [['date', 'DESC']] }),
            models.CashTransaction.findAll(),
            models.DynamicAttribute.findAll({ order: [['sortOrder', 'ASC']] }),
            models.PurchaseOrder.findAll(),
            models.Supplier.findAll(),
            models.Notification.findAll({ order: [['createdAt', 'DESC']], limit: 100 }).catch(err => {
                console.warn('⚠️ Could not fetch notifications (Table missing?):', err.message);
                return []; // Return empty array on failure
            }),
            models.Voyage.findAll({
                include: [{ model: models.Shipment, as: 'shipments' }],
                order: [['createdAt', 'DESC']]
            })
        ]);

        const syncData = {
            roles,
            users: users.map(u => ({
                id: u.id,
                username: u.username,
                name: u.name,
                roleId: u.roleId,
                clientId: u.clientId,
                role: u.role
            })),
            clients,
            orders,
            vehicles,
            shipments,
            brands,
            showrooms,
            settings: settings || {},
            exchangeRates,
            cashTransactions,
            attributes,
            purchaseOrders,
            suppliers,
            notifications,
            voyages
        };

        console.log('✅ Sync data prepared:', {
            roles: roles.length,
            users: users.length,
            clients: clients.length,
            orders: orders.length,
            vehicles: vehicles.length,
            shipments: shipments.length,
            brands: brands.length,
            showrooms: showrooms.length,
            purchaseOrders: purchaseOrders.length,
            suppliers: suppliers.length
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
