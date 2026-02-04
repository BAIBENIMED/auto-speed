const express = require('express');
const router = express.Router();
const voyagesController = require('../controllers/voyagesController');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, voyagesController.getAllVoyages);
router.post('/', authMiddleware, voyagesController.createVoyage);
router.put('/:id', authMiddleware, voyagesController.updateVoyage);
router.delete('/:id', authMiddleware, voyagesController.deleteVoyage);

module.exports = router;
