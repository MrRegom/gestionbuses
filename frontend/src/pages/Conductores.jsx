import { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Filter, Plus, ArrowRight, CheckCircle, AlertTriangle, XCircle, Search } from 'lucide-react';

export default function Conductores() {
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPersona, setSelectedPersona] = useState(null);

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
                      <td data-label="Nombre">
                        <div className="flex items-center gap-3">
                          <div className="user-avatar" style={{ background: getAvatarColor(persona.id), width: '36px', height: '36px' }}>
                            {getInitials(persona.nombre)}
                          </div>
                          <span className="fw-700">{persona.nombre}</span>
                        </div>
                      </td>
                      <td data-label="RUT"><span className="text-muted" style={{ fontFamily: 'monospace' }}>{persona.rut}</span></td>
                      <td data-label="Rol/Perfil">
                        <div className="fw-600">{persona.rol}</div>
                        <div className="fs-11 text-muted">{persona.tipo}</div>
                      </td>
                      <td data-label="Horas Hoy"><span className="fw-700">{parseFloat(persona.horas_hoy)}h</span></td>
                      <td data-label="Semáforo Operacional">
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
                      <td data-label="Acciones">
                        <button className="btn btn-ghost btn-sm" onClick={() => setSelectedPersona(persona)}>
                          Ver ficha <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Ficha Modal */}
      <div className={`modal-overlay ${selectedPersona ? 'open' : ''}`}>
        <div className="modal" style={{ maxWidth: '500px' }}>
          {selectedPersona && (
            <>
              <div className="modal-header">
                <span className="modal-title">Ficha Técnica</span>
                <button className="btn-icon" onClick={() => setSelectedPersona(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="flex items-center gap-4 mb-5">
                  <div className="user-avatar" style={{ background: getAvatarColor(selectedPersona.id), width: '64px', height: '64px', fontSize: '24px' }}>
                    {getInitials(selectedPersona.nombre)}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--navy)' }}>{selectedPersona.nombre}</h2>
                    <div className="text-muted" style={{ fontFamily: 'monospace' }}>RUT: {selectedPersona.rut}</div>
                    <div className="badge mt-2" style={{ background: 'var(--navy)', color: 'white' }}>{selectedPersona.rol} - {selectedPersona.tipo}</div>
                  </div>
                </div>
                
                <div className="grid-2 gap-4 mb-5">
                  <div className="card" style={{ padding: 'var(--sp-4)', background: 'var(--bg-muted)', boxShadow: 'none' }}>
                    <div className="fs-11 text-muted text-uppercase fw-600 mb-1">Horas de Conducción Hoy</div>
                    <div className="fs-24 fw-800" style={{ color: 'var(--text-primary)' }}>{parseFloat(selectedPersona.horas_hoy)}h <span className="fs-14 fw-600 text-muted">/ 9h máx</span></div>
                  </div>
                  <div className="card" style={{ padding: 'var(--sp-4)', background: 'var(--bg-muted)', boxShadow: 'none' }}>
                    <div className="fs-11 text-muted text-uppercase fw-600 mb-1">Estado Operacional</div>
                    <div className={`badge ${getSemaforoInfo(selectedPersona.semaforo, selectedPersona.razon_bloqueo).cls} mt-1`} style={{ fontSize: '14px', padding: '6px 12px' }}>
                      {getSemaforoInfo(selectedPersona.semaforo, selectedPersona.razon_bloqueo).icon} 
                      {getSemaforoInfo(selectedPersona.semaforo, selectedPersona.razon_bloqueo).text}
                    </div>
                  </div>
                </div>

                {selectedPersona.razon_bloqueo && (
                  <div className="card mb-4 border-danger" style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px' }}>
                    <div className="fw-700 text-danger mb-1 flex items-center gap-2"><AlertTriangle size={16} /> Motivo de Bloqueo</div>
                    <p className="fs-13 m-0" style={{ color: '#991b1b' }}>{selectedPersona.razon_bloqueo}</p>
                  </div>
                )}

                <div className="border-t pt-4">
                  <h3 className="fs-14 fw-700 mb-3 text-uppercase text-muted">Próxima Asignación</h3>
                  <div className="flex items-center justify-between p-3" style={{ background: 'var(--bg-white)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                    <div>
                      <div className="fw-700">POS-001 <span className="text-muted fw-400">| Santiago → Antofagasta</span></div>
                      <div className="fs-12 text-muted mt-1">Hoy, 08:00 hrs</div>
                    </div>
                    <span className="badge ok">Confirmado</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setSelectedPersona(null)}>Cerrar</button>
                <button className="btn btn-primary">Asignar Nueva Postura</button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
