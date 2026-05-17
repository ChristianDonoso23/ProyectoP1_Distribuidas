const db = require('../config/db');

const Reserva = {
    // Crear una nueva reserva
    create: async (reservaData) => {
        const { id_mesa, nombre_cliente, expiracion } = reservaData;
        const [result] = await db.query(
            'INSERT INTO reservas (id_mesa, nombre_cliente, expiracion, estado) VALUES (?, ?, ?, "pendiente")',
            [id_mesa, nombre_cliente, expiracion]
        );
        return result.insertId;
    },

    // Verificar si una mesa ya tiene una reserva activa/confirmada
    checkDisponibilidad: async (id_mesa) => {
        const [rows] = await db.query(
            'SELECT * FROM reservas WHERE id_mesa = ? AND estado IN ("pendiente", "confirmada")',
            [id_mesa]
        );
        return rows.length === 0; // true si está libre
    },

    // Cambiar estado (confirmada, cancelada, finalizada)
    updateEstado: async (id_reserva, nuevoEstado) => {
        const [result] = await db.query(
            'UPDATE reservas SET estado = ? WHERE id_reserva = ?',
            [nuevoEstado, id_reserva]
        );
        return result.affectedRows > 0;
    }
};

module.exports = Reserva;