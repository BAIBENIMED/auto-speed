const express = require('express');
const router = express.Router();
const { Notification } = require('../models');

// Get all notifications
router.get('/', async (req, res) => {
    try {
        const notifications = await Notification.findAll({
            order: [['createdAt', 'DESC']],
            limit: 50 // Limit to last 50 notifications
        });
        res.json({ success: true, data: notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de la récupération des notifications' });
    }
});

// Mark as read
router.put('/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        await Notification.update({ isRead: true }, { where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating notification:', error);
        res.status(500).json({ success: false, message: 'Erreur' });
    }
});

module.exports = router;
