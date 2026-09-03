/**
 * Vocabulario del negocio que la interfaz necesita nombrar.
 *
 * El servidor habla en códigos —`JEFE_MAQUINA`— y las pantallas tienen
 * que escribirlos como los escribe Operaciones en su planilla. Vive
 * aquí y no repetido en cada página para que "2° conductor" se lea
 * igual en Planificación que en Conductores.
 *
 * El orden es el de la planilla, y también el orden en que se cubren
 * los puestos: primero el jefe de máquina, después el segundo, al final
 * el auxiliar.
 */
export const PUESTOS = [
  {
    id: 'JEFE_MAQUINA',
    label: 'Jefe de máquina',
    corto: 'Jefe de máquina',
    plural: 'jefes de máquina',
    cargo: 'CONDUCTOR',
  },
  {
    id: 'SEGUNDO_CONDUCTOR',
    label: '2° conductor',
    corto: '2° conductor',
    plural: 'segundos conductores',
    cargo: 'CONDUCTOR',
  },
  {
    id: 'AUXILIAR',
    label: 'Auxiliar',
    corto: 'Auxiliar',
    plural: 'auxiliares',
    cargo: 'ASISTENTE',
  },
];

/** Etiqueta de un puesto por su código. */
export const ETIQUETA_PUESTO = Object.fromEntries(
  PUESTOS.map(p => [p.id, p.label]),
);
