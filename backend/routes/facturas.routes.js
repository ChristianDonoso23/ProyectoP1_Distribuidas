const express = require('express');
const router = express.Router();
const facturaController = require('../controller/facturaController');

router.post('/', facturaController.generarFactura);

// NUEVO: Endpoint para que admin confirme pago
router.post('/admin/confirmar-pago', facturaController.confirmarPagoAdmin);
// Cliente puede pedir la cuenta para varias reservas a la vez
router.post('/pedir-cuenta', facturaController.pedirCuenta);

module.exports = router;