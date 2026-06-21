const express = require('express');
const router = express.Router();
const reservaController = require('../controller/reservaController');

router.post('/', reservaController.crearReserva);
router.put('/:id/finalizar', reservaController.finalizarReserva);
router.post('/admin/liberar-todas', reservaController.liberarTodasLasMesas);

router.get('/admin/pendientes', reservaController.obtenerReservasPendientes);

module.exports = router;