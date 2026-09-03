import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from '../api';
import { useAuth } from '../context/AuthContext';
import {
  ClipboardCheck, Check, X, Minus, AlertTriangle, AlertCircle,
  RefreshCw, ChevronRight, ShieldAlert, ArrowLeft, Play,
} from 'lucide-react';

const OPCIONES = [
  { estado: 'OK',    label: 'OK',    Icon: Check, cls: 'ok' },
  { estado: 'FALLA', label: 'Falla', Icon: X,     cls: 'danger' },
  { estado: 'NA',    label: 'N/A',   Icon: Minus, cls: 'neutral' },
];

/* ── Pantalla de inicio: elegir bus y servicio ──────────────
   El checklist es uno por viaje y se hace al llegar a Santiago, así
   que no hay momento que elegir: antes esta pantalla ofrecía también
   un "preventivo de salida" que no existe en el proceso real. */
function Inicio({ buses, posturas, quien, onIniciar, iniciando, error }) {
  const [form, setForm] = useState({
    bus_id: '', postura_id: '',
  });

  const puedeIniciar = Boolean(form.bus_id);

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Iniciar checklist</span>
      </div>
      <div className="card-body flex flex-col gap-4">
        {error && (
          <div className="notice danger">
            <AlertCircle size={16} className="notice-icon" />
            <div className="notice-content">{error}</div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="chk-bus">Bus</label>
          <select
            id="chk-bus" className="form-input form-select"
            value={form.bus_id}
            onChange={e => setForm({ ...form, bus_id: e.target.value })}
          >
            <option value="">Seleccione el bus…</option>
            {buses.map(b => (
              <option key={b.id} value={b.id}>
                {b.numero} · {b.patente} · {b.modelo}
              </option>
            ))}
          </select>
        </div>

        {/* Quien revisa es el usuario en sesión: el backend ignora
            cualquier persona que mande el cliente. */}
        <div className="form-group">
          <label className="form-label">Realiza la revisión</label>
          <div className="info-box">{quien}</div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="chk-postura">Postura asociada (opcional)</label>
          <select
            id="chk-postura" className="form-input form-select"
            value={form.postura_id}
            onChange={e => setForm({ ...form, postura_id: e.target.value })}
          >
            <option value="">Sin postura</option>
            {posturas.map(p => (
              <option key={p.id} value={p.id}>
                {p.codigo} · {p.ruta?.origen?.nombre} → {p.ruta?.destino?.nombre}
              </option>
            ))}
          </select>
        </div>

        <button
          className="btn btn-primary btn-lg w-full"
          disabled={!puedeIniciar || iniciando}
          onClick={() => onIniciar(form)}
        >
          {iniciando ? <><span className="spinner" /> Iniciando…</> : <><Play size={15} /> Comenzar revisión</>}
        </button>
      </div>
    </div>
  );
}

/* ── Resumen del cierre ─────────────────────────────────────── */
function Resultado({ resultado, onNuevo }) {
  const { incidentes_creados: incidentes, bus_estado: busEstado } = resultado;
  const sinFallas = incidentes.length === 0;

  return (
    <div className="card">
      <div className="card-body">
        <div className="empty-state" style={{ paddingBottom: 'var(--sp-5)' }}>
          <span className="empty-icon">
            {sinFallas
              ? <ClipboardCheck size={40} strokeWidth={1.5} color="var(--ok)" />
              : <ShieldAlert size={40} strokeWidth={1.5} color="var(--danger)" />}
          </span>
          <div className="empty-title">
            {sinFallas ? 'Checklist conforme' : `${incidentes.length} falla(s) detectada(s)`}
          </div>
          <p className="empty-sub">
            {sinFallas
              ? 'No se registraron fallas. El bus queda habilitado.'
              : 'Los incidentes ya están en la cola de Mantención.'}
          </p>
        </div>

        {!sinFallas && (
          <>
            <div className="notice warn mb-4">
              <AlertTriangle size={16} className="notice-icon" />
              <div className="notice-content">
                <div className="notice-title">Bus en estado {busEstado.replace('_', ' ')}</div>
                <div className="notice-desc">
                  Operaciones debe reasignar los servicios de este bus.
                </div>
              </div>
            </div>

            {incidentes.map(inc => (
              <div className="mini-card" key={inc.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="fw-600 fs-13 mono">{inc.codigo}</span>
                  <span className={`badge ${inc.gravedad === 'ALTA' ? 'danger' : 'neutral'}`}>
                    {inc.gravedad ?? 'sin clasificar'}
                  </span>
                </div>
                <div className="fs-12 text-secondary">{inc.descripcion}</div>
              </div>
            ))}
          </>
        )}

        <button className="btn btn-secondary w-full mt-5" onClick={onNuevo}>
          <ArrowLeft size={15} /> Nueva revisión
        </button>
      </div>
    </div>
  );
}

/* ── Página ─────────────────────────────────────────────────── */
export default function Checklist() {
  const { sesion } = useAuth();
  const [plantilla, setPlantilla] = useState([]);
  const [buses, setBuses] = useState([]);
  const [posturas, setPosturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [checklist, setChecklist] = useState(null);
  const [respuestas, setRespuestas] = useState({});   // item_id -> {estado, observacion}
  const [iniciando, setIniciando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [formError, setFormError] = useState(null);
  const [resultado, setResultado] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rPlantilla, rBuses, rPosturas] = await Promise.all([
        axios.get('/api/mantencion/checklist/plantilla/'),
        axios.get('/api/flota/buses/'),
        axios.get('/api/operaciones/posturas/'),
      ]);
      setPlantilla(rPlantilla.data);
      setBuses(rBuses.data);
      setPosturas(rPosturas.data);
    } catch (err) {
      console.error(err);
      setError('No se pudo cargar la plantilla del checklist.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const items = useMemo(
    () => plantilla.flatMap(c => c.items),
    [plantilla],
  );

  const respondidos = Object.keys(respuestas).length;
  const totalItems = items.length;
  const fallas = Object.values(respuestas).filter(r => r.estado === 'FALLA');
  const progreso = totalItems ? Math.round((respondidos / totalItems) * 100) : 0;
  const completo = totalItems > 0 && respondidos === totalItems;

  /* Una falla sin descripción la rechaza el backend; el botón se
     bloquea antes para no hacer un viaje inútil. */
  const fallaSinDescribir = fallas.some(f => !f.observacion?.trim());

  const iniciar = async form => {
    setIniciando(true);
    setFormError(null);
    try {
      const { data } = await axios.post('/api/mantencion/checklist/', {
        bus_id: form.bus_id,
        postura_id: form.postura_id || null,
      });
      setChecklist(data);
      setRespuestas({});
      setResultado(null);
    } catch (err) {
      setFormError(err.response?.data?.error ?? 'No se pudo iniciar el checklist.');
    }
    setIniciando(false);
  };

  /* La respuesta se guarda en el acto: si el conductor pierde señal a
     mitad de la revisión, no pierde lo ya respondido. */
  const responder = async (item, estado, observacion = '') => {
    setRespuestas(prev => ({ ...prev, [item.id]: { estado, observacion } }));
    if (estado === 'FALLA' && !observacion.trim()) return;  // espera la descripción
    try {
      await axios.post(`/api/mantencion/checklist/${checklist.id}/responder/`, {
        item_id: item.id, estado, observacion,
      });
    } catch (err) {
      console.error(err);
      setFormError('No se pudo guardar una respuesta. Revisa la conexión.');
    }
  };

  const completar = async () => {
    setCerrando(true);
    setFormError(null);
    try {
      const { data } = await axios.post(
        `/api/mantencion/checklist/${checklist.id}/completar/`
      );
      setResultado(data);
      setChecklist(null);
    } catch (err) {
      setFormError(err.response?.data?.error ?? 'No se pudo cerrar el checklist.');
    }
    setCerrando(false);
  };

  /* ── Render ── */
  if (loading) {
    return (
      <>
        <div className="page-header">
          <div className="page-heading">
            <h1 className="page-title">Checklist Digital</h1>
            <p className="page-subtitle">Revisión de salida y recepción de buses</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 56 }} />)}
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="page-header">
          <div className="page-heading">
            <h1 className="page-title">Checklist Digital</h1>
            <p className="page-subtitle">Revisión de salida y recepción de buses</p>
          </div>
        </div>
        <div className="card">
          <div className="empty-state">
            <span className="empty-icon"><AlertCircle size={36} strokeWidth={1.5} /></span>
            <div className="empty-title">{error}</div>
            <button className="btn btn-secondary mt-4" onClick={cargar}>
              <RefreshCw size={15} /> Reintentar
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Checklist Digital</h1>
          <p className="page-subtitle">Revisión de salida y recepción de buses</p>
        </div>
      </div>

      {resultado && <Resultado resultado={resultado} onNuevo={() => setResultado(null)} />}

      {!resultado && !checklist && (
        <Inicio
          buses={buses} posturas={posturas} quien={sesion.nombre}
          onIniciar={iniciar} iniciando={iniciando} error={formError}
        />
      )}

      {!resultado && checklist && (
        <>
          {/* Cabecera del checklist en curso */}
          <div className="card mb-4">
            <div className="card-body flex items-center gap-4">
              <div className="flex-1" style={{ minWidth: 0 }}>
                <div className="fw-600">{checklist.bus.numero} · {checklist.bus.patente}</div>
                <div className="fs-12 text-muted">
                  {checklist.reportado_por.nombre}
                  {checklist.postura_codigo
                    ? ` · postura ${checklist.postura_codigo}` : ''}
                </div>
              </div>
              <div className="text-right" style={{ flexShrink: 0 }}>
                <div className="kpi-value" style={{ fontSize: 20 }}>{progreso}%</div>
                <div className="fs-12 text-muted">{respondidos} / {totalItems}</div>
              </div>
            </div>
            <div className="progress-track" style={{ borderRadius: 0 }}>
              <div
                className={`progress-fill ${fallas.length ? 'warn' : 'ok'}`}
                style={{ width: `${progreso}%`, borderRadius: 0 }}
              />
            </div>
          </div>

          {fallas.length > 0 && (
            <div className="notice danger mb-4">
              <AlertTriangle size={16} className="notice-icon" />
              <div className="notice-content">
                <div className="notice-title">
                  {fallas.length} falla{fallas.length > 1 ? 's' : ''} detectada{fallas.length > 1 ? 's' : ''}
                </div>
                <div className="notice-desc">
                  Mantención será notificada al finalizar la revisión.
                </div>
              </div>
            </div>
          )}

          {formError && (
            <div className="notice warn mb-4">
              <AlertCircle size={16} className="notice-icon" />
              <div className="notice-content">{formError}</div>
            </div>
          )}

          {/* Categorías */}
          {plantilla.map(cat => {
            const resp = cat.items.filter(i => respuestas[i.id]).length;
            return (
              <div className="card mb-4" key={cat.id}>
                <div className="card-header">
                  <span className="card-title">{cat.nombre}</span>
                  <span className={`badge ${resp === cat.items.length ? 'ok' : 'neutral'}`}>
                    {resp} / {cat.items.length}
                  </span>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  {cat.items.map(item => {
                    const r = respuestas[item.id];
                    return (
                      <div key={item.id} className="chk-item">
                        <div className="chk-item-head">
                          <span className="chk-item-label">
                            {item.descripcion}
                            {item.critico && (
                              <span className="chk-critico" title="Su falla deja el bus fuera de servicio">
                                crítico
                              </span>
                            )}
                          </span>
                          <div className="chk-opciones">
                            {OPCIONES.map(({ estado, label, Icon, cls }) => (
                              <button
                                key={estado}
                                className={`chk-btn ${cls} ${r?.estado === estado ? 'sel' : ''}`}
                                onClick={() => responder(item, estado, r?.observacion ?? '')}
                                aria-pressed={r?.estado === estado}
                                aria-label={`${item.descripcion}: ${label}`}
                              >
                                <Icon size={14} /> {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {r?.estado === 'FALLA' && (
                          <input
                            type="text"
                            className="form-input mt-3"
                            placeholder="Describe la falla (obligatorio)…"
                            value={r.observacion ?? ''}
                            onChange={e => responder(item, 'FALLA', e.target.value)}
                            aria-label={`Descripción de la falla en ${item.descripcion}`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Cierre */}
          <div className="card">
            <div className="card-body">
              {fallaSinDescribir && (
                <div className="notice warn mb-3">
                  <AlertCircle size={16} className="notice-icon" />
                  <div className="notice-content">
                    Describe cada falla antes de finalizar.
                  </div>
                </div>
              )}
              <button
                className="btn btn-primary btn-lg w-full"
                disabled={!completo || fallaSinDescribir || cerrando}
                onClick={completar}
              >
                {cerrando
                  ? <><span className="spinner" /> Cerrando…</>
                  : <>Finalizar checklist <ChevronRight size={16} /></>}
              </button>
              {!completo && (
                <p className="fs-12 text-muted text-center mt-3">
                  Faltan {totalItems - respondidos} ítem(s) por responder
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
