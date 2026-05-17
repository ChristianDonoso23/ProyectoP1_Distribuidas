const fs = require('fs/promises');
const path = require('path');

const LOG_PATH = path.resolve(__dirname, '..', 'logs', 'runtime.log');

const DEFAULT_HOST = process.env.PROTOCOL_HOST || '0.0.0.0';
const DEFAULT_TCP_PORT = Number(process.env.TCP_PORT || 4000);
const DEFAULT_UDP_PORT = Number(process.env.UDP_PORT || 4001);

const PROTOCOLS = Object.freeze({
    TCP: 'TCP',
    UDP: 'UDP',
    SOCKET: 'SOCKET',
    SYSTEM: 'SYSTEM',
    FACTURA: 'FACTURA'
});

const NORMALIZED_EVENTS = Object.freeze({
    MESA_OCUPADA: 'mesa-ocupada',
    MESA_LIBERADA: 'mesa-liberada',
    RESERVA_CREADA: 'reserva-creada',
    FACTURA_PROCESADA: 'factura-procesada',
    TICKET_IMPRESO: 'ticket-impreso',
    NUEVA_ACTIVIDAD: 'nueva-actividad',
    ACTIVIDAD_GENERAL: 'actividad-general',
    CONEXION_TCP: 'conexion-tcp',
    CONEXION_UDP: 'conexion-udp',
    LATIDO_METRICAS: 'latido-metricas'
});

function safeString(value, fallback = '') {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    return String(value);
}

function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePayload(rawValue) {
    const rawText = safeString(rawValue).trim();

    if (!rawText) {
        return null;
    }

    try {
        return JSON.parse(rawText);
    } catch (error) {
        return {
            raw: rawText
        };
    }
}

function formatStructuredLog(scope, message, details = {}) {
    const suffix = Object.keys(details).length > 0 ? ` | ${JSON.stringify(details)}` : '';
    return `[${scope}] ${message}${suffix}`;
}

async function appendRuntimeLine(line) {
    try {
        await fs.mkdir(path.dirname(LOG_PATH), { recursive: true });
        await fs.appendFile(LOG_PATH, `${line}\n`, 'utf8');
    } catch (error) {
        console.error(formatStructuredLog('SYSTEM', 'No se pudo escribir el log de runtime', { error: error.message }));
    }
}

function normalizeEventType(eventType) {
    const normalized = safeString(eventType).trim().toLowerCase();

    const aliases = {
        'mesa-ocupada': NORMALIZED_EVENTS.MESA_OCUPADA,
        'mesa ocupada': NORMALIZED_EVENTS.MESA_OCUPADA,
        'ocupada': NORMALIZED_EVENTS.MESA_OCUPADA,
        'mesa-liberada': NORMALIZED_EVENTS.MESA_LIBERADA,
        'mesa liberada': NORMALIZED_EVENTS.MESA_LIBERADA,
        'liberada': NORMALIZED_EVENTS.MESA_LIBERADA,
        'reserva-creada': NORMALIZED_EVENTS.RESERVA_CREADA,
        'reserva creada': NORMALIZED_EVENTS.RESERVA_CREADA,
        'reserva': NORMALIZED_EVENTS.RESERVA_CREADA,
        'factura-procesada': NORMALIZED_EVENTS.FACTURA_PROCESADA,
        'factura procesada': NORMALIZED_EVENTS.FACTURA_PROCESADA,
        'ticket-impreso': NORMALIZED_EVENTS.TICKET_IMPRESO,
        'ticket impreso': NORMALIZED_EVENTS.TICKET_IMPRESO,
        'nueva-actividad': NORMALIZED_EVENTS.NUEVA_ACTIVIDAD,
        'nueva actividad': NORMALIZED_EVENTS.NUEVA_ACTIVIDAD,
        'latido-metricas': NORMALIZED_EVENTS.LATIDO_METRICAS,
        'latido metricas': NORMALIZED_EVENTS.LATIDO_METRICAS,
        'conexion-tcp': NORMALIZED_EVENTS.CONEXION_TCP,
        'conexion tcp': NORMALIZED_EVENTS.CONEXION_TCP,
        'conexion-udp': NORMALIZED_EVENTS.CONEXION_UDP,
        'conexion udp': NORMALIZED_EVENTS.CONEXION_UDP
    };

    return aliases[normalized] || normalized || NORMALIZED_EVENTS.ACTIVIDAD_GENERAL;
}

function buildTicket(invoiceData = {}) {
    const cliente = safeString(invoiceData.cliente || invoiceData.nombre_cliente, 'Cliente invitado');
    const mesa = safeString(invoiceData.mesa || invoiceData.id_mesa, 'M-?');
    const total = safeNumber(invoiceData.total ?? invoiceData.total_pagado ?? invoiceData.monto, 0).toFixed(2);
    const metodoPago = safeString(invoiceData.metodo_pago || invoiceData.metodoPago, 'efectivo');
    const concepto = safeString(invoiceData.concepto || invoiceData.descripcion, 'Consumo del restaurante');

    return [
        '=================================',
        'FACTURA RESTAURANTE',
        `Cliente: ${cliente}`,
        `Mesa: ${mesa}`,
        `Concepto: ${concepto}`,
        `Metodo: ${metodoPago}`,
        `Total: $${total}`,
        '==========',
        '================================='
    ].join('\n');
}

function describeSensorEvent(payload = {}, fallbackType = NORMALIZED_EVENTS.NUEVA_ACTIVIDAD) {
    const eventType = normalizeEventType(payload.evento || payload.type || payload.action || fallbackType);
    const mesa = safeString(payload.mesa || payload.id_mesa, 'desconocida');
    const valor = payload.valor !== undefined ? ` | valor: ${payload.valor}` : '';

    if (eventType === NORMALIZED_EVENTS.MESA_OCUPADA) {
        return {
            type: eventType,
            description: `Mesa ${mesa} ocupada${valor}`
        };
    }

    if (eventType === NORMALIZED_EVENTS.MESA_LIBERADA) {
        return {
            type: eventType,
            description: `Mesa ${mesa} liberada${valor}`
        };
    }

    return {
        type: eventType,
        description: payload.descripcion || payload.message || `Nueva actividad detectada en ${mesa}${valor}`
    };
}

module.exports = {
    DEFAULT_HOST,
    DEFAULT_TCP_PORT,
    DEFAULT_UDP_PORT,
    LOG_PATH,
    PROTOCOLS,
    NORMALIZED_EVENTS,
    safeString,
    safeNumber,
    parsePayload,
    formatStructuredLog,
    appendRuntimeLine,
    normalizeEventType,
    buildTicket,
    describeSensorEvent
};