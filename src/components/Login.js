import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import '../styles/login.css';

function Login({ setUser }) {
  const [usuarios, setUsuarios] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    const cargarUsuarios = async () => {
      try {
        const { data } = await api.get("/usuarios");
        // ✅ Asegura que data sea un array
        setUsuarios(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error al cargar usuarios:", error);
        setUsuarios([]); // ← En caso de error, array vacío
        setError("Error al cargar usuarios. Por favor, intenta de nuevo.");
      }
    };
    
    cargarUsuarios();
  }, []); // ← Dependencias vacías

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // ✅ Usa api en lugar de axios directo para mantener consistencia
      const response = await api.post('/auth/login', {
        username,
        password
      });

      const { token, user } = response.data;
    
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      if (setUser) {
        setUser(user);
      }
      
      // Redirigir según el rol
      if (user.role === 'SUPERVISOR') {
        navigate('/');
      } else if (user.role === 'ADMINISTRADOR') {
        navigate('/adminUsuarios');
      } else {
        navigate('/');
      }
      
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Checklist de Producción</h1>
        <h2>Iniciar Sesión</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Usuario</label>
            <select
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            >
              <option value="">
                Seleccione un usuario
              </option>
              {/* ✅ Validación de seguridad antes de map */}
              {Array.isArray(usuarios) && usuarios.map((u) => (
                <option key={u.id || u.username} value={u.username}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingrese su contraseña"
              required
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;