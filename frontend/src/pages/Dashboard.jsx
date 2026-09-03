import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from '../api';
import { useAuth } from '../context/AuthContext';
import { findNavItem, tituloDe } from '../config/navigation';
import { hace, fechaLarga } from '../utils/formato';
import {
  Bus, MapPin, AlertCircle, Wrench, ChevronRight, CheckCircle2,
  ClipboardCheck, Clock, RefreshCw, Inbox, Activity,
  ShieldCheck, CircleDot,
} from 'lucide-react';

/* Cada KPI que manda el backend trae su `id`; el icono se decide
   aquí porque es decisión de presentación, no del dominio. */
const ICONOS = {
  servicios: MapPin, listas: CheckCircle2, disponibles: Bus, taller: Wrench,
  bandeja: Inbox, abiertas: ClipboardCheck, proceso: Activity,
  inmovilizados: AlertCircle,
  asignadas: MapPin, incidentes: AlertCircle,
};

const ESTADO_ORDEN = {
  SIN_ASIGNAR: 'neutral', PENDIENTE: 'warn',
  EN_PROCESO: 'info', COMPLETADO: 'ok',
};

export default function Dashboard() {
  const { sesion } = useAuth();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await axios.get('/api/reportes/dashboard/');
      setDatos(res.data);
    } catch (err) {
      console.error(err);
      setError('No se pudo cargar el tablero.');
    }
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <>
      <div className="page-header">
        <div className="page-heading">
          <h1 className="page-title">{tituloDe(findNavItem('/'), sesion.rol)}</h1>
          <p className="page-subtitle">
            {datos ? fechaLarga(datos.fecha) : 'Cargando estado de la operación…'}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={cargar} disabled={cargando}>
            <RefreshCw size={15} /> Actualizar
          </button>
        </div>
      </div>

      {cargando && <Esqueleto />}

      {!cargando && error && (
        <div className="card">
          <div className="empty-state">
            <span className="empty-icon"><AlertCircle size={36} strokeWidth={1.5} /></span>
            <div className="empty-title">{error}</div>
            <p className="empty-sub">Revisa que el servidor de Django esté corriendo.</p>
            <button className="btn btn-secondary mt-4" onClick={cargar}>
              <RefreshCw size={15} /> Reintentar
            </button>
          </div>
        </div>
      )}

      {!cargando && !error && datos && (
        <>
          <FilaKpis kpis={datos.kpis} />
          {datos.perfil === 'OPERACIONES' && <PanelOperaciones datos={datos} />}
          {datos.perfil === 'TALLER' && <PanelTaller datos={datos} />}
          {datos.perfil === 'TRIPULACION' && <PanelTripulacion datos={datos} />}
        </>
      )}
    </>
  );
}

