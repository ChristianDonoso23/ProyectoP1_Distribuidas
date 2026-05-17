const express = require('express');
const router = express.Router();
const eventoController = require('../controller/eventoController');

router.get('/', eventoController.getEventos);

module.exports = router;