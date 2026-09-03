"""
Historia operacional de muestra.

ESTO NO ES DATO REAL. Son treinta días de operación inventada para que
el Dashboard y la pantalla de Auditoría tengan algo que mostrar durante
la demo. Los números que aparezcan en esas pantallas salen de aquí, no
de PlussChile. Cuando entren los datos de verdad, este script se borra.

Lo que sí es real es el camino: nada se escribe a mano en las tablas de
resultado. Los checklists se cierran con `ChecklistService.completar`,
así que los incidentes que aparecen son exactamente los que el sistema
habría generado; las órdenes pasan por `TallerService` una a una y las
corridas por `CorridaService`. Si alguna regla de negocio cambia y este
script se cae, es una señal correcta, no un estorbo.

Uso:
    python seed_operacion.py            # agrega historia si no hay
    python seed_operacion.py --reset    # borra la generada y la rehace
"""
import os
import random
import sys
from datetime import datetime, time, timedelta

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sgo_project.settings')
django.setup()

from django.db.models import Q  # noqa: E402
from django.utils import timezone  # noqa: E402

from flota.models import Bus  # noqa: E402
from mantencion.models import (  # noqa: E402
    Checklist, Incidente, ItemChecklist, OrdenTrabajo, RespuestaChecklist,
)
from mantencion.services import (  # noqa: E402
    ChecklistService, IncidenteService, TallerService,
)
from operaciones.models import (  # noqa: E402
    AsignacionTripulacion, Corrida, Persona, Postura, Ruta,
)
from operaciones.services import CorridaService, PlanificacionService  # noqa: E402


DIAS = 30
POSTURAS_POR_DIA = (3, 4)          # la dotación disponible no da para más
CODIGO_INICIAL = 113001            # bloque propio, no pisa el 1122xx del otro seed
SEMILLA = 20260902                 # la demo se ve igual cada vez que se rehace

# Probabilidades por servicio. Calibradas para que la muestra tenga
# variedad sin volverse una flota que se cae a pedazos.
P_CHECKLIST = 0.85
P_FALLA_EN_CHECKLIST = 0.22
P_INCIDENTE_EN_RUTA = 0.06
DIAS_SIN_CERRAR = 10         # antes de eso el taller ya resolvió todo
P_CHECKLIST_LLEGADA = 0.45   # de los que salieron, cuantos se reciben en terminal
P_FALLA_EN_LLEGADA = 0.12
P_FALLA_CRITICA = 0.25       # de las fallas, cuántas son de un ítem crítico

OBSERVACIONES = [
    'Se nota juego al accionar.',
    'Ruido intermitente al frenar en bajada.',
    'Falta presión, no alcanza el nivel.',
    'Testigo encendido desde la salida anterior.',
    'Sello vencido, hay que reponer.',
    'Vibración en la primera hora de ruta.',
    'No enciende en el segundo intento.',
]

REPORTES_EN_RUTA = [
    ('Pérdida de potencia subiendo la cuesta', 'MEDIA'),
    ('Calefacción sin funcionar, pasajeros reclamando', 'BAJA'),
    ('Golpeteo fuerte en el eje trasero', 'ALTA'),
    ('Puerta de servicio no cierra del todo', 'MEDIA'),
    ('Temperatura del motor por sobre lo normal', 'ALTA'),
]

DIAGNOSTICOS = [
    'Se reemplazó la pieza y se probó en ruta corta.',
    'Ajuste y reapriete. Sin observaciones al cierre.',
    'Cambio de sello y purga del circuito.',
    'Se limpió el contacto y se reemplazó el fusible.',
    'Rectificado y balanceo. Queda operativo.',
]

# A qué especialidad del taller manda cada categoría del checklist.
# Las claves son los nombres que carga seed_checklist.py: si no calzan,
# todo termina en GENERAL y el indicador por especialidad no dice nada.
ESPECIALIDAD_POR_CATEGORIA = {
    'Motor y Mecánica': 'MOTOR',
    'Luces y Eléctrico': 'ELECTRICO',
    'Interior del Bus': 'CARROCERIA',
    'Carrocería y Exterior': 'CARROCERIA',
    'Documentación y Seguridad': 'GENERAL',
}


