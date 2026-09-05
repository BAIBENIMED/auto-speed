const jwt = require('jsonwebtoken');
const { User, Role } = require('../models');

// Login
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username et password requis.'
            });
        }

        console.log('📝 Login attempt:', { username, passwordProvided: !!password });

        // Find user
        const user = await User.findOne({
            where: { username },
            include: [{
                model: Role,
                as: 'role'
            }]
        });

        if (!user) {
            console.log('❌ User not found in database');
            return res.status(401).json({
                success: false,
                message: 'Identifiants incorrects.'
            });
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            console.log('❌ Password mismatch for user:', username);
            return res.status(401).json({
                success: false,
                message: 'Identifiants incorrects.'
            });
        }

        if (!process.env.JWT_SECRET) {
            console.error('❌ JWT_SECRET manquant dans la configuration serveur.');
            return res.status(500).json({
                success: false,
                message: 'Erreur de configuration serveur.'
            });
        }

        // Generate JWT
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                roleId: user.roleId,
                clientId: user.clientId
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        // Return user info and token
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.roleId,
                clientId: user.clientId,
                permissions: user.role ? user.role.permissions : []
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la connexion.'
        });
    }
};

// Get current user
exports.me = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            include: [{
                model: Role,
                as: 'role'
            }],
            attributes: { exclude: ['password'] }
        });

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.roleId,
                clientId: user.clientId,
                permissions: user.role ? user.role.permissions : []
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur.'
        });
    }
};

// Logout (client-side token removal, but we can log it)
exports.logout = async (req, res) => {
    res.json({
        success: true,
        message: 'Déconnexion réussie.'
    });
};
