import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Auth from './components/Auth';
import './App.css';

// 1. Inicializar Socket apagado (se conecta manual tras el login)
const socket = io('http://localhost:3000', { autoConnect: false });

function App() {
  // 2. Estados de Autenticación
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [usuario, setUsuario] = useState(() => {
    const saved = localStorage.getItem('usuario');
    return saved ? JSON.parse(saved) : null;
  });

  // El cliente ID ahora es el ID real de MongoDB, asegurando trazabilidad
  const clienteId = usuario?.id; 

  // Estados originales del sistema
  const [mesas, setMesas] = useState([]);
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
  const [horaActual, setHoraActual] = useState(new Date());
  const [factura, setFactura] = useState(null);
  const [mostrarFactura, setMostrarFactura] = useState(false);
  const [pagoMetodo, setPagoMetodo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mesaCheckout, setMesaCheckout] = useState(null);

  // Funciones de Sesión
  const handleLoginSuccess = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('usuario', JSON.stringify(userData));
    window.location.reload();
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    socket.disconnect();
    window.location.reload();
  };

  // Reloj interno
  useEffect(() => {
    const timer = setInterval(() => setHoraActual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Carga inicial y WebSockets (Protegidos)
  useEffect(() => {
    if (!token || !clienteId) return;

    // Conectar socket y enviar token (opcional para el backend)
    socket.auth = { token };
    socket.connect();

    const cargarMesas = async () => {
      try {
        const respuesta = await fetch('http://localhost:3000/api/mesas', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await respuesta.json();
        if (data.success) {
          setMesas(data.data);
        }
      } catch (error) {
        console.error("Error de conexión:", error);
      }
    };

    cargarMesas();

    // Eventos Sockets
    socket.on('mesa-ocupada', (data) => {
      const idMesa = parseInt(data.id_mesa);
      const expiracion = data.expiracion || null;
      setMesas(prev => prev.map(m =>
        m.id_mesa === idMesa
          ? { ...m, estado: 'ocupada', expiracion, id_reserva: data.id_reserva, cliente_id: data.cliente_id || null, nombre_cliente: data.nombre_cliente, seleccionada_global: false }
          : m
      ));
      setSeleccionadas(prev => prev.filter(id => id !== idMesa));
    });

    socket.on('mesa-liberada', (data) => {
      const idMesa = parseInt(data.id_mesa);
      setMesas(prev => prev.map(m =>
        m.id_mesa === idMesa
          ? { ...m, estado: 'disponible', expiracion: null, cliente_id: null, seleccionada_global: false }
          : m
      ));
      setSeleccionadas(prev => prev.filter(id => id !== idMesa));
    });

    socket.on('mesa-seleccionada', (data) => {
      const idMesa = parseInt(data.id_mesa);
      const esMiaMesa = data.clientId === clienteId;
      setMesas(prev => prev.map(m =>
        m.id_mesa === idMesa ? { ...m, seleccionada_global: true, seleccionada_por: data.clientId || null } : m
      ));
      if (esMiaMesa) {
        setSeleccionadas(prev => prev.includes(idMesa) ? prev : [...prev, idMesa]);
      }
    });

    socket.on('mesa-deseleccionada', (data) => {
      const idMesa = parseInt(data.id_mesa);
      const esMiaMesa = data.clientId === clienteId;
      setMesas(prev => prev.map(m =>
        m.id_mesa === idMesa ? { ...m, seleccionada_global: false, seleccionada_por: null } : m
      ));
      if (esMiaMesa) {
        setSeleccionadas(prev => prev.filter(id => id !== idMesa));
      }
    });

    socket.on('mesa-seleccionada-rechazada', (data) => {
      if (data?.seleccionada_por) {
        setMesas(prev => prev.map(m =>
          m.id_mesa === parseInt(data.id_mesa)
            ? { ...m, seleccionada_global: true, seleccionada_por: data.seleccionada_por } : m
        ));
      }
      setMensaje({ texto: '⚠ ' + (data?.motivo || 'Esa mesa ya fue seleccionada por otro cliente.'), tipo: 'error' });
    });

    socket.on('mesa-ocupada-por', (data) => {
      if (data?.clientId) {
        setMesas(prev => prev.map(m =>
          m.id_mesa === parseInt(data.id_mesa)
            ? { ...m, seleccionada_global: true, seleccionada_por: data.clientId } : m
        ));
      }
    });

    socket.on('mesa-deseleccionada-rechazada', () => {
      setMensaje({ texto: '⚠ Solo el cliente propietario puede liberar esa mesa.', tipo: 'error' });
    });

    socket.on('mesa-seleccionada-confirmada', (data) => {
      if (data?.clientId === clienteId) {
        setMensaje({ texto: '✓ Mesa ' + data.id_mesa + ' seleccionada.', tipo: 'success' });
      }
    });

    socket.on('mesa-deseleccionada-confirmada', (data) => {
      if (data?.clientId === clienteId) {
        setMensaje({ texto: '✓ Mesa ' + data.id_mesa + ' deseleccionada.', tipo: 'success' });
      }
    });

    return () => {
      socket.off('mesa-ocupada');
      socket.off('mesa-liberada');
      socket.off('mesa-seleccionada');
      socket.off('mesa-deseleccionada');
      socket.disconnect(); // Previene fugas de memoria y reconexiones fantasmas
    };
  }, [token, clienteId]); // Dependencias: se reconecta si cambia el token

  // Control de Acceso: Renderizado Condicional
  if (!token) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  // Manejo de Selección Múltiple y Checkout
  const handleMesaClick = (mesa) => {
    const esDeOtroCliente = mesa.seleccionada_global && mesa.seleccionada_por && String(mesa.seleccionada_por) !== String(clienteId);
    const esOcupadaPorOtro = mesa.estado === 'ocupada' && mesa.cliente_id && String(mesa.cliente_id) !== String(clienteId);

    if (esDeOtroCliente) {
      setMensaje({ texto: '⚠ Esa mesa ya está seleccionada por otro cliente. No puedes tomarla.', tipo: 'error' });
      return;
    }

    if (esOcupadaPorOtro) {
      setMensaje({ texto: '⚠ Esa mesa pertenece a otro cliente. No puedes cobrarla.', tipo: 'error' });
      return;
    }

    if (mesa.estado === 'disponible') {
      const estaSeleccionada = seleccionadas.includes(mesa.id_mesa);
      if (estaSeleccionada) {
        socket.emit('mesa-deseleccionada', { id_mesa: mesa.id_mesa, clientId: clienteId });
      } else {
        socket.emit('mesa-seleccionada', { id_mesa: mesa.id_mesa, clientId: clienteId });
      }
      setMensaje({ texto: '', tipo: '' });
    } else if (mesa.estado === 'ocupada') {
      const mesasDelCliente = mesas.filter(m => m.estado === 'ocupada' && String(m.cliente_id || '') === String(mesa.cliente_id || ''));
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

  // Finalizar Reserva 
  const finalizarReservaYFacturar = async (e) => {
    e.preventDefault();
    if (!mesaCheckout) return;

    setCargando(true);
    try {
      const nombre_cliente = e.target.nombre_cliente.value.trim();
      const numeros_mesas = mesaCheckout.mesasGrupo.map(m => m.numero_mesa).join(', ');

      for (const m of mesaCheckout.mesasGrupo) {
        const finalizarRes = await fetch(`http://localhost:3000/api/reservas/${m.id_reserva}/finalizar`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // JWT inyectado
          },
          body: JSON.stringify({ id_mesa: m.id_mesa, cliente_id: clienteId, nombre_cliente })
        });

        const finalizarData = await finalizarRes.json();
        if (!finalizarRes.ok || !finalizarData.success) {
          throw new Error(finalizarData.message || 'No se pudo finalizar la reserva');
        }
      }

      setMensaje({ texto: `✓ Reserva Mesa ${numeros_mesas} confirmada. El administrador procesará el pago.`, tipo: 'success' });
      setMesaCheckout(null);
      setMostrarFactura(false);
      setTimeout(() => setMensaje({texto: '', tipo: ''}), 4000);

    } catch (error) {
      setMensaje({ texto: error.message || 'Error al finalizar las mesas.', tipo: 'error' });
    }
    setCargando(false);
  };

  // Procesamiento de Reserva Múltiple
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
        const res = await fetch('http://localhost:3000/api/reservas', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // JWT inyectado
          },
          body: JSON.stringify({
            id_mesa: idMesa,
            cliente_id: clienteId,
            nombre_cliente: nombre,
            expiracion: expiracionFormat
          })
        });

        const reservaData = await res.json();

        if (res.ok && reservaData.success) {
          setMesas(prev => prev.map(m =>
            m.id_mesa === idMesa ? { 
              ...m, 
              estado: 'ocupada', 
              expiracion: expiracionFormat,
              id_reserva: reservaData.id_reserva,
              cliente_id: clienteId,
              nombre_cliente: nombre,
              seleccionada_global: false,
              seleccionada_por: null
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
      setTimeout(() => setMensaje({ texto: '', tipo: '' }), 4000);
    } else {
      setMensaje({ texto: `Se procesó con errores en ${errores} mesa(s).`, tipo: 'error' });
    }
  };

  // Pedir cuenta
  const pedirCuenta = async () => {
    const misMesas = mesas.filter(m => m.estado === 'ocupada' && String(m.cliente_id || '') === String(clienteId));
    if (misMesas.length === 0) {
      setMensaje({ texto: 'No tienes mesas ocupadas para pedir cuenta.', tipo: 'error' });
      return;
    }

    const id_reservas = misMesas.map(m => m.id_reserva).filter(Boolean);
    if (id_reservas.length === 0) {
      setMensaje({ texto: 'No se encontraron reservas válidas para tus mesas.', tipo: 'error' });
      return;
    }

    setCargando(true);
    try {
      const res = await fetch('http://localhost:3000/api/facturas/pedir-cuenta', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // JWT inyectado
        },
        body: JSON.stringify({ id_reservas, cliente_id: clienteId, nombre_cliente: misMesas[0].nombre_cliente || '', metodo_pago: pagoMetodo || null })
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Error al pedir cuenta');

      setMesas(prev => prev.map(m => (
        id_reservas.includes(m.id_reserva) ? { ...m, estado: 'disponible', cliente_id: null, id_reserva: null, expiracion: null } : m
      )));

      setFactura({ ...data.data, items: data.items || [] });
      setMostrarFactura(true);
      setMensaje({ texto: 'Factura generada. Puedes ver e imprimirla.', tipo: 'success' });
      setTimeout(() => setMensaje({ texto: '', tipo: '' }), 4000);
    } catch (error) {
      console.error('Error pedir cuenta', error);
      setMensaje({ texto: error.message || 'Error al pedir cuenta', tipo: 'error' });
    }
    setCargando(false);
  };

  useEffect(() => {
    if (!pagoMetodo) return;
    const misMesas = mesas.filter(m => m.estado === 'ocupada' && String(m.cliente_id || '') === String(clienteId));
    if (misMesas.length === 0) return;

    if (!cargando) {
      const t = setTimeout(() => {
        pedirCuenta();
      }, 250);
      return () => clearTimeout(t);
    }
  }, [pagoMetodo]);

  const obtenerNumerosSeleccionados = () => {
    if (seleccionadas.length === 0) return 'Haga clic en una mesa del plano';
    const numeros = mesas.filter(m => seleccionadas.includes(m.id_mesa)).map(m => m.numero_mesa);
    return numeros.join(', ');
  };

  const mesasGeneral  = mesas.filter(m => m.zona === 'GENERAL');
  const mesasTerraza  = mesas.filter(m => m.zona === 'TERRAZA');
  const mesasVip      = mesas.filter(m => m.zona === 'VIP');

  const renderMesa = (mesa) => (
    <div
      key={mesa.id_mesa}
      className={`mesa ${mesa.estado} ${(seleccionadas.includes(mesa.id_mesa) || mesa.seleccionada_global) ? 'seleccionada' : ''}`}
      onClick={() => handleMesaClick(mesa)}
      title={`Mesa ${mesa.numero_mesa} — ${mesa.estado === 'ocupada' ? 'Ocupada' : 'Disponible'}`}
      aria-disabled={mesa.estado === 'ocupada' && mesa.cliente_id && String(mesa.cliente_id) !== String(clienteId)}
    >
      <span className="numero-mesa">{mesa.numero_mesa}</span>
      {mesa.estado === 'ocupada' && mesa.expiracion && (
        <span className="timer">{calcularTiempoRestante(mesa.expiracion)}</span>
      )}
    </div>
  );

  return (
    <div className="App">
      {/* ── HEADER Modificado con Info del Usuario ── */}
      <header className="header">
        <div className="header-inner">
          <div className="header-brand">
            <span className="header-icon">🍽</span>
            <h1 className="header-title">E-Restaurante Suite</h1>
          </div>
          <div className="header-status" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span className="status-dot"></span>
            <span className="status-text">{usuario?.correo}</span>
            <button 
                onClick={handleLogout} 
                style={{ background: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
            >
                Cerrar Sesión
            </button>
            <span className="header-clock">
              {horaActual.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </header>

      {/* ── DASHBOARD ── */}
      <div className="dashboard">

        {/* ── PANEL IZQUIERDO: PLANO ── */}
        <section className="panel-plano">
          <div className="plano-container">
            <div className="plano-estado-bar">
              <div className="zona-tag general-tag">
                <div className="estado-label-group">
                  <span className="estado-label-dot disponible-dot"></span>
                  <span className="estado-label-text">Disponible</span>
                </div>
              </div>
              <div className="zona-tag terraza-tag">  
                <div className="estado-label-group">
                  <span className="estado-label-dot ocupada-dot"></span>
                  <span className="estado-label-text">Reservado</span>
                </div>
              </div>
              <div className="zona-tag vip-tag">  
                <div className="estado-label-group">
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

            <div className="zona-overlay zona-general">
              <div className="zona-grid">{mesasGeneral.map(renderMesa)}</div>
            </div>
            <div className="zona-overlay zona-terraza">
              <div className="zona-grid">{mesasTerraza.map(renderMesa)}</div>
            </div>
            <div className="zona-overlay zona-vip">
              <div className="zona-grid">{mesasVip.map(renderMesa)}</div>
            </div>
          </div>
        </section>

        {/* ── PANEL DERECHO: GESTIÓN DE RESERVA ── */}
        <aside className="panel-reserva">
          <div className="panel-reserva-header">
            <h2 className="titulo-reserva">Gestión de Reserva</h2>
          </div>

          <form onSubmit={hacerReservaMultiple} className="reserva-form">
            <div className="input-group">
              <label>Mesas Seleccionadas</label>
              <div className={`mesa-seleccionada-box ${seleccionadas.length > 0 ? 'activa' : ''}`}>
                {seleccionadas.length > 0
                  ? <><span className="sel-badge">{seleccionadas.length}</span> {obtenerNumerosSeleccionados()}</>
                  : <span className="sel-hint">Haga clic en una mesa del plano</span>
                }
              </div>
            </div>

            {/* Nombre del cliente bloqueado y autocompletado con JWT */}
            <div className="input-group">
              <label>Nombre del Titular</label>
              <input
                type="text"
                name="nombre_cliente"
                value={usuario?.correo || ''}
                readOnly
                style={{ backgroundColor: '#e9ecef', cursor: 'not-allowed', color: '#495057' }}
                title="Este campo se auto-completa con tu sesión actual."
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

          {mesas.some(m => m.estado === 'ocupada' && String(m.cliente_id || '') === String(clienteId)) && (
            <div style={{marginTop: '12px'}}>
              <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                <select className="metodo-select" value={pagoMetodo} onChange={e => setPagoMetodo(e.target.value)}>
                  <option value="">Método de pago (opcional)</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                </select>
                <button className="btn-oro" onClick={pedirCuenta} disabled={cargando}>
                  {cargando ? (<><span className="spinner"></span> Solicitando...</>) : ('🧾 Pedir cuenta')}
                </button>
              </div>
            </div>
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
              {factura.items && factura.items.length > 0 ? (
                <div>
                  <div className="factura-items-list">
                    {factura.items.map((it, idx) => (
                      <div key={idx} className="factura-item">
                        <div className="factura-row">
                          <span>Mesa</span>
                          <span className="factura-val">{it.numero_mesa} — Zona {it.zona}</span>
                        </div>
                        <div className="factura-row">
                          <span>Subtotal</span>
                          <span className="factura-val">${parseFloat(it.precio_base).toFixed(2)}</span>
                        </div>
                        <div className="factura-row">
                          <span>IVA (15%)</span>
                          <span className="factura-val">${parseFloat(it.impuestos).toFixed(2)}</span>
                        </div>
                        <div className="factura-row factura-total">
                          <span>Total</span>
                          <span className="factura-val">${parseFloat(it.total).toFixed(2)}</span>
                        </div>
                        {idx < factura.items.length - 1 && <hr className="factura-divider" />}
                      </div>
                    ))}
                  </div>
                  <hr />
                  <div className="factura-row factura-gran-total">
                    <span>Subtotal</span>
                    <span>${parseFloat(factura.subtotal).toFixed(2)}</span>
                  </div>
                  <div className="factura-row factura-gran-total">
                    <span>IVA Total</span>
                    <span>${parseFloat(factura.impuestos).toFixed(2)}</span>
                  </div>
                  <div className="factura-row factura-gran-total">
                    <span>Total a Pagar</span>
                    <span>${parseFloat(factura.total_pagado).toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="factura-row">
                    <span>Mesa</span>
                    <span className="factura-val">{factura.detalle_mesa}</span>
                  </div>
                  <div className="factura-row">
                    <span>Cliente</span>
                    <span className="factura-val">{factura.nombre_cliente}</span>
                  </div>
                  <div className="factura-row">
                    <span>Subtotal</span>
                    <span className="factura-val">${parseFloat(factura.subtotal).toFixed(2)}</span>
                  </div>
                  <div className="factura-row">
                    <span>IVA (15%)</span>
                    <span className="factura-val">${parseFloat(factura.impuestos).toFixed(2)}</span>
                  </div>
                  <div className="factura-row factura-total">
                    <span>Total</span>
                    <span className="factura-val">${parseFloat(factura.total_pagado).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="factura-footer">
              <span className="factura-metodo">💳 { (factura.metodo_pago || pagoMetodo || 'No especificado').toString().toUpperCase() }</span>
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
                <label>Confirmar nombre del titular</label>
                <input
                  type="text"
                  name="nombre_cliente"
                  value={usuario?.correo || ''}
                  readOnly
                  style={{ backgroundColor: '#e9ecef', cursor: 'not-allowed', color: '#495057' }}
                />
              </div>

              <div className="input-group">
                <label>Total Consumido (Subtotal Sin IVA)</label>
                <input
                  type="number"
                  name="subtotal"
                  required
                  min="0"
                  step="0.01"
                  defaultValue={mesaCheckout.precio_base}
                  readOnly
                  disabled
                />
              </div>

              <div className="input-group" style={{backgroundColor: '#fff3cd', padding: '12px', borderRadius: '6px', borderLeft: '4px solid #ffc107'}}>
                <p style={{margin: '0', color: '#856404', fontSize: '14px'}}>
                  ⏳ <strong>Pendiente de confirmación del administrador</strong><br/>
                  El administrador procesará el pago en la caja del restaurante.
                </p>
              </div>

              <button
                type="submit"
                className="btn-oro"
                disabled={cargando}
                style={{marginTop: '15px'}}
              >
                {cargando ? (
                  <><span className="spinner"></span> Confirmando...</>
                ) : (
                  '✓ Confirmar Reserva'
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