const EventEmitter = require('events');
const jwt = require('jsonwebtoken');
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

// Selection maps for tables
const seleccionPorMesa = new Map();
const mesasPorSocket = new Map();

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

// MySQL-dependent event persistence has been removed (Centralizing logging with Winston)

async function recordEvent({
	scope = 'SYSTEM',
	protocol = PROTOCOLS.SYSTEM,
	type = NORMALIZED_EVENTS.ACTIVIDAD_GENERAL,
	description = '',
	details = {},
	persist = true, // Ignored, MySQL persistence removed
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

	// Centralized logging via Winston instead of direct console.log
	if (global.logger) {
		if (scope === 'ERROR') {
			global.logger.error(line);
		} else if (scope === 'WARN') {
			global.logger.warn(line);
		} else {
			global.logger.info(line);
		}
	} else {
		console.log(line);
	}

	await appendRuntimeLine(line);

	// Persist to MySQL has been deleted to fulfill 'Eliminar logs dependientes de MySQL'

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

// Function to subscribe to realtime events
function subscribe(handler) {
	realtimeBus.on('event', handler);

	return () => realtimeBus.off('event', handler);
}

// Registers the complete WebSocket flow, authentication and real-time state
function registerSocketHandler(io) {
	// 1. Mandatory JWT Handshake Validation
	io.use((socket, next) => {
		const token = socket.handshake.auth?.token || socket.handshake.headers['authorization']?.split(' ')[1];
		
		if (!token) {
			if (global.logger) {
				global.logger.warn(`Handshake rechazado para el socket ${socket.id}: Token no proporcionado`);
			}
			return next(new Error('Acceso denegado. Token no proporcionado.'));
		}

		try {
            // 2. Se elimina el require síncrono interno
			const decoded = jwt.verify(token, process.env.JWT_SECRET);
			socket.userId = decoded.id;
			socket.correo = decoded.correo;
			
			if (global.logger) {
				global.logger.info(`Handshake WebSocket exitoso para usuario: ${decoded.correo} (socket: ${socket.id})`);
			}
			next();
		} catch (error) {
			if (global.logger) {
				global.logger.error(`Handshake rechazado para el socket ${socket.id}: Token inválido o expirado. Error: ${error.message}`);
			}
			return next(new Error('Token inválido o expirado.'));
		}
	});

	// 2. Socket Connection and Event Listeners
	io.on('connection', (socket) => {
		if (global.logger) {
			global.logger.info(`Cliente conectado por WebSocket: ${socket.id} (Usuario: ${socket.correo})`);
		}
		adjustCounter('websocketClients', 1);

		mesasPorSocket.set(socket.id, new Set());

		socket.on('mesa-seleccionada', (event) => {
			const idMesa = parseInt(event?.id_mesa);
			const clientId = String(event?.clientId || '').trim();

			if (!idMesa || !clientId) {
				socket.emit('mesa-seleccionada-rechazada', { id_mesa: idMesa || null, motivo: 'Datos incompletos' });
				return;
			}

			const propietarioActual = seleccionPorMesa.get(idMesa);
			if (propietarioActual && propietarioActual !== clientId) {
				socket.emit('mesa-seleccionada-rechazada', { id_mesa: idMesa, motivo: 'Mesa seleccionada por otro cliente', seleccionada_por: propietarioActual });
				io.to(socket.id).emit('mesa-ocupada-por', { id_mesa: idMesa, clientId: propietarioActual });
				return;
			}

			seleccionPorMesa.set(idMesa, clientId);
			mesasPorSocket.get(socket.id).add(idMesa);
			
			if (global.logger) {
				global.logger.info(`Mesa ${idMesa} seleccionada temporalmente por cliente ${clientId} (Usuario: ${socket.correo})`);
			}

			io.emit('mesa-seleccionada', { id_mesa: idMesa, clientId });
			socket.emit('mesa-seleccionada-confirmada', { id_mesa: idMesa, clientId });
		});

		socket.on('mesa-deseleccionada', (event) => {
			const idMesa = parseInt(event?.id_mesa);
			const clientId = String(event?.clientId || '').trim();

			if (!idMesa || !clientId) {
				return;
			}

			const propietarioActual = seleccionPorMesa.get(idMesa);
			if (propietarioActual !== clientId) {
				socket.emit('mesa-deseleccionada-rechazada', { id_mesa: idMesa, motivo: 'Solo el cliente propietario puede liberar la selección' });
				return;
			}

			seleccionPorMesa.delete(idMesa);
			mesasPorSocket.get(socket.id)?.delete(idMesa);
			
			if (global.logger) {
				global.logger.info(`Mesa ${idMesa} deseleccionada por cliente ${clientId} (Usuario: ${socket.correo})`);
			}

			io.emit('mesa-deseleccionada', { id_mesa: idMesa, clientId });
			socket.emit('mesa-deseleccionada-confirmada', { id_mesa: idMesa, clientId });
		});

		socket.on('disconnect', () => {
			const mesasSeleccionadas = mesasPorSocket.get(socket.id);

			if (mesasSeleccionadas) {
				for (const idMesa of mesasSeleccionadas) {
					const propietarioActual = seleccionPorMesa.get(idMesa);
					if (propietarioActual) {
						seleccionPorMesa.delete(idMesa);
						io.emit('mesa-deseleccionada', { id_mesa: idMesa, clientId: propietarioActual, motivo: 'desconexion' });
					}
				}
			}

			mesasPorSocket.delete(socket.id);
			adjustCounter('websocketClients', -1);
			
			if (global.logger) {
				global.logger.info(`Cliente desconectado de WebSocket: ${socket.id} (Usuario: ${socket.correo})`);
			}
		});
	});

	// 3. Sincronizar con el bus de eventos en tiempo real interno para limpiar selecciones y retransmitir
	// Se requiere dinámicamente para evitar acoplamiento circular en la importación inicial
	const { subscribe: serviceSubscribe } = require('../services/websocketService');
	
	serviceSubscribe('mesa-ocupada', (event) => {
		const payload = event.payload || event;
		if (payload?.id_mesa) {
			seleccionPorMesa.delete(parseInt(payload.id_mesa));
		}
		io.emit('mesa-ocupada', payload); 
	});

	serviceSubscribe('mesa-liberada', (event) => {
		const payload = event.payload || event;
		if (payload?.id_mesa) {
			seleccionPorMesa.delete(parseInt(payload.id_mesa));
		}
		io.emit('mesa-liberada', payload);
	});
}

module.exports = {
	PROTOCOLS,
	NORMALIZED_EVENTS,
	recordEvent,
	snapshotRuntime,
	subscribe,
	adjustCounter,
	registerSocketHandler
};
