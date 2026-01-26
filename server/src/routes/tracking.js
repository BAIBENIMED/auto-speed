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

// Get tracking info for a Voyage (finds first valid container in voyage)
router.get('/voyage/:voyageName', async (req, res) => {
    try {
        const { voyageName } = req.params;

        // Find a shipment in this voyage that has a container number
        const shipment = await Shipment.findOne({
            where: {
                voyage: voyageName,
                isArchived: false
            }
        });

        if (!shipment || !shipment.containerNumber) {
            return res.status(404).json({ success: false, message: 'Aucun conteneur trouvé pour ce voyage' });
        }

        // Use the found container to track the voyage
        const trackingInfo = await containerTrackingService.trackContainer(shipment.containerNumber);

        // Attach voyage-specific summary if needed
        res.json({
            success: true,
            data: {
                ...trackingInfo,
                voyageName: voyageName,
                representativeContainer: shipment.containerNumber
            }
        });

    } catch (error) {
        console.error('Voyage tracking error:', error);
        res.status(500).json({ success: false, message: 'Erreur lors du suivi du voyage' });
    }
});

module.exports = router;
