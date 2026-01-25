const { User, Role } = require('../models');

// Get all users
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.findAll({
            include: [{ model: Role, as: 'role' }],
            attributes: { exclude: ['password'] }
        });
        res.json({ success: true, data: users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

// Create user
exports.createUser = async (req, res) => {
    try {
        const { id, username, password, name, roleId } = req.body;

        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Username déjà utilisé.' });
        }

        const user = await User.create({ id, username, password, name, roleId });
        const userWithRole = await User.findByPk(user.id, {
            include: [{ model: Role, as: 'role' }],
            attributes: { exclude: ['password'] }
        });

        res.status(201).json({ success: true, data: userWithRole });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

// Update user
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password, name, roleId } = req.body;

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
        }

        await user.update({ username, password, name, roleId });
        const updatedUser = await User.findByPk(id, {
            include: [{ model: Role, as: 'role' }],
            attributes: { exclude: ['password'] }
        });

        res.json({ success: true, data: updatedUser });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

// Delete user
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findByPk(id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
        }

        if (user.username === 'admin') {
            return res.status(403).json({ success: false, message: 'Impossible de supprimer l\'admin.' });
        }

        await user.destroy();
        res.json({ success: true, message: 'Utilisateur supprimé.' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

// Reset Admin Password (Safety tool)
exports.resetAdminPassword = async (req, res) => {
    try {
        const admin = await User.findOne({ where: { username: 'admin' } });
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Compte admin non trouvé.' });
        }

        // Set a recognizable default password
        admin.password = 'admin123';
        await admin.save(); // Hook beforeUpdate will hash it

        res.json({
            success: true,
            message: 'Le mot de passe de l\'administrateur a été réinitialisé à "admin123".'
        });
    } catch (error) {
        console.error('Reset admin password error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};
