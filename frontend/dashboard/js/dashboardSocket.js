(function (global) {
	let busy = false;
	let lastState = null;
	let currentDate = null; // Fecha actualmente seleccionada

	function updateStatus(msg, type) {
		const el = document.getElementById('connection-status');
		if (el) {
			el.textContent = msg;
			el.dataset.tone = type;
		}
	}

	function updateClock() {
		const el = document.getElementById('live-clock');
		if (el) {
			el.textContent = new Date().toLocaleString('es-EC');
		}
	}

	function updateSync() {
		const el = document.getElementById('last-sync');
		if (el) {
			el.textContent = `Actualizado ${new Date().toLocaleTimeString('es-EC')}`;
		}
	}

	function getDateAsString(date) {
		if (!date) return null;
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function initializeDatePicker() {
		const dateInput = document.getElementById('date-filter');
		const todayButton = document.getElementById('today-button');
		
		if (dateInput) {
			// Establecer fecha de hoy por defecto
			const today = new Date();
			dateInput.value = getDateAsString(today);
			currentDate = null; // null = usar hoy
			
			// Escuchar cambios de fecha
			dateInput.addEventListener('change', (e) => {
				currentDate = e.target.value || null; // Guardar fecha seleccionada
				refresh();
			});
		}
		
		if (todayButton) {
			// Botón para volver a hoy
			todayButton.addEventListener('click', () => {
				currentDate = null;
				const today = new Date();
				if (dateInput) {
					dateInput.value = getDateAsString(today);
				}
				refresh();
			});
		}
	}

	async function refresh() {
		if (busy) return;
		busy = true;
		updateStatus('Sincronizando...', 'loading');

		try {
			if (!global.DashboardMetrics || !global.DashboardCharts || !global.DashboardEvents) {
				throw new Error('Los módulos del dashboard no cargaron correctamente');
			}

			const state = await global.DashboardMetrics.loadState(currentDate);
			lastState = state;

			global.DashboardCharts.renderDashboard(state);
			global.DashboardEvents.renderDashboardStreams(state);

			updateSync();
			updateStatus('Sincronizado', 'ok');
		} catch (error) {
			updateStatus('Error: ' + error.message, 'error');
		} finally {
			busy = false;
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => {
			initializeDatePicker();
			document.getElementById('refresh-dashboard')?.addEventListener('click', refresh);
			updateClock();
			refresh();
			setInterval(updateClock, 1000);
			setInterval(refresh, 5000);
		}, { once: true });
	} else {
		initializeDatePicker();
		document.getElementById('refresh-dashboard')?.addEventListener('click', refresh);
		updateClock();
		refresh();
		setInterval(updateClock, 1000);
		setInterval(refresh, 5000);
	}

	global.DashboardSocket = { refresh };
})(window);
