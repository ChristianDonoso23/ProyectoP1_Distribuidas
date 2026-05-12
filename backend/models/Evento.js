const db = require('../config/db');

const Evento = {
    // Registrar cualquier movimiento en el sistema
    registrar: async (tipo, protocolo, descripcion) => {
        const [result] = await db.query(
            'INSERT INTO eventos (tipo_evento, protocolo, descripcion) VALUES (?, ?, ?)',
            [tipo, protocolo, descripcion]
        );
        return result.insertId;
    },

    getRecientes: async (limit = 50) => {
        const [rows] = await db.query('SELECT * FROM eventos ORDER BY fecha_evento DESC LIMIT ?', [limit]);
        return rows;
    }
};

module.exports = Evento;