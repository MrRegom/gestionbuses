import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, CalendarClock, Users, Navigation, 
  Bus, AlertTriangle, CheckSquare, Wrench, Shield, LogOut, Menu, X 
} from 'lucide-react';
import { useState, useEffect } from 'react';

const MENU_ITEMS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { id: 'plan', icon: CalendarClock, label: 'Planificación', path: '/planificacion' },
  { id: 'cond', icon: Users, label: 'Conductores', path: '/conductores' },
  { id: 'corr', icon: Navigation, label: 'Corridas', path: '/corridas' },
  { id: 'flota', icon: Bus, label: 'Flota', path: '/flota' },
  { id: 'inc', icon: AlertTriangle, label: 'Incidentes', path: '/incidentes' },
  { id: 'chk', icon: CheckSquare, label: 'Checklist', path: '/checklist' },
  { id: 'mant', icon: Wrench, label: 'Mantenimiento', path: '/mantenimiento' },
  { id: 'aud', icon: Shield, label: 'Auditoría', path: '/auditoria' },
];

export default function Layout() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="layout">
      {isMobileMenuOpen && (
        <div className="mobile-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-mark">P+</div>
          <div>
            <div className="logo-name">PlussChile</div>
            <div className="logo-sub">Sistema Operacional</div>
          </div>
          <button className="mobile-close-btn" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-group-label">Operaciones</div>
          {MENU_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.id} to={item.path} className={`nav-item ${isActive ? 'active' : ''}`}>
                <div className="nav-icon"><Icon size={18} /></div>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-user">
          <div className="user-avatar">
            FO
            <div className="user-online"></div>
          </div>
          <div>
            <div className="user-name">Felipe Operaciones</div>
            <div className="user-role">Jefe de Operaciones</div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>
            <div>
              <span className="topbar-page-title">SGO Portal</span>
              <span className="topbar-page-sub">— Gestión de Operaciones</span>
            </div>
          </div>
          <div className="topbar-right">
            <div className="live-indicator"><div className="live-dot"></div>En vivo</div>
            <div className="date-chip">📅 Martes, 01 Sep 2026</div>
            <button className="btn-icon-top" title="Cerrar sesión" style={{ color: 'var(--danger-text)' }}>
              <LogOut size={16} />
            </button>
          </div>
        </header>
        
        <div className="page-content fade-in">
          <Outlet />
        </div>
      </main>
    </>
  );
}
