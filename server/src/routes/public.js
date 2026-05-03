const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Order, Vehicle, Shipment, Client, VehicleTrim } = require('../models');

// Public tracking endpoint - looks up by 6-char trackingCode (or falls back to orderId)
router.get('/track', async (req, res) => {
    try {
        const code = req.query.code || req.query.id;
        if (!code) {
            return res.status(400).json({ success: false, message: 'Code de suivi manquant' });
        }
        console.log(`[PublicTracking] Request for code: ${code}`);

        // Search by trackingCode first, then fallback to orderId
        let order = await Order.findOne({
            where: { trackingCode: code.toUpperCase() },
            include: [{ model: Client, as: 'client', attributes: ['firstName', 'lastName'] }]
        });

        // Fallback: search by orderId (for older orders without tracking code)
        if (!order) {
            order = await Order.findByPk(code, {
                include: [{ model: Client, as: 'client', attributes: ['firstName', 'lastName'] }]
            });
        }

        if (!order) {
            return res.status(404).json({ success: false, message: 'Commande introuvable. Vérifiez votre code de suivi.' });
        }

        // Find associated vehicle
        const vehicle = await Vehicle.findOne({ where: { orderId: order.id } });

        let shipment = null;
        let trimData = null;
        if (vehicle) {
            if (vehicle.shipmentId) {
                shipment = await Shipment.findByPk(vehicle.shipmentId);
            }
            if (vehicle.trimId) {
                const trim = await VehicleTrim.findByPk(vehicle.trimId);
                if (trim) {
                    trimData = {
                        name: trim.name,
                        characteristics: trim.characteristics
                    };
                }
            }
        }

        // Filter and structure response (no sensitive data)
        const trackingData = {
            trackingCode: order.trackingCode,
            orderId: order.id,
            orderDate: order.date,
            orderStatus: order.status,
            clientName: order.client ? `${order.client.firstName} ${order.client.lastName[0]}.` : 'Client',
            vehicle: vehicle ? {
                brand: vehicle.brand,
                model: vehicle.model,
                year: vehicle.year,
                color: vehicle.color,
                chassisNumber: vehicle.chassisNumber,
                videoLink: vehicle.videoLink || null,
                blLink: vehicle.blLink || null,
                trim: trimData ? trimData.name : vehicle.trim || null,
                trimCharacteristics: trimData ? trimData.characteristics : null
            } : {
                brand: order.requestedBrand,
                model: order.requestedModel,
                color: order.requestedColor
            },
            shipment: shipment ? {
                status: shipment.status,
                carrier: shipment.carrier,
                containerNumber: shipment.containerNumber,
                blNumber: shipment.blNumber,
                forwarder: shipment.forwarder,
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
