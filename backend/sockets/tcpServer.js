const net = require('net');

const server = net.createServer((socket) => {
    console.log(`[TCP] Conexión: ${socket.remoteAddress}:${socket.remotePort}`);

    socket.on('data', (data) => {
        const mensaje = data.toString().trim();
        console.log(`[TCP] Datos: ${mensaje}`);

        try {
            const factura = JSON.parse(mensaje);
            console.log(`[TCP] Cliente: ${factura.cliente}`);
            console.log(`[TCP] Mesa: ${factura.mesa}`);
            console.log(`[TCP] Total: $${factura.total}`);
            
            socket.write('ACK|Factura procesada\\n');
        } catch (error) {
            console.error(`[TCP] Error: ${error.message}`);
            socket.write('ERROR|Formato inválido\\n');
        }
    });

    socket.on('end', () => {
        console.log('[TCP] Conexión cerrada');
    });

    socket.on('error', (error) => {
        console.error(`[TCP] Error: ${error.message}`);
    });
});

server.listen(4000, '0.0.0.0', () => {
    console.log('[TCP] Servidor escuchando en puerto 4000');
});

module.exports = server;
