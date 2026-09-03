"""
Indicadores del sistema.

Ninguna cifra de este módulo está escrita a mano: todas salen de
consultar la base. Cuando no hay datos, el indicador devuelve cero o
una lista vacía y la interfaz lo dice. Un número inventado en un
tablero de operaciones es peor que un espacio en blanco: el vacío se
nota, el número falso se cree.

Los promedios de duración se calculan en Python y no con `Avg` sobre
un DurationField. El volumen es pequeño —órdenes de un mes— y así el
cálculo se lee tal como es, sin depender de cómo cada motor de base
de datos resta dos fechas.
"""
from datetime import datetime, time, timedelta

from django.db.models import Count
from django.utils import timezone

from core.permissions import TALLER, TRIPULACION
from flota.models import Bus
from operaciones.models import Corrida, Persona, Postura, horas_conduccion
from mantencion.models import (
    Checklist, Incidente, OrdenTrabajo, RespuestaChecklist,
)


# ══════════════════════════════════════════════════════════════
#  UTILIDADES
# ══════════════════════════════════════════════════════════════
def _rango_dt(desde, hasta):
    """Convierte dos fechas en el intervalo de instantes que abarcan.

    `hasta` es inclusivo: el usuario que pide "hasta el 30" espera que
    entre lo ocurrido el 30 a las 23:59.
    """
    tz = timezone.get_current_timezone()
    inicio = timezone.make_aware(datetime.combine(desde, time.min), tz)
    fin = timezone.make_aware(datetime.combine(hasta, time.max), tz)
    return inicio, fin


def _conteo_por(queryset, campo):
    """{valor: cantidad} para un campo de choices, sin claves ausentes."""
    filas = queryset.values(campo).annotate(n=Count('id'))
    return {fila[campo]: fila['n'] for fila in filas}


def _horas_promedio(parejas):
    """Promedio en horas de una lista de (inicio, fin). None si no hay."""
    duraciones = [
        (fin - inicio).total_seconds() / 3600
        for inicio, fin in parejas
        if inicio and fin and fin >= inicio
    ]
    if not duraciones:
        return None
    return round(sum(duraciones) / len(duraciones), 1)


def _posturas_desde_ahora(queryset, limite=6):
    """Las próximas salidas, ordenadas, descartando las que ya partieron."""
    ahora = timezone.localtime()
    hoy = ahora.date()

    futuras = [
        p for p in queryset
        if p.fecha > hoy or (p.fecha == hoy and p.hora_salida >= ahora.time())
    ]
    futuras.sort(key=lambda p: (p.fecha, p.hora_salida))
    return futuras[:limite]


# Cómo se nombra cada rol en un mensaje al usuario. La forma plural
# no se deduce en español con una regla de una línea.
NOMBRE_ROL = {
    'CONDUCTOR': ('conductor', 'conductores'),
    'ASISTENTE': ('asistente', 'asistentes'),
}


def _postura_base():
    """Consulta de posturas con todo lo que el tablero va a leer.

    Sin el prefetch, `recursos_completos` dispara una consulta por
    postura para contar la tripulación.
    """
    return (
        Postura.objects
        .select_related('ruta__origen', 'ruta__destino', 'bus')
        .prefetch_related('tripulacion')
    )


# ══════════════════════════════════════════════════════════════
#  DASHBOARD
#  Cada perfil ve su propio tablero. El jefe de operaciones
#  necesita la flota entera; el conductor necesita saber a qué
#  hora sale él. Mostrarles lo mismo obliga a los dos a buscar.
# ══════════════════════════════════════════════════════════════
# Cuántas alertas caben en el tablero antes de que deje de leerse.
# Con catorce posturas incompletas la lista tapa la corrida activa,
# que es lo único que no puede esperar; el resto se resume en un
# contador y se revisa en su propia pantalla.
ALERTAS_VISIBLES = 6

# El color del semáforo de fatiga, traducido al del tablero.
TONO_SEMAFORO = {
    Persona.Semaforo.VERDE: 'ok',
    Persona.Semaforo.AMARILLO: 'warn',
    Persona.Semaforo.ROJO: 'danger',
}


class DashboardService:

    @staticmethod
    def para(persona):
        if persona.rol in TRIPULACION:
            return _dashboard_tripulacion(persona)
        if persona.rol in TALLER:
            return _dashboard_taller()
        return _dashboard_operaciones()


