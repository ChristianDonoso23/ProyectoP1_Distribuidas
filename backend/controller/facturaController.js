const Factura = require('../models/Factura');
const Mesa = require('../models/Mesa');
const Evento = require('../models/Evento');
const Reserva = require('../models/Reserva');
const { broadcast } = require('../services/websocketService');

exports.generarFactura = async (req, res) => {
    const { id_reserva, id_mesa, cliente_id, nombre_cliente, metodo_pago } = req.body;

    try {
        const reserva = await Reserva.getById(id_reserva);

        if (!reserva) {
            return res.status(404).json({ success: false, message: 'La reserva no existe' });
        }

        if (parseInt(reserva.id_mesa) !== parseInt(id_mesa)) {
            return res.status(400).json({ success: false, message: 'La reserva no corresponde a la mesa indicada' });
        }

        if (cliente_id && String(reserva.cliente_id || '').trim() !== String(cliente_id).trim()) {
            return res.status(403).json({ success: false, message: 'La reserva pertenece a otro cliente' });
        }

        if (String(reserva.nombre_cliente).trim() !== String(nombre_cliente).trim()) {
            return res.status(403).json({ success: false, message: 'La reserva pertenece a otro cliente' });
        }

        // Obtener datos de la mesa para el precio si no envían subtotal
        const mesa = await Mesa.getById(id_mesa);
        const subtotalCalc = req.body.subtotal ? parseFloat(req.body.subtotal) : parseFloat(mesa.precio_base);
        const impuestos = subtotalCalc * 0.15; // Ejemplo 15% IVA
        const total = subtotalCalc + impuestos;

        const facturaData = {
            id_reserva,
            id_mesa,
            nombre_cliente,
            detalle_mesa: `Mesa ${mesa.numero_mesa} - Zona ${mesa.zona}`,
            subtotal: subtotalCalc,
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

// NUEVO: Endpoint para que ADMIN confirme pago y genere factura
exports.confirmarPagoAdmin = async (req, res) => {
    const { id_reserva, metodo_pago } = req.body;

    try {
        if (!id_reserva || !metodo_pago) {
            return res.status(400).json({ success: false, message: 'Faltan campos: id_reserva, metodo_pago' });
        }

        const reserva = await Reserva.getById(id_reserva);

        if (!reserva) {
            return res.status(404).json({ success: false, message: 'La reserva no existe' });
        }

        if (reserva.estado !== 'pendiente') {
            return res.status(400).json({ success: false, message: `La reserva ya fue ${reserva.estado}` });
        }

        // Cambiar estado a confirmada
        await Reserva.updateEstado(id_reserva, 'confirmada');

        // Obtener datos de la mesa
        const mesa = await Mesa.getById(reserva.id_mesa);
        const subtotal = parseFloat(mesa.precio_base);
        const impuestos = subtotal * 0.15;
        const total = subtotal + impuestos;

        // Generar factura
        const facturaData = {
            id_reserva,
            id_mesa: reserva.id_mesa,
            nombre_cliente: reserva.nombre_cliente,
            detalle_mesa: `Mesa ${mesa.numero_mesa} - Zona ${mesa.zona}`,
            subtotal,
            impuestos,
            total_pagado: total,
            metodo_pago
        };

        const id_factura = await Factura.create(facturaData);
        
        // Registrar evento
        await Evento.registrar('PAGO_CONFIRMADO_ADMIN', 'HTTP', `Admin confirmó pago de reserva ${id_reserva}. Factura ${id_factura} generada por $${total}`);

        // Broadcast a todos los clientes que la reserva fue pagada
        broadcast('reserva-pagada', { 
            id_reserva, 
            id_mesa: reserva.id_mesa,
            id_factura,
            cliente_id: reserva.cliente_id 
        });

        res.status(201).json({ 
            success: true, 
            message: 'Pago confirmado y factura generada',
            id_factura,
            data: facturaData 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error al confirmar pago", error: error.message });
    }
};

// NUEVO: Pedir cuenta desde el cliente para un conjunto de reservas
exports.pedirCuenta = async (req, res) => {
    const { id_reservas, cliente_id, nombre_cliente, metodo_pago } = req.body;

    try {
        if (!Array.isArray(id_reservas) || id_reservas.length === 0) {
            return res.status(400).json({ success: false, message: 'Debe enviar un arreglo de id_reservas' });
        }

        let subtotal = 0;
        const numeros = [];
        const mesasAProcesar = [];

        for (const idRes of id_reservas) {
            const reserva = await Reserva.getById(idRes);
            if (!reserva) return res.status(404).json({ success: false, message: `Reserva ${idRes} no encontrada` });
            if (cliente_id && String(reserva.cliente_id || '').trim() !== String(cliente_id).trim()) {
                return res.status(403).json({ success: false, message: `La reserva ${idRes} pertenece a otro cliente` });
            }
            const mesa = await Mesa.getById(reserva.id_mesa);
            subtotal += parseFloat(mesa.precio_base || 0);
            numeros.push(mesa.numero_mesa);
            mesasAProcesar.push({ id_reserva: idRes, id_mesa: reserva.id_mesa });
        }

        const impuestos = parseFloat((subtotal * 0.15).toFixed(2));
        const total = parseFloat((subtotal + impuestos).toFixed(2));

        // Construir detalle por mesa
        const detalle_por_mesa = [];
        for (const idRes of id_reservas) {
            const reserva = await Reserva.getById(idRes);
            const mesa = await Mesa.getById(reserva.id_mesa);
            const precio = parseFloat(mesa.precio_base || 0);
            const impuestosMesa = parseFloat((precio * 0.15).toFixed(2));
            const totalMesa = parseFloat((precio + impuestosMesa).toFixed(2));
            detalle_por_mesa.push({ id_reserva: idRes, id_mesa: reserva.id_mesa, numero_mesa: mesa.numero_mesa, zona: mesa.zona, precio_base: precio, impuestos: impuestosMesa, total: totalMesa });
        }

        // Validar metodo_pago contra ENUM permitido
        const allowedMetodos = ['efectivo', 'tarjeta', 'transferencia'];
        const metodoValido = allowedMetodos.includes(metodo_pago) ? metodo_pago : null;

        const facturaData = {
            id_reserva: null,
            id_mesa: null,
            nombre_cliente,
            detalle_mesa: `Mesas: ${numeros.join(', ')}`,
            subtotal,
            impuestos,
            total_pagado: total,
            metodo_pago: metodoValido
        };

        // Crear factura y asociar reservas
        const id_factura = await Factura.createWithReservas(facturaData, id_reservas);

        // Finalizar reservas y notificar liberación de mesas
        for (const m of mesasAProcesar) {
            await Reserva.updateEstado(m.id_reserva, 'finalizada');
            await Evento.registrar('FINALIZAR_RESERVA', 'HTTP', `Reserva ${m.id_reserva} marcada como finalizada por pedido de cuenta`);
            broadcast('mesa-liberada', { id_mesa: parseInt(m.id_mesa) });
        }

        await Evento.registrar('PEDIR_CUENTA', 'HTTP', `Factura ${id_factura} generada por cliente ${nombre_cliente} - ${numeros.join(', ')}`);

        res.status(201).json({ success: true, id_factura, data: facturaData, items: detalle_por_mesa });
    } catch (error) {
        console.error('[facturaController.pedirCuenta] Error:', error);
        res.status(500).json({ success: false, message: 'Error al generar la factura por pedido de cuenta', error: error.message });
    }
};