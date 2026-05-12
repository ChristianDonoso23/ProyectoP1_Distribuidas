const express = require('express');
const router = express.Router();
const mesaController = require('../controller/mesaController');

router.get('/', mesaController.getMesas);
router.get('/:id', mesaController.getMesaPorId);

module.exports = router;