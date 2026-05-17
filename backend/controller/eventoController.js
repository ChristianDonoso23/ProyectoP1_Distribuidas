const Evento = require('../models/Evento');

exports.getEventos = async (req, res) => {
    try {
        // Obtener los últimos 100 eventos
        const eventos = await Evento.getRecientes(100);
        res.status(200).json({ success: true, data: eventos });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error al obtener eventos", error: error.message });
    }
};