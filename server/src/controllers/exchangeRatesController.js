const { ExchangeRate } = require('../models');

const exchangeRatesController = {
    getAll: async (req, res) => {
        try {
            const rates = await ExchangeRate.findAll({ order: [['date', 'DESC']] });
            res.json({ success: true, data: rates });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erreur lors de la récupération des taux' });
        }
    },

    create: async (req, res) => {
        try {
            const rate = await ExchangeRate.create(req.body);
            res.status(201).json({ success: true, data: rate });
        } catch (error) {
            res.status(400).json({ success: false, message: 'Erreur lors de la création du taux' });
        }
    },

    update: async (req, res) => {
        try {
            const rate = await ExchangeRate.findByPk(req.params.id);
            if (!rate) {
                return res.status(404).json({ success: false, message: 'Taux non trouvé' });
            }
            await rate.update(req.body);
            res.json({ success: true, data: rate });
        } catch (error) {
            res.status(400).json({ success: false, message: 'Erreur lors de la mise à jour du taux' });
        }
    },

    delete: async (req, res) => {
        try {
            const rate = await ExchangeRate.findByPk(req.params.id);
            if (!rate) {
                return res.status(404).json({ success: false, message: 'Taux non trouvé' });
            }
            await rate.destroy();
            res.json({ success: true, message: 'Taux supprimé' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erreur lors de la suppression du taux' });
        }
    }
};

module.exports = exchangeRatesController;
