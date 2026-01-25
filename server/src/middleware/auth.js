const jwt = require('jsonwebtoken');
const { User, Role } = require('../models');

const authMiddleware = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Accès refusé. Token manquant.'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer '

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from database
        const user = await User.findByPk(decoded.id, {
            include: [{
                model: Role,
                as: 'role'
            }],
            attributes: { exclude: ['password'] }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Utilisateur non trouvé.'
            });
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Token invalide.'
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expiré.'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur.'
        });
    }
};

// Middleware to check permissions
const checkPermission = (requiredPermission) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé.'
            });
        }

        const userPermissions = req.user.role.permissions || [];

        if (!userPermissions.includes(requiredPermission) && !userPermissions.includes('all')) {
            return res.status(403).json({
                success: false,
                message: `Vous n'avez pas la permission d'accéder à cette ressource.`
            });
        }

        next();
    };
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (!req.user || req.user.roleId !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Accès réservé aux administrateurs.'
        });
    }
    next();
};

module.exports = { authMiddleware, checkPermission, isAdmin };
