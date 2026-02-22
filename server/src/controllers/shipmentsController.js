const { Shipment, Vehicle, Order } = require('../models');
const { syncShipmentStatusToOrders } = require('../utils/statusSynchronizer');


const shipmentsController = {
    getAll: async (req, res) => {
        try {
            const { archived } = req.query;
            const where = {};
            if (archived !== undefined) {
                where.isArchived = archived === 'true';
            }

            const includeOptions = [
                {
                    model: Vehicle,
                    as: 'Vehicles',
                    include: [{
                        model: Order,
                        as: 'order',
                        where: (req.user && !['admin', 'commercial'].includes(req.user.roleId)) ? { clientId: req.user.clientId } : {}
                    }]
                }
            ];

            const shipments = await Shipment.findAll({
                where,
                include: includeOptions
            });
            res.json({ success: true, data: shipments });
        } catch (error) {
            console.error('Error fetching shipments:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la récupération des expéditions' });
        }
    },

    getById: async (req, res) => {
        try {
            const shipment = await Shipment.findByPk(req.params.id, {
                include: ['Vehicles']
            });
            if (!shipment) {
                return res.status(404).json({ success: false, message: 'Expédition non trouvée' });
            }
            res.json({ success: true, data: shipment });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erreur lors de la récupération de l\'expédition' });
        }
    },

    create: async (req, res) => {
        try {
            const shipment = await Shipment.create(req.body);
            // If vehicles are provided, link them
            if (req.body.vehicleIds && Array.isArray(req.body.vehicleIds)) {
                await Vehicle.update(
                    { shipmentId: shipment.id },
                    { where: { id: req.body.vehicleIds } }
                );
            }
            // Trigger tracking refresh


            res.status(201).json({ success: true, data: shipment });
        } catch (error) {
            console.error('Error creating shipment:', error);
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({ success: false, message: 'Ce numéro de conteneur est déjà enregistré.' });
            }
            res.status(400).json({ success: false, message: error.message || 'Erreur lors de la création de l\'expédition' });
        }
    },

    update: async (req, res) => {
        try {
            const shipment = await Shipment.findByPk(req.params.id);
            if (!shipment) {
                return res.status(404).json({ success: false, message: 'Expédition non trouvée' });
            }

            // RESTRICT BL MODIFICATION
            // If Trying to change BL AND BL already exists AND New BL is different
            if (req.body.blNumber && shipment.blNumber && req.body.blNumber.trim() !== shipment.blNumber) {
                // Check if user is admin
                if (!req.user || req.user.roleId !== 'admin') {
                    return res.status(403).json({
                        success: false,
                        message: 'Modification interdite : Seul un administrateur peut modifier le BL de suivi une fois défini.'
                    });
                }
            }

            await shipment.update(req.body);

            // Sync status to orders if updated
            if (req.body.status) {
                await syncShipmentStatusToOrders(shipment.id, req.body.status);
            }

            // Trigger tracking refresh


            res.json({ success: true, data: shipment });
        } catch (error) {
            console.error('Error updating shipment:', error);
            res.status(400).json({ success: false, message: 'Erreur lors de la mise à jour de l\'expédition', error: error.message });
        }
    },

    delete: async (req, res) => {
        try {
            const shipment = await Shipment.findByPk(req.params.id);
            if (!shipment) {
                return res.status(404).json({ success: false, message: 'Expédition non trouvée' });
            }
            // Logic to unlink vehicles could be here
            await shipment.destroy();
            res.json({ success: true, message: 'Expédition supprimée' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erreur lors de la suppression de l\'expédition' });
        }
    },

    getTrackingData: async (req, res) => {
        try {
            const shipments = await Shipment.findAll({
                where: {
                    isArchived: false,
                    currentLat: { [require('sequelize').Op.ne]: null }
                },
                attributes: ['id', 'containerNumber', 'carrier', 'currentLat', 'currentLng', 'speed', 'course', 'lastUpdate', 'shipStatus', 'eta', 'destination']
            });
            res.json({ success: true, data: shipments });
        } catch (error) {
            console.error('Error fetching tracking data:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la récupération des données de tracking' });
        }
    },

    manualUpdate: async (req, res) => {
        try {
            const shipment = await Shipment.findByPk(req.params.id);
            if (!shipment) {
                return res.status(404).json({ success: false, message: 'Expédition non trouvée' });
            }

            console.log(`[ManualUpdate] Processing shipment ${shipment.id}, status: ${shipment.status}`);

            // Auto-fill dates based on status
            const updates = {};

            if (shipment.status === 'Arrivé' && !shipment.arrivalDate) {
                updates.arrivalDate = new Date();
                console.log(`[ManualUpdate] Auto-set arrivalDate for shipment ${shipment.id}`);
            }

            if (shipment.status === 'Livré' && !shipment.pickupDate) {
                updates.pickupDate = new Date();
                console.log(`[ManualUpdate] Auto-set pickupDate for shipment ${shipment.id}`);
            }

            // Update shipment if there are changes
            if (Object.keys(updates).length > 0) {
                await shipment.update(updates);
            }

            // Propagate status to vehicles and orders
            const vehicles = await Vehicle.findAll({ where: { shipmentId: shipment.id } });

            for (const vehicle of vehicles) {
                // Update vehicle status based on shipment status to maintain consistency
                let vehicleStatus = vehicle.status;
                if (shipment.status === 'Arrivé') {
                    vehicleStatus = 'Arrived';
                } else if (shipment.status === 'Livré') {
                    vehicleStatus = 'Sold';
                } else if (shipment.status === 'En mer' || shipment.status === 'En Route') {
                    vehicleStatus = 'In Transit';
                }

                if (vehicle.status !== vehicleStatus) {
                    await vehicle.update({ status: vehicleStatus });
                    console.log(`[ManualUpdate] Updated vehicle ${vehicle.id} status to: ${vehicleStatus}`);
                }
            }

            // Map shipment status for order sync
            let syncStatus = shipment.status;
            // Ensure we use the exact strings the synchronizer expects if it was different
            if (syncStatus === 'Arrivé') syncStatus = 'Arrivé'; // Already correct but for clarity

            // Sync to orders using the status synchronizer
            await syncShipmentStatusToOrders(shipment.id, syncStatus);

            // Reload shipment with updated data
            await shipment.reload();

            res.json({
                success: true,
                message: 'Expédition actualisée avec succès et statuts propagés',
                data: shipment
            });
        } catch (error) {
            console.error('Error in manual update:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour manuelle' });
        }
    },

    refreshTracking: async (req, res) => {
        try {
            const shipment = await Shipment.findByPk(req.params.id);
            if (!shipment) {
                return res.status(404).json({ success: false, message: 'Expédition non trouvée' });
            }

            const VoyageTrackingService = require('../services/voyageTrackingService');

            // Determine logical voyage name
            let voyageName = shipment.voyage;
            if (!voyageName && shipment.voyageId) {
                const Voyage = require('../models/Voyage');
                const v = await Voyage.findByPk(shipment.voyageId);
                if (v) voyageName = v.name;
            }

            if (!voyageName) {
                // Fallback: If no voyage linked, try individual tracking (which shouldn't happen much in new logic but safe to have)
                // OR return error saying "Aucun voyage lié"
                // Let's try to track individually using the container service directly if no voyage
                const containerTrackingService = require('../services/containerTrackingService');
                const result = await containerTrackingService.trackContainer(shipment.blNumber || shipment.containerNumber, !!shipment.blNumber);

                if (!result || result.status === 'Tracking Error' || result.status === 'No API Key') {
                    return res.status(400).json({ success: false, message: 'Tracking impossible (Pas de voyage ni de tracking direct réussi)' });
                }

                // Determine mapped status
                const mappedStatus = result.status || shipment.status;
                const lowerStatus = (mappedStatus || '').toLowerCase();
                const isArrived = lowerStatus === 'arrivé' || lowerStatus === 'arrivée' || lowerStatus === 'arrived' || lowerStatus.includes('discharge');

                // Prepare update object
                const updateData = {
                    status: mappedStatus,
                    shipStatus: result.vesselName || shipment.shipStatus, // vessel name
                    eta: result.eta || shipment.eta,
                    etd: result.etd || shipment.etd,
                    loadingPort: result.loadingPort || shipment.loadingPort,
                    destination: result.unloadingPort || shipment.destination,
                    currentLat: result.location?.lat,
                    currentLng: result.location?.lng,
                    trackingHistory: JSON.stringify(result.events || []),
                    lastUpdate: new Date()
                };

                // Auto-set arrival date when status becomes 'Arrivé'
                if (isArrived && !shipment.arrivalDate) {
                    updateData.arrivalDate = new Date();
                    console.log(`[ShipmentController] Auto-set arrivalDate for individual tracking of shipment ${shipment.id}`);
                }

                // Update just this shipment with all available tracking data
                await shipment.update(updateData);

                // Sync status to orders to enforce 'ARRIVÉE'
                const { syncShipmentStatusToOrders } = require('../utils/statusSynchronizer');
                if (updateData.status) {
                    await syncShipmentStatusToOrders(shipment.id, updateData.status);
                }

                return res.json({ success: true, message: 'Tracking individuel mis à jour', data: result });
            }

            // Trigger Voyage Refresh
            const result = await VoyageTrackingService.refreshVoyage(voyageName);

            if (!result.success) {
                return res.status(400).json({ success: false, message: 'Erreur lors de l\'actualisation du voyage', details: result });
            }

            // Reload shipment to get updated data
            await shipment.reload();

            res.json({ success: true, message: 'Tracking voyage actualisé avec succès', data: shipment });

        } catch (error) {
            console.error('Error refreshing tracking:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur lors du tracking' });
        }
    }
};

module.exports = shipmentsController;
