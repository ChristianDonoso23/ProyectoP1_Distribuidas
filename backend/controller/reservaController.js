const Reserva = require('../models/Reserva');
const Evento = require('../models/Evento');

exports.crearReserva = async (req, res) => {
    const { id_mesa, nombre_cliente, expiracion } = req.body;

    try {
        // 1. Validar disponibilidad
        const disponible = await Reserva.checkDisponibilidad(id_mesa);
        if (!disponible) {
            return res.status(400).json({ success: false, message: "La mesa ya está ocupada o reservada" });
        }

        // 2. Crear reserva
        const id_reserva = await Reserva.create({ id_mesa, nombre_cliente, expiracion });

        // 3. Registrar evento (Trazabilidad)
        await Evento.registrar('CREACION_RESERVA', 'HTTP', `Reserva ${id_reserva} creada para ${nombre_cliente} en mesa ${id_mesa}`);

        res.status(201).json({ 
            success: true, 
            message: "Reserva creada exitosamente", 
            id_reserva 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error al procesar reserva", error: error.message });
    }
};

exports.finalizarReserva = async (req, res) => {
    try {
        const { id } = req.params;
        await Reserva.updateEstado(id, 'finalizada');
        await Evento.registrar('FINALIZAR_RESERVA', 'HTTP', `Reserva ${id} marcada como finalizada`);
        res.json({ success: true, message: "Reserva finalizada" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};