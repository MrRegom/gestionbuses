import {
  LayoutDashboard, CalendarClock, Users, Navigation,
  Bus, AlertTriangle, ClipboardCheck, Wrench, Shield, Radio,
  SlidersHorizontal,
} from 'lucide-react';

/* Perfiles del sistema (README §3). Deben coincidir con
   Persona.Rol del backend. */
export const ROLES = {
  JEFE_OPERACIONES: 'JEFE_OPERACIONES',
  JEFE_MECANICOS: 'JEFE_MECANICOS',
  MONITOREO: 'MONITOREO',
  CONDUCTOR: 'CONDUCTOR',
  ASISTENTE: 'ASISTENTE',
  MECANICO: 'MECANICO',
};

const OPERACIONES = [ROLES.JEFE_OPERACIONES, ROLES.MONITOREO];
const TALLER = [ROLES.JEFE_MECANICOS, ROLES.MECANICO];
const TRIPULACION = [ROLES.CONDUCTOR, ROLES.ASISTENTE];
const TODOS = [...OPERACIONES, ...TALLER, ...TRIPULACION];

/**
 * Fuente única de verdad de la navegación.
 *
 * Tanto el menú lateral como el bottom nav y las rutas de App.jsx
 * se generan desde aquí. Antes el menú declaraba rutas (/corridas,
 * /incidentes, /checklist) que App.jsx no registraba, y al pulsarlas
 * la pantalla quedaba en blanco. Con un solo modelo eso no puede
 * volver a pasar.
 *
 * `ready: false` marca los módulos de la hoja de ruta que aún no
 * están construidos: se muestran igual, pero renderizan una página
 * de "en construcción" en vez de un vacío.
 */
export const NAV_GROUPS = [
  {
    label: 'Operación',
    items: [
      {
        id: 'dashboard',
        path: '/',
        label: 'Dashboard',
        short: 'Inicio',
        icon: LayoutDashboard,
        // Se resuelve con `tituloDe`: el tablero cambia según el
        // perfil. Este valor es el respaldo si el rol no está en la
        // tabla.
        title: 'Inicio',
        subtitle: 'Resumen de la jornada',
        ready: true,
        roles: TODOS,
      },
      {
        id: 'planificacion',
        path: '/planificacion',
        label: 'Planificación',
        short: 'Plan',
        icon: CalendarClock,
        title: 'Planificación de Posturas',
        subtitle: 'Gestión de viajes y asignación de recursos',
        ready: true,
        roles: OPERACIONES,
      },
      {
        id: 'corridas',
        path: '/corridas',
        label: 'Corridas',
        short: 'Corridas',
        icon: Navigation,
        title: 'Gestión de Corridas',
        subtitle: 'Reasignación de recursos ante fallas',
        ready: true,
        roles: OPERACIONES,
      },
      {
        id: 'rastreo',
        path: '/rastreo',
        label: 'Rastreo',
        short: 'Rastreo',
        icon: Radio,
        title: 'Rastreo y Asistencia',
        subtitle: 'Monitoreo GPS y control de incidentes',
        ready: true,
        roles: [...OPERACIONES, ...TALLER],
      },
    ],
  },
  {
    label: 'Recursos',
    items: [
      {
        id: 'flota',
        path: '/flota',
        label: 'Flota',
        short: 'Flota',
        icon: Bus,
        title: 'Gestión de Flota',
        subtitle: 'Inventario de buses y mantenimiento',
        ready: true,
        roles: [...OPERACIONES, ...TALLER],
      },
      {
        id: 'conductores',
        path: '/conductores',
        label: 'Conductores',
        short: 'Personal',
        icon: Users,
        title: 'Gestión de Tripulación',
        subtitle: 'Conductores y asistentes — asignación de posturas',
        ready: true,
        roles: OPERACIONES,
      },
    ],
  },
  {
    label: 'Taller',
    items: [
      {
        id: 'incidentes',
        path: '/incidentes',
        label: 'Incidentes',
        short: 'Fallas',
        icon: AlertTriangle,
        title: 'Incidentes en Ruta',
        subtitle: 'Fallas reportadas por la tripulación',
        ready: true,
        roles: TODOS,
      },
      {
        id: 'checklist',
        path: '/checklist',
        label: 'Checklist',
        short: 'Check',
        icon: ClipboardCheck,
        title: 'Checklist Digital',
        subtitle: 'Revisión de salida y recepción de buses',
        ready: true,
        roles: [...TRIPULACION, ...TALLER],
      },
      {
        id: 'mantenimiento',
        path: '/mantenimiento',
        label: 'Mantenimiento',
        short: 'Taller',
        icon: Wrench,
        title: 'Taller y Mantenimiento',
        subtitle: 'Bandeja de fallas y órdenes de trabajo',
        ready: true,
        roles: TALLER,
      },
    ],
  },
  {
    label: 'Sistema',
    items: [
      {
        id: 'auditoria',
        path: '/auditoria',
        label: 'Auditoría',
        short: 'Auditoría',
        icon: Shield,
        title: 'Reportes y Auditoría',
        subtitle: 'Métricas de rendimiento e indicadores',
        ready: true,
        roles: OPERACIONES,
      },
      {
        id: 'configuracion',
        path: '/configuracion',
        label: 'Configuración',
        short: 'Config',
        icon: SlidersHorizontal,
        title: 'Configuración',
        subtitle: 'Reglas, rutas y plantilla del checklist',
        ready: true,
        // Quien define la dotación, el tope de horas y qué se revisa
        // antes de salir es Operaciones. Monitoreo entra en solo
        // lectura, como en el resto del sistema.
        roles: OPERACIONES,
      },
    ],
  },
];

