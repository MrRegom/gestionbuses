/* ============================================================
   APP.JS — Data Layer & Shared Helpers
   Sistema de Gestión Operacional — PlusChile
   ============================================================ */

/* ── MOCK DATA ──────────────────────────────────────────────── */
const DATA = {

  /* BUSES */
  buses: [
    { id:1,  numero:'BUS 101', patente:'BCLK45', modelo:'Volvo 9800',   km:124500, estado:'DISPONIBLE',    servicio:'SLC', pozo:null,   proxima:'08:30' },
    { id:2,  numero:'BUS 102', patente:'BCLK46', modelo:'Scania K440',  km:98200,  estado:'EN_SERVICIO',   servicio:'SC',  pozo:null,   proxima:'En ruta' },
    { id:3,  numero:'BUS 103', patente:'BCLK47', modelo:'Marcopolo G8', km:211300, estado:'DISPONIBLE',    servicio:'SC',  pozo:null,   proxima:'10:00' },
    { id:4,  numero:'BUS 104', patente:'BCLK48', modelo:'Volvo 9800',   km:178900, estado:'MANTENIMIENTO', servicio:'SLC', pozo:'P-02', proxima:'~14:00' },
    { id:5,  numero:'BUS 105', patente:'HTYB-45',modelo:'Volvo 9800',   km:95600,  estado:'EN_SERVICIO',   servicio:'SC',  pozo:null,   proxima:'En ruta' },
    { id:6,  numero:'BUS 106', patente:'BCLK50', modelo:'Mercedes O500',km:302100, estado:'DISPONIBLE',    servicio:'MIN', pozo:null,   proxima:'Sin asignar' },
    { id:7,  numero:'BUS 107', patente:'HTYG-21',modelo:'Marcopolo G8', km:56800,  estado:'DISPONIBLE',    servicio:'SLC', pozo:null,   proxima:'13:00' },
    { id:8,  numero:'BUS 108', patente:'HTYD-77',modelo:'Scania K440',  km:189400, estado:'FUERA_SERVICIO',servicio:'SC',  pozo:'P-01', proxima:'—' },
    { id:9,  numero:'BUS 109', patente:'HTYF-32',modelo:'Volvo 9800',   km:67300,  estado:'EN_SERVICIO',   servicio:'SLC', pozo:null,   proxima:'En ruta' },
    { id:10, numero:'BUS 110', patente:'HTYK-18',modelo:'Marcopolo G7', km:143200, estado:'DISPONIBLE',    servicio:'SC',  pozo:null,   proxima:'Sin asignar' },
  ],

  /* POSTURAS */
  posturas: [
    { id:1, codigo:'POS-001', hora:'08:00', origen:'Santiago', destino:'Antofagasta', servicio:'SC',  estado:'COMPLETA',  bus_id:5,  bus:'BUS 123', patente:'HTYB-45', modelo:'Volvo 9800',   crew:[1,3,4],   prioridad:false },
    { id:2, codigo:'POS-002', hora:'09:30', origen:'Santiago', destino:'Antofagasta', servicio:'SLC', estado:'COMPLETA',  bus_id:7,  bus:'BUS 145', patente:'HTYG-21', modelo:'Marcopolo G8', crew:[2,6],     prioridad:false },
    { id:3, codigo:'POS-003', hora:'11:00', origen:'Santiago', destino:'Antofagasta', servicio:'SC',  estado:'ALERTA',    bus_id:8,  bus:'BUS 105', patente:'HTYD-77', modelo:'Scania K440',  crew:[7],       prioridad:false },
    { id:4, codigo:'POS-004', hora:'12:30', origen:'Santiago', destino:'Antofagasta', servicio:'SC',  estado:'PROBLEMA',  bus_id:null,bus:null,      patente:null,      modelo:null,           crew:[],        prioridad:false },
    { id:5, codigo:'POS-005', hora:'14:00', origen:'Santiago', destino:'Antofagasta', servicio:'SLC', estado:'COMPLETA',  bus_id:9,  bus:'BUS 156', patente:'HTYK-18', modelo:'Marcopolo G8', crew:[5,8,9],   prioridad:false },
    { id:6, codigo:'POS-006', hora:'13:00', origen:'Santiago', destino:'Calama',      servicio:'MIN', estado:'COMPLETA',  bus_id:1,  bus:'BUS 101', patente:'BCLK45',  modelo:'Volvo 9800',   crew:[1,2],     prioridad:true  },
    { id:7, codigo:'POS-007', hora:'16:00', origen:'Concepción',destino:'Santiago',   servicio:'SC',  estado:'COMPLETA',  bus_id:3,  bus:'BUS 103', patente:'BCLK47',  modelo:'Marcopolo G8', crew:[3,4],     prioridad:false },
    { id:8, codigo:'POS-008', hora:'19:00', origen:'Santiago', destino:'Temuco',      servicio:'SLC', estado:'COMPLETA',  bus_id:10, bus:'BUS 110', patente:'HTYK-18', modelo:'Volvo 9800',   crew:[5,6,7],   prioridad:false },
  ],

  /* PERSONAS */
  personas: [
    { id:1, nombre:'Carlos Fuentes',  rut:'15.342.678-5', rol:'CONDUCTOR', tipo:'TITULAR', semaforo:'verde',    horas_hoy:4, razon:null },
    { id:2, nombre:'Rodrigo Vidal',   rut:'12.980.163-0', rol:'CONDUCTOR', tipo:'RELEVO',  semaforo:'verde',    horas_hoy:2, razon:null },
    { id:3, nombre:'Miguel Soto',     rut:'14.225.441-7', rol:'CONDUCTOR', tipo:'RELEVO',  semaforo:'amarillo', horas_hoy:6, razon:'Lleva 6h de jornada — Revisar descanso' },
    { id:4, nombre:'Pedro Núñez',     rut:'11.445.322-K', rol:'CONDUCTOR', tipo:'TITULAR', semaforo:'rojo',     horas_hoy:8, razon:'Ya está en postura POS-001. Solapamiento de horario.' },
    { id:5, nombre:'Juan Araya',      rut:'16.778.902-3', rol:'CONDUCTOR', tipo:'RELEVO',  semaforo:'verde',    horas_hoy:1, razon:null },
    { id:6, nombre:'Felipe Rojas',    rut:'13.009.887-2', rol:'ASISTENTE', tipo:'TITULAR', semaforo:'verde',    horas_hoy:3, razon:null },
    { id:7, nombre:'Ana Muñoz',       rut:'17.334.561-8', rol:'ASISTENTE', tipo:'TITULAR', semaforo:'amarillo', horas_hoy:5, razon:'Cerca del límite de jornada.' },
    { id:8, nombre:'Camila Torres',   rut:'18.112.445-1', rol:'ASISTENTE', tipo:'RELEVO',  semaforo:'verde',    horas_hoy:0, razon:null },
    { id:9, nombre:'David Carrasco',  rut:'14.567.890-4', rol:'CONDUCTOR', tipo:'TITULAR', semaforo:'verde',    horas_hoy:3, razon:null },
  ],

  /* CORRIDAS */
  corridas: [
    { id:1, fecha:'01/09/2026', hora:'05:45', bus_orig_id:4, bus_orig:'BUS 104', bus_sust_id:1, bus_sust:'BUS 101', motivo:'Falla en sistema de frenos ABS. Bus ingresó a Pozo P-02 para reparación urgente.', estado:'ACTIVA', usuario:'J. Operaciones', posturas_afectadas:[3,5] },
    { id:0, fecha:'28/08/2026', hora:'14:20', bus_orig_id:8, bus_orig:'BUS 108', bus_sust_id:7, bus_sust:'BUS 107', motivo:'Neumático reventado en ruta.', estado:'CERRADA', usuario:'Op. Martínez', posturas_afectadas:[2] },
  ],

  /* MANTENIMIENTO */
  ordenes: [
    { id:1, bus_id:4,  problema:'Falla en sistema de frenos ABS. Bus en Pozo P-02.', especialidad:'Frenos', tipo:'Correctivo', mecanico:'R. Herrera', pozo:'P-02', inicio:'06:20', estimado:'14:00', estado:'EN_PROCESO',   prioridad:'alta' },
    { id:2, bus_id:8,  problema:'Motor con sobrecalentamiento. Requiere diagnóstico urgente.', especialidad:'Motor', tipo:'Correctivo', mecanico:'M. Castro', pozo:'P-01', inicio:'—', estimado:'—', estado:'PENDIENTE', prioridad:'alta' },
    { id:3, bus_id:3,  problema:'Cambio de aceite y filtros preventivo 210K km.', especialidad:'General', tipo:'Preventivo', mecanico:'F. Rojas', pozo:'P-03', inicio:'04:00', estimado:'07:00', estado:'COMPLETADO', prioridad:'media' },
    { id:4, bus_id:6,  problema:'Ruido extraño en suspensión delantera. Detectado en ruta.', especialidad:'Suspensión', tipo:'Correctivo', mecanico:null, pozo:null, inicio:'—', estimado:'—', estado:'SIN_ASIGNAR', prioridad:'media' },
  ],

  /* CHECKLIST */
  checklist_items: [
    { categoria:'Documentación y Seguridad', items:['Licencia de conducir vigente','Padrón del vehículo','Permiso de circulación','Seguro SOAP vigente','Cinturones de seguridad (todos)','Extintores cargados y sellados'] },
    { categoria:'Motor y Mecánica', items:['Nivel de aceite motor','Nivel de agua radiador','Nivel de frenos','Presión neumáticos (todos)','Freno de mano operativo','Dirección sin juego excesivo'] },
    { categoria:'Luces y Eléctrico', items:['Luces delanteras altas/bajas','Luces traseras / stop','Luces de emergencia','Panel de instrumentos operativo','Bocina','Limpiaparabrisas'] },
    { categoria:'Interior del Bus', items:['Asientos sin daños','Salidas de emergencia sin obstrucción','Pasillos libres','Aire acondicionado operativo','Sistema multimedia','Boleterías y validadores'] },
    { categoria:'Carrocería y Exterior', items:['Sin daños en carrocería','Espejos laterales en posición','Maleteros se cierran correctamente','Neumático de repuesto'] },
  ],

  /* AUDITORÍA */
  auditoria: [
    { id:8, hora:'09:15', accion:'ASIGNACION_BUS',       entidad:'POS-005 · BUS 110',    detalle:'BUS sin asignar → BUS 110 · HTYK-18',           tipo:'ok',     usuario:'F. Rojas' },
    { id:7, hora:'08:50', accion:'CORRIDA_CREADA',        entidad:'Corrida #1',             detalle:'BUS 104 reemplazado por BUS 101 en POS-003',      tipo:'warn',   usuario:'J. Operaciones' },
    { id:6, hora:'08:30', accion:'POSTURA_BLOQUEADA',     entidad:'POS-004',                detalle:'Postura sin bus asignado — estado cambiado a PROBLEMA', tipo:'danger', usuario:'Sistema' },
    { id:5, hora:'07:45', accion:'INCIDENTE_REGISTRADO',  entidad:'INC-847 · BUS 106',     detalle:'Ruido en suspensión delantera — Gravedad media',  tipo:'warn',   usuario:'C. Fuentes' },
    { id:4, hora:'07:00', accion:'CHECKLIST_COMPLETADO',  entidad:'BUS 103 · POS-007',     detalle:'24 ítems OK · 0 fallas · Enviado a Mantenimiento', tipo:'ok',     usuario:'M. Soto' },
    { id:3, hora:'06:20', accion:'TRIPULACION_ASIGNADA',  entidad:'POS-001 · C. Fuentes',  detalle:'Carlos Fuentes asignado como Conductor Titular',  tipo:'ok',     usuario:'Op. Martínez' },
    { id:2, hora:'05:50', accion:'BUS_LIBERADO',          entidad:'BUS 103',                detalle:'Bus liberado de Mantenimiento — Estado: DISPONIBLE',tipo:'ok',     usuario:'J. Mecánicos' },
    { id:1, hora:'05:46', accion:'ASIGNACION_RECHAZADA',  entidad:'POS-003 · P. Núñez',    detalle:'Conductor rechazado — solapamiento con POS-001',  tipo:'danger', usuario:'Sistema' },
  ],
};

