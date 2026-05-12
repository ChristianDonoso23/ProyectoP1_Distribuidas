const db = require('../config/db');

const errorHandler = async (err, req, res, next) => {
    console.error(`[ERROR] ${err.message}`);

    // Registrar el error en la base de datos
    try {
        await db.query(
            'INSERT INTO logs_errores (modulo, descripcion, nivel) VALUES (?, ?, ?)',
            [req.originalUrl, err.message, 'ERROR']
        );
    } catch (dbError) {
        console.error('Error al guardar el log en la BD:', dbError.message);
    }

    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode).json({
        success: false,
        message: err.message || "Error interno del servidor",
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
};

module.exports = errorHandler;