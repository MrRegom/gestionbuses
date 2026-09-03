import { registerSW } from 'virtual:pwa-register';

/**
 * Mantiene la app al día con lo que hay desplegado.
 *
 * El service worker guarda el bundle para que la app abra rápido y
 * pueda instalarse en el teléfono del conductor. El costo es que, tras
 * un despliegue, sigue sirviendo el bundle anterior hasta que se
 * entera del nuevo, y entonces convive un frontend viejo con un
 * backend nuevo. No es teórico: cuando se agregó el perfil de
 * administrador, quien tenía la app abierta entró con el bundle
 * anterior —que no conocía ese rol— y se quedó sin menú y sin acceso a
 * ninguna pantalla.
 *
 * Por eso aquí se busca versión nueva no solo al cargar, sino cada vez
 * que la pestaña vuelve al frente y cada media hora si queda abierta.
 * Al encontrarla, la página se recarga sola.
 */
const CADA = 30 * 60 * 1000;

export function vigilarActualizaciones() {
  if (!('serviceWorker' in navigator)) return;

  const actualizar = registerSW({
    immediate: true,

    onNeedRefresh() {
      // Hay versión nueva lista. Recargar es seguro: la sesión vive en
      // una cookie del servidor, no en memoria, así que nadie pierde
      // el login ni queda a medio camino.
      actualizar(true);
    },

    onRegisteredSW(_url, registro) {
      if (!registro) return;

      const buscar = () => {
        if (document.visibilityState === 'visible') registro.update();
      };

      document.addEventListener('visibilitychange', buscar);
      window.addEventListener('online', buscar);
      setInterval(buscar, CADA);
    },
  });
}
