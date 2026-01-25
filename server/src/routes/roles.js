const express = require('express');
const router = express.Router();
const rolesController = require('../controllers/rolesController');
const { authMiddleware } = require('../middleware/auth');

// List roles (authenticated users only)
router.get('/', authMiddleware, rolesController.getAll);

// Create role (authenticated users only)
router.post('/', authMiddleware, rolesController.create);

// Update role (authenticated users only)
router.put('/:id', authMiddleware, rolesController.update);

// Delete role (authenticated users only)
router.delete('/:id', authMiddleware, rolesController.delete);

module.exports = router;
