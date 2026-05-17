import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:3000');

function App() {
  const [mesas, setMesas] = useState([]);
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
  const [horaActual, setHoraActual] = useState(new Date());
  const [factura, setFactura] = useState(null);
  const [mostrarFactura, setMostrarFactura] = useState(false);
  const [cargando, setCargando] = useState(false);

  // Reloj interno
  useEffect(() => {
    const timer = setInterval(() => setHoraActual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Carga inicial y WebSockets
  useEffect(() => {
    const cargarMesas = async () => {
      try {
        const respuesta = await fetch('http://localhost:3000/api/mesas');
        const data = await respuesta.json();
        if (data.success) {
          setMesas(data.data);
        }
      } catch (error) {
        console.error("Error de conexión:", error);
      }
    };

    cargarMesas();

    // Evento: mesa ocupada (incluye expiracion desde el backend corregido)
    socket.on('mesa-ocupada', (data) => {
      const idMesa = parseInt(data.id_mesa);
      const expiracion = data.expiracion || null;
      setMesas(prev => prev.map(m =>
        m.id_mesa === idMesa
          ? { ...m, estado: 'ocupada', expiracion }
          : m
      ));
    });

    // Evento: mesa liberada
    socket.on('mesa-liberada', (data) => {
      const idMesa = parseInt(data.id_mesa);
      setMesas(prev => prev.map(m =>
        m.id_mesa === idMesa
          ? { ...m, estado: 'disponible', expiracion: null }
          : m
      ));
      // Deseleccionar si estaba seleccionada
      setSeleccionadas(prev => prev.filter(id => id !== idMesa));
    });

    return () => {
      socket.off('mesa-ocupada');
      socket.off('mesa-liberada');
    };
  }, []);

  // Manejo de Selección Múltiple
  const handleMesaClick = (mesa) => {
    if (mesa.estado === 'disponible') {
      setSeleccionadas(prev =>
        prev.includes(mesa.id_mesa)
          ? prev.filter(id => id !== mesa.id_mesa)
          : [...prev, mesa.id_mesa]
      );
      setMensaje({ texto: '', tipo: '' });
    } else {
      setMensaje({ texto: '⚠ La mesa seleccionada no está disponible.', tipo: 'error' });
    }
  };

  // Cálculo de tiempo para la UI
  const calcularTiempoRestante = (expiracionString) => {
    if (!expiracionString) return '';
    const expDate = new Date(expiracionString);
    const diff = expDate - horaActual;
    if (diff <= 0) return '00:00';
    const minutos = Math.floor((diff / 1000 / 60) % 60);
    const segundos = Math.floor((diff / 1000) % 60);
    return `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
  };

  // Generar factura para una mesa reservada
  const generarFacturaParaMesa = async (id_reserva, id_mesa, nombre_cliente, metodo_pago) => {
    const res = await fetch('http://localhost:3000/api/facturas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_reserva, id_mesa, nombre_cliente, metodo_pago })
    });
    if (!res.ok) throw new Error('Error al generar factura');
    return res.json();
  };

  // Procesamiento de Reserva Múltiple + Generación de Factura
  const hacerReservaMultiple = async (e) => {
    e.preventDefault();
    if (seleccionadas.length === 0) {
      setMensaje({ texto: 'Seleccione al menos una mesa del mapa.', tipo: 'error' });
      return;
    }

    const nombre = e.target.nombre_cliente.value.trim();
    const metodo_pago = e.target.metodo_pago.value;

    const fechaExp = new Date();
    fechaExp.setHours(fechaExp.getHours() + 1);
    const expiracionFormat = fechaExp.toISOString().slice(0, 19).replace('T', ' ');

    setCargando(true);
    let errores = 0;
    const facturasTotales = [];

    for (const idMesa of seleccionadas) {
      try {
        // 1. Crear reserva
        const res = await fetch('http://localhost:3000/api/reservas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_mesa: idMesa,
            nombre_cliente: nombre,
            expiracion: expiracionFormat
          })
        });

        const reservaData = await res.json();

        if (res.ok && reservaData.success) {
          // Actualizar estado local inmediatamente
          setMesas(prev => prev.map(m =>
            m.id_mesa === idMesa ? { ...m, estado: 'ocupada', expiracion: expiracionFormat } : m
          ));

          // 2. Generar factura
          try {
            const facturaRes = await generarFacturaParaMesa(
              reservaData.id_reserva,
              idMesa,
              nombre,
              metodo_pago
            );
            if (facturaRes.success) {
              facturasTotales.push(facturaRes.data);
            }
          } catch (factErr) {
            console.error('Error generando factura para mesa', idMesa, factErr);
          }
        } else {
          errores++;
        }
      } catch (err) {
        errores++;
        console.error('Error en reserva mesa', idMesa, err);
      }
    }

    setCargando(false);

    if (errores === 0) {
      setMensaje({ texto: `✓ Reserva confirmada para ${seleccionadas.length} mesa(s).`, tipo: 'success' });
      if (facturasTotales.length > 0) {
        setFactura(facturasTotales);
        setMostrarFactura(true);
      }
      setSeleccionadas([]);
      e.target.reset();
    } else {
      setMensaje({ texto: `Se procesó con errores en ${errores} mesa(s).`, tipo: 'error' });
    }
  };

  const obtenerNumerosSeleccionados = () => {
    if (seleccionadas.length === 0) return 'Haga clic en una mesa del plano';
    const numeros = mesas.filter(m => seleccionadas.includes(m.id_mesa)).map(m => m.numero_mesa);
    return numeros.join(', ');
  };

  const calcularTotalFacturas = () => {
    if (!factura) return 0;
    return factura.reduce((sum, f) => sum + parseFloat(f.total_pagado || 0), 0).toFixed(2);
  };

  // Separar mesas por zona
  const mesasGeneral  = mesas.filter(m => m.zona === 'GENERAL');
  const mesasTerraza  = mesas.filter(m => m.zona === 'TERRAZA');
  const mesasVip      = mesas.filter(m => m.zona === 'VIP');

  // Contadores de estado
  const totalDisponibles = mesas.filter(m => m.estado === 'disponible').length;
  const totalOcupadas    = mesas.filter(m => m.estado === 'ocupada').length;

  const renderMesa = (mesa) => (
    <div
      key={mesa.id_mesa}
      className={`mesa ${mesa.estado} ${seleccionadas.includes(mesa.id_mesa) ? 'seleccionada' : ''}`}
      onClick={() => handleMesaClick(mesa)}
      title={`Mesa ${mesa.numero_mesa} — ${mesa.estado === 'ocupada' ? 'Ocupada' : 'Disponible'}`}
    >
      <span className="numero-mesa">{mesa.numero_mesa}</span>
      {mesa.estado === 'ocupada' && mesa.expiracion && (
        <span className="timer">{calcularTiempoRestante(mesa.expiracion)}</span>
      )}
    </div>
  );

  return (
    <div className="App">
      {/* ── HEADER ── */}
      <header className="header">
        <div className="header-inner">
          <div className="header-brand">
            <span className="header-icon">🍽</span>
            <h1 className="header-title">E-Restaurante Suite</h1>
          </div>
          <div className="header-status">
            <span className="status-dot"></span>
            <span className="status-text">Sistema Activo</span>
            <span className="header-clock">
              {horaActual.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </header>

      {/* ── STATS BAR ── */}
      <div className="stats-bar">
        <div className="stat-chip available">
          <span className="stat-dot"></span>
          <span>{totalDisponibles} Disponibles</span>
        </div>
        <div className="stat-chip occupied">
          <span className="stat-dot"></span>
          <span>{totalOcupadas} Reservadas</span>
        </div>
        <div className="stat-chip total">
          <span>{mesas.length} Mesas totales</span>
        </div>
      </div>

      {/* ── DASHBOARD: Plano Izquierda | Form Derecha ── */}
      <div className="dashboard">

        {/* ── PANEL IZQUIERDO: PLANO ── */}
        <section className="panel-plano">
          {/* Label de Estado ENCIMA del plano */}
          <div className="plano-estado-bar">
            <div className="estado-label-group">
              <span className="estado-label-dot disponible-dot"></span>
              <span className="estado-label-text">Disponible</span>
            </div>
            <div className="estado-label-group">
              <span className="estado-label-dot ocupada-dot"></span>
              <span className="estado-label-text">Reservada</span>
            </div>
            <div className="estado-label-group">
              <span className="estado-label-dot seleccionada-dot"></span>
              <span className="estado-label-text">Seleccionada</span>
            </div>
          </div>

          {/* Zonas del plano */}
          <div className="zonas-header">
            <div className="zona-tag general-tag">🪑 General (C)</div>
            <div className="zona-tag terraza-tag">🌿 Terraza (B)</div>
            <div className="zona-tag vip-tag">⭐ VIP (A)</div>
          </div>

          <div className="plano-container">
            <img
              src="/plano_restaurante.jpg"
              alt="Plano del restaurante"
              className="plano-img"
            />

            {/* Zona GENERAL */}
            <div className="zona-overlay zona-general">
              <div className="zona-grid">
                {mesasGeneral.map(renderMesa)}
              </div>
            </div>

            {/* Zona TERRAZA */}
            <div className="zona-overlay zona-terraza">
              <div className="zona-grid">
                {mesasTerraza.map(renderMesa)}
              </div>
            </div>

            {/* Zona VIP */}
            <div className="zona-overlay zona-vip">
              <div className="zona-grid">
                {mesasVip.map(renderMesa)}
              </div>
            </div>
          </div>
        </section>

        {/* ── PANEL DERECHO: GESTIÓN DE RESERVA ── */}
        <aside className="panel-reserva">
          <div className="panel-reserva-header">
            <h2>Gestión de Reserva</h2>
            <p className="panel-subtitle">Complete los datos y seleccione mesas en el plano</p>
          </div>

          <form onSubmit={hacerReservaMultiple} className="reserva-form">

            {/* Mesas seleccionadas */}
            <div className="input-group">
              <label>Mesas Seleccionadas</label>
              <div className={`mesa-seleccionada-box ${seleccionadas.length > 0 ? 'activa' : ''}`}>
                {seleccionadas.length > 0
                  ? <><span className="sel-badge">{seleccionadas.length}</span> {obtenerNumerosSeleccionados()}</>
                  : <span className="sel-hint">Haga clic en una mesa del plano</span>
                }
              </div>
            </div>

            {/* Nombre del cliente */}
            <div className="input-group">
              <label>Nombre del Titular</label>
              <input
                type="text"
                name="nombre_cliente"
                required
                placeholder="Ej: Sr. Andrés Mendoza"
              />
            </div>

            {/* Método de pago */}
            <div className="input-group">
              <label>Método de Pago</label>
              <select name="metodo_pago" required>
                <option value="efectivo">💵 Efectivo</option>
                <option value="tarjeta">💳 Tarjeta</option>
                <option value="transferencia">🏦 Transferencia</option>
              </select>
            </div>

            {/* Precio estimado */}
            {seleccionadas.length > 0 && (
              <div className="precio-estimado">
                <span className="precio-label">Estimado:</span>
                <span className="precio-valor">
                  ${mesas
                      .filter(m => seleccionadas.includes(m.id_mesa))
                      .reduce((sum, m) => sum + parseFloat(m.precio_base || 0), 0)
                      .toFixed(2)} + IVA 15%
                </span>
              </div>
            )}

            <button
              type="submit"
              className="btn-oro"
              disabled={seleccionadas.length === 0 || cargando}
            >
              {cargando ? (
                <><span className="spinner"></span> Procesando...</>
              ) : (
                '✓ Confirmar Reserva'
              )}
            </button>
          </form>

          {/* Mensaje de estado */}
          {mensaje.texto && (
            <div className={`mensaje-feedback ${mensaje.tipo}`}>
              {mensaje.texto}
            </div>
          )}

          {/* Botón ver última factura */}
          {factura && !mostrarFactura && (
            <button className="btn-factura-link" onClick={() => setMostrarFactura(true)}>
              📄 Ver última factura generada
            </button>
          )}
        </aside>
      </div>

      {/* ── MODAL FACTURA ── */}
      {mostrarFactura && factura && (
        <div className="modal-overlay" onClick={() => setMostrarFactura(false)}>
          <div className="modal-factura" onClick={e => e.stopPropagation()}>
            <div className="factura-header">
              <div>
                <h3>🧾 Factura de Reserva</h3>
                <p className="factura-fecha">{new Date().toLocaleDateString('es-EC', { dateStyle: 'long' })}</p>
              </div>
              <button className="btn-cerrar" onClick={() => setMostrarFactura(false)}>✕</button>
            </div>

            <div className="factura-body">
              {factura.map((f, i) => (
                <div key={i} className="factura-item">
                  <div className="factura-row">
                    <span>Mesa</span>
                    <span className="factura-val">{f.detalle_mesa}</span>
                  </div>
                  <div className="factura-row">
                    <span>Cliente</span>
                    <span className="factura-val">{f.nombre_cliente}</span>
                  </div>
                  <div className="factura-row">
                    <span>Subtotal</span>
                    <span className="factura-val">${parseFloat(f.subtotal).toFixed(2)}</span>
                  </div>
                  <div className="factura-row">
                    <span>IVA (15%)</span>
                    <span className="factura-val">${parseFloat(f.impuestos).toFixed(2)}</span>
                  </div>
                  <div className="factura-row factura-total">
                    <span>Total</span>
                    <span className="factura-val">${parseFloat(f.total_pagado).toFixed(2)}</span>
                  </div>
                  {i < factura.length - 1 && <hr className="factura-divider" />}
                </div>
              ))}

              {factura.length > 1 && (
                <div className="factura-row factura-gran-total">
                  <span>GRAN TOTAL ({factura.length} mesas)</span>
                  <span>${calcularTotalFacturas()}</span>
                </div>
              )}
            </div>

            <div className="factura-footer">
              <span className="factura-metodo">💳 {factura[0]?.metodo_pago?.toUpperCase()}</span>
              <button className="btn-imprimir" onClick={() => window.print()}>🖨 Imprimir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;