const express = require('express');
const router = express.Router();
const reservaController = require('../controller/reservaController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/', authMiddleware, reservaController.crearReserva);
router.post('/', reservaController.crearReserva);
router.put('/:id/finalizar', authMiddleware, reservaController.finalizarReserva);
router.post('/admin/liberar-todas', reservaController.liberarTodasLasMesas);

router.get('/admin/pendientes', reservaController.obtenerReservasPendientes);

module.exports = router;