const { Shipment, Notification, Voyage, Order } = require('../models');
const containerTrackingService = require('./containerTrackingService');
const { syncShipmentStatusToOrders } = require('../utils/statusSynchronizer');
const { Op } = require('sequelize');

/**
 * Service to handle high-level Voyage tracking logic,
 * including auto-updates, notifications, and consistency.
 */
class VoyageTrackingService {
    /**
     * Maps raw tracking status to application-defined voyage status
     */
    mapTrackingStatus(rawStatus) {
        if (!rawStatus) return null;
        const s = rawStatus.toLowerCase();
        if (s.includes('transit') || s.includes('en mer') || s.includes('loaded') ||
            s.includes('departure') || s.includes('route') || s.includes('sailing')) return 'En Route';
        if (s.includes('arriv') || s.includes('unloaded') || s.includes('pod') ||
            s.includes('gate out') || s.includes('delivered') || s.includes('completed')) return 'Arrivé';
        if (s.includes('plan') || s.includes('sched') || s.includes('gate in') || s.includes('prep')) return 'Planifié';
        return null;
    }

    /**
     * Refresh a single voyage by name, sync all related shipments/orders,
     * and handle notifications for changes.
     */
    async refreshVoyage(voyageName) {
        console.log(`[VoyageTrackingService] Refreshing voyage: ${voyageName}`);

        // 1. Find Voyage Entity
        const voyageEntity = await Voyage.findOne({ where: { name: voyageName } });

        // 2. Find linked shipments
        const whereClause = { isArchived: false };
        if (voyageEntity) {
            whereClause[Op.or] = [{ voyage: voyageName }, { voyageId: voyageEntity.id }];
        } else {
            whereClause.voyage = voyageName;
        }
        const shipments = await Shipment.findAll({ where: whereClause });

        // 3. Determine identifier (BL or Container)
        let identifier = voyageEntity ? voyageEntity.blNumber : null;
        let isBL = true;
        if (!identifier || identifier.trim() === '') {
            const target = shipments.find(s => s.blNumber?.trim()) || shipments.find(s => s.containerNumber?.trim());
            if (!target) return { success: false, message: 'No BL/Container found' };
            identifier = target.blNumber || target.containerNumber;
            isBL = !!target.blNumber;
        }

        // 4. Call Satellite API
        const trackingInfo = await containerTrackingService.trackContainer(identifier, isBL);
        const mappedStatus = this.mapTrackingStatus(trackingInfo.status);

        // 5. Detect History Changes for Notifications
        await this.handleHistoryChangeNotifications(voyageEntity, trackingInfo, voyageName);

        // 6. Persistence: Voyage
        if (voyageEntity) {
            await voyageEntity.update({
                status: mappedStatus || voyageEntity.status,
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

        // 7. Cascade to Shipments & Notifications for ETA
        if (shipments.length > 0) {
            await Promise.all(shipments.map(async (s) => {
                // ETA Notification
                if (trackingInfo.eta && s.eta) {
                    const diff = Math.abs(new Date(trackingInfo.eta) - new Date(s.eta));
                    if (diff > (1000 * 60 * 60 * 24)) { // More than 24h change
                        await Notification.create({
                            type: 'WARNING',
                            title: 'Changement ETA',
                            message: `Nouvelle date d'arrivée pour ${voyageName}: ${new Date(trackingInfo.eta).toLocaleDateString()}`,
                            entityType: 'Voyage',
                            entityId: voyageEntity ? voyageEntity.id : null
                        });
                    }
                }

                await s.update({
                    status: mappedStatus || s.status,
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

            // 8. Sync to Orders
            if (mappedStatus) {
                await Promise.all(shipments.map(s => syncShipmentStatusToOrders(s.id, mappedStatus)));
            }
        }

        return { success: true, data: trackingInfo };
    }

    /**
     * Compares new history with old to notify about new events
     */
    async handleHistoryChangeNotifications(voyageEntity, trackingInfo, voyageName) {
        if (!voyageEntity || !trackingInfo.events || trackingInfo.events.length === 0) return;

        try {
            const oldHistory = voyageEntity.trackingHistory ? JSON.parse(voyageEntity.trackingHistory) : [];
            const newCount = trackingInfo.events.length;
            const oldCount = Array.isArray(oldHistory) ? oldHistory.length : 0;

            if (newCount > oldCount) {
                const latestEvent = trackingInfo.events[0]; // Assuming descending order
                await Notification.create({
                    type: 'INFO',
                    title: `Nouvel événement : ${voyageName}`,
                    message: `${latestEvent.description} à ${latestEvent.location || 'en mer'}.`,
                    entityType: 'Voyage',
                    entityId: voyageEntity.id
                });
            }
        } catch (e) {
            console.error('[VoyageTrackingService] Notification logic error:', e.message);
        }
    }

    /**
     * Refreshes all active voyages (Status NOT Arrived/Completed)
     */
    async refreshAllActive() {
        console.log('[VoyageTrackingService] CRON: Refreshing all active voyages...');
        const activeVoyages = await Voyage.findAll({
            where: {
                status: { [Op.notIn]: ['Arrivé', 'Completed'] }
            }
        });

        for (const v of activeVoyages) {
            try {
                await this.refreshVoyage(v.name);
                // Simple thottle to avoid hitting API limits too hard
                await new Promise(r => setTimeout(r, 2000));
            } catch (err) {
                console.error(`[VoyageTrackingService] CRON failed for ${v.name}:`, err.message);
            }
        }
    }

    /**
     * Checks for voyages that haven't been updated for > 6 hours
     */
    async checkStaleVoyages() {
        console.log('[VoyageTrackingService] CRON: Checking for stale voyages...');
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

        const staleVoyages = await Voyage.findAll({
            where: {
                status: { [Op.notIn]: ['Arrivé', 'Completed'] },
                lastUpdate: { [Op.lt]: sixHoursAgo }
            }
        });

        for (const v of staleVoyages) {
            await Notification.create({
                type: 'DANGER',
                title: 'Données Non Actualisées',
                message: `Le voyage ${v.name} n'a pas reçu de mise à jour satellite depuis plus de 6 heures.`,
                entityType: 'Voyage',
                entityId: v.id
            });
        }
    }
}

module.exports = new VoyageTrackingService();
