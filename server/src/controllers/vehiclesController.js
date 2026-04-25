const { Vehicle, Order, Shipment, VehicleTransfer, Client } = require('../models');

const vehiclesController = {
    getAll: async (req, res) => {
        try {
            const { archived } = req.query;
            const where = {};
            if (archived !== undefined) {
                where.isArchived = archived === 'true';
            }
            const isAdminOrCommercial = req.user && ['admin', 'commercial'].includes(req.user.roleId);

            const orderInclude = {
                model: Order,
                as: 'order',
                required: !isAdminOrCommercial // INNER JOIN for clients (must have order), LEFT JOIN for admins
            };

            if (!isAdminOrCommercial) {
                orderInclude.where = { clientId: req.user.clientId };
            }

            const includeOptions = [
                orderInclude,
                { model: Shipment, as: 'shipment' }
            ];

            const vehicles = await Vehicle.findAll({
                where,
                include: includeOptions
            });
            res.json({ success: true, data: vehicles });
        } catch (error) {
            console.error('Error fetching vehicles:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la récupération des véhicules' });
        }
    },

    getById: async (req, res) => {
        try {
            const vehicle = await Vehicle.findByPk(req.params.id, {
                include: ['order', 'shipment']
            });
            if (!vehicle) {
                return res.status(404).json({ success: false, message: 'Véhicule non trouvé' });
            }

            // Check access rights
            if (req.user && !['admin', 'commercial'].includes(req.user.roleId)) {
                const order = await Order.findByPk(vehicle.orderId);
                if (order && order.clientId !== req.user.clientId) {
                    return res.status(403).json({ success: false, message: 'Accès non autorisé' });
                }
            }
            res.json({ success: true, data: vehicle });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erreur lors de la récupération du véhicule' });
        }
    },

    create: async (req, res) => {
        try {
            if (req.user && !['admin', 'commercial'].includes(req.user.roleId)) {
                // Ensure order exists and belongs to client
                if (!req.body.orderId) {
                    return res.status(400).json({ success: false, message: 'OrderId requis' });
                }
                const order = await Order.findByPk(req.body.orderId);
                if (!order || order.clientId !== req.user.clientId) {
                    return res.status(403).json({ success: false, message: 'Accès non autorisé à cette commande' });
                }
            }

            const brand = (req.body.brand || 'UNKNOWN').toUpperCase().replace(/\s+/g, '');
            const { Op } = require('sequelize');
            const lastVehicle = await Vehicle.findOne({
                where: { id: { [Op.like]: `${brand}/%` } },
                order: [['createdAt', 'DESC']]
            });

            let nextSeq = 1;
            if (lastVehicle && lastVehicle.id.includes('/')) {
                const parts = lastVehicle.id.split('/');
                const lastNum = parseInt(parts[1]);
                if (!isNaN(lastNum)) nextSeq = lastNum + 1;
            }

            let finalId = `${brand}/${nextSeq.toString().padStart(5, '0')}`;
            let exists = await Vehicle.findByPk(finalId);
            while (exists) {
                nextSeq++;
                finalId = `${brand}/${nextSeq.toString().padStart(5, '0')}`;
                exists = await Vehicle.findByPk(finalId);
            }

            const vehicle = await Vehicle.create({
                ...req.body,
                id: finalId
            }, {
                userId: req.user.id,
                userName: req.user.name
            });
            res.status(201).json({ success: true, data: vehicle });
        } catch (error) {
            console.error('Error creating vehicle:', error);
            res.status(400).json({ success: false, message: error.message || 'Erreur lors de la création du véhicule' });
        }
    },

    update: async (req, res) => {
        try {
            const vehicle = await Vehicle.findByPk(req.params.id);
            if (!vehicle) {
                return res.status(404).json({ success: false, message: 'Véhicule non trouvé' });
            }

            // Check access rights
            if (req.user && !['admin', 'commercial'].includes(req.user.roleId)) {
                const order = await Order.findByPk(vehicle.orderId);
                if (order && order.clientId !== req.user.clientId) {
                    return res.status(403).json({ success: false, message: 'Accès non autorisé' });
                }
            }

            await vehicle.update(req.body, {
                userId: req.user.id,
                userName: req.user.name
            });
            res.json({ success: true, data: vehicle });
        } catch (error) {
            res.status(400).json({ success: false, message: 'Erreur lors de la mise à jour du véhicule' });
        }
    },

    delete: async (req, res) => {
        try {
            const vehicle = await Vehicle.findByPk(req.params.id);
            if (!vehicle) {
                return res.status(404).json({ success: false, message: 'Véhicule non trouvé' });
            }

            // Check access rights
            if (req.user && !['admin', 'commercial'].includes(req.user.roleId)) {
                const order = await Order.findByPk(vehicle.orderId);
                if (order && order.clientId !== req.user.clientId) {
                    return res.status(403).json({ success: false, message: 'Accès non autorisé' });
                }
            }

            await vehicle.destroy({
                userId: req.user.id,
                userName: req.user.name
            });
            res.json({ success: true, message: 'Véhicule supprimé' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erreur lors de la suppression du véhicule' });
        }
    },

    archive: async (req, res) => {
        try {
            const vehicle = await Vehicle.findByPk(req.params.id);
            if (!vehicle) {
                return res.status(404).json({ success: false, message: 'Véhicule non trouvé' });
            }
            vehicle.isArchived = !vehicle.isArchived;
            await vehicle.save({
                userId: req.user.id,
                userName: req.user.name
            });
            res.json({ success: true, data: vehicle });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erreur lors de l\'archivage' });
        }
    },

    transfer: async (req, res) => {
        try {
            const { toClientId, newClientData, newClient, withBL, amendmentRequestSent, newBLReceived, notes, transferOrderAsWell } = req.body;
            const clientData = newClientData || newClient;
            const vehicle = await Vehicle.findByPk(req.params.id);
            
            if (!vehicle) {
                return res.status(404).json({ success: false, message: 'Véhicule non trouvé' });
            }

            let assignedClientId = toClientId;

            // Handle New Client creation
            if (clientData && Object.keys(clientData).length > 0) {
                const createdClient = await Client.create(clientData, {
                    userId: req.user.id,
                    userName: req.user.name
                });
                assignedClientId = createdClient.id;
            }

            if (!assignedClientId) {
                return res.status(400).json({ success: false, message: 'Un client valide est requis pour le transfert' });
            }

            // Create VehicleTransfer record
            const transferLog = await VehicleTransfer.create({
                vehicleId: vehicle.id,
                fromClientId: vehicle.clientId,
                toClientId: assignedClientId,
                withBL: withBL || false,
                amendmentRequestSent: amendmentRequestSent || false,
                newBLReceived: newBLReceived || false,
                notes: notes || '',
                transferDate: new Date()
            }, {
                userId: req.user.id,
                userName: req.user.name
            });

            // Update Vehicle
            vehicle.clientId = assignedClientId;
            // Unlink original order if the transfer means a distinct sale, or update it
            if (vehicle.orderId && !transferOrderAsWell) {
                // Typically reassigning client without changing order means modifying it directly, but let's just null it or leave it
                // We'll leave order alone unless specified
            }
            await vehicle.save({
                userId: req.user.id,
                userName: req.user.name
            });

            if (transferOrderAsWell && vehicle.orderId) {
                const order = await Order.findByPk(vehicle.orderId);
                if (order) {
                    order.clientId = assignedClientId;
                    await order.save({
                        userId: req.user.id,
                        userName: req.user.name
                    });
                }
            }

            res.json({ success: true, message: 'Véhicule transféré avec succès', data: transferLog });
        } catch (error) {
            console.error('Error transferring vehicle:', error);
            res.status(500).json({ success: false, message: 'Erreur lors du transfert du véhicule' });
        }
    },

    getTransfers: async (req, res) => {
        try {
            const transfers = await VehicleTransfer.findAll({
                where: { vehicleId: req.params.id },
                include: [
                    { model: Client, as: 'fromClient', attributes: ['id', 'firstName', 'lastName', 'phone'] },
                    { model: Client, as: 'toClient', attributes: ['id', 'firstName', 'lastName', 'phone'] }
                ],
                order: [['transferDate', 'DESC']]
            });
            res.json({ success: true, data: transfers });
        } catch (error) {
            console.error('Error fetching transfers:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la récupération de l\'historique' });
        }
    },

    getAllTransfers: async (req, res) => {
        try {
            const transfers = await VehicleTransfer.findAll({
                include: [
                    { model: Client, as: 'fromClient', attributes: ['id', 'firstName', 'lastName'] },
                    { model: Client, as: 'toClient', attributes: ['id', 'firstName', 'lastName'] },
                    { model: Vehicle, attributes: ['id', 'brand', 'model', 'chassisNumber'] }
                ],
                order: [['transferDate', 'DESC']]
            });
            res.json({ success: true, data: transfers });
        } catch (error) {
            console.error('Error fetching all transfers:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la récupération des transferts' });
        }
    },

    updateTransfer: async (req, res) => {
        try {
            const transfer = await VehicleTransfer.findByPk(req.params.transferId);
            if (!transfer) {
                return res.status(404).json({ success: false, message: 'Transfert non trouvé' });
            }

            if (req.body.amendmentRequestSent !== undefined) {
                transfer.amendmentRequestSent = req.body.amendmentRequestSent;
            }
            if (req.body.newBLReceived !== undefined) {
                transfer.newBLReceived = req.body.newBLReceived;
            }

            await transfer.save();
            res.json({ success: true, message: 'Transfert mis à jour', data: transfer });
        } catch (error) {
            console.error('Error updating transfer:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour du transfert' });
        }
    }
};

module.exports = vehiclesController;