# ══════════════════════════════════════════════════════════════
#  LIMPIEZA
# ══════════════════════════════════════════════════════════════
def hay_historia():
    return (Checklist.objects.exists() or Incidente.objects.exists()
            or OrdenTrabajo.objects.exists() or Corrida.objects.exists()
            or Postura.objects.filter(codigo__startswith='113').exists())


def reset():
    """Borra solo lo que este script genera.

    Nunca toca buses, personas, rutas, ciudades ni la plantilla del
    checklist: eso lo cargan los otros seeds y perderlo obliga a
    rehacer todo. Las posturas que se eliminan son únicamente las del
    bloque 113xxx.
    """
    for modelo in (RespuestaChecklist, OrdenTrabajo, Checklist, Incidente):
        n = modelo.objects.all().delete()[0]
        print(f'  - {modelo.__name__}: {n} borrados')

    n_corridas = Corrida.objects.all().delete()[0]
    print(f'  - Corrida: {n_corridas} borradas')

    generadas = Postura.objects.filter(codigo__startswith='113')

    # Las asignaciones que borra son las de las posturas generadas y las
    # de la jornada de hoy, que este script tambien cubre. La nomina en
    # si no se toca: borrar personas romperia lo que las referencia.
    n_asig = AsignacionTripulacion.objects.filter(
        Q(postura__in=generadas) | Q(postura__fecha__gte=timezone.localdate())
    ).delete()[0]
    print(f'  - AsignacionTripulacion: {n_asig} borradas')
    print(f'  - Postura 113xxx: {generadas.delete()[0]} borradas')


# ══════════════════════════════════════════════════════════════
#  GENERACIÓN
# ══════════════════════════════════════════════════════════════
def retrasar(modelo, pks, momento, campos=('creado_en',)):
    """Mueve al pasado las marcas de tiempo de `auto_now_add`.

    `create()` siempre estampa `timezone.now()`. La única forma de
    fechar un registro en el pasado es reescribirlo después con
    `update()`, que no dispara `auto_now_add` ni `auto_now`.
    """
    modelo.objects.filter(pk__in=pks).update(**{c: momento for c in campos})


def instante(dia, hora, minuto=0):
    return timezone.make_aware(
        datetime.combine(dia, time(hora, minuto)),
        timezone.get_current_timezone(),
    )


NOMBRES = [
    'Álvaro', 'Bastián', 'Camilo', 'Cristian', 'Daniel', 'Eduardo',
    'Felipe', 'Gonzalo', 'Héctor', 'Ignacio', 'Jaime', 'Luis',
    'Manuel', 'Marcelo', 'Nelson', 'Óscar', 'Patricio', 'Rodrigo',
    'Sebastián', 'Tomás', 'Víctor', 'Claudia', 'Daniela', 'Fernanda',
    'Javiera', 'Karen', 'Marcela', 'Natalia', 'Paulina', 'Rocío',
]
APELLIDOS = [
    'Aguilera', 'Bravo', 'Cáceres', 'Donoso', 'Escobar', 'Fuentes',
    'Gálvez', 'Herrera', 'Ibáñez', 'Jara', 'Lagos', 'Muñoz',
    'Navarro', 'Órdenes', 'Peña', 'Quiroz', 'Rivas', 'Sepúlveda',
    'Tapia', 'Urrutia', 'Valdés', 'Zúñiga',
]

# Cuánta gente hace falta para que la programación del día se pueda
# cubrir. Las once salidas de la mañana se solapan entre sí, y como
# nadie puede ir en dos servicios a la vez, la nómina tiene que dar
# para todas a la vez. Con doce personas —lo que dejaba el seed de
# tripulación— la mitad de los servicios quedaba sin dotación, y el
# tablero mostraba una operación quebrada que no es la de PlussChile.
CONDUCTORES_MINIMO = 30
ASISTENTES_MINIMO = 15


def _postura_base_hoy(hoy):
    return (Postura.objects
            .filter(fecha=hoy)
            .select_related('ruta')
            .prefetch_related('tripulacion'))


