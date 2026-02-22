const express = require('express');
const router = express.Router();
const { Shipment, Notification, Order } = require('../models');
const voyageTrackingService = require('../services/voyageTrackingService');
const containerTrackingService = require('../services/containerTrackingService');

// Helper to sync status
async function syncShipmentStatusToOrders(shipmentId, status) {
    try {
        await Order.update({ status }, { where: { shipmentId } });
    } catch (err) {
        console.error('[Sync] Error syncing status to orders:', err);
    }
}

// Get tracking info for a Voyage (finds first valid BL or container in voyage)
router.get('/voyage/:voyageName', async (req, res) => {
    try {
        const { voyageName } = req.params;
        const result = await voyageTrackingService.refreshVoyage(voyageName);

        if (result.success) {
            res.json({ success: true, data: { ...result.data, voyageName } });
        } else {
            res.status(404).json({ success: false, message: result.message });
        }
    } catch (error) {
        console.error('Voyage tracking route error:', error);
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

        // --- NEW LOGIC: Delegate to VoyageTrackingService if part of a Voyage ---
        let voyageName = shipment.voyage;
        if (!voyageName && shipment.voyageId) {
            const { Voyage } = require('../models');
            const v = await Voyage.findByPk(shipment.voyageId);
            if (v) voyageName = v.name;
        }

        if (voyageName) {
            console.log(`[Tracking] Shipment ${id} belongs to Voyage '${voyageName}'. Refreshing entire voyage instead.`);
            const result = await voyageTrackingService.refreshVoyage(voyageName);
            if (!result.success) {
                return res.json(result); // Return the detailed error (e.g. from Siney API)
            }
            // Add identifier so the frontend modal can display it
            return res.json({ success: true, data: { ...result.data, identifier } });
        }
        // ------------------------------------------------------------------------

        const isBL = !!shipment.blNumber;
        console.log(`[Tracking] Syncing shipment ${id} via ${identifier} (Individual)`);

        const trackingData = await containerTrackingService.trackContainer(identifier, isBL);

        // If tracking unavailable, return carrierInfo for direct links
        if (trackingData.status === 'Tracking Non Disponible') {
            return res.json({
                success: false,
                message: trackingData.message,
                carrierInfo: trackingData.carrierInfo,
                identifier
            });
        }

        // Check for ETA change logic - only alert if DELAYED
        if (trackingData.eta && shipment.eta) {
            const oldDate = new Date(shipment.eta);
            const newDate = new Date(trackingData.eta);
            const diffTime = newDate - oldDate;

            if (diffTime > (1000 * 60 * 60 * 24)) {
                await Notification.create({
                    type: 'WARNING',
                    title: 'Retard d\'arrivée',
                    message: `L'expédition ${shipment.containerNumber || shipment.id} est retardée. Nouvelle arrivée: ${newDate.toLocaleDateString()} (au lieu de ${oldDate.toLocaleDateString()}).`,
                    entityType: 'Shipment',
                    entityId: shipment.id
                });
            }
        }

        // Update Shipment in DB
        const updateData = {
            status: trackingData.status || shipment.status,
            etd: trackingData.etd || shipment.etd,
            eta: trackingData.eta || shipment.eta,
            loadingPort: trackingData.loadingPort || shipment.loadingPort,
            destination: trackingData.unloadingPort || shipment.destination,
            currentLat: trackingData.location?.lat || shipment.currentLat,
            currentLng: trackingData.location?.lng || shipment.currentLng,
            shipStatus: trackingData.vesselName || shipment.shipStatus,
            trackingHistory: trackingData.events ? JSON.stringify(trackingData.events) : shipment.trackingHistory,
            lastUpdate: new Date()
        };

        if (trackingData.status && trackingData.status.toLowerCase().includes('arriv') && !shipment.arrivalDate) {
            updateData.arrivalDate = new Date();
        }

        await shipment.update(updateData);

        if (trackingData.status) {
            await syncShipmentStatusToOrders(shipment.id, trackingData.status);
        }

        res.json({ success: true, data: trackingData });
    } catch (error) {
        console.error('Shipment refresh error:', error);
        res.status(500).json({ success: false, message: 'Erreur: ' + error.message });
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
