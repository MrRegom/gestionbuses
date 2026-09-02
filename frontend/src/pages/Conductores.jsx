import { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Filter, Plus, ArrowRight, CheckCircle, AlertTriangle, XCircle, Search } from 'lucide-react';

export default function Conductores() {
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPersonas();
  }, []);

  const fetchPersonas = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/operaciones/tripulacion/');
      setPersonas(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Error al cargar la tripulación.');
      setLoading(false);
    }
  };

  const getSemaforoInfo = (semaforo, razon) => {
    switch (semaforo) {
      case 'verde': 
        return { cls: 'ok', icon: <CheckCircle size={16} />, text: 'Disponible' };
      case 'amarillo': 
        return { cls: 'warn', icon: <AlertTriangle size={16} />, text: 'Advertencia', title: razon };
      case 'rojo': 
        return { cls: 'danger', icon: <XCircle size={16} />, text: 'Bloqueado', title: razon };
      default: 
        return { cls: 'neutral', icon: null, text: semaforo };
    }
  };

  const getInitials = (name) => {
    return name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (id) => {
    const colors = ['#1D4ED8','#6D28D9','#047857','#B45309','#BE185D','#0369A1','#7C3AED','#065F46','#92400E'];
    return colors[id % colors.length];
  };

  if (loading) return <div className="page-content fade-in">Cargando tripulación...</div>;
  if (error) return <div className="page-content fade-in text-danger">{error}</div>;

  const disponibles = personas.filter(p => p.semaforo === 'verde').length;
  const enRiesgo = personas.filter(p => p.semaforo === 'amarillo' || p.semaforo === 'rojo').length;

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '2px' }}>Gestión de Tripulación</h1>
          <div className="fs-12 text-muted">Directorio de conductores y asistentes</div>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-secondary"><Filter size={16} /> Filtros</button>
          <button className="btn btn-primary"><Plus size={16} /> Nuevo Personal</button>
        </div>
      </div>

      <div className="kpi-row mb-5">
        <div className="kpi-card">
          <div className="kpi-icon-wrap info"><Users size={20} color="var(--info)" /></div>
          <div className="kpi-body">
            <div className="kpi-value">{personas.length}</div>
            <div className="kpi-label">Total Personal</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrap ok"><CheckCircle size={20} color="var(--ok-text)" /></div>
          <div className="kpi-body">
            <div className="kpi-value" style={{ color: 'var(--ok-text)' }}>{disponibles}</div>
            <div className="kpi-label">Disponibles Hoy</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrap warn"><AlertTriangle size={20} color="var(--warn-text)" /></div>
          <div className="kpi-body">
            <div className="kpi-value" style={{ color: 'var(--warn-text)' }}>{enRiesgo}</div>
            <div className="kpi-label">Fatiga / Bloqueados</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Listado de Tripulación</span>
          <div className="search-box">
            <Search size={14} className="text-muted" />
            <input type="text" placeholder="Buscar por nombre, RUT..." style={{ width: '220px' }} />
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Personal</th>
                  <th>RUT</th>
                  <th>Rol / Tipo</th>
                  <th>Horas Hoy</th>
                  <th>Estado (Fatiga)</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {personas.map(persona => {
                  const sInfo = getSemaforoInfo(persona.semaforo, persona.razon_bloqueo);
                  return (
                    <tr key={persona.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="user-avatar" style={{ background: getAvatarColor(persona.id), width: '36px', height: '36px' }}>
                            {getInitials(persona.nombre)}
                          </div>
                          <span className="fw-700">{persona.nombre}</span>
                        </div>
                      </td>
                      <td><span className="text-muted" style={{ fontFamily: 'monospace' }}>{persona.rut}</span></td>
                      <td>
                        <div className="fw-600">{persona.rol}</div>
                        <div className="fs-11 text-muted">{persona.tipo}</div>
                      </td>
                      <td><span className="fw-700">{parseFloat(persona.horas_hoy)}h</span></td>
                      <td>
                        <div className="flex flex-col gap-2" style={{ alignItems: 'flex-start' }} title={sInfo.title}>
                          <span className={`badge ${sInfo.cls}`}>
                            {sInfo.icon} {sInfo.text}
                          </span>
                          {persona.razon_bloqueo && (
                            <span className="fs-11 text-muted" style={{ maxWidth: '200px', whiteSpace: 'normal', lineHeight: '1.2' }}>
                              {persona.razon_bloqueo}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm">Ver ficha <ArrowRight size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