def asegurar_nomina(rng):
    """Completa la nómina hasta el mínimo, sin tocar a los que ya están.

    Los RUT se generan en un rango alto y propio para no chocar con los
    del personal ya cargado ni con uno real.
    """
    creadas = 0
    for rol, minimo in ((Persona.Rol.CONDUCTOR, CONDUCTORES_MINIMO),
                        (Persona.Rol.ASISTENTE, ASISTENTES_MINIMO)):
        faltan = minimo - Persona.objects.filter(rol=rol).count()
        for _ in range(max(0, faltan)):
            serie = 20_000_000 + creadas + (0 if rol == Persona.Rol.CONDUCTOR else 500)
            rut = f'{serie // 1000000}.{serie // 1000 % 1000:03d}.{serie % 1000:03d}-K'
            if Persona.objects.filter(rut=rut).exists():
                continue
            Persona.objects.create(
                rut=rut,
                nombre=f'{rng.choice(NOMBRES)} {rng.choice(APELLIDOS)} '
                       f'{rng.choice(APELLIDOS)}',
                rol=rol,
                tipo=rng.choice([Persona.Tipo.TITULAR, Persona.Tipo.RELEVO]),
            )
            creadas += 1
    return creadas


def crear_posturas(rng, dias):
    """Programación pasada: pocas salidas por día, para que la dotación
    existente alcance a cubrirlas sin pisarse."""
    rutas = list(Ruta.objects.select_related('origen', 'destino'))
    buses = list(Bus.objects.all())
    codigo = CODIGO_INICIAL
    creadas = []

    for dia in dias:
        cuantas = rng.randint(*POSTURAS_POR_DIA)
        horas = rng.sample([6, 7, 8, 9, 10, 22, 23], cuantas)
        buses_del_dia = rng.sample(buses, cuantas)

        for hora, bus in zip(sorted(horas), buses_del_dia):
            postura = Postura.objects.create(
                codigo=str(codigo),
                ruta=rng.choice(rutas),
                fecha=dia,
                hora_salida=time(hora, rng.choice([0, 30])),
                bus=bus,
                estado=Postura.Estado.COMPLETA,
            )
            creadas.append(postura)
            codigo += 1

    return creadas


def asignar_dotacion(rng, posturas):
    """Dos conductores y un asistente por servicio, vía el servicio real.

    Se reparte por día: como nadie repite jornada, el control de
    solapamiento nunca se opone. Si igual rechaza a alguien, se prueba
    con el siguiente en vez de forzar la escritura.
    """
    conductores = list(Persona.objects.filter(rol=Persona.Rol.CONDUCTOR))
    asistentes = list(Persona.objects.filter(rol=Persona.Rol.ASISTENTE))
    asignadas = 0

    por_dia = {}
    for p in posturas:
        por_dia.setdefault(p.fecha, []).append(p)

    for _, del_dia in por_dia.items():
        pool_c = conductores[:]
        pool_a = asistentes[:]
        rng.shuffle(pool_c)
        rng.shuffle(pool_a)

        for postura in del_dia:
            faltan = postura.faltantes()
            for rol, pool in ((Persona.Rol.CONDUCTOR, pool_c),
                              (Persona.Rol.ASISTENTE, pool_a)):
                puestos = 0
                while puestos < faltan.get(rol, 0) and pool:
                    persona = pool.pop()
                    try:
                        PlanificacionService.asignar_tripulacion(
                            postura.id, persona.id, rol)
                    except ValueError:
                        continue
                    puestos += 1
                    asignadas += 1

    return asignadas


