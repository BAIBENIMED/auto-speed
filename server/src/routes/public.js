const express = require('express');
const router = express.Router();
const { Order, Vehicle, Shipment, Client } = require('../models');

// Public tracking endpoint
router.get('/track/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        console.log(`[PublicTracking] Request for Order: ${orderId}`);

        // Find order with associated data
        const order = await Order.findByPk(orderId, {
            include: [
                {
                    model: Client,
                    as: 'client',
                    attributes: ['firstName', 'lastName'] // Limited attributes for privacy
                }
            ]
        });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Commande non trouvée' });
        }

        // Find associated vehicle
        const vehicle = await Vehicle.findOne({
            where: { orderId: order.id }
        });

        let shipment = null;
        if (vehicle && vehicle.shipmentId) {
            shipment = await Shipment.findByPk(vehicle.shipmentId);
        }

        // Filter and structure response data
        const trackingData = {
            orderId: order.id,
            orderDate: order.date,
            orderStatus: order.status,
            clientName: order.client ? `${order.client.firstName} ${order.client.lastName[0]}.` : 'Client', // Obfuscate last name
            vehicle: vehicle ? {
                brand: vehicle.brand,
                model: vehicle.model,
                year: vehicle.year,
                color: vehicle.color
            } : {
                brand: order.requestedBrand,
                model: order.requestedModel,
                color: order.requestedColor
            },
            shipment: shipment ? {
                status: shipment.status,
                carrier: shipment.carrier,
                loadingPort: shipment.loadingPort,
                destination: shipment.destination,
                etd: shipment.etd,
                eta: shipment.eta,
                arrivalDate: shipment.arrivalDate,
                currentLat: shipment.currentLat,
                currentLng: shipment.currentLng,
                lastUpdate: shipment.lastUpdate,
                trackingHistory: shipment.trackingHistory ? JSON.parse(shipment.trackingHistory) : []
            } : null
        };

        res.json({ success: true, data: trackingData });
    } catch (error) {
        console.error('Public tracking error:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de la récupération des données de suivi' });
    }
});

module.exports = router;