def _dashboard_operaciones():
    hoy = timezone.localdate()
    posturas_hoy = list(_postura_base().filter(fecha=hoy))

    listas = [p for p in posturas_hoy if p.recursos_completos]
    incompletas = [p for p in posturas_hoy if not p.recursos_completos]

    buses = Bus.objects.all()
    disponibles = buses.filter(estado=Bus.Estado.DISPONIBLE).count()
    en_taller = buses.filter(
        estado__in=[Bus.Estado.MANTENIMIENTO, Bus.Estado.FUERA_SERVICIO]
    ).count()

    alertas = _alertas_operaciones(incompletas)

    return {
        'perfil': 'OPERACIONES',
        'fecha': hoy,
        'kpis': [
            {'id': 'servicios', 'label': 'Servicios de hoy',
             'valor': len(posturas_hoy), 'tono': 'info'},
            {'id': 'listas', 'label': 'Con bus y tripulación',
             'valor': len(listas), 'total': len(posturas_hoy), 'tono': 'ok'},
            {'id': 'disponibles', 'label': 'Buses disponibles',
             'valor': disponibles, 'total': buses.count(), 'tono': 'ok'},
            {'id': 'taller', 'label': 'Buses en taller',
             'valor': en_taller, 'tono': 'warn'},
        ],
        'proximas': _posturas_desde_ahora(_postura_base().filter(fecha__gte=hoy)),
        'alertas': alertas[:ALERTAS_VISIBLES],
        'alertas_total': len(alertas),
    }


def _alertas_operaciones(posturas_incompletas):
    """Lo que exige una decisión hoy, ordenado por gravedad.

    Son las cuatro cosas que en el proceso manual se avisan por
    WhatsApp y a veces no llegan: una corrida en curso, una falla
    grave sin resolver, un servicio sin recursos y un conductor
    bloqueado por fatiga.
    """
    alertas = []

    for corrida in (Corrida.objects
                    .filter(estado=Corrida.Estado.ACTIVA)
                    .select_related('bus_original', 'bus_sustituto')):
        destino = (corrida.bus_sustituto.numero
                   if corrida.bus_sustituto else 'sin reemplazo aún')
        alertas.append({
            'nivel': 'danger',
            'titulo': f'Corrida activa · bus {corrida.bus_original.numero}',
            'detalle': f'{corrida.motivo} — pasa a {destino}.',
            'momento': corrida.creado_en,
            'ruta': '/corridas',
        })

    for inc in (Incidente.objects
                .filter(estado__in=[Incidente.Estado.ABIERTO,
                                    Incidente.Estado.EN_REVISION],
                        gravedad=Incidente.Gravedad.ALTA)
                .select_related('bus')):
        alertas.append({
            'nivel': 'danger',
            'titulo': f'Falla grave · bus {inc.bus.numero}',
            'detalle': inc.descripcion,
            'momento': inc.creado_en,
            'ruta': '/incidentes',
        })

    for postura in posturas_incompletas:
        faltan = []
        if postura.bus_id is None:
            faltan.append('sin bus')
        for rol, n in postura.faltantes().items():
            if n:
                singular, plural = NOMBRE_ROL[rol]
                faltan.append(f'falta {n} {singular}' if n == 1
                              else f'faltan {n} {plural}')
        alertas.append({
            'nivel': 'warn',
            'titulo': f'Postura {postura.codigo} incompleta',
            'detalle': ', '.join(faltan).capitalize() + '.',
            'momento': None,
            'referencia': f'sale {postura.hora_salida.strftime("%H:%M")}',
            'ruta': '/planificacion',
        })

    for persona in Persona.objects.filter(semaforo=Persona.Semaforo.ROJO):
        alertas.append({
            'nivel': 'warn',
            'titulo': f'{persona.nombre} no puede salir',
            'detalle': persona.razon_bloqueo or 'Bloqueado por control de fatiga.',
            'momento': None,
            'referencia': f'{persona.horas_hoy} h hoy',
            'ruta': '/conductores',
        })

    orden = {'danger': 0, 'warn': 1, 'info': 2}
    alertas.sort(key=lambda a: (orden.get(a['nivel'], 9),
                                -(a['momento'].timestamp() if a['momento'] else 0)))
    return alertas


