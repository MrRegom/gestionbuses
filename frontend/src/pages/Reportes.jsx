import { useState, useEffect, useCallback } from 'react';
import axios from '../api';
import { numero, porcentaje, isoDeFecha } from '../utils/formato';
import {
  BarChart3, TrendingUp, AlertCircle, RefreshCw, Wrench,
  ClipboardCheck, Navigation, Bus, CalendarRange, Info,
} from 'lucide-react';

/* Etiquetas legibles de los códigos que devuelve el backend. Están
   aquí y no en el servidor porque son texto de pantalla; el dominio
   sigue hablando en códigos. */
const ESTADO_POSTURA = {
  LISTA: 'Lista', ALERTA: 'Alerta', PROBLEMA: 'Problema',
  EN_CURSO: 'En curso', COMPLETA: 'Completa',
};
const MOMENTO = { SALIDA: 'Salida', LLEGADA: 'Llegada' };
const GRAVEDAD = { ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' };
const ORIGEN = { CHECKLIST: 'Detectado en checklist', RUTA: 'Reportado en ruta' };
const ESTADO_ORDEN = {
  SIN_ASIGNAR: 'Sin asignar', PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso', COMPLETADO: 'Completado',
};
const ESPECIALIDAD = {
  MOTOR: 'Motor', FRENOS: 'Frenos', SUSPENSION: 'Suspensión',
  ELECTRICO: 'Eléctrico', CARROCERIA: 'Carrocería', GENERAL: 'General',
};
const ESTADO_BUS = {
  DISPONIBLE: 'Disponible', EN_SERVICIO: 'En servicio',
  MANTENIMIENTO: 'Mantenimiento', FUERA_SERVICIO: 'Fuera de servicio',
};

function rangoPorDefecto() {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(desde.getDate() - 29);
  return { desde: isoDeFecha(desde), hasta: isoDeFecha(hasta) };
}

export default function Reportes() {
  const [rango, setRango] = useState(rangoPorDefecto);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await axios.get('/api/reportes/indicadores/', { params: rango });
      setDatos(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error ?? 'No se pudieron calcular los indicadores.');
    }
    setCargando(false);
  }, [rango]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <>
      <div className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Reportes y Auditoría</h1>
          <p className="page-subtitle">
            {datos
              ? `${datos.periodo.dias} días de operación · ${datos.periodo.desde} a ${datos.periodo.hasta}`
              : 'Indicadores calculados sobre la operación registrada'}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={cargar} disabled={cargando}>
            <RefreshCw size={15} /> Actualizar
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <CalendarRange size={15} className="text-muted" />
        <input
          type="date" className="form-input" aria-label="Desde"
          value={rango.desde}
          max={rango.hasta}
          onChange={e => setRango({ ...rango, desde: e.target.value })}
        />
        <span className="text-muted fs-11">hasta</span>
        <input
          type="date" className="form-input" aria-label="Hasta"
          value={rango.hasta}
          min={rango.desde}
          onChange={e => setRango({ ...rango, hasta: e.target.value })}
        />
        <button className="btn btn-ghost btn-sm ml-auto" onClick={() => setRango(rangoPorDefecto())}>
          Últimos 30 días
        </button>
      </div>

      {cargando && (
        <div className="stack">
          <div className="skeleton" style={{ height: 90 }} />
          <div className="skeleton" style={{ height: 260 }} />
          <div className="skeleton" style={{ height: 260 }} />
        </div>
      )}

      {!cargando && error && (
        <div className="card">
          <div className="empty-state">
            <span className="empty-icon"><AlertCircle size={36} strokeWidth={1.5} /></span>
            <div className="empty-title">{error}</div>
            <button className="btn btn-secondary mt-4" onClick={cargar}>
              <RefreshCw size={15} /> Reintentar
            </button>
          </div>
        </div>
      )}

      {!cargando && !error && datos && <Informe d={datos} />}
    </>
  );
}

