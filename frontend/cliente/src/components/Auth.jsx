import { useState } from 'react';
import './Auth.css';

export default function Auth({ onLoginSuccess }) {
    const [isLogin, setIsLogin] = useState(true);
    const [correo, setCorreo] = useState('');
    const [contrasenia, setContrasenia] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [cargando, setCargando] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess(''); setCargando(true);
        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
        
        try {
            const response = await fetch(`http://localhost:3000${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ correo, contrasenia })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.msg || 'Error en la autenticación');

            if (isLogin) {
                onLoginSuccess(data.token, data.usuario);
            } else {
                setIsLogin(true); 
                setCorreo(''); 
                setContrasenia('');
                setSuccess('Registro exitoso. Por favor, inicia sesión.');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setCargando(false);
        }
    };

    // Función para alternar la vista limpiando los campos
    const toggleAuthMode = () => {
        setIsLogin(!isLogin);
        setError('');
        setSuccess('');
        setCorreo('');
        setContrasenia('');
    };

    return (
        /* La clase 'reverse-layout' invierte los paneles dinámicamente */
        <div className={`auth-layout ${!isLogin ? 'reverse-layout' : ''}`}>
            
            {/* Panel del Formulario */}
            <div className="auth-form-side">
                {/* La key fuerza a React a re-renderizar la animación CSS al cambiar de vista */}
                <div className="auth-card" key={isLogin ? 'login' : 'register'}>
                    <div className="auth-brand">
                        <h1>E-Restaurante</h1>
                    </div>
                    
                    <h2>{isLogin ? 'Inicia sesión en tu cuenta' : 'Crea una cuenta nueva'}</h2>
                    <p className="auth-subtitle">
                        {isLogin ? '¡Bienvenido de nuevo! Ingresa tus credenciales.' : 'Regístrate para reservar tus mesas en tiempo real.'}
                    </p>
                    
                    {error && <div className="auth-error">{error}</div>}
                    {success && <div className="auth-success">{success}</div>}
                    
                    <form onSubmit={handleSubmit}>
                        <div className="auth-form-group">
                            <input 
                                type="email" 
                                className="auth-input"
                                placeholder="Correo electrónico" 
                                value={correo}
                                onChange={(e) => setCorreo(e.target.value)}
                                required 
                            />
                        </div>
                        
                        <div className="auth-form-group">
                            <input 
                                type="password" 
                                className="auth-input"
                                placeholder="Contraseña" 
                                value={contrasenia}
                                onChange={(e) => setContrasenia(e.target.value)}
                                required 
                            />
                        </div>

                        <button type="submit" className="btn-auth-primary" disabled={cargando}>
                            {cargando ? 'Procesando...' : (isLogin ? 'Ingresar' : 'Registrarse')}
                        </button>
                    </form>

                    {/* Separador */}
                    <div style={{ textAlign: 'center', margin: '20px 0', color: '#757575', fontSize: '0.9rem' }}>
                        O continuar con
                    </div>

                    {/* Botón de Google */}
                    <a 
                        href="http://localhost:3000/api/auth/google" 
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                            width: '100%', padding: '12px', backgroundColor: '#fff', color: '#333',
                            border: '1px solid #e0e0e0', borderRadius: '8px', textDecoration: 'none',
                            fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', transition: 'background 0.2s'
                        }}
                    >
                        <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" width="20" height="20" />
                        Google
                    </a>

                    <div className="auth-toggle">
                        {isLogin ? '¿No tienes una cuenta? ' : '¿Ya tienes una cuenta? '}
                        <span onClick={toggleAuthMode}>
                            {isLogin ? 'Regístrate aquí' : 'Inicia sesión'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Panel de Imagen (Tu imagen de ensalada) */}
            <div className="auth-image-side">
                <img src="/comida_vertical.jpg" alt="Platillo destacado" className="auth-hero-img" />
            </div>
            
        </div>
    );
}