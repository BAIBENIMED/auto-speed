const express = require('express');
const router = express.Router();
const showroomController = require('../controllers/showroomController');

router.get('/', showroomController.getAll);
router.post('/', showroomController.create);
router.put('/:id', showroomController.update);
router.delete('/:id', showroomController.delete);

module.exports = router;
