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

router.get('/google', passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false
}));

router.get('/google/callback', 
    passport.authenticate('google', { session: false, failureRedirect: 'http://localhost:5173/?error=auth_failed' }), 
    (req, res) => {
        const usuario = req.user;

        const token = jwt.sign(
            { id: usuario._id, correo: usuario.correo }, 
            process.env.JWT_SECRET, 
            { expiresIn: '8h' }
        );

        res.redirect(`http://localhost:5173/?token=${token}&correo=${usuario.correo}&id=${usuario._id}`);
    }
);

module.exports = router;