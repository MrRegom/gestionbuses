import { useState, useEffect } from 'react';
import axios from 'axios';
import { Bus, Settings2, Plus, ArrowRight, ShieldCheck, Wrench, AlertTriangle, AlertCircle } from 'lucide-react';

export default function Flota() {
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBuses();
  }, []);

  const fetchBuses = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:8000/api/flota/buses/');
      setBuses(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Error al cargar la flota.');
      setLoading(false);
    }
  };

  const getStatusBadge = (estado) => {
    switch (estado) {
      case 'DISPONIBLE': return <span className="badge ok"><div className="badge-dot ok"></div>Disponible</span>;
      case 'EN_SERVICIO': return <span className="badge info"><div className="badge-dot"></div>En Servicio</span>;
      case 'MANTENIMIENTO': return <span className="badge warn"><div className="badge-dot warn"></div>Mantenimiento</span>;
      case 'FUERA_SERVICIO': return <span className="badge danger"><div className="badge-dot danger"></div>Fuera Servicio</span>;
      default: return <span className="badge neutral">{estado}</span>;
    }
  };

  const getIconForStatus = (estado) => {
    switch (estado) {
      case 'DISPONIBLE': return <ShieldCheck size={20} color="var(--ok)" />;
      case 'EN_SERVICIO': return <Bus size={20} color="var(--info)" />;
      case 'MANTENIMIENTO': return <Wrench size={20} color="var(--warn)" />;
      case 'FUERA_SERVICIO': return <AlertCircle size={20} color="var(--danger)" />;
      default: return <Bus size={20} />;
    }
  };

  if (loading) return <div className="page-content fade-in">Cargando flota...</div>;
  if (error) return <div className="page-content fade-in text-danger">{error}</div>;

  const disponibles = buses.filter(b => b.estado === 'DISPONIBLE').length;
  const mantenimiento = buses.filter(b => b.estado === 'MANTENIMIENTO').length;

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '2px' }}>Gestión de Flota</h1>
          <div className="fs-12 text-muted">Inventario de buses y mantenimiento</div>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-secondary"><Settings2 size={16} /> Configurar</button>
          <button className="btn btn-primary"><Plus size={16} /> Ingresar Bus</button>
        </div>
      </div>

      <div className="kpi-row mb-5">
        <div className="kpi-card">
          <div className="kpi-icon-wrap gold"><Bus size={20} color="var(--gold)" /></div>
          <div className="kpi-body">
            <div className="kpi-value">{buses.length}</div>
            <div className="kpi-label">Total Flota</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrap ok"><ShieldCheck size={20} color="var(--ok-text)" /></div>
          <div className="kpi-body">
            <div className="kpi-value" style={{ color: 'var(--ok-text)' }}>{disponibles}</div>
            <div className="kpi-label">Disponibles</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrap warn"><Wrench size={20} color="var(--warn-text)" /></div>
          <div className="kpi-body">
            <div className="kpi-value" style={{ color: 'var(--warn-text)' }}>{mantenimiento}</div>
            <div className="kpi-label">Mantenimiento</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Listado Maestro de Flota</span>
          <div className="search-box">
            <input type="text" placeholder="Buscar bus, patente..." style={{ width: '200px' }} />
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nº Interno</th>
                  <th>Patente</th>
                  <th>Modelo</th>
                  <th>Kilometraje</th>
                  <th>Servicio</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {buses.map(bus => (
                  <tr key={bus.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="kpi-icon-wrap" style={{ width: '32px', height: '32px', background: 'var(--bg-muted)' }}>
                          {getIconForStatus(bus.estado)}
                        </div>
                        <span className="td-bus-num">{bus.numero}</span>
                      </div>
                    </td>
                    <td><span className="td-bus-plate">{bus.patente}</span></td>
                    <td>{bus.modelo}</td>
                    <td>{bus.kilometraje.toLocaleString()} km</td>
                    <td>{bus.servicio}</td>
                    <td>{getStatusBadge(bus.estado)}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm">Ver det. <ArrowRight size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
