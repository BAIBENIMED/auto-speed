const voyageTrackingService = require('../services/voyageTrackingService');

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

        const isBL = !!shipment.blNumber;
        console.log(`[Tracking] Syncing shipment ${id} via ${identifier}`);

        const trackingData = await containerTrackingService.trackContainer(identifier, isBL);

        // Check for ETA change logic
        if (trackingData.eta && shipment.eta) {
            const oldDate = new Date(shipment.eta);
            const newDate = new Date(trackingData.eta);
            const diffTime = Math.abs(newDate - oldDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > 1) {
                await Notification.create({
                    type: 'WARNING',
                    title: 'Changement de date d\'arrivée',
                    message: `La date d'arrivée prévue (ETA) pour l'expédition ${shipment.containerNumber || shipment.id} a changé de ${oldDate.toLocaleDateString()} à ${newDate.toLocaleDateString()}.`,
                    entityType: 'Shipment',
                    entityId: shipment.id
                });
            }
        }

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
            trackingHistory: trackingData.events ? JSON.stringify(trackingData.events) : shipment.trackingHistory,
            lastUpdate: new Date()
        });

        // Sync status to orders
        if (trackingData.status) {
            await syncShipmentStatusToOrders(shipment.id, trackingData.status);
        }

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
