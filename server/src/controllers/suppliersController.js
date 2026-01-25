const { Supplier } = require('../models');

const suppliersController = {
    getAll: async (req, res) => {
        try {
            const suppliers = await Supplier.findAll({
                order: [['name', 'ASC']]
            });
            res.json({ success: true, data: suppliers });
        } catch (error) {
            console.error('Error fetching suppliers:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la récupération des fournisseurs' });
        }
    },

    create: async (req, res) => {
        try {
            const supplier = await Supplier.create(req.body);
            res.status(201).json({ success: true, data: supplier });
        } catch (error) {
            console.error('Error creating supplier:', error);
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({ success: false, message: 'Ce code fournisseur existe déjà.' });
            }
            res.status(500).json({ success: false, message: 'Erreur lors de la création du fournisseur' });
        }
    },

    update: async (req, res) => {
        try {
            const { id } = req.params;
            const supplier = await Supplier.findByPk(id);
            if (!supplier) {
                return res.status(404).json({ success: false, message: 'Fournisseur non trouvé' });
            }

            await supplier.update(req.body);
            res.json({ success: true, data: supplier });
        } catch (error) {
            console.error('Error updating supplier:', error);
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({ success: false, message: 'Ce code fournisseur est déjà utilisé.' });
            }
            res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour du fournisseur' });
        }
    },

    delete: async (req, res) => {
        try {
            const { id } = req.params;
            const supplier = await Supplier.findByPk(id);
            if (!supplier) {
                return res.status(404).json({ success: false, message: 'Fournisseur non trouvé' });
            }

            await supplier.destroy();
            res.json({ success: true, message: 'Fournisseur supprimé' });
        } catch (error) {
            console.error('Error deleting supplier:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la suppression du fournisseur' });
        }
    }
};

module.exports = suppliersController;
