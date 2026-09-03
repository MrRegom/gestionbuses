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

/* Respaldos por si el backend es anterior a que las reglas viajaran en
   la sesión. No son la fuente de verdad: esa es `models.py`. */
const REGLAS_POR_DEFECTO = {
  horas_conduccion_max: 5,
  horas_conduccion_aviso: 4,
  dotacion_requerida: { CONDUCTOR: 2, ASISTENTE: 1 },
};

/**
 * Reglas del negocio que manda el servidor.
 *
 * Antes cada pantalla llevaba su propia copia —Conductores tenía un
 * `HORAS_MAX = 9`— y cuando Operaciones confirmó que el tope real son
 * cinco horas continuas, la interfaz siguió midiendo contra nueve.
 */
export function useReglas() {
  const { sesion } = useAuth();
  return sesion?.reglas ?? REGLAS_POR_DEFECTO;
}
