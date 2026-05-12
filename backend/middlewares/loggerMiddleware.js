const Evento = require('../models/Evento');

const requestLogger = async (req, res, next) => {
    // Solo vamos a loggear peticiones que modifiquen datos (POST, PUT, DELETE)
    // para no saturar la base de datos con puros GETs.
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        
        // Interceptamos cuando la respuesta termine para saber si fue exitosa
        res.on('finish', async () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const descripcion = `Petición ${req.method} a ${req.originalUrl} completada.`;
                try {
                    await Evento.registrar('TRAFICO_HTTP', 'HTTP', descripcion);
                } catch (error) {
                    console.error("Fallo al registrar evento de tráfico:", error);
                }
            }
        });
    }
    
    // Continuar a la siguiente ruta
    next();
};

module.exports = requestLogger;