def hacer_checklists(rng, posturas, items):
    """Un checklist de salida por servicio, respondido ítem por ítem y
    cerrado por el servicio, que es quien decide los incidentes."""
    hechos, incidentes = 0, 0

    for postura in posturas:
        if rng.random() > P_CHECKLIST:
            continue

        tripulantes = list(postura.tripulacion.all())
        if not tripulantes:
            continue

        checklist = ChecklistService.iniciar(
            bus_id=postura.bus_id,
            persona_id=rng.choice(tripulantes).persona_id,
            momento=Checklist.Momento.SALIDA,
            postura_id=postura.id,
        )

        # ¿Este bus salió con algo malo? Se decide una vez por checklist
        # y no ítem por ítem: si no, casi todos tendrían alguna falla.
        con_falla = rng.random() < P_FALLA_EN_CHECKLIST
        fallando = set()
        if con_falla:
            # Lo que suele aparecer es un desgaste menor. Las fallas de
            # freno o extintor existen, pero no en uno de cada dos buses.
            criticos = rng.random() < P_FALLA_CRITICA
            candidatos = [i for i in items if i.critico == criticos] or items
            cuantos = min(rng.randint(1, 2), len(candidatos))
            fallando = {i.id for i in rng.sample(candidatos, cuantos)}

        for item in items:
            if item.id in fallando:
                ChecklistService.responder(
                    checklist.id, item.id, RespuestaChecklist.Estado.FALLA,
                    rng.choice(OBSERVACIONES))
            else:
                ChecklistService.responder(
                    checklist.id, item.id, RespuestaChecklist.Estado.OK)

        _, nuevos = ChecklistService.completar(checklist.id)

        # El checklist se hace antes de salir; el registro tiene que
        # quedar a esa hora y no a la de ejecución del script.
        antes = instante(postura.fecha,
                         max(0, postura.hora_salida.hour - 1),
                         rng.choice([0, 15, 30, 45]))
        retrasar(Checklist, [checklist.id], antes)
        retrasar(Checklist, [checklist.id], antes + timedelta(minutes=18),
                 campos=('completado_en',))
        retrasar(Incidente, [i.id for i in nuevos], antes)

        hechos += 1
        incidentes += len(nuevos)

        # Recepcion en el terminal al volver (README 2.3). Se revisa lo
        # mismo, pero encontrar algo aqui es mas raro: el bus acaba de
        # hacer el viaje completo sin novedad.
        if rng.random() < P_CHECKLIST_LLEGADA:
            hechos += 1
            incidentes += len(_checklist_llegada(rng, postura, items))

    return hechos, incidentes


def _checklist_llegada(rng, postura, items):
    checklist = ChecklistService.iniciar(
        bus_id=postura.bus_id,
        persona_id=rng.choice(list(postura.tripulacion.all())).persona_id,
        momento=Checklist.Momento.LLEGADA,
        postura_id=postura.id,
    )

    fallando = set()
    if rng.random() < P_FALLA_EN_LLEGADA:
        candidatos = [i for i in items if not i.critico] or items
        fallando = {rng.choice(candidatos).id}

    for item in items:
        if item.id in fallando:
            ChecklistService.responder(
                checklist.id, item.id, RespuestaChecklist.Estado.FALLA,
                rng.choice(OBSERVACIONES))
        else:
            ChecklistService.responder(
                checklist.id, item.id, RespuestaChecklist.Estado.OK)

    _, nuevos = ChecklistService.completar(checklist.id)

    # Llega tras el viaje: la duracion de la ruta define a que hora.
    horas = int(float(postura.ruta.duracion_estimada or 6))
    llegada = instante(postura.fecha, postura.hora_salida.hour, 0)         + timedelta(hours=horas)
    retrasar(Checklist, [checklist.id], llegada)
    retrasar(Checklist, [checklist.id], llegada + timedelta(minutes=25),
             campos=('completado_en',))
    retrasar(Incidente, [i.id for i in nuevos], llegada)

    return nuevos


def reportes_en_ruta(rng, posturas):
    """Fallas que aparecen con el bus andando, sin checklist de por medio."""
    creados = []

    for postura in posturas:
        if rng.random() > P_INCIDENTE_EN_RUTA:
            continue

        tripulantes = list(postura.tripulacion.all())
        if not tripulantes:
            continue

        descripcion, gravedad = rng.choice(REPORTES_EN_RUTA)
        incidente = IncidenteService.reportar_en_ruta(
            bus_id=postura.bus_id,
            persona_id=rng.choice(tripulantes).persona_id,
            descripcion=descripcion,
            gravedad=gravedad,
            postura_id=postura.id,
        )
        retrasar(Incidente, [incidente.id],
                 instante(postura.fecha, postura.hora_salida.hour,
                          rng.choice([10, 25, 40])))
        creados.append(incidente)

    return creados