/* ── CONSTANTES ─────────────────────────────────────────────── */
const ESTADO_BUS = {
  DISPONIBLE:     { label:'Disponible',     cls:'ok',      icon:'🟢' },
  ASIGNADO:       { label:'Asignado',       cls:'info',    icon:'🔵' },
  EN_SERVICIO:    { label:'En servicio',    cls:'info',    icon:'🚌' },
  MANTENIMIENTO:  { label:'Mantenimiento',  cls:'warn',    icon:'🔧' },
  FUERA_SERVICIO: { label:'Fuera servicio', cls:'danger',  icon:'⛔' },
};

const ESTADO_POSTURA = {
  COMPLETA: { label:'Completa', cls:'ok',     dot:'ok'    },
  ALERTA:   { label:'Alerta',   cls:'warn',   dot:'warn'  },
  PROBLEMA: { label:'Problema', cls:'danger', dot:'danger'},
  LISTA:    { label:'Lista',    cls:'ok',     dot:'ok'    },
  CORRIDA:  { label:'Corrida',  cls:'warn',   dot:'warn'  },
};

const ESTADO_ORDEN = {
  SIN_ASIGNAR: { label:'Sin asignar', cls:'danger' },
  PENDIENTE:   { label:'Pendiente',   cls:'warn'   },
  EN_PROCESO:  { label:'En proceso',  cls:'info'   },
  COMPLETADO:  { label:'Completado',  cls:'ok'     },
};

