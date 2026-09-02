import { Map, AlertTriangle, Activity, Radio } from 'lucide-react';

export default function Rastreo() {
  return (
    <>
      <div className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Rastreo y Asistencia</h1>
          <p className="page-subtitle">Monitoreo GPS y control de incidentes</p>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-icon-wrap ok"><Activity size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">12</div>
            <div className="kpi-label">Buses en ruta</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap info"><Radio size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">11</div>
            <div className="kpi-label">Con señal GPS</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap danger"><AlertTriangle size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">1</div>
            <div className="kpi-label">Botón de pánico</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Mapa de flota</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="empty-state" style={{ minHeight: 360, display: 'grid', placeContent: 'center' }}>
            <span className="empty-icon"><Map size={40} strokeWidth={1.5} /></span>
            <div className="empty-title">Mapa GPS no conectado</div>
            <p className="empty-sub">La integración de posición en tiempo real está pendiente.</p>
          </div>
        </div>
      </div>
    </>
  );
}
