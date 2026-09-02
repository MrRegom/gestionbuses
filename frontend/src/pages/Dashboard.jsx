import { Link } from 'react-router-dom';
import { Bus, MapPin, AlertCircle, Wrench, ChevronRight } from 'lucide-react';

const PROXIMAS = [
  { hora: '14:30', ruta: 'Santiago → Antofagasta', estado: 'ok', texto: 'Completa' },
  { hora: '15:00', ruta: 'Santiago → Calama', estado: 'warn', texto: 'Sin bus' },
  { hora: '15:45', ruta: 'Santiago → Chillán', estado: 'ok', texto: 'Completa' },
];

const ALERTAS = [
  {
    id: 1,
    titulo: 'Incidente en ruta · BUS 106',
    detalle: 'Falla mecánica leve reportada en Ruta 5.',
    hora: 'hace 12 min',
  },
  {
    id: 2,
    titulo: 'Conductor en fatiga · M. Rojas',
    detalle: '8,5 h conducidas de 9 h permitidas.',
    hora: 'hace 40 min',
  },
];

export default function Dashboard() {
  return (
    <>
      <div className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Dashboard Operativo</h1>
          <p className="page-subtitle">Resumen en tiempo real</p>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-icon-wrap info"><MapPin size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">12</div>
            <div className="kpi-label">Servicios activos</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap ok"><Bus size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">45</div>
            <div className="kpi-label">Buses disponibles</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap warn"><Wrench size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">3</div>
            <div className="kpi-label">En mantenimiento</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap danger"><AlertCircle size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">1</div>
            <div className="kpi-label">Alertas críticas</div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Próximas posturas</span>
            <Link to="/planificacion" className="btn btn-ghost btn-sm">
              Ver todas <ChevronRight size={14} />
            </Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Ruta</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {PROXIMAS.map(p => (
                    <tr key={p.hora}>
                      <td data-label="Hora"><span className="td-hora">{p.hora}</span></td>
                      <td data-label="Ruta">{p.ruta}</td>
                      <td data-label="Estado">
                        <span className={`badge ${p.estado}`}>
                          <span className={`badge-dot ${p.estado}`} />{p.texto}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Alertas activas</span>
            <span className="badge danger">{ALERTAS.length}</span>
          </div>
          <div className="card-body">
            {ALERTAS.map(a => (
              <div className="alert-item" key={a.id}>
                <span className="alert-item-icon danger"><AlertCircle size={15} /></span>
                <div className="flex-1">
                  <div className="alert-item-text">{a.titulo}</div>
                  <div className="alert-item-sub">{a.detalle}</div>
                </div>
                <span className="alert-item-time">{a.hora}</span>
              </div>
            ))}
            <button className="btn btn-secondary w-full mt-4">
              Ver historial de alertas <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
