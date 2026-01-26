const express = require('express');
const router = express.Router();
const shipmentsController = require('../controllers/shipmentsController');
const { authMiddleware } = require('../middleware/auth');

// Conditional auth middleware - skip for public routes
const conditionalAuth = (req, res, next) => {
    const publicPaths = ['/tracking', '/status', '/test-signal'];
    if (publicPaths.includes(req.path)) {
        return next();
    }
    return authMiddleware(req, res, next);
};

// Apply conditional auth to all routes
router.use(conditionalAuth);

// Public tracking routes (no auth required)
router.get('/tracking', shipmentsController.getTrackingData);
router.get('/status', shipmentsController.getTrackingStatus);
router.post('/test-signal', shipmentsController.testTrackingSignal);

// Protected routes (auth required)
router.get('/', shipmentsController.getAll);
router.get('/:id', shipmentsController.getById);
router.post('/', shipmentsController.create);
router.put('/:id', shipmentsController.update);
router.delete('/:id', shipmentsController.delete);

module.exports = router;
