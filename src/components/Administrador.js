// AdminUsuarios.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from "../services/api";
import "../styles/administrador.css";

export default function AdminUsuarios({ onClose, onUserCreated, onUserUpdated, onUserDeleted }) {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [mostrarModalPassword, setMostrarModalPassword] = useState(false);
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState({});
  const [formData, setFormData] = useState({
    username: '',
    nombre: '',
    cedula_identidad: '',
    password: '',
    role: 'SUPERVISOR',
    area: '',
    activo: true
  });

  const user = JSON.parse(localStorage.getItem("user"));
  const esJefeProduccion = user?.role === "ADMINISTRADOR";

  // Roles permitidos para crear (ADMINISTRADOR puede crear estos roles)
  const rolesPermitidos = [
    { value: 'SUPERVISOR', label: 'SUPERVISOR' },
    { value: 'JEFE_PRODUCCION', label: 'JEFE_PRODUCCION' },
    { value: 'ADMINISTRADOR', label: 'ADMINISTRADOR'}
  ];

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    try {
      setCargando(true);
      const response = await api.get('/usuarios');
      setUsuarios(response.data);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      alert('Error al cargar usuarios');
    } finally {
      setCargando(false);
    }
  };

  const handleVerPassword = async (usuario) => {
    if (!esJefeProduccion) return;
    
    try {
      setCargando(true);
      const response = await api.get(
        `/usuarios/${usuario.id}/con-password`, {
          params: { rolSolicitante: user.role }
        }
      );
      
      setMostrarPassword(prev => ({
        ...prev,
        [usuario.id]: response.data.password
      }));
      
      // Ocultar después de 5 segundos
      setTimeout(() => {
        setMostrarPassword(prev => ({
          ...prev,
          [usuario.id]: null
        }));
      }, 5000);
      
    } catch (error) {
      console.error('Error al obtener contraseña:', error);
      alert('Error al obtener la contraseña');
    } finally {
      setCargando(false);
    }
  };

  const handleCambiarPassword = (usuario) => {
    setUsuarioSeleccionado(usuario);
    setNuevaPassword('');
    setConfirmarPassword('');
    setMostrarModalPassword(true);
  };

  const guardarNuevaPassword = async () => {
    if (!nuevaPassword || nuevaPassword.length < 4) {
      alert('La contraseña debe tener al menos 4 caracteres');
      return;
    }

    if (nuevaPassword !== confirmarPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }

    try {
      setCargando(true);
      await api.put(
        `/usuarios/${usuarioSeleccionado.id}/cambiar-password`,
        {
          nuevaPassword,
          rolSolicitante: user.role
        }
      );
      
      alert('Contraseña cambiada correctamente');
      setMostrarModalPassword(false);
      setUsuarioSeleccionado(null);
      
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      alert(error.response?.data?.error || 'Error al cambiar la contraseña');
    } finally {
      setCargando(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const resetForm = () => {
    setFormData({
      username: '',
      nombre: '',
      password: '',
      role: 'SUPERVISOR',
      activo: true
    });
    setUsuarioEditando(null);
    setMostrarFormulario(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (usuarioEditando) {
        // Actualizar usuario
        const response = await api.put(`/usuarios/${usuarioEditando.id}`, formData);
        setUsuarios(prev => prev.map(u => u.id === usuarioEditando.id ? response.data : u));
        alert('Usuario actualizado correctamente');
        if (onUserUpdated) onUserUpdated(response.data);
      } else {
        // Crear usuario
        const response = await api.post('/usuarios', formData);
        setUsuarios(prev => [...prev, response.data]);
        alert('Usuario creado correctamente');
        if (onUserCreated) onUserCreated(response.data);
      }
      resetForm();
    } catch (error) {
      console.error('Error al guardar usuario:', error);
      alert(error.response?.data?.error || 'Error al guardar usuario');
    }
  };

  const handleEdit = (usuario) => {
    setUsuarioEditando(usuario);
    setFormData({
      username: usuario.username || '',
      nombre: usuario.nombre || '',
      password: '',
      rol: usuario.role || 'SUPERVISOR',
      activo: usuario.activo !== undefined ? usuario.activo : true
    });
    setMostrarFormulario(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este usuario?')) return;
    
    try {
      await api.delete(`/usuarios/${id}`);
      setUsuarios(prev => prev.filter(u => u.id !== id));
      alert('Usuario eliminado correctamente');
      if (onUserDeleted) onUserDeleted(id);
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      alert('Error al eliminar usuario');
    }
  };

  const handleToggleActivo = async (usuario) => {
    try {
      const response = await api.patch(`/usuarios/${usuario.id}/toggle-activo`);
      setUsuarios(prev => prev.map(u => u.id === usuario.id ? { ...u, activo: response.data.activo } : u));
      alert(`Usuario ${response.data.activo ? 'activado' : 'desactivado'} correctamente`);
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      alert('Error al cambiar estado del usuario');
    }
  };

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal-content">
        <header>
        <div className="admin-modal-header">
          <h2>Administración de Usuarios</h2>
        </div>
        </header>
        <div className="admin-modal-body">
            <header>
          <div className="admin-actions">
            <button 
              className="admin-btn-btn-primary"
              onClick={() => {
                resetForm();
                setMostrarFormulario(true);
              }}
            >
              + Nuevo Usuario
            </button>
            <button className="admin-btn btn-secondary" onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                navigate('/login');
              }}>
              Salir
            </button>
          </div>
            </header>
          {mostrarFormulario && (
            <div className="admin-form-container">
              <h3>{usuarioEditando ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</h3>
              <form onSubmit={handleSubmit} className="admin-form">
                <div className="admin-form-group">
                  <label>Usuario (Username):</label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="admin-form-group">
                  <label>Nombre:</label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="admin-form-group">
                  <label>Contraseña:</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required={!usuarioEditando}
                    placeholder={usuarioEditando ? "Dejar vacío para no cambiar" : ""}
                  />
                </div>

                <div className="admin-form-group">
                  <label>Rol:</label>
                  <select
                    name="rol"
                    value={formData.role}
                    onChange={handleInputChange}
                    required
                  >
                    {rolesPermitidos.map(role => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>


                <div className="admin-form-group checkbox">
                  <label>
                    <input
                      type="checkbox"
                      name="activo"
                      checked={formData.activo}
                      onChange={handleInputChange}
                    />
                    Usuario activo
                  </label>
                </div>

                <div className="admin-form-actions">
                  <button type="submit" className="btn btn-success">
                    {usuarioEditando ? 'Actualizar' : 'Crear'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={resetForm}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="admin-table-container">
            {cargando ? (
              <p>Cargando usuarios...</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Rol</th>
                    <th>Contraseña</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center' }}>
                        No hay usuarios registrados
                      </td>
                    </tr>
                  ) : (
                    usuarios.map(usuario => (
                      <tr key={usuario.id}>
                        <td>{usuario.nombre}</td>
                        <td>
                          <span className={`admin-rol-badge rol-${usuario.role?.toLowerCase().replace(/\s+/g, '-')}`}>
                            {usuario.role}
                          </span>
                        </td>
                        <td>
                          <span className={`admin-estado-badge ${usuario.activo ? 'activo' : 'inactivo'}`}>
                            {usuario.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="admin-password-cell">
                          {esJefeProduccion ? (
                            <div className="admin-password-actions">
                              {mostrarPassword[usuario.id] ? (
                                <span className="admin-password-text">{mostrarPassword[usuario.id]}</span>
                              ) : (
                                <button 
                                  className="admin-btn-icon view-password"
                                  onClick={() => handleVerPassword(usuario)}
                                  title="Ver contraseña"
                                >
                                  👁️
                                </button>
                              )}
                              <button 
                                className="admin-btn-icon change-password"
                                onClick={() => handleCambiarPassword(usuario)}
                                title="Cambiar contraseña"
                              >
                                🔑
                              </button>
                            </div>
                          ) : (
                            <span className="admin-password-hidden">••••••••</span>
                          )}
                        </td>
                        <td className="admin-acciones-cell">
                          <button 
                            className="admin-btn-icon edit"
                            onClick={() => handleEdit(usuario)}
                            title="Editar"
                          >
                            ✏️
                          </button>
                          <button 
                            className="admin-btn-icon delete"
                            onClick={() => handleDelete(usuario.id)}
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal para cambiar contraseña */}
      {mostrarModalPassword && (
        <div className="admin-password-modal-overlay">
          <div className="admin-password-modal">
            <h3>Cambiar Contraseña - {usuarioSeleccionado?.nombre}</h3>
            <div className="admin-password-form">
              <div className="admin-form-group">
                <label>Nueva Contraseña:</label>
                <input
                  type="password"
                  value={nuevaPassword}
                  onChange={(e) => setNuevaPassword(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  autoFocus
                />
              </div>
              <div className="admin-form-group">
                <label>Confirmar Contraseña:</label>
                <input
                  type="password"
                  value={confirmarPassword}
                  onChange={(e) => setConfirmarPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                />
              </div>
              <div className="admin-password-modal-actions">
                <button 
                  className="admin-btn btn-success"
                  onClick={guardarNuevaPassword}
                  disabled={cargando}
                >
                  {cargando ? 'Guardando...' : 'Guardar'}
                </button>
                <button 
                  className="admin-btn btn-secondary"
                  onClick={() => {
                    setMostrarModalPassword(false);
                    setUsuarioSeleccionado(null);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}