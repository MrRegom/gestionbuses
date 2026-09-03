/**
 * Formatos de presentación compartidos.
 *
 * Viven aquí y no en cada página para que "hace 3 h" se escriba igual
 * en el dashboard que en el taller.
 */

/** Distancia en palabras hasta ahora: "hace 12 min", "ayer", "12 ago". */
export function hace(iso) {
  if (!iso) return '';

  const entonces = new Date(iso);
  if (Number.isNaN(entonces.getTime())) return '';

  const minutos = Math.round((Date.now() - entonces.getTime()) / 60000);

  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;

  const dias = Math.round(horas / 24);
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;

  return entonces.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

/** Fecha larga en castellano: "martes 2 de septiembre". */
export function fechaLarga(iso) {
  if (!iso) return '';
  // Las fechas sin hora llegan como AAAA-MM-DD. Interpretarlas con
  // `new Date(iso)` las trata como UTC y en Chile retroceden un día.
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

/** AAAA-MM-DD para los `<input type="date">`. */
export function isoDeFecha(fecha) {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Miles con separador chileno. Acepta null sin romper. */
export function numero(valor) {
  if (valor === null || valor === undefined || valor === '') return '—';
  return Number(valor).toLocaleString('es-CL');
}

/** "3 de 14 · 21%" para los indicadores que tienen un total detrás. */
export function porcentaje(parte, total) {
  if (!total) return 0;
  return Math.round((parte / total) * 100);
}
