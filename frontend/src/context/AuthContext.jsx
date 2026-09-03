import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios, { EVENTO_SESION_CAIDA } from '../api';

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
  const [expirada, setExpirada] = useState(false);

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

  /* La sesión puede morir en el servidor mientras la app sigue abierta.
     `api.js` lo detecta al recibir un 403 y avisa por aquí; sin esto
     cada pantalla fallaba por su cuenta y el usuario veía la aplicación
     rota en vez de una pantalla de login. */
  useEffect(() => {
    const caida = () => {
      setSesion(null);
      setExpirada(true);
    };
    window.addEventListener(EVENTO_SESION_CAIDA, caida);
    return () => window.removeEventListener(EVENTO_SESION_CAIDA, caida);
  }, []);

  const login = async (username, password) => {
    const { data } = await axios.post('/api/auth/login/', { username, password });
    setSesion(data);
    setExpirada(false);
    return data;
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout/');
    } finally {
      // Aunque el servidor falle, localmente se cierra la sesión.
      setSesion(null);
      setExpirada(false);
    }
  };

  return (
    <AuthContext.Provider value={{ sesion, cargando, expirada, login, logout, recargar: comprobar }}>
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
  dotacion_requerida: { CONDUCTOR: 2, ASISTENTE: 1 },
};

/**
 * Reglas del negocio que manda el servidor.
 *
 * Viven en el servidor y no copiadas en cada pantalla: cuando lo
 * estuvieron, cambiar una regla dejaba a la interfaz midiendo contra el
 * valor viejo sin que nadie lo notara.
 */
export function useReglas() {
  const { sesion } = useAuth();
  return sesion?.reglas ?? REGLAS_POR_DEFECTO;
}