def _dashboard_taller():
    bandeja = Incidente.objects.filter(estado=Incidente.Estado.ABIERTO)
    abiertas = OrdenTrabajo.objects.exclude(estado=OrdenTrabajo.Estado.COMPLETADO)

    inmovilizados = Bus.objects.filter(
        estado__in=[Bus.Estado.MANTENIMIENTO, Bus.Estado.FUERA_SERVICIO]
    )

    alertas = [{
        'nivel': 'danger',
        'titulo': f'{inc.codigo} · bus {inc.bus.numero}',
        'detalle': inc.descripcion,
        'momento': inc.creado_en,
        'ruta': '/mantenimiento',
    } for inc in (bandeja.filter(gravedad=Incidente.Gravedad.ALTA)
                  .select_related('bus'))]

    return {
        'perfil': 'TALLER',
        'fecha': timezone.localdate(),
        'kpis': [
            {'id': 'bandeja', 'label': 'Fallas sin triar',
             'valor': bandeja.count(), 'tono': 'danger'},
            {'id': 'abiertas', 'label': 'Órdenes abiertas',
             'valor': abiertas.count(), 'tono': 'warn'},
            {'id': 'proceso', 'label': 'En proceso',
             'valor': abiertas.filter(estado=OrdenTrabajo.Estado.EN_PROCESO).count(),
             'tono': 'info'},
            {'id': 'inmovilizados', 'label': 'Buses inmovilizados',
             'valor': inmovilizados.count(), 'tono': 'danger'},
        ],
        'ordenes': list(
            abiertas.select_related('bus', 'mecanico')
            .order_by('prioridad', 'creado_en')[:6]
        ),
        'alertas': alertas[:ALERTAS_VISIBLES],
        'alertas_total': len(alertas),
    }


def _dashboard_tripulacion(persona):
    """Lo que ve el conductor en el celular: cuándo sale y con qué bus."""
    hoy = timezone.localdate()

    asignadas = _postura_base().filter(
        tripulacion__persona=persona, fecha__gte=hoy
    ).distinct()
    proximas = _posturas_desde_ahora(asignadas, limite=3)

    pendiente = (
        Checklist.objects
        .filter(reportado_por=persona, estado=Checklist.Estado.EN_CURSO)
        .select_related('bus')
        .first()
    )

    mis_incidentes = Incidente.objects.filter(
        reportado_por=persona,
        estado__in=[Incidente.Estado.ABIERTO, Incidente.Estado.EN_REVISION],
    ).count()

    return {
        'perfil': 'TRIPULACION',
        'fecha': hoy,
        'persona': {
            'nombre': persona.nombre,
            'rol': persona.get_rol_display(),
            'horas_hoy': persona.horas_hoy,
            'semaforo': persona.semaforo,
            'razon_bloqueo': persona.razon_bloqueo,
        },
        'kpis': [
            {'id': 'asignadas', 'label': 'Servicios asignados',
             'valor': len(proximas), 'tono': 'info'},
            # Contra el tope, no suelto: "3" no dice nada; "3 de 5" le
            # dice al conductor cuánto le queda antes del relevo.
            {'id': 'horas', 'label': 'Horas al volante hoy',
             'valor': persona.horas_hoy,
             'total': f'{horas_conduccion()[0]:g} h',
             'tono': TONO_SEMAFORO[persona.semaforo]},
            {'id': 'incidentes', 'label': 'Fallas que reporté',
             'valor': mis_incidentes, 'tono': 'warn'},
        ],
        'proximas': proximas,
        'checklist_pendiente': pendiente,
    }


# ══════════════════════════════════════════════════════════════
#  AUDITORÍA
#  Los indicadores que el proceso en papel no permitía sacar:
#  qué se rompe más, qué máquina cuesta más corridas, cuánto
#  tarda el taller.
# ══════════════════════════════════════════════════════════════
DIAS_POR_DEFECTO = 30


class IndicadoresService:

    @staticmethod
    def rango_por_defecto():
        hasta = timezone.localdate()
        return hasta - timedelta(days=DIAS_POR_DEFECTO - 1), hasta

    @staticmethod
    def resumen(desde, hasta):
        inicio, fin = _rango_dt(desde, hasta)
        return {
            'periodo': {
                'desde': desde,
                'hasta': hasta,
                'dias': (hasta - desde).days + 1,
            },
            'posturas': _ind_posturas(desde, hasta),
            'checklists': _ind_checklists(inicio, fin),
            'incidentes': _ind_incidentes(inicio, fin),
            'ordenes': _ind_ordenes(inicio, fin),
            'corridas': _ind_corridas(inicio, fin),
            'flota': _ind_flota(inicio, fin),
        }


def _ind_posturas(desde, hasta):
    posturas = _postura_base().filter(fecha__range=(desde, hasta))
    lista = list(posturas)
    completas = [p for p in lista if p.recursos_completos]

    return {
        'total': len(lista),
        'con_recursos': len(completas),
        'sin_recursos': len(lista) - len(completas),
        'por_estado': _conteo_por(posturas, 'estado'),
    }


