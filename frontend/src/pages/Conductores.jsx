import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  Users, Plus, CheckCircle2, AlertTriangle, XCircle,
  Search, ArrowRight, MapPin, Clock, Bus as BusIcon,
  X, Calendar, AlertCircle, RefreshCw,
} from 'lucide-react';

/* ─ helpers ──────────────────────────────────────────────── */
const getInitials = n => n.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();

/* Los avatares ya no usan colores decorativos: en un sistema neutro
   el color debe significar algo. Se distinguen por tono de gris. */
const AVATAR_TONES = ['var(--n-90)', 'var(--n-100)', 'var(--n-110)', 'var(--n-80)'];
const avatarTone = id => AVATAR_TONES[id % AVATAR_TONES.length];

const HORAS_MAX = 9;

const semaforoInfo = semaforo => {
  switch (semaforo) {
    case 'verde':    return { cls: 'ok',      icon: <CheckCircle2  size={13} />, text: 'Disponible'  };
    case 'amarillo': return { cls: 'warn',    icon: <AlertTriangle size={13} />, text: 'Advertencia' };
    case 'rojo':     return { cls: 'danger',  icon: <XCircle       size={13} />, text: 'Bloqueado'   };
    default:         return { cls: 'neutral', icon: null,                        text: semaforo      };
  }
};

const ESTADO_BADGE = { LISTA: 'ok', EN_CURSO: 'info', COMPLETA: 'ok', ALERTA: 'warn', PROBLEMA: 'danger' };
const estadoBadge = e => <span className={`badge ${ESTADO_BADGE[e] ?? 'neutral'}`}>{e}</span>;

