const db = require('../config/db');

const Mesa = {
    // Obtener todas las mesas por zona o todas
    getAll: async () => {
        const [rows] = await db.query('SELECT * FROM mesas ORDER BY numero_mesa ASC');
        return rows;
    },

    // Buscar una mesa específica por ID
    getById: async (id) => {
        const [rows] = await db.query('SELECT * FROM mesas WHERE id_mesa = ?', [id]);
        return rows[0];
    },

    // Filtrar mesas por zona (VIP, TERRAZA, GENERAL)
    getByZona: async (zona) => {
        const [rows] = await db.query('SELECT * FROM mesas WHERE zona = ?', [zona]);
        return rows;
    }
};

module.exports = Mesa;