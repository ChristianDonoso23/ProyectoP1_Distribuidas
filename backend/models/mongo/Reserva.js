const mongoose = require('mongoose');

const reservaSchema = new mongoose.Schema({
    mesa: {
        type: Number,
        required: true
    },
    cliente_id: {
        type: String,
        required: true
    },
    nombre_cliente: {
        type: String,
        required: true
    },
    expiracion: {
        type: Date,
        required: false
    },
    estado: {
        type: String,
        enum: ['pendiente', 'confirmada', 'finalizada', 'cancelada'],
        default: 'pendiente'
    },
    mysql_id: {
        type: Number,
        required: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Reserva', reservaSchema);
