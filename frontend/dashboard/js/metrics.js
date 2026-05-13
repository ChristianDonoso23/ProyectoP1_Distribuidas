(function (global) {
	const API = 'http://localhost:3000/api';

	async function fetchDashboard() {
		try {
			const res = await fetch(`${API}/dashboard`);
			if (!res.ok) throw new Error('Error');
			const data = await res.json();
			return data.data || { mesas_ocupadas: 0, ingresos_totales: 0, reservas_hoy: 0 };
		} catch {
			return { mesas_ocupadas: 0, ingresos_totales: 0, reservas_hoy: 0 };
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

	function sortByProtocol(eventos) {
		const tcp = eventos.filter(e => (e.protocolo || '').toUpperCase() === 'TCP').slice(0, 8);
		const udp = eventos.filter(e => (e.protocolo || '').toUpperCase() === 'UDP').slice(0, 8);
		return { tcp, udp };
	}

	async function loadState() {
		const summary = await fetchDashboard();
		const mesas = await fetchMesas();
		const eventos = await fetchEventos();
		const { tcp, udp } = sortByProtocol(eventos);

		return {
			summary,
			mesas,
			eventos,
			tcpLogs: tcp,
			udpLogs: udp,
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
