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
        const targetShipment = shipmentWithBL || shipments.find(s => s.containerNumber && s.containerNumber.trim() !== '');

        if (targetShipment) {
            const identifier = targetShipment.blNumber || targetShipment.containerNumber;
            const isBL = !!targetShipment.blNumber;

            console.log(`[Tracking] Tracking voyage ${voyageName} via ${identifier}`);
            const trackingInfo = await containerTrackingService.trackContainer(identifier, isBL);

            // CASCADE UPDATE: Update ALL shipments in this voyage with the new data
            await Promise.all(shipments.map(s => s.update({
                status: trackingInfo.status || s.status,
                etd: trackingInfo.etd || s.etd,
                eta: trackingInfo.eta || s.eta,
                loadingPort: trackingInfo.loadingPort || s.loadingPort,
                destination: trackingInfo.unloadingPort || s.destination,
                currentLat: trackingInfo.location?.lat || s.currentLat,
                currentLng: trackingInfo.location?.lng || s.currentLng,
                shipStatus: trackingInfo.vesselName || s.shipStatus,
                lastUpdate: new Date()
            })));

            return res.json({ success: true, data: { ...trackingInfo, voyageName } });
        }

        res.status(404).json({ success: false, message: 'Aucun BL ou conteneur trouvé pour ce voyage' });

    } catch (error) {
        console.error('Voyage tracking error:', error);
        res.status(500).json({ success: false, message: 'Erreur lors du suivi du voyage' });
    }
});

// Refresh and sync tracking for a specific shipment ID
router.post('/:id/refresh', async (req, res) => {
    try {
        const { id } = req.params;
        const shipment = await Shipment.findByPk(id);

        if (!shipment) {
            return res.status(404).json({ success: false, message: 'Expédition non trouvée' });
        }

        const identifier = shipment.blNumber || shipment.containerNumber;
        if (!identifier) {
            return res.status(400).json({ success: false, message: 'Aucun BL ou numéro de conteneur' });
        }

        const isBL = !!shipment.blNumber;
        console.log(`[Tracking] Syncing shipment ${id} via ${identifier}`);

        const trackingData = await containerTrackingService.trackContainer(identifier, isBL);

        // Update Shipment in DB
        await shipment.update({
            status: trackingData.status || shipment.status,
            etd: trackingData.etd || shipment.etd,
            eta: trackingData.eta || shipment.eta,
            loadingPort: trackingData.loadingPort || shipment.loadingPort,
            destination: trackingData.unloadingPort || shipment.destination,
            currentLat: trackingData.location?.lat || shipment.currentLat,
            currentLng: trackingData.location?.lng || shipment.currentLng,
            shipStatus: trackingData.vesselName || shipment.shipStatus,
            lastUpdate: new Date()
        });

        res.json({ success: true, data: trackingData });
    } catch (error) {
        console.error('Shipment refresh error:', error);
        res.status(500).json({ success: false, message: 'Erreur lors du rafraîchissement' });
    }
});

// Toggle tracking activation for a voyage
router.post('/voyage/:voyageName/toggle', async (req, res) => {
    try {
        const { voyageName } = req.params;
        const { active } = req.body;

        await Shipment.update(
            { isTrackingActive: !!active },
            { where: { voyage: voyageName } }
        );

        res.json({ success: true, message: `Tracking ${active ? 'activé' : 'désactivé'} pour le voyage ${voyageName}` });
    } catch (error) {
        console.error('Voyage toggle error:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de la modification du statut de suivi' });
    }
});

module.exports = router;
