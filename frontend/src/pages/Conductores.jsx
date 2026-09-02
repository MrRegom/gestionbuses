import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Users, Plus, CheckCircle, AlertTriangle, XCircle,
  Search, ArrowRight, MapPin, Clock, Bus as BusIcon,
  X, Calendar, ChevronDown
} from 'lucide-react';

/* ─ helpers ──────────────────────────────────────────────── */
const getInitials  = n => n.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
const avatarColors = ['#1D4ED8','#6D28D9','#047857','#B45309','#BE185D','#0369A1','#7C3AED'];
const avatarColor  = id => avatarColors[id % avatarColors.length];

const semaforoInfo = (semaforo) => {
  switch (semaforo) {
    case 'verde':    return { cls: 'ok',      icon: <CheckCircle  size={14} />, text: 'Disponible'  };
    case 'amarillo': return { cls: 'warn',    icon: <AlertTriangle size={14} />, text: 'Advertencia' };
    case 'rojo':     return { cls: 'danger',  icon: <XCircle      size={14} />, text: 'Bloqueado'   };
    default:         return { cls: 'neutral', icon: null,                        text: semaforo      };
  }
};

const estadoBadge = e => {
  const m = { LISTA:'ok', EN_CURSO:'info', COMPLETA:'ok', ALERTA:'warn', PROBLEMA:'danger' };
  return <span className={`badge ${m[e] || 'neutral'}`}>{e}</span>;
};

