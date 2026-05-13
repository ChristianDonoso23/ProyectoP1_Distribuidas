const dgram = require('dgram');

const server = dgram.createSocket('udp4');

server.on('message', (msg, rinfo) => {
    const mensaje = msg.toString().trim();
    console.log(`[UDP] Evento: ${rinfo.address}:${rinfo.port}`);

    try {
        const evento = JSON.parse(mensaje);
        console.log(`[UDP] Tipo: ${evento.evento}`);
        console.log(`[UDP] Mesa: ${evento.mesa}`);
        
        const respuesta = `ACK|${evento.evento} procesado`;
        server.send(respuesta, rinfo.port, rinfo.address);
    } catch (error) {
        console.error(`[UDP] Error: ${error.message}`);
        const respuesta = 'ERROR|Formato inválido';
        server.send(respuesta, rinfo.port, rinfo.address);
    }
});

server.on('error', (error) => {
    console.error(`[UDP] Error: ${error.message}`);
});

server.bind(4001, '0.0.0.0', () => {
    console.log('[UDP] Servidor escuchando en puerto 4001');
});

module.exports = server;
