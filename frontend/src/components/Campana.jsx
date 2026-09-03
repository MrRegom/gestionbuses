import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CalendarPlus, CalendarX, Bus, Navigation } from 'lucide-react';
import axios from '../api';
import { hace } from '../utils/formato';

/**
 * Avisos de la persona que tiene la sesión abierta.
 *
 * La campana estaba en la barra desde el principio pero no hacía nada.
 * Es el canal por el que la planificación llega a la tripulación: hasta
 * ahora el sistema guardaba bien la asignación y no se lo decía a
 * nadie, así que el conductor se seguía enterando por WhatsApp —el
 * punto de dolor que el proyecto quiere eliminar—.
 *
 * Se consulta al montar y cada dos minutos. No es tiempo real y no hace
 * falta que lo sea: entre que Operaciones asigna y el conductor sale
 * pasan horas.
 */
const CADA = 2 * 60 * 1000;

const ICONO = {
  ASIGNACION: CalendarPlus,
  DESASIGNACION: CalendarX,
  CAMBIO_BUS: Bus,
  CORRIDA: Navigation,
};

const TONO = {
  ASIGNACION: 'ok',
  DESASIGNACION: 'warn',
  CAMBIO_BUS: 'info',
  CORRIDA: 'danger',
};

export default function Campana() {
  const [abierta, setAbierta] = useState(false);
  const [avisos, setAvisos] = useState([]);
  const [sinLeer, setSinLeer] = useState(0);
  const navigate = useNavigate();
  const boton = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/auth/notificaciones/');
      setAvisos(data.notificaciones);
      setSinLeer(data.sin_leer);
    } catch {
      // Sin avisos no se rompe nada: es información, no operación.
    }
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, CADA);
    return () => clearInterval(t);
  }, [cargar]);

  /* Cerrar al hacer clic fuera y con Escape, como cualquier menú. */
  useEffect(() => {
    if (!abierta) return;
    const fuera = e => {
      if (!e.target.closest('.avisos-panel') && !boton.current?.contains(e.target)) {
        setAbierta(false);
      }
    };
    const escape = e => { if (e.key === 'Escape') setAbierta(false); };
    document.addEventListener('mousedown', fuera);
    window.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', fuera);
      window.removeEventListener('keydown', escape);
    };
  }, [abierta]);

  const marcarTodas = async () => {
    try {
      await axios.post('/api/auth/notificaciones/', {});
      setAvisos(a => a.map(x => ({ ...x, leida: true })));
      setSinLeer(0);
    } catch { /* se reintenta en la próxima consulta */ }
  };

  const abrir = async aviso => {
    setAbierta(false);
    if (!aviso.leida) {
      try {
        await axios.post('/api/auth/notificaciones/', { ids: [aviso.id] });
        setSinLeer(n => Math.max(0, n - 1));
        setAvisos(a => a.map(x => (x.id === aviso.id ? { ...x, leida: true } : x)));
      } catch { /* el aviso igual lleva a su pantalla */ }
    }
    navigate(aviso.ruta || '/');
  };

  return (
    <>
      <button
        ref={boton}
        className="btn-icon-top"
        title="Avisos"
        aria-label={sinLeer ? `Avisos (${sinLeer} sin leer)` : 'Avisos'}
        onClick={() => setAbierta(v => !v)}
      >
        <Bell size={18} />
        {sinLeer > 0 && (
          <span className="notif-badge">{sinLeer > 9 ? '9+' : sinLeer}</span>
        )}
      </button>

      {abierta && createPortal(
        <div className="avisos-panel" role="dialog" aria-label="Avisos">
          <div className="avisos-header">
            <span className="card-title">Avisos</span>
            {sinLeer > 0 && (
              <button className="btn btn-ghost btn-sm ml-auto" onClick={marcarTodas}>
                <Check size={13} /> Marcar leídos
              </button>
            )}
          </div>

          <div className="avisos-body">
            {avisos.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--sp-8) var(--sp-4)' }}>
                <span className="empty-icon"><Bell size={28} strokeWidth={1.5} /></span>
                <div className="empty-title">Sin avisos</div>
                <p className="empty-sub">
                  Aquí llegan los servicios que te asignen y los cambios de máquina.
                </p>
              </div>
            ) : avisos.map(a => {
              const Icono = ICONO[a.tipo] ?? Bell;
              return (
                <button
                  key={a.id}
                  className={`aviso ${a.leida ? '' : 'nuevo'}`}
                  onClick={() => abrir(a)}
                >
                  <span className={`alert-item-icon ${TONO[a.tipo] ?? 'info'}`}>
                    <Icono size={15} />
                  </span>
                  <span className="flex-1 text-left">
                    <span className="alert-item-text">{a.titulo}</span>
                    <span className="alert-item-sub">{a.detalle}</span>
                  </span>
                  <span className="alert-item-time">{hace(a.creado_en)}</span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
