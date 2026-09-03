import { useState } from 'react';
import { LogIn, AlertCircle, Bus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState(null);
  const [entrando, setEntrando] = useState(false);

  const enviar = async e => {
    e.preventDefault();
    setEntrando(true);
    setError(null);
    try {
      await login(form.username.trim(), form.password);
      // No hace falta navegar: al haber sesión, App renderiza la app.
    } catch (err) {
      setError(
        err.response?.data?.error ??
        'No se pudo conectar con el servidor. Revisa que Django esté corriendo.'
      );
      setEntrando(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <img src="/logo.png" alt="PlussChile" className="brand-logo lg" />
          <div className="login-sub">Sistema de Gestión Operacional</div>
        </div>

        <form onSubmit={enviar} className="flex flex-col gap-4">
          {error && (
            <div className="notice danger">
              <AlertCircle size={16} className="notice-icon" />
              <div className="notice-content">{error}</div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="lg-user">Usuario</label>
            <input
              id="lg-user" type="text" className="form-input" required autoFocus
              autoComplete="username"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="lg-pass">Contraseña</label>
            <input
              id="lg-pass" type="password" className="form-input" required
              autoComplete="current-password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <button
            type="submit" className="btn btn-primary btn-lg w-full"
            disabled={entrando || !form.username || !form.password}
          >
            {entrando ? <><span className="spinner" /> Entrando…</> : <><LogIn size={16} /> Entrar</>}
          </button>
        </form>

        <div className="login-pie">
          <Bus size={13} /> Acceso restringido al personal autorizado
        </div>
      </div>
    </div>
  );
}
