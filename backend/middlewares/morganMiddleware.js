const morgan = require('morgan');
const logger = require('../config/logger');

// Configurar un Stream para que Morgan escriba con Winston
const stream = {
    write: (message) => logger.info(message.trim())
};

// Creamos el middleware de Morgan con formato personalizado
const morganMiddleware = morgan(
    ':method :url :status :res[content-length] - :response-time ms',
    { stream }
);

module.exports = morganMiddleware;