/* ─ Ficha lateral ────────────────────────────────────────── */
function FichaPanel({ persona, posturas, onClose, onAsignar, onDesasignar }) {
  const [tab, setTab] = useState('info');
  const [selPostura, setSelPostura] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const misPosturas = posturas.filter(p =>
    p.tripulacion.some(t => t.persona.id === persona.id)
  );

  const disponibles = posturas.filter(p =>
    p.estado !== 'COMPLETA' &&
    !p.tripulacion.some(t => t.persona.id === persona.id)
  );

  const handleAsignar = async () => {
    if (!selPostura) return;
    setSaving(true);
    setMsg(null);
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
  const horas = parseFloat(persona.horas_hoy);
  const pctHoras = Math.min(100, (horas / HORAS_MAX) * 100);

  return (
    <aside className="slide-panel open" aria-label={`Ficha de ${persona.nombre}`}>
      <div className="slide-panel-header">
        <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
          <span
            className="user-avatar"
            style={{ background: avatarTone(persona.id), width: 40, height: 40 }}
          >
            {getInitials(persona.nombre)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="fw-600 truncate" style={{ fontSize: 15 }}>{persona.nombre}</div>
            <div className="fs-12 text-muted mono">{persona.rut}</div>
          </div>
        </div>
        <button className="btn-icon" onClick={onClose} aria-label="Cerrar ficha">
          <X size={18} />
        </button>
      </div>

      <div className="tabs">
        {[['info', 'Ficha'], ['asignar', 'Asignar postura']].map(([key, label]) => (
          <button
            key={key}
            className={`tab ${tab === key ? 'active' : ''}`}
            onClick={() => { setTab(key); setMsg(null); }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="slide-body">

        {/* ── FICHA ── */}
        {tab === 'info' && (
          <>
            <div className="grid-2 gap-3 mb-4">
              <div className="stat-box">
                <div className="stat-box-label">Estado</div>
                <span className={`badge ${sInfo.cls}`}>{sInfo.icon} {sInfo.text}</span>
              </div>
              <div className="stat-box">
                <div className="stat-box-label">Horas hoy</div>
                <div className="stat-box-value">
                  {horas}h <span className="fs-12 fw-400 text-muted">/ {HORAS_MAX}h</span>
                </div>
                <div className="progress-track mt-2">
                  <div
                    className={`progress-fill ${sInfo.cls === 'neutral' ? 'ok' : sInfo.cls}`}
                    style={{ width: `${pctHoras}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="section-label">Datos del conductor</div>
              <div className="data-list">
                {[['Rol', persona.rol], ['Tipo', persona.tipo], ['RUT', persona.rut]].map(([k, v]) => (
                  <div className="data-row" key={k}>
                    <span className="data-row-key">{k}</span>
                    <span className="data-row-val">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {persona.razon_bloqueo && (
              <div className="info-box danger mb-4">
                <div className="flex items-center gap-2 fw-600 mb-1" style={{ color: 'var(--danger-text)' }}>
                  <AlertTriangle size={14} /> Motivo de bloqueo
                </div>
                <p className="fs-13" style={{ color: 'var(--danger-text)' }}>{persona.razon_bloqueo}</p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="section-label" style={{ marginBottom: 0 }}>
                  Posturas asignadas ({misPosturas.length})
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setTab('asignar')}>
                  <Plus size={13} /> Asignar
                </button>
              </div>

              {misPosturas.length === 0 ? (
                <div className="info-box text-center text-muted">Sin posturas asignadas</div>
              ) : (
                misPosturas.map(p => {
                  const asig = p.tripulacion.find(t => t.persona.id === persona.id);
                  return (
                    <div className="mini-card" key={p.id}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="fw-600 fs-13">{p.codigo}</span>
                        {estadoBadge(p.estado)}
                      </div>
                      <div className="flex items-center gap-2 text-muted fs-12 mb-2">
                        <MapPin size={12} />
                        {p.ruta?.origen?.nombre} → {p.ruta?.destino?.nombre}
                      </div>
                      <div className="flex items-center justify-between fs-12">
                        <span className="flex items-center gap-2 text-muted">
                          <Clock size={12} /> {p.hora_salida?.substring(0, 5)} · {p.fecha}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="badge neutral">{asig?.rol_en_viaje}</span>
                          <button
                            className="btn-icon btn-sm"
                            onClick={() => onDesasignar(p.id, asig?.id)}
                            title="Quitar asignación"
                            aria-label={`Quitar ${persona.nombre} de ${p.codigo}`}
                            style={{ color: 'var(--danger)', width: 24, height: 24 }}
                          >
                            <X size={13} />
                          </button>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ── ASIGNAR ── */}
        {tab === 'asignar' && (
          <>
            <p className="fs-13 text-secondary mb-4">
              Selecciona una postura disponible para <strong>{persona.nombre.split(' ')[0]}</strong>.
            </p>

            <div className="form-group mb-4">
              <label className="form-label" htmlFor="sel-postura">Postura disponible</label>
              <select
                id="sel-postura"
                className="form-input form-select"
                value={selPostura}
                onChange={e => setSelPostura(e.target.value)}
              >
                <option value="">Seleccione una postura…</option>
                {disponibles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} · {p.ruta?.origen?.nombre} → {p.ruta?.destino?.nombre} · {p.hora_salida?.substring(0, 5)}
                  </option>
                ))}
              </select>
            </div>

            {selPostura && (() => {
              const p = disponibles.find(x => x.id === parseInt(selPostura, 10));
              if (!p) return null;
              return (
                <div className="info-box accent mb-4">
                  <div className="fw-600 mb-2" style={{ color: 'var(--accent-hover)' }}>{p.codigo}</div>
                  <div className="flex items-center gap-2 mb-2 fs-13">
                    <MapPin size={13} className="text-accent" />
                    <span className="fw-600">{p.ruta?.origen?.nombre}</span>
                    <ArrowRight size={13} className="text-muted" />
                    <span className="fw-600">{p.ruta?.destino?.nombre}</span>
                  </div>
                  <div className="flex flex-wrap gap-4 fs-12 text-secondary">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {p.fecha}</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {p.hora_salida?.substring(0, 5)} h</span>
                    {p.bus && <span className="flex items-center gap-1"><BusIcon size={12} /> Bus {p.bus.numero}</span>}
                  </div>
                  <div className="mt-3">{estadoBadge(p.estado)}</div>
                </div>
              );
            })()}

            {msg && (
              <div className={`notice ${msg.type === 'ok' ? 'ok' : 'danger'} mb-4`}>
                <div className="notice-content">{msg.text}</div>
              </div>
            )}

            {disponibles.length === 0 ? (
              <div className="info-box text-center text-muted">
                No hay posturas disponibles para asignar
              </div>
            ) : (
              <button
                className="btn btn-primary btn-lg w-full"
                disabled={!selPostura || saving}
                onClick={handleAsignar}
              >
                {saving ? <><span className="spinner" /> Asignando…</> : <><Plus size={15} /> Confirmar asignación</>}
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

/* ─ Página principal ─────────────────────────────────────── */
export default function Conductores() {
  const [personas, setPersonas] = useState([]);
  const [posturas, setPosturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rP, rPo] = await Promise.all([
        axios.get('/api/operaciones/tripulacion/'),
        axios.get('/api/operaciones/posturas/'),
      ]);
      setPersonas(rP.data);
      setPosturas(rPo.data);
    } catch {
      setError('No se pudo cargar la tripulación.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* Escape cierra la ficha. */
  useEffect(() => {
    if (!selected) return;
    const onKeyDown = e => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected]);

  /* Asignar conductor a postura */
  const handleAsignar = async (posturaId, personaId) => {
    await axios.post(`/api/operaciones/posturas/${posturaId}/asignar/`, {
      persona_id: personaId,
      rol_en_viaje: 'CONDUCTOR',
    });
    await fetchAll();
    const r = await axios.get('/api/operaciones/tripulacion/');
    const actualizado = r.data.find(p => p.id === personaId);
    if (actualizado) setSelected(actualizado);
  };

  /* Desasignar — el backend aún no expone el endpoint de borrado
     de una asignación individual (ver operaciones/urls.py). */
  const handleDesasignar = () => {
    alert('La desasignación requiere un endpoint que el backend aún no expone.');
  };

  const personasFiltradas = personas.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.rut.includes(busqueda)
  );

  const disponibles = personas.filter(p => p.semaforo === 'verde').length;
  const enRiesgo    = personas.filter(p => p.semaforo !== 'verde').length;

  return (
    <>
      <div className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Gestión de Tripulación</h1>
          <p className="page-subtitle">Conductores y asistentes — asignación de posturas</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary"><Plus size={15} /> Nuevo personal</button>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-icon-wrap info"><Users size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">{loading || error ? '—' : personas.length}</div>
            <div className="kpi-label">Total personal</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap ok"><CheckCircle2 size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">{loading || error ? '—' : disponibles}</div>
            <div className="kpi-label">Disponibles hoy</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap warn"><AlertTriangle size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">{loading || error ? '—' : enRiesgo}</div>
            <div className="kpi-label">Fatiga / bloqueados</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Listado de tripulación</span>
          <div className="search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar nombre o RUT…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              aria-label="Buscar tripulación"
            />
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {loading && (
            <div className="p-5 flex flex-col gap-3">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="skeleton" style={{ height: 44 }} />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="empty-state">
              <span className="empty-icon"><AlertCircle size={36} strokeWidth={1.5} /></span>
              <div className="empty-title">{error}</div>
              <p className="empty-sub">Revisa que el servidor de Django esté corriendo.</p>
              <button className="btn btn-secondary mt-4" onClick={fetchAll}>
                <RefreshCw size={15} /> Reintentar
              </button>
            </div>
          )}

          {!loading && !error && personasFiltradas.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon"><Users size={36} strokeWidth={1.5} /></span>
              <div className="empty-title">Sin resultados</div>
              <p className="empty-sub">
                {busqueda ? 'Nadie coincide con la búsqueda.' : 'Aún no hay personal registrado.'}
              </p>
            </div>
          )}

          {!loading && !error && personasFiltradas.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Conductor</th>
                    <th>RUT</th>
                    <th>Rol / tipo</th>
                    <th>Horas hoy</th>
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
                        style={isActive ? { background: 'var(--accent-soft)' } : undefined}
                      >
                        <td data-label="Conductor">
                          <div className="flex items-center gap-3">
                            <span
                              className="user-avatar"
                              style={{ background: avatarTone(persona.id), width: 32, height: 32 }}
                            >
                              {getInitials(persona.nombre)}
                            </span>
                            <span className="fw-600">{persona.nombre}</span>
                          </div>
                        </td>
                        <td data-label="RUT"><span className="text-muted mono">{persona.rut}</span></td>
                        <td data-label="Rol / tipo">
                          <div className="fw-500">{persona.rol}</div>
                          <div className="fs-12 text-muted">{persona.tipo}</div>
                        </td>
                        <td data-label="Horas hoy">
                          <span className="fw-600">{parseFloat(persona.horas_hoy)}h</span>
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
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={e => { e.stopPropagation(); setSelected(isActive ? null : persona); }}
                          >
                            {isActive ? 'Cerrar' : <>Ver ficha <ArrowRight size={14} /></>}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Ficha lateral — en teléfono se comporta como hoja inferior.
          Va en un portal a <body> porque un `position: fixed` se posiciona
          respecto al ancestro más cercano que tenga transform, filter o
          perspective, no respecto al viewport. Sacándolo del árbol de la
          página, ningún estilo de contenido puede descolocarlo.
          La `key` remonta el panel al cambiar de conductor, así vuelve
          solo a su pestaña inicial sin necesidad de un efecto. */}
      {selected && createPortal(
        <>
          <div className="mobile-panel-overlay" onClick={() => setSelected(null)} aria-hidden="true" />
          <FichaPanel
            key={selected.id}
            persona={selected}
            posturas={posturas}
            onClose={() => setSelected(null)}
            onAsignar={handleAsignar}
            onDesasignar={handleDesasignar}
          />
        </>,
        document.body,
      )}
    </>
  );
}