const SERVICIO_LABEL = {
  SC:  'Semi Cama',
  SLC: 'Salón Cama',
  CP:  'Cama Premium',
  MIN: 'Minero ⛏️',
};

const CREW_COLORS = ['#1D4ED8','#6D28D9','#047857','#B45309','#BE185D','#0369A1','#7C3AED','#065F46','#92400E'];

/* ── HELPERS ────────────────────────────────────────────────── */
function getBus(id) { return DATA.buses.find(b => b.id === id); }
function getPersona(id) { return DATA.personas.find(p => p.id === id); }
function getInitials(name) { return name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase(); }
function getColor(i) { return CREW_COLORS[i % CREW_COLORS.length]; }

function badgeHtml(tipo, label) {
  return `<span class="badge ${tipo}">${label}</span>`;
}

function crewAvatarsHtml(ids) {
  const visible = ids.slice(0, 3);
  const extra = ids.length - 3;
  let html = '<div class="crew-avatars">';
  visible.forEach(id => {
    const p = getPersona(id);
    const name = p ? p.nombre : '?';
    const color = getColor(id);
    html += `<div class="crew-avatar" style="background:${color}" title="${name}">${getInitials(name)}</div>`;
  });
  if (extra > 0) html += `<div class="crew-more">+${extra}</div>`;
  html += '</div>';
  return html;
}

