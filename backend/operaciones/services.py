from datetime import datetime, timedelta

from django.db import transaction
from django.utils import timezone

from .repositories import PersonaRepository
from .models import (
    Ciudad, Corrida, MovimientoCorrida, Parametros, Persona, Postura,
    AsignacionTripulacion,
    dotacion_requerida,
)

class TripulacionService:
    @staticmethod
    def get_todas_personas():
        return PersonaRepository.get_todas_personas()

    @staticmethod
    def get_conductores():
        return PersonaRepository.get_conductores()


def _ventana(postura):
    """Rango horario que ocupa una postura: salida + duración de la ruta."""
    inicio = datetime.combine(postura.fecha, postura.hora_salida)
    horas = float(postura.ruta.duracion_estimada or 0)
    return inicio, inicio + timedelta(hours=horas)


def _duracion_maxima():
    """Horas de la ruta más larga del catálogo."""
    from django.db.models import Max
    from .models import Ruta

    mayor = Ruta.objects.aggregate(Max('duracion_estimada'))['duracion_estimada__max']
    return float(mayor or 0)


def _fechas_candidatas(postura):
    """Rango de fechas donde puede haber un servicio que se pise con este.

    Mirar solo el mismo día no alcanza. El viaje a Arica dura treinta y
    dos horas: sale un martes y llega el miércoles por la tarde, así que
    quien va en él tampoco está libre el miércoles, y el bus tampoco. Y
    al revés: un servicio que salió anteayer puede seguir en ruta hoy.

    El margen hacia atrás es la ruta más larga del catálogo, que es lo
    máximo que puede llevar andando algo que salió antes.
    """
    inicio, fin = _ventana(postura)
    margen = timedelta(hours=_duracion_maxima())
    return (inicio - margen).date(), fin.date()


def _se_solapan(a, b):
    """¿Dos posturas ocupan el mismo tramo de tiempo?

    Se compara por solapamiento y no por fecha: un bus o un conductor
    hacen varios servicios en la jornada (ida y vuelta el mismo día es
    lo habitual). Bloquear todo el día impediría programación legítima.
    """
    ini_a, fin_a = _ventana(a)
    ini_b, fin_b = _ventana(b)
    return ini_a < fin_b and ini_b < fin_a


