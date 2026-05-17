import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:3000');

function App() {
  const [mesas, setMesas] = useState([]);
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
  const [horaActual, setHoraActual] = useState(new Date());

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

    socket.on('mesa-ocupada', (data) => {
      setMesas(prev => prev.map(m =>
        m.id_mesa === parseInt(data.id_mesa) ? { ...m, estado: 'ocupada', expiracion: data.expiracion } : m
      ));
    });

    socket.on('mesa-liberada', (data) => {
      setMesas(prev => prev.map(m =>
        m.id_mesa === parseInt(data.id_mesa) ? { ...m, estado: 'disponible', expiracion: null } : m
      ));
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
      setMensaje({ texto: 'La mesa seleccionada no está disponible.', tipo: 'error' });
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

  // Procesamiento de Reserva Múltiple
  const hacerReservaMultiple = async (e) => {
    e.preventDefault();
    if (seleccionadas.length === 0) {
      setMensaje({ texto: 'Seleccione al menos una mesa del mapa.', tipo: 'error' });
      return;
    }

    const nombre = e.target.nombre_cliente.value;
    const fechaExp = new Date();
    fechaExp.setHours(fechaExp.getHours() + 1);

    const year = fechaExp.getFullYear();
    const month = String(fechaExp.getMonth() + 1).padStart(2, '0');
    const day = String(fechaExp.getDate()).padStart(2, '0');
    const hours = String(fechaExp.getHours()).padStart(2, '0');
    const minutes = String(fechaExp.getMinutes()).padStart(2, '0');
    const seconds = String(fechaExp.getSeconds()).padStart(2, '0');
    const expiracionFormat = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    let errores = 0;

    for (const idMesa of seleccionadas) {
      try {
        const res = await fetch('http://localhost:3000/api/reservas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_mesa: idMesa,
            nombre_cliente: nombre,
            expiracion: expiracionFormat
          })
        });

        if (res.ok) {
          setMesas(prev => prev.map(m =>
            m.id_mesa === idMesa ? { ...m, estado: 'ocupada', expiracion: expiracionFormat } : m
          ));
        } else {
          errores++;
        }
      } catch (err) {
        errores++;
      }
    }

    if (errores === 0) {
      setMensaje({ texto: `Reserva confirmada para ${seleccionadas.length} mesa(s).`, tipo: 'success' });
      setSeleccionadas([]);
      e.target.reset();
    } else {
      setMensaje({ texto: `Se procesó con errores en ${errores} mesa(s).`, tipo: 'error' });
    }
  };

  const obtenerNumerosSeleccionados = () => {
    if (seleccionadas.length === 0) return 'Ninguna (Haga clic en el mapa)';
    const numeros = mesas.filter(m => seleccionadas.includes(m.id_mesa)).map(m => m.numero_mesa);
    return `Mesas: ${numeros.join(', ')}`;
  };

  // Separar mesas por zona usando el campo 'zona' de la BD
  // El plano visual: General (izquierda) · Terraza (centro) · VIP (derecha)
  const mesasGeneral  = mesas.filter(m => m.zona === 'GENERAL');
  const mesasTerraza  = mesas.filter(m => m.zona === 'TERRAZA');
  const mesasVip      = mesas.filter(m => m.zona === 'VIP');

  const renderMesa = (mesa) => (
    <div
      key={mesa.id_mesa}
      className={`mesa ${mesa.estado} ${seleccionadas.includes(mesa.id_mesa) ? 'seleccionada' : ''}`}
      onClick={() => handleMesaClick(mesa)}
      title={mesa.estado === 'ocupada' ? 'Ocupada' : mesa.estado === 'disponible' ? 'Disponible' : ''}
    >
      <span className="numero-mesa">{mesa.numero_mesa}</span>
      {mesa.estado === 'ocupada' && mesa.expiracion && (
        <span className="timer">{calcularTiempoRestante(mesa.expiracion)}</span>
      )}
    </div>
  );

  return (
    <div className="App">
      <h1 className="header-title">
        E-Restaurante Suite <span>● Sistema Activo</span>
      </h1>

      <div className="dashboard">
        {/* Panel Izquierdo: Configuración de Reserva */}
        <aside className="panel-reserva">
          <h2>Gestión de Reserva</h2>
          <form onSubmit={hacerReservaMultiple}>
            <div className="input-group">
              <label>Selección Actual</label>
              <div className="mesa-seleccionada-box">
                {obtenerNumerosSeleccionados()}
              </div>
            </div>

            <div className="input-group">
              <label>Nombre del Titular</label>
              <input type="text" name="nombre_cliente" required placeholder="Ej: Sr. Andrés Mendoza" />
            </div>

            <button type="submit" className="btn-oro" disabled={seleccionadas.length === 0}>
              Confirmar Reserva
            </button>
          </form>

          {mensaje.texto && (
            <p style={{
              marginTop: '20px',
              color: mensaje.tipo === 'success' ? 'var(--success)' : 'var(--danger)',
              fontWeight: '600',
              textAlign: 'center'
            }}>
              {mensaje.texto}
            </p>
          )}

          {/* Leyenda */}
          <div className="leyenda">
            <h3>Estado</h3>
            <div className="leyenda-items-row">
              <div className="leyenda-item"><span className="leyenda-dot disponible-dot"></span>Disponible</div>
              <div className="leyenda-item"><span className="leyenda-dot ocupada-dot"></span>Reservada</div>
            </div>
          </div>
        </aside>

        {/* Panel Derecho: Mapa con plano real */}
        <section className="mapa-mesas">
        

          <div className="plano-container">
            {/* Imagen de fondo del plano */}
            <img
              src="/plano_restaurante.jpg"
              alt="Plano del restaurante"
              className="plano-img"
            />

            {/* Zona GENERAL — izquierda del plano */}
            <div className="zona-overlay zona-general">
             
              <div className="zona-grid">
                {mesasGeneral.map(renderMesa)}
              </div>
            </div>

            {/* Zona TERRAZA — centro del plano */}
            <div className="zona-overlay zona-terraza">
              <div className="zona-grid">
                {mesasTerraza.map(renderMesa)}
              </div>
            </div>

            {/* Zona VIP — derecha del plano */}
            <div className="zona-overlay zona-vip">
              <div className="zona-grid">
                {mesasVip.map(renderMesa)}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;