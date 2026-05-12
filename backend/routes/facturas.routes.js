const express = require('express');
const router = express.Router();
const facturaController = require('../controller/facturaController');

router.post('/', facturaController.generarFactura);

module.exports = router;