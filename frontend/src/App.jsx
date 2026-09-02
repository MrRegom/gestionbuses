import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Flota from './pages/Flota';
import Conductores from './pages/Conductores';
import Planificacion from './pages/Planificacion';
import Rastreo from './pages/Rastreo';
import Mantenimiento from './pages/Mantenimiento';
import Reportes from './pages/Reportes';
import EnConstruccion from './pages/EnConstruccion';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="planificacion" element={<Planificacion />} />
          <Route path="conductores" element={<Conductores />} />
          <Route path="flota" element={<Flota />} />
          <Route path="rastreo" element={<Rastreo />} />
          <Route path="mantenimiento" element={<Mantenimiento />} />
          <Route path="auditoria" element={<Reportes />} />

          {/* Módulos de la hoja de ruta: el menú ya los ofrece, así que
              necesitan una ruta real o la pantalla queda en blanco. */}
          <Route path="corridas" element={<EnConstruccion />} />
          <Route path="incidentes" element={<EnConstruccion />} />
          <Route path="checklist" element={<EnConstruccion />} />

          {/* Cualquier URL desconocida cae aquí en vez de mostrar nada. */}
          <Route path="*" element={<EnConstruccion />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