def trabajar_en_taller(rng, hoy):
    """Recorre la bandeja y la hace avanzar como lo haría el jefe.

    Los incidentes más antiguos se resuelven; los de los últimos días
    quedan a medio camino, que es como se ve un taller de verdad
    cualquier mañana.
    """
    mecanicos = list(Persona.objects.filter(rol=Persona.Rol.MECANICO))
    if not mecanicos:
        print('  ! sin mecánicos: se omiten las órdenes de trabajo')
        return 0, 0

    abiertos = list(
        Incidente.objects
        .filter(estado=Incidente.Estado.ABIERTO)
        .select_related('bus', 'item', 'item__categoria')
        .order_by('creado_en')
    )

    creadas = completadas = 0

    for incidente in abiertos:
        dias_atras = (hoy - timezone.localtime(incidente.creado_en).date()).days

        # Lo de los últimos tres días todavía no se ha triado.
        if dias_atras < 3 and rng.random() < 0.7:
            continue

        categoria = incidente.item.categoria.nombre if incidente.item else None
        orden = TallerService.crear_desde_incidente(
            incidente_id=incidente.id,
            especialidad=ESPECIALIDAD_POR_CATEGORIA.get(categoria, 'GENERAL'),
        )
        creadas += 1

        abierta = instante(timezone.localtime(incidente.creado_en).date(), 9)
        retrasar(OrdenTrabajo, [orden.id], abierta)

        # Una parte se queda sin asignar: es la cola real del taller.
        # Solo entre lo reciente: una falla grave de hace un mes sin
        # tocar no es una cola, es un dato que nadie se creería.
        if dias_atras < DIAS_SIN_CERRAR and rng.random() < 0.25:
            continue

        TallerService.asignar(orden.id, rng.choice(mecanicos).id,
                              pozo=f'POZO {rng.randint(1, 4)}')
        if dias_atras < DIAS_SIN_CERRAR and rng.random() < 0.3:
            continue

        TallerService.iniciar(orden.id)
        if dias_atras < DIAS_SIN_CERRAR and rng.random() < 0.5:
            retrasar(OrdenTrabajo, [orden.id], abierta + timedelta(hours=2),
                     campos=('iniciado_en',))
            continue

        TallerService.completar(orden.id, rng.choice(DIAGNOSTICOS))
        retrasar(
            OrdenTrabajo, [orden.id], abierta + timedelta(hours=2),
            campos=('iniciado_en',))
        retrasar(
            OrdenTrabajo, [orden.id],
            abierta + timedelta(hours=rng.choice([5, 8, 12, 26, 30])),
            campos=('completado_en',))
        completadas += 1

    return creadas, completadas


def registrar_corridas(rng, posturas, hoy):
    """Dos o tres reemplazos de máquina, que es el dolor que el README
    pone primero y el que la pantalla de auditoría tiene que poder medir."""
    jefe = Persona.objects.filter(rol=Persona.Rol.JEFE_OPERACIONES).first()
    if not jefe:
        print('  ! sin jefe de operaciones: se omiten las corridas')
        return 0

    candidatas = [p for p in posturas
                  if p.bus_id and (hoy - p.fecha).days in range(1, 25)]
    if not candidatas:
        return 0

    # La primera se toma del servicio más reciente y queda abierta, para
    # que el tablero de hoy tenga el caso vivo que el módulo existe para
    # resolver. Las demás salen de cualquier día y se cierran.
    reciente = max(candidatas, key=lambda p: p.fecha)
    resto = [p for p in candidatas if p is not reciente]
    rng.shuffle(resto)
    candidatas = [reciente] + resto

    motivos = [
        'Falla de motor detectada en el pozo antes de la salida.',
        'Neumático reventado en el terminal, sin repuesto montado.',
        'Sistema de frenos con fuga, el bus no puede salir.',
    ]

    hechas = 0
    for postura in candidatas:
        if hechas >= 3:
            break

        libres = list(
            Bus.objects
            .filter(estado=Bus.Estado.DISPONIBLE)
            .exclude(id=postura.bus_id)
        )
        if not libres:
            break

        # No sirve cualquier bus libre: el servicio rechaza al que ya
        # cubre otra postura solapada. Se prueban todos antes de dar por
        # perdida la corrida, si no se descarta un caso por mala suerte.
        corrida = None
        for sustituto in rng.sample(libres, len(libres)):
            try:
                corrida = CorridaService.crear(
                    bus_original_id=postura.bus_id,
                    motivo=motivos[hechas % len(motivos)],
                    persona=jefe,
                    postura_ids=[postura.id],
                    bus_sustituto_id=sustituto.id,
                )
                break
            except ValueError:
                continue

        if corrida is None:
            continue

        abierta = instante(postura.fecha, max(0, postura.hora_salida.hour - 2))
        retrasar(Corrida, [corrida.id], abierta)

        # Una corrida de hace tres semanas ya se resolvió. Dejar todas
        # abiertas pondría en el tablero de hoy avisos de agosto.
        if (hoy - postura.fecha).days > 1:
            CorridaService.cerrar(corrida.id)
            retrasar(Corrida, [corrida.id], abierta + timedelta(hours=6),
                     campos=('cerrado_en',))

        hechas += 1

    return hechas


