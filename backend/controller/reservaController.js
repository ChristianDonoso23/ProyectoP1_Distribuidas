const Reserva = require('../models/Reserva');
const Evento = require('../models/Evento');
const { broadcast } = require('../services/websocketService'); // <-- Eslabón perdido añadido

exports.crearReserva = async (req, res) => {
    const { id_mesa, cliente_id, nombre_cliente, expiracion } = req.body;

    // Validar que vengan los campos obligatorios
    if (!id_mesa || !cliente_id || !nombre_cliente) {
        return res.status(400).json({ success: false, message: "Faltan campos requeridos: id_mesa, cliente_id y nombre_cliente" });
    }

    try {
        // 1. Limpiar reservas expiradas de esa mesa (para no bloquearla indefinidamente)
        await Reserva.limpiarExpiradas(id_mesa);

        // 2. Validar disponibilidad (ya excluye expiradas gracias al modelo)
        const disponible = await Reserva.checkDisponibilidad(id_mesa);
        if (!disponible) {
            return res.status(400).json({ success: false, message: "La mesa ya está ocupada o reservada" });
        }

        // 3. Crear reserva
        const id_reserva = await Reserva.create({ id_mesa, cliente_id, nombre_cliente, expiracion });

        // 4. Registrar evento (Trazabilidad)
        await Evento.registrar('CREACION_RESERVA', 'HTTP', `Reserva ${id_reserva} creada para ${nombre_cliente} en mesa ${id_mesa}`);

        // 5. AVISAR A TODA LA RED EN TIEMPO REAL
        broadcast('mesa-ocupada', { id_mesa: parseInt(id_mesa), id_reserva, expiracion, nombre_cliente, cliente_id });

        res.status(201).json({ 
            success: true, 
            message: "Reserva creada exitosamente", 
            id_reserva,
            id_mesa,
            expiracion
        });
    } catch (error) {
        console.error('[reservaController.crearReserva] Error:', error);
        res.status(500).json({ success: false, message: "Error al procesar reserva", error: error.message });
    }
};

exports.finalizarReserva = async (req, res) => {
    try {
        const { id } = req.params;
        const { id_mesa, cliente_id, nombre_cliente } = req.body;

        const reserva = await Reserva.getById(id);

        if (!reserva) {
            return res.status(404).json({ success: false, message: 'La reserva no existe' });
        }

        if (id_mesa && parseInt(reserva.id_mesa) !== parseInt(id_mesa)) {
            return res.status(400).json({ success: false, message: 'La reserva no corresponde a la mesa indicada' });
        }

        if (cliente_id && String(reserva.cliente_id || '').trim() !== String(cliente_id).trim()) {
            return res.status(403).json({ success: false, message: 'La reserva pertenece a otro cliente' });
        }

        if (nombre_cliente && String(reserva.nombre_cliente).trim() !== String(nombre_cliente).trim()) {
            return res.status(403).json({ success: false, message: 'La reserva pertenece a otro cliente' });
        }
        
        // Primero necesitamos saber qué mesa era para liberar el color en React
        // Como tu modelo Reserva no tiene getById, asumimos que el body trae el id_mesa (o lo adaptas luego)
        // Por ahora, solo cambiamos el estado.
        await Reserva.updateEstado(id, 'finalizada');
        await Evento.registrar('FINALIZAR_RESERVA', 'HTTP', `Reserva ${id} marcada como finalizada`);
        
        if (id_mesa) {
            broadcast('mesa-liberada', { id_mesa: parseInt(id_mesa) });
        }

        res.json({ success: true, message: "Reserva finalizada" });
    } catch (error) {
        console.error('[reservaController.finalizarReserva] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// NUEVO: Obtener reservas pendientes de pago para el dashboard admin
exports.obtenerReservasPendientes = async (req, res) => {
    try {
        const reservas = await Reserva.getByEstado('pendiente');
        res.json({ success: true, data: reservas });
    } catch (error) {
        console.error('[reservaController.obtenerReservasPendientes] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};