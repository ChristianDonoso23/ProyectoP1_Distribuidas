const { EventEmitter } = require('events');
const {
	NORMALIZED_EVENTS,
	PROTOCOLS,
	normalizeEventType
} = require('./protocolToolkit');
const { recordEvent } = require('../sockets/socketHandler');

const realtimeBus = new EventEmitter();

function broadcast(eventName, payload = {}) {
	const type = normalizeEventType(eventName || payload.type || NORMALIZED_EVENTS.ACTIVIDAD_GENERAL);
	const entry = {
		type,
		payload,
		timestamp: new Date().toISOString()
	};

	realtimeBus.emit(type, entry);
	realtimeBus.emit('message', entry);

	void recordEvent({
		scope: 'SOCKET',
		protocol: PROTOCOLS.SOCKET,
		type,
		description: payload.description || `Evento en tiempo real: ${type}`,
		details: payload,
		persist: true
	}).catch((error) => {
		console.error(`[SOCKET] No se pudo registrar el evento: ${error.message}`);
	});

	return entry;
}

function subscribe(eventName, handler) {
	realtimeBus.on(eventName, handler);

	return () => realtimeBus.off(eventName, handler);
}

module.exports = {
	realtimeBus,
	broadcast,
	subscribe
};
