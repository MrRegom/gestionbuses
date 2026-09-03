import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  Wrench, AlertTriangle, Clock, CheckCircle2, AlertCircle,
  RefreshCw, X, Inbox, Play, UserPlus, ClipboardCheck, Bus as BusIcon,
} from 'lucide-react';

const COLUMNAS = [
  { estado: 'SIN_ASIGNAR', titulo: 'Sin asignar', sub: 'Requiere mecánico' },
  { estado: 'PENDIENTE',   titulo: 'Pendiente',   sub: 'En espera de inicio' },
  { estado: 'EN_PROCESO',  titulo: 'En proceso',  sub: 'Orden activa' },
  { estado: 'COMPLETADO',  titulo: 'Completado',  sub: 'Trabajo cerrado' },
];

const ESPECIALIDADES = [
  /* Los oficios del taller, tal como los nombró Operaciones: el jefe de
     mecánicos lee el checklist y reparte según quién sabe hacer cada
     cosa. No son áreas del bus, son personas. */
  ['MECANICO', 'Mecánico'], ['ELECTRICO', 'Eléctrico'],
  ['CARROCERO', 'Carrocero'], ['VULCANIZADOR', 'Vulcanizador'],
  ['INFORMATICA', 'Informática'],
];

const PRIORIDADES = [['ALTA', 'Alta'], ['MEDIA', 'Media'], ['BAJA', 'Baja']];
const PRIORIDAD_BADGE = { ALTA: 'danger', MEDIA: 'warn', BAJA: 'neutral' };

