(function (global) {
	function renderMetricCards(container, summary) {
		if (!container) {
			return;
		}

		const cards = [
			{ label: 'Mesas ocupadas', value: summary.mesas_ocupadas, accent: 'var(--accent-2)' },
			{ label: 'Mesas disponibles', value: summary.mesas_disponibles, accent: 'var(--accent)' },
			{ label: 'Ingresos hoy', value: '$' + Number(summary.ingresos_hoy || 0).toFixed(2), accent: '#a8b8ff' },
			{ label: 'Reservas hoy', value: summary.reservas_hoy, accent: '#8ed17a' },
			{ label: 'Total de mesas', value: summary.total_mesas || 0, accent: '#ffa8ff' },
			{ label: 'Eventos hoy', value: summary.eventos_hoy || 0, accent: '#ffd77f' }
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

	// Protocol panel removed — no-op placeholder kept for compatibility
	function renderProtocolChart() {
		return;
	}

	function renderDashboard(state) {
		const kpiGrid = document.getElementById('kpi-grid');
		const statusChart = document.getElementById('status-chart');
		const occupancyBadge = document.getElementById('occupancy-badge');
		const protocolBadge = document.getElementById('protocol-badge');

		renderMetricCards(kpiGrid, state.summary);
		renderStatusChart(statusChart, state);
    
		if (occupancyBadge) {
			occupancyBadge.textContent = `${state.occupied}/${state.available}`;
		}
	}

	global.DashboardCharts = {
		renderMetricCards,
		renderStatusChart,
		renderProtocolChart,
		renderDashboard
	};
})(window);
