import React, { useState, useEffect } from 'react';
import axios from 'axios';
import logo_safemed from '../assets/logo_safemed.jpg';
import logo2 from '../assets/logo2.png';
import "../styles/supervisorChecklist.css";
import { useNavigate } from 'react-router-dom';

function SupervisorChecklist() {
  const [checklist, setChecklist] = useState(null);
  const [respuestas, setRespuestas] = useState({});
  const [observacionesGenerales, setObservacionesGenerales] = useState('');
  const [loading, setLoading] = useState(true);
  const [finalizando, setFinalizando] = useState(false);
  const [guardandoProceso, setGuardandoProceso] = useState(false);
  const [mensajeGuardado, setMensajeGuardado] = useState('');
  const [checklistStatus, setChecklistStatus] = useState('en_progreso');
  const [historial, setHistorial] = useState([]);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [detalleHistorial, setDetalleHistorial] = useState(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    cargarChecklist();
    cargarHistorial();
  }, []);

  const cargarChecklist = async () => {
    try {
      const response = await axios.get(
        'http://localhost:5000/api/supervisor/active-checklist',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setChecklist(response.data);
      setRespuestas(response.data.respuestas || {});
      setObservacionesGenerales(response.data.observaciones_generales || '');
      setChecklistStatus(response.data.status || 'en_progreso');
      setLoading(false);
    } catch (error) {
      console.error('Error cargando checklist:', error);
      if (error.response?.status === 403) {
        navigate('/login');
      }
      setLoading(false);
    }
  };

  const guardarProceso = async () => {
    if (!checklist) return;
    setGuardandoProceso(true);
    setMensajeGuardado('');
    try {
      await axios.post(
        'http://localhost:5000/api/supervisor/save-progress',
        {
          checklist_id: checklist.checklist_id,
          observaciones_generales: observacionesGenerales
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMensajeGuardado('✅ Progreso guardado correctamente');
      setTimeout(() => setMensajeGuardado(''), 3000);
    } catch (error) {
      console.error('Error guardando progreso:', error);
      setMensajeGuardado('❌ Error al guardar el progreso');
      setTimeout(() => setMensajeGuardado(''), 3000);
    } finally {
      setGuardandoProceso(false);
    }
  };

  const guardarRespuesta = async (itemId, verificado, observaciones) => {
    if (!checklist) return;
    
    try {
      await axios.post(
        'http://localhost:5000/api/supervisor/response',
        {
          checklist_id: checklist.checklist_id,
          item_id: itemId,
          verificado,
          observaciones
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Error guardando respuesta:', error);
    }
  };

  const toggleVerificacion = (itemId, targetValue) => {
    if (checklistStatus === 'completado') return;
    setRespuestas(prev => ({
      ...prev,
      [itemId]: {
        verificado: targetValue,
        observaciones: prev[itemId]?.observaciones || ''
      }
    }));
    guardarRespuesta(itemId, targetValue, respuestas[itemId]?.observaciones || '');
  };

  const actualizarObservaciones = (itemId, observaciones) => {
    setRespuestas(prev => ({
      ...prev,
      [itemId]: {
        verificado: prev[itemId]?.verificado || 0,
        observaciones
      }
    }));
  };

  const finalizarChecklist = async () => {
    if (!window.confirm('¿Estás seguro de finalizar el turno? No podrás modificar las respuestas después.')) {
      return;
    }
    
    setFinalizando(true);
    try {
      await axios.post(
        'http://localhost:5000/api/supervisor/finalize-checklist',
        {
          checklist_id: checklist.checklist_id,
          observaciones_generales: observacionesGenerales
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('✅ Checklist finalizado correctamente');
      navigate('/');
    } catch (error) {
      console.error('Error finalizando:', error);
      alert('❌ Error al finalizar el checklist');
    } finally {
      setFinalizando(false);
    }
  };

  const cerrarSesion = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const cargarHistorial = async () => {
    try {
      const response = await axios.get(
        'http://localhost:5000/api/supervisor/history',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setHistorial(response.data);
    } catch (error) {
      console.error('Error cargando historial:', error);
    }
  };

  const verDetalleHistorial = async (id) => {
    setLoadingDetalle(true);
    setDetalleHistorial(null);
    try {
      const response = await axios.get(
        `http://localhost:5000/api/supervisor/checklist/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDetalleHistorial(response.data);
    } catch (error) {
      console.error('Error cargando detalle:', error);
    } finally {
      setLoadingDetalle(false);
    }
  };

  if (loading) return <div className="loading">Cargando checklist...</div>;
  if (!checklist) return <div className="error">Error al cargar el checklist</div>;

  const secciones = {};
  const subitemsMap = {};

  checklist.items.forEach(item => {
    if (item.parent_item_id !== null) {
      if (!subitemsMap[item.parent_item_id]) subitemsMap[item.parent_item_id] = [];
      subitemsMap[item.parent_item_id].push(item);
    } else {
      if (!secciones[item.seccion_id]) {
        secciones[item.seccion_id] = { titulo: item.seccion_titulo, items: [] };
      }
      secciones[item.seccion_id].items.push(item);
    }
  });

  const locked = checklistStatus === 'completado';

  return (
    <div className="supervisor-container">
      <header>
        <div className ="logo-left">
            <img src={logo_safemed} alt="logo" className="logo" />
        </div>  
          <h1>CHECKLIST - SUPERVISOR DE PRODUCCIÓN</h1>
          
        <div >
            <img src={logo2} alt="logo" className="logo logo-right" />
        </div>
      </header>
      <header>
      <div className="header-meta">
            <span>Supervisor: <strong>{user?.nombre}</strong></span><br></br>
            <span>Fecha: <strong>{new Date().toLocaleDateString()}</strong></span><br></br>
            <span>
              Turno:
              <select className="turno-select">
                <option>Seleccione...</option>
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </span>
          </div>
        </header>
    <header>
      <div className="header-info">
        <div className="header-buttons">
        <span className={`status-badge ${locked ? 'status-completado' : ''}`}>
            {locked ? '🔒 Turno finalizado' : '🟡 Turno en progreso'}
        </span>
        <button onClick={cerrarSesion} className="logout-btn">Cerrar Sesión</button>
      </div>
      </div>
      </header>

      <div className="checklist-form">
        {Object.values(secciones).map((seccion, seccionIdx) => (
          <table key={seccion.titulo} className="checklist-table">
            <thead>
              <tr>
                <th colSpan="4" className="section-title-row">
                   {seccion.titulo.toUpperCase()}
                </th>
              </tr>
              <tr>
                <th className="col-num">#</th>
                <th className="col-actividad">Actividad</th>
                <th className="col-verificacion">Verificación</th>
                <th className="col-observaciones">Observaciones / Acciones Correctivas</th>
              </tr>
            </thead>
            <tbody>
              {seccion.items.map((item, itemIdx) => {
                const subitems = subitemsMap[item.item_id] || [];
                const respuesta = respuestas[item.item_id];

                if (subitems.length === 0) {
                  return (
                    <tr key={item.item_id} className={locked ? 'row-locked' : ''}>
                      <td className="col-num">{itemIdx + 1}</td>
                      <td className="col-actividad">{item.descripcion}</td>
                      <td className="col-verificacion">
                        <div className="check-options">
                          <label className="check-label">
                            <input
                              type="checkbox"
                              checked={respuesta?.verificado === 1}
                              onChange={() => toggleVerificacion(item.item_id, 1)}
                              disabled={locked}
                            />
                            <span>Sí</span>
                          </label>
                          <label className="check-label">
                            <input
                              type="checkbox"
                              checked={respuesta?.verificado === 0}
                              onChange={() => toggleVerificacion(item.item_id, 0)}
                              disabled={locked}
                            />
                            <span>No</span>
                          </label>
                        </div>
                      </td>
                      <td className="col-observaciones">
                        <textarea
                          value={respuesta?.observaciones || ''}
                          onChange={(e) => actualizarObservaciones(item.item_id, e.target.value)}
                          onBlur={() => guardarRespuesta(item.item_id, respuesta?.verificado ?? 0, respuesta?.observaciones || '')}
                          disabled={locked}
                          rows="2"
                        />
                      </td>
                    </tr>
                  );
                }

                // Parent item con subitems
                return (
                  <tr key={item.item_id} className={locked ? 'row-locked' : ''}>
                    <td className="col-num">{itemIdx + 1}</td>
                    <td className="col-actividad">
                      <div className="parent-item-desc">{item.descripcion}</div>
                      {subitems.map(sub => (
                        <div key={sub.item_id} className="subitem-desc">- {sub.descripcion}</div>
                      ))}
                    </td>
                    <td className="col-verificacion">
                      <div className="check-placeholder">&nbsp;</div>
                      {subitems.map(sub => {
                        const subResp = respuestas[sub.item_id];
                        return (
                          <div key={sub.item_id} className="check-options">
                            <label className="check-label">
                              <input
                                type="checkbox"
                                checked={subResp?.verificado === 1}
                                onChange={() => toggleVerificacion(sub.item_id, 1)}
                                disabled={locked}
                              />
                              <span>Sí</span>
                            </label>
                            <label className="check-label">
                              <input
                                type="checkbox"
                                checked={subResp?.verificado === 0}
                                onChange={() => toggleVerificacion(sub.item_id, 0)}
                                disabled={locked}
                              />
                              <span>No</span>
                            </label>
                          </div>
                        );
                      })}
                    </td>
                    <td className="col-observaciones">
                      <textarea
                        value={respuesta?.observaciones || ''}
                        onChange={(e) => actualizarObservaciones(item.item_id, e.target.value)}
                        onBlur={() => guardarRespuesta(item.item_id, respuesta?.verificado ?? 0, respuesta?.observaciones || '')}
                        disabled={locked}
                        rows={subitems.length + 1}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}

        <div className="finalize-section">
          <h3>Observaciones Generales del Turno</h3>
          <textarea
            rows="4"
            value={observacionesGenerales}
            onChange={(e) => setObservacionesGenerales(e.target.value)}
            placeholder="Ingrese observaciones generales sobre el turno (opcional)..."
            disabled={locked}
          />

          {mensajeGuardado && (
            <div className={`mensaje-guardado ${mensajeGuardado.startsWith('❌') ? 'error' : 'success'}`}>
              {mensajeGuardado}
            </div>
          )}

          {locked ? (
            <div className="turno-finalizado-msg">
              Este turno ha sido finalizado. No se pueden realizar más cambios.
            </div>
          ) : (
            <div className="action-buttons">
              <button
                onClick={guardarProceso}
                className="btn-save-progress"
                disabled={guardandoProceso || finalizando}
              >
                {guardandoProceso ? 'Guardando...' : 'Guardar Proceso'}
              </button>
              <button
                onClick={finalizarChecklist}
                className="btn-finalize"
                disabled={finalizando || guardandoProceso}
              >
                {finalizando ? 'Finalizando...' : 'Finalizar Turno'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="historial-section">
        <button className="btn-historial" onClick={() => setMostrarHistorial(!mostrarHistorial)}>
          {mostrarHistorial ? '▲ Ocultar mis turnos anteriores' : '📋 Ver mis turnos anteriores'}
        </button>
        {mostrarHistorial && (
          <div className="historial-list">
            {historial.length === 0 ? (
              <p className="historial-empty">No hay turnos registrados.</p>
            ) : (
              <table className="historial-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Turno #</th>
                    <th>Estado</th>
                    <th>Progreso</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map(h => (
                    <tr key={h.id}>
                      <td>{h.fecha}</td>
                      <td>{h.numero_turno}</td>
                      <td>
                        <span className={`status-badge ${h.status === 'completado' ? 'status-completado' : ''}`}>
                          {h.status === 'completado' ? '✅ Finalizado' : '🟡 En progreso'}
                        </span>
                      </td>
                      <td>{h.progreso}% ({h.items_respondidos}/{h.total_items} ítems)</td>
                      <td>
                        <button className="btn-ver-detalle" onClick={() => verDetalleHistorial(h.id)}
                          disabled={loadingDetalle}>
                          {loadingDetalle ? '...' : 'Ver detalle'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {detalleHistorial && (
        <div className="modal-overlay" onClick={() => setDetalleHistorial(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Detalle del Turno — {detalleHistorial.checklist.fecha}</h2>
              <button className="modal-close" onClick={() => setDetalleHistorial(null)}>✕</button>
            </div>
            <div className="modal-body">
              {detalleHistorial.secciones.map(sec => {
                const mainItems = sec.items.filter(i => i.parent_item_id === null);
                const subMap = {};
                sec.items.filter(i => i.parent_item_id !== null).forEach(s => {
                  if (!subMap[s.parent_item_id]) subMap[s.parent_item_id] = [];
                  subMap[s.parent_item_id].push(s);
                });
                return (
                  <div key={sec.titulo} className="modal-section">
                    <h3 className="modal-section-title">{sec.titulo}</h3>
                    <table className="modal-table">
                      <thead>
                        <tr>
                          <th>Actividad</th>
                          <th style={{width:'110px'}}>Verificación</th>
                          <th>Observaciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mainItems.map(item => (
                          <React.Fragment key={item.item_id}>
                            <tr>
                              <td>{item.descripcion}</td>
                              <td style={{textAlign:'center'}}>
                                {(subMap[item.item_id] || []).length === 0 ? (
                                  item.verificado === 1 ? <span className="badge-si">Sí</span>
                                  : item.verificado === 0 ? <span className="badge-no">No</span>
                                  : <span className="badge-pending">Pendiente</span>
                                ) : '—'}
                              </td>
                              <td>{item.observaciones || <span className="no-obs">—</span>}</td>
                            </tr>
                            {(subMap[item.item_id] || []).map(sub => (
                              <tr key={sub.item_id}>
                                <td style={{paddingLeft:'2rem', color:'#555'}}>↳ {sub.descripcion}</td>
                                <td style={{textAlign:'center'}}>
                                  {sub.verificado === 1 ? <span className="badge-si">Sí</span>
                                  : sub.verificado === 0 ? <span className="badge-no">No</span>
                                  : <span className="badge-pending">Pendiente</span>}
                                </td>
                                <td>{sub.observaciones || <span className="no-obs">—</span>}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
              {detalleHistorial.checklist.observaciones_generales && (
                <div className="modal-obs">
                  <strong>Observaciones generales:</strong>
                  <p>{detalleHistorial.checklist.observaciones_generales}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SupervisorChecklist;