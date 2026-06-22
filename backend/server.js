const express = require('express');
const cors = require('cors');
const path = require('path');

// 1. Configurar dotenv UNA SOLA VEZ, al inicio. 
// Asumiendo que tu archivo .env está dentro de la carpeta 'backend'
require('dotenv').config(); 

const http = require('http');
const { Server } = require('socket.io');
const { subscribe } = require('./services/websocketService');

// Importaciones de base de datos y utilidades
const connectMongo = require('./config/mongo');
const requestLogger = require('./middlewares/loggerMiddleware');
const errorHandler = require('./middlewares/errorMiddleware');

// Importaciones de Rutas REST
const mesasRoutes = require('./routes/mesas.routes');
const reservasRoutes = require('./routes/reservas.routes');
const facturasRoutes = require('./routes/facturas.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const eventosRoutes = require('./routes/eventos.routes');
const authRoutes = require('./routes/auth.routes'); // Módulo Auth Parcial 2

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

// 2. Middlewares básicos
app.use(cors());
app.use(requestLogger);
app.use(express.json());

// 3. Inicializar Conexión a MongoDB (Parcial 2)
connectMongo();

// Servir archivos estáticos del dashboard
app.use(express.static(path.join(__dirname, '../frontend/dashboard')));

// 4. Vincular las rutas a los Endpoints de la API
app.use('/api/mesas', mesasRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/facturas', facturasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/eventos', eventosRoutes);
app.use('/api/auth', authRoutes); // Ruta de Autenticación Parcial 2

// 5. Configuración de WebSockets (Parcial 1)
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
            socket.emit('mesa-seleccionada-rechazada', { id_mesa: idMesa, motivo: 'Mesa seleccionada por otro cliente', seleccionada_por: propietarioActual });
            io.to(socket.id).emit('mesa-ocupada-por', { id_mesa: idMesa, clientId: propietarioActual });
            return;
        }

        seleccionPorMesa.set(idMesa, clientId);
        mesasPorSocket.get(socket.id).add(idMesa);
        io.emit('mesa-seleccionada', { id_mesa: idMesa, clientId });
        socket.emit('mesa-seleccionada-confirmada', { id_mesa: idMesa, clientId });
    });

    socket.on('mesa-deseleccionada', (event) => {
        const idMesa = parseInt(event?.id_mesa);
        const clientId = String(event?.clientId || '').trim();

        if (!idMesa || !clientId) {
            return;
        }

        const propietarioActual = seleccionPorMesa.get(idMesa);
        if (propietarioActual !== clientId) {
            socket.emit('mesa-deseleccionada-rechazada', { id_mesa: idMesa, motivo: 'Solo el cliente propietario puede liberar la selección' });
            return;
        }

        seleccionPorMesa.delete(idMesa);
        mesasPorSocket.get(socket.id)?.delete(idMesa);
        io.emit('mesa-deseleccionada', { id_mesa: idMesa, clientId });
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

// 6. Suscripciones a Eventos de Servicios (Parcial 1)
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

// Ruta base de prueba
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: "API del Sistema de Restaurante corriendo correctamente",
        endpoints: [
            "/api/mesas",
            "/api/reservas",
            "/api/facturas",
            "/api/dashboard",
            "/api/eventos",
            "/api/auth" // Añadido el endpoint de prueba
        ]
    });
});

// Middleware de Errores Globales (al final)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Servidor Backend corriendo en el puerto ${PORT}`);
});