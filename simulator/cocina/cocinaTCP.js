const net = require('net');

function enviarFactura(factura) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();

        client.connect(4000, '127.0.0.1', () => {
            console.log('[COCINA] Conectado');
            const mensaje = JSON.stringify(factura) + '\n';
            client.write(mensaje);
        });

        client.on('data', (data) => {
            console.log('[COCINA] Respuesta: ' + data.toString());
            client.end();
            resolve(data.toString());
        });

        client.on('error', (error) => {
            console.error('[COCINA] Error: ' + error.message);
            reject(error);
        });

        client.on('close', () => {
            console.log('[COCINA] Conexión cerrada');
        });
    });
}

if (require.main === module) {
    const factura = {
        cliente: 'Juan',
        mesa: 'M5',
        total: 45.50,
        metodo_pago: 'efectivo'
    };

    enviarFactura(factura)
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { enviarFactura };
