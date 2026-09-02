import axios from 'axios';

/**
 * Configuración global de axios para trabajar con sesiones de Django.
 *
 * Se aplica sobre la instancia por defecto en vez de crear una nueva
 * para que las páginas existentes, que llaman `axios.get('/api/...')`
 * directamente, queden cubiertas sin tocarlas.
 *
 * - withCredentials: manda la cookie de sesión. Sin esto el navegador
 *   la omite y toda petición vuelve como 403.
 * - xsrf*: axios lee la cookie `csrftoken` y la reenvía en la cabecera
 *   `X-CSRFToken`, que es lo que Django verifica en POST/PUT/DELETE.
 *   La cookie la deja `GET /api/auth/sesion/` al arrancar la app.
 */
axios.defaults.withCredentials = true;
axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';

export default axios;
