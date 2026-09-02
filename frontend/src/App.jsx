import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Flota from './pages/Flota';
import Conductores from './pages/Conductores';
import Planificacion from './pages/Planificacion';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="flota" element={<Flota />} />
          <Route path="conductores" element={<Conductores />} />
          <Route path="planificacion" element={<Planificacion />} />
          {/* Otras rutas se irán agregando aquí */}
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