/* ─ Ficha lateral (slide panel) ─────────────────────────── */
function FichaPanel({ persona, posturas, onClose, onAsignar, onDesasignar }) {
  const [tab, setTab]           = useState('info');   // 'info' | 'asignar'
  const [selPostura, setSelPostura] = useState('');
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState(null);

  if (!persona) return null;

  // Posturas ya asignadas a este conductor
  const misPosturas = posturas.filter(p =>
    p.tripulacion.some(t => t.persona.id === persona.id)
  );

  // Posturas disponibles (no asignadas a este conductor y que tienen cupo)
  const disponibles = posturas.filter(p =>
    p.estado !== 'COMPLETA' &&
    !p.tripulacion.some(t => t.persona.id === persona.id)
  );

  const handleAsignar = async () => {
    if (!selPostura) return;
    setSaving(true); setMsg(null);
    try {
      await onAsignar(selPostura, persona.id);
      setMsg({ type: 'ok', text: 'Postura asignada correctamente.' });
      setSelPostura('');
      setTab('info');
    } catch {
      setMsg({ type: 'err', text: 'Error al asignar. Intente de nuevo.' });
    }
    setSaving(false);
  };

  const sInfo = semaforoInfo(persona.semaforo);

  return (
    <div className="slide-panel open" style={{ width: '400px' }}>
      {/* Header */}
      <div className="slide-panel-header">
        <div className="flex items-center gap-3">
          <div className="user-avatar" style={{ background: avatarColor(persona.id), width: '40px', height: '40px', flexShrink: 0 }}>
            {getInitials(persona.nombre)}
          </div>
          <div>
            <div className="fw-700" style={{ fontSize: '15px', color: 'var(--text-primary)' }}>{persona.nombre}</div>
            <div className="fs-11 text-muted" style={{ fontFamily: 'monospace' }}>{persona.rut}</div>
          </div>
        </div>
        <button className="btn-icon" onClick={onClose}><X size={18} /></button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-white)' }}>
        {[['info','Ficha'],['asignar','Asignar Postura']].map(([key,label]) => (
          <button
            key={key}
            onClick={() => { setTab(key); setMsg(null); }}
            style={{
              flex: 1, padding: '10px 0', fontSize: '13px', fontWeight: tab === key ? 700 : 500,
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: tab === key ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === key ? 'var(--accent)' : 'var(--text-muted)',
              transition: 'all 0.15s'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

        {/* ── TAB FICHA ── */}
        {tab === 'info' && (
          <>
            {/* Estado + Horas */}
            <div className="grid-2 gap-3 mb-4">
              <div style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '12px' }}>
                <div className="fs-11 text-muted fw-600 mb-1" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>Estado</div>
                <span className={`badge ${sInfo.cls}`} style={{ fontSize: '12px' }}>{sInfo.icon} {sInfo.text}</span>
              </div>
              <div style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '12px' }}>
                <div className="fs-11 text-muted fw-600 mb-1" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>Horas hoy</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {parseFloat(persona.horas_hoy)}h
                  <span className="fs-12 text-muted fw-400"> / 9h máx</span>
                </div>
              </div>
            </div>

            {/* Datos */}
            <div className="mb-4">
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Datos del Conductor</div>
              {[
                ['Rol',  persona.rol],
                ['Tipo', persona.tipo],
                ['RUT',  persona.rut],
              ].map(([k,v]) => (
                <div key={k} className="flex justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                  <span className="text-muted">{k}</span>
                  <span className="fw-600">{v}</span>
                </div>
              ))}
            </div>

            {/* Motivo bloqueo */}
            {persona.razon_bloqueo && (
              <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--r-lg)', padding: '12px', marginBottom: '16px' }}>
                <div className="flex items-center gap-2 fw-700 mb-1" style={{ color: 'var(--danger-text)', fontSize: '12px' }}>
                  <AlertTriangle size={14} /> Motivo de bloqueo
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--danger-text)' }}>{persona.razon_bloqueo}</p>
              </div>
            )}

            {/* Posturas asignadas */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Posturas Asignadas ({misPosturas.length})
                </div>
                <button className="btn btn-primary" style={{ fontSize: '12px', padding: '5px 12px' }}
                  onClick={() => setTab('asignar')}>
                  <Plus size={13} /> Nueva
                </button>
              </div>

              {misPosturas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', background: 'var(--bg-muted)', borderRadius: 'var(--r-lg)', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Sin posturas asignadas hoy
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {misPosturas.map(p => {
                    const asig = p.tripulacion.find(t => t.persona.id === persona.id);
                    return (
                      <div key={p.id} style={{ background: 'var(--bg-white)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)', borderRadius: 'var(--r-lg)', padding: '12px' }}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="fw-700" style={{ fontSize: '13px' }}>{p.codigo}</span>
                          {estadoBadge(p.estado)}
                        </div>
                        <div className="flex items-center gap-2 text-muted" style={{ fontSize: '12px', marginBottom: '4px' }}>
                          <MapPin size={12} />
                          {p.ruta?.origen?.nombre} → {p.ruta?.destino?.nombre}
                        </div>
                        <div className="flex items-center justify-between" style={{ fontSize: '12px' }}>
                          <div className="flex items-center gap-2 text-muted">
                            <Clock size={12} /> {p.hora_salida?.substring(0,5)} hrs — {p.fecha}
                          </div>
                          <div className="flex items-center gap-2 text-muted">
                            <span className="badge neutral" style={{ fontSize: '10px' }}>{asig?.rol_en_viaje}</span>
                            <button
                              onClick={() => onDesasignar(p.id, asig?.id)}
                              title="Quitar asignación"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0 }}>
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── TAB ASIGNAR ── */}
        {tab === 'asignar' && (
          <>
            <div className="mb-4">
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Selecciona una postura disponible para asignar a <strong>{persona.nombre.split(' ')[0]}</strong>.
              </div>

              <label className="form-label">Postura disponible</label>
              <div style={{ position: 'relative' }}>
                <select
                  className="form-input form-select"
                  value={selPostura}
                  onChange={e => setSelPostura(e.target.value)}
                  style={{ width: '100%', paddingRight: '36px' }}
                >
                  <option value="">Seleccione una postura...</option>
                  {disponibles.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.codigo} | {p.ruta?.origen?.nombre} → {p.ruta?.destino?.nombre} | {p.hora_salida?.substring(0,5)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Detalle de la postura seleccionada */}
            {selPostura && (() => {
              const p = disponibles.find(x => x.id === parseInt(selPostura));
              if (!p) return null;
              return (
                <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: 'var(--r-lg)', padding: '14px', marginBottom: '16px' }}>
                  <div className="fw-700 mb-2" style={{ fontSize: '14px', color: 'var(--accent)' }}>{p.codigo}</div>
                  <div className="flex items-center gap-2 mb-1" style={{ fontSize: '13px' }}>
                    <MapPin size={13} style={{ color: 'var(--accent)' }} />
                    <span className="fw-600">{p.ruta?.origen?.nombre}</span>
                    <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
                    <span className="fw-600">{p.ruta?.destino?.nombre}</span>
                  </div>
                  <div className="flex items-center gap-4" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div className="flex items-center gap-1"><Calendar size={12} /> {p.fecha}</div>
                    <div className="flex items-center gap-1"><Clock size={12} /> {p.hora_salida?.substring(0,5)} hrs</div>
                    {p.bus && <div className="flex items-center gap-1"><BusIcon size={12} /> Bus {p.bus.numero}</div>}
                  </div>
                  <div className="mt-2">{estadoBadge(p.estado)}</div>
                </div>
              );
            })()}

            {msg && (
              <div style={{
                padding: '10px 14px', borderRadius: 'var(--r-md)', marginBottom: '12px',
                background: msg.type === 'ok' ? 'var(--ok-bg)' : 'var(--danger-bg)',
                border: `1px solid ${msg.type === 'ok' ? 'var(--ok-border)' : 'var(--danger-border)'}`,
                color: msg.type === 'ok' ? 'var(--ok-text)' : 'var(--danger-text)',
                fontSize: '13px'
              }}>
                {msg.text}
              </div>
            )}

            <button
              className="btn btn-primary w-full"
              disabled={!selPostura || saving}
              onClick={handleAsignar}
              style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
            >
              {saving ? 'Asignando...' : <><Plus size={15} /> Confirmar Asignación</>}
            </button>

            {disponibles.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px', background: 'var(--bg-muted)', borderRadius: 'var(--r-lg)', color: 'var(--text-muted)', fontSize: '13px', marginTop: '16px' }}>
                No hay posturas disponibles para asignar
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─ Página principal ─────────────────────────────────────── */
export default function Conductores() {
  const [personas,  setPersonas]  = useState([]);
  const [posturas,  setPosturas]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [selected,  setSelected]  = useState(null);  // persona activa en ficha
  const [busqueda,  setBusqueda]  = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rP, rPo] = await Promise.all([
        axios.get('/api/operaciones/tripulacion/'),
        axios.get('/api/operaciones/posturas/'),
      ]);
      setPersonas(rP.data);
      setPosturas(rPo.data);
    } catch {
      setError('Error al cargar los datos.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* Asignar conductor a postura */
  const handleAsignar = async (posturaId, personaId) => {
    await axios.post(`/api/operaciones/posturas/${posturaId}/asignar/`, {
      persona_id: personaId,
      rol_en_viaje: 'CONDUCTOR',
    });
    await fetchAll();
    // Refrescar el persona seleccionado con datos actualizados
    const r = await axios.get('/api/operaciones/tripulacion/');
    const actualizado = r.data.find(p => p.id === personaId);
    if (actualizado) setSelected(actualizado);
  };

  /* Desasignar (eliminar asignación) */
  const handleDesasignar = async (posturaId, asignacionId) => {
    if (!asignacionId) return;
    // No hay endpoint de delete para asignación individual en el backend aún.
    // Por ahora lo documentamos como pendiente.
    alert('Funcionalidad de desasignación en desarrollo.');
  };

  /* Filtro búsqueda */
  const personasFiltradas = personas.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.rut.includes(busqueda)
  );

  const disponibles = personas.filter(p => p.semaforo === 'verde').length;
  const enRiesgo    = personas.filter(p => p.semaforo !== 'verde').length;

  if (loading) return <div className="page-content fade-in">Cargando tripulación...</div>;
  if (error)   return <div className="page-content fade-in" style={{ color: 'var(--danger)' }}>{error}</div>;

  return (
    <div style={{ display: 'flex', gap: 0, minHeight: '100%', position: 'relative' }}>
      {/* Columna principal */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="page-content">

          {/* Encabezado */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '2px' }}>Gestión de Tripulación</h1>
              <div className="fs-12 text-muted">Conductores y asistentes — asignación de posturas</div>
            </div>
            <button className="btn btn-primary"><Plus size={16} /> Nuevo Personal</button>
          </div>

          {/* KPIs */}
          <div className="kpi-row mb-5">
            <div className="kpi-card">
              <div className="kpi-icon-wrap info"><Users size={20} /></div>
              <div className="kpi-body">
                <div className="kpi-value">{personas.length}</div>
                <div className="kpi-label">Total Personal</div>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon-wrap ok"><CheckCircle size={20} /></div>
              <div className="kpi-body">
                <div className="kpi-value" style={{ color: 'var(--ok)' }}>{disponibles}</div>
                <div className="kpi-label">Disponibles Hoy</div>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon-wrap warn"><AlertTriangle size={20} /></div>
              <div className="kpi-body">
                <div className="kpi-value" style={{ color: 'var(--warn)' }}>{enRiesgo}</div>
                <div className="kpi-label">Fatiga / Bloqueados</div>
              </div>
            </div>
          </div>

          {/* Tabla */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Listado de Tripulación</span>
              <div className="search-box">
                <Search size={14} className="text-muted" />
                <input
                  type="text"
                  placeholder="Buscar nombre o RUT..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  style={{ width: '200px' }}
                />
              </div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Conductor</th>
                      <th>RUT</th>
                      <th>Rol / Tipo</th>
                      <th>Horas Hoy</th>
                      <th>Estado</th>
                      <th>Posturas</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personasFiltradas.map(persona => {
                      const sInfo = semaforoInfo(persona.semaforo);
                      const nPosturas = posturas.filter(p =>
                        p.tripulacion.some(t => t.persona.id === persona.id)
                      ).length;
                      const isActive = selected?.id === persona.id;

                      return (
                        <tr
                          key={persona.id}
                          onClick={() => setSelected(isActive ? null : persona)}
                          className="clickable"
                          style={{ background: isActive ? 'var(--accent-soft)' : undefined }}
                        >
                          <td data-label="Conductor">
                            <div className="flex items-center gap-3">
                              <div className="user-avatar" style={{ background: avatarColor(persona.id), width: '36px', height: '36px' }}>
                                {getInitials(persona.nombre)}
                              </div>
                              <span className="fw-700">{persona.nombre}</span>
                            </div>
                          </td>
                          <td data-label="RUT">
                            <span className="text-muted" style={{ fontFamily: 'monospace' }}>{persona.rut}</span>
                          </td>
                          <td data-label="Rol/Tipo">
                            <div className="fw-600">{persona.rol}</div>
                            <div className="fs-11 text-muted">{persona.tipo}</div>
                          </td>
                          <td data-label="Horas Hoy">
                            <span className="fw-700">{parseFloat(persona.horas_hoy)}h</span>
                          </td>
                          <td data-label="Estado">
                            <span className={`badge ${sInfo.cls}`}>{sInfo.icon} {sInfo.text}</span>
                          </td>
                          <td data-label="Posturas">
                            <span className={`badge ${nPosturas > 0 ? 'accent' : 'neutral'}`}>
                              {nPosturas} asignada{nPosturas !== 1 ? 's' : ''}
                            </span>
                          </td>
                          <td data-label="Acción">
                            <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setSelected(isActive ? null : persona); }}>
                              {isActive ? 'Cerrar' : <>Ver ficha <ArrowRight size={14} /></>}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Panel de ficha lateral (slide-in) */}
      {selected && (
        <>
          {/* Overlay para cerrar en mobile */}
          <div
            onClick={() => setSelected(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
              zIndex: 300, display: 'none'
            }}
            className="mobile-panel-overlay"
          />
          <FichaPanel
            persona={selected}
            posturas={posturas}
            onClose={() => setSelected(null)}
            onAsignar={handleAsignar}
            onDesasignar={handleDesasignar}
          />
        </>
      )}
    </div>
  );
}
