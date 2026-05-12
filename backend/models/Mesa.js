const pool = require('../config/db');

class Mesa {
    static async getAll() {
        const [rows] = await pool.query('SELECT * FROM mesas');
        return rows;
    }
}

module.exports = Mesa;