/* ── KPIs ──────────────────────────────────────────────── */
function FilaKpis({ kpis }) {
  return (
    <div className="kpi-row">
      {kpis.map(k => {
        const Icono = ICONOS[k.id] ?? CircleDot;
        return (
          <div className="kpi-card" key={k.id}>
            <span className={`kpi-icon-wrap ${k.tono}`}><Icono size={18} /></span>
            <div className="kpi-body">
              <div className="kpi-value">
                {k.valor}
                {k.total !== undefined && (
                  <span className="kpi-total">de {k.total}</span>
                )}
              </div>
              <div className="kpi-label">{k.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Alertas ───────────────────────────────────────────── */
function Alertas({ alertas, total, vacio }) {
  const ocultas = (total ?? alertas.length) - alertas.length;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Requiere atención</span>
        {total > 0 && <span className="badge danger">{total}</span>}
      </div>
      <div className="card-body">
        {alertas.length === 0 && (
          <div className="empty-state" style={{ padding: 'var(--sp-8) var(--sp-4)' }}>
            <span className="empty-icon"><ShieldCheck size={32} strokeWidth={1.5} /></span>
            <div className="empty-title">Nada pendiente</div>
            <p className="empty-sub">{vacio}</p>
          </div>
        )}

        {alertas.map((a, i) => (
          <Link to={a.ruta} className="alert-item" key={`${a.titulo}-${i}`}>
            <span className={`alert-item-icon ${a.nivel}`}><AlertCircle size={15} /></span>
            <div className="flex-1">
              <div className="alert-item-text">{a.titulo}</div>
              <div className="alert-item-sub">{a.detalle}</div>
            </div>
            <span className="alert-item-time">
              {a.momento ? hace(a.momento) : a.referencia}
            </span>
          </Link>
        ))}

        {ocultas > 0 && (
          <p className="empty-sub mt-4 text-center">
            y {ocultas} {ocultas === 1 ? 'aviso más' : 'avisos más'} en sus pantallas.
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Operaciones ───────────────────────────────────────── */
function PanelOperaciones({ datos }) {
  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-header">
          <span className="card-title">Próximas salidas</span>
          <Link to="/planificacion" className="btn btn-ghost btn-sm">
            Ver todas <ChevronRight size={14} />
          </Link>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {datos.proximas.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--sp-8) var(--sp-4)' }}>
              <span className="empty-icon"><Clock size={32} strokeWidth={1.5} /></span>
              <div className="empty-title">No quedan salidas por delante</div>
              <p className="empty-sub">Todas las posturas programadas ya partieron.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Servicio</th>
                    <th>Bus</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.proximas.map(p => (
                    <tr key={p.id}>
                      <td data-label="Hora">
                        <span className="td-hora">{p.hora_salida.slice(0, 5)}</span>
                      </td>
                      <td data-label="Servicio">
                        <div className="td-ruta-main">
                          {p.ruta.origen.nombre} → {p.ruta.destino.nombre}
                        </div>
                        <div className="td-ruta-sub mono">{p.codigo}</div>
                      </td>
                      <td data-label="Bus">
                        {p.bus
                          ? <span className="td-bus-num">{p.bus.numero}</span>
                          : <span className="badge warn">
                              <span className="badge-dot warn" />Sin bus
                            </span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Alertas alertas={datos.alertas} total={datos.alertas_total}
               vacio="No hay corridas, fallas graves ni servicios incompletos." />
    </div>
  );
}

/* ── Taller ────────────────────────────────────────────── */
function PanelTaller({ datos }) {
  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-header">
          <span className="card-title">Órdenes abiertas</span>
          <Link to="/mantenimiento" className="btn btn-ghost btn-sm">
            Ir al taller <ChevronRight size={14} />
          </Link>
        </div>
        <div className="card-body">
          {datos.ordenes.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--sp-8) var(--sp-4)' }}>
              <span className="empty-icon"><Wrench size={32} strokeWidth={1.5} /></span>
              <div className="empty-title">Taller al día</div>
              <p className="empty-sub">Ninguna orden de trabajo pendiente.</p>
            </div>
          ) : datos.ordenes.map(o => (
            <div className="mini-card" key={o.id}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div className="flex items-center gap-3">
                    <span className="mono fw-800 fs-11">{o.codigo}</span>
                    <span className="tag">{o.especialidad_label}</span>
                  </div>
                  <div className="alert-item-sub truncate mt-1">{o.descripcion}</div>
                </div>
                <div className="text-right">
                  <span className={`badge ${ESTADO_ORDEN[o.estado] ?? 'neutral'}`}>
                    bus {o.bus.numero}
                  </span>
                  <div className="alert-item-time mt-1">
                    {o.mecanico ? o.mecanico.nombre.split(' ')[0] : 'sin asignar'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Alertas alertas={datos.alertas} total={datos.alertas_total}
               vacio="Ninguna falla de gravedad alta esperando triaje." />
    </div>
  );
}

/* ── Tripulación (celular) ─────────────────────────────── */
function PanelTripulacion({ datos }) {
  const { checklist_pendiente: pendiente } = datos;

  return (
    <div className="stack">
      {pendiente && (
        <div className="notice info">
          <span className="notice-icon"><ClipboardCheck size={16} /></span>
          <div className="notice-content">
            <div className="notice-title">Tienes un checklist sin terminar</div>
            <div className="notice-desc">
              Bus {pendiente.bus.numero} · {pendiente.total_respuestas} ítems respondidos.
            </div>
          </div>
          <Link to="/checklist" className="btn btn-primary btn-sm ml-auto">
            Continuar
          </Link>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Mis próximos servicios</span>
        </div>
        <div className="card-body">
          {datos.proximas.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--sp-8) var(--sp-4)' }}>
              <span className="empty-icon"><MapPin size={32} strokeWidth={1.5} /></span>
              <div className="empty-title">Sin servicios asignados</div>
              <p className="empty-sub">
                Cuando Operaciones te asigne a una postura, aparecerá aquí.
              </p>
            </div>
          ) : datos.proximas.map(p => (
            <div className="mini-card" key={p.id}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="td-hora">{p.hora_salida.slice(0, 5)}</div>
                  <div className="td-ruta-sub">{fechaLarga(p.fecha)}</div>
                </div>
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div className="td-ruta-main truncate">
                    {p.ruta.origen.nombre} → {p.ruta.destino.nombre}
                  </div>
                  <div className="td-ruta-sub mono">{p.codigo}</div>
                </div>
                <span className="td-bus-num">
                  {p.bus ? p.bus.numero : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="card-footer">
          <Link to="/checklist" className="btn btn-primary w-full">
            <ClipboardCheck size={15} /> Hacer checklist de salida
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── Carga ─────────────────────────────────────────────── */
function Esqueleto() {
  return (
    <>
      <div className="kpi-row">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 76 }} />
        ))}
      </div>
      <div className="grid-2">
        {[0, 1].map(i => (
          <div key={i} className="skeleton" style={{ height: 280 }} />
        ))}
      </div>
    </>
  );
}
