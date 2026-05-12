const Factura = require('../models/Factura');
const Mesa = require('../models/Mesa');
const Evento = require('../models/Evento');

exports.generarFactura = async (req, res) => {
    const { id_reserva, id_mesa, nombre_cliente, metodo_pago } = req.body;

    try {
        // Obtener datos de la mesa para el precio
        const mesa = await Mesa.getById(id_mesa);
        const subtotal = parseFloat(mesa.precio_base);
        const impuestos = subtotal * 0.15; // Ejemplo 15% IVA
        const total = subtotal + impuestos;

        const facturaData = {
            id_reserva,
            id_mesa,
            nombre_cliente,
            detalle_mesa: `Mesa ${mesa.numero_mesa} - Zona ${mesa.zona}`,
            subtotal,
            impuestos,
            total_pagado: total,
            metodo_pago
        };

        const id_factura = await Factura.create(facturaData);
        await Evento.registrar('GENERACION_FACTURA', 'MYSQL', `Factura ${id_factura} generada por $${total}`);

        res.status(201).json({ success: true, data: facturaData, id_factura });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error al facturar", error: error.message });
    }
};