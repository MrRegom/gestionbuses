import { Wrench, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

/* Datos de muestra: el módulo real (Kanban del taller) está en la
   hoja de ruta. Ver README §7. */
const ACTIVIDAD = [
  {
    id: 1,
    icon: CheckCircle2,
    tono: 'ok',
    titulo: 'BUS 101 · Revisión pre-ruta',
    detalle: 'Aprobado por mecánico J. Pérez',
    hora: '08:00',
  },
  {
    id: 2,
    icon: Wrench,
    tono: 'warn',
    titulo: 'BUS 104 · Cambio de aceite',
    detalle: 'En proceso — ingreso 09:30',
    hora: '09:30',
  },
  {
    id: 3,
    icon: AlertCircle,
    tono: 'danger',
    titulo: 'BUS 106 · Falla de frenos',
    detalle: 'Bus fuera de servicio — pendiente de repuesto',
    hora: '11:15',
  },
];

export default function Mantenimiento() {
  return (
    <>
      <div className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Taller y Mantenimiento</h1>
          <p className="page-subtitle">Control de reparaciones y preventivos</p>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-icon-wrap warn"><Wrench size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">3</div>
            <div className="kpi-label">En taller</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap info"><Clock size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">5</div>
            <div className="kpi-label">Preventivos pendientes</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap ok"><CheckCircle2 size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">12</div>
            <div className="kpi-label">Liberados hoy</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Actividad reciente del taller</span>
        </div>
        <div className="card-body">
          {ACTIVIDAD.map(a => {
            const Icon = a.icon;
            return (
              <div className="alert-item" key={a.id}>
                <span className={`alert-item-icon ${a.tono}`}><Icon size={15} /></span>
                <div className="flex-1">
                  <div className="alert-item-text">{a.titulo}</div>
                  <div className="alert-item-sub">{a.detalle}</div>
                </div>
                <span className="alert-item-time">{a.hora}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
