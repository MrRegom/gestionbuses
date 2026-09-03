import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { puedeAcceder, rutaInicial } from './config/navigation';

import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Flota from './pages/Flota';
import Conductores from './pages/Conductores';
import Planificacion from './pages/Planificacion';
import Rastreo from './pages/Rastreo';
import Mantenimiento from './pages/Mantenimiento';
import Reportes from './pages/Reportes';
import Checklist from './pages/Checklist';
import Incidentes from './pages/Incidentes';
import Corridas from './pages/Corridas';
import Configuracion from './pages/Configuracion';
import EnConstruccion from './pages/EnConstruccion';
import SinAcceso from './pages/SinAcceso';

/**
 * Guarda de ruta por perfil.
 *
 * Es una comodidad de interfaz, no la barrera de seguridad: quien
 * corresponde decidir es el backend, que valida el rol en cada
 * endpoint. Aquí solo se evita mostrar pantallas que igualmente
 * devolverían 403.
 */
function Protegida({ children }) {
  const { sesion } = useAuth();
  const { pathname } = useLocation();

  if (!puedeAcceder(sesion.rol, pathname)) return <SinAcceso />;
  return children;
}

function Aplicacion() {
  const { sesion, cargando } = useAuth();

  if (cargando) {
    return (
      <div className="boot-shell">
        <span className="spinner" />
        <span>Comprobando sesión…</span>
      </div>
    );
  }

  if (!sesion) return <Login />;

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Protegida><Dashboard /></Protegida>} />
        <Route path="planificacion" element={<Protegida><Planificacion /></Protegida>} />
        <Route path="conductores" element={<Protegida><Conductores /></Protegida>} />
        <Route path="flota" element={<Protegida><Flota /></Protegida>} />
        <Route path="rastreo" element={<Protegida><Rastreo /></Protegida>} />
        <Route path="mantenimiento" element={<Protegida><Mantenimiento /></Protegida>} />
        <Route path="auditoria" element={<Protegida><Reportes /></Protegida>} />
        <Route path="incidentes" element={<Protegida><Incidentes /></Protegida>} />
        <Route path="checklist" element={<Protegida><Checklist /></Protegida>} />

        <Route path="corridas" element={<Protegida><Corridas /></Protegida>} />
        <Route path="configuracion" element={<Protegida><Configuracion /></Protegida>} />

        {/* Cualquier URL desconocida cae aquí en vez de mostrar nada. */}
        <Route path="*" element={<EnConstruccion />} />
      </Route>

      {/* Si alguien queda en /login con sesión abierta, se le manda a
          la primera pantalla que su perfil puede ver. */}
      <Route path="/login" element={<Navigate to={rutaInicial(sesion.rol)} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Aplicacion />
      </AuthProvider>
    </Router>
  );
}
