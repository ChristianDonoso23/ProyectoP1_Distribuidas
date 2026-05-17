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

// Middlewares básicos
app.use(cors());
app.use(requestLogger);
app.use(errorHandler);
app.use(express.json());

// Servir archivos estáticos del dashboard
app.use(express.static(path.join(__dirname, '../frontend/dashboard')));

// 2. Vincular las rutas a los Endpoints de la API
app.use('/api/mesas', mesasRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/facturas', facturasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/eventos', eventosRoutes);

subscribe('mesa-ocupada', (event) => {
    io.emit('mesa-ocupada', event.payload || event); 
});

subscribe('mesa-liberada', (event) => {
    io.emit('mesa-liberada', event.payload || event);
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