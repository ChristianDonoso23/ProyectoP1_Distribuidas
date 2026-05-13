const EventEmitter = require('events');
const Evento = require('../models/Evento');
const {
	appendRuntimeLine,
	formatStructuredLog,
	normalizeEventType,
	NORMALIZED_EVENTS,
	PROTOCOLS
} = require('../services/protocolToolkit');

const realtimeBus = new EventEmitter();

const runtimeState = {
	tcpConnections: 0,
	udpPackets: 0,
	websocketClients: 0,
	ticketsProcessed: 0,
	lastEvents: []
};

function adjustCounter(counterName, delta) {
	const currentValue = Number(runtimeState[counterName] || 0);
	runtimeState[counterName] = Math.max(0, currentValue + delta);
	return runtimeState[counterName];
}

function pushRecentEvent(entry) {
	runtimeState.lastEvents.unshift(entry);

	if (runtimeState.lastEvents.length > 50) {
		runtimeState.lastEvents.length = 50;
	}
}

async function persistEvent(type, protocol, description) {
	try {
		return await Evento.registrar(type, protocol, description);
	} catch (error) {
		console.error(formatStructuredLog('SYSTEM', 'No se pudo persistir el evento', { error: error.message }));
		return null;
	}
}

async function recordEvent({
	scope = 'SYSTEM',
	protocol = PROTOCOLS.SYSTEM,
	type = NORMALIZED_EVENTS.ACTIVIDAD_GENERAL,
	description = '',
	details = {},
	persist = true,
	counterName,
	counterDelta = 0
} = {}) {
	const normalizedType = normalizeEventType(type);
	const entry = {
		scope,
		protocol,
		type: normalizedType,
		description,
		details,
		timestamp: new Date().toISOString()
	};

	const line = formatStructuredLog(scope, description, details);
	console.log(line);

	await appendRuntimeLine(line);

	if (persist) {
		await persistEvent(normalizedType, protocol, description);
	}

	if (counterName && counterDelta !== 0) {
		adjustCounter(counterName, counterDelta);
	}

	pushRecentEvent(entry);
	realtimeBus.emit('event', entry);

	return entry;
}

function snapshotRuntime() {
	return {
		...runtimeState,
		lastEvents: [...runtimeState.lastEvents]
	};
}

function subscribe(handler) {
	realtimeBus.on('event', handler);

	return () => realtimeBus.off('event', handler);
}

module.exports = {
	PROTOCOLS,
	NORMALIZED_EVENTS,
	recordEvent,
	snapshotRuntime,
	subscribe,
	adjustCounter
};
