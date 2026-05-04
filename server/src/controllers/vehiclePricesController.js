const { VehiclePrice, VehicleTrim, Supplier, VehicleModel, Brand } = require('../models');
const { v4: uuidv4 } = require('uuid');

const vehiclePricesController = {
    getAll: async (req, res) => {
        try {
            const prices = await VehiclePrice.findAll({
                include: [
                    {
                        model: VehicleTrim,
                        as: 'trim',
                        include: [{
                            model: VehicleModel,
                            as: 'model',
                            include: [{ model: Brand, as: 'brand' }]
                        }]
                    },
                    {
                        model: Supplier,
                        as: 'supplier'
                    }
                ],
                order: [['date', 'DESC']]
            });
            res.json({ success: true, data: prices });
        } catch (error) {
            console.error('Error fetching vehicle prices:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la récupération des prix' });
        }
    },

    create: async (req, res) => {
        try {
            const { trimId, supplierId, date, notes } = req.body;
            const priceUSD = req.body.priceUSD || 0;
            const priceDzdNeuf = req.body.priceDzdNeuf ? req.body.priceDzdNeuf : null;
            const priceDzd3Ans = req.body.priceDzd3Ans ? req.body.priceDzd3Ans : null;

            const price = await VehiclePrice.create({
                id: `vp-${Date.now()}`,
                trimId,
                supplierId,
                priceUSD,
                priceDzdNeuf,
                priceDzd3Ans,
                date,
                notes
            });
            res.status(201).json({ success: true, data: price });
        } catch (error) {
            console.error('Error creating vehicle price:', error);
            res.status(400).json({ success: false, message: 'Erreur lors de la création du prix' });
        }
    },

    update: async (req, res) => {
        try {
            const price = await VehiclePrice.findByPk(req.params.id);
            if (!price) {
                return res.status(404).json({ success: false, message: 'Prix non trouvé' });
            }

            const updateData = { ...req.body };
            if (updateData.priceDzdNeuf === '') updateData.priceDzdNeuf = null;
            if (updateData.priceDzd3Ans === '') updateData.priceDzd3Ans = null;

            await price.update(updateData);
            res.json({ success: true, data: price });
        } catch (error) {
            console.error('Error updating vehicle price:', error);
            res.status(400).json({ success: false, message: 'Erreur lors de la mise à jour du prix' });
        }
    },

    delete: async (req, res) => {
        try {
            const price = await VehiclePrice.findByPk(req.params.id);
            if (!price) {
                return res.status(404).json({ success: false, message: 'Prix non trouvé' });
            }
            await price.destroy();
            res.json({ success: true, message: 'Prix supprimé' });
        } catch (error) {
            console.error('Error deleting vehicle price:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la suppression du prix' });
        }
    }
};

module.exports = vehiclePricesController;
