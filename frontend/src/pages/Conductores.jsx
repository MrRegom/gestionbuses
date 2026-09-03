import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from '../api';
import { ETIQUETA_PUESTO } from '../config/dominio';
import DialogoForm, { mensajeError } from '../components/DialogoForm';
import {
  Users, Plus, CheckCircle2, Check, KeyRound,
  Search, ArrowRight, MapPin, Clock, Bus as BusIcon,
  X, Calendar, AlertCircle, RefreshCw, Edit, Trash2,
} from 'lucide-react';

/* ─ helpers ──────────────────────────────────────────────── */
const getInitials = n => n.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();

/* Los avatares ya no usan colores decorativos: en un sistema neutro
   el color debe significar algo. Se distinguen por tono de gris. */
const AVATAR_TONES = ['var(--n-90)', 'var(--n-100)', 'var(--n-110)', 'var(--n-80)'];
const avatarTone = id => AVATAR_TONES[id % AVATAR_TONES.length];


const ESTADO_BADGE = { LISTA: 'ok', EN_CURSO: 'info', COMPLETA: 'ok', ALERTA: 'warn', PROBLEMA: 'danger' };
const estadoBadge = e => <span className={`badge ${ESTADO_BADGE[e] ?? 'neutral'}`}>{e}</span>;



/* ─ Cuenta de acceso ─────────────────────────────────────────
   La clave inicial se muestra una sola vez: no se guarda en ninguna
   parte legible ni se puede volver a ver. Si se pierde, se reinicia. */
