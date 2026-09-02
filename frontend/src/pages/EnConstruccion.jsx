import { useLocation, Link } from 'react-router-dom';
import { HardHat, ArrowLeft } from 'lucide-react';
import { findNavItem } from '../config/navigation';

/**
 * Pantalla para los módulos de la hoja de ruta que aún no existen.
 *
 * Reemplaza el vacío que antes aparecía al pulsar Corridas, Incidentes
 * o Checklist: el menú los ofrecía pero App.jsx no tenía esas rutas,
 * así que el Outlet no renderizaba nada.
 */
export default function EnConstruccion() {
  const { pathname } = useLocation();
  const item = findNavItem(pathname);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{item?.title ?? 'Módulo no disponible'}</h1>
          <p className="page-subtitle">{item?.subtitle ?? 'Esta sección aún no está publicada'}</p>
        </div>
      </div>

      <div className="card">
        <div className="empty-state">
          <span className="empty-icon"><HardHat size={40} strokeWidth={1.5} /></span>
          <div className="empty-title">Módulo en construcción</div>
          <p className="empty-sub">
            {item
              ? `"${item.label}" está en la hoja de ruta y todavía no se ha implementado.`
              : 'La ruta solicitada no corresponde a ningún módulo del sistema.'}
          </p>
          <div className="mt-5">
            <Link to="/" className="btn btn-secondary">
              <ArrowLeft size={16} /> Volver al Dashboard
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
