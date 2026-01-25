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

        console.log('✅ User found:', user.username);
        console.log('🔒 Stored hash:', user.password);

        // Check password
        const isPasswordValid = await user.comparePassword(password);
        console.log('🔐 Password valid:', isPasswordValid);

        if (!isPasswordValid) {
            console.log('❌ Password mismatch');
            return res.status(401).json({
                success: false,
                message: 'Identifiants incorrects.'
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
            message: 'Erreur serveur lors de la connexion.',
            debug_info: {
                error: error.message,
                name: error.name,
                stack: error.stack
            }
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