function renderBadgePostura(estado) {
  const e = ESTADO_POSTURA[estado] || ESTADO_POSTURA.ALERTA;
  return `<span class="badge ${e.cls}"><span class="badge-dot ${e.dot}"></span>${e.label}</span>`;
}

/* ── SIDEBAR RENDER ─────────────────────────────────────────── */
function renderSidebar(activePage) {
  const navItems = [
    { id:'dashboard',    href:'index.html',        icon:'⊞',  label:'Dashboard' },
    { id:'postura',      href:'postura.html',       icon:'📋', label:'Posturas', badge:null },
    { id:'planificacion',href:'planificacion.html', icon:'📅', label:'Planificación' },
    { id:'conductor',    href:'conductor.html',     icon:'👥', label:'Tripulación' },
    { id:'corrida',      href:'corrida.html',       icon:'🔄', label:'Corridas',    badgeCls:'danger', badgeVal:'1' },
    { id:'flota',        href:'flota.html',         icon:'🚌', label:'Flota',       badgeCls:'warn',   badgeVal:'2' },
    { id:'mantenimiento',href:'mantenimiento.html', icon:'🔧', label:'Mantenimiento' },
    { id:'incidente',    href:'incidente.html',     icon:'⚠️', label:'Incidencias' },
    { id:'checklist',    href:'checklist.html',     icon:'☑️', label:'Checklists' },
    { id:'auditoria',    href:'auditoria.html',     icon:'🔍', label:'Auditoría' },
  ];

  const nav = navItems.map(item => {
    const isActive = item.id === activePage;
    const badge = item.badgeVal
      ? `<span class="nav-badge ${item.badgeCls}">${item.badgeVal}</span>` : '';
    return `<a href="${item.href}" class="nav-item ${isActive?'active':''}">
      <span class="nav-icon">${item.icon}</span>
      <span>${item.label}</span>
      ${badge}
    </a>`;
  }).join('');

  return `
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="logo-mark">P+</div>
      <div>
        <div class="logo-name">PlussChile</div>
        <div class="logo-sub">Sistema Operacional</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-group-label">Operaciones</div>
      ${nav}
    </nav>
    <div class="sidebar-user">
      <div class="user-avatar">
        FO
        <div class="user-online"></div>
      </div>
      <div>
        <div class="user-name">Felipe Operaciones</div>
        <div class="user-role">Jefe de Operaciones</div>
      </div>
    </div>
  </aside>`;
}

