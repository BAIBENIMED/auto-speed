const express = require('express');
const router = express.Router();
const showroomController = require('../controllers/showroomController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', showroomController.getAll);
router.post('/', showroomController.create);
router.put('/:id', showroomController.update);
router.delete('/:id', showroomController.delete);

module.exports = router;
