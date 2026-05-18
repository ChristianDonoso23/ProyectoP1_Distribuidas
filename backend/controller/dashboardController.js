const db = require('../config/db');

exports.getStats = async (req, res) => {
    try {
        // Aceptar fecha del query string (ej: ?date=2025-05-18) o usar hoy
        const dateParam = req.query.date;
        const targetDate = dateParam ? `'${dateParam}'` : 'CURDATE()';
        
        // Mesas ocupadas actualmente (siempre estado actual, no filtrado por fecha)
        const [mesasOcupadas] = await db.query('SELECT COUNT(*) as total FROM reservas WHERE estado IN ("pendiente", "confirmada")');
        
        // Ingresos del día especificado vs histórico total
        const [ingresosTodayResult] = await db.query(`SELECT SUM(total_pagado) as total FROM facturas WHERE DATE(fecha_pago) = ${targetDate}`);
        const [ingresosTotal] = await db.query('SELECT SUM(total_pagado) as total FROM facturas');
        
        // Reservas hechas en el día especificado
        const [reservasHoy] = await db.query(`SELECT COUNT(*) as total FROM reservas WHERE DATE(fecha_reserva) = ${targetDate}`);

        // Total de mesas (para mostrar en el dashboard)
        const [totalMesas] = await db.query('SELECT COUNT(*) as total FROM mesas');

        // Eventos del día especificado vs histórico total
        const [eventosTodayResult] = await db.query(`SELECT COUNT(*) as total FROM eventos WHERE DATE(fecha_evento) = ${targetDate}`);
        const [eventosTotal] = await db.query('SELECT COUNT(*) as total FROM eventos');

        const total_mesas = totalMesas[0].total || 0;
        const eventos_hoy = eventosTodayResult[0].total || 0;
        const eventos_registrados = eventosTotal[0].total || 0;
        const ingresos_hoy = ingresosTodayResult[0].total || 0;
        const mesas_ocupadas = mesasOcupadas[0].total || 0;
        const mesas_disponibles = Math.max(0, total_mesas - mesas_ocupadas);

        res.status(200).json({
            success: true,
            data: {
                mesas_ocupadas: mesas_ocupadas,
                mesas_disponibles: mesas_disponibles,
                total_mesas: total_mesas,
                ingresos_hoy: ingresos_hoy,
                ingresos_totales: ingresosTotal[0].total || 0,
                reservas_hoy: reservasHoy[0].total || 0,
                eventos_hoy: eventos_hoy,
                eventos_registrados: eventos_registrados,
                date_filtered: dateParam || 'today'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error al cargar dashboard", error: error.message });
    }
};