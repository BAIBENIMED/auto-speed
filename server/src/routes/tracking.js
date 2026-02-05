const express = require('express');
const router = express.Router();
const containerTrackingService = require('../services/containerTrackingService');
const { Shipment, Vehicle, Notification, Voyage } = require('../models');
const { syncShipmentStatusToOrders } = require('../utils/statusSynchronizer');
const { Op } = require('sequelize');

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

        // Try to find official Voyage entity
        const voyageEntity = await Voyage.findOne({
            where: { name: voyageName }
        });

        // Find shipments in this voyage (Legacy name OR Official ID)
        const whereClause = { isArchived: false };
        if (voyageEntity) {
            whereClause[Op.or] = [
                { voyage: voyageName },
                { voyageId: voyageEntity.id }
            ];
        } else {
            whereClause.voyage = voyageName;
        }

        const shipments = await Shipment.findAll({
            where: whereClause,
            order: [['createdAt', 'ASC']]
        });

        // Determine tracking identifier (Prioritize Voyage BL, then Shipment BL, then Container)
        let identifier = voyageEntity ? voyageEntity.blNumber : null;
        let isBL = true;

        if (!identifier || identifier.trim() === '') {
            const shipmentWithBL = shipments.find(s => s.blNumber && s.blNumber.trim() !== '');
            const targetShipment = shipmentWithBL || shipments.find(s => s.containerNumber && s.containerNumber.trim() !== '');

            if (targetShipment) {
                identifier = targetShipment.blNumber || targetShipment.containerNumber;
                isBL = !!targetShipment.blNumber;
            }
        }

        if (!identifier || identifier.trim() === '') {
            return res.status(404).json({ success: false, message: 'Aucun BL ou conteneur trouvé pour ce voyage' });
        }

        console.log(`[Tracking] Tracking voyage ${voyageName} via ${identifier}`);
        const trackingInfo = await containerTrackingService.trackContainer(identifier, isBL);

        // PERSISTENCE: Save on Voyage Entity if exists
        if (voyageEntity) {
            await voyageEntity.update({
                status: trackingInfo.status || voyageEntity.status,
                etd: trackingInfo.etd || voyageEntity.etd,
                eta: trackingInfo.eta || voyageEntity.eta,
                loadingPort: trackingInfo.loadingPort || voyageEntity.loadingPort,
                destination: trackingInfo.unloadingPort || voyageEntity.destination,
                currentLat: trackingInfo.location?.lat || voyageEntity.currentLat,
                currentLng: trackingInfo.location?.lng || voyageEntity.currentLng,
                shipStatus: trackingInfo.vesselName || voyageEntity.shipStatus,
                trackingHistory: trackingInfo.events ? JSON.stringify(trackingInfo.events) : voyageEntity.trackingHistory,
                lastUpdate: new Date()
            });
        }

        // CASCADE UPDATE: Update ALL shipments linked to this voyage
        if (shipments.length > 0) {
            await Promise.all(shipments.map(async (s) => {
                // Check for Date Changes (ETA) for notifications
                if (trackingInfo.eta && s.eta) {
                    const oldDate = new Date(s.eta);
                    const newDate = new Date(trackingInfo.eta);
                    const diffTime = Math.abs(newDate - oldDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays > 1) {
                        await Notification.create({
                            type: 'WARNING',
                            title: 'Changement de date d\'arrivée',
                            message: `La date d'arrivée prévue (ETA) pour le voyage ${s.voyage || 'Inconnu'} a changé de ${oldDate.toLocaleDateString()} à ${newDate.toLocaleDateString()}.`,
                            entityType: 'Shipment',
                            entityId: s.id
                        });
                    }
                }

                await s.update({
                    status: trackingInfo.status || s.status,
                    etd: trackingInfo.etd || s.etd,
                    eta: trackingInfo.eta || s.eta,
                    loadingPort: trackingInfo.loadingPort || s.loadingPort,
                    destination: trackingInfo.unloadingPort || s.destination,
                    currentLat: trackingInfo.location?.lat || s.currentLat,
                    currentLng: trackingInfo.location?.lng || s.currentLng,
                    shipStatus: trackingInfo.vesselName || s.shipStatus,
                    trackingHistory: trackingInfo.events ? JSON.stringify(trackingInfo.events) : s.trackingHistory,
                    lastUpdate: new Date()
                });
            }));

            // Sync status to orders linked to these shipments
            if (trackingInfo.status) {
                await Promise.all(shipments.map(s => syncShipmentStatusToOrders(s.id, trackingInfo.status)));
            }
        }

        return res.json({ success: true, data: { ...trackingInfo, voyageName } });

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
