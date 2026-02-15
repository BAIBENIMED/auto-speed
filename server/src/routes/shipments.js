const express = require('express');
const router = express.Router();
const shipmentsController = require('../controllers/shipmentsController');
const { authMiddleware } = require('../middleware/auth');

// ===== PUBLIC ROUTES (NO AUTH) =====
// These MUST be defined BEFORE router.use(authMiddleware)
router.get('/tracking', shipmentsController.getTrackingData);


// ===== PROTECTED ROUTES (AUTH REQUIRED) =====
// Apply auth middleware to all remaining routes
router.use(authMiddleware);

router.get('/', shipmentsController.getAll);
router.get('/:id', shipmentsController.getById);
router.post('/', shipmentsController.create);
router.put('/:id', shipmentsController.update);
router.post('/:id/manual-update', shipmentsController.manualUpdate);
router.post('/:id/tracking', shipmentsController.refreshTracking); // Auto-refresh via Voyage
router.delete('/:id', shipmentsController.delete);

module.exports = router;