/** Lista plana de todos los destinos. */
export const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items);

/**
 * Bottom nav del teléfono.
 *
 * Solo la tripulación trabaja desde el celular: Operaciones y el taller
 * usan PC. Por eso los accesos rápidos son los suyos —su checklist y el
 * reporte de fallas— y para el resto de perfiles el bottom nav no se
 * muestra: en un escritorio solo estorbaría.
 */
export const BOTTOM_NAV_IDS = ['dashboard', 'checklist', 'incidentes'];

/** Perfiles cuyo trabajo ocurre en el celular. */
const ROLES_MOVILES = [ROLES.CONDUCTOR, ROLES.ASISTENTE];

export function usaBottomNav(rol) {
  return ROLES_MOVILES.includes(rol);
}

/** Grupos visibles para un rol, sin los grupos que quedan vacíos. */
export function navParaRol(rol) {
  return NAV_GROUPS
    .map(g => ({ ...g, items: g.items.filter(i => i.roles.includes(rol)) }))
    .filter(g => g.items.length > 0);
}

/** ¿Este perfil puede entrar a esta ruta? */
export function puedeAcceder(rol, pathname) {
  const item = NAV_ITEMS.find(i => i.path === pathname);
  return item ? item.roles.includes(rol) : true;
}

/** Primera ruta disponible para el rol: a dónde mandar tras el login. */
export function rutaInicial(rol) {
  const grupos = navParaRol(rol);
  return grupos[0]?.items[0]?.path ?? '/';
}

/* El tablero de inicio no es la misma pantalla para todos: operaciones
   ve la flota, el taller su bandeja y la tripulación su jornada. El
   topbar tiene que decir lo mismo que la página, y en teléfono es el
   único sitio donde el título se ve, porque el encabezado de la página
   queda oculto. */
const TITULO_INICIO = {
  [ROLES.JEFE_OPERACIONES]: 'Dashboard Operativo',
  [ROLES.MONITOREO]: 'Dashboard Operativo',
  [ROLES.JEFE_MECANICOS]: 'Tablero de Taller',
  [ROLES.MECANICO]: 'Tablero de Taller',
  [ROLES.CONDUCTOR]: 'Mi jornada',
  [ROLES.ASISTENTE]: 'Mi jornada',
};

/** Título de una entrada de navegación para un perfil dado. */
export function tituloDe(item, rol) {
  if (!item) return null;
  if (item.id === 'dashboard') return TITULO_INICIO[rol] ?? item.title;
  return item.title;
}

/** Metadatos de la ruta activa, para el título del topbar. */
export function findNavItem(pathname) {
  return NAV_ITEMS.find(item => item.path === pathname) || null;
}
