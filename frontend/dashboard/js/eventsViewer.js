(function (global) {
	function renderFeed(container, eventos) {
		if (!container) return;

		const items = (eventos || []).slice(0, 12);
		if (items.length === 0) {
			container.innerHTML = '<div class="empty-state">Sin actividad reciente</div>';
			return;
		}

		container.innerHTML = items.map((e) => `
			<article class="event-card">
				<div class="event-top">
					<h3 class="event-title">${e.tipo_evento || 'evento'}</h3>
					<span class="badge ${(e.protocolo || '').toLowerCase()}">${e.protocolo || 'SISTEMA'}</span>
				</div>
				<div class="event-meta">${e.descripcion || 'Sin descripción'}</div>
				<div class="event-meta">${e.fecha_evento ? new Date(e.fecha_evento).toLocaleString('es-EC') : '--'}</div>
			</article>
		`).join('');
	}

	function renderProtocolLogs(container, eventos, protocol) {
		if (!container) return;

		const items = (eventos || [])
			.filter((e) => (e.protocolo || '').toUpperCase() === protocol.toUpperCase())
			.slice(0, 6);

		if (items.length === 0) {
			container.innerHTML = `<div class="empty-state">Sin eventos ${protocol}</div>`;
			return;
		}

		container.innerHTML = items.map((e) => `
			<article class="log-card">
				<div class="log-top">
					<div class="log-title">${e.tipo_evento || 'evento'}</div>
					<span class="badge ${(e.protocolo || '').toLowerCase()}">${e.protocolo}</span>
				</div>
				<div class="log-meta">${e.descripcion || '--'}</div>
				<div class="log-meta">${e.fecha_evento ? new Date(e.fecha_evento).toLocaleString('es-EC') : '--'}</div>
			</article>
		`).join('');
	}

	function renderDashboardStreams(state) {
		renderFeed(document.getElementById('activity-feed'), state.eventos);
		renderProtocolLogs(document.getElementById('tcp-log-list'), state.eventos, 'TCP');
		renderProtocolLogs(document.getElementById('udp-log-list'), state.eventos, 'UDP');
	}

	global.DashboardEvents = {
		renderFeed,
		renderProtocolLogs,
		renderDashboardStreams
	};
})(window);
