const express = require('express');
const router = express.Router();
const containerTrackingService = require('../services/containerTrackingService');
const { Shipment, Vehicle } = require('../models');

// Track a specific container or BL
router.get('/container/:number', async (req, res) => {
    try {
        const { number } = req.params;
        const result = await containerTrackingService.trackContainer(number);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Tracking error:', error);
        res.status(500).json({ success: false, message: 'Erreur lors du suivi' });
    }
});

// Get tracking info for a Voyage (finds first valid BL or container in voyage)
router.get('/voyage/:voyageName', async (req, res) => {
    try {
        const { voyageName } = req.params;

        // Find shipments in this voyage
        const shipments = await Shipment.findAll({
            where: {
                voyage: voyageName,
                isArchived: false
            }
        });

        if (!shipments || shipments.length === 0) {
            return res.status(404).json({ success: false, message: 'Aucune expédition trouvée pour ce voyage' });
        }

        // 1. Try to find a BL number first (more reliable for voyage tracking)
        const shipmentWithBL = shipments.find(s => s.blNumber && s.blNumber.trim() !== '');
        if (shipmentWithBL) {
            console.log(`[Tracking] Tracking voyage ${voyageName} via BL ${shipmentWithBL.blNumber}`);
            const trackingInfo = await containerTrackingService.trackContainer(shipmentWithBL.blNumber, true);
            return res.json({ success: true, data: { ...trackingInfo, voyageName } });
        }

        // 2. Fallback to Container Number
        const shipmentWithContainer = shipments.find(s => s.containerNumber && s.containerNumber.trim() !== '');
        if (shipmentWithContainer) {
            console.log(`[Tracking] Tracking voyage ${voyageName} via Container ${shipmentWithContainer.containerNumber}`);
            const trackingInfo = await containerTrackingService.trackContainer(shipmentWithContainer.containerNumber, false);
            return res.json({ success: true, data: { ...trackingInfo, voyageName } });
        }

        res.status(404).json({ success: false, message: 'Aucun BL ou conteneur trouvé pour ce voyage' });

    } catch (error) {
        console.error('Voyage tracking error:', error);
        res.status(500).json({ success: false, message: 'Erreur lors du suivi du voyage' });
    }
});

module.exports = router;
