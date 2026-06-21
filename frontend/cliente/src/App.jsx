import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:3000');
const CLIENT_STORAGE_KEY = 'erestaurante_cliente_id';

function getOrCreateClientId() {
  try {
    const existing = localStorage.getItem(CLIENT_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const generated = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
      ? globalThis.crypto.randomUUID()
      : `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    localStorage.setItem(CLIENT_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function App() {
  const [mesas, setMesas] = useState([]);
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
  const [horaActual, setHoraActual] = useState(new Date());
  const [factura, setFactura] = useState(null);
  const [mostrarFactura, setMostrarFactura] = useState(false);
  const [pagoMetodo, setPagoMetodo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mesaCheckout, setMesaCheckout] = useState(null);
  const [clienteId] = useState(() => getOrCreateClientId());

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
          ? { ...m, estado: 'ocupada', expiracion, id_reserva: data.id_reserva, cliente_id: data.cliente_id || null, nombre_cliente: data.nombre_cliente, seleccionada_global: false }
          : m
      ));
      setSeleccionadas(prev => prev.filter(id => id !== idMesa));
    });

    // Evento: mesa liberada
    socket.on('mesa-liberada', (data) => {
      const idMesa = parseInt(data.id_mesa);
      setMesas(prev => prev.map(m =>
        m.id_mesa === idMesa
          ? { ...m, estado: 'disponible', expiracion: null, cliente_id: null, seleccionada_global: false }
          : m
      ));
      // Deseleccionar si estaba seleccionada
      setSeleccionadas(prev => prev.filter(id => id !== idMesa));
    });

    socket.on('mesa-seleccionada', (data) => {
      const idMesa = parseInt(data.id_mesa);
      const esMiaMesa = data.clientId === clienteId;
      
      setMesas(prev => prev.map(m =>
        m.id_mesa === idMesa
          ? { ...m, seleccionada_global: true, seleccionada_por: data.clientId || null }
          : m
      ));
      
      // Solo si es nuestra mesa, actualizar seleccionadas
      if (esMiaMesa) {
        setSeleccionadas(prev => prev.includes(idMesa) ? prev : [...prev, idMesa]);
      }
    });

    socket.on('mesa-deseleccionada', (data) => {
      const idMesa = parseInt(data.id_mesa);
      const esMiaMesa = data.clientId === clienteId;
      
      setMesas(prev => prev.map(m =>
        m.id_mesa === idMesa
          ? { ...m, seleccionada_global: false, seleccionada_por: null }
          : m
      ));
      
      // Solo limpiar de seleccionadas si es NUESTRA mesa
      if (esMiaMesa) {
        setSeleccionadas(prev => prev.filter(id => id !== idMesa));
      }
    });

    socket.on('mesa-seleccionada-rechazada', (data) => {
      // Actualizar estado para que se vea que otro cliente la tiene
      if (data?.seleccionada_por) {
        setMesas(prev => prev.map(m =>
          m.id_mesa === parseInt(data.id_mesa)
            ? { ...m, seleccionada_global: true, seleccionada_por: data.seleccionada_por }
            : m
        ));
      }
      setMensaje({ texto: '⚠ ' + (data?.motivo || 'Esa mesa ya fue seleccionada por otro cliente.'), tipo: 'error' });
    });

    socket.on('mesa-ocupada-por', (data) => {
      // Actualizar si otro cliente tiene la mesa
      if (data?.clientId) {
        setMesas(prev => prev.map(m =>
          m.id_mesa === parseInt(data.id_mesa)
            ? { ...m, seleccionada_global: true, seleccionada_por: data.clientId }
            : m
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
    };
  }, []);

  // Manejo de Selección Múltiple y Checkout
  const handleMesaClick = (mesa) => {
    // Bloqueo defensivo: si está seleccionada por otro cliente, rechazar de inmediato
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
        // Solo permitir desseleccionar si es nuestro - EMITIR SIN ACTUALIZAR
        socket.emit('mesa-deseleccionada', { id_mesa: mesa.id_mesa, clientId: clienteId });
      } else {
        // Intentar seleccionar - EMITIR SIN ACTUALIZAR
        socket.emit('mesa-seleccionada', { id_mesa: mesa.id_mesa, clientId: clienteId });
      }

      setMensaje({ texto: '', tipo: '' });
    } else if (mesa.estado === 'ocupada') {
      // Agrupar solo mesas del mismo propietario
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

  // Finalizar Reserva - ESPERAR A QUE ADMIN CONFIRME PAGO
  const finalizarReservaYFacturar = async (e) => {
    e.preventDefault();
    if (!mesaCheckout) return;

    setCargando(true);
    try {
      const nombre_cliente = e.target.nombre_cliente.value.trim();
      
      const numeros_mesas = mesaCheckout.mesasGrupo.map(m => m.numero_mesa).join(', ');

      // 1. Finalizar reserva de todas las mesas del grupo
      for (const m of mesaCheckout.mesasGrupo) {
        const finalizarRes = await fetch(`http://localhost:3000/api/reservas/${m.id_reserva}/finalizar`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_mesa: m.id_mesa, cliente_id: clienteId, nombre_cliente })
        });

        const finalizarData = await finalizarRes.json();
        if (!finalizarRes.ok || !finalizarData.success) {
          throw new Error(finalizarData.message || 'No se pudo finalizar la reserva');
        }
      }

      // Mostrar mensaje de confirmación
      setMensaje({ 
        texto: `✓ Reserva Mesa ${numeros_mesas} confirmada. El administrador procesará el pago.`, 
        tipo: 'success' 
      });
      
      setMesaCheckout(null);
      setMostrarFactura(false);

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
            cliente_id: clienteId,
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
      
      // Ocultar mensaje automáticamente
      setTimeout(() => {
        setMensaje({ texto: '', tipo: '' });
      }, 4000);
    } else {
      setMensaje({ texto: `Se procesó con errores en ${errores} mesa(s).`, tipo: 'error' });
    }
  };

  // Pedir cuenta: generar factura para todas las reservas del cliente
  const pedirCuenta = async () => {
    // Buscar todas las mesas ocupadas que pertenezcan a este cliente
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_reservas, cliente_id: clienteId, nombre_cliente: misMesas[0].nombre_cliente || '', metodo_pago: pagoMetodo || null })
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Error al pedir cuenta');

      // Liberar mesas localmente
      setMesas(prev => prev.map(m => (
        id_reservas.includes(m.id_reserva) ? { ...m, estado: 'disponible', cliente_id: null, id_reserva: null, expiracion: null } : m
      )));

      // Mostrar factura (guardamos objeto con items)
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

  // Cuando el usuario selecciona un metodo de pago válido, activar pedido de cuenta automáticamente
  useEffect(() => {
    if (!pagoMetodo) return;
    // Verificar que el cliente tenga mesas ocupadas
    const misMesas = mesas.filter(m => m.estado === 'ocupada' && String(m.cliente_id || '') === String(clienteId));
    if (misMesas.length === 0) return;

    // Disparar pedirCuenta si no está ya cargando
    if (!cargando) {
      // Pequeña demora para permitir interacción del usuario
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

  const calcularTotalFacturas = () => {
    if (!factura) return '0.00';
    if (factura.items && factura.items.length > 0) {
      const sum = factura.items.reduce((s, it) => s + parseFloat(it.total || 0), 0);
      return sum.toFixed(2);
    }
    return parseFloat(factura.total_pagado || 0).toFixed(2);
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

          {/* Botón para pedir la cuenta si el cliente tiene mesas ocupadas */}
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
              {/* Si el backend devolvió items por mesa los mostramos detallados */}
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
                  required
                  defaultValue={mesaCheckout.nombre_cliente || ''}
                  placeholder="Debe coincidir con el titular de la reserva"
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
                  placeholder="Ej: 45.50"
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