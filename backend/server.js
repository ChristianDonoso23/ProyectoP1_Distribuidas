require('dotenv').config();
const express = require('express');
const cors = require('cors');

// 1. Importar todas tus rutas
const mesasRoutes = require('./routes/mesas.routes');
const reservasRoutes = require('./routes/reservas.routes');
const facturasRoutes = require('./routes/facturas.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const eventosRoutes = require('./routes/eventos.routes');

const app = express();

// Middlewares básicos
app.use(cors());
app.use(express.json());

// 2. Vincular las rutas a los Endpoints de la API
app.use('/api/mesas', mesasRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/facturas', facturasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/eventos', eventosRoutes);

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

app.listen(PORT, () => {
    console.log(`Servidor Backend corriendo en el puerto ${PORT}`);
});