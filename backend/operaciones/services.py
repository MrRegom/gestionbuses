from datetime import datetime, timedelta

from django.db import transaction
from django.utils import timezone

from .repositories import PersonaRepository
from .models import (
    Ciudad, CicloTurno, Corrida, MovimientoCorrida, Parametros, Persona,
    Postura, Turno, AsignacionTripulacion, CARGO_DEL_PUESTO,
    disponible_por_turno, dotacion_requerida, puestos_de,
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

        # Un servicio que originó una corrida no se borra: con él se iría
        # el registro de por qué se corrió la fila ese día. La base lo
        # impide de todos modos —la relación es PROTECT—, pero sin este
        # aviso el error que llega es opaco.
        if postura.corridas_originadas.exists():
            raise ValueError(
                f'La postura {postura.codigo} originó una corrida y no se '
                'puede eliminar: se perdería el registro de por qué se '
                'corrió la fila.'
            )

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

        # El puesto se valida antes de usarlo: sin esto, un valor que
        # no viene explotaba con un 500 en vez de decir qué falta.
        if rol not in AsignacionTripulacion.Puesto.values:
            raise ValueError(
                'Indica el puesto: jefe de máquina, 2° conductor o auxiliar.'
            )

        # El puesto exige un cargo: un asistente no va al volante y un
        # conductor no hace de auxiliar.
        if CARGO_DEL_PUESTO[rol] != persona.rol:
            puesto = AsignacionTripulacion.Puesto(rol).label
            raise ValueError(
                f'{persona.nombre} es {persona.get_rol_display()} '
                f'y no puede ir como {puesto.lower()}.'
            )

        # Quien está de descanso no entra a la programación. Es el
        # primer paso del flujo que describió Operaciones: turnos,
        # disponibilidad, y recién ahí la asignación.
        trabaja, motivo = disponible_por_turno(persona, postura.fecha)
        if not trabaja:
            raise ValueError(f'{persona.nombre}: {motivo.lower()}.')

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
            puesto = AsignacionTripulacion.Puesto(rol).label
            cubierto = (f'sus {cupo} puestos de {puesto.lower()}' if cupo > 1
                        else f'su {puesto.lower()}')
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

        tripulacion = (Persona.objects
                       .filter(rol__in=[Persona.Rol.CONDUCTOR,
                                        Persona.Rol.ASISTENTE])
                       .select_related('turno', 'turno__ciclo')
                       .order_by('nombre'))

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
            trabaja, motivo_turno = disponible_por_turno(p, postura.fecha)

            if p.id in ya_en_postura:
                motivo = 'Ya asignado a esta postura'
            elif not trabaja:
                motivo = motivo_turno
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

        # Un conductor puede ir de jefe de máquina o de segundo; un
        # asistente solo de auxiliar. La postura le sirve si le falta
        # cualquiera de los puestos que su cargo puede ocupar.
        mis_puestos = puestos_de(persona.rol)

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
            trabaja, motivo_turno = disponible_por_turno(persona, postura.fecha)

            if postura.id in propias:
                motivo = 'Ya va en este servicio'
            elif not trabaja:
                motivo = motivo_turno
            elif not any(postura.faltantes().get(p, 0) for p in mis_puestos):
                cargo = ('conductores' if persona.rol == Persona.Rol.CONDUCTOR
                         else 'asistentes')
                motivo = f'Ya tiene todos sus {cargo}'
            else:
                choque = next(
                    (o for o in suyas
                     if o.id != postura.id and _se_solapan(postura, o)),
                    None,
                )
                motivo = (f'Se solapa con {choque.codigo}, donde ya viaja'
                          if choque else None)

            # Qué puesto ocuparía. Se sigue el orden de la planilla:
            # primero el jefe de máquina, después el segundo.
            faltan = postura.faltantes()
            puesto = next((p for p in mis_puestos if faltan.get(p, 0)), None)

            resultado.append({
                'postura': postura,
                'disponible': motivo is None,
                'motivo': motivo,
                'puesto': puesto,
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


class TurnoService:
    """Ciclos de trabajo y quién está disponible cada día.

    Es el primer paso del flujo que describió Operaciones —turnos,
    disponibilidad, postura, asignación— y hasta ahora faltaba entero:
    el sistema asumía que cualquiera podía tomar cualquier servicio
    mientras no se le pisara el horario.
    """

    # ── Ciclos ──
    @staticmethod
    def get_ciclos():
        return CicloTurno.objects.all()

    @staticmethod
    def crear_ciclo(data: dict):
        nombre = (data.get('nombre') or '').strip()
        if not nombre:
            raise ValueError('El ciclo necesita un nombre, por ejemplo 10x4.')
        if CicloTurno.objects.filter(nombre__iexact=nombre).exists():
            raise ValueError(f'Ya existe un ciclo llamado "{nombre}".')

        trabajo = int(data.get('dias_trabajo') or 0)
        descanso = int(data.get('dias_descanso') or 0)
        if trabajo < 1:
            raise ValueError('Un ciclo necesita al menos un día de trabajo.')
        if descanso < 0:
            raise ValueError('Los días de descanso no pueden ser negativos.')

        return CicloTurno.objects.create(
            nombre=nombre, dias_trabajo=trabajo, dias_descanso=descanso,
            activo=bool(data.get('activo', True)),
        )

    @staticmethod
    def actualizar_ciclo(ciclo_id: int, data: dict):
        ciclo = CicloTurno.objects.filter(id=ciclo_id).first()
        if not ciclo:
            raise ValueError('Ciclo no encontrado')

        if 'nombre' in data:
            nombre = (data['nombre'] or '').strip()
            if not nombre:
                raise ValueError('El ciclo necesita un nombre.')
            if (CicloTurno.objects.filter(nombre__iexact=nombre)
                    .exclude(id=ciclo_id).exists()):
                raise ValueError(f'Ya existe un ciclo llamado "{nombre}".')
            ciclo.nombre = nombre

        if 'dias_trabajo' in data:
            if int(data['dias_trabajo'] or 0) < 1:
                raise ValueError('Un ciclo necesita al menos un día de trabajo.')
            ciclo.dias_trabajo = int(data['dias_trabajo'])

        if 'dias_descanso' in data:
            if int(data['dias_descanso'] or 0) < 0:
                raise ValueError('Los días de descanso no pueden ser negativos.')
            ciclo.dias_descanso = int(data['dias_descanso'])

        if 'activo' in data:
            ciclo.activo = bool(data['activo'])

        ciclo.save()
        return ciclo

    @staticmethod
    def eliminar_ciclo(ciclo_id: int):
        ciclo = CicloTurno.objects.filter(id=ciclo_id).first()
        if not ciclo:
            raise ValueError('Ciclo no encontrado')

        usados = ciclo.turnos.count()
        if usados:
            raise ValueError(
                f'{ciclo.nombre} lo usan {usados} persona(s). Cámbiales el '
                'ciclo antes de eliminarlo, o desactívalo.'
            )
        ciclo.delete()

    # ── Turno de una persona ──
    @staticmethod
    def asignar(persona_id: int, ciclo_id, inicio):
        """Le pone ciclo a una persona, o se lo quita si `ciclo_id` es nulo."""
        from .repositories import PersonaRepository

        persona = PersonaRepository.get_persona_by_id(persona_id)
        if not persona:
            raise ValueError('Persona no encontrada')

        if not ciclo_id:
            Turno.objects.filter(persona=persona).delete()
            return None

        ciclo = CicloTurno.objects.filter(id=ciclo_id).first()
        if not ciclo:
            raise ValueError('Ciclo no encontrado')
        if not ciclo.activo:
            raise ValueError(f'El ciclo {ciclo.nombre} está desactivado.')
        if not inicio:
            raise ValueError('Indica desde qué día corre el ciclo.')

        turno, _ = Turno.objects.update_or_create(
            persona=persona, defaults={'ciclo': ciclo, 'inicio': inicio},
        )
        return turno

    # ── Consulta ──
    @staticmethod
    def dotacion_del_dia(fecha=None):
        """Quién trabaja y quién descansa ese día, por cargo.

        Responde la pregunta que hoy se contesta con una planilla Excel:
        de qué gente dispone Operaciones para programar.
        """
        fecha = fecha or timezone.localdate()

        gente = (Persona.objects
                 .filter(rol__in=[Persona.Rol.CONDUCTOR, Persona.Rol.ASISTENTE])
                 .select_related('turno', 'turno__ciclo')
                 .order_by('nombre'))

        filas = []
        for p in gente:
            trabaja, motivo = disponible_por_turno(p, fecha)
            turno = getattr(p, 'turno', None)
            filas.append({
                'persona': p,
                'trabaja': trabaja,
                'motivo': motivo,
                'ciclo': turno.ciclo.nombre if turno else None,
                'dia_del_ciclo': turno.dia_del_ciclo(fecha) if turno else None,
            })
        return filas


class CuentaService:
    """Alta y baja de accesos a la aplicación.

    La contraseña inicial se genera al azar y se muestra una sola vez,
    para que Operaciones se la dicte a la persona. No se guarda en
    ninguna parte legible: Django solo conserva su hash.
    """

    # Sin caracteres que se confundan al dictar: ni O ni 0, ni l ni 1.
    ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    LARGO_CLAVE = 10

    @staticmethod
    def _clave_nueva():
        import secrets
        return ''.join(secrets.choice(CuentaService.ALFABETO)
                       for _ in range(CuentaService.LARGO_CLAVE))

    @staticmethod
    def sugerir_usuario(persona):
        """Inicial del nombre más el primer apellido, como las que ya hay.

        Es una sugerencia: Operaciones la puede cambiar. Si choca con una
        existente se le agrega un número.
        """
        from django.contrib.auth.models import User
        import unicodedata

        partes = [p for p in persona.nombre.split() if p]
        if not partes:
            base = 'usuario'
        elif len(partes) == 1:
            base = partes[0]
        else:
            base = partes[0][0] + partes[1]

        base = unicodedata.normalize('NFKD', base.lower())
        base = ''.join(c for c in base if c.isascii() and c.isalnum()) or 'usuario'

        candidato, n = base, 1
        while User.objects.filter(username=candidato).exists():
            n += 1
            candidato = f'{base}{n}'
        return candidato

    @staticmethod
    @transaction.atomic
    def crear(persona_id: int, username=None):
        """Le da acceso a una persona. Devuelve (persona, clave)."""
        from django.contrib.auth.models import User
        from .repositories import PersonaRepository

        persona = PersonaRepository.get_persona_by_id(persona_id)
        if not persona:
            raise ValueError('Persona no encontrada')

        if persona.usuario_id:
            raise ValueError(
                f'{persona.nombre} ya tiene cuenta ({persona.usuario.username}). '
                'Si perdió la clave, reiníciala.'
            )

        username = (username or '').strip() or CuentaService.sugerir_usuario(persona)
        if User.objects.filter(username__iexact=username).exists():
            raise ValueError(f'El usuario "{username}" ya está tomado.')

        clave = CuentaService._clave_nueva()
        usuario = User.objects.create_user(
            username=username,
            password=clave,
            first_name=persona.nombre.split(' ')[0],
        )

        persona.usuario = usuario
        persona.debe_cambiar_clave = True
        persona.save(update_fields=['usuario', 'debe_cambiar_clave'])

        return persona, clave

    @staticmethod
    @transaction.atomic
    def reiniciar_clave(persona_id: int):
        """Clave nueva para quien la perdió. Devuelve (persona, clave)."""
        from .repositories import PersonaRepository

        persona = PersonaRepository.get_persona_by_id(persona_id)
        if not persona:
            raise ValueError('Persona no encontrada')
        if not persona.usuario_id:
            raise ValueError(f'{persona.nombre} no tiene cuenta todavía.')

        clave = CuentaService._clave_nueva()
        persona.usuario.set_password(clave)
        persona.usuario.is_active = True
        persona.usuario.save(update_fields=['password', 'is_active'])

        persona.debe_cambiar_clave = True
        persona.save(update_fields=['debe_cambiar_clave'])

        return persona, clave

    @staticmethod
    @transaction.atomic
    def quitar_acceso(persona_id: int):
        """Desactiva la cuenta sin borrarla.

        Borrar el usuario dejaría huérfano lo que firmó: un checklist o
        un incidente apuntan a la persona, pero quién entró a hacerlo es
        el usuario. Desactivar cierra la puerta y conserva el rastro.
        """
        from .repositories import PersonaRepository

        persona = PersonaRepository.get_persona_by_id(persona_id)
        if not persona:
            raise ValueError('Persona no encontrada')
        if not persona.usuario_id:
            raise ValueError(f'{persona.nombre} no tiene cuenta.')

        persona.usuario.is_active = False
        persona.usuario.save(update_fields=['is_active'])
        return persona

    @staticmethod
    def cambiar_clave(persona, actual, nueva):
        """La cambia la propia persona, con su clave vigente."""
        if not persona or not persona.usuario_id:
            raise ValueError('Tu cuenta no está vinculada a una persona.')

        if not persona.usuario.check_password(actual or ''):
            raise ValueError('La contraseña actual no es correcta.')

        nueva = (nueva or '').strip()
        if len(nueva) < 8:
            raise ValueError('La contraseña nueva necesita al menos 8 caracteres.')
        if nueva == actual:
            raise ValueError('La contraseña nueva tiene que ser distinta.')

        persona.usuario.set_password(nueva)
        persona.usuario.save(update_fields=['password'])

        persona.debe_cambiar_clave = False
        persona.save(update_fields=['debe_cambiar_clave'])
        return persona


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
