import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {api} from '../services/api';
import { useNavigate } from 'react-router-dom';
import '../styles/login.css';

function Login({ setUser }) {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();  // ← Agrega esto

  useEffect(() => {
    const cargarUsuarios = async () => {
        setCargando(true);
        try{
            const {data} = await api.get("/usuarios");
            setUsuarios(data);
        } catch (error){
            console.error("Error al cargar usuarios:", error);
            alert("Error al cargar usuarios. Por favor, intenta de nuevo.");
        } finally {
            setCargando(false);
    }
  }
  cargarUsuarios();
    }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        username,
        password
      });

      const { token, user } = response.data;
    
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      
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
          <label>Usuario</label>
          <div className="input-group">
            <select
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={cargando}
            >
                <option value="">
                    {cargando ? 'Cargando usuarios...' : 'Seleccione un usuario'}
                </option>
                {usuarios.map((u) => (
                    <option key={u.username} value={u.username}>
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