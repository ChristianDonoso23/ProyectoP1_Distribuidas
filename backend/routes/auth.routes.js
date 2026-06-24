const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { register, login, recover } = require('../controller/authController');
const passport = require('../config/passport');

// ==========================================
// 1. RUTAS TRADICIONALES (JWT + Contraseña)
// ==========================================
router.post('/register', register);
router.post('/login', login);
router.post('/recover', recover);

// ==========================================
// 2. RUTAS OAUTH 2.0 (GOOGLE -> JWT)
// ==========================================

// Iniciar el flujo de Google (Redirige a la pantalla de selección de cuenta)
router.get('/google', passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false // Desactivamos las sesiones de Express, usaremos JWT
}));

// Callback: Google devuelve la información del usuario a esta ruta
router.get('/google/callback', 
    passport.authenticate('google', { session: false, failureRedirect: 'http://localhost:5173/?error=auth_failed' }), 
    (req, res) => {
        // Passport ya procesó al usuario y lo inyectó en req.user
        const usuario = req.user;

        // Generamos el mismo Token JWT que usas en el Login normal
        const token = jwt.sign(
            { id: usuario._id, correo: usuario.correo }, 
            process.env.JWT_SECRET, 
            { expiresIn: '8h' }
        );

        // Redirigimos al Frontend inyectando el token en la URL para que React lo capture
        res.redirect(`http://localhost:5173/?token=${token}&correo=${usuario.correo}&id=${usuario._id}`);
    }
);

module.exports = router;