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
  const [mesaCheckout, setMesaCheckout] = useState(null);

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
          ? { ...m, estado: 'ocupada', expiracion, id_reserva: data.id_reserva, nombre_cliente: data.nombre_cliente }
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

  // Manejo de Selección Múltiple y Checkout
  const handleMesaClick = (mesa) => {
    if (mesa.estado === 'disponible') {
      setSeleccionadas(prev =>
        prev.includes(mesa.id_mesa)
          ? prev.filter(id => id !== mesa.id_mesa)
          : [...prev, mesa.id_mesa]
      );
      setMensaje({ texto: '', tipo: '' });
    } else if (mesa.estado === 'ocupada') {
      // Find all tables reserved by this client
      const mesasDelCliente = mesas.filter(m => m.estado === 'ocupada' && m.nombre_cliente === mesa.nombre_cliente);
      setMesaCheckout({
        ...mesa,
        mesasGrupo: mesasDelCliente.length > 0 ? mesasDelCliente : [mesa]
      });
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

  // Finalizar Reserva y Generar Factura
  const finalizarReservaYFacturar = async (e) => {
    e.preventDefault();
    if (!mesaCheckout) return;

    setCargando(true);
    try {
      const subtotal = e.target.subtotal.value;
      const metodo_pago = e.target.metodo_pago.value;
      
      const numeros_mesas = mesaCheckout.mesasGrupo.map(m => m.numero_mesa).join(', ');

      // 1. Facturar (Se genera una sola factura representativa)
      const facturaRes = await fetch('http://localhost:3000/api/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_reserva: mesaCheckout.id_reserva,
          id_mesa: mesaCheckout.id_mesa,
          nombre_cliente: mesaCheckout.nombre_cliente,
          metodo_pago,
          subtotal
        })
      });
      const facturaData = await facturaRes.json();

      // 2. Finalizar reserva de todas las mesas del grupo
      for (const m of mesaCheckout.mesasGrupo) {
        await fetch(`http://localhost:3000/api/reservas/${m.id_reserva}/finalizar`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_mesa: m.id_mesa })
        });
      }

      // Show success
      setMensaje({ texto: `Reserva Mesa ${numeros_mesas} finalizada`, tipo: 'success' });
      
      setMesaCheckout(null);
      
      // Show invoice
      if (facturaData.success) {
        facturaData.data.detalle_mesa = `Mesas: ${numeros_mesas}`;
        setFactura([facturaData.data]);
        setMostrarFactura(true);
      }

      setTimeout(() => setMensaje({texto: '', tipo: ''}), 4000);

    } catch (error) {
      setMensaje({ texto: 'Error al finalizar las mesas.', tipo: 'error' });
    }
    setCargando(false);
  };

  // Procesamiento de Reserva Múltiple + Generación de Factura
  const hacerReservaMultiple = async (e) => {
    e.preventDefault();
    if (seleccionadas.length === 0) {
      setMensaje({ texto: 'Seleccione al menos una mesa del mapa.', tipo: 'error' });
      return;
    }

    const nombre = e.target.nombre_cliente.value.trim();

    const fechaExp = new Date();
    fechaExp.setHours(fechaExp.getHours() + 1);
    const expiracionFormat = fechaExp.toISOString().slice(0, 19).replace('T', ' ');

    setCargando(true);
    let errores = 0;

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
          // Actualizar estado local inmediatamente con todos los datos
          setMesas(prev => prev.map(m =>
            m.id_mesa === idMesa ? { 
              ...m, 
              estado: 'ocupada', 
              expiracion: expiracionFormat,
              id_reserva: reservaData.id_reserva,
              nombre_cliente: nombre
            } : m
          ));


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
      setSeleccionadas([]);
      e.target.reset();
      
      // Ocultar mensaje automáticamente
      setTimeout(() => {
        setMensaje({ texto: '', tipo: '' });
      }, 4000);
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

    

      {/* ── DASHBOARD: Plano Izquierda | Form Derecha ── */}
      <div className="dashboard">

        {/* ── PANEL IZQUIERDO: PLANO ── */}
        <section className="panel-plano">

          <div className="plano-container">
            {/* Leyenda de estado DENTRO del plano-container */}
            <div className="plano-estado-bar">
              <div className="zona-tag general-tag"><div className="estado-label-group">
                <span className="estado-label-dot disponible-dot"></span>
                <span className="estado-label-text">Disponible</span>
              </div>
              
              </div>
              <div className="zona-tag terraza-tag">  <div className="estado-label-group">
                <span className="estado-label-dot ocupada-dot"></span>
                <span className="estado-label-text">Reservado</span>
              </div>
              </div>
              <div className="zona-tag vip-tag">  <div className="estado-label-group">
                <span className="estado-label-dot seleccionada-dot"></span>
                <span className="estado-label-text">Seleccionado</span>
              </div>
              </div>
            </div>

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
          <h2 className="titulo-reserva">Gestión de Reserva</h2>
            
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
                placeholder="Ej: Andrés Mendoza"
              />
            </div>



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

      {/* ── MODAL CHECKOUT FINALIZAR MESA ── */}
      {mesaCheckout && (
        <div className="modal-overlay" onClick={() => setMesaCheckout(null)}>
          <div className="modal-factura" onClick={e => e.stopPropagation()}>
            <div className="factura-header">
              <div>
                <h3>💳 Factura {mesaCheckout.mesasGrupo?.length > 1 ? 'Mesas' : 'Mesa'} {mesaCheckout.mesasGrupo?.map(m=>m.numero_mesa).join(', ')}</h3>
                <p className="factura-fecha">Cliente: {mesaCheckout.nombre_cliente}</p>
              </div>
              <button className="btn-cerrar" onClick={() => setMesaCheckout(null)}>✕</button>
            </div>

            <form onSubmit={finalizarReservaYFacturar} className="reserva-form" style={{paddingBottom: '24px'}}>
              <div className="input-group">
                <label>Total Consumido (Subtotal Sin IVA)</label>
                <input
                  type="number"
                  name="subtotal"
                  required
                  min="0"
                  step="0.01"
                  placeholder="Ej: 45.50"
                  defaultValue={mesaCheckout.precio_base}
                />
              </div>

              <div className="input-group">
                <label>Método de Pago</label>
                <select name="metodo_pago" required>
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="tarjeta">💳 Tarjeta</option>
                  <option value="transferencia">🏦 Transferencia</option>
                </select>
              </div>

              <button
                type="submit"
                className="btn-oro"
                disabled={cargando}
                style={{marginTop: '15px'}}
              >
                {cargando ? (
                  <><span className="spinner"></span> Procesando...</>
                ) : (
                  '✓ Finalizar y Generar Factura'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* ── TOAST NOTIFICACIÓN ── */}
      {mensaje.texto && (
        <div className={`toast-notificacion ${mensaje.tipo}`}>
          {mensaje.texto}
        </div>
      )}
    </div>
  );
}

export default App;