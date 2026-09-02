import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, Check } from 'lucide-react';

/**
 * Diálogo de formulario reutilizable.
 *
 * Flota, Personal y Planificación abrían el mismo modal con distinto
 * contenido; esto evita repetir tres veces el portal, el bloqueo de
 * scroll, el cierre con Escape y el pie de botones.
 */
export default function DialogoForm({
  abierto, titulo, onCerrar, onGuardar,
  guardando = false, error = null, disabled = false,
  guardarLabel = 'Guardar', children,
}) {
  useEffect(() => {
    if (!abierto) return;
    const onKey = e => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto, onCerrar]);

  useEffect(() => {
    document.body.classList.toggle('no-scroll', abierto);
    return () => document.body.classList.remove('no-scroll');
  }, [abierto]);

  return createPortal(
    <div
      className={`modal-overlay ${abierto ? 'open' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-header">
          <span className="modal-title">{titulo}</span>
          <button className="btn-icon" onClick={onCerrar} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onGuardar(); }}>
          <div className="modal-body flex flex-col gap-4">
            {error && (
              <div className="notice danger">
                <AlertCircle size={16} className="notice-icon" />
                <div className="notice-content">{error}</div>
              </div>
            )}
            {children}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCerrar}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={guardando || disabled}>
              {guardando
                ? <><span className="spinner" /> Guardando…</>
                : <><Check size={15} /> {guardarLabel}</>}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

/** Extrae un mensaje legible de un error de DRF. */
export function mensajeError(err, porDefecto = 'No se pudo guardar.') {
  const data = err.response?.data;
  if (!data) return porDefecto;
  if (data.error) return data.error;
  // Errores de campo: {"numero": ["Bus with this numero already exists."]}
  const primer = Object.entries(data)[0];
  if (primer) {
    const [campo, msgs] = primer;
    const texto = Array.isArray(msgs) ? msgs.join(' ') : String(msgs);
    return campo === 'non_field_errors' ? texto : `${campo}: ${texto}`;
  }
  return porDefecto;
}
