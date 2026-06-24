const MongoReserva = require('../models/mongo/Reserva');
const SqlReserva = require('../models/Reserva');
const Evento = require('../models/Evento');
const db = require('../config/db'); // For direct MySQL operations
const { broadcast } = require('../services/websocketService');

// Helper to map Mongo reservation to look like the SQL representation for compatibility
const mapForCompatibility = (r) => {
    if (!r) return null;
    return {
        id_reserva: r.mysql_id || r._id,
        id_mesa: r.mesa,
        cliente_id: r.cliente_id,
        nombre_cliente: r.nombre_cliente,
        expiracion: r.expiracion,
        estado: r.estado,
        fecha_reserva: r.createdAt
    };
};

// 1. CREAR RESERVA (POST /api/reservas)
exports.crearReserva = async (req, res) => {
    const { id_mesa, expiracion } = req.body;
    
    // Identidad del usuario desde el JWT (authMiddleware)
    const cliente_id = req.userId; 
    const nombre_cliente = req.correo; 

    if (!id_mesa) {
        if (global.logger) global.logger.warn('Intento de crear reserva sin id_mesa');
        return res.status(400).json({ success: false, message: "Faltan campos requeridos: id_mesa" });
    }

    if (!cliente_id || !nombre_cliente) {
        if (global.logger) global.logger.warn('Intento de crear reserva sin identidad JWT válida');
        return res.status(401).json({ success: false, message: "No se pudo identificar al usuario desde el token" });
    }

    try {
        if (global.logger) global.logger.info(`Iniciando reserva para mesa ${id_mesa} por el usuario ${nombre_cliente}`);

        // 1. Limpiar reservas expiradas de esa mesa en MySQL (para mantener consistencia de mesa)
        await SqlReserva.limpiarExpiradas(id_mesa);
        
        // Limpiar en MongoDB también (expiradas y activas)
        const ahora = new Date();
        await MongoReserva.updateMany(
            { mesa: id_mesa, estado: { $in: ['pendiente', 'confirmada'] }, expiracion: { $ne: null, $lt: ahora } },
            { $set: { estado: 'finalizada' } }
        );

        // 2. Validar disponibilidad en MongoDB
        const tieneReservaActiva = await MongoReserva.findOne({
            mesa: id_mesa,
            estado: { $in: ['pendiente', 'confirmada'] },
            $or: [
                { expiracion: null },
                { expiracion: { $gt: ahora } }
            ]
        });

        if (tieneReservaActiva) {
            if (global.logger) global.logger.warn(`Mesa ${id_mesa} ya se encuentra ocupada o reservada en MongoDB`);
            return res.status(400).json({ success: false, message: "La mesa ya está ocupada o reservada" });
        }

        // 3. Crear en MongoDB (Autoritativo)
        const nuevaReservaMongo = new MongoReserva({
            mesa: parseInt(id_mesa),
            cliente_id: String(cliente_id),
            nombre_cliente,
            expiracion: expiracion ? new Date(expiracion) : null,
            estado: 'pendiente'
        });
        const reservaGuardada = await nuevaReservaMongo.save();

        // 4. Crear en MySQL (Sincronización Dual)
        let mysqlId = null;
        try {
            mysqlId = await SqlReserva.create({ 
                id_mesa: parseInt(id_mesa), 
                cliente_id: String(cliente_id), 
                nombre_cliente, 
                expiracion 
            });
            
            // Actualizar la referencia de MySQL en MongoDB
            reservaGuardada.mysql_id = mysqlId;
            await reservaGuardada.save();
            
            if (global.logger) global.logger.info(`Reserva dual sincronizada exitosamente. MongoID: ${reservaGuardada._id}, MySQL ID: ${mysqlId}`);
        } catch (sqlError) {
            if (global.logger) global.logger.error(`Fallo al replicar reserva en MySQL: ${sqlError.message}`);
            // Continuamos ya que Mongo es el principal, pero registramos el error
        }

        // 5. Registrar evento de trazabilidad en MySQL (Lógica base)
        try {
            await Evento.registrar('CREACION_RESERVA', 'HTTP', `Reserva ${mysqlId || reservaGuardada._id} creada para ${nombre_cliente} en mesa ${id_mesa}`);
        } catch (err) {
            if (global.logger) global.logger.error(`Error al registrar evento en BD MySQL: ${err.message}`);
        }

        // 6. Notificar en tiempo real vía WebSockets
        broadcast('mesa-ocupada', { 
            id_mesa: parseInt(id_mesa), 
            id_reserva: mysqlId || reservaGuardada._id, 
            expiracion, 
            nombre_cliente, 
            cliente_id 
        });

        res.status(201).json({ 
            success: true, 
            message: "Reserva creada exitosamente", 
            id_reserva: mysqlId || reservaGuardada._id,
            id_mesa: parseInt(id_mesa),
            expiracion
        });
    } catch (error) {
        if (global.logger) global.logger.error(`[reservaController.crearReserva] Error: ${error.message}`, { error });
        res.status(500).json({ success: false, message: "Error al procesar reserva", error: error.message });
    }
};

