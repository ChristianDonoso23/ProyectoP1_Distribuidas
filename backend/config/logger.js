const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const logDir = path.join(__dirname, '..', 'logs');

// Transporte 1: Rotación diaria para TODOS los niveles
const dailyRotateTransport = new transports.DailyRotateFile({
    filename: 'application-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    dirname: logDir,
    zippedArchive: true,
    maxSize: '5m',
    maxFiles: '14d'
});

// Transporte 2: Archivo separado SOLO para errores
const errorTransport = new transports.File({
    filename: path.join(logDir, 'errors.log'),
    level: 'error'
});

// Crear el logger con su configuración
const logger = createLogger({
    level: 'silly',
    format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message }) =>
            `${timestamp} [${level.toUpperCase()}]: ${message}`
        )
    ),
    transports: [
        new transports.Console(),
        dailyRotateTransport,
        errorTransport
    ]
});

module.exports = logger;
