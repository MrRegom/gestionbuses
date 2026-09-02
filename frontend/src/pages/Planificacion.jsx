import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from '../api';
import {
  Plus, Search, MapPin, Clock, Edit, Trash2, X, Users,
  CalendarClock, AlertCircle, RefreshCw, Bus as BusIcon, UserPlus, Check,
} from 'lucide-react';

const ESTADO_BADGE = {
  LISTA: 'ok', EN_CURSO: 'info', COMPLETA: 'ok', ALERTA: 'warn', PROBLEMA: 'danger',
};
const ESTADO_LABEL = {
  LISTA: 'Lista', EN_CURSO: 'En curso', COMPLETA: 'Completa',
  ALERTA: 'Alerta', PROBLEMA: 'Problema',
};
const ESTADOS = Object.entries(ESTADO_LABEL);

const FORM_VACIO = { codigo: '', ruta_id: '', fecha: '', hora_salida: '', estado: 'LISTA' };

/* ─────────────────────────────────────────────────────────────
   Panel de la postura: bus y tripulación.

   Refleja el proceso real: creada la postura con su código, se
   revisa el personal disponible y se le asigna la tripulación.
   ───────────────────────────────────────────────────────────── */
function PanelPostura({ postura, buses, onCerrar, onCambio }) {
  const [disponibles, setDisponibles] = useState([]);
  const [dotacion, setDotacion] = useState({ CONDUCTOR: 0, ASISTENTE: 0 });
  const [faltantes, setFaltantes] = useState({ CONDUCTOR: 2, ASISTENTE: 1 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [rolNuevo, setRolNuevo] = useState('CONDUCTOR');
  // Si el rol elegido ya está cubierto, se ofrece el que falta.
  const rolEfectivo = faltantes[rolNuevo] > 0
    ? rolNuevo
    : (faltantes.CONDUCTOR > 0 ? 'CONDUCTOR' : (faltantes.ASISTENTE > 0 ? 'ASISTENTE' : null));

  const cargarDisponibles = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await axios.get(`/api/operaciones/posturas/${postura.id}/disponibles/`);
      setDisponibles(data.personal);
      setDotacion(data.dotacion);
      setFaltantes(data.faltantes);
    } catch {
      setError('No se pudo cargar el personal disponible.');
    }
    setCargando(false);
  }, [postura.id]);

  useEffect(() => { cargarDisponibles(); }, [cargarDisponibles]);

  const accion = async fn => {
    setError(null);
    try {
      await fn();
      await onCambio();
      await cargarDisponibles();
    } catch (err) {
      setError(err.response?.data?.error ?? 'No se pudo completar la acción.');
    }
  };

  const asignarBus = busId => accion(() =>
    axios.post(`/api/operaciones/posturas/${postura.id}/bus/`, { bus_id: busId || null }));

  const asignarPersona = personaId => accion(() =>
    axios.post(`/api/operaciones/posturas/${postura.id}/asignar/`, {
      persona_id: personaId, rol_en_viaje: rolEfectivo,
    }));

  const quitarPersona = asignacionId => accion(() =>
    axios.delete(`/api/operaciones/asignaciones/${asignacionId}/`));

  // Solo se ofrece a quien puede ocupar el puesto que falta: un
  // asistente no va al volante ni un conductor de asistente.
  const libres = disponibles.filter(
    d => d.disponible && (!rolEfectivo || d.persona.rol === rolEfectivo)
  );
  const ocupados = disponibles.filter(d => !d.disponible && d.motivo !== 'Ya asignado a esta postura');

  return createPortal(
    <>
      <div className="mobile-panel-overlay" onClick={onCerrar} aria-hidden="true" />
      <aside className="slide-panel open" aria-label={`Postura ${postura.codigo}`}>
        <div className="slide-panel-header">
          <div style={{ minWidth: 0 }}>
            <div className="fw-600 mono" style={{ fontSize: 16 }}>{postura.codigo}</div>
            <div className="fs-12 text-muted truncate">
              {postura.ruta?.origen?.nombre} → {postura.ruta?.destino?.nombre} ·{' '}
              {postura.hora_salida?.substring(0, 5)}
            </div>
          </div>
          <button className="btn-icon" onClick={onCerrar} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="slide-body">
          {error && (
            <div className="notice danger mb-4">
              <AlertCircle size={16} className="notice-icon" />
              <div className="notice-content">{error}</div>
            </div>
          )}

          {/* ── Bus ── */}
          <div className="section-label">Bus asignado</div>
          <div className="form-group mb-5">
            <select
              className="form-input form-select"
              value={postura.bus?.id ?? ''}
              onChange={e => asignarBus(e.target.value)}
              aria-label="Bus de la postura"
            >
              <option value="">Sin bus asignado</option>
              {buses.map(b => (
                <option
                  key={b.id} value={b.id}
                  disabled={['MANTENIMIENTO', 'FUERA_SERVICIO'].includes(b.estado) && b.id !== postura.bus?.id}
                >
                  {b.numero} · {b.patente}
                  {['MANTENIMIENTO', 'FUERA_SERVICIO'].includes(b.estado) ? ' (en taller)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* ── Tripulación asignada ── */}
          <div className="section-label">Tripulación</div>
          <div className="grid-2 gap-3 mb-3">
            <div className="stat-box">
              <div className="stat-box-label">Conductores</div>
              <div className="stat-box-value">
                {dotacion.CONDUCTOR}<span className="fs-12 fw-400 text-muted"> / 2</span>
              </div>
            </div>
            <div className="stat-box">
              <div className="stat-box-label">Asistente</div>
              <div className="stat-box-value">
                {dotacion.ASISTENTE}<span className="fs-12 fw-400 text-muted"> / 1</span>
              </div>
            </div>
          </div>

          {!rolEfectivo ? (
            <div className="notice ok mb-4">
              <Check size={16} className="notice-icon" />
              <div className="notice-content">Tripulación completa.</div>
            </div>
          ) : (
            <div className="notice warn mb-4">
              <AlertCircle size={16} className="notice-icon" />
              <div className="notice-content">
                Faltan{' '}
                {[
                  faltantes.CONDUCTOR > 0 && `${faltantes.CONDUCTOR} conductor(es)`,
                  faltantes.ASISTENTE > 0 && `${faltantes.ASISTENTE} asistente`,
                ].filter(Boolean).join(' y ')}.
              </div>
            </div>
          )}
          {postura.tripulacion.length === 0 ? (
            <div className="info-box text-center text-muted mb-5">Sin tripulación asignada</div>
          ) : (
            <div className="mb-5">
              {postura.tripulacion.map(t => (
                <div className="mini-card" key={t.id}>
                  <div className="flex items-center justify-between">
                    <div style={{ minWidth: 0 }}>
                      <div className="fw-600 fs-13 truncate">{t.persona.nombre}</div>
                      <div className="fs-12 text-muted mono">{t.persona.rut}</div>
                    </div>
                    <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                      <span className="badge neutral">{t.rol_en_viaje}</span>
                      <button
                        className="btn-icon"
                        style={{ color: 'var(--danger)', width: 28, height: 28 }}
                        onClick={() => quitarPersona(t.id)}
                        title="Quitar de la postura"
                        aria-label={`Quitar a ${t.persona.nombre}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Personal disponible ── */}
          <div className="flex items-center justify-between mb-3">
            <div className="section-label" style={{ marginBottom: 0 }}>
              Personal disponible ({libres.length})
            </div>
            <select
              className="form-input form-select btn-sm"
              style={{ width: 'auto', height: 28, fontSize: 12, padding: '0 28px 0 8px' }}
              value={rolEfectivo ?? ''}
              onChange={e => setRolNuevo(e.target.value)}
              disabled={!rolEfectivo}
              aria-label="Rol en el viaje"
            >
              {faltantes.CONDUCTOR > 0 && <option value="CONDUCTOR">Conductor</option>}
              {faltantes.ASISTENTE > 0 && <option value="ASISTENTE">Asistente</option>}
              {!rolEfectivo && <option value="">Completa</option>}
            </select>
          </div>

          {cargando && <div className="skeleton" style={{ height: 44 }} />}

          {!cargando && libres.length === 0 && (
            <div className="info-box text-center text-muted">
              Nadie libre para esta fecha
            </div>
          )}

          {!cargando && libres.map(({ persona }) => (
            <div className="mini-card" key={persona.id} style={{ borderLeftColor: 'var(--ok)' }}>
              <div className="flex items-center justify-between">
                <div style={{ minWidth: 0 }}>
                  <div className="fw-600 fs-13 truncate">{persona.nombre}</div>
                  <div className="fs-12 text-muted">
                    {persona.rol} · {parseFloat(persona.horas_hoy)}h hoy
                  </div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => asignarPersona(persona.id)}
                  disabled={!rolEfectivo}
                  title={rolEfectivo ? `Asignar como ${rolEfectivo.toLowerCase()}` : 'Tripulación completa'}
                >
                  <UserPlus size={13} /> Asignar
                </button>
              </div>
            </div>
          ))}

          {/* ── No disponibles, con el motivo ── */}
          {!cargando && ocupados.length > 0 && (
            <>
              <div className="section-label mt-5">No disponibles ({ocupados.length})</div>
              {ocupados.map(({ persona, motivo }) => (
                <div className="data-row" key={persona.id}>
                  <span className="data-row-key">{persona.nombre}</span>
                  <span className="data-row-val fs-12 text-muted">{motivo}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </aside>
    </>,
    document.body,
  );
}

/* ─────────────────────────────────────────────────────────────
   Página
   ───────────────────────────────────────────────────────────── */
export default function Planificacion() {
  const [posturas, setPosturas] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const [seleccionada, setSeleccionada] = useState(null);
  const [modal, setModal] = useState(null);        // null | 'crear' | 'editar'
  const [form, setForm] = useState(FORM_VACIO);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rPos, rRutas, rBuses] = await Promise.all([
        axios.get('/api/operaciones/posturas/'),
        axios.get('/api/operaciones/rutas/'),
        axios.get('/api/flota/buses/'),
      ]);
      setPosturas(rPos.data);
      setRutas(rRutas.data);
      setBuses(rBuses.data);
      // Mantiene el panel sincronizado tras una asignación.
      setSeleccionada(prev => prev ? rPos.data.find(p => p.id === prev.id) ?? null : null);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar las posturas.');
    }
    setLoading(false);
  }, []);

  const cerrarModal = useCallback(() => { setModal(null); setFormError(null); }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!modal) return;
    const onKey = e => { if (e.key === 'Escape') cerrarModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, cerrarModal]);

  useEffect(() => {
    document.body.classList.toggle('no-scroll', Boolean(modal));
    return () => document.body.classList.remove('no-scroll');
  }, [modal]);

  const abrirCrear = () => {
    setForm(FORM_VACIO);
    setFormError(null);
    setModal('crear');
  };

  const abrirEditar = postura => {
    setForm({
      codigo: postura.codigo,
      ruta_id: postura.ruta?.id ?? '',
      fecha: postura.fecha,
      hora_salida: postura.hora_salida?.substring(0, 5) ?? '',
      estado: postura.estado,
    });
    setFormError(null);
    setModal({ tipo: 'editar', id: postura.id });
  };

  const guardar = async e => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (modal === 'crear') {
        await axios.post('/api/operaciones/posturas/', form);
      } else {
        await axios.put(`/api/operaciones/posturas/${modal.id}/`, form);
      }
      cerrarModal();
      await fetchData();
    } catch (err) {
      const data = err.response?.data;
      setFormError(
        data?.error ??
        (data?.codigo ? `Código: ${data.codigo.join(' ')}` : null) ??
        'No se pudo guardar la postura.'
      );
    }
    setSaving(false);
  };

  const eliminar = async postura => {
    if (!window.confirm(`¿Eliminar la postura ${postura.codigo}? La acción no se puede deshacer.`)) return;
    try {
      await axios.delete(`/api/operaciones/posturas/${postura.id}/`);
      if (seleccionada?.id === postura.id) setSeleccionada(null);
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.error ?? 'No se pudo eliminar la postura.');
    }
  };

  const filtradas = posturas.filter(p => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    const ruta = `${p.ruta?.origen?.nombre ?? ''} ${p.ruta?.destino?.nombre ?? ''}`.toLowerCase();
    return p.codigo.toLowerCase().includes(q) || ruta.includes(q);
  });

  const sinBus = posturas.filter(p => !p.bus).length;
  const dotacionIncompleta = posturas.filter(p => !p.dotacion_completa).length;

  return (
    <>
      <div className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Planificación de Posturas</h1>
          <p className="page-subtitle">Gestión de viajes y asignación de recursos</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={abrirCrear}>
            <Plus size={15} /> Nueva postura
          </button>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-icon-wrap info"><CalendarClock size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">{loading || error ? '—' : posturas.length}</div>
            <div className="kpi-label">Posturas</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap warn"><BusIcon size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">{loading || error ? '—' : sinBus}</div>
            <div className="kpi-label">Sin bus</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap danger"><Users size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">{loading || error ? '—' : dotacionIncompleta}</div>
            <div className="kpi-label">Dotación incompleta</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Posturas programadas</span>
          <div className="search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar código o ruta…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              aria-label="Buscar posturas"
            />
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {loading && (
            <div className="p-5 flex flex-col gap-3">
              {[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 44 }} />)}
            </div>
          )}

          {!loading && error && (
            <div className="empty-state">
              <span className="empty-icon"><AlertCircle size={36} strokeWidth={1.5} /></span>
              <div className="empty-title">{error}</div>
              <button className="btn btn-secondary mt-4" onClick={fetchData}>
                <RefreshCw size={15} /> Reintentar
              </button>
            </div>
          )}

          {!loading && !error && filtradas.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon"><CalendarClock size={36} strokeWidth={1.5} /></span>
              <div className="empty-title">Sin posturas</div>
              <p className="empty-sub">
                {busqueda ? 'Ninguna postura coincide con la búsqueda.' : 'Crea la primera postura para comenzar.'}
              </p>
            </div>
          )}

          {!loading && !error && filtradas.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Ruta</th>
                    <th>Salida</th>
                    <th>Bus</th>
                    <th>Tripulación</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map(p => (
                    <tr
                      key={p.id}
                      className="clickable"
                      onClick={() => setSeleccionada(p)}
                      style={seleccionada?.id === p.id ? { background: 'var(--accent-soft)' } : undefined}
                    >
                      <td data-label="Código"><span className="fw-600 mono">{p.codigo}</span></td>
                      <td data-label="Ruta">
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-muted" />
                          <span>
                            {p.ruta?.origen?.nombre} <span className="text-muted">→</span> {p.ruta?.destino?.nombre}
                          </span>
                        </div>
                      </td>
                      <td data-label="Salida">
                        <div className="flex items-center gap-2">
                          <Clock size={14} className="text-muted" />
                          <span className="text-muted">{p.fecha}</span>
                          <span className="fw-600">{p.hora_salida.substring(0, 5)}</span>
                        </div>
                      </td>
                      <td data-label="Bus">
                        {p.bus
                          ? <span className="badge navy">{p.bus.numero}</span>
                          : <span className="badge warn">Sin asignar</span>}
                      </td>
                      <td data-label="Tripulación">
                        {p.tripulacion.length > 0 ? (
                          <div className="flex items-center gap-2">
                          <div className="crew-avatars">
                            {p.tripulacion.slice(0, 3).map(t => (
                              <span
                                key={t.id} className="crew-avatar"
                                style={{ background: 'var(--n-90)' }}
                                title={`${t.persona.nombre} (${t.rol_en_viaje})`}
                              >
                                {t.persona.nombre.substring(0, 2).toUpperCase()}
                              </span>
                            ))}
                            {p.tripulacion.length > 3 && (
                              <span className="crew-more">+{p.tripulacion.length - 3}</span>
                            )}
                            </div>
                            {!p.dotacion_completa && (
                              <span className="badge warn">
                                {p.dotacion.CONDUCTOR}/2 · {p.dotacion.ASISTENTE}/1
                              </span>
                            )}
                          </div>
                        ) : <span className="badge warn">Sin tripulación</span>}
                      </td>
                      <td data-label="Estado">
                        <span className={`badge ${ESTADO_BADGE[p.estado] ?? 'neutral'}`}>
                          {ESTADO_LABEL[p.estado] ?? p.estado}
                        </span>
                      </td>
                      <td data-label="Acciones">
                        <div className="flex gap-2 justify-center">
                          <button
                            className="btn-icon" title="Asignar recursos"
                            aria-label={`Asignar recursos a ${p.codigo}`}
                            onClick={e => { e.stopPropagation(); setSeleccionada(p); }}
                          >
                            <Users size={15} />
                          </button>
                          <button
                            className="btn-icon" title="Editar"
                            aria-label={`Editar ${p.codigo}`}
                            onClick={e => { e.stopPropagation(); abrirEditar(p); }}
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            className="btn-icon" title="Eliminar"
                            aria-label={`Eliminar ${p.codigo}`}
                            style={{ color: 'var(--danger)' }}
                            onClick={e => { e.stopPropagation(); eliminar(p); }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Panel de asignación */}
      {seleccionada && (
        <PanelPostura
          key={seleccionada.id}
          postura={seleccionada}
          buses={buses}
          onCerrar={() => setSeleccionada(null)}
          onCambio={fetchData}
        />
      )}

      {/* Alta y edición */}
      {createPortal(
        <div
          className={`modal-overlay ${modal ? 'open' : ''}`}
          onClick={e => { if (e.target === e.currentTarget) cerrarModal(); }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-label="Datos de la postura">
            <div className="modal-header">
              <span className="modal-title">
                {modal === 'crear' ? 'Nueva postura' : 'Editar postura'}
              </span>
              <button className="btn-icon" onClick={cerrarModal} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={guardar}>
              <div className="modal-body flex flex-col gap-4">
                {formError && (
                  <div className="notice danger">
                    <AlertCircle size={16} className="notice-icon" />
                    <div className="notice-content">{formError}</div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="codigo">Código de la postura</label>
                  <input
                    id="codigo" type="text" className="form-input mono" required
                    inputMode="numeric" pattern="\d{6}" maxLength={6}
                    value={form.codigo}
                    onChange={e => setForm({ ...form, codigo: e.target.value })}
                    placeholder="112218"
                  />
                  <p className="fs-12 text-muted">Seis dígitos, el mismo que usa la planilla de operaciones.</p>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="ruta">Ruta</label>
                  <select
                    id="ruta" className="form-input form-select" required
                    value={form.ruta_id}
                    onChange={e => setForm({ ...form, ruta_id: e.target.value })}
                  >
                    <option value="">Seleccione una ruta…</option>
                    {rutas.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.origen.nombre} → {r.destino.nombre} ({r.duracion_estimada} h)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="fecha">Fecha</label>
                    <input
                      id="fecha" type="date" className="form-input" required
                      value={form.fecha}
                      onChange={e => setForm({ ...form, fecha: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="hora">Hora de salida</label>
                    <input
                      id="hora" type="time" className="form-input" required
                      value={form.hora_salida}
                      onChange={e => setForm({ ...form, hora_salida: e.target.value })}
                    />
                  </div>
                </div>

                {modal !== 'crear' && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="estado">Estado</label>
                    <select
                      id="estado" className="form-input form-select"
                      value={form.estado}
                      onChange={e => setForm({ ...form, estado: e.target.value })}
                    >
                      {ESTADOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={cerrarModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving
                    ? <><span className="spinner" /> Guardando…</>
                    : <><Check size={15} /> Guardar</>}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
