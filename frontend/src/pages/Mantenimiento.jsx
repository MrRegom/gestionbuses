import { Wrench, CheckSquare, Clock } from 'lucide-react';

export default function Mantenimiento() {
  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '2px' }}>Taller y Mantenimiento</h1>
          <div className="fs-12 text-muted">Control de reparaciones y preventivos</div>
        </div>
      </div>

      <div className="kpi-row mb-5">
        <div className="kpi-card">
          <div className="kpi-icon-wrap warn"><Wrench size={20} color="var(--warn-text)" /></div>
          <div className="kpi-body">
            <div className="kpi-value" style={{ color: 'var(--warn-text)' }}>3</div>
            <div className="kpi-label">En Taller</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrap info"><Clock size={20} color="var(--info)" /></div>
          <div className="kpi-body">
            <div className="kpi-value">5</div>
            <div className="kpi-label">Preventivos Pendientes</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Checklists de Salida Recientes</span>
        </div>
        <div className="card-body">
          <div className="flex items-center gap-3 p-3 border-b border-gray-200">
            <CheckSquare size={20} className="text-ok" />
            <div>
              <div className="fw-600">BUS 101 - Revisión Pre-Ruta</div>
              <div className="fs-12 text-muted">Aprobado por Mecánico J. Pérez - 08:00 AM</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3">
            <Wrench size={20} className="text-warn" />
            <div>
              <div className="fw-600">BUS 104 - Cambio de Aceite</div>
              <div className="fs-12 text-muted">En proceso - Ingreso 09:30 AM</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