class PlanificacionService:
    @staticmethod
    def get_todas_posturas():
        from .repositories import PosturaRepository
        return PosturaRepository.get_todas_posturas()

    @staticmethod
    def get_todas_rutas():
        from .repositories import RutaRepository
        return RutaRepository.get_todas_rutas()

    @staticmethod
    def create_postura(data: dict):
        from .repositories import PosturaRepository
        # Lógica de validación podría ir aquí (ej. verificar si el bus ya tiene viaje en esa fecha)
        return PosturaRepository.create_postura(data)

    @staticmethod
    def get_postura(postura_id: int):
        from .repositories import PosturaRepository
        postura = PosturaRepository.get_postura_by_id(postura_id)
        if not postura:
            raise ValueError("Postura no encontrada")
        return postura

    @staticmethod
    def update_postura(postura_id: int, data: dict):
        from .repositories import PosturaRepository
        postura = PlanificacionService.get_postura(postura_id)
        return PosturaRepository.update_postura(postura, data)

    @staticmethod
    def delete_postura(postura_id: int):
        from .repositories import PosturaRepository
        postura = PosturaRepository.get_postura_by_id(postura_id)
        if not postura:
            raise ValueError("Postura no encontrada")
        PosturaRepository.delete_postura(postura)

    @staticmethod
    def asignar_tripulacion(postura_id: int, persona_id: int, rol: str):
        from .repositories import PosturaRepository
        from .repositories import PersonaRepository
        from .models import Persona

        postura = PosturaRepository.get_postura_by_id(postura_id)
        persona = PersonaRepository.get_persona_by_id(persona_id)

        if not postura or not persona:
            raise ValueError("Postura o Persona no encontrada")

        # Solo tripulación viaja: un mecánico o el jefe de operaciones no
        # forman parte de la dotación de un servicio.
        if persona.rol not in (Persona.Rol.CONDUCTOR, Persona.Rol.ASISTENTE):
            raise ValueError(
                f"{persona.nombre} es {persona.get_rol_display()} y no puede ir como tripulación."
            )

        # El rol se valida antes de usarlo: si el cliente no lo manda,
        # `rol.lower()` explotaba con un 500 en vez de decir qué falta.
        if rol not in Persona.Rol.values:
            raise ValueError(
                'Indica con qué puesto viaja: conductor o asistente.'
            )

        # El puesto en el viaje tiene que corresponder al cargo: la
        # dotación son dos conductores y un asistente, no tres personas
        # intercambiables. Un asistente no va al volante.
        if persona.rol != rol:
            raise ValueError(
                f"{persona.nombre} es {persona.get_rol_display()} "
                f"y no puede ir como {rol.lower()}."
            )

        # Nadie puede estar en dos servicios que se pisan en el horario.
        desde, hasta = _fechas_candidatas(postura)
        otras = (
            AsignacionTripulacion.objects
            .filter(persona=persona, postura__fecha__range=(desde, hasta))
            .exclude(postura=postura)
            .select_related('postura', 'postura__ruta')
        )
        choque = next((a for a in otras if _se_solapan(postura, a.postura)), None)
        if choque:
            raise ValueError(
                f"{persona.nombre} ya viaja en la postura {choque.postura.codigo}, "
                f"que se solapa con esta."
            )

        # La dotación es fija: dos conductores y un asistente. Sumar uno
        # de más no es un servicio mejor cubierto, es un error de
        # planificación que además bloquea a esa persona para otro viaje.
        cupo = dotacion_requerida().get(rol)
        if cupo is None:
            raise ValueError(f'Rol en viaje inválido: {rol}')

        ya_asignados = postura.tripulacion.filter(rol_en_viaje=rol).exclude(persona=persona).count()
        if ya_asignados >= cupo:
            singular = 'conductor' if rol == Persona.Rol.CONDUCTOR else 'asistente'
            cubierto = (
                f'sus {cupo} {singular}es' if cupo > 1 else f'su {singular}'
            )
            raise ValueError(
                f'La postura {postura.codigo} ya tiene {cubierto}.'
            )

        asignacion = PosturaRepository.asignar_tripulacion(postura, persona, rol)

        # Asignar y avisar son el mismo acto: si el conductor no se
        # entera, el sistema no reemplazó al WhatsApp, solo se sumó.
        from core.services import avisar_asignacion
        avisar_asignacion(asignacion)

        return asignacion

    @staticmethod
    def desasignar_tripulacion(asignacion_id: int):
        """Quita a una persona de una postura (README §5: gestión de corridas)."""
        from .repositories import AsignacionRepository

        asignacion = AsignacionRepository.get_by_id(asignacion_id)
        if not asignacion:
            raise ValueError("Asignación no encontrada")

        # Los datos se leen antes de borrar la fila.
        from core.services import avisar_desasignacion
        persona, postura = asignacion.persona, asignacion.postura

        AsignacionRepository.delete(asignacion)
        avisar_desasignacion(persona, postura)

    @staticmethod
    def asignar_bus(postura_id: int, bus_id):
        """Asigna (o libera, con bus_id nulo) el bus de una postura."""
        from .repositories import PosturaRepository
        from flota.models import Bus

        postura = PosturaRepository.get_postura_by_id(postura_id)
        if not postura:
            raise ValueError("Postura no encontrada")

        if bus_id in (None, '', 0):
            return PosturaRepository.update_postura(postura, {'bus': None})

        try:
            bus = Bus.objects.get(id=bus_id)
        except Bus.DoesNotExist:
            raise ValueError("Bus no encontrado")

        # Un bus caído no puede tomar servicio: es justamente lo que
        # dispara una corrida.
        if bus.estado in (Bus.Estado.MANTENIMIENTO, Bus.Estado.FUERA_SERVICIO):
            raise ValueError(
                f"{bus.numero} está en {bus.get_estado_display()} y no puede tomar servicio."
            )

        # Un bus hace varios servicios al día; lo que no puede es estar
        # en dos que se pisan en el horario.
        desde, hasta = _fechas_candidatas(postura)
        otras = (
            Postura.objects
            .filter(bus=bus, fecha__range=(desde, hasta))
            .exclude(id=postura.id)
            .select_related('ruta')
        )
        choque = next((o for o in otras if _se_solapan(postura, o)), None)
        if choque:
            raise ValueError(
                f"{bus.numero} ya cubre la postura {choque.codigo}, que se solapa con esta."
            )

        actualizada = PosturaRepository.update_postura(postura, {'bus': bus})

        from core.services import avisar_cambio_bus
        avisar_cambio_bus(actualizada, bus)

        return actualizada

    @staticmethod
    def personal_disponible(postura_id: int):
        """Quién puede tomar esta postura.

        Es el paso que describe el proceso real: creada la postura, se
        revisa el personal disponible antes de asignar la tripulación.
        Devuelve a cada persona con el motivo por el que no está libre,
        para que el programador vea el panorama completo en vez de una
        lista recortada.
        """
        from .repositories import PosturaRepository

        postura = PosturaRepository.get_postura_by_id(postura_id)
        if not postura:
            raise ValueError("Postura no encontrada")

        tripulacion = Persona.objects.filter(
            rol__in=[Persona.Rol.CONDUCTOR, Persona.Rol.ASISTENTE]
        ).order_by('nombre')

        desde, hasta = _fechas_candidatas(postura)
        ocupados = {
            a.persona_id: a.postura.codigo
            for a in AsignacionTripulacion.objects
            .filter(postura__fecha__range=(desde, hasta))
            .exclude(postura=postura)
            .select_related('postura', 'postura__ruta')
            if _se_solapan(postura, a.postura)
        }
        ya_en_postura = set(
            AsignacionTripulacion.objects
            .filter(postura=postura)
            .values_list('persona_id', flat=True)
        )

        resultado = []
        for p in tripulacion:
            if p.id in ya_en_postura:
                motivo = 'Ya asignado a esta postura'
            elif p.id in ocupados:
                motivo = f'Viaja en {ocupados[p.id]} a esa hora'
            else:
                motivo = None

            resultado.append({
                'persona': p,
                'disponible': motivo is None,
                'motivo': motivo,
            })
        return resultado

    @staticmethod
    def posturas_para_persona(persona_id: int):
        """El inverso de `personal_disponible`: qué servicios puede tomar.

        La pantalla de Conductores ofrecía cualquier postura donde la
        persona no estuviera ya. El servidor las rechazaba una por una,
        así que no había riesgo de datos malos, pero el programador
        elegía a ciegas y descubría el problema recién al confirmar.

        Las reglas son las mismas de `asignar_tripulacion` porque salen
        del mismo sitio: si se copiaran aquí, tarde o temprano una de las
        dos versiones se quedaría atrás.
        """
        from .repositories import PersonaRepository

        persona = PersonaRepository.get_persona_by_id(persona_id)
        if not persona:
            raise ValueError('Persona no encontrada')

        # Ni el mecánico ni el jefe de operaciones viajan: para ellos no
        # hay ninguna postura posible, y decirlo es mejor que mostrar una
        # lista que fallará entera.
        if persona.rol not in (Persona.Rol.CONDUCTOR, Persona.Rol.ASISTENTE):
            return []

        # Lo ya ocurrido no se planifica. Sin este corte la lista arrastra
        # todos los servicios históricos y no se encuentra el de mañana.
        hoy = timezone.localdate()
        candidatas = list(
            Postura.objects
            .filter(fecha__gte=hoy)
            .select_related('ruta', 'ruta__origen', 'ruta__destino', 'bus')
            .prefetch_related('tripulacion')
            .order_by('fecha', 'hora_salida')
        )

        # Todo lo que la persona ya tiene comprometido, para medir choques.
        suyas = list(
            Postura.objects
            .filter(tripulacion__persona=persona)
            .select_related('ruta')
            .distinct()
        )
        propias = {p.id for p in suyas}

        resultado = []
        for postura in candidatas:
            if postura.id in propias:
                motivo = 'Ya va en este servicio'
            elif not postura.faltantes().get(persona.rol, 0):
                cargo = 'conductores' if persona.rol == Persona.Rol.CONDUCTOR                     else 'asistentes'
                motivo = f'Ya tiene todos sus {cargo}'
            else:
                choque = next(
                    (o for o in suyas
                     if o.id != postura.id and _se_solapan(postura, o)),
                    None,
                )
                motivo = (f'Se solapa con {choque.codigo}, donde ya viaja'
                          if choque else None)

            resultado.append({
                'postura': postura,
                'disponible': motivo is None,
                'motivo': motivo,
            })

        return resultado


