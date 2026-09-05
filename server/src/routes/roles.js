const express = require('express');
const router = express.Router();
const rolesController = require('../controllers/rolesController');
const { authMiddleware, isAdmin } = require('../middleware/auth');

// List roles (any authenticated user)
router.get('/', authMiddleware, rolesController.getAll);

// Create/update/delete roles & permissions (admins only)
router.post('/', authMiddleware, isAdmin, rolesController.create);
router.put('/:id', authMiddleware, isAdmin, rolesController.update);
router.delete('/:id', authMiddleware, isAdmin, rolesController.delete);

module.exports = router;
