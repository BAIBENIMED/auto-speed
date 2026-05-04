const express = require('express');
const router = express.Router();
const { Shipment, Vehicle, Order } = require('../models');
const { Op } = require('sequelize');
const { syncShipmentStatusToOrders } = require('../utils/statusSynchronizer');

// Global Status Healing
router.post('/heal-statuses', async (req, res) => {
    try {
        console.log('💊 Starting Global Status Healing...');

        // 1. Recover broken links: Ensure order.vehicleId and vehicle.orderId match
        const vehiclesWithOrders = await Vehicle.findAll({
            where: { orderId: { [Op.ne]: null } }
        });

        for (const v of vehiclesWithOrders) {
            const order = await Order.findByPk(v.orderId);
            if (order && order.vehicleId !== v.id) {
                console.log(`🔗 Healing link: Order ${order.id} -> Vehicle ${v.id}`);
                await order.update({ vehicleId: v.id });
            }
        }

        const ordersWithVehicles = await Order.findAll({
            where: { vehicleId: { [Op.ne]: null } }
        });

        for (const o of ordersWithVehicles) {
            const vehicle = await Vehicle.findByPk(o.vehicleId);
            if (vehicle && vehicle.orderId !== o.id) {
                console.log(`🔗 Healing link: Vehicle ${vehicle.id} -> Order ${o.id}`);
                await vehicle.update({ orderId: o.id });
            }
        }

        // 2. Sync every active shipment to its orders
        const activeShipments = await Shipment.findAll({
            where: { isArchived: false }
        });

        for (const shipment of activeShipments) {
            console.log(`🔄 Re-syncing shipment ${shipment.id} (${shipment.status})`);
            await syncShipmentStatusToOrders(shipment.id, shipment.status);
        }

        res.json({ success: true, message: 'La guérison des statuts est terminée avec succès.' });
    } catch (error) {
        console.error('Failed to heal statuses:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;

