(function (global) {
	function renderMetricCards(container, summary) {
		if (!container) {
			return;
		}

		const cards = [
			{ label: 'Mesas ocupadas', value: summary.mesas_ocupadas, accent: 'var(--accent-2)' },
			{ label: 'Mesas disponibles', value: summary.mesas_disponibles, accent: 'var(--accent)' },
			{ label: 'Ingresos totales', value: '$' + Number(summary.ingresos_totales || 0).toFixed(2), accent: '#a8b8ff' },
			{ label: 'Reservas hoy', value: summary.reservas_hoy, accent: '#8ed17a' },
			{ label: 'Total de mesas', value: summary.total_mesas || 0, accent: '#ffa8ff' },
			{ label: 'Eventos registrados', value: summary.eventos_registrados || 0, accent: '#ffd77f' }
		];

		container.innerHTML = cards.map((card) => `
			<article class="kpi-card">
				<div class="kpi-label">${card.label}</div>
				<div class="kpi-value" style="color:${card.accent}">${card.value}</div>
			</article>
		`).join('');
	}

	function renderBarList(container, title, meta, items, accentClass) {
		if (!container) {
			return;
		}

		const safeItems = items || [];
		const maxValue = Math.max(...safeItems.map((item) => Number(item.value || 0)), 1);

		container.innerHTML = `
			<article class="chart-card">
				<div class="chart-card-header">
					<h3 class="chart-card-title">${title}</h3>
					<span class="chart-card-meta">${meta}</span>
				</div>
				<div class="bar-list">
					${safeItems.map((item) => {
						const width = Math.max(6, Math.round((Number(item.value || 0) / maxValue) * 100));

						return `
							<div class="bar-row">
								<div class="bar-label">${item.label}</div>
								<div class="bar-track">
									<div class="bar-fill ${accentClass || ''}" style="width:${width}%"></div>
								</div>
								<div class="bar-value">${item.value}</div>
							</div>
						`;
					}).join('')}
				</div>
			</article>
		`;
	}

	function renderStatusChart(container, state) {
		const items = [
			{ label: 'Ocupadas', value: state.occupied },
			{ label: 'Disponibles', value: state.available }
		];

		renderBarList(container, 'Mesas', `${state.mesas.length} totales`, items);
	}

	function renderProtocolChart(container, state) {
		const items = [];
		if (state.tcpLogs.length > 0) items.push({ label: 'TCP', value: state.tcpLogs.length });
		if (state.udpLogs.length > 0) items.push({ label: 'UDP', value: state.udpLogs.length });
		if (items.length === 0) items.push({ label: 'Sin datos', value: 0 });

		renderBarList(container, 'Protocolos', `${state.eventos.length} eventos`, items);
	}

	function renderDashboard(state) {
		const kpiGrid = document.getElementById('kpi-grid');
		const statusChart = document.getElementById('status-chart');
		const protocolChart = document.getElementById('protocol-chart');
		const occupancyBadge = document.getElementById('occupancy-badge');
		const protocolBadge = document.getElementById('protocol-badge');

		renderMetricCards(kpiGrid, state.summary);
		renderStatusChart(statusChart, state);
		renderProtocolChart(protocolChart, state);

		if (occupancyBadge) {
			occupancyBadge.textContent = `${state.occupied}/${state.available}`;
		}

		if (protocolBadge) {
			const count = (state.tcpLogs.length > 0 ? 1 : 0) + (state.udpLogs.length > 0 ? 1 : 0);
			protocolBadge.textContent = `${count} protocolos`;
		}
	}

	global.DashboardCharts = {
		renderMetricCards,
		renderStatusChart,
		renderProtocolChart,
		renderDashboard
	};
})(window);
