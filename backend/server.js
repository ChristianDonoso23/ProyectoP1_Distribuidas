require('dotenv').config();

const express = require('express');
const cors = require('cors');
const Mesa = require('./models/Mesa');

const pool = require('./config/db');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', async (req, res) => {

    try {

        const mesas = await Mesa.getAll();

        res.json({
            success: true,
            total: mesas.length,
            data: mesas
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: 'Error retrieving tables'
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});