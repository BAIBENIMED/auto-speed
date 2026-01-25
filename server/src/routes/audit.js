const express = require('express');
const router = express.Router();
const { AuditLog, User } = require('../models');
const { authMiddleware, isAdmin } = require('../middleware/auth');

router.use(authMiddleware);
router.use(isAdmin);

router.get('/', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const logs = await AuditLog.findAll({
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
