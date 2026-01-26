const { Shipment, Vehicle, Order } = require('../models');

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
            await shipment.update(req.body);
            // Handle vehicle updates if necessary
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
    }
};

module.exports = shipmentsController;
