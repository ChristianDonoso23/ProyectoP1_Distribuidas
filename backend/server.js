require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');


const http = require('http');
const { Server } = require('socket.io');
const { subscribe } = require('./services/websocketService');
// 1. Importar todas tus rutas
const mesasRoutes = require('./routes/mesas.routes');
const reservasRoutes = require('./routes/reservas.routes');
const facturasRoutes = require('./routes/facturas.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const eventosRoutes = require('./routes/eventos.routes');
const requestLogger = require('./middlewares/loggerMiddleware');
const errorHandler = require('./middlewares/errorMiddleware');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
const seleccionPorMesa = new Map();
const mesasPorSocket = new Map();

// Middlewares básicos
app.use(cors());
app.use(requestLogger);
app.use(express.json());

// Servir archivos estáticos del dashboard
app.use(express.static(path.join(__dirname, '../frontend/dashboard')));

// 2. Vincular las rutas a los Endpoints de la API
app.use('/api/mesas', mesasRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/facturas', facturasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/eventos', eventosRoutes);

io.on('connection', (socket) => {
    mesasPorSocket.set(socket.id, new Set());

    socket.on('mesa-seleccionada', (event) => {
        const idMesa = parseInt(event?.id_mesa);
        const clientId = String(event?.clientId || '').trim();

        if (!idMesa || !clientId) {
            socket.emit('mesa-seleccionada-rechazada', { id_mesa: idMesa || null, motivo: 'Datos incompletos' });
            return;
        }

        const propietarioActual = seleccionPorMesa.get(idMesa);
        if (propietarioActual && propietarioActual !== clientId) {
            // Rechazar de inmediato si ya es de otro cliente
            socket.emit('mesa-seleccionada-rechazada', { id_mesa: idMesa, motivo: 'Mesa seleccionada por otro cliente', seleccionada_por: propietarioActual });
            // Enviar el estado real a este cliente para que vea quién la tiene
            io.to(socket.id).emit('mesa-ocupada-por', { id_mesa: idMesa, clientId: propietarioActual });
            return;
        }

        // Solo permitir si es la primera vez o si es el mismo dueño
        seleccionPorMesa.set(idMesa, clientId);
        mesasPorSocket.get(socket.id).add(idMesa);
        // Notificar a TODOS que esta mesa tiene nuevo dueño
        io.emit('mesa-seleccionada', { id_mesa: idMesa, clientId });
        // Confirmación privada al cliente
        socket.emit('mesa-seleccionada-confirmada', { id_mesa: idMesa, clientId });
    });

    socket.on('mesa-deseleccionada', (event) => {
        const idMesa = parseInt(event?.id_mesa);
        const clientId = String(event?.clientId || '').trim();

        if (!idMesa || !clientId) {
            return;
        }

        const propietarioActual = seleccionPorMesa.get(idMesa);
        // Validar que SOLO el propietario pueda desseleccionar
        if (propietarioActual !== clientId) {
            socket.emit('mesa-deseleccionada-rechazada', { id_mesa: idMesa, motivo: 'Solo el cliente propietario puede liberar la selección' });
            return;
        }

        seleccionPorMesa.delete(idMesa);
        mesasPorSocket.get(socket.id)?.delete(idMesa);
        // Notificar a todos que la mesa fue liberada
        io.emit('mesa-deseleccionada', { id_mesa: idMesa, clientId });
        // Confirmación privada
        socket.emit('mesa-deseleccionada-confirmada', { id_mesa: idMesa, clientId });
    });

    socket.on('disconnect', () => {
        const mesasSeleccionadas = mesasPorSocket.get(socket.id);

        if (mesasSeleccionadas) {
            for (const idMesa of mesasSeleccionadas) {
                const propietarioActual = seleccionPorMesa.get(idMesa);
                if (propietarioActual) {
                    seleccionPorMesa.delete(idMesa);
                    io.emit('mesa-deseleccionada', { id_mesa: idMesa, clientId: propietarioActual, motivo: 'desconexion' });
                }
            }
        }

        mesasPorSocket.delete(socket.id);
    });
});

subscribe('mesa-ocupada', (event) => {
    const payload = event.payload || event;
    if (payload?.id_mesa) {
        seleccionPorMesa.delete(parseInt(payload.id_mesa));
    }
    io.emit('mesa-ocupada', payload); 
});

subscribe('mesa-liberada', (event) => {
    const payload = event.payload || event;
    if (payload?.id_mesa) {
        seleccionPorMesa.delete(parseInt(payload.id_mesa));
    }
    io.emit('mesa-liberada', payload);
});

// Ruta base de prueba (solo para saber que el server levantó)
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: "API del Sistema de Restaurante corriendo correctamente",
        endpoints: [
            "/api/mesas",
            "/api/reservas",
            "/api/facturas",
            "/api/dashboard",
            "/api/eventos"
        ]
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Servidor Backend corriendo en el puerto ${PORT}`);
});