const { Role } = require('../models');

const rolesController = {
    getAll: async (req, res) => {
        try {
            const roles = await Role.findAll();
            res.json({ success: true, data: roles });
        } catch (error) {
            console.error('Error fetching roles:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la récupération des rôles' });
        }
    },

    update: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, permissions } = req.body;

            const role = await Role.findByPk(id);
            if (!role) {
                return res.status(404).json({ success: false, message: 'Rôle non trouvé' });
            }

            await role.update({ name, permissions });
            res.json({ success: true, data: role });
        } catch (error) {
            console.error('Error updating role:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour du rôle' });
        }
    },

    create: async (req, res) => {
        try {
            const { id, name, permissions } = req.body;
            const newRole = await Role.create({ id, name, permissions });
            res.status(201).json({ success: true, data: newRole });
        } catch (error) {
            console.error('Error creating role:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la création du rôle' });
        }
    },

    delete: async (req, res) => {
        try {
            const { id } = req.params;
            if (id === 'admin') {
                return res.status(403).json({ success: false, message: 'Impossible de supprimer le rôle administrateur' });
            }
            const deleted = await Role.destroy({ where: { id } });
            if (!deleted) {
                return res.status(404).json({ success: false, message: 'Rôle non trouvé' });
            }
            res.json({ success: true, message: 'Rôle supprimé avec succès' });
        } catch (error) {
            console.error('Error deleting role:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la suppression du rôle' });
        }
    }
};

module.exports = rolesController;
