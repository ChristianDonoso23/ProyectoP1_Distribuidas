const db = require('../config/db');

const Sesion = {
    iniciar: async (socket_id, ip) => {
        const [result] = await db.query(
            'INSERT INTO sesiones (socket_id, ip_cliente, estado) VALUES (?, ?, "activa")',
            [socket_id, ip]
        );
        return result.insertId;
    },

    cerrar: async (socket_id) => {
        await db.query(
            'UPDATE sesiones SET estado = "desconectada", ultima_actividad = CURRENT_TIMESTAMP WHERE socket_id = ?',
            [socket_id]
        );
    }
};

module.exports = Sesion;