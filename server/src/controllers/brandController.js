const { Brand, VehicleModel, VehicleTrim } = require('../models');

const brandController = {
    getAll: async (req, res) => {
        try {
            const brands = await Brand.findAll({
                include: [{ 
                    model: VehicleModel, 
                    as: 'models',
                    include: [{ model: VehicleTrim, as: 'trims' }]
                }],
                order: [['name', 'ASC']]
            });
            res.json({ success: true, data: brands });
        } catch (error) {
            console.error('Error fetching brands (with trims):', error.name, error.message);
            try {
                // Fallback: try without trims if the table doesn't exist yet
                const brands = await Brand.findAll({
                    include: [{ model: VehicleModel, as: 'models' }],
                    order: [['name', 'ASC']]
                });
                return res.json({ success: true, data: brands, warning: `Les finitions n'ont pas pu être chargées (${error.message}).` });
            } catch (fallbackError) {
                console.error('Error fetching brands (fallback):', fallbackError);
                res.status(500).json({ success: false, message: 'Erreur lors de la récupération des marques' });
            }
        }
    },

    create: async (req, res) => {
        try {
            const { id, name, logo } = req.body;
            // Use provided ID or generate one
            const finalId = id || `brand_${Date.now()}`;
            const brand = await Brand.create({ id: finalId, name, logo });
            res.status(201).json({ success: true, data: brand });
        } catch (error) {
            console.error("Brand Create Error:", error);
            res.status(400).json({ success: false, message: error.message || 'Erreur lors de la création de la marque' });
        }
    },

    update: async (req, res) => {
        try {
            const brand = await Brand.findByPk(req.params.id);
            if (!brand) return res.status(404).json({ success: false, message: 'Marque non trouvée' });
            await brand.update(req.body);
            res.json({ success: true, data: brand });
        } catch (error) {
            res.status(400).json({ success: false, message: 'Erreur lors de la modification' });
        }
    },

    delete: async (req, res) => {
        try {
            const brand = await Brand.findByPk(req.params.id);
            if (!brand) return res.status(404).json({ success: false, message: 'Marque non trouvée' });
            await brand.destroy();
            res.json({ success: true, message: 'Marque supprimée' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
        }
    },

    // Model Management
    addModel: async (req, res) => {
        try {
            const { name } = req.body;
            const brandId = req.params.brandId;
            const id = `model_${brandId}_${Date.now()}`;
            const model = await VehicleModel.create({ id, brandId, name });
            res.status(201).json({ success: true, data: model });
        } catch (error) {
            res.status(400).json({ success: false, message: 'Erreur lors de l\'ajout du modèle' });
        }
    },

    deleteModel: async (req, res) => {
        try {
            const model = await VehicleModel.findByPk(req.params.modelId);
            if (!model) return res.status(404).json({ success: false, message: 'Modèle non trouvé' });
            await model.destroy();
            res.json({ success: true, message: 'Modèle supprimé' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erreur lors de la suppression du modèle' });
        }
    },

    // Trim (Finition) Management
    addTrim: async (req, res) => {
        try {
            const { name, characteristics } = req.body;
            const modelId = req.params.modelId;
            const id = `trim_${modelId}_${Date.now()}`;
            console.log(`🆕 Creating trim: ${name} for model ${modelId} with ID: ${id}`);
            const trim = await VehicleTrim.create({ id, modelId, name, characteristics });
            res.status(201).json({ success: true, data: trim });
        } catch (error) {
            console.error('Error adding trim:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur lors de l\'ajout de la finition',
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    },

    deleteTrim: async (req, res) => {
        try {
            const trim = await VehicleTrim.findByPk(req.params.trimId);
            if (!trim) return res.status(404).json({ success: false, message: 'Finition non trouvée' });
            await trim.destroy();
            res.json({ success: true, message: 'Finition supprimée' });
        } catch (error) {
            console.error('Error deleting trim:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la suppression de la finition' });
        }
    },

    updateTrim: async (req, res) => {
        try {
            const trim = await VehicleTrim.findByPk(req.params.trimId);
            if (!trim) return res.status(404).json({ success: false, message: 'Finition non trouvée' });
            await trim.update(req.body);
            res.json({ success: true, data: trim });
        } catch (error) {
            console.error('Error updating trim:', error);
            res.status(400).json({ success: false, message: 'Erreur lors de la modification de la finition' });
        }
    }
};

module.exports = brandController;
