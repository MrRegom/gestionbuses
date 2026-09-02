import { useState, useEffect } from 'react';
import axios from 'axios';
import { CalendarClock, Plus, Search, MapPin, Clock, Edit, Trash2 } from 'lucide-react';

export default function Planificacion() {
  const [posturas, setPosturas] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    codigo: '',
    ruta_id: '',
    fecha: '',
    hora_salida: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resPosturas, resRutas] = await Promise.all([
        axios.get('/api/operaciones/posturas/'),
        axios.get('/api/operaciones/rutas/')
      ]);
      setPosturas(resPosturas.data);
      setRutas(resRutas.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/operaciones/posturas/', formData);
      setIsModalOpen(false);
      fetchData(); // Reload list
    } catch (err) {
      console.error(err);
      alert('Error al crear la postura.');
    }
  };

  const handleDelete = async (id) => {
    if(window.confirm('¿Estás seguro de eliminar esta postura?')) {
      try {
        await axios.delete(`/api/operaciones/posturas/${id}/`);
        fetchData();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const getStatusBadge = (estado) => {
    switch (estado) {
      case 'LISTA': return <span className="badge ok">Lista</span>;
      case 'ALERTA': return <span className="badge warn">Alerta</span>;
      case 'PROBLEMA': return <span className="badge danger">Problema</span>;
      case 'COMPLETA': return <span className="badge ok">Completa</span>;
      default: return <span className="badge neutral">{estado}</span>;
    }
  };

  if (loading) return <div className="page-content fade-in">Cargando planificación...</div>;

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '2px' }}>Planificación de Posturas</h1>
          <div className="fs-12 text-muted">Gestión de viajes y asignación de recursos</div>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> Nueva Postura
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Posturas del Día</span>
          <div className="search-box">
            <Search size={14} className="text-muted" />
            <input type="text" placeholder="Buscar código o ruta..." style={{ width: '220px' }} />
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Ruta (Origen - Destino)</th>
                  <th>Salida</th>
                  <th>Bus Asignado</th>
                  <th>Tripulación</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {posturas.map(p => (
                  <tr key={p.id}>
                    <td data-label="Código"><span className="fw-700">{p.codigo}</span></td>
                    <td data-label="Ruta">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-muted" />
                        <span className="fw-600">{p.ruta?.origen?.nombre} <span className="text-muted">→</span> {p.ruta?.destino?.nombre}</span>
                      </div>
                    </td>
                    <td data-label="Salida">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-muted" />
                        <span>{p.fecha} <span className="fw-700">{p.hora_salida.substring(0, 5)}</span></span>
                      </div>
                    </td>
                    <td data-label="Bus">
                      {p.bus ? <span className="badge navy">{p.bus.numero}</span> : <span className="text-muted fs-11">Sin asignar</span>}
                    </td>
                    <td data-label="Tripulación">
                      {p.tripulacion.length > 0 ? (
                        <div className="crew-avatars">
                          {p.tripulacion.map(t => (
                            <div key={t.id} className="crew-avatar" style={{ background: 'var(--navy)' }} title={`${t.persona.nombre} (${t.rol_en_viaje})`}>
                              {t.persona.nombre.substring(0,2).toUpperCase()}
                            </div>
                          ))}
                        </div>
                      ) : <span className="text-muted fs-11">0 asignados</span>}
                    </td>
                    <td data-label="Estado">{getStatusBadge(p.estado)}</td>
                    <td data-label="Acciones">
                      <div className="flex gap-2">
                        <button className="btn-icon" title="Editar"><Edit size={14} /></button>
                        <button className="btn-icon text-danger" title="Eliminar" onClick={() => handleDelete(p.id)}><Trash2 size={14} color="var(--danger)" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal CRUD (Create) */}
      <div className={`modal-overlay ${isModalOpen ? 'open' : ''}`}>
        <div className="modal">
          <div className="modal-header">
            <span className="modal-title">Crear Nueva Postura</span>
            <button className="btn-icon" onClick={() => setIsModalOpen(false)}>✕</button>
          </div>
          <form onSubmit={handleCreateSubmit}>
            <div className="modal-body flex flex-col gap-4">
              <div className="form-group">
                <label className="form-label">Código de Viaje</label>
                <input 
                  type="text" className="form-input" required 
                  value={formData.codigo} onChange={e => setFormData({...formData, codigo: e.target.value})}
                  placeholder="Ej: POS-102"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Ruta</label>
                <select className="form-input form-select" required value={formData.ruta_id} onChange={e => setFormData({...formData, ruta_id: e.target.value})}>
                  <option value="">Seleccione una ruta...</option>
                  {rutas.map(r => (
                    <option key={r.id} value={r.id}>{r.origen.nombre} → {r.destino.nombre} ({r.duracion_estimada}h)</option>
                  ))}
                </select>
              </div>
              <div className="grid-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Fecha</label>
                  <input type="date" className="form-input" required value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Hora de Salida</label>
                  <input type="time" className="form-input" required value={formData.hora_salida} onChange={e => setFormData({...formData, hora_salida: e.target.value})} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Guardar Postura</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
