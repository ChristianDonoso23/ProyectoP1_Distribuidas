const net = require('net');
const {
	DEFAULT_HOST,
	DEFAULT_TCP_PORT,
	NORMALIZED_EVENTS,
	PROTOCOLS,
	buildTicket,
	parsePayload,
	safeNumber,
	safeString
} = require('./protocolToolkit');
const { recordEvent } = require('../sockets/socketHandler');

function normalizeFacturaPayload(payload = {}) {
	const source = payload.invoice || payload.factura || payload.data || payload;

	return {
		cliente: safeString(source.cliente || source.nombre_cliente, 'Cliente invitado'),
		mesa: safeString(source.mesa || source.numero_mesa || source.id_mesa, 'M-?'),
		total: safeNumber(source.total ?? source.total_pagado ?? source.monto, 0),
		metodo_pago: safeString(source.metodo_pago || source.metodoPago, 'efectivo'),
		concepto: safeString(source.concepto || source.descripcion, 'Consumo del restaurante'),
		referencia: safeString(source.referencia || source.id_factura, ''),
		raw: source
	};
}

async function handleFactura(socket, rawMessage, options = {}) {
	const parsedPayload = parsePayload(rawMessage);

	if (!parsedPayload) {
		socket.write('ACK|TCP|payload-vacio\n');
		return;
	}

	const factura = normalizeFacturaPayload(parsedPayload);
	const ticket = buildTicket(factura);

	await recordEvent({
		scope: 'TCP',
		protocol: PROTOCOLS.TCP,
		type: NORMALIZED_EVENTS.FACTURA_PROCESADA,
		description: `Factura recibida correctamente para ${factura.cliente} en mesa ${factura.mesa}`,
		details: factura,
		persist: true,
		counterName: 'ticketsProcessed',
		counterDelta: 1
	});

	if (typeof options.onFactura === 'function') {
		await Promise.resolve(options.onFactura({ ...factura, ticket }));
	}

	socket.write(`${ticket}\n`);
	socket.write('ACK|TCP|Factura recibida correctamente\n');
}

function createTcpServer(options = {}) {
	const port = Number(options.port || DEFAULT_TCP_PORT);
	const host = options.host || DEFAULT_HOST;

	const server = net.createServer((socket) => {
		const remoteLabel = `${socket.remoteAddress || 'desconocido'}:${socket.remotePort || '0'}`;

		void recordEvent({
			scope: 'TCP',
			protocol: PROTOCOLS.TCP,
			type: NORMALIZED_EVENTS.CONEXION_TCP,
			description: `Cliente conectado desde ${remoteLabel}`,
			details: { remoteLabel },
			persist: false,
			counterName: 'tcpConnections',
			counterDelta: 1
		}).catch((error) => {
			console.error(`[TCP] No se pudo registrar la conexión: ${error.message}`);
		});

		socket.setEncoding('utf8');

		socket.on('data', async (chunk) => {
			try {
				await handleFactura(socket, chunk.toString('utf8').trim(), options);
			} catch (error) {
				await recordEvent({
					scope: 'TCP',
					protocol: PROTOCOLS.TCP,
					type: NORMALIZED_EVENTS.ACTIVIDAD_GENERAL,
					description: `Error procesando factura TCP: ${error.message}`,
					details: { error: error.message },
					persist: false
				});

				socket.write('ACK|TCP|error-procesando-factura\n');
			}
		});

		socket.on('close', () => {
			void recordEvent({
				scope: 'TCP',
				protocol: PROTOCOLS.TCP,
				type: NORMALIZED_EVENTS.ACTIVIDAD_GENERAL,
				description: `Conexión TCP cerrada por ${remoteLabel}`,
				details: { remoteLabel },
				persist: false,
				counterName: 'tcpConnections',
				counterDelta: -1
			}).catch((error) => {
				console.error(`[TCP] No se pudo registrar el cierre: ${error.message}`);
			});
		});

		socket.on('error', (error) => {
			void recordEvent({
				scope: 'TCP',
				protocol: PROTOCOLS.TCP,
				type: NORMALIZED_EVENTS.ACTIVIDAD_GENERAL,
				description: `Fallo TCP en ${remoteLabel}: ${error.message}`,
				details: { error: error.message, remoteLabel },
				persist: false
			}).catch((recordError) => {
				console.error(`[TCP] No se pudo registrar el error: ${recordError.message}`);
			});
		});
	});

	return new Promise((resolve, reject) => {
		server.once('error', reject);

		server.listen(port, host, () => {
			console.log(`[TCP] Servidor escuchando en ${host}:${port}`);
			resolve({ server, host, port });
		});
	});
}

function sendFactura(payload = {}, options = {}) {
	const host = options.host || '127.0.0.1';
	const port = Number(options.port || DEFAULT_TCP_PORT);

	return new Promise((resolve, reject) => {
		const client = net.createConnection({ host, port }, () => {
			const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
			client.write(`${body}\n`);
			client.end();
		});

		let response = '';

		client.setEncoding('utf8');

		client.on('data', (chunk) => {
			response += chunk;
		});

		client.on('end', () => {
			resolve(response.trim());
		});

		client.on('error', reject);
	});
}

module.exports = {
	createTcpServer,
	sendFactura,
	normalizeFacturaPayload,
	handleFactura
};
