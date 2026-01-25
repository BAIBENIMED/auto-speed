const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');

router.get('/', settingsController.getSettings);
router.put('/', settingsController.updateSettings);
router.get('/attributes', settingsController.getAttributes);
router.post('/attributes', settingsController.addAttribute);
router.put('/attributes/:id', settingsController.updateAttribute);
router.delete('/attributes/:id', settingsController.deleteAttribute);

module.exports = router;
