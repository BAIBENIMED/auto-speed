const express = require('express');
const router = express.Router();
const purchaseOrdersController = require('../controllers/purchaseOrdersController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', purchaseOrdersController.getAll);
router.post('/', purchaseOrdersController.create);
router.put('/:id', purchaseOrdersController.update);
router.delete('/:id', purchaseOrdersController.delete);

module.exports = router;
