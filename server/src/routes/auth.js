const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 tentatives par IP par fenêtre
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' }
});

// Public routes
router.post('/login', loginLimiter, authController.login);

// Protected routes
router.post('/logout', authMiddleware, authController.logout);
router.get('/me', authMiddleware, authController.me);

module.exports = router;
