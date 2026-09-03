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

/**
 * Sesión caída: volver al login en vez de romper cada pantalla.
 *
 * Cuando la sesión del servidor deja de existir, la aplicación no se
 * entera: la cookie sigue en el navegador y el estado en memoria dice
 * que hay sesión, así que se sigue mostrando el menú y cada pantalla
 * falla por su cuenta con "no se pudieron cargar los datos". El usuario
 * ve una aplicación rota sin saber que en realidad lo desconectaron.
 *
 * Un 403 no basta para decidir: tambien lo devuelve un permiso negado
 * legítimo —el taller entrando a Auditoría, por ejemplo— y sacar a esa
 * persona de la aplicación sería peor. Por eso se pregunta al servidor
 * quién es: si responde que nadie, la sesión murió; si responde, era un
 * problema de permisos y no se toca nada.
 */
export const EVENTO_SESION_CAIDA = 'sgo:sesion-caida';

let comprobacion = null;

function sesionSigueViva() {
  // Una sola consulta aunque fallen diez peticiones a la vez.
  comprobacion ??= axios
    .get('/api/auth/sesion/')
    .finally(() => { comprobacion = null; });
  return comprobacion;
}

axios.interceptors.response.use(
  respuesta => respuesta,
  async error => {
    const estado = error.response?.status;
    const url = error.config?.url ?? '';

    // Los propios endpoints de sesión quedan fuera: preguntar por la
    // sesión cuando falla la consulta de sesión es un bucle.
    const esDeAuth = url.includes('/api/auth/');

    if ((estado === 401 || estado === 403) && !esDeAuth) {
      try {
        await sesionSigueViva();
      } catch {
        window.dispatchEvent(new CustomEvent(EVENTO_SESION_CAIDA));
      }
    }

    return Promise.reject(error);
  },
);

export default axios;
