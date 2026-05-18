(function (global) {
	const API = 'http://localhost:3000/api';

	async function fetchDashboard(date) {
		try {
			const url = date ? `${API}/dashboard?date=${date}` : `${API}/dashboard`;
			const res = await fetch(url);
			if (!res.ok) throw new Error('Error');
			const data = await res.json();
			return data.data || { mesas_ocupadas: 0, ingresos_hoy: 0, reservas_hoy: 0 };
		} catch {
			return { mesas_ocupadas: 0, ingresos_hoy: 0, reservas_hoy: 0 };
		}
	}

	async function fetchMesas() {
		try {
			const res = await fetch(`${API}/mesas`);
			if (!res.ok) throw new Error('Error');
			const data = await res.json();
			return data.data || [];
		} catch {
			return [];
		}
	}

	async function fetchEventos() {
		try {
			const res = await fetch(`${API}/eventos`);
			if (!res.ok) throw new Error('Error');
			const data = await res.json();
			return data.data || [];
		} catch {
			return [];
		}
	}

	function formatMoney(value) {
		return `$${Number(value || 0).toFixed(2)}`;
	}

	function formatDate(date) {
		if (!date) return '--';
		return new Date(date).toLocaleString('es-EC');
	}

	// Protocol-specific grouping removed (no TCP/UDP panels)

	async function loadState(date) {
		const summary = await fetchDashboard(date);
		const mesas = await fetchMesas();
		const eventos = await fetchEventos();
		return {
			summary,
			mesas,
			eventos,
			occupied: summary.mesas_ocupadas || 0,
			available: Math.max(0, mesas.length - (summary.mesas_ocupadas || 0))
		};
	}

	global.DashboardMetrics = {
		loadState,
		fetchDashboard,
		fetchMesas,
		fetchEventos,
		formatMoney,
		formatDate
	};
})(window);