function Informe({ d }) {
  const sinActividad =
    d.posturas.total === 0 && d.checklists.total === 0 &&
    d.incidentes.total === 0 && d.ordenes.total === 0;

  return (
    <div className="stack">
      <div className="kpi-row">
        <Kpi icono={TrendingUp} tono="info" label="Servicios programados"
             valor={d.posturas.total} />
        <Kpi icono={ClipboardCheck} tono="ok" label="Checklists realizados"
             valor={d.checklists.total} />
        <Kpi icono={AlertCircle} tono="warn" label="Incidentes reportados"
             valor={d.incidentes.total} />
        <Kpi icono={Navigation} tono="danger" label="Corridas"
             valor={d.corridas.total} />
      </div>

      {sinActividad && (
        <div className="notice info">
          <span className="notice-icon"><Info size={16} /></span>
          <div className="notice-content">
            <div className="notice-title">Sin actividad registrada en este período</div>
            <div className="notice-desc">
              Los indicadores se calculan sobre lo que el sistema tiene guardado.
              Amplía el rango de fechas o registra operación para verlos poblarse.
            </div>
          </div>
        </div>
      )}

      <div className="grid-2">
        <Tarjeta titulo="Fallas más frecuentes" icono={Wrench}
                 pie="Ítems del checklist que más veces se marcaron con falla.">
          <Ranking
            filas={d.checklists.fallas_frecuentes.map(f => ({
              label: f.item,
              sub: f.critico ? `${f.categoria} · crítico` : f.categoria,
              n: f.veces,
              tono: f.critico ? 'danger' : 'warn',
            }))}
            vacio="Ningún ítem registró fallas en el período."
          />
        </Tarjeta>

        <Tarjeta titulo="Máquinas que obligan a rearmar" icono={Navigation}
                 pie="Buses que más corridas provocaron. Es la pregunta que el papel no respondía.">
          <Ranking
            filas={d.corridas.buses_reincidentes.map(b => ({
              label: `Bus ${b.bus}`, n: b.veces, tono: 'danger',
            }))}
            vacio="No hubo corridas en el período."
          />
        </Tarjeta>
      </div>

      <div className="grid-2">
        <Tarjeta titulo="Planificación" icono={TrendingUp}>
          <div className="cifra-grid mb-4">
            <Cifra label="Programados" valor={d.posturas.total} />
            <Cifra label="Con bus y tripulación" valor={d.posturas.con_recursos} />
            <Cifra label="Incompletos" valor={d.posturas.sin_recursos} />
          </div>
          <Barra parte={d.posturas.con_recursos} total={d.posturas.total}
                 texto="servicios que salieron con todos sus recursos" />
          <Distribucion titulo="Por estado" datos={d.posturas.por_estado} etiquetas={ESTADO_POSTURA} />
        </Tarjeta>

        <Tarjeta titulo="Revisiones" icono={ClipboardCheck}>
          <div className="cifra-grid mb-4">
            <Cifra label="Realizados" valor={d.checklists.total} />
            <Cifra label="Completados" valor={d.checklists.completados} />
            <Cifra label="Con al menos una falla" valor={d.checklists.con_falla} />
          </div>
          <Barra parte={d.checklists.con_falla} total={d.checklists.total}
                 tono="warn" texto="revisiones que detectaron algo" />
          <Distribucion titulo="Por momento" datos={d.checklists.por_momento} etiquetas={MOMENTO} />
        </Tarjeta>
      </div>

      <div className="grid-2">
        <Tarjeta titulo="Incidentes" icono={AlertCircle}>
          <div className="cifra-grid mb-4">
            <Cifra label="Reportados" valor={d.incidentes.total} />
            <Cifra label="Abiertos" valor={d.incidentes.abiertos} />
            <Cifra label="Resueltos" valor={d.incidentes.resueltos} />
          </div>
          <Distribucion titulo="Por gravedad" datos={d.incidentes.por_gravedad} etiquetas={GRAVEDAD} />
          <Distribucion titulo="Por origen" datos={d.incidentes.por_origen} etiquetas={ORIGEN} />
        </Tarjeta>

        <Tarjeta titulo="Taller" icono={Wrench}
                 pie="El ciclo mide desde que se abre la orden; el trabajo, desde que el mecánico la toma.">
          <div className="cifra-grid mb-4">
            <Cifra label="Órdenes" valor={d.ordenes.total} />
            <Cifra label="Completadas" valor={d.ordenes.completadas} />
            <Cifra label="Ciclo promedio"
                   valor={d.ordenes.horas_promedio_ciclo}
                   sufijo=" h" />
            <Cifra label="Trabajo promedio"
                   valor={d.ordenes.horas_promedio_taller}
                   sufijo=" h" />
          </div>
          <Distribucion titulo="Por estado" datos={d.ordenes.por_estado} etiquetas={ESTADO_ORDEN} />
          <Distribucion titulo="Por especialidad" datos={d.ordenes.por_especialidad} etiquetas={ESPECIALIDAD} />
        </Tarjeta>
      </div>

      <Tarjeta titulo="Flota" icono={Bus}
               pie="El estado de los buses es la foto de ahora: no se guarda su historial.">
        <div className="grid-2">
          <Distribucion titulo="Estado actual" datos={d.flota.por_estado} etiquetas={ESTADO_BUS} />
          <div>
            <div className="section-label">Buses con más fallas en el período</div>
            <Ranking
              filas={d.flota.buses_con_mas_fallas.map(b => ({
                label: `Bus ${b.bus}`, n: b.incidentes, tono: 'warn',
              }))}
              vacio="Ningún bus registró incidentes."
            />
          </div>
        </div>
      </Tarjeta>
    </div>
  );
}

