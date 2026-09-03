from datetime import datetime, timedelta

from django.db import transaction

from .repositories import PersonaRepository
from .models import (
    Ciudad, Corrida, Parametros, Persona, Postura, AsignacionTripulacion,
    dotacion_requerida, horas_conduccion,
)

def semaforo_por_horas(horas):
    """Traduce horas al volante en color de semáforo y su motivo.

    El tope lo fija Operaciones desde Configuración; hoy son cinco horas
    continuas. Antes estaba escrito en el código en ocho y seis, cifras
    que no venían de nadie.

    Vive aquí y no dentro del servicio para que la semilla y cualquier
    otro punto usen exactamente el mismo criterio.
    """
    horas = float(horas)
    maximo, aviso = horas_conduccion()

    if horas >= maximo:
        return (Persona.Semaforo.ROJO,
                f'Alcanzó el máximo de {maximo:g} h continuas de conducción.')

    if horas >= aviso:
        return (Persona.Semaforo.AMARILLO,
                f'Le quedan {maximo - horas:g} h antes del máximo de '
                f'{maximo:g} h continuas.')

    return Persona.Semaforo.VERDE, None


class TripulacionService:
    @staticmethod
    def get_todas_personas():
        return PersonaRepository.get_todas_personas()

    @staticmethod
    def get_conductores():
        return PersonaRepository.get_conductores()

    @staticmethod
    def registrar_horas(persona_id: int, horas_agregadas: float):
        persona = PersonaRepository.get_persona_by_id(persona_id)
        if not persona:
            raise ValueError("Persona no encontrada")
        
        nuevas_horas = float(persona.horas_hoy) + horas_agregadas
        estado_semaforo, razon = semaforo_por_horas(nuevas_horas)

        return PersonaRepository.update_persona(persona, {
            'horas_hoy': nuevas_horas,
            'semaforo': estado_semaforo,
            'razon_bloqueo': razon
        })

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

        if persona.semaforo == Persona.Semaforo.ROJO:
            raise ValueError(f"No se puede asignar a {persona.nombre} porque está bloqueado (Semaforo Rojo).")

        # Solo tripulación viaja: un mecánico o el jefe de operaciones no
        # forman parte de la dotación de un servicio.
        if persona.rol not in (Persona.Rol.CONDUCTOR, Persona.Rol.ASISTENTE):
            raise ValueError(
                f"{persona.nombre} es {persona.get_rol_display()} y no puede ir como tripulación."
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

        return PosturaRepository.asignar_tripulacion(postura, persona, rol)

    @staticmethod
    def desasignar_tripulacion(asignacion_id: int):
        """Quita a una persona de una postura (README §5: gestión de corridas)."""
        from .repositories import AsignacionRepository

        asignacion = AsignacionRepository.get_by_id(asignacion_id)
        if not asignacion:
            raise ValueError("Asignación no encontrada")
        AsignacionRepository.delete(asignacion)

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

        return PosturaRepository.update_postura(postura, {'bus': bus})

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
            elif p.semaforo == Persona.Semaforo.ROJO:
                motivo = p.razon_bloqueo or 'Bloqueado por fatiga'
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
        maximo = float(data.get('horas_conduccion_max', p.horas_conduccion_max))
        aviso = float(data.get('horas_conduccion_aviso', p.horas_conduccion_aviso))

        # Un servicio sin conductor no es un servicio.
        if conductores < 1:
            raise ValueError('Cada servicio necesita al menos un conductor.')
        if asistentes < 0:
            raise ValueError('Los asistentes no pueden ser un número negativo.')
        if maximo <= 0:
            raise ValueError('El máximo de horas tiene que ser mayor que cero.')
        # Avisar después del tope no avisa nada.
        if aviso >= maximo:
            raise ValueError(
                'El aviso tiene que ser menor que el máximo: si no, salta '
                'cuando ya se pasó el límite.'
            )

        p.conductores_por_servicio = conductores
        p.asistentes_por_servicio = asistentes
        p.horas_conduccion_max = maximo
        p.horas_conduccion_aviso = aviso
        p.actualizado_por = persona
        p.save()

        ParametrosService._recalcular_semaforos()
        return p

    @staticmethod
    def _recalcular_semaforos():
        """Reevalúa a toda la tripulación con el tope recién guardado.

        El semáforo es una foto: se calcula al registrar horas y queda
        grabado. Si Operaciones baja el máximo de seis a cinco, quien
        llevaba cinco horas y media pasó a estar sobre el límite, pero su
        fila seguiría diciendo verde hasta la próxima vez que alguien le
        sumara horas. Bajar el tope y que nadie se bloquee es peor que no
        poder bajarlo.
        """
        from .models import Persona

        pendientes = []
        for p in Persona.objects.filter(
            rol__in=[Persona.Rol.CONDUCTOR, Persona.Rol.ASISTENTE]
        ):
            color, razon = semaforo_por_horas(p.horas_hoy)
            if p.semaforo != color or p.razon_bloqueo != razon:
                p.semaforo = color
                p.razon_bloqueo = razon
                pendientes.append(p)

        if pendientes:
            Persona.objects.bulk_update(
                pendientes, ['semaforo', 'razon_bloqueo'])
        return len(pendientes)


class CorridaService:
    """Gestión de corridas: qué servicios quedan comprometidos cuando un
    bus se cae, y con qué máquina se cubren (README §2.5)."""

    @staticmethod
    def get_todas():
        return (
            Corrida.objects
            .select_related('bus_original', 'bus_sustituto', 'creado_por')
            .prefetch_related('posturas__ruta__origen', 'posturas__ruta__destino')
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
    def sustitutos_posibles(postura_ids):
        """Buses que podrían cubrir TODAS las posturas indicadas.

        Un candidato sirve solo si está operativo y ninguna de las
        posturas se le pisa con lo que ya tiene asignado.
        """
        from flota.models import Bus

        posturas = list(
            Postura.objects.filter(id__in=postura_ids).select_related('ruta')
        )
        if not posturas:
            return []

        candidatos = Bus.objects.filter(estado=Bus.Estado.DISPONIBLE).order_by('numero')
        excluir = {p.id for p in posturas}

        libres = []
        for bus in candidatos:
            ocupadas = list(
                Postura.objects
                .filter(bus=bus)
                .exclude(id__in=excluir)
                .select_related('ruta')
            )
            if any(_se_solapan(p, o) for p in posturas for o in ocupadas):
                continue
            libres.append(bus)
        return libres

    @staticmethod
    @transaction.atomic
    def crear(bus_original_id, motivo, persona, postura_ids, bus_sustituto_id=None):
        """Registra la corrida y traspasa los servicios al bus sustituto.

        Va en una transacción: o se reasignan todas las posturas y queda
        el registro, o no se mueve nada. Una reasignación a medias
        dejaría servicios sin máquina y sin rastro de por qué.
        """
        from flota.models import Bus

        if not motivo or not motivo.strip():
            raise ValueError('Indica el motivo de la corrida.')

        try:
            bus_original = Bus.objects.get(id=bus_original_id)
        except Bus.DoesNotExist:
            raise ValueError('Bus original no encontrado')

        posturas = list(
            Postura.objects.filter(id__in=postura_ids or []).select_related('ruta')
        )
        if not posturas:
            raise ValueError('Selecciona al menos una postura afectada.')

        sustituto = None
        if bus_sustituto_id:
            try:
                sustituto = Bus.objects.get(id=bus_sustituto_id)
            except Bus.DoesNotExist:
                raise ValueError('Bus sustituto no encontrado')

            if sustituto.id == bus_original.id:
                raise ValueError('El bus sustituto no puede ser el mismo que falló.')

            if sustituto.estado != Bus.Estado.DISPONIBLE:
                raise ValueError(
                    f'{sustituto.numero} no está disponible '
                    f'({sustituto.get_estado_display()}).'
                )

            # Ninguna de las posturas puede pisarse con lo que el
            # sustituto ya tiene comprometido.
            ocupadas = list(
                Postura.objects
                .filter(bus=sustituto)
                .exclude(id__in=[p.id for p in posturas])
                .select_related('ruta')
            )
            for p in posturas:
                choque = next((o for o in ocupadas if _se_solapan(p, o)), None)
                if choque:
                    raise ValueError(
                        f'{sustituto.numero} ya cubre la postura {choque.codigo}, '
                        f'que se solapa con {p.codigo}.'
                    )

        corrida = Corrida.objects.create(
            bus_original=bus_original,
            bus_sustituto=sustituto,
            motivo=motivo.strip(),
            creado_por=persona,
        )
        corrida.posturas.set(posturas)

        for p in posturas:
            p.bus = sustituto
            # Con máquina asignada el servicio deja de estar en problema;
            # sin sustituto queda marcado para que Operaciones lo vea.
            p.estado = Postura.Estado.LISTA if sustituto else Postura.Estado.PROBLEMA
            p.save(update_fields=['bus', 'estado'])

        return corrida

    @staticmethod
    @transaction.atomic
    def cerrar(corrida_id: int):
        from django.utils import timezone

        try:
            corrida = Corrida.objects.get(id=corrida_id)
        except Corrida.DoesNotExist:
            raise ValueError('Corrida no encontrada')

        if corrida.estado == Corrida.Estado.CERRADA:
            raise ValueError('La corrida ya está cerrada.')

        if not corrida.bus_sustituto:
            raise ValueError(
                'No se puede cerrar una corrida sin bus sustituto: '
                'los servicios siguen sin máquina.'
            )

        corrida.estado = Corrida.Estado.CERRADA
        corrida.cerrado_en = timezone.now()
        corrida.save(update_fields=['estado', 'cerrado_en'])
        return corrida
