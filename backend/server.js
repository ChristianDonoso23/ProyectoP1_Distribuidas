const express = require('express');
const cors = require('cors');
const path = require('path');

// 1. Configurar dotenv UNA SOLA VEZ, al inicio.
require('dotenv').config();

// 2. Inyectar el logger Winston globalmente (antes de cualquier importación que lo use)
global.logger = require('./utils/logger');

const http = require('http');
const { Server } = require('socket.io');
const { subscribe } = require('./services/websocketService');

// Importaciones de base de datos
const connectMongo = require('./config/mongo');
const db = require('./config/db');
const requestLogger = require('./middlewares/loggerMiddleware');
const errorHandler = require('./middlewares/errorMiddleware');

// Importaciones de Rutas REST
const mesasRoutes = require('./routes/mesas.routes');
const reservasRoutes = require('./routes/reservas.routes');
const facturasRoutes = require('./routes/facturas.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const eventosRoutes = require('./routes/eventos.routes');
const authRoutes = require('./routes/auth.routes');

// Importación del módulo modular de WebSockets (Parcial 2 - Integrante 3)
const { registerSocketHandler } = require('./sockets/socketHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
});

// 3. Middlewares básicos
app.use(cors());
app.use(requestLogger);
app.use(express.json());

// 4. Inicializar conexiones a ambas bases de datos al arranque
const inicializarConexiones = async () => {
    // MongoDB (Reservas + Usuarios Auth)
    await connectMongo();
    global.logger.info('MongoDB conectado exitosamente (Módulo Reservas + Auth)');

    // MySQL (Sistema Existente - no se modifica la lógica base)
    try {
        await db.query('SELECT 1');
        global.logger.info('MySQL conectado exitosamente (Pool activo)');
    } catch (error) {
        global.logger.error(`Error al conectar a MySQL: ${error.message}`);
    }
};

inicializarConexiones();

// 5. Registrar el manejador de WebSockets (Módulo modular con JWT Handshake)
registerSocketHandler(io);

// 6. Servir archivos estáticos del dashboard
app.use(express.static(path.join(__dirname, '../frontend/dashboard')));

// 7. Vincular las rutas a los Endpoints de la API
app.use('/api/mesas', mesasRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/facturas', facturasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/eventos', eventosRoutes);
app.use('/api/auth', authRoutes);

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
            "/api/auth"
        ]
    });
});

// 8. Middleware de Errores Globales (siempre al final)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    global.logger.info(`Servidor Backend corriendo en el puerto ${PORT}`);
});