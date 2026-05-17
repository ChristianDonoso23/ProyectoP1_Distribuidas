const express = require('express');
const router = express.Router();
const reservaController = require('../controller/reservaController');

router.post('/', reservaController.crearReserva);
router.put('/:id/finalizar', reservaController.finalizarReserva);

module.exports = router;