/* ── Piezas ────────────────────────────────────────────── */
function Kpi({ icono: Icono, tono, label, valor }) {
  return (
    <div className="kpi-card">
      <span className={`kpi-icon-wrap ${tono}`}><Icono size={18} /></span>
      <div className="kpi-body">
        <div className="kpi-value">{numero(valor)}</div>
        <div className="kpi-label">{label}</div>
      </div>
    </div>
  );
}

function Tarjeta({ titulo, icono: Icono, pie, children }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="kpi-icon-wrap neutral" style={{ width: 28, height: 28 }}>
          <Icono size={15} />
        </span>
        <span className="card-title">{titulo}</span>
      </div>
      <div className="card-body">{children}</div>
      {pie && <div className="card-footer"><span className="empty-sub">{pie}</span></div>}
    </div>
  );
}

function Cifra({ label, valor, sufijo = '' }) {
  // `null` es "no hay con qué calcularlo", distinto de cero.
  const vacio = valor === null || valor === undefined;
  return (
    <div className="stat-box">
      <div className="stat-box-label">{label}</div>
      <div className="stat-box-value">
        {vacio ? '—' : `${numero(valor)}${sufijo}`}
      </div>
    </div>
  );
}

function Barra({ parte, total, texto, tono = 'ok' }) {
  if (!total) return null;
  const pct = porcentaje(parte, total);
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <span className="empty-sub">{parte} de {total} {texto}</span>
        <span className="rank-n">{pct}%</span>
      </div>
      <div className="progress-track">
        <div className={`progress-fill ${tono}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Distribucion({ titulo, datos, etiquetas }) {
  const filas = Object.entries(datos ?? {});
  if (filas.length === 0) return null;

  filas.sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div className="section-label mt-4">{titulo}</div>
      <div className="data-list">
        {filas.map(([clave, n]) => (
          <div className="data-row" key={clave}>
            <span className="data-row-key">{etiquetas[clave] ?? clave}</span>
            <span className="data-row-val">{numero(n)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Ranking({ filas, vacio }) {
  if (filas.length === 0) {
    return (
      <div className="empty-state" style={{ padding: 'var(--sp-6) var(--sp-4)' }}>
        <span className="empty-icon"><BarChart3 size={30} strokeWidth={1.5} /></span>
        <p className="empty-sub">{vacio}</p>
      </div>
    );
  }

  // La barra compara dentro de la lista: el primero llena el ancho y
  // el resto se mide contra él. No es un porcentaje sobre un total.
  const tope = Math.max(...filas.map(f => f.n));

  return (
    <div className="rank-list">
      {filas.map(f => (
        <div className="rank-row" key={f.label}>
          <div>
            <div className="rank-label truncate">{f.label}</div>
            {f.sub && <div className="rank-sub">{f.sub}</div>}
          </div>
          <span className="rank-n">{f.n}</span>
          <div className="progress-track">
            <div className={`progress-fill ${f.tono}`}
                 style={{ width: `${(f.n / tope) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
