const db = require('../config/db');

const Reserva = {
    // Crear una nueva reserva
    create: async (reservaData) => {
        const { id_mesa, cliente_id, nombre_cliente, expiracion } = reservaData;
        const [result] = await db.query(
            'INSERT INTO reservas (id_mesa, cliente_id, nombre_cliente, expiracion, estado) VALUES (?, ?, ?, ?, "pendiente")',
            [id_mesa, cliente_id, nombre_cliente, expiracion]
        );
        return result.insertId;
    },

    // Obtener una reserva por su ID
    getById: async (id_reserva) => {
        const [rows] = await db.query(
            'SELECT * FROM reservas WHERE id_reserva = ?',
            [id_reserva]
        );
        return rows[0] || null;
    },

    // Verificar si una mesa ya tiene una reserva activa/confirmada
    checkDisponibilidad: async (id_mesa) => {
        const [rows] = await db.query(
            `SELECT * FROM reservas 
             WHERE id_mesa = ? 
               AND estado IN ("pendiente", "confirmada")
               AND (expiracion IS NULL OR NOW() < expiracion)`,
            [id_mesa]
        );
        return rows.length === 0;
    },

    // Marcar como "finalizada" todas las reservas expiradas de una mesa
    limpiarExpiradas: async (id_mesa) => {
        await db.query(
            `UPDATE reservas SET estado = "finalizada"
             WHERE id_mesa = ? AND expiracion IS NOT NULL AND NOW() >= expiracion
               AND estado IN ("pendiente", "confirmada")`,
            [id_mesa]
        );

        // Sincronizar en MongoDB
        try {
            const MongoReserva = require('./mongo/Reserva');
            const ahora = new Date();
            await MongoReserva.updateMany(
                { mesa: id_mesa, estado: { $in: ['pendiente', 'confirmada'] }, expiracion: { $ne: null, $lt: ahora } },
                { $set: { estado: 'finalizada' } }
            );
        } catch (mongoError) {
            if (global.logger) {
                global.logger.error(`Error al sincronizar limpiarExpiradas de MySQL a MongoDB para mesa ${id_mesa}: ${mongoError.message}`);
            }
        }
    },

    // Cambiar estado (confirmada, cancelada, finalizada)
    updateEstado: async (id_reserva, nuevoEstado) => {
        const [result] = await db.query(
            'UPDATE reservas SET estado = ? WHERE id_reserva = ?',
            [nuevoEstado, id_reserva]
        );

        // Sincronizar en MongoDB
        try {
            const MongoReserva = require('./mongo/Reserva');
            await MongoReserva.updateOne(
                { mysql_id: Number(id_reserva) },
                { $set: { estado: nuevoEstado } }
            );
            if (global.logger) {
                global.logger.info(`Sincronizado estado de reserva SQL ID ${id_reserva} a MongoDB: ${nuevoEstado}`);
            }
        } catch (mongoError) {
            if (global.logger) {
                global.logger.error(`Error al sincronizar estado de reserva SQL ID ${id_reserva} a MongoDB: ${mongoError.message}`);
            }
        }

        return result.affectedRows > 0;
    },

    // Obtener todas las reservas con un estado específico
    getByEstado: async (estado) => {
        const [rows] = await db.query(
            `SELECT r.*, m.numero_mesa, m.zona 
            FROM reservas r
            LEFT JOIN mesas m ON r.id_mesa = m.id_mesa
            WHERE r.estado = ?
            ORDER BY r.fecha_reserva DESC`,
            [estado]
        );
        return rows;
    }
};

module.exports = Reserva;