class PersonalService:
    """ABM del personal: conductores, asistentes, mecánicos y jefaturas."""

    @staticmethod
    def crear(data: dict):
        from .repositories import PersonaRepository
        return PersonaRepository.create_persona(data)

    @staticmethod
    def actualizar(persona_id: int, data: dict):
        from .repositories import PersonaRepository
        persona = PersonaRepository.get_persona_by_id(persona_id)
        if not persona:
            raise ValueError("Persona no encontrada")
        return PersonaRepository.update_persona(persona, data)

    @staticmethod
    def eliminar(persona_id: int):
        from .repositories import PersonaRepository, AsignacionRepository  # noqa: F401
        persona = PersonaRepository.get_persona_by_id(persona_id)
        if not persona:
            raise ValueError("Persona no encontrada")

        # Borrar a alguien con historial rompería la trazabilidad de
        # checklists, incidentes y órdenes firmadas por esa persona.
        if persona.checklists.exists() or persona.incidentes.exists():
            raise ValueError(
                f"{persona.nombre} tiene checklists o incidentes registrados y no puede eliminarse."
            )
        if persona.ordenes.exists():
            raise ValueError(
                f"{persona.nombre} tiene órdenes de trabajo asignadas y no puede eliminarse."
            )
        if persona.asignaciontripulacion_set.exists():
            raise ValueError(
                f"{persona.nombre} está asignado a posturas. Quítalo de ellas antes de eliminarlo."
            )

        PersonaRepository.delete_persona(persona)


