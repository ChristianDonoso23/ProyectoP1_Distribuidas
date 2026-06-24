const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
    ),
    transports: [
        // Log errors to a separate file
        new winston.transports.File({ 
            filename: path.join(__dirname, '..', 'logs', 'error.log'), 
            level: 'error' 
        }),
        // Log all messages to a combined file
        new winston.transports.File({ 
            filename: path.join(__dirname, '..', 'logs', 'combined.log') 
        }),
        // Log to console with nice colorized format
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    const metaStr = Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : '';
                    return `[${timestamp}] ${level}: ${message}${metaStr}`;
                })
            )
        })
    ]
});

module.exports = logger;
