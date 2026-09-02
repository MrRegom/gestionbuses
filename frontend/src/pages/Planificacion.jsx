import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  Plus, Search, MapPin, Clock, Edit, Trash2,
  CalendarClock, AlertCircle, RefreshCw, X,
} from 'lucide-react';

const ESTADO_BADGE = {
  LISTA:    'ok',
  EN_CURSO: 'info',
  COMPLETA: 'ok',
  ALERTA:   'warn',
  PROBLEMA: 'danger',
};

const ESTADO_LABEL = {
  LISTA:    'Lista',
  EN_CURSO: 'En curso',
  COMPLETA: 'Completa',
  ALERTA:   'Alerta',
  PROBLEMA: 'Problema',
};

const FORM_VACIO = { codigo: '', ruta_id: '', fecha: '', hora_salida: '' };

export default function Planificacion() {
  const [posturas, setPosturas] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formData, setFormData] = useState(FORM_VACIO);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resPosturas, resRutas] = await Promise.all([
        axios.get('/api/operaciones/posturas/'),
        axios.get('/api/operaciones/rutas/'),
      ]);
      setPosturas(resPosturas.data);
      setRutas(resRutas.data);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar las posturas.');
    }
    setLoading(false);
  }, []);

  const abrirModal = () => {
    setFormData(FORM_VACIO);
    setFormError(null);
    setIsModalOpen(true);
  };

  const cerrarModal = useCallback(() => {
    setIsModalOpen(false);
    setFormError(null);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* Cierra el modal con Escape, como cualquier diálogo del sistema. */
  useEffect(() => {
    if (!isModalOpen) return;
    const onKeyDown = e => { if (e.key === 'Escape') cerrarModal(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen, cerrarModal]);

  /* Bloquea el scroll del fondo mientras el modal está abierto. */
  useEffect(() => {
    document.body.classList.toggle('no-scroll', isModalOpen);
    return () => document.body.classList.remove('no-scroll');
  }, [isModalOpen]);

  const handleCreateSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await axios.post('/api/operaciones/posturas/', formData);
      cerrarModal();
      await fetchData();
    } catch (err) {
      console.error(err);
      setFormError('No se pudo crear la postura. Revisa que el código no esté repetido.');
    }
    setSaving(false);
  };

  const handleDelete = async id => {
    if (!window.confirm('¿Eliminar esta postura? La acción no se puede deshacer.')) return;
    try {
      await axios.delete(`/api/operaciones/posturas/${id}/`);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('No se pudo eliminar la postura.');
    }
  };

  const filtradas = posturas.filter(p => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    const ruta = `${p.ruta?.origen?.nombre ?? ''} ${p.ruta?.destino?.nombre ?? ''}`.toLowerCase();
    return p.codigo.toLowerCase().includes(q) || ruta.includes(q);
  });

  return (
    <>
      <div className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Planificación de Posturas</h1>
          <p className="page-subtitle">Gestión de viajes y asignación de recursos</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={abrirModal}>
            <Plus size={15} /> Nueva postura
          </button>
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
                    <tr key={p.id}>
                      <td data-label="Código"><span className="fw-600">{p.codigo}</span></td>
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
                          : <span className="text-muted fs-12">Sin asignar</span>}
                      </td>
                      <td data-label="Tripulación">
                        {p.tripulacion.length > 0 ? (
                          <div className="crew-avatars">
                            {p.tripulacion.slice(0, 3).map(t => (
                              <span
                                key={t.id}
                                className="crew-avatar"
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
                        ) : <span className="text-muted fs-12">0 asignados</span>}
                      </td>
                      <td data-label="Estado">
                        <span className={`badge ${ESTADO_BADGE[p.estado] ?? 'neutral'}`}>
                          {ESTADO_LABEL[p.estado] ?? p.estado}
                        </span>
                      </td>
                      <td data-label="Acciones">
                        <div className="flex gap-2 justify-center">
                          <button className="btn-icon" title="Editar" aria-label={`Editar ${p.codigo}`}>
                            <Edit size={15} />
                          </button>
                          <button
                            className="btn-icon"
                            title="Eliminar"
                            aria-label={`Eliminar ${p.codigo}`}
                            onClick={() => handleDelete(p.id)}
                            style={{ color: 'var(--danger)' }}
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

      {/* ── Crear postura ───────────────────────────────────────
          En un portal a <body> por la misma razón que la ficha de
          Conductores: un ancestro con transform reubicaría el diálogo
          `position: fixed` fuera del viewport. */}
      {createPortal(
      <div
        className={`modal-overlay ${isModalOpen ? 'open' : ''}`}
        onClick={e => { if (e.target === e.currentTarget) cerrarModal(); }}
      >
        <div className="modal" role="dialog" aria-modal="true" aria-label="Crear nueva postura">
          <div className="modal-header">
            <span className="modal-title">Nueva postura</span>
            <button className="btn-icon" onClick={cerrarModal} aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleCreateSubmit}>
            <div className="modal-body flex flex-col gap-4">
              {formError && (
                <div className="notice danger">
                  <AlertCircle size={16} className="notice-icon" />
                  <div className="notice-content">{formError}</div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="codigo">Código de viaje</label>
                <input
                  id="codigo" type="text" className="form-input" required
                  value={formData.codigo}
                  onChange={e => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="Ej: SGO-CH-001"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ruta">Ruta</label>
                <select
                  id="ruta" className="form-input form-select" required
                  value={formData.ruta_id}
                  onChange={e => setFormData({ ...formData, ruta_id: e.target.value })}
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
                    value={formData.fecha}
                    onChange={e => setFormData({ ...formData, fecha: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="hora">Hora de salida</label>
                  <input
                    id="hora" type="time" className="form-input" required
                    value={formData.hora_salida}
                    onChange={e => setFormData({ ...formData, hora_salida: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={cerrarModal}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><span className="spinner" /> Guardando…</> : 'Guardar postura'}
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
