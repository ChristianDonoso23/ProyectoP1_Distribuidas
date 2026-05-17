CREATE DATABASE IF NOT EXISTS restaurante_db;

USE restaurante_db;



-- =========================================================

-- TABLA: MESAS

-- Infraestructura física del restaurante

-- =========================================================



CREATE TABLE mesas (

    id_mesa INT AUTO_INCREMENT PRIMARY KEY,

    

    numero_mesa VARCHAR(10) UNIQUE NOT NULL,

    

    zona ENUM(

        'VIP',

        'TERRAZA',

        'GENERAL'

    ) NOT NULL,

    

    capacidad INT DEFAULT 4,

    

    precio_base DECIMAL(10,2) NOT NULL

);



-- =========================================================

-- TABLA: RESERVAS

-- Gestión dinámica de ocupación

-- =========================================================



CREATE TABLE reservas (

    id_reserva INT AUTO_INCREMENT PRIMARY KEY,

    

    id_mesa INT NOT NULL,

    

    nombre_cliente VARCHAR(100) NOT NULL,

    

    estado ENUM(

        'pendiente',

        'confirmada',

        'cancelada',

        'finalizada'

    ) DEFAULT 'pendiente',

    

    fecha_reserva DATETIME DEFAULT CURRENT_TIMESTAMP,

    

    expiracion DATETIME,

    

    FOREIGN KEY (id_mesa)

        REFERENCES mesas(id_mesa)

        ON DELETE CASCADE

);



-- =========================================================

-- TABLA: SESIONES

-- Manejo de conexiones WebSocket

-- =========================================================



CREATE TABLE sesiones (

    id_sesion INT AUTO_INCREMENT PRIMARY KEY,

    

    socket_id VARCHAR(100) UNIQUE NOT NULL,

    

    ip_cliente VARCHAR(45),

    

    estado ENUM(

        'activa',

        'desconectada'

    ) DEFAULT 'activa',

    

    fecha_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,

    

    ultima_actividad DATETIME

);



-- =========================================================

-- TABLA: FACTURAS

-- Registro histórico de pagos

-- =========================================================



CREATE TABLE facturas (

    id_factura INT AUTO_INCREMENT PRIMARY KEY,

    

    id_reserva INT,

    

    id_mesa INT,

    

    nombre_cliente VARCHAR(100),

    

    detalle_mesa VARCHAR(50),

    

    subtotal DECIMAL(10,2),

    

    impuestos DECIMAL(10,2) DEFAULT 0,

    

    total_pagado DECIMAL(10,2),

    

    metodo_pago ENUM(

        'efectivo',

        'tarjeta',

        'transferencia'

    ) DEFAULT 'efectivo',

    

    fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP,

    

    FOREIGN KEY (id_reserva)

        REFERENCES reservas(id_reserva)

        ON DELETE SET NULL,

        

    FOREIGN KEY (id_mesa)

        REFERENCES mesas(id_mesa)

        ON DELETE SET NULL

);



-- =========================================================

-- TABLA: EVENTOS

-- Trazabilidad distribuida del sistema

-- =========================================================



CREATE TABLE eventos (

    id_evento INT AUTO_INCREMENT PRIMARY KEY,

    

    tipo_evento VARCHAR(100),

    

    protocolo ENUM(

        'WebSocket',

        'TCP',

        'UDP',

        'HTTP',

        'MYSQL'

    ),

    

    descripcion TEXT,

    

    fecha_evento DATETIME DEFAULT CURRENT_TIMESTAMP

);



-- =========================================================

-- TABLA: LOGS_ERRORES

-- Monitoreo y auditoría

-- =========================================================



CREATE TABLE logs_errores (

    id_error INT AUTO_INCREMENT PRIMARY KEY,

    

    modulo VARCHAR(100),

    

    descripcion TEXT,

    

    nivel ENUM(

        'INFO',

        'WARNING',

        'ERROR',

        'CRITICAL'

    ) DEFAULT 'INFO',

    

    fecha_error DATETIME DEFAULT CURRENT_TIMESTAMP

);





-- =========================================================

-- INSERCIÓN DE MESAS

-- =========================================================



INSERT INTO mesas (

    numero_mesa,

    zona,

    precio_base

) VALUES



-- FILA A = VIP ($6)

('A1',  'VIP', 6.00),

('A2',  'VIP', 6.00),

('A3',  'VIP', 6.00),

('A4',  'VIP', 6.00),

('A5',  'VIP', 6.00),

('A6',  'VIP', 6.00),

('A7',  'VIP', 6.00),

('A8',  'VIP', 6.00),

('A9',  'VIP', 6.00),

('A10', 'VIP', 6.00),



-- FILA B = TERRAZA ($5)

('B1',  'TERRAZA', 5.00),

('B2',  'TERRAZA', 5.00),

('B3',  'TERRAZA', 5.00),

('B4',  'TERRAZA', 5.00),

('B5',  'TERRAZA', 5.00),

('B6',  'TERRAZA', 5.00),

('B7',  'TERRAZA', 5.00),

('B8',  'TERRAZA', 5.00),

('B9',  'TERRAZA', 5.00),

('B10', 'TERRAZA', 5.00),



-- FILA C = GENERAL ($4)

('C1',  'GENERAL', 4.00),

('C2',  'GENERAL', 4.00),

('C3',  'GENERAL', 4.00),

('C4',  'GENERAL', 4.00),

('C5',  'GENERAL', 4.00),

('C6',  'GENERAL', 4.00),

('C7',  'GENERAL', 4.00),

('C8',  'GENERAL', 4.00),

('C9',  'GENERAL', 4.00),

('C10', 'GENERAL', 4.00);



