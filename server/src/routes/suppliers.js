const express = require('express');
const router = express.Router();
const suppliersController = require('../controllers/suppliersController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', suppliersController.getAll);
router.post('/', suppliersController.create);
router.put('/:id', suppliersController.update);
router.delete('/:id', suppliersController.delete);

module.exports = router;