class CatalogoService:
    """Ciudades y rutas: el catálogo con el que se arman las posturas."""

    @staticmethod
    def get_ciudades():
        from .repositories import CiudadRepository
        return CiudadRepository.get_todas()

    @staticmethod
    def crear_ciudad(data: dict):
        from .repositories import CiudadRepository
        return CiudadRepository.create(data)

    @staticmethod
    def crear_ruta(data: dict):
        from .repositories import RutaRepositoryExtra
        if data.get('origen') == data.get('destino'):
            raise ValueError("El origen y el destino no pueden ser la misma ciudad.")
        return RutaRepositoryExtra.create(data)

    @staticmethod
    def actualizar_ruta(ruta_id: int, data: dict):
        """Corrige una ruta ya creada.

        Existe sobre todo por la duración: es el dato con el que el
        sistema decide si dos servicios se pisan y cuántos relevos
        necesita un viaje. Si el número está mal, no había forma de
        arreglarlo sin entrar a la base.
        """
        from .repositories import RutaRepository

        ruta = RutaRepository.get_ruta_by_id(ruta_id)
        if not ruta:
            raise ValueError("Ruta no encontrada")

        origen = data.get('origen', ruta.origen)
        destino = data.get('destino', ruta.destino)
        if origen == destino:
            raise ValueError("El origen y el destino no pueden ser la misma ciudad.")

        duracion = data.get('duracion_estimada', ruta.duracion_estimada)
        if float(duracion) <= 0:
            raise ValueError("La duración tiene que ser mayor que cero.")

        ruta.origen = origen
        ruta.destino = destino
        ruta.duracion_estimada = duracion
        ruta.save()
        return ruta

    @staticmethod
    def eliminar_ruta(ruta_id: int):
        from .repositories import RutaRepository, RutaRepositoryExtra
        ruta = RutaRepository.get_ruta_by_id(ruta_id)
        if not ruta:
            raise ValueError("Ruta no encontrada")
        if ruta.postura_set.exists():
            raise ValueError("La ruta tiene posturas asociadas y no puede eliminarse.")
        RutaRepositoryExtra.delete(ruta)

    @staticmethod
    def eliminar_ciudad(ciudad_id: int):
        """Una ciudad solo se va si no queda ninguna ruta apoyada en ella."""
        ciudad = Ciudad.objects.filter(id=ciudad_id).first()
        if not ciudad:
            raise ValueError("Ciudad no encontrada")

        usos = ciudad.rutas_origen.count() + ciudad.rutas_destino.count()
        if usos:
            raise ValueError(
                f"{ciudad.nombre} se usa en {usos} ruta(s). "
                "Elimina esas rutas antes."
            )
        ciudad.delete()


