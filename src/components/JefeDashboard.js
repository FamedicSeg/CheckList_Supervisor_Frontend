import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoSafemed from '../assets/logo_safemed.jpg';
import logo2 from '../assets/logo2.png';
import '../styles/indicadores.css';

function JefeDashboard() {
  const [checklists, setChecklists] = useState([]);
  const [activeChecklists, setActiveChecklists] = useState([]);
  const [selectedChecklist, setSelectedChecklist] = useState(null);
  const [view, setView] = useState('active');
  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const now = new Date();
    const jan4 = new Date(now.getFullYear(), 0, 4);
    const jan4Day = jan4.getDay() || 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - (jan4Day - 1));
    const diff = Math.floor((now - monday) / (7 * 24 * 60 * 60 * 1000));
    const weekNum = diff + 1;
    return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  });
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (view === 'indicadores') {
      cargarIndicadoresSemanales(selectedWeek);
    } else {
      cargarChecklists();
      const interval = setInterval(cargarChecklists, 10000);
      return () => clearInterval(interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Auto-refresh del detalle mientras el turno está en progreso
  useEffect(() => {
    if (!selectedChecklist || selectedChecklist.checklist.status !== 'en_progreso') return;
    const id = selectedChecklist.checklist.id;
    const interval = setInterval(() => verDetalle(id), 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChecklist?.checklist?.id, selectedChecklist?.checklist?.status]);

  const cargarIndicadoresSemanales = async (week) => {
    try {
      setLoadingStats(true);
      const response = await api.get(
        `/jefe/weekly-stats?week=${week}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setWeeklyData(response.data);
    } catch (error) {
      console.error('Error cargando indicadores semanales:', error);
      if (error.response?.status === 403) navigate('/login');
    } finally {
      setLoadingStats(false);
    }
  };

  const handleWeekChange = (e) => {
    setSelectedWeek(e.target.value);
    cargarIndicadoresSemanales(e.target.value);
  };

  const cargarChecklists = async () => {
    try {
      setLoading(true);
      if (view === 'active') {
        const response = await api.get('/jefe/active-checklists', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setActiveChecklists(response.data);
      } else {
        const response = await api.get('/jefe/checklists', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setChecklists(response.data);
      }
    } catch (error) {
      console.error('Error cargando checklists:', error);
      if (error.response?.status === 403) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const verDetalle = async (id) => {
    try {
      const response = await api.get(`/jefe/checklists/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedChecklist(response.data);
    } catch (error) {
      console.error('Error cargando detalle:', error);
    }
  };

  const cerrarSesion = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const getProgressColor = (progreso) => {
    if (progreso >= 80) return '#4CAF50';
    if (progreso >= 50) return '#FF9800';
    return '#f44336';
  };

  const getBase64FromUrl = (url) => new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg'));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });

  const descargarPDF = async () => {
    const cl = selectedChecklist.checklist;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageW = doc.internal.pageSize.getWidth();
    let y = 15;

    // ── Cargar imágenes ──
    const [imgLeft, imgRight] = await Promise.all([
      getBase64FromUrl(logoSafemed),
      getBase64FromUrl(logo2)
    ]);

    // ── Encabezado ──
    const headerH = 30;
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageW, headerH, 'F');

    // Logos
    const logoW = 35;
    const logoH = 17;
    const logoY = (headerH - logoH) / 2;
    if (imgLeft)  doc.addImage(imgLeft,  'JPEG', 5, logoY, logoW, logoH);
    if (imgRight) doc.addImage(imgRight, 'JPEG', pageW - logoW - 5, logoY, logoW, logoH);

    // Texto centrado
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('CHECKLIST - SUPERVISOR DE PRODUCCIÓN', pageW / 2, 13, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Sistema de Registros Digitales', pageW / 2, 21, { align: 'center' });

    y = headerH + 7;

    // ── Info del turno ──
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(9);
    const fechaInicio = cl.iniciado_en
      ? new Date(cl.iniciado_en).toLocaleString('es-ES', { timeZone: 'America/Guayaquil', day: '2-digit', month: '2-digit', year: 'numeric' })
      : cl.fecha;
    doc.setFont('helvetica', 'bold');
    doc.text('Supervisor:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(cl.supervisor_nombre || '—', 40, y);
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha:', pageW / 2, y);
    doc.setFont('helvetica', 'normal');
    doc.text(fechaInicio, pageW / 2 + 14, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Turno Nº:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(cl.numero_turno || 1), 40, y);
    
    y += 8;

    // Línea separadora
    doc.setDrawColor(91, 155, 213);
    doc.setLineWidth(0.5);
    doc.line(14, y, pageW - 14, y);
    y += 5;

    // ── Secciones ──
    selectedChecklist.secciones.forEach(seccion => {
      const parentItems = seccion.items.filter(i => !i.parent_item_id);
      const parentIndex = {};
      parentItems.forEach((item, idx) => { parentIndex[item.item_id] = idx + 1; });

      const rows = seccion.items.map(item => {
        const verificacion = item.verificado === 1 ? 'Sí'
          : item.verificado === 0 ? 'No'
          : 'Pendiente';
        const actividad = item.parent_item_id ? `    ↳ ${item.descripcion}` : item.descripcion;
        return [
          parentIndex[item.item_id] ? String(parentIndex[item.item_id]) : '',
          actividad,
          verificacion,
          item.observaciones || '—'
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [
          [{ content: seccion.titulo.toUpperCase(), colSpan: 4, styles: { fillColor: [27, 68, 128], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 9 } }],
          [
            { content: '#', styles: { fillColor: [189, 215, 238], textColor: [26, 26, 26], fontStyle: 'bold', fontSize: 8 } },
            { content: 'Actividad', styles: { fillColor: [189, 215, 238], textColor: [26, 26, 26], fontStyle: 'bold', fontSize: 8 } },
            { content: 'Verificación', styles: { fillColor: [189, 215, 238], textColor: [26, 26, 26], fontStyle: 'bold', halign: 'center', fontSize: 8 } },
            { content: 'Observaciones / Acciones Correctivas', styles: { fillColor: [189, 215, 238], textColor: [26, 26, 26], fontStyle: 'bold', fontSize: 8 } },
          ]
        ],
        body: rows,
        columnStyles: {
          0: { cellWidth: 10, halign: 'center', fontSize: 7 },
          1: { cellWidth: 85, fontSize: 7 },
          2: { cellWidth: 24, halign: 'center', fontSize: 7 },
          3: { fontSize: 7 },
        },
        styles: { overflow: 'linebreak', cellPadding: 2 },
        alternateRowStyles: { fillColor: [245, 250, 255] },
        didParseCell: (data) => {
          if (data.section === 'body') {
            const val = data.cell.raw;
            if (val === 'Sí') { data.cell.styles.textColor = [21, 87, 36]; data.cell.styles.fontStyle = 'bold'; }
            else if (val === 'No') { data.cell.styles.textColor = [114, 28, 36]; data.cell.styles.fontStyle = 'bold'; }
            else if (val === 'Pendiente') { data.cell.styles.textColor = [133, 100, 4]; }
          }
        },
        margin: { left: 14, right: 14 },
      });

      y = doc.lastAutoTable.finalY + 5;
    });

    // ── Observaciones generales ──
    if (cl.observaciones_generales) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      doc.text('Observaciones Generales:', 14, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(cl.observaciones_generales, pageW - 28);
      doc.text(lines, 14, y);
      y += lines.length * 4 + 4;
    }

    // ── Firma / Realizado por ──
    const fechaFin = cl.completado_en
      ? new Date(cl.completado_en).toLocaleString('es-ES', {
          timeZone: 'America/Guayaquil',
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: false
        })
      : '—';

    // Verificar espacio en página
    if (y > 260) { doc.addPage(); y = 20; }

    y += 4;
    doc.setDrawColor(91, 155, 213);
    doc.line(14, y, pageW - 14, y);
    y += 7;

    doc.setFillColor(240, 244, 255);
    doc.roundedRect(14, y - 3, pageW - 28, 20, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(27, 68, 128);
    doc.text('Realizado por:', 20, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(cl.supervisor_nombre || '—', 50, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(27, 68, 128);
    doc.text('Fecha y hora de finalización:', 20, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(fechaFin, 75, y + 12);

    doc.save(`checklist_${cl.supervisor_nombre}_${cl.fecha}.pdf`);
  };

  const formatFecha = (fecha) => {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleString('es-ES');
  };

  const currentList = view === 'active' ? activeChecklists : checklists;

  return (
    <div className="jefe-container">
      <header>
        <div>
          <h1>Panel de Control - Producción</h1>
          <p>Bienvenido, {user?.nombre}</p>
        </div>
        <button onClick={cerrarSesion} className="logout-btn">Cerrar Sesión</button>
      </header>

      <div className="view-tabs">
        <button className={`tab ${view === 'active' ? 'active' : ''}`} onClick={() => setView('active')}>
          Turnos Activos
        </button>
        <button className={`tab ${view === 'history' ? 'active' : ''}`} onClick={() => setView('history')}>
          Historial de Turnos
        </button>
        <button className={`tab ${view === 'indicadores' ? 'active' : ''}`} onClick={() => setView('indicadores')}>
          📊 Indicadores
        </button>
      </div>

      {view === 'indicadores' ? (
        <div className="indicadores-panel">
          {/* ── Cabecera con selector de semana ── */}
          <div className="indicadores-header">
            <div>
              <h2>Indicadores Semanales</h2>
              <p className="indicadores-subtitle">Resumen y desglose de respuestas Sí / No para la semana seleccionada</p>
            </div>
            <div className="week-selector-wrap">
              <label className="week-selector-label" htmlFor="week-input">Semana</label>
              <input
                id="week-input"
                type="week"
                className="week-input"
                value={selectedWeek}
                onChange={handleWeekChange}
              />
              {weeklyData && (
                <span className="week-range-label">
                  {new Date(weeklyData.fecha_inicio + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                  {' — '}
                  {new Date(weeklyData.fecha_fin + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>

          {loadingStats ? (
            <div className="loading">Cargando indicadores...</div>
          ) : !weeklyData ? null : (
            <>
              {/* ── Tarjetas resumen ── */}
              <div className="week-summary-cards">
                <div className="week-card week-card-turnos">
                  <span className="week-card-value">{weeklyData.resumen.total_turnos}</span>
                  <span className="week-card-label">Turnos registrados</span>
                </div>
                <div className="week-card week-card-completados">
                  <span className="week-card-value">{weeklyData.resumen.turnos_completados}</span>
                  <span className="week-card-label">Turnos completados</span>
                </div>
                <div className="week-card week-card-si">
                  <span className="week-card-value">{weeklyData.resumen.total_si}</span>
                  <span className="week-card-label">Total Sí</span>
                </div>
                <div className="week-card week-card-no">
                  <span className="week-card-value">{weeklyData.resumen.total_no}</span>
                  <span className="week-card-label">Total No</span>
                </div>
                <div className="week-card week-card-pendientes">
                  <span className="week-card-value">{weeklyData.resumen.total_pendientes}</span>
                  <span className="week-card-label">Pendientes</span>
                </div>
              </div>

              {/* ── Barra visual global ── 
              {(() => {
                const tot = weeklyData.resumen.total_si + weeklyData.resumen.total_no;
                const pSi = tot > 0 ? Math.round((weeklyData.resumen.total_si / tot) * 100) : 0;
                const pNo = tot > 0 ? Math.round((weeklyData.resumen.total_no / tot) * 100) : 0;
                return tot > 0 ? (
                  <div className="week-global-bar-wrap">
                    <div className="week-global-bar">
                      <div className="ind-bar-si" style={{ width: `${pSi}%` }} title={`Sí: ${pSi}%`} />
                      <div className="ind-bar-no" style={{ width: `${pNo}%` }} title={`No: ${pNo}%`} />
                    </div>
                    <div className="week-global-bar-legend">
                      <span className="wgbl-si">✔ Sí {pSi}%</span>
                      <span className="wgbl-no">✘ No {pNo}%</span>
                    </div>
                  </div>
                ) : null;
              })()}
                */}

              {/* ── Desglose por ítem ── */}
              <div className="ind-desglose-title">Desglose por pregunta</div>
              {weeklyData.secciones.map(seccion => (
                <div key={seccion.titulo} className="ind-seccion">
                  <div className="ind-seccion-titulo">{seccion.titulo.toUpperCase()}</div>
                  {seccion.items.map(item => {
                    const totalLabel = item.total === 0 ? 'Sin datos' : `${item.total} resp.`;
                    return (
                      <div key={item.item_id} className={`ind-item${item.parent_item_id ? ' ind-subitem' : ''}`}>
                        <div className="ind-desc">
                          {item.parent_item_id && <span className="subitem-indent">↳ </span>}
                          {item.descripcion}
                        </div>
                        <div className="ind-stats">
                          <span className="ind-count ind-count-si">{item.total_si} Sí</span>
                          <div className="ind-bar-wrap">
                            <div className="ind-bar">
                              <div className="ind-bar-si" style={{ width: `${item.pct_si}%` }} title={`Sí: ${item.pct_si}%`} />
                              <div className="ind-bar-no" style={{ width: `${item.pct_no}%` }} title={`No: ${item.pct_no}%`} />
                            </div>
                            <span className="ind-total-label">{totalLabel}</span>
                          </div>
                          <span className="ind-count ind-count-no">{item.total_no} No</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
      <div className="dashboard-content">
        <div className="checklists-list">
          {loading ? (
            <div className="loading">Cargando...</div>
          ) : currentList.length === 0 ? (
            <p className="no-data">No hay turnos registrados</p>
          ) : (
            currentList.map(checklist => (
              <div key={checklist.id} className="checklist-card" onClick={() => verDetalle(checklist.id)}>
                <div className="card-header">
                  <strong>{checklist.supervisor_nombre}</strong>
                </div>
                <div className="card-info">
                  <span>Turno {checklist.numero_turno}</span>
                  <span>Inicio: {new Date(checklist.iniciado_en).toLocaleString('es-ES', {timeZone: 'America/Guayaquil'})}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${checklist.progreso}%`, backgroundColor: getProgressColor(checklist.progreso) }} />
                  <span className="progress-text">{checklist.progreso}%</span>
                </div>
                <div className="items-count">
                  {checklist.items_respondidos} / {checklist.total_items} ítems respondidos
                </div>
                {checklist.status === 'completado' && <div className="completed-badge">✅ Completado</div>}
                {checklist.ultima_actividad && checklist.status === 'en_progreso' && (
                  <div className="last-activity">Última actividad: {formatFecha(checklist.ultima_actividad)}</div>
                )}
              </div>
            ))
          )}
        </div>

        {selectedChecklist && (() => {
          const allItems = selectedChecklist.secciones.flatMap(s => s.items);
          const totalItems = allItems.length;
          const countSi = allItems.filter(i => i.verificado === 1).length;
          const countNo = allItems.filter(i => i.verificado === 0).length;
          const respondidos = countSi + countNo;
          const pendientes = totalItems - respondidos;
          const progreso = totalItems > 0 ? Math.round((respondidos / totalItems) * 100) : 0;

          return (
            <div className="checklist-detail">
              <div className="detail-header">
                <div>
                  <h2>Detalle del Turno</h2>
                  <span className="detail-supervisor-name">{selectedChecklist.checklist.supervisor_nombre}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {progreso === 100 && (
                    <button className="btn-descargar-pdf" onClick={descargarPDF}>
                      📄 Descargar PDF
                    </button>
                  )}
                  <button onClick={() => setSelectedChecklist(null)} className="close-btn">✕</button>
                </div>
              </div>

              <div className="detail-info">
                <span><strong>Turno:</strong> {selectedChecklist.checklist.numero_turno || 'N/A'}</span>
                <span><strong>Fecha:</strong> {new Date(selectedChecklist.checklist.iniciado_en).toLocaleString('es-ES', {timeZone: 'America/Guayaquil'})}</span>
                <span><strong>Estado:</strong> {selectedChecklist.checklist.status === 'en_progreso' ? '🟡 En progreso' : '✅ Completado'}</span>
              </div>

              <div className="detail-stats">
                <div className="stat-box">
                  <span className="stat-value">{progreso}%</span>
                  <span className="stat-label">Avance</span>
                </div>
                <div className="stat-box stat-si">
                  <span className="stat-value">{countSi}</span>
                  <span className="stat-label">Sí</span>
                </div>
                <div className="stat-box stat-no">
                  <span className="stat-value">{countNo}</span>
                  <span className="stat-label">No</span>
                </div>
                <div className="stat-box stat-pending">
                  <span className="stat-value">{pendientes}</span>
                  <span className="stat-label">Pendientes</span>
                </div>
                <div className="detail-progress-wrap">
                  <div className="detail-progress-bar">
                    <div className="detail-progress-fill" style={{ width: `${progreso}%`, backgroundColor: getProgressColor(progreso) }} />
                  </div>
                  <span className="detail-progress-label">{respondidos} / {totalItems} ítems respondidos</span>
                </div>
              </div>

              {selectedChecklist.checklist.status === 'en_progreso' && (
                <div className="refresh-note">🔄 Se actualiza automáticamente cada 5 segundos</div>
              )}

              {selectedChecklist.secciones.map(seccion => {
                const parentItems = seccion.items.filter(i => !i.parent_item_id);
                const parentIndex = {};
                parentItems.forEach((item, idx) => { parentIndex[item.item_id] = idx + 1; });

                return (
                  <table key={seccion.titulo} className="detail-table">
                    <thead>
                      <tr>
                        <th colSpan="4" className="detail-section-title">
                          {seccion.titulo.toUpperCase()}
                        </th>
                      </tr>
                      <tr className="detail-col-headers">
                        <th className="detail-col-num">#</th>
                        <th>Actividad</th>
                        <th className="detail-col-estado">Verificación</th>
                        <th>Observaciones / Acciones Correctivas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seccion.items.map(item => (
                        <tr key={item.item_id} className={item.verificado === -1 ? 'row-pending' : ''}>
                          <td className="detail-col-num">{parentIndex[item.item_id] || ''}</td>
                          <td className={item.parent_item_id ? 'subitem-cell' : ''}>
                            {item.parent_item_id && <span className="subitem-indent">↳ </span>}
                            {item.descripcion}
                          </td>
                          <td className="detail-col-estado">
                            {item.verificado === 1 && <span className="badge-si">Sí</span>}
                            {item.verificado === 0 && <span className="badge-no">No</span>}
                            {item.verificado === -1 && <span className="badge-pending">Pendiente</span>}
                          </td>
                          <td className="obs-cell">{item.observaciones || <span className="no-obs">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })}

              {selectedChecklist.checklist.observaciones_generales && (
                <div className="detail-obs-generales">
                  <strong>Observaciones Generales:</strong>
                  <p>{selectedChecklist.checklist.observaciones_generales}</p>
                </div>
              )}
            </div>
          );
        })()}
      </div>
      )}
    </div>
  );
}

export default JefeDashboard;