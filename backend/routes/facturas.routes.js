const express = require('express');
const router = express.Router();
const facturaController = require('../controller/facturaController');

router.post('/', facturaController.generarFactura);

router.post('/admin/confirmar-pago', facturaController.confirmarPagoAdmin);

router.post('/pedir-cuenta', facturaController.pedirCuenta);

module.exports = router;