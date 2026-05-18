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

    // Crear factura y asociar múltiples reservas (transaccional)
    createWithReservas: async (facturaData, idReservas = []) => {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            const { id_reserva, id_mesa, nombre_cliente, detalle_mesa, subtotal, impuestos, total_pagado, metodo_pago } = facturaData;
            const [result] = await conn.query(
                `INSERT INTO facturas 
                (id_reserva, id_mesa, nombre_cliente, detalle_mesa, subtotal, impuestos, total_pagado, metodo_pago) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [id_reserva, id_mesa, nombre_cliente, detalle_mesa, subtotal, impuestos, total_pagado, metodo_pago]
            );
            const idFactura = result.insertId;

            if (Array.isArray(idReservas) && idReservas.length > 0) {
                const insertValues = idReservas.map(() => '(?, ?)').join(', ');
                const params = [];
                idReservas.forEach(id => {
                    params.push(idFactura, id);
                });
                await conn.query(
                    `INSERT INTO factura_reservas (id_factura, id_reserva) VALUES ${insertValues}`,
                    params
                );
            }

            await conn.commit();
            return idFactura;
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    },

    getAll: async () => {
        const [rows] = await db.query('SELECT * FROM facturas ORDER BY fecha_pago DESC');
        return rows;
    }
};

module.exports = Factura;