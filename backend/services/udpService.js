const dgram = require('dgram');
const {
	DEFAULT_HOST,
	DEFAULT_UDP_PORT,
	NORMALIZED_EVENTS,
	PROTOCOLS,
	describeSensorEvent,
	parsePayload
} = require('./protocolToolkit');
const { recordEvent } = require('../sockets/socketHandler');

async function handleUdpMessage(server, message, rinfo, options = {}) {
	const parsedPayload = parsePayload(message.toString('utf8').trim());
	const sensorEvent = describeSensorEvent(parsedPayload || {});

	await recordEvent({
		scope: 'UDP',
		protocol: PROTOCOLS.UDP,
		type: sensorEvent.type,
		description: sensorEvent.description,
		details: {
			...parsedPayload,
			remoteAddress: rinfo.address,
			remotePort: rinfo.port
		},
		persist: true,
		counterName: 'udpPackets',
		counterDelta: 1
	});

	if (typeof options.onMessage === 'function') {
		await Promise.resolve(options.onMessage({
			payload: parsedPayload,
			event: sensorEvent,
			remoteAddress: rinfo.address,
			remotePort: rinfo.port
		}));
	}

	const ackMessage = Buffer.from(`ACK|UDP|${sensorEvent.type}|${sensorEvent.description}`);
	server.send(ackMessage, rinfo.port, rinfo.address);
}

function createUdpServer(options = {}) {
	const port = Number(options.port || DEFAULT_UDP_PORT);
	const host = options.host || DEFAULT_HOST;

	const server = dgram.createSocket('udp4');

	server.on('listening', () => {
		const address = server.address();
		console.log(`[UDP] Servidor escuchando en ${address.address}:${address.port}`);
	});

	server.on('message', async (message, rinfo) => {
		try {
			await handleUdpMessage(server, message, rinfo, options);
		} catch (error) {
			await recordEvent({
				scope: 'UDP',
				protocol: PROTOCOLS.UDP,
				type: NORMALIZED_EVENTS.ACTIVIDAD_GENERAL,
				description: `Error procesando datagrama UDP: ${error.message}`,
				details: { error: error.message, remoteAddress: rinfo.address, remotePort: rinfo.port },
				persist: false
			});
		}
	});

	server.on('error', (error) => {
		console.error(`[UDP] ${error.message}`);
	});

	return new Promise((resolve, reject) => {
		server.once('error', reject);

		server.bind(port, host, () => {
			resolve({ server, host, port });
		});
	});
}

function sendUdpMessage(payload = {}, options = {}) {
	const host = options.host || '127.0.0.1';
	const port = Number(options.port || DEFAULT_UDP_PORT);

	return new Promise((resolve, reject) => {
		const client = dgram.createSocket('udp4');
		const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
		const packet = Buffer.from(body);

		let settled = false;

		const finish = (value) => {
			if (!settled) {
				settled = true;
				client.close();
				resolve(value);
			}
		};

		client.on('message', (reply) => {
			finish(reply.toString('utf8'));
		});

		client.on('error', (error) => {
			if (!settled) {
				settled = true;
				client.close();
				reject(error);
			}
		});

		client.send(packet, port, host, (error) => {
			if (error) {
				if (!settled) {
					settled = true;
					client.close();
					reject(error);
				}

				return;
			}

			setTimeout(() => finish('ACK|UDP|sin-respuesta'), Number(options.timeoutMs || 1200));
		});
	});
}

module.exports = {
	createUdpServer,
	sendUdpMessage,
	handleUdpMessage
};
