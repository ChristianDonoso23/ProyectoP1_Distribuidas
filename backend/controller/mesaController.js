const Mesa = require('../models/Mesa');

exports.getMesas = async (req, res) => {
    try {
        const mesas = await Mesa.getAll();
        res.status(200).json({ success: true, data: mesas });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error al obtener mesas", error: error.message });
    }
};

exports.getMesaPorId = async (req, res) => {
    try {
        const mesa = await Mesa.getById(req.params.id);
        if (!mesa) return res.status(404).json({ success: false, message: "Mesa no encontrada" });
        res.status(200).json({ success: true, data: mesa });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error al obtener la mesa", error: error.message });
    }
};