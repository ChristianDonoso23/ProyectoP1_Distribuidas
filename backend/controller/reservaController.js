const Reserva = require('../models/Reserva');
const Evento = require('../models/Evento');
const { broadcast } = require('../services/websocketService');

exports.crearReserva = async (req, res) => {
    // 1. Extraemos solo los datos de la mesa y expiración del body
    const { id_mesa, expiracion } = req.body;
    
    // 2. Extraemos la identidad del usuario desde el middleware (JWT)
    // Asumimos que tu authMiddleware inyecta req.userId (ID de Mongo) y req.correo
    const cliente_id = req.userId; 
    const nombre_cliente = req.correo; 

    // Validar que vengan los campos de la mesa
    if (!id_mesa) {
        return res.status(400).json({ success: false, message: "Faltan campos requeridos: id_mesa" });
    }

    // Validar seguridad: Asegurar que el token inyectó la identidad
    if (!cliente_id || !nombre_cliente) {
        return res.status(401).json({ success: false, message: "No se pudo identificar al usuario desde el token" });
    }

    try {
        // 1. Limpiar reservas expiradas de esa mesa (para no bloquearla indefinidamente)
        await Reserva.limpiarExpiradas(id_mesa);

        // 2. Validar disponibilidad (ya excluye expiradas gracias al modelo)
        const disponible = await Reserva.checkDisponibilidad(id_mesa);
        if (!disponible) {
            return res.status(400).json({ success: false, message: "La mesa ya está ocupada o reservada" });
        }

        // 3. Crear reserva usando la identidad del token
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
        const { id_mesa } = req.body;
        
        // Identidad desde el token
        const cliente_id_token = req.userId;

        const reserva = await Reserva.getById(id);

        if (!reserva) {
            return res.status(404).json({ success: false, message: 'La reserva no existe' });
        }

        if (id_mesa && parseInt(reserva.id_mesa) !== parseInt(id_mesa)) {
            return res.status(400).json({ success: false, message: 'La reserva no corresponde a la mesa indicada' });
        }

        // Limpieza de datos para comparar
        const idBD = String(reserva.cliente_id || '').trim();
        const idToken = String(cliente_id_token || '').trim();

        // Validación con Debug inyectado
        if (idBD !== idToken) {
            return res.status(403).json({ 
                success: false, 
                message: 'La reserva pertenece a otro cliente y no tienes permisos para finalizarla',
            });
        }
        
        await Reserva.updateEstado(id, 'finalizada');
        const Evento = require('../models/Evento'); // Asegurando importación
        await Evento.registrar('FINALIZAR_RESERVA', 'HTTP', `Reserva ${id} marcada como finalizada`);
        
        if (id_mesa) {
            const { broadcast } = require('../services/websocketService');
            broadcast('mesa-liberada', { id_mesa: parseInt(id_mesa) });
        }

        res.json({ success: true, message: "Reserva finalizada" });
    } catch (error) {
        console.error('[reservaController.finalizarReserva] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.obtenerReservasPendientes = async (req, res) => {
    try {
        const reservas = await Reserva.getByEstado('pendiente');
        res.json({ success: true, data: reservas });
    } catch (error) {
        console.error('[reservaController.obtenerReservasPendientes] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.liberarTodasLasMesas = async (req, res) => {
    try {
        const pendientes = await Reserva.getByEstado('pendiente');
        const confirmadas = await Reserva.getByEstado('confirmada');
        const reservasActivas = [...pendientes, ...confirmadas];
        const mesasLiberadas = new Set();

        for (const reserva of reservasActivas) {
            await Reserva.updateEstado(reserva.id_reserva, 'finalizada');
            mesasLiberadas.add(parseInt(reserva.id_mesa));
        }

        for (const idMesa of mesasLiberadas) {
            broadcast('mesa-liberada', { id_mesa: idMesa, motivo: 'liberacion-masiva' });
        }

        await Evento.registrar(
            'LIBERAR_MESAS',
            'HTTP',
            `Liberación masiva ejecutada sobre ${mesasLiberadas.size} mesa(s)`
        );

        res.json({
            success: true,
            message: `Se liberaron ${mesasLiberadas.size} mesa(s) correctamente`,
            mesas_liberadas: Array.from(mesasLiberadas)
        });
    } catch (error) {
        console.error('[reservaController.liberarTodasLasMesas] Error:', error);
        res.status(500).json({ success: false, message: 'No se pudieron liberar las mesas', error: error.message });
    }
};