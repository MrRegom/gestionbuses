import { useState, useEffect, useCallback } from 'react';
import axios from '../api';
import DialogoForm, { mensajeError } from '../components/DialogoForm';
import {
  Navigation, AlertTriangle, AlertCircle, RefreshCw, Bus as BusIcon,
  ArrowRight, CheckCircle2, Clock, MapPin, ShieldAlert,
} from 'lucide-react';

const ESTADO = {
  ACTIVA:  { badge: 'warn', label: 'Activa' },
  CERRADA: { badge: 'ok',   label: 'Cerrada' },
};

export default function Corridas() {
  const [caidos, setCaidos] = useState([]);
  const [corridas, setCorridas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [dialogo, setDialogo] = useState(null);   // {bus, posturas}
  const [seleccion, setSeleccion] = useState([]); // ids de posturas
  const [sustitutos, setSustitutos] = useState([]);
  const [form, setForm] = useState({ bus_sustituto_id: '', motivo: '' });
  const [guardando, setGuardando] = useState(false);
  const [dlgError, setDlgError] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get('/api/operaciones/corridas/tablero/');
      setCaidos(data.caidos);
      setCorridas(data.corridas);
    } catch (err) {
      console.error(err);
      setError('No se pudo cargar el tablero de corridas.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  /* Los sustitutos dependen de qué posturas se traspasan: al cambiar la
     selección hay que volver a preguntar quién puede cubrirlas todas. */
  useEffect(() => {
    if (!dialogo || seleccion.length === 0) { setSustitutos([]); return; }
    let vigente = true;
    (async () => {
      try {
        const { data } = await axios.get('/api/operaciones/corridas/sustitutos/', {
          params: { posturas: seleccion.join(',') },
        });
        if (vigente) setSustitutos(data);
      } catch {
        if (vigente) setSustitutos([]);
      }
    })();
    return () => { vigente = false; };
  }, [dialogo, seleccion]);

  const abrir = fila => {
    setDialogo(fila);
    setSeleccion(fila.posturas.map(p => p.id));
    setForm({ bus_sustituto_id: '', motivo: '' });
    setDlgError(null);
  };
  const cerrar = () => { setDialogo(null); setDlgError(null); };

  const alternar = id => setSeleccion(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const crear = async () => {
    setGuardando(true);
    setDlgError(null);
    try {
      await axios.post('/api/operaciones/corridas/', {
        bus_original_id: dialogo.bus.id,
        bus_sustituto_id: form.bus_sustituto_id || null,
        motivo: form.motivo,
        postura_ids: seleccion,
      });
      cerrar();
      await cargar();
    } catch (err) {
      setDlgError(mensajeError(err, 'No se pudo registrar la corrida.'));
    }
    setGuardando(false);
  };

  const cerrarCorrida = async corrida => {
    try {
      await axios.post(`/api/operaciones/corridas/${corrida.id}/cerrar/`);
      await cargar();
    } catch (err) {
      alert(mensajeError(err, 'No se pudo cerrar la corrida.'));
    }
  };

  const activas = corridas.filter(c => c.estado === 'ACTIVA').length;
  const enRiesgo = caidos.reduce((n, f) => n + f.posturas.length, 0);

  if (loading) {
    return (
      <>
        <div className="page-header">
          <div className="page-heading">
            <h1 className="page-title">Gestión de Corridas</h1>
            <p className="page-subtitle">Reasignación de recursos ante fallas</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 72 }} />)}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Gestión de Corridas</h1>
          <p className="page-subtitle">Reasignación de recursos ante fallas</p>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-icon-wrap warn"><Navigation size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">{error ? '—' : activas}</div>
            <div className="kpi-label">Corridas activas</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap danger"><BusIcon size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">{error ? '—' : caidos.length}</div>
            <div className="kpi-label">Buses caídos con servicios</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap danger"><ShieldAlert size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">{error ? '—' : enRiesgo}</div>
            <div className="kpi-label">Servicios comprometidos</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="card mb-5">
          <div className="empty-state">
            <span className="empty-icon"><AlertCircle size={36} strokeWidth={1.5} /></span>
            <div className="empty-title">{error}</div>
            <button className="btn btn-secondary mt-4" onClick={cargar}>
              <RefreshCw size={15} /> Reintentar
            </button>
          </div>
        </div>
      )}

      {/* ── Buses caídos que exigen una corrida ────────────────── */}
      {!error && (
        <div className="card mb-5">
          <div className="card-header">
            <span className="card-title">Requieren reemplazo</span>
            {caidos.length > 0 && <span className="badge danger">{caidos.length}</span>}
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {caidos.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon"><CheckCircle2 size={36} strokeWidth={1.5} /></span>
                <div className="empty-title">Sin servicios comprometidos</div>
                <p className="empty-sub">
                  Ningún bus caído tiene posturas pendientes por delante.
                </p>
              </div>
            ) : caidos.map(fila => (
              <div className="alert-item" key={fila.bus.id} style={{ padding: 'var(--sp-4) var(--sp-5)' }}>
                <span className="alert-item-icon danger"><AlertTriangle size={15} /></span>
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div className="alert-item-text">
                    {fila.bus.numero} · {fila.bus.patente}
                  </div>
                  <div className="alert-item-sub">
                    {fila.bus.estado.replace('_', ' ')} ·{' '}
                    {fila.posturas.length} servicio(s) por delante
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {fila.posturas.map(p => (
                      <span className="tag" key={p.id}>
                        {p.codigo} · {p.hora_salida.substring(0, 5)}
                      </span>
                    ))}
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => abrir(fila)}>
                  <Navigation size={13} /> Gestionar corrida
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Historial ──────────────────────────────────────────── */}
      {!error && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Historial de corridas</span>
            <span className="badge neutral">{corridas.length}</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {corridas.length === 0 && (
              <div className="empty-state">
                <span className="empty-icon"><Navigation size={36} strokeWidth={1.5} /></span>
                <div className="empty-title">Sin corridas registradas</div>
                <p className="empty-sub">
                  Aparecerán aquí cuando se reasignen servicios por una falla.
                </p>
              </div>
            )}

            {corridas.map(c => (
              <div key={c.id} style={{ padding: 'var(--sp-5)', borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                  <div className="corrida-flow" style={{ flex: 1, minWidth: 260 }}>
                    <div className="corrida-bus original">
                      <div className="bus-lbl">Bus original</div>
                      <div className="bus-num">{c.bus_original.numero}</div>
                    </div>
                    <ArrowRight className="corrida-arrow" size={20} />
                    <div className="corrida-bus sustituto">
                      <div className="bus-lbl">Sustituto</div>
                      <div className="bus-num">
                        {c.bus_sustituto ? c.bus_sustituto.numero : '—'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3" style={{ flexShrink: 0 }}>
                    <span className={`badge ${ESTADO[c.estado].badge}`}>
                      {ESTADO[c.estado].label}
                    </span>
                    {c.estado === 'ACTIVA' && (
                      <button className="btn btn-ok btn-sm" onClick={() => cerrarCorrida(c)}>
                        Cerrar corrida
                      </button>
                    )}
                  </div>
                </div>

                <div className="fs-13 text-secondary mb-2">{c.motivo}</div>

                <div className="flex flex-wrap gap-2 mb-2">
                  {c.posturas.map(p => (
                    <span className="tag" key={p.id}>
                      {p.codigo} · {p.ruta?.origen?.nombre} → {p.ruta?.destino?.nombre}
                    </span>
                  ))}
                </div>

                <div className="audit-meta">
                  <span>{c.creado_por.nombre}</span>
                  <span>{new Date(c.creado_en).toLocaleString('es-CL')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Registrar corrida ──────────────────────────────────── */}
      <DialogoForm
        abierto={Boolean(dialogo)}
        titulo="Gestionar corrida"
        guardarLabel="Registrar corrida"
        onCerrar={cerrar}
        onGuardar={crear}
        guardando={guardando}
        error={dlgError}
        disabled={seleccion.length === 0 || !form.motivo.trim()}
      >
        {dialogo && (
          <>
            <div className="notice warn">
              <AlertTriangle size={16} className="notice-icon" />
              <div className="notice-content">
                <div className="notice-title">
                  {dialogo.bus.numero} está {dialogo.bus.estado.replace('_', ' ')}
                </div>
                <div className="notice-desc">
                  Elige qué servicios se traspasan y con qué máquina.
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Servicios a traspasar</label>
              {dialogo.posturas.map(p => (
                <label
                  key={p.id}
                  className="data-row"
                  style={{ cursor: 'pointer', gap: 'var(--sp-3)' }}
                >
                  <span className="flex items-center gap-3" style={{ minWidth: 0 }}>
                    <input
                      type="checkbox"
                      checked={seleccion.includes(p.id)}
                      onChange={() => alternar(p.id)}
                      style={{ width: 16, height: 16, flexShrink: 0 }}
                    />
                    <span style={{ minWidth: 0 }}>
                      <span className="fw-600 mono">{p.codigo}</span>
                      <span className="fs-12 text-muted flex items-center gap-2 mt-1">
                        <MapPin size={11} />
                        {p.ruta?.origen?.nombre} → {p.ruta?.destino?.nombre}
                        <Clock size={11} /> {p.hora_salida.substring(0, 5)}
                      </span>
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="co-sust">Bus sustituto</label>
              <select
                id="co-sust" className="form-input form-select"
                value={form.bus_sustituto_id}
                onChange={e => setForm({ ...form, bus_sustituto_id: e.target.value })}
              >
                <option value="">Sin reemplazo por ahora</option>
                {sustitutos.map(b => (
                  <option key={b.id} value={b.id}>{b.numero} · {b.patente}</option>
                ))}
              </select>
              <p className="fs-12 text-muted">
                {seleccion.length === 0
                  ? 'Selecciona al menos un servicio para ver qué buses pueden cubrirlo.'
                  : sustitutos.length === 0
                    ? 'Ningún bus disponible puede cubrir todos los servicios elegidos.'
                    : `${sustitutos.length} bus(es) pueden cubrir los ${seleccion.length} servicio(s).`}
              </p>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="co-motivo">Motivo</label>
              <textarea
                id="co-motivo" className="form-input" rows={3} required
                placeholder="Ej: falla en sistema de frenos, bus ingresó al pozo P-02…"
                value={form.motivo}
                onChange={e => setForm({ ...form, motivo: e.target.value })}
              />
            </div>
          </>
        )}
      </DialogoForm>
    </>
  );
}