/* Diálogo genérico: las tres acciones del taller comparten forma. */
function Dialogo({ abierto, titulo, onCerrar, onConfirmar, confirmando,
                   error, confirmLabel, disabled, children }) {
  useEffect(() => {
    if (!abierto) return;
    const onKey = e => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto, onCerrar]);

  useEffect(() => {
    document.body.classList.toggle('no-scroll', abierto);
    return () => document.body.classList.remove('no-scroll');
  }, [abierto]);

  return createPortal(
    <div
      className={`modal-overlay ${abierto ? 'open' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-header">
          <span className="modal-title">{titulo}</span>
          <button className="btn-icon" onClick={onCerrar} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body flex flex-col gap-4">
          {error && (
            <div className="notice danger">
              <AlertCircle size={16} className="notice-icon" />
              <div className="notice-content">{error}</div>
            </div>
          )}
          {children}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button" className="btn btn-primary"
            onClick={onConfirmar} disabled={confirmando || disabled}
          >
            {confirmando ? <><span className="spinner" /> Guardando…</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function Mantenimiento() {
  const [bandeja, setBandeja] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [mecanicos, setMecanicos] = useState([]);
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [dialogo, setDialogo] = useState(null);   // {tipo, incidente|orden|bus}
  const [form, setForm] = useState({});
  const [confirmando, setConfirmando] = useState(false);
  const [dlgError, setDlgError] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rTab, rBuses] = await Promise.all([
        axios.get('/api/mantencion/tablero/'),
        axios.get('/api/flota/buses/'),
      ]);
      setBandeja(rTab.data.bandeja);
      setOrdenes(rTab.data.ordenes);
      setMecanicos(rTab.data.mecanicos);
      setBuses(rBuses.data);
    } catch (err) {
      console.error(err);
      setError('No se pudo cargar el tablero del taller.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrir = (tipo, dato, inicial = {}) => {
    setDialogo({ tipo, dato });
    setForm(inicial);
    setDlgError(null);
  };
  const cerrar = useCallback(() => { setDialogo(null); setDlgError(null); }, []);

  const ejecutar = async (url, body) => {
    setConfirmando(true);
    setDlgError(null);
    try {
      await axios.post(url, body);
      cerrar();
      await cargar();
    } catch (err) {
      setDlgError(err.response?.data?.error ?? 'No se pudo completar la acción.');
    }
    setConfirmando(false);
  };

  /* Acción directa, sin diálogo (iniciar trabajo). */
  const iniciar = async orden => {
    try {
      await axios.post(`/api/mantencion/ordenes/${orden.id}/iniciar/`);
      await cargar();
    } catch (err) {
      alert(err.response?.data?.error ?? 'No se pudo iniciar el trabajo.');
    }
  };

  const porEstado = estado => ordenes.filter(o => o.estado === estado);
  const enTaller = buses.filter(b => ['MANTENIMIENTO', 'FUERA_SERVICIO'].includes(b.estado));
  const completados = porEstado('COMPLETADO').length;

  if (loading) {
    return (
      <>
        <div className="page-header">
          <div className="page-heading">
            <h1 className="page-title">Taller y Mantenimiento</h1>
            <p className="page-subtitle">Bandeja de fallas y órdenes de trabajo</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 72 }} />)}
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="page-header">
          <div className="page-heading">
            <h1 className="page-title">Taller y Mantenimiento</h1>
            <p className="page-subtitle">Bandeja de fallas y órdenes de trabajo</p>
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
          <h1 className="page-title">Taller y Mantenimiento</h1>
          <p className="page-subtitle">Bandeja de fallas y órdenes de trabajo</p>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-icon-wrap danger"><Inbox size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">{bandeja.length}</div>
            <div className="kpi-label">Fallas sin triar</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap warn"><Wrench size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">{porEstado('EN_PROCESO').length}</div>
            <div className="kpi-label">En proceso</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap info"><Clock size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">{porEstado('SIN_ASIGNAR').length + porEstado('PENDIENTE').length}</div>
            <div className="kpi-label">En espera</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap ok"><CheckCircle2 size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">{completados}</div>
            <div className="kpi-label">Completados</div>
          </div>
        </div>
      </div>

      {/* ── Bandeja: fallas que aún no son trabajo ─────────────── */}
      {bandeja.length > 0 && (
        <div className="card mb-5">
          <div className="card-header">
            <span className="card-title">Bandeja de fallas</span>
            <span className="badge danger">{bandeja.length} sin triar</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {bandeja.map(inc => (
              <div className="alert-item" key={inc.id} style={{ padding: 'var(--sp-3) var(--sp-5)' }}>
                <span className={`alert-item-icon ${inc.gravedad === 'ALTA' ? 'danger' : 'neutral'}`}>
                  <AlertTriangle size={15} />
                </span>
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div className="alert-item-text">
                    <span className="mono">{inc.codigo}</span> · {inc.bus.numero}
                  </div>
                  <div className="alert-item-sub">{inc.descripcion}</div>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => abrir('orden', inc, { especialidad: 'GENERAL', prioridad: '' })}
                >
                  <Wrench size={13} /> Crear orden
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Kanban de órdenes ──────────────────────────────────── */}
      <div className="section-label">Órdenes de trabajo</div>
      <div className="kanban-board mb-5">
        {COLUMNAS.map(col => {
          const items = porEstado(col.estado);
          return (
            <div className="kanban-col" key={col.estado}>
              <div className="kanban-col-header">
                <div>
                  <div className="kanban-col-title">{col.titulo}</div>
                  <div className="fs-12 text-muted">{col.sub}</div>
                </div>
                <span className="kanban-col-count">{items.length}</span>
              </div>
              <div className="kanban-items">
                {items.length === 0 && (
                  <div className="fs-12 text-muted text-center p-3">Sin órdenes</div>
                )}
                {items.map(o => (
                  <div className="kanban-card" key={o.id}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="fw-600 fs-13 mono">{o.codigo}</span>
                      <span className={`badge ${PRIORIDAD_BADGE[o.prioridad]}`}>
                        {o.prioridad}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 fs-12 text-muted mb-2">
                      <BusIcon size={12} /> {o.bus.numero}
                      <span className="tag">{o.especialidad_label}</span>
                    </div>
                    <div className="fs-12 text-secondary mb-3">{o.descripcion}</div>

                    {o.mecanico && (
                      <div className="fs-12 text-muted mb-3">
                        {o.mecanico.nombre}{o.pozo ? ` · Pozo ${o.pozo}` : ''}
                      </div>
                    )}

                    {o.estado === 'SIN_ASIGNAR' && (
                      <button
                        className="btn btn-secondary btn-sm w-full"
                        onClick={() => abrir('asignar', o, { mecanico_id: '', pozo: '' })}
                      >
                        <UserPlus size={13} /> Asignar mecánico
                      </button>
                    )}
                    {o.estado === 'PENDIENTE' && (
                      <button className="btn btn-primary btn-sm w-full" onClick={() => iniciar(o)}>
                        <Play size={13} /> Iniciar trabajo
                      </button>
                    )}
                    {o.estado === 'EN_PROCESO' && (
                      <button
                        className="btn btn-ok btn-sm w-full"
                        onClick={() => abrir('completar', o, { diagnostico: '' })}
                      >
                        <ClipboardCheck size={13} /> Completar
                      </button>
                    )}
                    {o.estado === 'COMPLETADO' && o.diagnostico && (
                      <div className="fs-12 text-muted" style={{ fontStyle: 'italic' }}>
                        {o.diagnostico}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Decisión final: liberar o dejar caído ──────────────── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Buses en taller</span>
          <span className="badge neutral">{enTaller.length}</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {enTaller.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon"><CheckCircle2 size={36} strokeWidth={1.5} /></span>
              <div className="empty-title">Ningún bus en taller</div>
              <p className="empty-sub">Toda la flota está operativa.</p>
            </div>
          )}
          {enTaller.map(b => {
            const abiertas = ordenes.filter(
              o => o.bus.id === b.id && o.estado !== 'COMPLETADO'
            );
            return (
              <div className="alert-item" key={b.id} style={{ padding: 'var(--sp-3) var(--sp-5)' }}>
                <span className={`alert-item-icon ${b.estado === 'FUERA_SERVICIO' ? 'danger' : 'warn'}`}>
                  <BusIcon size={15} />
                </span>
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div className="alert-item-text">{b.numero} · {b.patente}</div>
                  <div className="alert-item-sub">
                    {b.estado.replace('_', ' ')}
                    {abiertas.length > 0
                      ? ` · ${abiertas.length} orden(es) sin terminar`
                      : ' · sin trabajo pendiente'}
                  </div>
                </div>
                <div className="flex gap-2" style={{ flexShrink: 0 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => abrir('no-operativo', b, { motivo: '' })}
                  >
                    No operativo
                  </button>
                  <button
                    className="btn btn-ok btn-sm"
                    disabled={abiertas.length > 0}
                    title={abiertas.length > 0 ? 'Quedan órdenes sin terminar' : 'Devolver a la flota'}
                    onClick={() => ejecutar(`/api/mantencion/buses/${b.id}/liberar/`)}
                  >
                    Liberar bus
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Diálogos ───────────────────────────────────────────── */}
      <Dialogo
        abierto={dialogo?.tipo === 'orden'}
        titulo="Crear orden de trabajo"
        confirmLabel="Crear orden"
        onCerrar={cerrar}
        confirmando={confirmando}
        error={dlgError}
        onConfirmar={() => ejecutar('/api/mantencion/ordenes/', {
          incidente_id: dialogo.dato.id,
          especialidad: form.especialidad,
          prioridad: form.prioridad || null,
        })}
      >
        {dialogo?.tipo === 'orden' && (
          <>
            <div className="info-box">
              <div className="fw-600 mb-1 mono">{dialogo.dato.codigo} · {dialogo.dato.bus.numero}</div>
              <div className="fs-12 text-secondary">{dialogo.dato.descripcion}</div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ot-esp">Especialidad</label>
              <select
                id="ot-esp" className="form-input form-select"
                value={form.especialidad ?? 'GENERAL'}
                onChange={e => setForm({ ...form, especialidad: e.target.value })}
              >
                {ESPECIALIDADES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ot-pri">Prioridad</label>
              <select
                id="ot-pri" className="form-input form-select"
                value={form.prioridad ?? ''}
                onChange={e => setForm({ ...form, prioridad: e.target.value })}
              >
                <option value="">
                  {dialogo.dato.gravedad
                    ? `Heredar de la gravedad (${dialogo.dato.gravedad})`
                    : 'Media — la falla aún no está clasificada'}
                </option>
                {PRIORIDADES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </>
        )}
      </Dialogo>

      <Dialogo
        abierto={dialogo?.tipo === 'asignar'}
        titulo="Asignar mecánico"
        confirmLabel="Asignar"
        disabled={!form.mecanico_id}
        onCerrar={cerrar}
        confirmando={confirmando}
        error={dlgError}
        onConfirmar={() => ejecutar(
          `/api/mantencion/ordenes/${dialogo.dato.id}/asignar/`,
          { mecanico_id: form.mecanico_id, pozo: form.pozo },
        )}
      >
        {dialogo?.tipo === 'asignar' && (
          <>
            <div className="info-box">
              <div className="fw-600 mb-1 mono">{dialogo.dato.codigo}</div>
              <div className="fs-12 text-secondary">
                {dialogo.dato.especialidad_label} · {dialogo.dato.bus.numero}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="as-mec">Mecánico</label>
              <select
                id="as-mec" className="form-input form-select"
                value={form.mecanico_id ?? ''}
                onChange={e => setForm({ ...form, mecanico_id: e.target.value })}
              >
                <option value="">Seleccione…</option>
                {mecanicos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="as-pozo">Pozo</label>
              <input
                id="as-pozo" type="text" className="form-input"
                placeholder="Ej: P-02"
                value={form.pozo ?? ''}
                onChange={e => setForm({ ...form, pozo: e.target.value })}
              />
            </div>
          </>
        )}
      </Dialogo>

      <Dialogo
        abierto={dialogo?.tipo === 'completar'}
        titulo="Completar orden"
        confirmLabel="Cerrar orden"
        disabled={!form.diagnostico?.trim()}
        onCerrar={cerrar}
        confirmando={confirmando}
        error={dlgError}
        onConfirmar={() => ejecutar(
          `/api/mantencion/ordenes/${dialogo.dato.id}/completar/`,
          { diagnostico: form.diagnostico },
        )}
      >
        {dialogo?.tipo === 'completar' && (
          <>
            <div className="info-box">
              <div className="fw-600 mb-1 mono">{dialogo.dato.codigo}</div>
              <div className="fs-12 text-secondary">{dialogo.dato.descripcion}</div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="cp-diag">Qué se hizo</label>
              <textarea
                id="cp-diag" className="form-input" rows={3}
                placeholder="Describe la reparación realizada…"
                value={form.diagnostico ?? ''}
                onChange={e => setForm({ ...form, diagnostico: e.target.value })}
              />
              <p className="fs-12 text-muted">
                Al cerrar la orden, el incidente asociado queda resuelto.
              </p>
            </div>
          </>
        )}
      </Dialogo>

      <Dialogo
        abierto={dialogo?.tipo === 'no-operativo'}
        titulo="Marcar bus no operativo"
        confirmLabel="Marcar caído"
        disabled={!form.motivo?.trim()}
        onCerrar={cerrar}
        confirmando={confirmando}
        error={dlgError}
        onConfirmar={() => ejecutar(
          `/api/mantencion/buses/${dialogo.dato.id}/no-operativo/`,
          { motivo: form.motivo },
        )}
      >
        {dialogo?.tipo === 'no-operativo' && (
          <>
            <div className="notice warn">
              <AlertTriangle size={16} className="notice-icon" />
              <div className="notice-content">
                <div className="notice-title">{dialogo.dato.numero} quedará fuera de servicio</div>
                <div className="notice-desc">
                  Operaciones lo verá caído para gestionar la corrida.
                </div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="no-motivo">Motivo</label>
              <textarea
                id="no-motivo" className="form-input" rows={3}
                placeholder="Ej: requiere repuesto sin stock en bodega…"
                value={form.motivo ?? ''}
                onChange={e => setForm({ ...form, motivo: e.target.value })}
              />
            </div>
          </>
        )}
      </Dialogo>
    </>
  );
}
