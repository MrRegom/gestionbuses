import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  AlertTriangle, AlertCircle, Plus, RefreshCw, X,
  ClipboardCheck, Radio, CheckCircle2, ShieldAlert,
} from 'lucide-react';

const GRAVEDAD = {
  ALTA:  { badge: 'danger',  label: 'Alta' },
  MEDIA: { badge: 'warn',    label: 'Media' },
  BAJA:  { badge: 'neutral', label: 'Baja' },
};

const ESTADO = {
  ABIERTO:     { badge: 'danger',  label: 'Abierto' },
  EN_REVISION: { badge: 'warn',    label: 'En revisión' },
  RESUELTO:    { badge: 'ok',      label: 'Resuelto' },
  DESCARTADO:  { badge: 'neutral', label: 'Descartado' },
};

const ORIGEN = {
  CHECKLIST: { Icon: ClipboardCheck, label: 'Checklist' },
  RUTA:      { Icon: Radio,          label: 'En ruta' },
};

const FORM_VACIO = { bus_id: '', persona_id: '', descripcion: '', gravedad: 'MEDIA', postura_id: '' };

export default function Incidentes() {
  const [incidentes, setIncidentes] = useState([]);
  const [buses, setBuses] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [soloAbiertos, setSoloAbiertos] = useState(false);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rInc, rBuses, rPersonas] = await Promise.all([
        axios.get('/api/mantencion/incidentes/'),
        axios.get('/api/flota/buses/'),
        axios.get('/api/operaciones/tripulacion/'),
      ]);
      setIncidentes(rInc.data);
      setBuses(rBuses.data);
      setPersonas(rPersonas.data);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los incidentes.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const cerrarModal = useCallback(() => {
    setModalAbierto(false);
    setFormError(null);
  }, []);

  useEffect(() => {
    if (!modalAbierto) return;
    const onKeyDown = e => { if (e.key === 'Escape') cerrarModal(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalAbierto, cerrarModal]);

  useEffect(() => {
    document.body.classList.toggle('no-scroll', modalAbierto);
    return () => document.body.classList.remove('no-scroll');
  }, [modalAbierto]);

  const reportar = async e => {
    e.preventDefault();
    setGuardando(true);
    setFormError(null);
    try {
      await axios.post('/api/mantencion/incidentes/', {
        bus_id: form.bus_id,
        persona_id: form.persona_id,
        descripcion: form.descripcion,
        gravedad: form.gravedad,
        postura_id: form.postura_id || null,
      });
      cerrarModal();
      setForm(FORM_VACIO);
      await cargar();
    } catch (err) {
      setFormError(err.response?.data?.error ?? 'No se pudo registrar el incidente.');
    }
    setGuardando(false);
  };

  const cambiarEstado = async (incidente, estado) => {
    try {
      await axios.post(`/api/mantencion/incidentes/${incidente.id}/estado/`, { estado });
      await cargar();
    } catch (err) {
      console.error(err);
      alert('No se pudo actualizar el incidente.');
    }
  };

  const visibles = soloAbiertos
    ? incidentes.filter(i => ['ABIERTO', 'EN_REVISION'].includes(i.estado))
    : incidentes;

  const abiertos = incidentes.filter(i => i.estado === 'ABIERTO').length;
  const altas = incidentes.filter(
    i => i.gravedad === 'ALTA' && ['ABIERTO', 'EN_REVISION'].includes(i.estado)
  ).length;
  const resueltos = incidentes.filter(i => i.estado === 'RESUELTO').length;

  return (
    <>
      <div className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Incidentes en Ruta</h1>
          <p className="page-subtitle">Fallas reportadas por la tripulación</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => { setForm(FORM_VACIO); setModalAbierto(true); }}>
            <Plus size={15} /> Reportar incidente
          </button>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-icon-wrap danger"><AlertTriangle size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">{loading || error ? '—' : abiertos}</div>
            <div className="kpi-label">Abiertos</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap warn"><ShieldAlert size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">{loading || error ? '—' : altas}</div>
            <div className="kpi-label">Gravedad alta</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap ok"><CheckCircle2 size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">{loading || error ? '—' : resueltos}</div>
            <div className="kpi-label">Resueltos</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Cola de Mantención</span>
          <button
            className={`btn btn-sm ${soloAbiertos ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSoloAbiertos(v => !v)}
          >
            Solo pendientes
          </button>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {loading && (
            <div className="p-5 flex flex-col gap-3">
              {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 44 }} />)}
            </div>
          )}

          {!loading && error && (
            <div className="empty-state">
              <span className="empty-icon"><AlertCircle size={36} strokeWidth={1.5} /></span>
              <div className="empty-title">{error}</div>
              <button className="btn btn-secondary mt-4" onClick={cargar}>
                <RefreshCw size={15} /> Reintentar
              </button>
            </div>
          )}

          {!loading && !error && visibles.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon"><CheckCircle2 size={36} strokeWidth={1.5} /></span>
              <div className="empty-title">Sin incidentes</div>
              <p className="empty-sub">
                {soloAbiertos
                  ? 'No hay incidentes pendientes en la cola.'
                  : 'Los incidentes aparecerán aquí al cerrar un checklist con fallas o al reportar desde ruta.'}
              </p>
            </div>
          )}

          {!loading && !error && visibles.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Bus</th>
                    <th>Descripción</th>
                    <th>Origen</th>
                    <th>Gravedad</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map(inc => {
                    const g = GRAVEDAD[inc.gravedad] ?? { badge: 'neutral', label: inc.gravedad };
                    const e = ESTADO[inc.estado] ?? { badge: 'neutral', label: inc.estado };
                    const o = ORIGEN[inc.origen] ?? { Icon: AlertCircle, label: inc.origen };
                    const { Icon } = o;
                    return (
                      <tr key={inc.id}>
                        <td data-label="Código"><span className="fw-600 mono">{inc.codigo}</span></td>
                        <td data-label="Bus">
                          <div className="fw-500">{inc.bus.numero}</div>
                          <div className="fs-12 text-muted mono">{inc.bus.patente}</div>
                        </td>
                        {/* Descripción y autor van en un solo contenedor: en
                            móvil la celda es flex y dos hijos sueltos se
                            separarían en columnas distintas. */}
                        <td data-label="Descripción">
                          <div style={{ maxWidth: 340 }}>
                            <div>{inc.descripcion}</div>
                            <div className="fs-12 text-muted mt-1">
                              {inc.reportado_por.nombre}
                              {inc.postura_codigo ? ` · ${inc.postura_codigo}` : ''}
                            </div>
                          </div>
                        </td>
                        <td data-label="Origen">
                          <span className="flex items-center gap-2 text-muted fs-12">
                            <Icon size={14} /> {o.label}
                          </span>
                        </td>
                        <td data-label="Gravedad"><span className={`badge ${g.badge}`}>{g.label}</span></td>
                        <td data-label="Estado"><span className={`badge ${e.badge}`}>{e.label}</span></td>
                        <td data-label="Acción">
                          <select
                            className="form-input form-select btn-sm"
                            style={{ fontSize: 12, height: 28, padding: '0 28px 0 8px', width: 'auto' }}
                            value={inc.estado}
                            onChange={ev => cambiarEstado(inc, ev.target.value)}
                            aria-label={`Cambiar estado de ${inc.codigo}`}
                          >
                            {Object.entries(ESTADO).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
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

      {/* Reporte manual desde ruta */}
      {createPortal(
        <div
          className={`modal-overlay ${modalAbierto ? 'open' : ''}`}
          onClick={ev => { if (ev.target === ev.currentTarget) cerrarModal(); }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-label="Reportar incidente">
            <div className="modal-header">
              <span className="modal-title">Reportar incidente</span>
              <button className="btn-icon" onClick={cerrarModal} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={reportar}>
              <div className="modal-body flex flex-col gap-4">
                {formError && (
                  <div className="notice danger">
                    <AlertCircle size={16} className="notice-icon" />
                    <div className="notice-content">{formError}</div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="inc-bus">Bus</label>
                  <select
                    id="inc-bus" className="form-input form-select" required
                    value={form.bus_id}
                    onChange={ev => setForm({ ...form, bus_id: ev.target.value })}
                  >
                    <option value="">Seleccione el bus…</option>
                    {buses.map(b => (
                      <option key={b.id} value={b.id}>{b.numero} · {b.patente}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="inc-persona">Reporta</label>
                  <select
                    id="inc-persona" className="form-input form-select" required
                    value={form.persona_id}
                    onChange={ev => setForm({ ...form, persona_id: ev.target.value })}
                  >
                    <option value="">Seleccione el tripulante…</option>
                    {personas.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="inc-desc">Qué ocurrió</label>
                  <textarea
                    id="inc-desc" className="form-input" required rows={3}
                    placeholder="Describe la falla con el detalle que necesita el taller…"
                    value={form.descripcion}
                    onChange={ev => setForm({ ...form, descripcion: ev.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="inc-grav">Gravedad</label>
                  <select
                    id="inc-grav" className="form-input form-select"
                    value={form.gravedad}
                    onChange={ev => setForm({ ...form, gravedad: ev.target.value })}
                  >
                    {Object.entries(GRAVEDAD).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  {form.gravedad === 'ALTA' && (
                    <p className="fs-12 text-muted">
                      Una gravedad alta deja el bus fuera de servicio de inmediato.
                    </p>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={cerrarModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  {guardando ? <><span className="spinner" /> Registrando…</> : 'Registrar incidente'}
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
