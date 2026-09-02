import { Bus, MapPin, AlertCircle, Wrench, ChevronRight } from 'lucide-react';

export default function Dashboard() {
  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '2px' }}>Dashboard Operativo</h1>
          <div className="fs-12 text-muted">Resumen en tiempo real</div>
        </div>
      </div>

      <div className="kpi-row mb-5">
        <div className="kpi-card">
          <div className="kpi-icon-wrap info"><MapPin size={20} /></div>
          <div className="kpi-body">
            <div className="kpi-value">12</div>
            <div className="kpi-label">Servicios activos</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrap ok"><Bus size={20} /></div>
          <div className="kpi-body">
            <div className="kpi-value" style={{ color: 'var(--ok-text)' }}>45</div>
            <div className="kpi-label">Buses disponibles</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrap warn"><Wrench size={20} /></div>
          <div className="kpi-body">
            <div className="kpi-value" style={{ color: 'var(--warn-text)' }}>3</div>
            <div className="kpi-label">En Mantenimiento</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrap danger"><AlertCircle size={20} /></div>
          <div className="kpi-body">
            <div className="kpi-value" style={{ color: 'var(--danger-text)' }}>1</div>
            <div className="kpi-label">Alertas críticas</div>
          </div>
        </div>
      </div>

      <div className="grid-2 gap-5 mb-5">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Próximas Posturas (Próx 2 horas)</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: 'var(--sp-3) var(--sp-4)', fontWeight: 600 }}>Hora</th>
                  <th style={{ padding: 'var(--sp-3) var(--sp-4)', fontWeight: 600 }}>Ruta</th>
                  <th style={{ padding: 'var(--sp-3) var(--sp-4)', fontWeight: 600 }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 'var(--sp-3) var(--sp-4)', fontWeight: 700 }}>14:30</td>
                  <td style={{ padding: 'var(--sp-3) var(--sp-4)' }}>Santiago → Antofagasta</td>
                  <td style={{ padding: 'var(--sp-3) var(--sp-4)' }}><span className="badge ok">✓ Completa</span></td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 'var(--sp-3) var(--sp-4)', fontWeight: 700 }}>15:00</td>
                  <td style={{ padding: 'var(--sp-3) var(--sp-4)' }}>Santiago → Calama</td>
                  <td style={{ padding: 'var(--sp-3) var(--sp-4)' }}><span className="badge warn">⚠ Sin bus</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Alertas Activas</span>
          </div>
          <div className="card-body">
            <div className="notice danger mb-3" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)', padding: 'var(--sp-4)', borderRadius: 'var(--r-md)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
              <AlertCircle size={20} color="var(--danger)" />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--danger-text)' }}>Incidente en Ruta: BUS 106</div>
                <div style={{ fontSize: '12px', marginTop: '2px' }}>Falla mecánica leve reportada en Ruta 5.</div>
              </div>
            </div>
            
            <button className="btn btn-secondary w-full" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Ver todas las alertas</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
