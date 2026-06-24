const express = require('express');
const router = express.Router();
const reservaController = require('../controller/reservaController');
const authMiddleware = require('../middlewares/authMiddleware');

// Enforce JWT authentication on ALL reservation endpoints
router.use(authMiddleware);

// ⚠️ Las rutas estáticas deben ir ANTES que las rutas con parámetros (:id)
// para que Express no confunda /admin/pendientes con /:id

// Flujos Especiales / Administrador (rutas estáticas primero)
router.get('/admin/pendientes', reservaController.obtenerReservasPendientes);   // GET /api/reservas/admin/pendientes
router.post('/admin/liberar-todas', reservaController.liberarTodasLasMesas);    // POST /api/reservas/admin/liberar-todas

// CRUD de Reservas (rutas con parámetros después)
router.get('/', reservaController.obtenerReservas);                             // GET  /api/reservas
router.post('/', reservaController.crearReserva);                               // POST /api/reservas
router.get('/:id', reservaController.obtenerReservaPorId);                      // GET  /api/reservas/:id
router.put('/:id/finalizar', reservaController.finalizarReserva);               // PUT  /api/reservas/:id/finalizar
router.put('/:id', reservaController.actualizarReserva);                        // PUT  /api/reservas/:id
router.delete('/:id', reservaController.eliminarReserva);                       // DELETE /api/reservas/:id

module.exports = router;