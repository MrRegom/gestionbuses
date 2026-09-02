import {
  LayoutDashboard, CalendarClock, Users, Navigation,
  Bus, AlertTriangle, ClipboardCheck, Wrench, Shield, Radio,
} from 'lucide-react';

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
        title: 'Dashboard Operativo',
        subtitle: 'Resumen en tiempo real',
        ready: true,
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
      },
      {
        id: 'corridas',
        path: '/corridas',
        label: 'Corridas',
        short: 'Corridas',
        icon: Navigation,
        title: 'Gestión de Corridas',
        subtitle: 'Reasignación de recursos ante fallas',
        ready: false,
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
      },
    ],
  },
];

/** Lista plana de todos los destinos. */
export const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items);

/**
 * Destinos del bottom nav en teléfono. Cuatro accesos primarios; el
 * quinto slot lo ocupa el botón "Más", que abre el menú completo.
 */
export const BOTTOM_NAV_IDS = ['dashboard', 'planificacion', 'flota', 'conductores'];

/** Metadatos de la ruta activa, para el título del topbar. */
export function findNavItem(pathname) {
  return NAV_ITEMS.find(item => item.path === pathname) || null;
}
