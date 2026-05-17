const { NORMALIZED_EVENTS, PROTOCOLS } = require('./protocolToolkit');
const { recordEvent, snapshotRuntime } = require('../sockets/socketHandler');

function createTimerService(options = {}) {
	const intervalMs = Number(options.intervalMs || 10000);
	const onTick = options.onTick;

	const timer = setInterval(async () => {
		try {
			const snapshot = snapshotRuntime();
			const heartbeat = {
				...snapshot,
				generatedAt: new Date().toISOString()
			};

			if (typeof onTick === 'function') {
				await Promise.resolve(onTick(heartbeat));
			}

			await recordEvent({
				scope: 'SYSTEM',
				protocol: PROTOCOLS.SYSTEM,
				type: NORMALIZED_EVENTS.LATIDO_METRICAS,
				description: `Latido de métricas: ${snapshot.tcpConnections} conexiones TCP, ${snapshot.udpPackets} paquetes UDP`,
				details: heartbeat,
				persist: false
			});
		} catch (error) {
			console.error(`[SYSTEM] No se pudo emitir el latido de métricas: ${error.message}`);
		}
	}, intervalMs);

	return () => clearInterval(timer);
}

function runOneShotSummary() {
	return snapshotRuntime();
}

module.exports = {
	createTimerService,
	runOneShotSummary
};
