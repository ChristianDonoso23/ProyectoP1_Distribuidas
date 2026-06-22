const Usuario = require('../models/mongo/Usuario');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/* Registro de usuario */
const register = async (req, res) => {
    try {
        const { correo, contrasenia } = req.body;
        
        // Validación adicional: evitar duplicados antes de intentar guardar
        const existeUsuario = await Usuario.findOne({ correo });
        if (existeUsuario) return res.status(400).json({ msg: 'El correo ya está registrado' });

        /* Encriptar la contraseña antes de guardarla */
        const hashed = await bcrypt.hash(contrasenia, 10);
        const nuevo = new Usuario({ correo, contrasenia: hashed });
        await nuevo.save();

        res.status(201).json({ msg: 'Usuario creado exitosamente' });
    } catch (error) {
        res.status(500).json({ msg: 'Error interno del servidor', error: error.message });
    }
};

/* Login de usuario */
const login = async (req, res) => {
    try {
        const { correo, contrasenia } = req.body;
        
        /* Buscar al usuario en la base de datos */
        const usuario = await Usuario.findOne({ correo });
        if (!usuario) return res.status(404).json({ msg: 'Usuario no encontrado' });

        /* Comparar la contraseña ingresada con la almacenada */
        const valido = await bcrypt.compare(contrasenia, usuario.contrasenia);
        if (!valido) return res.status(401).json({ msg: 'Contraseña incorrecta' });

        /* Generar un token JWT con el ID del usuario (Expira en 8 horas como buena práctica) */
        const token = jwt.sign(
            { id: usuario._id, correo: usuario.correo }, 
            process.env.JWT_SECRET, 
            { expiresIn: '8h' }
        );

        /* Retornar el token y la información del usuario */
        res.json({ 
            token,
            usuario: {
                id: usuario._id,
                correo: usuario.correo
            }
        });
    } catch (error) {
        res.status(500).json({ msg: 'Error interno del servidor', error: error.message });
    }
};

/* Recuperación de contraseña (Simulación) */
const recover = async (req, res) => {
    try {
        const { correo } = req.body;
        const usuario = await Usuario.findOne({ correo });

        if (!usuario) return res.status(404).json({ msg: 'Correo no encontrado' });

        const token = jwt.sign(
            { id: usuario._id, correo },
            process.env.JWT_SECRET,
            { expiresIn: '10m' } // Expiración corta obligatoria
        );

        res.json({
            msg: 'Recuperación iniciada. Usa este token temporal para continuar.',
            token
        });
    } catch (error) {
        res.status(500).json({ msg: 'Error interno del servidor', error: error.message });
    }
};

module.exports = { register, login, recover };