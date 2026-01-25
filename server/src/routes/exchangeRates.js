const express = require('express');
const router = express.Router();
const exchangeRatesController = require('../controllers/exchangeRatesController');

router.get('/', exchangeRatesController.getAll);
router.post('/', exchangeRatesController.create);
router.put('/:id', exchangeRatesController.update);
router.delete('/:id', exchangeRatesController.delete);

module.exports = router;
