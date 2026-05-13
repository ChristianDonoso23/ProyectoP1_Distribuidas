const { enviarFactura } = require('../cocina/cocinaTCP');
const { enviarEvento } = require('../sensores/sensorUDP');

async function generarTrafico() {
    console.log('\n[SIMULADOR] Iniciando tráfico...\n');

    for (let i = 1; i <= 3; i++) {
        console.log(`--- Ciclo ${i} ---`);

        // Enviar factura
        const factura = {
            cliente: `Cliente-${i}`,
            mesa: `M${4 + i}`,
            total: 25 + i * 5,
            metodo_pago: i % 2 === 0 ? 'tarjeta' : 'efectivo'
        };

        await enviarFactura(factura);
        await new Promise(r => setTimeout(r, 500));

        // Enviar evento
        const evento = {
            evento: i % 2 === 0 ? 'mesa-ocupada' : 'mesa-liberada',
            mesa: `M${4 + i}`,
            valor: i
        };

        await enviarEvento(evento);

        if (i < 3) {
            console.log('\n[SIMULADOR] Esperando 2s...\n');
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    console.log('\n[SIMULADOR] Tráfico completado\n');
}

if (require.main === module) {
    generarTrafico()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { generarTrafico };
