const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brandController');

router.get('/', brandController.getAll);
router.post('/', brandController.create);
router.put('/:id', brandController.update);
router.delete('/:id', brandController.delete);

router.post('/:brandId/models', brandController.addModel);
router.delete('/models/:modelId', brandController.deleteModel);

router.post('/models/:modelId/trims', brandController.addTrim);
router.delete('/trims/:trimId', brandController.deleteTrim);
router.put('/trims/:trimId', brandController.updateTrim);

module.exports = router;
