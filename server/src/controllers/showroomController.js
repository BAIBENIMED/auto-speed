const { Showroom } = require('../models');

const showroomController = {
    getAll: async (req, res) => {
        try {
            const showrooms = await Showroom.findAll({ order: [['name', 'ASC']] });
            res.json({ success: true, data: showrooms });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erreur lors de la récupération des showrooms' });
        }
    },

    create: async (req, res) => {
        try {
            const { id } = req.body;
            const finalId = id || `showroom_${Date.now()}`;
            const showroom = await Showroom.create({ id: finalId, ...req.body });
            res.status(201).json({ success: true, data: showroom });
        } catch (error) {
            console.error("Showroom Create Error:", error);
            res.status(400).json({ success: false, message: error.message || 'Erreur lors de la création du showroom' });
        }
    },

    update: async (req, res) => {
        try {
            const showroom = await Showroom.findByPk(req.params.id);
            if (!showroom) return res.status(404).json({ success: false, message: 'Showroom non trouvé' });
            await showroom.update(req.body);
            res.json({ success: true, data: showroom });
        } catch (error) {
            res.status(400).json({ success: false, message: 'Erreur lors de la modification' });
        }
    },

    delete: async (req, res) => {
        try {
            const showroom = await Showroom.findByPk(req.params.id);
            if (!showroom) return res.status(404).json({ success: false, message: 'Showroom non trouvé' });
            await showroom.destroy();
            res.json({ success: true, message: 'Showroom supprimé' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
        }
    }
};

module.exports = showroomController;