def normalizar_flota():
    """Deja la flota en un estado coherente con lo que hay hoy.

    Treinta días de fallas simuladas dejarían casi todos los buses
    fuera de servicio. En la realidad se reparan y vuelven; aquí se
    reponen salvo los que tienen trabajo abierto de verdad.
    """
    con_trabajo = set(
        OrdenTrabajo.objects
        .exclude(estado=OrdenTrabajo.Estado.COMPLETADO)
        .values_list('bus_id', flat=True)
    )

    hoy = timezone.localdate()
    en_ruta = set(
        Postura.objects
        .filter(fecha=hoy, estado=Postura.Estado.EN_CURSO, bus__isnull=False)
        .values_list('bus_id', flat=True)
    )

    for bus in Bus.objects.all():
        if bus.id in con_trabajo:
            grave = OrdenTrabajo.objects.filter(
                bus=bus, prioridad=OrdenTrabajo.Prioridad.ALTA
            ).exclude(estado=OrdenTrabajo.Estado.COMPLETADO).exists()
            bus.estado = (Bus.Estado.FUERA_SERVICIO if grave
                          else Bus.Estado.MANTENIMIENTO)
        elif bus.id in en_ruta:
            bus.estado = Bus.Estado.EN_SERVICIO
        else:
            bus.estado = Bus.Estado.DISPONIBLE
        bus.save(update_fields=['estado'])


# ══════════════════════════════════════════════════════════════
#  ENTRADA
# ══════════════════════════════════════════════════════════════
def run():
    rng = random.Random(SEMILLA)
    hoy = timezone.localdate()
    dias = [hoy - timedelta(days=d) for d in range(DIAS, 0, -1)]

    items = list(ItemChecklist.objects.filter(activo=True)
                 .select_related('categoria'))
    if not items:
        print('No hay plantilla de checklist. Corre antes seed_checklist.py')
        return

    print(f'Generando {DIAS} días de operación de muestra '
          f'({dias[0]} a {dias[-1]})\n')

    print(f'  Personal agregado ... {asegurar_nomina(rng)}')

    posturas = crear_posturas(rng, dias)
    print(f'  Posturas ............ {len(posturas)}')

    # La programación de hoy la carga seed_planificacion.py y viene sin
    # tripulación. Se cubre aquí para que el tablero de inicio muestre
    # una jornada armada y no catorce avisos de servicio incompleto.
    de_hoy = list(_postura_base_hoy(hoy))
    print(f'  Asignaciones ........ {asignar_dotacion(rng, posturas + de_hoy)}')

    hechos, desde_checklist = hacer_checklists(rng, posturas, items)
    print(f'  Checklists .......... {hechos}')
    print(f'  Incidentes (revisión) {desde_checklist}')
    print(f'  Incidentes (en ruta)  {len(reportes_en_ruta(rng, posturas))}')

    creadas, completadas = trabajar_en_taller(rng, hoy)
    print(f'  Órdenes de trabajo .. {creadas} ({completadas} completadas)')

    # Antes de las corridas hay que reponer la flota: treinta días de
    # fallas simuladas dejan a casi todos los buses fuera de servicio y
    # entonces no hay sustituto posible. Después se normaliza otra vez,
    # porque la corrida mueve máquinas entre posturas.
    normalizar_flota()
    print(f'  Corridas ............ {registrar_corridas(rng, posturas, hoy)}')
    normalizar_flota()

    print('\nListo. Recuerda: son datos de muestra, no de PlussChile.')


if __name__ == '__main__':
    if '--reset' in sys.argv:
        print('Borrando la historia generada anteriormente:')
        reset()
        print()
    elif hay_historia():
        print('Ya hay historia operacional en la base.')
        print('Usa --reset para borrarla y volver a generarla.')
        sys.exit(0)

    run()