// 2. OBTENER TODAS LAS RESERVAS (GET /api/reservas) - CRUD
exports.obtenerReservas = async (req, res) => {
    try {
        if (global.logger) global.logger.info('Consultando todas las reservas desde MongoDB');
        const reservas = await MongoReserva.find().sort({ createdAt: -1 });
        const compatibiles = reservas.map(mapForCompatibility);
        res.json({ success: true, count: reservas.length, data: compatibiles });
    } catch (error) {
        if (global.logger) global.logger.error(`[reservaController.obtenerReservas] Error: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 3. OBTENER RESERVA POR ID (GET /api/reservas/:id) - CRUD
exports.obtenerReservaPorId = async (req, res) => {
    const { id } = req.params;
    try {
        if (global.logger) global.logger.info(`Buscando reserva con ID: ${id}`);
        
        let reserva = null;
        // Intentar buscar como MongoDB ObjectId
        if (id.match(/^[0-9a-fA-F]{24}$/)) {
            reserva = await MongoReserva.findById(id);
        }
        
        // Si no se encuentra o no es ObjectId, intentar buscar por mysql_id
        if (!reserva) {
            reserva = await MongoReserva.findOne({ mysql_id: Number(id) || -1 });
        }

        if (!reserva) {
            if (global.logger) global.logger.warn(`Reserva no encontrada con ID: ${id}`);
            return res.status(404).json({ success: false, message: 'La reserva no existe' });
        }

        res.json({ success: true, data: mapForCompatibility(reserva) });
    } catch (error) {
        if (global.logger) global.logger.error(`[reservaController.obtenerReservaPorId] Error: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 4. ACTUALIZAR RESERVA (PUT /api/reservas/:id) - CRUD
exports.actualizarReserva = async (req, res) => {
    const { id } = req.params;
    const { id_mesa, expiracion, estado } = req.body;
    try {
        if (global.logger) global.logger.info(`Actualizando reserva con ID: ${id}`);
        
        let reserva = null;
        if (id.match(/^[0-9a-fA-F]{24}$/)) {
            reserva = await MongoReserva.findById(id);
        }
        if (!reserva) {
            reserva = await MongoReserva.findOne({ mysql_id: Number(id) || -1 });
        }

        if (!reserva) {
            if (global.logger) global.logger.warn(`Reserva a actualizar no encontrada: ${id}`);
            return res.status(404).json({ success: false, message: 'La reserva no existe' });
        }

        // Actualizar en MongoDB
        if (id_mesa !== undefined) reserva.mesa = parseInt(id_mesa);
        if (expiracion !== undefined) reserva.expiracion = expiracion ? new Date(expiracion) : null;
        if (estado !== undefined) reserva.estado = estado;
        await reserva.save();

        // Actualizar en MySQL (Sincronización Dual)
        if (reserva.mysql_id) {
            try {
                const expiracionMySQL = expiracion ? new Date(expiracion).toISOString().slice(0, 19).replace('T', ' ') : null;
                await db.query(
                    'UPDATE reservas SET id_mesa = ?, expiracion = ?, estado = ? WHERE id_reserva = ?',
                    [reserva.mesa, expiracionMySQL, reserva.estado, reserva.mysql_id]
                );
                if (global.logger) global.logger.info(`Reserva dual actualizada en MySQL para ID: ${reserva.mysql_id}`);
            } catch (mysqlError) {
                if (global.logger) global.logger.error(`Error al actualizar reserva en MySQL: ${mysqlError.message}`);
            }
        }

        res.json({ success: true, message: "Reserva actualizada exitosamente", data: mapForCompatibility(reserva) });
    } catch (error) {
        if (global.logger) global.logger.error(`[reservaController.actualizarReserva] Error: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 5. ELIMINAR RESERVA (DELETE /api/reservas/:id) - CRUD
exports.eliminarReserva = async (req, res) => {
    const { id } = req.params;
    try {
        if (global.logger) global.logger.info(`Eliminando reserva con ID: ${id}`);
        
        let reserva = null;
        if (id.match(/^[0-9a-fA-F]{24}$/)) {
            reserva = await MongoReserva.findById(id);
        }
        if (!reserva) {
            reserva = await MongoReserva.findOne({ mysql_id: Number(id) || -1 });
        }

        if (!reserva) {
            if (global.logger) global.logger.warn(`Reserva a eliminar no encontrada: ${id}`);
            return res.status(404).json({ success: false, message: 'La reserva no existe' });
        }

        const mysqlId = reserva.mysql_id;
        
        // Eliminar de MongoDB
        await MongoReserva.findByIdAndDelete(reserva._id);

        // Eliminar de MySQL
        if (mysqlId) {
            try {
                await db.query('DELETE FROM reservas WHERE id_reserva = ?', [mysqlId]);
                if (global.logger) global.logger.info(`Reserva eliminada de MySQL con ID: ${mysqlId}`);
            } catch (mysqlError) {
                if (global.logger) global.logger.error(`Error al eliminar reserva de MySQL: ${mysqlError.message}`);
            }
        }

        res.json({ success: true, message: "Reserva eliminada exitosamente" });
    } catch (error) {
        if (global.logger) global.logger.error(`[reservaController.eliminarReserva] Error: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 6. FINALIZAR RESERVA (PUT /api/reservas/:id/finalizar)
exports.finalizarReserva = async (req, res) => {
    try {
        const { id } = req.params;
        const { id_mesa } = req.body;
        
        // Identidad del usuario desde el JWT
        const cliente_id_token = req.userId;

        if (global.logger) global.logger.info(`Finalizando reserva con ID: ${id} para mesa: ${id_mesa}`);

        // 1. Buscar en MongoDB por ID de Mongo o ID de MySQL
        let reserva = null;
        if (id.match(/^[0-9a-fA-F]{24}$/)) {
            reserva = await MongoReserva.findById(id);
        }
        if (!reserva) {
            reserva = await MongoReserva.findOne({ mysql_id: Number(id) || -1 });
        }

        if (!reserva) {
            if (global.logger) global.logger.warn(`Reserva no encontrada al intentar finalizar: ${id}`);
            return res.status(404).json({ success: false, message: 'La reserva no existe' });
        }

        if (id_mesa && parseInt(reserva.mesa) !== parseInt(id_mesa)) {
            if (global.logger) global.logger.warn(`Discrepancia de mesa en finalización: Solicitada mesa ${id_mesa}, Reserva corresponde a mesa ${reserva.mesa}`);
            return res.status(400).json({ success: false, message: 'La reserva no corresponde a la mesa indicada' });
        }

        // 2. Validar propiedad con el token JWT
        const idBD = String(reserva.cliente_id || '').trim();
        const idToken = String(cliente_id_token || '').trim();

        if (idBD !== idToken) {
            if (global.logger) global.logger.warn(`Usuario no autorizado intentando finalizar reserva. Dueño: ${idBD}, Solicitante: ${idToken}`);
            return res.status(403).json({ 
                success: false, 
                message: 'La reserva pertenece a otro cliente y no tienes permisos para finalizarla',
            });
        }
        
        // 3. Actualizar en MongoDB
        reserva.estado = 'finalizada';
        await reserva.save();

        // 4. Actualizar en MySQL (Sincronización Dual)
        const targetMysqlId = reserva.mysql_id || id;
        try {
            await SqlReserva.updateEstado(targetMysqlId, 'finalizada');
            if (global.logger) global.logger.info(`Reserva dual marcada como finalizada en MySQL. ID: ${targetMysqlId}`);
        } catch (sqlError) {
            if (global.logger) global.logger.error(`Error al actualizar estado en MySQL a finalizada: ${sqlError.message}`);
        }
        
        // 5. Registrar evento de trazabilidad
        try {
            await Evento.registrar('FINALIZAR_RESERVA', 'HTTP', `Reserva ${targetMysqlId} marcada como finalizada`);
        } catch (err) {
            if (global.logger) global.logger.error(`Error al registrar evento: ${err.message}`);
        }
        
        // 6. Avisar por WebSockets
        const mesaId = id_mesa || reserva.mesa;
        if (mesaId) {
            broadcast('mesa-liberada', { id_mesa: parseInt(mesaId) });
        }

        res.json({ success: true, message: "Reserva finalizada correctamente" });
    } catch (error) {
        if (global.logger) global.logger.error(`[reservaController.finalizarReserva] Error: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 7. OBTENER RESERVAS PENDIENTES (GET /api/reservas/admin/pendientes)
exports.obtenerReservasPendientes = async (req, res) => {
    try {
        if (global.logger) global.logger.info('Consultando reservas pendientes desde MongoDB');
        const reservas = await MongoReserva.find({ estado: 'pendiente' }).sort({ createdAt: -1 });
        const compatibiles = reservas.map(mapForCompatibility);
        res.json({ success: true, data: compatibiles });
    } catch (error) {
        if (global.logger) global.logger.error(`[reservaController.obtenerReservasPendientes] Error: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 8. LIBERAR TODAS LAS MESAS (POST /api/reservas/admin/liberar-todas)
exports.liberarTodasLasMesas = async (req, res) => {
    try {
        if (global.logger) global.logger.info('Iniciando liberación masiva de todas las mesas en MongoDB y MySQL');
        
        // Obtener reservas activas de MongoDB
        const reservasActivas = await MongoReserva.find({ estado: { $in: ['pendiente', 'confirmada'] } });
        const mesasLiberadas = new Set();

        for (const r of reservasActivas) {
            r.estado = 'finalizada';
            await r.save();

            mesasLiberadas.add(parseInt(r.mesa));

            if (r.mysql_id) {
                try {
                    await SqlReserva.updateEstado(r.mysql_id, 'finalizada');
                } catch (sqlErr) {
                    if (global.logger) global.logger.error(`Error al finalizar reserva ${r.mysql_id} en MySQL en liberación masiva: ${sqlErr.message}`);
                }
            }
        }

        // Por si quedan colgadas en MySQL, sincronizar también las que MySQL detecte
        try {
            const pendientesSQL = await SqlReserva.getByEstado('pendiente');
            const confirmadasSQL = await SqlReserva.getByEstado('confirmada');
            const SQLActivas = [...pendientesSQL, ...confirmadasSQL];

            for (const r of SQLActivas) {
                await SqlReserva.updateEstado(r.id_reserva, 'finalizada');
                mesasLiberadas.add(parseInt(r.id_mesa));
            }
        } catch (mysqlErr) {
            if (global.logger) global.logger.error(`Error al limpiar colgados de MySQL en liberación masiva: ${mysqlErr.message}`);
        }

        // Avisar a la red por cada mesa liberada
        for (const idMesa of mesasLiberadas) {
            broadcast('mesa-liberada', { id_mesa: idMesa, motivo: 'liberacion-masiva' });
        }

        // Registrar evento en MySQL
        try {
            await Evento.registrar(
                'LIBERAR_MESAS',
                'HTTP',
                `Liberación masiva ejecutada sobre ${mesasLiberadas.size} mesa(s)`
            );
        } catch (err) {
            if (global.logger) global.logger.error(`Error al registrar evento de liberación masiva: ${err.message}`);
        }

        if (global.logger) global.logger.info(`Liberación masiva completada. Mesas liberadas: ${Array.from(mesasLiberadas).join(', ')}`);

        res.json({
            success: true,
            message: `Se liberaron ${mesasLiberadas.size} mesa(s) correctamente`,
            mesas_liberadas: Array.from(mesasLiberadas)
        });
    } catch (error) {
        if (global.logger) global.logger.error(`[reservaController.liberarTodasLasMesas] Error: ${error.message}`);
        res.status(500).json({ success: false, message: 'No se pudieron liberar las mesas', error: error.message });
    }
};