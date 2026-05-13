const dgram = require('dgram');

function enviarEvento(evento) {
    return new Promise((resolve, reject) => {
        const client = dgram.createSocket('udp4');
        const mensaje = JSON.stringify(evento);
        const buffer = Buffer.from(mensaje);

        client.send(buffer, 4001, '127.0.0.1', (error) => {
            if (error) {
                console.error('[SENSOR] Error: ' + error.message);
                client.close();
                reject(error);
            } else {
                console.log('[SENSOR] Evento enviado');
            }
        });

        const timeout = setTimeout(() => {
            console.log('[SENSOR] Sin respuesta');
            client.close();
            resolve('Sin respuesta');
        }, 2000);

        client.on('message', (msg) => {
            clearTimeout(timeout);
            console.log('[SENSOR] Respuesta: ' + msg.toString());
            client.close();
            resolve(msg.toString());
        });
    });
}

if (require.main === module) {
    const evento = {
        evento: 'mesa-liberada',
        mesa: 'M5',
        valor: 1
    };

    enviarEvento(evento)
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { enviarEvento };