function CuentaPersona({ persona, onCambio }) {
  const [sugerencia, setSugerencia] = useState('');
  const [username, setUsername] = useState('');
  const [clave, setClave] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [msg, setMsg] = useState(null);

  const tiene = Boolean(persona.usuario);

  /* Solo depende de la persona. Al crear la cuenta `tiene` pasa de false
     a true, y con esa dependencia el efecto volvía a correr y borraba la
     clave recién mostrada antes de que nadie alcanzara a anotarla. */
  useEffect(() => {
    setClave(null);
    setMsg(null);
    axios.get(`/api/operaciones/personal/${persona.id}/cuenta/`)
      .then(r => { setSugerencia(r.data.sugerencia); setUsername(r.data.sugerencia); })
      .catch(() => setSugerencia(''));
  }, [persona.id]);

  const accion = async (fn, exito) => {
    setTrabajando(true);
    setMsg(null);
    try {
      const { data } = await fn();
      if (data?.clave_inicial) setClave(data);
      if (exito) setMsg({ type: 'ok', text: exito });
      await onCambio();
    } catch (err) {
      setMsg({ type: 'err', text: mensajeError(err, 'No se pudo completar.') });
    }
    setTrabajando(false);
  };

  const crear = () => accion(
    () => axios.post(`/api/operaciones/personal/${persona.id}/cuenta/`, { username }));

  const reiniciar = () => {
    if (!window.confirm(`¿Generar una contraseña nueva para ${persona.nombre}?`)) return;
    accion(() => axios.post(`/api/operaciones/personal/${persona.id}/cuenta/reiniciar/`));
  };

  const quitar = () => {
    if (!window.confirm(`¿Quitarle el acceso a ${persona.nombre}?`)) return;
    accion(() => axios.delete(`/api/operaciones/personal/${persona.id}/cuenta/`),
           'Acceso retirado. La cuenta queda desactivada, no se borra.');
  };

  return (
    <div className="mb-4">
      <div className="section-label">Acceso a la aplicación</div>

      {clave && (
        <div className="notice warn mb-3">
          <span className="notice-icon"><KeyRound size={16} /></span>
          <div className="notice-content">
            <div className="notice-title">Anótala ahora: no se vuelve a mostrar</div>
            <div className="notice-desc">
              Usuario <strong className="mono">{clave.username}</strong>
              {' · '}contraseña <strong className="mono">{clave.clave_inicial}</strong>
            </div>
            <div className="notice-desc mt-1">
              Al entrar por primera vez el sistema le va a pedir que la cambie.
            </div>
          </div>
        </div>
      )}

      {msg && (
        <div className={`notice ${msg.type === 'ok' ? 'ok' : 'danger'} mb-3`}>
          <div className="notice-content">{msg.text}</div>
        </div>
      )}

      {!tiene ? (
        <>
          <div className="info-box text-muted mb-3">
            Sin cuenta. No puede entrar a la aplicación ni recibir avisos.
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cta-user">Nombre de usuario</label>
            <input id="cta-user" type="text" className="form-input mono"
                   placeholder={sugerencia}
                   value={username}
                   onChange={e => setUsername(e.target.value.trim())} />
          </div>
          <button className="btn btn-primary btn-sm w-full"
                  onClick={crear} disabled={trabajando || !username}>
            {trabajando ? <><span className="spinner" /> Creando…</>
                        : <><KeyRound size={14} /> Crear cuenta</>}
          </button>
        </>
      ) : (
        <>
          <div className="data-list mb-3">
            <div className="data-row">
              <span className="data-row-key">Usuario</span>
              <span className="data-row-val mono">{persona.usuario_nombre ?? '—'}</span>
            </div>
            <div className="data-row">
              <span className="data-row-key">Estado</span>
              <span className="data-row-val">
                {persona.debe_cambiar_clave
                  ? <span className="badge warn">Debe cambiar la clave</span>
                  : <span className="badge ok">Activa</span>}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-sm flex-1"
                    onClick={reiniciar} disabled={trabajando}>
              Reiniciar clave
            </button>
            <button className="btn btn-secondary btn-sm flex-1"
                    style={{ color: 'var(--danger)' }}
                    onClick={quitar} disabled={trabajando}>
              Quitar acceso
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─ Turno de la persona ──────────────────────────────────────
   Es el primer paso del flujo: el ciclo dice qué días está, y recién
   sobre eso se arma la programación. Hoy esta pregunta se contesta con
   una planilla Excel. */
function TurnoPersona({ persona, onCambio }) {
  const [ciclos, setCiclos] = useState([]);
  const [form, setForm] = useState({ ciclo_id: '', inicio: '' });
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState(null);

  const turno = persona.turno;

  useEffect(() => {
    axios.get('/api/operaciones/ciclos/')
      .then(r => setCiclos(r.data.filter(c => c.activo)))
      .catch(() => setCiclos([]));
  }, []);

  useEffect(() => {
    setForm({
      ciclo_id: turno?.ciclo?.id ?? '',
      inicio: turno?.inicio ?? '',
    });
    setMsg(null);
  }, [turno?.ciclo?.id, turno?.inicio]);

  const guardar = async () => {
    setGuardando(true);
    setMsg(null);
    try {
      await axios.put(`/api/operaciones/personal/${persona.id}/turno/`, {
        ciclo_id: form.ciclo_id || null,
        inicio: form.inicio || null,
      });
      setMsg({ type: 'ok', text: 'Turno guardado.' });
      await onCambio();
    } catch (err) {
      setMsg({ type: 'err', text: mensajeError(err, 'No se pudo guardar el turno.') });
    }
    setGuardando(false);
  };

  const cambiado = String(form.ciclo_id ?? '') !== String(turno?.ciclo?.id ?? '')
    || (form.inicio ?? '') !== (turno?.inicio ?? '');

  return (
    <div className="mb-4">
      <div className="section-label">Turno</div>

      {!turno && (
        <div className="info-box text-muted mb-3">
          Sin ciclo asignado. Mientras no lo tenga, el sistema la considera
          disponible todos los días.
        </div>
      )}

      <div className="grid-2 gap-3">
        <div className="form-group">
          <label className="form-label" htmlFor="turno-ciclo">Ciclo</label>
          <select id="turno-ciclo" className="form-input form-select"
                  value={form.ciclo_id}
                  onChange={e => setForm({ ...form, ciclo_id: e.target.value })}>
            <option value="">Sin ciclo</option>
            {ciclos.map(c => (
              <option key={c.id} value={c.id}>
                {c.nombre} · {c.dias_trabajo}+{c.dias_descanso}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="turno-inicio">
            Primer día de trabajo
          </label>
          <input id="turno-inicio" type="date" className="form-input"
                 value={form.inicio}
                 disabled={!form.ciclo_id}
                 onChange={e => setForm({ ...form, inicio: e.target.value })} />
        </div>
      </div>

      {msg && (
        <div className={`notice ${msg.type === 'ok' ? 'ok' : 'danger'} mb-3`}>
          <div className="notice-content">{msg.text}</div>
        </div>
      )}

      <button className="btn btn-secondary btn-sm w-full"
              onClick={guardar}
              disabled={guardando || !cambiado
                        || (Boolean(form.ciclo_id) && !form.inicio)}>
        {guardando ? <><span className="spinner" /> Guardando…</>
                   : <><Check size={14} /> Guardar turno</>}
      </button>
    </div>
  );
}

/* ─ Ficha lateral ────────────────────────────────────────── */
const VIAJAN = ['CONDUCTOR', 'ASISTENTE'];

function FichaPanel({ persona, posturas, onClose, onAsignar, onDesasignar, onCambio }) {
  const [tab, setTab] = useState('info');
  // El listado incluye a todo el personal, porque es el único sitio
  // donde se da de alta a un mecánico. Pero a un mecánico no se le
  // asigna un servicio, así que esa pestaña no existe para él.
  const esTripulacion = VIAJAN.includes(persona.rol);
  const [selPostura, setSelPostura] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const misPosturas = posturas.filter(p =>
    p.tripulacion.some(t => t.persona.id === persona.id)
  );

  /* Qué servicios puede tomar esta persona lo decide el servidor.
     Antes se filtraba aquí con dos condiciones —que no fuera COMPLETA y
     que no estuviera ya asignada— y eso dejaba pasar los casos que
     importan: un conductor con otro viaje a la misma hora, una postura
     que ya tiene sus dos conductores, alguien bloqueado por fatiga. El
     servidor los rechazaba igual, pero recién al confirmar. */
  const [opciones, setOpciones] = useState(null);

  useEffect(() => {
    if (tab !== 'asignar') return;
    let vigente = true;
    axios.get(`/api/operaciones/personal/${persona.id}/posturas/`)
      .then(r => { if (vigente) setOpciones(r.data); })
      .catch(() => { if (vigente) setOpciones([]); });
    return () => { vigente = false; };
  }, [tab, persona.id, posturas]);

  const disponibles = (opciones ?? []).filter(o => o.disponible);
  const noDisponibles = (opciones ?? []).filter(o => !o.disponible);

  const handleAsignar = async () => {
    if (!selPostura) return;
    setSaving(true);
    setMsg(null);
    try {
      const elegida = disponibles.find(
        o => o.postura.id === parseInt(selPostura, 10));
      await onAsignar(selPostura, persona.id, elegida?.puesto);
      setMsg({ type: 'ok', text: 'Postura asignada correctamente.' });
      setSelPostura('');
      setTab('info');
    } catch {
      setMsg({ type: 'err', text: 'Error al asignar. Intente de nuevo.' });
    }
    setSaving(false);
  };


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
        {(esTripulacion
          ? [['info', 'Ficha'], ['asignar', 'Asignar postura']]
          : [['info', 'Ficha']]
        ).map(([key, label]) => (
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

            {esTripulacion && (
              <TurnoPersona persona={persona} onCambio={onCambio} />
            )}

            <CuentaPersona persona={persona} onCambio={onCambio} />

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="section-label" style={{ marginBottom: 0 }}>
                  Posturas asignadas ({misPosturas.length})
                </div>
                {esTripulacion && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setTab('asignar')}>
                    <Plus size={13} /> Asignar
                  </button>
                )}
              </div>

              {misPosturas.length === 0 ? (
                <div className="info-box text-center text-muted">
                  {esTripulacion
                    ? 'Sin posturas asignadas'
                    : 'Este perfil no viaja en los servicios.'}
                </div>
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
                          <span className="badge neutral">
                            {ETIQUETA_PUESTO[asig?.rol_en_viaje] ?? asig?.rol_en_viaje}
                          </span>
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
                {disponibles.map(({ postura: p, puesto }) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} · {p.ruta?.origen?.nombre} → {p.ruta?.destino?.nombre}
                    {' · '}{p.fecha} {p.hora_salida?.substring(0, 5)}
                    {puesto ? ` · ${ETIQUETA_PUESTO[puesto]}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {selPostura && (() => {
              const p = disponibles.find(x => x.postura.id === parseInt(selPostura, 10))?.postura;
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

            {opciones === null ? (
              <div className="skeleton" style={{ height: 44 }} />
            ) : disponibles.length === 0 ? (
              <div className="info-box text-center text-muted">
                {noDisponibles.length === 0
                  ? 'No hay servicios programados de hoy en adelante.'
                  : `Ninguno de los ${noDisponibles.length} servicios programados admite a ${persona.nombre.split(' ')[0]}.`}
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

            {/* Los que no puede tomar, con el motivo. Esconderlos haría
                parecer que no existen; el programador necesita saber que
                el servicio está ahí y por qué esta persona no entra. */}
            {noDisponibles.length > 0 && (
              <div className="mt-4">
                <div className="section-label">
                  No disponibles ({noDisponibles.length})
                </div>
                <div className="data-list">
                  {noDisponibles.slice(0, 12).map(({ postura: p, motivo }) => (
                    <div className="data-row" key={p.id}>
                      <span className="data-row-key">
                        <span className="mono">{p.codigo}</span>
                        {' · '}{p.hora_salida?.substring(0, 5)}
                      </span>
                      <span className="data-row-val text-muted fs-12">{motivo}</span>
                    </div>
                  ))}
                </div>
                {noDisponibles.length > 12 && (
                  <p className="empty-sub mt-2">
                    y {noDisponibles.length - 12} más.
                  </p>
                )}
              </div>
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

  const [dialogo, setDialogo] = useState(null);   // null | 'crear' | {id}
  const [form, setForm] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [dlgError, setDlgError] = useState(null);

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

  const FORM_VACIO = { rut: '', nombre: '', rol: 'CONDUCTOR', tipo: 'TITULAR' };

  const abrirCrear = () => { setForm(FORM_VACIO); setDlgError(null); setDialogo('crear'); };
  const abrirEditar = persona => {
    setForm({ rut: persona.rut, nombre: persona.nombre, rol: persona.rol, tipo: persona.tipo });
    setDlgError(null);
    setDialogo({ id: persona.id });
  };
  const cerrarDialogo = () => { setDialogo(null); setDlgError(null); };

  const guardarPersona = async () => {
    setGuardando(true);
    setDlgError(null);
    try {
      if (dialogo === 'crear') {
        await axios.post('/api/operaciones/personal/', form);
      } else {
        await axios.put(`/api/operaciones/personal/${dialogo.id}/`, form);
      }
      cerrarDialogo();
      await fetchAll();
    } catch (err) {
      setDlgError(mensajeError(err, 'No se pudo guardar la persona.'));
    }
    setGuardando(false);
  };

  const eliminarPersona = async persona => {
    if (!window.confirm(`¿Eliminar a ${persona.nombre}? La acción no se puede deshacer.`)) return;
    try {
      await axios.delete(`/api/operaciones/personal/${persona.id}/`);
      if (selected?.id === persona.id) setSelected(null);
      await fetchAll();
    } catch (err) {
      alert(mensajeError(err, 'No se pudo eliminar la persona.'));
    }
  };

  /* Relee la persona seleccionada. La ficha muestra su turno vigente,
     así que tras guardarlo hay que traerla de nuevo o queda mostrando
     el ciclo anterior. */
  const refrescarSeleccion = useCallback(async () => {
    const { data } = await axios.get('/api/operaciones/tripulacion/');
    setPersonas(data);
    setSelected(prev => (prev ? data.find(p => p.id === prev.id) ?? prev : prev));
  }, []);

  /* Sube a la persona al primer puesto que le calce en ese servicio.
     El puesto no es el cargo: un conductor va de jefe de máquina o de
     segundo según cuál esté libre. Es el mismo orden de la planilla. */
  const handleAsignar = async (posturaId, personaId, puesto) => {
    await axios.post(`/api/operaciones/posturas/${posturaId}/asignar/`, {
      persona_id: personaId,
      rol_en_viaje: puesto,
    });
    await fetchAll();
    const r = await axios.get('/api/operaciones/tripulacion/');
    const actualizado = r.data.find(p => p.id === personaId);
    if (actualizado) setSelected(actualizado);
  };

  /* Quita a la persona de una postura. */
  const handleDesasignar = async (posturaId, asignacionId) => {
    if (!asignacionId) return;
    try {
      await axios.delete(`/api/operaciones/asignaciones/${asignacionId}/`);
      await fetchAll();
      const r = await axios.get('/api/operaciones/tripulacion/');
      const actualizado = r.data.find(p => p.id === selected?.id);
      if (actualizado) setSelected(actualizado);
    } catch (err) {
      alert(mensajeError(err, 'No se pudo quitar la asignación.'));
    }
  };

  const personasFiltradas = personas.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.rut.includes(busqueda)
  );

  // Antes estos dos contaban semáforos de fatiga. Ese control salió de
  // la aplicación —nadie alimentaba las horas—, así que el encabezado
  // cuenta lo que sí se sabe: cuánta gente hay de cada cargo.
  const conduccion = personas.filter(p => p.rol === 'CONDUCTOR').length;
  const asistentes = personas.filter(p => p.rol === 'ASISTENTE').length;

  return (
    <>
      <div className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Gestión de Tripulación</h1>
          <p className="page-subtitle">Conductores y asistentes — asignación de posturas</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={abrirCrear}><Plus size={15} /> Nuevo personal</button>
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
            <div className="kpi-value">{loading || error ? '—' : conduccion}</div>
            <div className="kpi-label">Conductores</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap info"><Users size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">{loading || error ? '—' : asistentes}</div>
            <div className="kpi-label">Asistentes</div>
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
                    <th>Posturas</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {personasFiltradas.map(persona => {
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
                        <td data-label="Posturas">
                          <span className={`badge ${nPosturas > 0 ? 'accent' : 'neutral'}`}>
                            {nPosturas} asignada{nPosturas !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td data-label="Acción">
                          <div className="flex gap-2 justify-center">
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={e => { e.stopPropagation(); setSelected(isActive ? null : persona); }}
                            >
                              {isActive ? 'Cerrar' : <>Ficha <ArrowRight size={14} /></>}
                            </button>
                            <button
                              className="btn-icon" title="Editar"
                              aria-label={`Editar a ${persona.nombre}`}
                              onClick={e => { e.stopPropagation(); abrirEditar(persona); }}
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              className="btn-icon" title="Eliminar"
                              aria-label={`Eliminar a ${persona.nombre}`}
                              style={{ color: 'var(--danger)' }}
                              onClick={e => { e.stopPropagation(); eliminarPersona(persona); }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
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
      <DialogoForm
        abierto={Boolean(dialogo)}
        titulo={dialogo === 'crear' ? 'Nuevo personal' : 'Editar personal'}
        onCerrar={cerrarDialogo}
        onGuardar={guardarPersona}
        guardando={guardando}
        error={dlgError}
        disabled={!form.rut || !form.nombre}
      >
        <div className="form-group">
          <label className="form-label" htmlFor="per-nom">Nombre completo</label>
          <input
            id="per-nom" type="text" className="form-input" required
            value={form.nombre ?? ''}
            onChange={e => setForm({ ...form, nombre: e.target.value })}
            placeholder="Victor Manuel Veliz Suares"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="per-rut">RUT</label>
          <input
            id="per-rut" type="text" className="form-input mono" required
            value={form.rut ?? ''}
            onChange={e => setForm({ ...form, rut: e.target.value })}
            placeholder="12.345.678-9"
          />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="per-rol">Rol</label>
            <select
              id="per-rol" className="form-input form-select"
              value={form.rol ?? 'CONDUCTOR'}
              onChange={e => setForm({ ...form, rol: e.target.value })}
            >
              <option value="CONDUCTOR">Conductor</option>
              <option value="ASISTENTE">Asistente</option>
              <option value="MECANICO">Mecánico</option>
              <option value="JEFE_OPERACIONES">Jefe de Operaciones</option>
              <option value="JEFE_MECANICOS">Jefe de Mecánicos</option>
              <option value="MONITOREO">Sala de Monitoreo</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="per-tipo">Tipo</label>
            <select
              id="per-tipo" className="form-input form-select"
              value={form.tipo ?? 'TITULAR'}
              onChange={e => setForm({ ...form, tipo: e.target.value })}
            >
              <option value="TITULAR">Titular</option>
              <option value="RELEVO">Relevo</option>
            </select>
          </div>
        </div>
      </DialogoForm>

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
            onCambio={refrescarSeleccion}
          />
        </>,
        document.body,
      )}
    </>
  );
}
