const express = require('express');
const router = express.Router();
const cashController = require('../controllers/cashController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', cashController.getAll);
router.post('/', cashController.create);
router.put('/:id', cashController.update);
router.delete('/:id', cashController.delete);

module.exports = router;
