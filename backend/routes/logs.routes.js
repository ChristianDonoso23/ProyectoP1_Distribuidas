const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// GET /api/logs/resumen — Lee el archivo de log más reciente y retorna un conteo por nivel
router.get('/resumen', (req, res) => {
    const logDir = path.join(__dirname, '..', 'logs');

    if (!fs.existsSync(logDir)) {
        return res.status(500).json({ error: 'No existe el directorio de logs' });
    }

    const latestLog = fs.readdirSync(logDir)
        .filter(file => file.endsWith('.log') && file !== 'errors.log')
        .map(file => ({
            file,
            fullPath: path.join(logDir, file),
            modifiedTime: fs.statSync(path.join(logDir, file)).mtimeMs
        }))
        .sort((a, b) => b.modifiedTime - a.modifiedTime)[0];

    if (!latestLog) {
        return res.status(404).json({ error: 'No se encontraron archivos de log' });
    }

    const lines = fs.readFileSync(latestLog.fullPath, 'utf-8')
        .split('\n')
        .filter(Boolean);

    const summary = lines.reduce((acc, line) => {
        const match = line.match(/\[(INFO|ERROR|WARN|DEBUG|VERBOSE|SILLY|HTTP)\]/i);
        if (match) {
            const level = match[1].toUpperCase();
            acc[level] = (acc[level] || 0) + 1;
        }
        return acc;
    }, {});

    return res.json({
        archivo: latestLog.file,
        totalLineas: lines.length,
        resumen: summary
    });
});

module.exports = router;
