from datetime import datetime, timedelta

from django.db import transaction

from .repositories import PersonaRepository
from .models import Persona, Postura, AsignacionTripulacion, Corrida

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
        estado_semaforo = Persona.Semaforo.VERDE
        razon = None

        if nuevas_horas >= 8:
            estado_semaforo = Persona.Semaforo.ROJO
            razon = 'Exceso de jornada diaria (>8h)'
        elif nuevas_horas >= 6:
            estado_semaforo = Persona.Semaforo.AMARILLO
            razon = 'Precaución: Jornada acercándose al límite'

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

        # Nadie puede estar en dos servicios que se pisan en el horario.
        otras = (
            AsignacionTripulacion.objects
            .filter(persona=persona, postura__fecha=postura.fecha)
            .exclude(postura=postura)
            .select_related('postura', 'postura__ruta')
        )
        choque = next((a for a in otras if _se_solapan(postura, a.postura)), None)
        if choque:
            raise ValueError(
                f"{persona.nombre} ya viaja en la postura {choque.postura.codigo}, "
                f"que se solapa con esta."
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
        otras = (
            Postura.objects
            .filter(bus=bus, fecha=postura.fecha)
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

        ocupados = {
            a.persona_id: a.postura.codigo
            for a in AsignacionTripulacion.objects
            .filter(postura__fecha=postura.fecha)
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
    def eliminar_ruta(ruta_id: int):
        from .repositories import RutaRepository, RutaRepositoryExtra
        ruta = RutaRepository.get_ruta_by_id(ruta_id)
        if not ruta:
            raise ValueError("Ruta no encontrada")
        if ruta.postura_set.exists():
            raise ValueError("La ruta tiene posturas asociadas y no puede eliminarse.")
        RutaRepositoryExtra.delete(ruta)


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
