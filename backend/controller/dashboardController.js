const db = require('../config/db');

exports.getStats = async (req, res) => {
    try {
        // Mesas ocupadas actualmente
        const [mesasOcupadas] = await db.query('SELECT COUNT(*) as total FROM reservas WHERE estado IN ("pendiente", "confirmada")');
        
        // Ingresos totales
        const [ingresosTotal] = await db.query('SELECT SUM(total_pagado) as total FROM facturas');
        
        // Reservas hechas el día de hoy
        const [reservasHoy] = await db.query('SELECT COUNT(*) as total FROM reservas WHERE DATE(fecha_reserva) = CURDATE()');

        // Total de mesas (para mostrar en el dashboard)
        const [totalMesas] = await db.query('SELECT COUNT(*) as total FROM mesas');

        // Eventos registrados (trazabilidad)
        const [eventosTotal] = await db.query('SELECT COUNT(*) as total FROM eventos');

        const total_mesas = totalMesas[0].total || 0;
        const eventos_registrados = eventosTotal[0].total || 0;
        const mesas_ocupadas = mesasOcupadas[0].total || 0;
        const mesas_disponibles = Math.max(0, total_mesas - mesas_ocupadas);

        res.status(200).json({
            success: true,
            data: {
                mesas_ocupadas: mesas_ocupadas,
                mesas_disponibles: mesas_disponibles,
                total_mesas: total_mesas,
                ingresos_totales: ingresosTotal[0].total || 0,
                reservas_hoy: reservasHoy[0].total || 0,
                eventos_registrados: eventos_registrados
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error al cargar dashboard", error: error.message });
    }
};