def _ind_checklists(inicio, fin):
    checklists = Checklist.objects.filter(creado_en__range=(inicio, fin))
    completados = checklists.filter(estado=Checklist.Estado.COMPLETADO)

    # Cuántos checklists detectaron al menos una falla.
    con_falla = (
        checklists
        .filter(respuestas__estado=RespuestaChecklist.Estado.FALLA)
        .distinct()
        .count()
    )

    # El indicador que el papel no daba: qué se rompe más seguido.
    ranking = (
        RespuestaChecklist.objects
        .filter(estado=RespuestaChecklist.Estado.FALLA,
                checklist__creado_en__range=(inicio, fin))
        .values('item__descripcion', 'item__categoria__nombre', 'item__critico')
        .annotate(n=Count('id'))
        .order_by('-n')[:8]
    )

    return {
        'total': checklists.count(),
        'completados': completados.count(),
        'con_falla': con_falla,
        'por_momento': _conteo_por(checklists, 'momento'),
        'fallas_frecuentes': [
            {
                'item': fila['item__descripcion'],
                'categoria': fila['item__categoria__nombre'],
                'critico': fila['item__critico'],
                'veces': fila['n'],
            }
            for fila in ranking
        ],
    }


def _ind_incidentes(inicio, fin):
    incidentes = Incidente.objects.filter(creado_en__range=(inicio, fin))
    abiertos = incidentes.filter(
        estado__in=[Incidente.Estado.ABIERTO, Incidente.Estado.EN_REVISION]
    )

    return {
        'total': incidentes.count(),
        'abiertos': abiertos.count(),
        'resueltos': incidentes.filter(estado=Incidente.Estado.RESUELTO).count(),
        'por_gravedad': _conteo_por(incidentes, 'gravedad'),
        'por_origen': _conteo_por(incidentes, 'origen'),
    }


def _ind_ordenes(inicio, fin):
    ordenes = OrdenTrabajo.objects.filter(creado_en__range=(inicio, fin))
    completadas = ordenes.filter(estado=OrdenTrabajo.Estado.COMPLETADO)

    # Desde que se abre la orden hasta que se cierra: es el tiempo que
    # el bus estuvo comprometido, no solo el rato que el mecánico
    # trabajó en él.
    horas_total = _horas_promedio(
        completadas.values_list('creado_en', 'completado_en')
    )
    # Y desde que el mecánico la toma: mide al taller, no a la espera.
    horas_trabajo = _horas_promedio(
        completadas.values_list('iniciado_en', 'completado_en')
    )

    return {
        'total': ordenes.count(),
        'completadas': completadas.count(),
        'abiertas': ordenes.exclude(estado=OrdenTrabajo.Estado.COMPLETADO).count(),
        'por_estado': _conteo_por(ordenes, 'estado'),
        'por_especialidad': _conteo_por(ordenes, 'especialidad'),
        'horas_promedio_ciclo': horas_total,
        'horas_promedio_taller': horas_trabajo,
    }


def _ind_corridas(inicio, fin):
    corridas = Corrida.objects.filter(creado_en__range=(inicio, fin))

    # Qué máquina obliga a rearmar la programación más seguido. Es la
    # pregunta que el README pone como punto de dolor y que nadie podía
    # responder mientras esto se llevaba en papel.
    ranking = (
        corridas
        .values('bus_original__numero')
        .annotate(n=Count('id'))
        .order_by('-n')[:5]
    )

    return {
        'total': corridas.count(),
        'activas': corridas.filter(estado=Corrida.Estado.ACTIVA).count(),
        'posturas_reasignadas': sum(c.posturas.count() for c in corridas),
        'buses_reincidentes': [
            {'bus': fila['bus_original__numero'], 'veces': fila['n']}
            for fila in ranking
        ],
    }


def _ind_flota(inicio, fin):
    buses = Bus.objects.all()

    ranking = (
        Incidente.objects
        .filter(creado_en__range=(inicio, fin))
        .values('bus__numero')
        .annotate(n=Count('id'))
        .order_by('-n')[:5]
    )

    return {
        # Foto de ahora, no del período: el estado de un bus no tiene
        # historial que consultar.
        'total': buses.count(),
        'por_estado': _conteo_por(buses, 'estado'),
        'buses_con_mas_fallas': [
            {'bus': fila['bus__numero'], 'incidentes': fila['n']}
            for fila in ranking
        ],
    }

