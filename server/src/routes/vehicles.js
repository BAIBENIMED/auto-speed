const express = require('express');
const router = express.Router();
const vehiclesController = require('../controllers/vehiclesController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', vehiclesController.getAll);
router.get('/:id', vehiclesController.getById);
router.post('/', vehiclesController.create);
router.put('/:id', vehiclesController.update);
router.delete('/:id', vehiclesController.delete);
router.patch('/:id/archive', vehiclesController.archive);
router.post('/:id/transfer', vehiclesController.transfer);
router.get('/:id/transfers', vehiclesController.getTransfers);

module.exports = router;
