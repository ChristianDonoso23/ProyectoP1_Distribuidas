const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
    correo: {
        type: String,
        required: true,
        unique: true
    },
    contrasenia: {
        type: String,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Usuario', usuarioSchema);