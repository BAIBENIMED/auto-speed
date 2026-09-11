const express = require('express');
const router = express.Router();
const { AuditLog, User } = require('../models');
const { authMiddleware, isAdmin } = require('../middleware/auth');

router.use(authMiddleware);

// Le journal complet reste reserve aux administrateurs ; l'historique d'une
// fiche precise (entity + entityId) est accessible a qui peut voir la fiche.
router.get('/', async (req, res) => {
    try {
        const { limit = 50, offset = 0, entity, entityId } = req.query;

        if (!entityId && !(req.user && req.user.roleId === 'admin')) {
            return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs' });
        }

        const where = {};
        if (entity) where.entity = entity;
        if (entityId) where.entityId = String(entityId);
        const logs = await AuditLog.findAll({
            where,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']],
            include: [{ model: User, as: 'user', attributes: ['name', 'username'] }]
        });
        res.json({ success: true, data: logs });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de la récupération du journal d\'audit' });
    }
});

module.exports = router;
