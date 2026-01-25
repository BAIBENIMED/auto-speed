const express = require('express');
const router = express.Router();
const shipmentsController = require('../controllers/shipmentsController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', shipmentsController.getAll);
router.get('/:id', shipmentsController.getById);
router.post('/', shipmentsController.create);
router.put('/:id', shipmentsController.update);
router.delete('/:id', shipmentsController.delete);

module.exports = router;
