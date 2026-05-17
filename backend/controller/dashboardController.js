const db = require('../config/db');

exports.getStats = async (req, res) => {
    try {
        // Mesas ocupadas actualmente
        const [mesasOcupadas] = await db.query('SELECT COUNT(*) as total FROM reservas WHERE estado IN ("pendiente", "confirmada")');
        
        // Ingresos totales
        const [ingresosTotal] = await db.query('SELECT SUM(total_pagado) as total FROM facturas');
        
        // Reservas hechas el día de hoy
        const [reservasHoy] = await db.query('SELECT COUNT(*) as total FROM reservas WHERE DATE(fecha_reserva) = CURDATE()');

        res.status(200).json({
            success: true,
            data: {
                mesas_ocupadas: mesasOcupadas[0].total || 0,
                ingresos_totales: ingresosTotal[0].total || 0,
                reservas_hoy: reservasHoy[0].total || 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error al cargar dashboard", error: error.message });
    }
};