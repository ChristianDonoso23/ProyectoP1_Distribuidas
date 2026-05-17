const db = require('../config/db');

const Factura = {
    // Generar la factura al finalizar una reserva
    create: async (facturaData) => {
        const { id_reserva, id_mesa, nombre_cliente, detalle_mesa, subtotal, impuestos, total_pagado, metodo_pago } = facturaData;
        const [result] = await db.query(
            `INSERT INTO facturas 
            (id_reserva, id_mesa, nombre_cliente, detalle_mesa, subtotal, impuestos, total_pagado, metodo_pago) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id_reserva, id_mesa, nombre_cliente, detalle_mesa, subtotal, impuestos, total_pagado, metodo_pago]
        );
        return result.insertId;
    },

    getAll: async () => {
        const [rows] = await db.query('SELECT * FROM facturas ORDER BY fecha_pago DESC');
        return rows;
    }
};

module.exports = Factura;