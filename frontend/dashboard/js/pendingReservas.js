// Gestión de Reservas Pendientes de Pago para Admin

const API_BASE = 'http://localhost:3000/api';

// Cargar reservas pendientes al iniciar
async function cargarReservasPendientes() {
    try {
        const response = await fetch(`${API_BASE}/reservas/admin/pendientes`);
        const data = await response.json();
        
        if (data.success && data.data) {
            renderReservasPendientes(data.data);
            document.getElementById('pending-badge').textContent = `${data.data.length} pendientes`;
        }
    } catch (error) {
        console.error('Error cargando reservas pendientes:', error);
    }
}

// Renderizar la lista de reservas pendientes
function renderReservasPendientes(reservas) {
    const container = document.getElementById('pending-reservas-list');
    
    if (!reservas || reservas.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No hay reservas pendientes de pago</p>';
        return;
    }

    const html = reservas.map(r => `
        <div class="pending-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #eee; border-radius: 6px; margin-bottom: 10px; background: #f9f9f9;">
            <div style="flex: 1;">
                <strong>${r.nombre_cliente}</strong>
                <p style="margin: 5px 0; color: #666; font-size: 13px;">
                    Mesa: <span style="font-weight: bold; color: #333;">${r.numero_mesa}</span> (${r.zona})
                </p>
                <p style="margin: 0; color: #999; font-size: 12px;">
                    Reserva: ${new Date(r.fecha_reserva).toLocaleString('es-EC')}
                </p>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <select class="metodo-pago-select" data-id-reserva="${r.id_reserva}" style="padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
                    <option value="">Seleccionar pago...</option>
                    <option value="efectivo">💵 Efectivo</option>
                    <option value="tarjeta">💳 Tarjeta</option>
                    <option value="transferencia">🏦 Transferencia</option>
                </select>
                <button class="btn-confirmar-pago" data-id-reserva="${r.id_reserva}" style="padding: 8px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">
                    ✓ Confirmar Pago
                </button>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;

    // Agregar event listeners a los botones
    document.querySelectorAll('.btn-confirmar-pago').forEach(btn => {
        btn.addEventListener('click', confirmarPago);
    });
}

// Confirmar pago y generar factura
async function confirmarPago(e) {
    const btn = e.target;
    const idReserva = btn.dataset.idReserva;
    
    // Obtener método de pago seleccionado
    const metodoSelect = document.querySelector(`.metodo-pago-select[data-id-reserva="${idReserva}"]`);
    const metodoPago = metodoSelect.value;

    if (!metodoPago) {
        alert('⚠️ Selecciona un método de pago');
        return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ Procesando...';

    try {
        const response = await fetch(`${API_BASE}/facturas/admin/confirmar-pago`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_reserva: parseInt(idReserva),
                metodo_pago: metodoPago
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Error al confirmar pago');
        }

        // Mostrar alerta de éxito
        alert(`✓ Factura ${data.id_factura} generada exitosamente`);

        // Recargar la lista
        cargarReservasPendientes();

    } catch (error) {
        alert(`❌ Error: ${error.message}`);
        btn.disabled = false;
        btn.textContent = '✓ Confirmar Pago';
    }
}

// Cargar reservas pendientes cuando la página carga
document.addEventListener('DOMContentLoaded', () => {
    cargarReservasPendientes();
    
    // Actualizar cada 10 segundos
    setInterval(cargarReservasPendientes, 10000);
});
