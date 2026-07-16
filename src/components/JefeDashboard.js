import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoSafemed from '../assets/safemedic.png';
import '../styles/indicadores.css';

function JefeDashboard() {
  const [checklists, setChecklists] = useState([]);
  const [filtroTipoFecha, setFiltroTipoFecha] = useState(() => sessionStorage.getItem("panelFiltroTipoFecha") || "todos");
  const [filtroFechaSeleccionada, setFiltroFechaSeleccionada] = useState(() => sessionStorage.getItem("panelFiltroFecha") || "");
  const [activeChecklists, setActiveChecklists] = useState([]);
  const [selectedChecklist, setSelectedChecklist] = useState(null);
  const [view, setView] = useState('active');
  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [deletingId, setDeletingId] = useState(null); // Para mostrar loading en el botón
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

  const normalizarFecha = (fechaStr) => {
    if (!fechaStr) return "";
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaStr)) {
      const [d, m, y] = fechaStr.split("/");
      return `${y}-${m}-${d}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(fechaStr)) return fechaStr.substring(0, 10);
    const date = new Date(fechaStr);
    if (!isNaN(date)) return date.toISOString().substring(0, 10);
    return fechaStr;
  };

  const getWeekRange = (dateStr) => {
    const date = new Date(dateStr + "T00:00:00");
    const day = date.getDay();
    const diffStart = day === 0 ? -6 : 1 - day;
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() + diffStart);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return { startOfWeek, endOfWeek };
  };
  
  useEffect(() => {
    if (view === 'indicadores') {
      cargarIndicadoresSemanales(selectedWeek);
    } else {
      cargarChecklists();
      const interval = setInterval(cargarChecklists, 50000);
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

  useEffect(() => {
    sessionStorage.setItem("panelFiltroTipoFecha", filtroTipoFecha);
  }, [filtroTipoFecha]);

  useEffect (() => {
    sessionStorage.setItem("panelFiltroFecha", filtroFechaSeleccionada);
  }, [filtroFechaSeleccionada]);

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

  const checklistFiltrados = (r) => {
    if (filtroTipoFecha !== "todos" && filtroFechaSeleccionada) {
      const rawFecha = r.iniciado_en || r.fecha;
      const fechaNorm = normalizarFecha(rawFecha);
      if (filtroTipoFecha === "dia") {
        if (fechaNorm !== filtroFechaSeleccionada) return false;
      } else if (filtroTipoFecha === "semana") {
        const { startOfWeek, endOfWeek } = getWeekRange(filtroFechaSeleccionada);
        const fechaRegistro = new Date(fechaNorm + "T00:00:00");
        if (fechaRegistro < startOfWeek || fechaRegistro > endOfWeek) return false;
      }
    }
    return true;
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

  // =============================================
  // FUNCIÓN PARA ELIMINAR CHECKLIST
  // =============================================
  const eliminarChecklist = async (checklistId, supervisorNombre, event) => {
    event.stopPropagation(); // Evita que se abra el detalle al hacer clic en eliminar
    
    // Confirmación con SweetAlert o confirm nativo
    const confirmacion = window.confirm(
      `¿Estás seguro de que deseas eliminar el checklist de ${supervisorNombre}?\n\n` +
      `Esta acción es IRREVERSIBLE y eliminará:\n` +
      `• El checklist completo\n` +
      `• Todas las respuestas asociadas\n\n` +
      `¿Continuar?`
    );
    
    if (!confirmacion) return;
    
    try {
      setDeletingId(checklistId);
      
      const response = await api.delete(`/jefe/checklists/${checklistId}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        // Mostrar mensaje de éxito
        alert(`✅ Checklist eliminado correctamente\n\n${response.data.message}`);
        
        // Si el checklist eliminado estaba en detalle, cerrar el detalle
        if (selectedChecklist && selectedChecklist.checklist.id === checklistId) {
          setSelectedChecklist(null);
        }
        
        // Recargar la lista actual
        await cargarChecklists();
      }
    } catch (error) {
      console.error('Error eliminando checklist:', error);
      
      let mensajeError = 'Error al eliminar el checklist';
      if (error.response?.data?.error) {
        mensajeError = error.response.data.error;
      }
      
      alert(`❌ Error: ${mensajeError}`);
    } finally {
      setDeletingId(null);
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


  const descargarPDF = async () => {

    const cl = selectedChecklist.checklist;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const mL = 5;
    const mR = 5;
    const useW = pageW - mL - mR;
  

    let logoDataUrl = null;
    try{
      const resp = await fetch(logoSafemed);
      const blob = await resp.blob();
      logoDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error cargando logo para PDF:', error);
    }

    // ---- Colores ----
    const FONDO_PRINCIPAL = [255, 255, 255]; // Blanco
    const BORDE = [0, 0, 0]; // Negro
    const TEXTO_OSCURO = [0, 0, 0]; // Negro

    // eslint-disable-next-line no-unused-vars
    const celda = (x, y, w, h, texto, negrita = false, fondo = null) => {
      if(fondo) {
        doc.setFillColor(...fondo);
        doc.rect(x, y, w, h, 'F');
      }
      doc.setDrawColor(...BORDE);

      doc.setLineWidth(0.3);
      doc.rect(x, y, w, h, 'S');
      doc.setFontSize(9);
      doc.setTextColor(...TEXTO_OSCURO);
      doc.setFont('helvetica', negrita ? 'bold' : 'normal');
      const lineas = doc.splitTextToSize(texto, w - 4);
      doc.text(lineas, x + 3, y + 6);
    };

    let y = mL;

    // Fila 0: TÍTULO ---------------
    const tituloH = 25;

    doc.setFillColor(...FONDO_PRINCIPAL);
    doc.rect(mL, y, useW, tituloH - 4, 'F');
    doc.setDrawColor(...BORDE);
    doc.setLineWidth(0.2);
    doc.rect(mL, y, useW, tituloH - 4, 'S');

    // Imagen de SAFEMED
    const fotoX = mL + 4;
    const fotoY = mL + 2;
    const ancho = 44;
    const alto = 15;

    if(logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', fotoX, fotoY, ancho, alto);
    }

    const tituloX = fotoX + ancho + 15;
    const tituloW = useW - ancho - 80;
    const tituloY = y; // Cambiado de 0 a y para que el título esté en la parte superior
    const tituloAlto = alto;

    doc.setDrawColor(...BORDE);
    doc.setLineWidth(0.2);
    // LINEA IZQUIERDA
    doc.line(tituloX - 10, tituloY , tituloX - 10, tituloY + 21);
    // LINEA DERECHA
    doc.line(tituloX + tituloW + 10, tituloY , tituloX + tituloW + 10, tituloY + 21);

    // TEXTO DEL TÍTULO
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('CHECKLIST - SUPERVISOR DE PRODUCCIÓN', tituloX + (tituloW / 2), tituloY + (tituloAlto / 2) + 4, { align: 'center' });

    // TEXTO DE LA DERECHA
    const textoDerecha = [
      'Código: RG-GPR-38',
      '',
      'Fecha: 08-06-2026',
      '',
      'Versión: 02'
    ];

    // Texto dentro de la celda
    doc.setFontSize(9.2);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');

    const textX = mL + useW - 45; // Ajustado para que el texto esté más cerca del borde derecho
    const textY = y + 6;
    const lineHeight = 3; // Reducido de 5 a 3

    textoDerecha.forEach((linea, index) => {
      doc.text(linea, textX, textY + index * lineHeight, { align: 'left' });
    });

    y += tituloH;

    // ── Info del turno (más compacta) ──
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9); // Reducido de 9 a 8
    const fechaInicio = cl.iniciado_en
      ? new Date(cl.iniciado_en).toLocaleString('es-ES', { timeZone: 'America/Guayaquil', day: '2-digit', month: '2-digit', year: 'numeric' })
      : cl.fecha;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Supervisor:', 14, y + 3);
    doc.setFont('helvetica', 'normal');
    doc.text(cl.supervisor_nombre || '—', 38, y + 3);
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha:', pageW / 2, y + 3);
    doc.setFont('helvetica', 'normal');
    doc.text(fechaInicio, pageW / 2 + 12, y + 3);
    y += 10; // Ajustado para mantener el espaciado correcto
    doc.setFont('helvetica', 'bold');
    doc.text('Turno Nº:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(cl.numero_turno || 1), 38, y);
    
    y += 6; // Reducido de 8 a 6

    // Línea separadora más delgada
    doc.setDrawColor(91, 155, 213);
    doc.setLineWidth(0.3);
    doc.line(14, y, pageW - 14, y);
    y += 4; // Reducido de 5 a 4

    // ── Secciones con autoTable más compacto ──
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
          [{ content: seccion.titulo.toUpperCase(), colSpan: 4, styles: { fillColor: [27, 68, 128], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8 } }],
          [
            { content: '#', styles: { fillColor: [189, 215, 238], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 7, halign: 'center' }},
            { content: 'Actividad', styles: { fillColor: [189, 215, 238], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 7, halign: 'center' }},
            { content: 'Verificación', styles: { fillColor: [189, 215, 238], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', fontSize: 7 }},
            { content: 'Observaciones / Acciones Correctivas', styles: { fillColor: [189, 215, 238], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 7, halign: 'center' }},
          ]
        ],
        body: rows,
        columnStyles: {
          0: { cellWidth: 8, halign: 'center', fontSize: 6, textColor: [0, 0, 0] }, // Reducido de 10 a 8
          1: { cellWidth: 80, fontSize: 6, textColor: [0, 0, 0]  }, // Reducido de 85 a 80
          2: { cellWidth: 18, halign: 'center', fontSize: 6 }, // Reducido de 24 a 18
          3: { fontSize: 5.5, halign: 'center', textColor: [0, 0, 0]  }, // Reducido de 7 a 6
        },
        styles: { overflow: 'linebreak', cellPadding: 1.5 }, // Reducido padding de 2 a 1.5
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

      y = doc.lastAutoTable.finalY + 3; // Reducido de 5 a 3
    });

    // ── Observaciones generales (más compactas) ──
    if (cl.observaciones_generales) {
      // Verificar espacio suficiente
      if (y > pageH - 35) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(40, 40, 40);
      doc.text('Observaciones Generales:', 14, y+ 3);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      const lines = doc.splitTextToSize(cl.observaciones_generales, pageW - 28);
      doc.text(lines, 14, y);
      y += lines.length * 3.5 + 3; // Reducido el espaciado
    }

    // ── Firma / Realizado por (más compacto) ──
    const fechaFin = cl.completado_en
      ? new Date(cl.completado_en).toLocaleString('es-ES', {
          timeZone: 'America/Guayaquil',
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: false
        })
      : '—';

    // Verificar espacio antes de la firma
    if (y > pageH - 30) {
      doc.addPage();
      y = 20;
    }

    y += 3;
    doc.setDrawColor(91, 155, 213);
    doc.line(14, y, pageW - 14, y);
    y += 5;

    doc.setFillColor(240, 244, 255);
    doc.roundedRect(14, y - 2, pageW - 28, 16, 2, 2, 'F'); // Reducido de 20 a 16 de alto
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(27, 68, 128);
    doc.text('Realizado por:', 20, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(cl.supervisor_nombre || '—', 50, y + 4);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(27, 68, 128);
    doc.text('Finalización:', 20, y + 10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(fechaFin, 50, y + 10);

    doc.save(`CheckList_RG-GPR-38_${cl.supervisor_nombre}_${cl.fecha}.pdf`);
  };

  const formatFecha = (fecha) => {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleString('es-ES');
  };

  const currentList = (view === 'active' ? activeChecklists : checklists).filter(checklistFiltrados);

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
        <div></div>
        <div></div>
        <div></div>

      

      {view !== 'indicadores' && <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, minWidth: 0}}>
          {/* ── Fila 2: filtro por fecha (nuevo) ── */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <span style={{ fontSize: "13px", color: "#555", fontWeight: "500" }}>📅 Fecha:</span>
            <div style={{
              display: "flex",
              gap: "4px",
              backgroundColor: "#f5f5f5",
              padding: "4px",
              borderRadius: "8px",
              border: "1px solid #ddd"
            }}>
              {[
                { valor: "todos",  label: "Todos" },
                { valor: "dia",    label: "Día" },
                { valor: "semana", label: "Semana" }
              ].map(op => (
                <button
                  key={op.valor}
                  onClick={() => { setFiltroTipoFecha(op.valor); setFiltroFechaSeleccionada(""); }}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: filtroTipoFecha === op.valor ? "#2563eb" : "#fff",
                    color: filtroTipoFecha === op.valor ? "#fff" : "#333",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: filtroTipoFecha === op.valor ? "600" : "500",
                    transition: "all 0.3s ease",
                    boxShadow: filtroTipoFecha === op.valor ? "0 2px 8px rgba(37,99,235,0.3)" : "none"
                  }}
                >
                  {op.label}
                </button>
              ))}
            </div>

            {filtroTipoFecha !== "todos" && (
              <input
                type="date"
                value={filtroFechaSeleccionada}
                onChange={(e) => setFiltroFechaSeleccionada(e.target.value)}
                style={{
                  padding: "7px 12px",
                  borderRadius: "6px",
                  border: "1px solid #ddd",
                  fontSize: "12px",
                  cursor: "pointer",
                  color: "#333",
                  width: "160px"
                }}
              />
            )}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {filtroTipoFecha === "semana" && filtroFechaSeleccionada && (() => {
              const { startOfWeek, endOfWeek } = getWeekRange(filtroFechaSeleccionada);
              const fmt = (d) => d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
              return (
                <span style={{ fontSize: "12px", color: "#2563eb", fontWeight: "500" }}>
                  {fmt(startOfWeek)} — {fmt(endOfWeek)}
                </span>
              );
            })()}

            {filtroTipoFecha !== "todos" && filtroFechaSeleccionada && (
              <button
                onClick={() => setFiltroFechaSeleccionada("")}
                style={{
                  padding: "5px 10px",
                  borderRadius: "6px",
                  border: "1px solid #ddd",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                  fontSize: "12px",
                  color: "#666"
                }}
              >
                ✕ Limpiar
              </button>
            )}
          </div>
          </div>
        </div>
        }
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
              <div key={checklist.id} className="checklist-card">
                <div className="card-header" onClick={() => verDetalle(checklist.id)} style={{ cursor: 'pointer' }}>
                  <strong>{checklist.supervisor_nombre}</strong>
                </div>
                <div className="card-info" onClick={() => verDetalle(checklist.id)} style={{ cursor: 'pointer' }}>
                  <span>Turno {checklist.numero_turno}</span>
                  <span>Inicio: {new Date(checklist.iniciado_en).toLocaleString('es-ES', {timeZone: 'America/Guayaquil'})}</span>
                </div>
                <div className="progress-bar" onClick={() => verDetalle(checklist.id)} style={{ cursor: 'pointer' }}>
                  <div className="progress-fill" style={{ width: `${checklist.progreso}%`, backgroundColor: getProgressColor(checklist.progreso) }} />
                  <span className="progress-text">{checklist.progreso}%</span>
                </div>
                <div className="items-count" onClick={() => verDetalle(checklist.id)} style={{ cursor: 'pointer' }}>
                  {checklist.items_respondidos} / {checklist.total_items} ítems respondidos
                </div>
                <div className="card-actions">
                  {checklist.status === 'completado' && <div className="completed-badge">✅ Completado</div>}
                  {checklist.ultima_actividad && checklist.status === 'en_progreso' && (
                    <div className="last-activity">Última actividad: {formatFecha(checklist.ultima_actividad)}</div>
                  )}
                  <button
                    onClick={(e) => eliminarChecklist(checklist.id, checklist.supervisor_nombre, e)}
                    className="delete-btn"
                    disabled={deletingId === checklist.id}
                    title="Eliminar checklist"
                  >
                    {deletingId === checklist.id ? '⌛ Eliminando...' : '🗑️ Eliminar'}
                  </button>
                </div>
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