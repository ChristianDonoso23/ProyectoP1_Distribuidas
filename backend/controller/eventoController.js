const Evento = require('../models/Evento');

exports.getEventos = async (req, res) => {
    try {
        // Obtener fecha del query string (ej: ?date=2025-05-18) o usar hoy
        const dateParam = req.query.date;
        const targetDate = dateParam ? `'${dateParam}'` : 'CURDATE()';
        
        // Obtener los últimos 100 eventos del día especificado
        const db = require('../config/db');
        const [eventos] = await db.query(`SELECT * FROM eventos WHERE DATE(fecha_evento) = ${targetDate} ORDER BY fecha_evento DESC LIMIT 100`);
        
        res.status(200).json({ success: true, data: eventos });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error al obtener eventos", error: error.message });
    }
};