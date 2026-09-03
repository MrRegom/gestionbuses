import { useState, useEffect, useCallback } from 'react';
import axios from '../api';
import DialogoForm, { mensajeError } from '../components/DialogoForm';
import { hace } from '../utils/formato';
import {
  Navigation, AlertTriangle, Bus as BusIcon, ArrowRight, Clock,
  MapPin, RefreshCw, CheckCircle2, History, Wrench,
} from 'lucide-react';

/**
 * Gestión de corridas.
 *
 * Una corrida es el adelanto en cadena de las salidas cuando un bus se
 * cae, tal como lo describió Operaciones: si el de las 10:00 no puede
 * salir, el de las 11:00 cubre esa postura, el de las 12:00 cubre la de
 * las 11:00, y así hasta que sale el bus del pozo y ahí se detiene.
 *
 * Esta pantalla antes pedía elegir un bus de reemplazo de una lista de
 * máquinas libres. Era el modelo equivocado: la empresa no tiene buses
 * de sobra —la falta de máquinas es su mayor problema— y por eso el
 * mecanismo consiste en correr la fila, no en sacar uno de la reserva.
 */
export default function Corridas() {
  const [caidos, setCaidos] = useState([]);
  const [corridas, setCorridas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [dialogo, setDialogo] = useState(null);   // {bus, postura}
  const [cadena, setCadena] = useState(null);
  const [hasta, setHasta] = useState(0);          // cuántos eslabones se corren
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [dlgError, setDlgError] = useState(null);

  const [cierre, setCierre] = useState(null);     // corrida a cerrar
  const [busCierre, setBusCierre] = useState('');
  const [disponibles, setDisponibles] = useState([]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [t, b] = await Promise.all([
        axios.get('/api/operaciones/corridas/tablero/'),
        axios.get('/api/flota/buses/'),
      ]);
      setCaidos(t.data.caidos);
      setCorridas(t.data.corridas);
      setDisponibles(b.data.filter(x => x.estado === 'DISPONIBLE'));
    } catch (err) {
      console.error(err);
      setError('No se pudo cargar el tablero de corridas.');
    }
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  /* Al abrir, se pide al servidor la cascada que habría que hacer. No se
     calcula aquí: la regla de qué servicio arrastra a cuál es del
     dominio, y duplicarla en el navegador la dejaría desfasada. */
  const abrir = async (bus, postura) => {
    setDialogo({ bus, postura });
    setCadena(null);
    setMotivo('');
    setDlgError(null);
    try {
      const { data } = await axios.get(
        `/api/operaciones/corridas/cadena/${postura.id}/`);
      setCadena(data);
      setHasta(data.length);
    } catch (err) {
      setDlgError(mensajeError(err, 'No se pudo calcular la cadena.'));
      setCadena([]);
    }
  };

  const registrar = async () => {
    setGuardando(true);
    setDlgError(null);
    try {
      await axios.post('/api/operaciones/corridas/', {
        bus_original_id: dialogo.bus.id,
        postura_id: dialogo.postura.id,
        motivo,
        hasta,
      });
      setDialogo(null);
      await cargar();
    } catch (err) {
      setDlgError(mensajeError(err, 'No se pudo registrar la corrida.'));
    }
    setGuardando(false);
  };

  const cerrar = async () => {
    setGuardando(true);
    setDlgError(null);
    try {
      await axios.post(`/api/operaciones/corridas/${cierre.id}/cerrar/`,
                       { bus_id: busCierre || null });
      setCierre(null);
      await cargar();
    } catch (err) {
      setDlgError(mensajeError(err, 'No se pudo cerrar la corrida.'));
    }
    setGuardando(false);
  };

  const activas = corridas.filter(c => c.estado === 'ACTIVA');
  const comprometidos = caidos.reduce((n, f) => n + f.posturas.length, 0);
  const tramo = cadena ? cadena.slice(0, hasta) : [];

  return (
    <>
      <div className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Gestión de Corridas</h1>
          <p className="page-subtitle">
            Adelanto de salidas cuando una máquina se cae
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={cargar} disabled={cargando}>
            <RefreshCw size={15} /> Actualizar
          </button>
        </div>
      </div>

      <div className="kpi-row">
        <Kpi icono={Navigation} tono="danger" valor={activas.length}
             label="Corridas activas" cargando={cargando} />
        <Kpi icono={BusIcon} tono="warn" valor={caidos.length}
             label="Máquinas caídas" cargando={cargando} />
        <Kpi icono={AlertTriangle} tono="danger" valor={comprometidos}
             label="Servicios comprometidos" cargando={cargando} />
      </div>

      {cargando && <div className="skeleton" style={{ height: 220 }} />}

      {!cargando && error && (
        <div className="card">
          <div className="empty-state">
            <span className="empty-icon"><AlertTriangle size={36} strokeWidth={1.5} /></span>
            <div className="empty-title">{error}</div>
            <button className="btn btn-secondary mt-4" onClick={cargar}>
              <RefreshCw size={15} /> Reintentar
            </button>
          </div>
        </div>
      )}

      {!cargando && !error && (
        <div className="stack">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Requieren correr la fila</span>
            </div>
            <div className="card-body">
              {caidos.length === 0 ? (
                <div className="empty-state" style={{ padding: 'var(--sp-8) var(--sp-4)' }}>
                  <span className="empty-icon"><CheckCircle2 size={32} strokeWidth={1.5} /></span>
                  <div className="empty-title">Sin máquinas caídas con servicios</div>
                  <p className="empty-sub">
                    Ningún bus en el pozo tiene salidas por delante.
                  </p>
                </div>
              ) : caidos.map(fila => (
                <div className="mini-card" key={fila.bus.id}>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="td-bus-num">{fila.bus.numero}</span>
                        <span className="badge danger">
                          <span className="badge-dot danger" />
                          {fila.bus.estado === 'MANTENIMIENTO'
                            ? 'En el pozo' : 'Fuera de servicio'}
                        </span>
                      </div>
                      <div className="alert-item-sub mt-1">
                        {fila.posturas.length}{' '}
                        {fila.posturas.length === 1 ? 'salida' : 'salidas'} por delante
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col gap-2">
                    {fila.posturas.map(p => (
                      <div className="flex items-center justify-between gap-3 flex-wrap"
                           key={p.id}>
                        <span className="flex items-center gap-3">
                          <span className="td-hora">{p.hora_salida.slice(0, 5)}</span>
                          <span className="mono fs-12">{p.codigo}</span>
                          <span className="fs-12 text-muted">
                            {p.ruta.origen.nombre} → {p.ruta.destino.nombre}
                          </span>
                        </span>
                        <button className="btn btn-primary btn-sm"
                                onClick={() => abrir(fila.bus, p)}>
                          <Navigation size={14} /> Correr la fila
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="kpi-icon-wrap neutral" style={{ width: 28, height: 28 }}>
                <History size={15} />
              </span>
              <span className="card-title">Historial</span>
            </div>
            <div className="card-body">
              {corridas.length === 0 ? (
                <div className="empty-state" style={{ padding: 'var(--sp-8) var(--sp-4)' }}>
                  <span className="empty-icon"><History size={32} strokeWidth={1.5} /></span>
                  <div className="empty-title">Sin corridas registradas</div>
                </div>
              ) : corridas.map(c => (
                <div className="mini-card" key={c.id}>
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                    <span className="flex items-center gap-3">
                      <span className="fw-600">Cayó el {c.bus_original.numero}</span>
                      <span className={`badge ${c.estado === 'ACTIVA' ? 'danger' : 'ok'}`}>
                        {c.estado === 'ACTIVA' ? 'Activa' : 'Cerrada'}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="alert-item-time">{hace(c.creado_en)}</span>
                      {c.estado === 'ACTIVA' && (
                        <button className="btn btn-ok btn-sm"
                                onClick={() => {
                                  setCierre(c);
                                  setBusCierre('');
                                  setDlgError(null);
                                }}>
                          <CheckCircle2 size={14} /> Detener corrida
                        </button>
                      )}
                    </span>
                  </div>

                  <p className="alert-item-sub mb-2">{c.motivo}</p>

                  <Cadena movimientos={c.movimientos} />

                  {c.postura_en_espera && (
                    <div className="notice warn mt-3">
                      <span className="notice-icon"><Wrench size={16} /></span>
                      <div className="notice-content">
                        <div className="notice-desc">
                          {c.postura_en_espera.codigo} espera la máquina del pozo.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Correr la fila ── */}
      <DialogoForm
        abierto={Boolean(dialogo)}
        titulo="Correr la fila"
        onCerrar={() => setDialogo(null)}
        onGuardar={registrar}
        guardando={guardando}
        error={dlgError}
        disabled={!motivo.trim() || !cadena || cadena.length === 0}
        guardarLabel="Registrar corrida"
      >
        {dialogo && (
          <div className="notice warn">
            <span className="notice-icon"><AlertTriangle size={16} /></span>
            <div className="notice-content">
              <div className="notice-title">
                El {dialogo.bus.numero} no puede salir a las{' '}
                {dialogo.postura.hora_salida.slice(0, 5)}
              </div>
              <div className="notice-desc">
                Las salidas siguientes se adelantan una máquina cada una.
              </div>
            </div>
          </div>
        )}

        {cadena === null && <div className="skeleton" style={{ height: 120 }} />}

        {cadena?.length === 0 && (
          <div className="info-box danger">
            No hay salidas posteriores desde ese origen para correr la fila.
            Habrá que cubrir el servicio de otra forma.
          </div>
        )}

        {cadena?.length > 0 && (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="corr-hasta">
                Hasta dónde se corre
              </label>
              <select id="corr-hasta" className="form-input form-select"
                      value={hasta}
                      onChange={e => setHasta(Number(e.target.value))}>
                {cadena.map((_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1} {i === 0 ? 'servicio' : 'servicios'}
                  </option>
                ))}
              </select>
              <p className="empty-sub mt-1">
                El último de la cadena queda esperando la máquina del pozo.
              </p>
            </div>

            <div>
              <div className="section-label">Cómo queda la fila</div>
              <div className="rank-list">
                {tramo.map((paso, i) => {
                  const entra = i === tramo.length - 1 ? null : paso.bus_entrante;
                  return (
                    <div className="corrida-flow" key={paso.postura.id}>
                      <div className="flex-1" style={{ minWidth: 0 }}>
                        <div className="flex items-center gap-2">
                          <Clock size={12} className="text-muted" />
                          <span className="td-hora">
                            {paso.postura.hora_salida.slice(0, 5)}
                          </span>
                          <span className="mono fs-11">{paso.postura.codigo}</span>
                        </div>
                        <div className="fs-11 text-muted flex items-center gap-1 mt-1">
                          <MapPin size={11} />
                          {paso.postura.ruta.origen.nombre} → {paso.postura.ruta.destino.nombre}
                        </div>
                      </div>
                      <div className="corrida-bus original">
                        <span className="bus-lbl">Sale</span>
                        <span className="bus-num">
                          {paso.bus_saliente?.numero ?? '—'}
                        </span>
                      </div>
                      <span className="corrida-arrow"><ArrowRight size={16} /></span>
                      <div className={`corrida-bus ${entra ? 'sustituto' : 'original'}`}>
                        <span className="bus-lbl">{entra ? 'Entra' : 'Espera'}</span>
                        <span className="bus-num">{entra?.numero ?? '—'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="corr-motivo">Motivo</label>
          <textarea
            id="corr-motivo" className="form-input" rows={3}
            placeholder="Ej: fuga de aire en los circuitos, entra al pozo…"
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
          />
        </div>
      </DialogoForm>

      {/* ── Detener la corrida ── */}
      <DialogoForm
        abierto={Boolean(cierre)}
        titulo="Detener la corrida"
        onCerrar={() => setCierre(null)}
        onGuardar={cerrar}
        guardando={guardando}
        error={dlgError}
        disabled={Boolean(cierre?.postura_en_espera) && !busCierre}
        guardarLabel="Detener"
      >
        {cierre?.postura_en_espera ? (
          <>
            <div className="info-box">
              La corrida se detiene cuando la máquina sale del pozo y toma el
              servicio que quedó descubierto:{' '}
              <strong>{cierre.postura_en_espera.codigo}</strong>, que sale a
              las {cierre.postura_en_espera.hora_salida.slice(0, 5)}.
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="corr-bus">
                Máquina que lo cubre
              </label>
              <select id="corr-bus" className="form-input form-select"
                      value={busCierre}
                      onChange={e => setBusCierre(e.target.value)}>
                <option value="">Elige…</option>
                {disponibles.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.numero} · {b.patente}
                  </option>
                ))}
              </select>
              {disponibles.length === 0 && (
                <p className="empty-sub mt-1">
                  No hay máquinas disponibles. Libera una en el taller primero.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="info-box">
            Todos los servicios de esta corrida quedaron con máquina. Se puede
            cerrar.
          </div>
        )}
      </DialogoForm>
    </>
  );
}

/* ── Piezas ────────────────────────────────────────────── */
function Kpi({ icono: Icono, tono, valor, label, cargando }) {
  return (
    <div className="kpi-card">
      <span className={`kpi-icon-wrap ${tono}`}><Icono size={18} /></span>
      <div className="kpi-body">
        <div className="kpi-value">{cargando ? '—' : valor}</div>
        <div className="kpi-label">{label}</div>
      </div>
    </div>
  );
}

function Cadena({ movimientos }) {
  if (!movimientos?.length) return null;
  return (
    <div className="data-list">
      {movimientos.map(m => (
        <div className="data-row" key={m.id}>
          <span className="data-row-key">
            <span className="td-hora">{m.postura.hora_salida.slice(0, 5)}</span>
            {' '}
            <span className="mono fs-11">{m.postura.codigo}</span>
          </span>
          <span className="data-row-val">
            {m.bus_saliente?.numero ?? '—'}
            {' → '}
            {m.bus_entrante
              ? m.bus_entrante.numero
              : <span className="text-warn">espera</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
