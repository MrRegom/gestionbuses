import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Menu, X, Bell, LogOut, MoreHorizontal } from 'lucide-react';
import { NAV_GROUPS, NAV_ITEMS, BOTTOM_NAV_IDS, findNavItem } from '../config/navigation';

/** Punto de quiebre donde el sidebar pasa a ser drawer. Debe coincidir
 *  con el @media (max-width: 1024px) de index.css. */
const DRAWER_BREAKPOINT = 1024;

export default function Layout() {
  const location = useLocation();

  /* El drawer guarda la ruta en la que se abrió, en vez de un booleano
     suelto. Así "abierto" se deriva de la ruta actual: al navegar —con
     un enlace, con el botón atrás o desde fuera— deja de estar abierto
     solo, sin necesidad de un efecto que sincronice el estado. */
  const [openedAt, setOpenedAt] = useState(null);
  const drawerOpen = openedAt !== null && openedAt === location.pathname;

  const current = findNavItem(location.pathname);
  const pageTitle = current?.title ?? 'SGO';
  const pageSubtitle = current?.subtitle ?? 'Sistema de Gestión Operacional';

  const closeDrawer = useCallback(() => setOpenedAt(null), []);
  const toggleDrawer = useCallback(
    () => setOpenedAt(prev => (prev === null ? location.pathname : null)),
    [location.pathname],
  );

  /* Escape cierra el drawer — comportamiento esperado en desktop. */
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = e => { if (e.key === 'Escape') closeDrawer(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, closeDrawer]);

  /* Si el usuario agranda la ventana con el drawer abierto, el sidebar
     vuelve a ser fijo: hay que soltar el estado para no dejar el scroll
     bloqueado ni el velo colgado. */
  useEffect(() => {
    if (!drawerOpen) return;
    const onResize = () => {
      if (window.innerWidth > DRAWER_BREAKPOINT) closeDrawer();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [drawerOpen, closeDrawer]);

  /* Bloquea el scroll del fondo mientras el drawer está abierto. */
  useEffect(() => {
    document.body.classList.toggle('no-scroll', drawerOpen);
    return () => document.body.classList.remove('no-scroll');
  }, [drawerOpen]);

  const bottomItems = BOTTOM_NAV_IDS
    .map(id => NAV_ITEMS.find(i => i.id === id))
    .filter(Boolean);

  return (
    <div className="app-shell">

      {/* ── TOPBAR ────────────────────────────────────────────────
          Ocupa todo el ancho y es la capa superior del shell, así el
          menú nunca se le monta encima ni al revés. */}
      <header className="topbar">
        <div className="topbar-left">
          <button
            className="mobile-menu-btn"
            onClick={toggleDrawer}
            aria-label={drawerOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={drawerOpen}
          >
            {drawerOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="topbar-brand">
            <span className="logo-mark">P+</span>
            <span className="topbar-brand-name">PlussChile</span>
          </div>

          <div className="topbar-titles">
            <span className="topbar-page-title">{pageTitle}</span>
            <span className="topbar-page-sub">{pageSubtitle}</span>
          </div>
        </div>

        <div className="topbar-right">
          <span className="live-indicator">
            <span className="live-dot" />
            En vivo
          </span>
          <span className="date-chip">
            {new Date().toLocaleDateString('es-CL', {
              weekday: 'long', day: 'numeric', month: 'short',
            })}
          </span>
          <button className="btn-icon-top" title="Notificaciones" aria-label="Notificaciones">
            <Bell size={18} />
          </button>
          <button className="btn-icon-top" title="Cerrar sesión" aria-label="Cerrar sesión">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* ── VELO (solo mobile, con el drawer abierto) ─────────── */}
      {drawerOpen && (
        <div className="mobile-overlay" onClick={closeDrawer} aria-hidden="true" />
      )}

      {/* ── SIDEBAR / DRAWER ──────────────────────────────────── */}
      <aside className={`sidebar ${drawerOpen ? 'open' : ''}`} aria-label="Navegación principal">
        {/* Cabecera visible solo en mobile: la marca vive en el topbar en
            desktop. No lleva botón de cerrar porque la hamburguesa del
            topbar ya es una X y queda justo encima. */}
        <div className="sidebar-logo">
          <span className="logo-mark">P+</span>
          <div>
            <div className="logo-name">PlussChile</div>
            <div className="logo-sub">Sistema Operacional</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={closeDrawer}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <span className="nav-icon"><Icon size={18} /></span>
                    <span className="nav-label">{item.label}</span>
                    {!item.ready && <span className="nav-dot" title="Módulo en construcción" />}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="user-avatar">
            FO
            <span className="user-online" />
          </div>
          <div className="user-meta">
            <div className="user-name">Felipe Operaciones</div>
            <div className="user-role">Jefe de Operaciones</div>
          </div>
        </div>
      </aside>

      {/* ── CONTENIDO ─────────────────────────────────────────── */}
      <main className="main">
        <div className="page-content fade-in" key={location.pathname}>
          <Outlet />
        </div>
      </main>

      {/* ── BOTTOM NAV (solo teléfono) ────────────────────────── */}
      <nav className="bottom-nav" aria-label="Navegación rápida">
        {bottomItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span className="bottom-nav-label">{item.short}</span>
            </NavLink>
          );
        })}
        <button
          className={`bottom-nav-item ${drawerOpen ? 'active' : ''}`}
          onClick={toggleDrawer}
          aria-label="Más opciones"
          aria-expanded={drawerOpen}
        >
          <MoreHorizontal size={20} />
          <span className="bottom-nav-label">Más</span>
        </button>
      </nav>
    </div>
  );
}
