const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', ordersController.getAll);
router.get('/:id', ordersController.getById);
router.post('/', ordersController.create);
router.put('/:id', ordersController.update);
router.delete('/:id', ordersController.delete);
router.patch('/:id/validate', ordersController.validate);
router.patch('/:id/resend-confirmation', ordersController.resendConfirmation);

module.exports = router;
