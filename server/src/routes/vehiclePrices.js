const express = require('express');
const router = express.Router();
const vehiclePricesController = require('../controllers/vehiclePricesController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/dashboard', vehiclePricesController.getDashboard);
router.get('/', vehiclePricesController.getAll);
router.post('/', vehiclePricesController.create);
router.put('/:id', vehiclePricesController.update);
router.delete('/:id', vehiclePricesController.delete);

module.exports = router;

