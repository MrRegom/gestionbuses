import { BarChart3, TrendingUp, FileText } from 'lucide-react';

export default function Reportes() {
  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '2px' }}>Reportes y Auditoría</h1>
          <div className="fs-12 text-muted">Métricas de rendimiento e indicadores</div>
        </div>
      </div>

      <div className="kpi-row mb-5">
        <div className="kpi-card">
          <div className="kpi-icon-wrap ok"><TrendingUp size={20} color="var(--ok-text)" /></div>
          <div className="kpi-body">
            <div className="kpi-value">98.5%</div>
            <div className="kpi-label">Puntualidad Global</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrap info"><FileText size={20} color="var(--info)" /></div>
          <div className="kpi-body">
            <div className="kpi-value">142</div>
            <div className="kpi-label">Auditorías Completadas</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white' }}>
        <div className="text-center text-muted">
          <BarChart3 size={48} style={{ margin: '0 auto', opacity: 0.5 }} />
          <p className="mt-3 fw-600">Gráfico de Eficiencia Operativa</p>
          <p className="fs-12">Renderización de Analytics (Simulación)</p>
        </div>
      </div>
    </>
  );
}
