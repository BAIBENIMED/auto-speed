const { Shipment, Notification, Voyage, Order } = require('../models');
const containerTrackingService = require('./containerTrackingService');
const { syncShipmentStatusToOrders } = require('../utils/statusSynchronizer');
const { Op } = require('sequelize');
const { formatDate } = require('../utils/dateFormatter');

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

        // Priority 1: Delivery
        if (s.includes('delivered') || s.includes('gate out') || s.includes('completed')) return 'Livré';

        // Priority 2: Transit (Check transit before arrival keywords to handle transshipment reload)
        if (s.includes('transit') || s.includes('en mer') || s.includes('loaded') ||
            s.includes('departure') || s.includes('route') || s.includes('sailing')) return 'En Route';

        // Priority 3: Arrival
        if (s.includes('arriv') || s.includes('unloaded') || s.includes('pod') || s.includes('discharge')) return 'Arrivé';

        // Priority 4: Planning
        if (s.includes('plan') || s.includes('sched') || s.includes('gate in') || s.includes('prep')) return 'Planifié';
        return null;
    }

    /**
     * Refresh a single voyage by name or ID, sync all related shipments/orders,
     * and handle notifications for changes.
     */
    async refreshVoyage(voyageIdentifier, isId = false) {
        console.log(`[VoyageTrackingService] Refreshing voyage: ${voyageIdentifier} (isId: ${isId})`);

        // 1. Find Voyage Entity
        let voyageEntity = null;
        if (isId) {
            voyageEntity = await Voyage.findByPk(voyageIdentifier);
        } else {
            voyageEntity = await Voyage.findOne({ where: { name: voyageIdentifier } });
        }

        const voyageName = voyageEntity ? voyageEntity.name : voyageIdentifier;

        // 2. Find linked shipments
        const whereClause = { isArchived: false };
        if (voyageEntity) {
            whereClause[Op.or] = [{ voyageId: voyageEntity.id }, { voyage: voyageName }];
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

        // HANDLE TRACKING ERRORS / NO DATA
        const isError = !trackingInfo ||
            ['Tracking Error', 'No API Key', 'Erreur API', 'Numéro manquant', 'ERREUR'].includes(trackingInfo.status) ||
            trackingInfo.status === 'ERREUR';

        if (isError) {
            console.warn(`[VoyageTracking] Tracking failed for ${voyageName} (${identifier}): ${trackingInfo?.status}`);

            // If we have an entity, we might want to flag it as error but KEEP old data
            // Or set status to 'Erreur Tracking'
            if (voyageEntity) {
                await voyageEntity.update({
                    status: 'Erreur Tracking', // Or keep old status? User wants RED, so error status is good.
                    lastUpdate: new Date()
                });

                // Also update shipments to reflect error
                if (shipments.length > 0) {
                    await Promise.all(shipments.map(s => s.update({
                        status: 'Erreur Tracking',
                        lastUpdate: new Date()
                    })));
                }
            }
            return {
                success: false,
                message: trackingInfo?.message || 'Le suivi automatique est indisponible. Consultez directement le site du transporteur.',
                data: trackingInfo
            };
        }

        const mappedStatus = this.mapTrackingStatus(trackingInfo.status);

        // 5. Detect History Changes for Notifications
        await this.handleHistoryChangeNotifications(voyageEntity, trackingInfo, voyageName);

        // 6. Persistence: Voyage
        if (voyageEntity) {
            const updateData = {
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
            };

            // Auto-set arrival date when status becomes 'Arrivé'
            if (mappedStatus === 'Arrivé' && !voyageEntity.arrivalDate) {
                let eventDate = new Date();
                if (trackingInfo.events && trackingInfo.events.length > 0) {
                    const arrivalEvent = trackingInfo.events.find(e => {
                        const d = (e.description || '').toLowerCase();
                        return d.includes('arriv') || d.includes('discharge') || d.includes('unloaded') || d.includes('pod');
                    });
                    if (arrivalEvent && arrivalEvent.date) {
                        eventDate = new Date(arrivalEvent.date);
                    }
                }
                updateData.arrivalDate = eventDate;
                console.log(`[VoyageTracking] Auto-set arrivalDate for voyage ${voyageName} to ${eventDate.toISOString()}`);
            }

            await voyageEntity.update(updateData);
        }

        // 7. Cascade to Shipments & Notifications for ETA
        if (shipments.length > 0) {
            await Promise.all(shipments.map(async (s) => {
                // ETA Notification - only alert if DELAYED (new ETA is later than old)
                if (trackingInfo.eta && s.eta) {
                    const oldEta = new Date(s.eta);
                    const newEta = new Date(trackingInfo.eta);
                    const diff = newEta - oldEta; // Positive = delay, Negative = advance

                    if (diff > (1000 * 60 * 60 * 24)) { // More than 24h DELAY
                        await Notification.create({
                            type: 'WARNING',
                            title: 'Retard ETA',
                            message: `Le voyage ${voyageName} est retardé. Nouvelle arrivée: ${formatDate(newEta)} (au lieu de ${formatDate(oldEta)})`,
                            entityType: 'Voyage',
                            entityId: voyageEntity ? voyageEntity.id : null
                        });
                    }
                }

                const shipmentUpdate = {
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
                };

                // Auto-set arrival date when status becomes 'Arrivé'
                if (mappedStatus === 'Arrivé' && !s.arrivalDate) {
                    let eventDate = new Date();
                    // Try to find the actual event date in history
                    if (trackingInfo.events && trackingInfo.events.length > 0) {
                        const arrivalEvent = trackingInfo.events.find(e => {
                            const d = (e.description || '').toLowerCase();
                            return d.includes('arriv') || d.includes('discharge') || d.includes('unloaded') || d.includes('pod');
                        });
                        if (arrivalEvent && arrivalEvent.date) {
                            eventDate = new Date(arrivalEvent.date);
                        }
                    }
                    shipmentUpdate.arrivalDate = eventDate;
                    console.log(`[VoyageTracking] Auto-set arrivalDate for shipment ${s.id} to ${eventDate.toISOString()}`);
                }

                await s.update(shipmentUpdate);
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
