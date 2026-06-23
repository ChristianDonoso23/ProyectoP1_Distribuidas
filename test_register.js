// Script rápido para probar el registro y verificar en MongoDB
const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config();

const testData = JSON.stringify({
    correo: 'prueba_test@gmail.com',
    contrasenia: '123456'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(testData)
    }
};

console.log('--- 1. Registrando usuario ---');
const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', async () => {
        console.log(`Status: ${res.statusCode}`);
        console.log('Respuesta:', data);

        // Ahora verificar directamente en MongoDB
        console.log('\n--- 2. Verificando en MongoDB ---');
        console.log('Conectando a:', process.env.MONGO_URI);
        
        await mongoose.connect(process.env.MONGO_URI);
        const db = mongoose.connection.db;
        
        // Listar todas las colecciones
        const collections = await db.listCollections().toArray();
        console.log('Colecciones en la base de datos:', collections.map(c => c.name));
        
        // Buscar en la colección de usuarios
        const usuarios = await db.collection('usuarios').find({}).toArray();
        console.log(`\nUsuarios encontrados (${usuarios.length}):`);
        usuarios.forEach(u => {
            console.log(`  - ID: ${u._id}, Correo: ${u.correo}, Creado: ${u.createdAt}`);
        });

        await mongoose.disconnect();
        process.exit(0);
    });
});

req.on('error', (err) => console.error('Error:', err.message));
req.write(testData);
req.end();
