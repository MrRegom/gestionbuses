import { Map, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';

export default function Rastreo() {
  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '2px' }}>Rastreo y Asistencia</h1>
          <div className="fs-12 text-muted">Monitoreo GPS y control de incidentes</div>
        </div>
      </div>

      <div className="kpi-row mb-5">
        <div className="kpi-card">
          <div className="kpi-icon-wrap ok"><Activity size={20} color="var(--ok-text)" /></div>
          <div className="kpi-body">
            <div className="kpi-value">12</div>
            <div className="kpi-label">Buses en Ruta</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrap danger"><AlertTriangle size={20} color="var(--danger-text)" /></div>
          <div className="kpi-body">
            <div className="kpi-value" style={{ color: 'var(--danger-text)' }}>1</div>
            <div className="kpi-label">Botón de Pánico</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e2e8f0' }}>
        <div className="text-center text-muted">
          <Map size={48} style={{ margin: '0 auto', opacity: 0.5 }} />
          <p className="mt-3 fw-600">Módulo de Mapa Integrado</p>
          <p className="fs-12">Visualización GPS en tiempo real (Simulación)</p>
        </div>
      </div>
    </>
  );
}
