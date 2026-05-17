const db = require('../config/db');

const Mesa = {
    // Obtener todas las mesas calculando su estado en tiempo real (disponible/ocupada)
    getAll: async () => {
        const query = `
            SELECT m.*, 
            IF(r.id_reserva IS NOT NULL, 'ocupada', 'disponible') AS estado
            FROM mesas m
            LEFT JOIN reservas r ON m.id_mesa = r.id_mesa 
            AND r.estado IN ('pendiente', 'confirmada')
            AND (r.expiracion IS NULL OR NOW() < r.expiracion)
            ORDER BY m.numero_mesa ASC
        `;
        const [rows] = await db.query(query);
        return rows;
    },

    // Buscar una mesa específica (también con su estado)
    getById: async (id) => {
        const query = `
            SELECT m.*, 
            IF(r.id_reserva IS NOT NULL, 'ocupada', 'disponible') AS estado
            FROM mesas m
            LEFT JOIN reservas r ON m.id_mesa = r.id_mesa 
            AND r.estado IN ('pendiente', 'confirmada')
            AND (r.expiracion IS NULL OR NOW() < r.expiracion)
            WHERE m.id_mesa = ?
        `;
        const [rows] = await db.query(query, [id]);
        return rows[0];
    },

    // Filtrar mesas por zona
    getByZona: async (zona) => {
        const query = `
            SELECT m.*, 
                IF(r.id_reserva IS NOT NULL, 'ocupada', 'disponible') AS estado
            FROM mesas m
            LEFT JOIN reservas r ON m.id_mesa = r.id_mesa 
            AND r.estado IN ('pendiente', 'confirmada')
            AND (r.expiracion IS NULL OR NOW() < r.expiracion)
            WHERE m.zona = ?
        `;
        const [rows] = await db.query(query, [zona]);
        return rows;
    }
};

module.exports = Mesa;