class ParametrosService:
    """Las reglas del negocio, editables desde Configuración."""

    @staticmethod
    def actuales():
        return Parametros.actual()

    @staticmethod
    def actualizar(data: dict, persona=None):
        p = Parametros.actual()

        conductores = int(data.get('conductores_por_servicio',
                                   p.conductores_por_servicio))
        asistentes = int(data.get('asistentes_por_servicio',
                                  p.asistentes_por_servicio))
        # Un servicio sin conductor no es un servicio.
        if conductores < 1:
            raise ValueError('Cada servicio necesita al menos un conductor.')
        if asistentes < 0:
            raise ValueError('Los asistentes no pueden ser un número negativo.')

        p.conductores_por_servicio = conductores
        p.asistentes_por_servicio = asistentes
        p.actualizado_por = persona
        p.save()
        return p



class CorridaService:
    """Gestión de corridas: qué servicios quedan comprometidos cuando un
    bus se cae, y con qué máquina se cubren (README §2.5)."""

    @staticmethod
    def get_todas():
        return (
            Corrida.objects
            .select_related('bus_original', 'bus_cierre', 'creado_por')
            .prefetch_related('movimientos__postura__ruta',
                              'movimientos__bus_saliente',
                              'movimientos__bus_entrante')
        )

    @staticmethod
    def buses_caidos():
        """Buses fuera de circulación que todavía tienen servicios por
        delante. Son los que exigen una corrida."""
        from flota.models import Bus
        from django.utils import timezone

        ahora = timezone.localtime()
        caidos = Bus.objects.filter(
            estado__in=[Bus.Estado.FUERA_SERVICIO, Bus.Estado.MANTENIMIENTO]
        ).order_by('numero')

        resultado = []
        for bus in caidos:
            pendientes = [
                p for p in Postura.objects
                .filter(bus=bus)
                .select_related('ruta', 'ruta__origen', 'ruta__destino')
                .order_by('fecha', 'hora_salida')
                if datetime.combine(p.fecha, p.hora_salida) >= ahora.replace(tzinfo=None)
                and p.estado != Postura.Estado.COMPLETA
            ]
            # Sin servicios por delante no hay corrida que gestionar.
            if pendientes:
                resultado.append({'bus': bus, 'posturas': pendientes})
        return resultado

    @staticmethod
    def cadena_propuesta(postura_id, limite=8):
        """La cascada que hay que hacer para cubrir un servicio caído.

        Es el mecanismo real que describió Operaciones: el servicio que
        se cayó lo toma la máquina del siguiente, ese siguiente lo toma
        la del que viene después, y así se van corriendo las salidas.

        No se busca un bus de reserva. La empresa no las tiene —"falta
        de máquinas para todas las posturas" es su mayor problema— y por
        eso el procedimiento consiste en adelantar la fila.

        Solo entran servicios que salen del mismo lugar y después de la
        hora del caído: una máquina que está en Santiago no puede cubrir
        algo que sale de Antofagasta.

        El último de la lista queda sin máquina: es el que espera al bus
        que está en el pozo, y por eso la corrida sigue abierta hasta
        que ese bus sale.
        """
        from .repositories import PosturaRepository

        caida = PosturaRepository.get_postura_by_id(postura_id)
        if not caida:
            raise ValueError('Postura no encontrada')

        posteriores = list(
            Postura.objects
            .filter(fecha=caida.fecha,
                    ruta__origen=caida.ruta.origen,
                    hora_salida__gt=caida.hora_salida,
                    bus__isnull=False)
            .exclude(id=caida.id)
            .exclude(estado=Postura.Estado.COMPLETA)
            .select_related('ruta', 'ruta__origen', 'ruta__destino', 'bus')
            .order_by('hora_salida')[:limite]
        )

        cadena = [{
            'postura': caida,
            'bus_saliente': caida.bus,
            'bus_entrante': posteriores[0].bus if posteriores else None,
        }]
        for actual, siguiente in zip(posteriores, posteriores[1:] + [None]):
            cadena.append({
                'postura': actual,
                'bus_saliente': actual.bus,
                'bus_entrante': siguiente.bus if siguiente else None,
            })

        return cadena

    @staticmethod
    @transaction.atomic
    def crear(bus_original_id, motivo, persona, postura_id, hasta=None):
        """Aplica la cascada y la deja registrada.

        `hasta` acota cuántos servicios se corren. Operaciones no siempre
        arrastra la fila entera: corre los necesarios y el resto espera a
        que salga la máquina del pozo.

        Va en una transacción: o se mueven todas las máquinas de la
        cadena y queda el registro, o no se mueve ninguna. Una cascada a
        medias deja servicios sin bus y sin rastro de por qué.
        """
        from flota.models import Bus
        from core.services import avisar_corrida

        if not motivo or not motivo.strip():
            raise ValueError('Indica el motivo de la corrida.')

        try:
            bus_original = Bus.objects.get(id=bus_original_id)
        except Bus.DoesNotExist:
            raise ValueError('Bus original no encontrado')

        cadena = CorridaService.cadena_propuesta(postura_id)

        if cadena[0]['postura'].bus_id != bus_original.id:
            raise ValueError(
                'La postura %s no la cubre %s.'
                % (cadena[0]['postura'].codigo, bus_original.numero)
            )

        if hasta is not None:
            cadena = cadena[:max(1, int(hasta))]
            # Al acotar, el último de los que quedan pierde su relevo:
            # ese es el servicio que espera la máquina del pozo.
            cadena[-1] = dict(cadena[-1], bus_entrante=None)

        corrida = Corrida.objects.create(
            bus_original=bus_original,
            postura_origen=cadena[0]['postura'],
            motivo=motivo.strip(),
            creado_por=persona,
        )

        for orden, paso in enumerate(cadena):
            postura = paso['postura']
            entrante = paso['bus_entrante']

            MovimientoCorrida.objects.create(
                corrida=corrida, orden=orden, postura=postura,
                bus_saliente=paso['bus_saliente'], bus_entrante=entrante,
            )

            postura.bus = entrante
            # Sin máquina el servicio queda marcado para que Operaciones
            # lo vea; con máquina vuelve a estar listo.
            postura.estado = (Postura.Estado.LISTA if entrante
                              else Postura.Estado.PROBLEMA)
            postura.save(update_fields=['bus', 'estado'])

            # La tripulación tiene que enterarse antes de presentarse al
            # andén: la máquina con la que iban ya no es la que sale.
            if paso['bus_saliente'] and entrante:
                avisar_corrida(postura, paso['bus_saliente'], entrante)

        return corrida

    @staticmethod
    @transaction.atomic
    def cerrar(corrida_id: int, bus_id=None):
        """Cierra la cadena poniéndole máquina al servicio que esperaba.

        Es el momento que describió Operaciones: sale el bus del pozo,
        toma el servicio que quedó descubierto y la corrida se detiene.
        """
        from django.utils import timezone
        from flota.models import Bus
        from core.services import avisar_cambio_bus

        try:
            corrida = Corrida.objects.get(id=corrida_id)
        except Corrida.DoesNotExist:
            raise ValueError('Corrida no encontrada')

        if corrida.estado == Corrida.Estado.CERRADA:
            raise ValueError('La corrida ya está cerrada.')

        pendiente = corrida.movimientos.filter(bus_entrante__isnull=True).first()

        if pendiente:
            if not bus_id:
                raise ValueError(
                    'La postura %s sigue sin máquina. Indica con cuál se '
                    'cubre para cerrar la corrida.' % pendiente.postura.codigo
                )
            try:
                bus = Bus.objects.get(id=bus_id)
            except Bus.DoesNotExist:
                raise ValueError('Bus no encontrado')

            if bus.estado in (Bus.Estado.MANTENIMIENTO, Bus.Estado.FUERA_SERVICIO):
                raise ValueError(
                    '%s sigue en %s: libéralo en el taller antes de cerrar '
                    'la corrida.' % (bus.numero, bus.get_estado_display())
                )

            postura = pendiente.postura
            choque = next(
                (o for o in Postura.objects
                 .filter(bus=bus).exclude(id=postura.id).select_related('ruta')
                 if _se_solapan(postura, o)),
                None,
            )
            if choque:
                raise ValueError(
                    '%s ya cubre %s, que se solapa con %s.'
                    % (bus.numero, choque.codigo, postura.codigo)
                )

            pendiente.bus_entrante = bus
            pendiente.save(update_fields=['bus_entrante'])

            postura.bus = bus
            postura.estado = Postura.Estado.LISTA
            postura.save(update_fields=['bus', 'estado'])
            avisar_cambio_bus(postura, bus)

            corrida.bus_cierre = bus

        corrida.estado = Corrida.Estado.CERRADA
        corrida.cerrado_en = timezone.now()
        corrida.save(update_fields=['estado', 'cerrado_en', 'bus_cierre'])
        return corrida
