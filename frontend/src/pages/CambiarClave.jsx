import { useState } from 'react';
import { KeyRound, AlertCircle, Check } from 'lucide-react';
import axios from '../api';
import { useAuth } from '../context/AuthContext';

/**
 * Cambio obligatorio al primer ingreso.
 *
 * Operaciones crea la cuenta y le dicta la clave a la persona —por
 * teléfono, por WhatsApp, en el terminal—. Esa clave la conocen dos
 * personas y queda escrita en alguna parte, así que la aplicación no
 * deja pasar de aquí hasta que su dueño la cambie.
 *
 * Ocupa la pantalla entera a propósito: no es un aviso que se pueda
 * postergar.
 */
export default function CambiarClave() {
  const { recargar, logout, sesion } = useAuth();
  const [form, setForm] = useState({ actual: '', nueva: '', repetir: '' });
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const coinciden = form.nueva && form.nueva === form.repetir;
  const largaOk = form.nueva.length >= 8;
  const puede = form.actual && coinciden && largaOk;

  const enviar = async e => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await axios.post('/api/auth/clave/', {
        actual: form.actual, nueva: form.nueva,
      });
      // Recargar la sesión: trae `debe_cambiar_clave` en false y con eso
      // la aplicación deja de mostrar esta pantalla.
      await recargar();
    } catch (err) {
      setError(err.response?.data?.error ?? 'No se pudo cambiar la contraseña.');
      setGuardando(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <img src="/logo.png" alt="PlussChile" className="brand-logo lg" />
          <div className="login-sub">
            Hola {sesion?.nombre?.split(' ')[0]} — elige tu contraseña
          </div>
        </div>

        <div className="notice info mb-4">
          <span className="notice-icon"><KeyRound size={16} /></span>
          <div className="notice-content">
            <div className="notice-desc">
              La que te dieron la conoce alguien más. Cámbiala por una tuya
              antes de seguir.
            </div>
          </div>
        </div>

        <form onSubmit={enviar} className="flex flex-col gap-4">
          {error && (
            <div className="notice danger">
              <AlertCircle size={16} className="notice-icon" />
              <div className="notice-content">{error}</div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="cl-actual">
              La contraseña que te dieron
            </label>
            <input
              id="cl-actual" type="password" className="form-input" required autoFocus
              autoComplete="current-password"
              value={form.actual}
              onChange={e => setForm({ ...form, actual: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="cl-nueva">Tu contraseña nueva</label>
            <input
              id="cl-nueva" type="password" className="form-input" required
              autoComplete="new-password"
              value={form.nueva}
              onChange={e => setForm({ ...form, nueva: e.target.value })}
            />
            {form.nueva && !largaOk && (
              <p className="fs-12 text-muted mt-1">Al menos 8 caracteres.</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="cl-repetir">Repítela</label>
            <input
              id="cl-repetir" type="password" className="form-input" required
              autoComplete="new-password"
              value={form.repetir}
              onChange={e => setForm({ ...form, repetir: e.target.value })}
            />
            {form.repetir && !coinciden && (
              <p className="fs-12 text-danger mt-1">No coinciden.</p>
            )}
          </div>

          <button type="submit" className="btn btn-primary btn-lg w-full"
                  disabled={!puede || guardando}>
            {guardando ? <><span className="spinner" /> Guardando…</>
                       : <><Check size={16} /> Guardar y entrar</>}
          </button>
        </form>

        <div className="login-pie">
          <button className="btn btn-ghost btn-sm" onClick={logout}>
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
