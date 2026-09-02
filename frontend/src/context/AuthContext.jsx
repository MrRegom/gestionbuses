import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from '../api';

const AuthContext = createContext(null);

/**
 * Estado de sesión de la aplicación.
 *
 * Al arrancar consulta `/api/auth/sesion/`, que además de decir quién
 * eres deja la cookie CSRF necesaria para el POST de login.
 */
export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(null);   // null = sin sesión
  const [cargando, setCargando] = useState(true);

  const comprobar = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/auth/sesion/');
      setSesion(data);
    } catch {
      // 401 es la respuesta normal cuando nadie ha iniciado sesión.
      setSesion(null);
    }
    setCargando(false);
  }, []);

  useEffect(() => { comprobar(); }, [comprobar]);

  const login = async (username, password) => {
    const { data } = await axios.post('/api/auth/login/', { username, password });
    setSesion(data);
    return data;
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout/');
    } finally {
      // Aunque el servidor falle, localmente se cierra la sesión.
      setSesion(null);
    }
  };

  return (
    <AuthContext.Provider value={{ sesion, cargando, login, logout, recargar: comprobar }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