/* ── TOPBAR RENDER ──────────────────────────────────────────── */
function renderTopbar(title, sub) {
  const now = new Date();
  const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const dateStr = `${dayNames[now.getDay()]}, ${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  return `
  <header class="topbar">
    <div>
      <span class="topbar-page-title">${title}</span>
      ${sub ? `<span class="topbar-page-sub">— ${sub}</span>` : ''}
    </div>
    <div class="topbar-right">
      <div class="live-indicator"><div class="live-dot"></div>En vivo</div>
      <div class="date-chip">📅 ${dateStr}</div>
      <button class="btn-icon-top" title="Notificaciones">
        🔔
        <div class="notif-badge">3</div>
      </button>
      <button class="btn-icon-top" title="Ajustes">⚙️</button>
    </div>
  </header>`;
}

/* ── SEMÁFORO TEXT ──────────────────────────────────────────── */
function semaforo(tipo, label) {
  const labels = { verde:'Disponible', amarillo:'Con advertencia', rojo:'No disponible' };
  const lbl = label || labels[tipo] || tipo;
  return `<span class="semaforo ${tipo}"><span class="s-dot"></span>${lbl}</span>`;
}

/* ── TOAST ──────────────────────────────────────────────────── */
function showToast(msg, tipo) {
  const colors = { ok:'var(--ok)', warn:'var(--warn)', danger:'var(--danger)', gold:'var(--gold)' };
  const borders = { ok:'var(--ok-border)', warn:'var(--warn-border)', danger:'var(--danger-border)', gold:'var(--gold-border)' };
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;top:72px;right:24px;z-index:9999;background:#fff;border:1px solid ${borders[tipo]||'var(--border)'};border-left:3px solid ${colors[tipo]||'var(--gold)'};border-radius:6px;padding:12px 18px;font-size:13px;font-weight:600;color:${colors[tipo]||'var(--text-primary)'};box-shadow:0 4px 12px rgba(0,0,0,0.12);animation:fadeIn 0.2s both;max-width:340px;font-family:var(--font)`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
