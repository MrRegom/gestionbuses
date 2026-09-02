import { BarChart3, TrendingUp, FileText, ShieldCheck } from 'lucide-react';

export default function Reportes() {
  return (
    <>
      <div className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Reportes y Auditoría</h1>
          <p className="page-subtitle">Métricas de rendimiento e indicadores</p>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-icon-wrap ok"><TrendingUp size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">98,5%</div>
            <div className="kpi-label">Puntualidad global</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap info"><FileText size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">142</div>
            <div className="kpi-label">Auditorías completadas</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap neutral"><ShieldCheck size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">0</div>
            <div className="kpi-label">Hallazgos abiertos</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Eficiencia operativa</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="empty-state" style={{ minHeight: 300, display: 'grid', placeContent: 'center' }}>
            <span className="empty-icon"><BarChart3 size={40} strokeWidth={1.5} /></span>
            <div className="empty-title">Sin datos de analítica</div>
            <p className="empty-sub">Los gráficos se habilitarán al conectar el módulo de reportes.</p>
          </div>
        </div>
      </div>
    </>
  );
}
