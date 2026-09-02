import { Link } from 'react-router-dom';
import { ShieldOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { rutaInicial } from '../config/navigation';

/** El perfil en sesión no tiene permiso sobre esta ruta. */
export default function SinAcceso() {
  const { sesion } = useAuth();
  const destino = rutaInicial(sesion.rol);

  return (
    <div className="card">
      <div className="empty-state">
        <span className="empty-icon"><ShieldOff size={40} strokeWidth={1.5} /></span>
        <div className="empty-title">Sin acceso a esta sección</div>
        <p className="empty-sub">
          Tu perfil <strong>{sesion.rol_label}</strong> no tiene permiso sobre esta pantalla.
        </p>
        <div className="mt-5">
          <Link to={destino} className="btn btn-secondary">
            <ArrowLeft size={16} /> Volver a mi inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
