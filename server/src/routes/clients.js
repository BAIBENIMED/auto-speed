const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { authMiddleware, checkPermission } = require('../middleware/auth');

// All routes require authentication and clients permission
router.use(authMiddleware, checkPermission('clients'));

router.get('/', clientController.getAll);
router.post('/', clientController.create);
router.put('/:id', clientController.update);
router.delete('/:id', clientController.delete);

module.exports = router;
