(function (global) {
	let busy = false;
	let lastState = null;

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

	async function refresh() {
		if (busy) return;
		busy = true;
		updateStatus('Sincronizando...', 'loading');

		try {
			const state = await global.DashboardMetrics.loadState();
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
			document.getElementById('refresh-dashboard')?.addEventListener('click', refresh);
			updateClock();
			refresh();
			setInterval(updateClock, 1000);
			setInterval(refresh, 5000);
		}, { once: true });
	} else {
		document.getElementById('refresh-dashboard')?.addEventListener('click', refresh);
		updateClock();
		refresh();
		setInterval(updateClock, 1000);
		setInterval(refresh, 5000);
	}

	global.DashboardSocket = { refresh };
})(window);
