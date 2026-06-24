const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const Usuario = require('../models/mongo/Usuario');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/api/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const correo = profile.emails[0].value;
        
        // 1. Verificar si el usuario ya existe en MongoDB
        let usuario = await Usuario.findOne({ correo });

        if (!usuario) {
            // 2. Si no existe, registrarlo automáticamente con su cuenta de Google
            usuario = await Usuario.create({
                correo: correo,
                googleId: profile.id
            });
        } else if (!usuario.googleId) {
            // 3. Si ya existía (se registró manualmente antes) pero ahora usa Google, vinculamos la cuenta
            usuario.googleId = profile.id;
            await usuario.save();
        }

        // Retornar el usuario para que la ruta genere el JWT
        return done(null, usuario);
    } catch (error) {
        return done(error, false);
    }
}));

module.exports = passport;