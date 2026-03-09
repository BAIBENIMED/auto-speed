const { Vehicle, Order, Shipment } = require('../models');

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
    }
};

module.exports = vehiclesController;
