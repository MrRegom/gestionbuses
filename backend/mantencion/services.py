from django.db import transaction
from django.utils import timezone

from flota.models import Bus
from operaciones.models import Persona, Postura

from .models import (
    CategoriaChecklist, Checklist, Incidente, ItemChecklist, OrdenTrabajo,
    RespuestaChecklist,
)
from .repositories import (
    PlantillaRepository, ChecklistRepository, IncidenteRepository,
    OrdenTrabajoRepository,
)


class PlantillaService:
    """Alta y edición del formulario del checklist.

    El modelo decía desde el principio que estas categorías e ítems son
    datos y no código, para que Operaciones pudiera cambiarlos. Faltaba
    lo que hacía cierta esa frase: una forma de tocarlos sin entrar a la
    base.

    Un ítem no se borra si ya fue respondido alguna vez: eso reescribiría
    revisiones firmadas. Para sacarlo de circulación se desactiva, y
    entonces deja de pedirse en los checklists nuevos sin borrar los
    viejos.
    """

    # ── Categorías ──
    @staticmethod
    def get_categorias():
        return (CategoriaChecklist.objects
                .prefetch_related('items')
                .order_by('orden', 'id'))

    @staticmethod
    def crear_categoria(data: dict):
        nombre = (data.get('nombre') or '').strip()
        if not nombre:
            raise ValueError('La categoría necesita un nombre.')
        if CategoriaChecklist.objects.filter(nombre__iexact=nombre).exists():
            raise ValueError(f'Ya existe una categoría llamada "{nombre}".')

        return CategoriaChecklist.objects.create(
            nombre=nombre,
            orden=int(data.get('orden') or 0),
            activa=bool(data.get('activa', True)),
        )

    @staticmethod
    def actualizar_categoria(categoria_id: int, data: dict):
        categoria = CategoriaChecklist.objects.filter(id=categoria_id).first()
        if not categoria:
            raise ValueError('Categoría no encontrada')

        if 'nombre' in data:
            nombre = (data['nombre'] or '').strip()
            if not nombre:
                raise ValueError('La categoría necesita un nombre.')
            repetida = (CategoriaChecklist.objects
                        .filter(nombre__iexact=nombre)
                        .exclude(id=categoria_id).exists())
            if repetida:
                raise ValueError(f'Ya existe una categoría llamada "{nombre}".')
            categoria.nombre = nombre

        if 'orden' in data:
            categoria.orden = int(data['orden'] or 0)
        if 'activa' in data:
            categoria.activa = bool(data['activa'])

        categoria.save()
        return categoria

    @staticmethod
    def eliminar_categoria(categoria_id: int):
        categoria = CategoriaChecklist.objects.filter(id=categoria_id).first()
        if not categoria:
            raise ValueError('Categoría no encontrada')

        respondidos = RespuestaChecklist.objects.filter(
            item__categoria=categoria).exists()
        if respondidos:
            raise ValueError(
                f'"{categoria.nombre}" ya se usó en checklists hechos. '
                'Desactívala en vez de eliminarla: deja de pedirse y las '
                'revisiones anteriores quedan intactas.'
            )
        categoria.delete()

    # ── Ítems ──
    @staticmethod
    def crear_item(data: dict):
        categoria = CategoriaChecklist.objects.filter(
            id=data.get('categoria_id')).first()
        if not categoria:
            raise ValueError('Elige la categoría del ítem.')

        descripcion = (data.get('descripcion') or '').strip()
        if not descripcion:
            raise ValueError('El ítem necesita una descripción.')
        if ItemChecklist.objects.filter(
                categoria=categoria, descripcion__iexact=descripcion).exists():
            raise ValueError(
                f'"{categoria.nombre}" ya tiene un ítem con esa descripción.')

        return ItemChecklist.objects.create(
            categoria=categoria,
            descripcion=descripcion,
            orden=int(data.get('orden') or 0),
            critico=bool(data.get('critico', False)),
            activo=bool(data.get('activo', True)),
        )

    @staticmethod
    def actualizar_item(item_id: int, data: dict):
        item = PlantillaRepository.get_item_by_id(item_id)
        if not item:
            raise ValueError('Ítem no encontrado')

        if 'categoria_id' in data:
            categoria = CategoriaChecklist.objects.filter(
                id=data['categoria_id']).first()
            if not categoria:
                raise ValueError('Categoría no encontrada')
            item.categoria = categoria

        if 'descripcion' in data:
            descripcion = (data['descripcion'] or '').strip()
            if not descripcion:
                raise ValueError('El ítem necesita una descripción.')
            repetido = (ItemChecklist.objects
                        .filter(categoria=item.categoria,
                                descripcion__iexact=descripcion)
                        .exclude(id=item_id).exists())
            if repetido:
                raise ValueError(
                    f'"{item.categoria.nombre}" ya tiene un ítem con esa '
                    'descripción.')
            item.descripcion = descripcion

        if 'orden' in data:
            item.orden = int(data['orden'] or 0)
        if 'critico' in data:
            item.critico = bool(data['critico'])
        if 'activo' in data:
            item.activo = bool(data['activo'])

        item.save()
        return item

    @staticmethod
    def eliminar_item(item_id: int):
        item = PlantillaRepository.get_item_by_id(item_id)
        if not item:
            raise ValueError('Ítem no encontrado')

        if RespuestaChecklist.objects.filter(item=item).exists():
            raise ValueError(
                f'"{item.descripcion}" ya fue respondido en checklists hechos. '
                'Desactívalo en vez de eliminarlo: deja de pedirse y las '
                'revisiones anteriores quedan intactas.'
            )
        item.delete()


class ChecklistService:

    @staticmethod
    def get_plantilla():
        return PlantillaRepository.get_categorias_activas()

    @staticmethod
    def get_todos():
        return ChecklistRepository.get_todos()

    @staticmethod
    def get_by_id(checklist_id: int):
        checklist = ChecklistRepository.get_by_id(checklist_id)
        if not checklist:
            raise ValueError('Checklist no encontrado')
        return checklist

    @staticmethod
    def iniciar(bus_id: int, persona_id: int, momento: str, postura_id=None):
        """Abre un checklist en curso. No crea respuestas: se van
        registrando a medida que la tripulación responde."""
        try:
            bus = Bus.objects.get(id=bus_id)
        except Bus.DoesNotExist:
            raise ValueError('Bus no encontrado')

        try:
            persona = Persona.objects.get(id=persona_id)
        except Persona.DoesNotExist:
            raise ValueError('Persona no encontrada')

        postura = None
        if postura_id:
            try:
                postura = Postura.objects.get(id=postura_id)
            except Postura.DoesNotExist:
                raise ValueError('Postura no encontrada')

        if momento not in Checklist.Momento.values:
            raise ValueError('Momento inválido')

        return ChecklistRepository.create({
            'bus': bus,
            'reportado_por': persona,
            'postura': postura,
            'momento': momento,
        })

    @staticmethod
    def responder(checklist_id: int, item_id: int, estado: str, observacion: str = ''):
        checklist = ChecklistRepository.get_by_id(checklist_id)
        if not checklist:
            raise ValueError('Checklist no encontrado')

        if checklist.estado == Checklist.Estado.COMPLETADO:
            raise ValueError('El checklist ya fue completado y no admite cambios')

        item = PlantillaRepository.get_item_by_id(item_id)
        if not item:
            raise ValueError('Ítem no encontrado')

        if estado not in RespuestaChecklist.Estado.values:
            raise ValueError('Estado de respuesta inválido')

        # Una falla sin explicación no le sirve a nadie en el taller.
        if estado == RespuestaChecklist.Estado.FALLA and not observacion.strip():
            raise ValueError('Una falla requiere describir el problema')

        return ChecklistRepository.set_respuesta(checklist, item, estado, observacion)

    @staticmethod
    @transaction.atomic
    def completar(checklist_id: int):
        """Cierra el checklist y ejecuta la regla central del módulo:

        1. Exige que todos los ítems activos estén respondidos.
        2. Cada falla genera un incidente en la cola de Mantención.
        3. El estado del bus cambia según la gravedad de lo encontrado.

        Todo ocurre en una transacción: si algo falla, no queda un
        checklist cerrado sin sus incidentes ni un bus mal marcado.
        """
        checklist = ChecklistRepository.get_by_id(checklist_id)
        if not checklist:
            raise ValueError('Checklist no encontrado')

        if checklist.estado == Checklist.Estado.COMPLETADO:
            raise ValueError('El checklist ya fue completado')

        total_items = PlantillaRepository.get_items_activos().count()
        respondidos = checklist.respuestas.count()
        if respondidos < total_items:
            faltan = total_items - respondidos
            raise ValueError(
                f'Faltan {faltan} ítem(s) por responder de {total_items}'
            )

        fallas = list(ChecklistRepository.get_fallas(checklist))

        incidentes = []
        for falla in fallas:
            gravedad = (
                Incidente.Gravedad.ALTA if falla.item.critico
                else Incidente.Gravedad.MEDIA
            )
            incidentes.append(IncidenteRepository.create_con_codigo({
                'bus': checklist.bus,
                'postura': checklist.postura,
                'reportado_por': checklist.reportado_por,
                'descripcion': (
                    f'{falla.item.categoria.nombre} · {falla.item.descripcion}'
                    + (f' — {falla.observacion}' if falla.observacion else '')
                ),
                'gravedad': gravedad,
                'origen': Incidente.Origen.CHECKLIST,
                'checklist': checklist,
                'item': falla.item,
            }))

        # El estado del bus lo decide la falla más grave encontrada.
        hay_criticas = any(f.item.critico for f in fallas)
        if hay_criticas:
            checklist.bus.estado = Bus.Estado.FUERA_SERVICIO
            checklist.bus.save(update_fields=['estado'])
        elif fallas:
            checklist.bus.estado = Bus.Estado.MANTENIMIENTO
            checklist.bus.save(update_fields=['estado'])

        ChecklistRepository.update(checklist, {
            'estado': Checklist.Estado.COMPLETADO,
            'completado_en': timezone.now(),
        })

        return checklist, incidentes


class IncidenteService:

    @staticmethod
    def get_todos():
        return IncidenteRepository.get_todos()

    @staticmethod
    def get_abiertos():
        return IncidenteRepository.get_abiertos()

    @staticmethod
    @transaction.atomic
    def reportar_en_ruta(bus_id: int, persona_id: int, descripcion: str,
                         gravedad: str, postura_id=None):
        """Reporte directo desde el celular durante el viaje, sin checklist
        de por medio (README §2.2)."""
        if not descripcion or not descripcion.strip():
            raise ValueError('La descripción del incidente es obligatoria')

        if gravedad not in Incidente.Gravedad.values:
            raise ValueError('Gravedad inválida')

        try:
            bus = Bus.objects.get(id=bus_id)
        except Bus.DoesNotExist:
            raise ValueError('Bus no encontrado')

        try:
            persona = Persona.objects.get(id=persona_id)
        except Persona.DoesNotExist:
            raise ValueError('Persona no encontrada')

        postura = None
        if postura_id:
            try:
                postura = Postura.objects.get(id=postura_id)
            except Postura.DoesNotExist:
                raise ValueError('Postura no encontrada')

        incidente = IncidenteRepository.create_con_codigo({
            'bus': bus,
            'postura': postura,
            'reportado_por': persona,
            'descripcion': descripcion.strip(),
            'gravedad': gravedad,
            'origen': Incidente.Origen.RUTA,
        })

        # Una falla grave en ruta tumba el bus: Operaciones debe verlo de
        # inmediato para gestionar la corrida.
        if gravedad == Incidente.Gravedad.ALTA:
            bus.estado = Bus.Estado.FUERA_SERVICIO
            bus.save(update_fields=['estado'])

        return incidente

    @staticmethod
    def cambiar_estado(incidente_id: int, estado: str):
        incidente = IncidenteRepository.get_by_id(incidente_id)
        if not incidente:
            raise ValueError('Incidente no encontrado')

        if estado not in Incidente.Estado.values:
            raise ValueError('Estado inválido')

        return IncidenteRepository.update(incidente, {'estado': estado})


class TallerService:
    """Flujo del taller: bandeja de fallas → orden → asignación →
    reparación → liberación del bus (README §2.4)."""

    @staticmethod
    def get_ordenes():
        return OrdenTrabajoRepository.get_todas()

    @staticmethod
    def get_bandeja():
        return OrdenTrabajoRepository.incidentes_sin_orden()

    @staticmethod
    def get_mecanicos():
        return Persona.objects.filter(rol=Persona.Rol.MECANICO).order_by('nombre')

    @staticmethod
    @transaction.atomic
    def crear_desde_incidente(incidente_id: int, especialidad: str,
                              prioridad: str = None, tipo: str = None):
        incidente = IncidenteRepository.get_by_id(incidente_id)
        if not incidente:
            raise ValueError('Incidente no encontrado')

        if incidente.ordenes.exists():
            raise ValueError(f'{incidente.codigo} ya tiene una orden de trabajo')

        if especialidad not in OrdenTrabajo.Especialidad.values:
            raise ValueError('Especialidad inválida')

        # Si el jefe no fija prioridad, se hereda de la gravedad del
        # incidente: una falla alta no puede entrar como trabajo menor.
        if not prioridad:
            prioridad = {
                Incidente.Gravedad.ALTA: OrdenTrabajo.Prioridad.ALTA,
                Incidente.Gravedad.MEDIA: OrdenTrabajo.Prioridad.MEDIA,
                Incidente.Gravedad.BAJA: OrdenTrabajo.Prioridad.BAJA,
            }[incidente.gravedad]

        orden = OrdenTrabajoRepository.create_con_codigo({
            'incidente': incidente,
            'bus': incidente.bus,
            'descripcion': incidente.descripcion,
            'especialidad': especialidad,
            'tipo': tipo or OrdenTrabajo.Tipo.CORRECTIVO,
            'prioridad': prioridad,
        })

        # La falla deja de estar suelta: ya es trabajo en curso.
        IncidenteRepository.update(
            incidente, {'estado': Incidente.Estado.EN_REVISION}
        )
        return orden

    @staticmethod
    def crear_preventivo(bus_id: int, descripcion: str, especialidad: str,
                         prioridad: str = 'BAJA'):
        if not descripcion or not descripcion.strip():
            raise ValueError('La descripción del trabajo es obligatoria')

        if especialidad not in OrdenTrabajo.Especialidad.values:
            raise ValueError('Especialidad inválida')

        try:
            bus = Bus.objects.get(id=bus_id)
        except Bus.DoesNotExist:
            raise ValueError('Bus no encontrado')

        return OrdenTrabajoRepository.create_con_codigo({
            'bus': bus,
            'descripcion': descripcion.strip(),
            'especialidad': especialidad,
            'tipo': OrdenTrabajo.Tipo.PREVENTIVO,
            'prioridad': prioridad,
        })

    @staticmethod
    def asignar(orden_id: int, mecanico_id: int, pozo: str = ''):
        orden = OrdenTrabajoRepository.get_by_id(orden_id)
        if not orden:
            raise ValueError('Orden no encontrada')

        if orden.estado == OrdenTrabajo.Estado.COMPLETADO:
            raise ValueError('La orden ya está completada')

        try:
            mecanico = Persona.objects.get(id=mecanico_id)
        except Persona.DoesNotExist:
            raise ValueError('Mecánico no encontrado')

        if mecanico.rol != Persona.Rol.MECANICO:
            raise ValueError(f'{mecanico.nombre} no es mecánico')

        return OrdenTrabajoRepository.update(orden, {
            'mecanico': mecanico,
            'pozo': pozo,
            'estado': OrdenTrabajo.Estado.PENDIENTE,
        })

    @staticmethod
    def iniciar(orden_id: int):
        orden = OrdenTrabajoRepository.get_by_id(orden_id)
        if not orden:
            raise ValueError('Orden no encontrada')

        if not orden.mecanico:
            raise ValueError('No se puede iniciar un trabajo sin mecánico asignado')

        if orden.estado != OrdenTrabajo.Estado.PENDIENTE:
            raise ValueError('Solo se puede iniciar una orden pendiente')

        return OrdenTrabajoRepository.update(orden, {
            'estado': OrdenTrabajo.Estado.EN_PROCESO,
            'iniciado_en': timezone.now(),
        })

    @staticmethod
    @transaction.atomic
    def completar(orden_id: int, diagnostico: str = ''):
        """Cierra el trabajo y, si venía de un incidente, lo da por
        resuelto. El bus NO se libera aquí: liberarlo es una decisión
        explícita del jefe de mecánicos."""
        orden = OrdenTrabajoRepository.get_by_id(orden_id)
        if not orden:
            raise ValueError('Orden no encontrada')

        if orden.estado == OrdenTrabajo.Estado.COMPLETADO:
            raise ValueError('La orden ya está completada')

        if orden.estado != OrdenTrabajo.Estado.EN_PROCESO:
            raise ValueError('Solo se puede completar una orden en proceso')

        if not diagnostico or not diagnostico.strip():
            raise ValueError('Describe qué se hizo antes de cerrar la orden')

        OrdenTrabajoRepository.update(orden, {
            'estado': OrdenTrabajo.Estado.COMPLETADO,
            'diagnostico': diagnostico.strip(),
            'completado_en': timezone.now(),
        })

        if orden.incidente:
            IncidenteRepository.update(
                orden.incidente, {'estado': Incidente.Estado.RESUELTO}
            )

        return orden

    @staticmethod
    @transaction.atomic
    def liberar_bus(bus_id: int):
        """Devuelve el bus a la flota. Solo procede si no le queda ningún
        trabajo abierto: es la barrera que impide despachar un bus a
        medio reparar."""
        try:
            bus = Bus.objects.get(id=bus_id)
        except Bus.DoesNotExist:
            raise ValueError('Bus no encontrado')

        abiertas = OrdenTrabajoRepository.get_abiertas_de_bus(bus)
        if abiertas.exists():
            codigos = ', '.join(o.codigo for o in abiertas)
            raise ValueError(f'{bus.numero} tiene trabajo sin terminar: {codigos}')

        bus.estado = Bus.Estado.DISPONIBLE
        bus.save(update_fields=['estado'])
        return bus

    @staticmethod
    @transaction.atomic
    def marcar_no_operativo(bus_id: int, motivo: str):
        """El jefe determina que el bus no queda operativo. Operaciones lo
        ve caído de inmediato para gestionar la corrida (README §2.4)."""
        if not motivo or not motivo.strip():
            raise ValueError('Indica por qué el bus no queda operativo')

        try:
            bus = Bus.objects.get(id=bus_id)
        except Bus.DoesNotExist:
            raise ValueError('Bus no encontrado')

        bus.estado = Bus.Estado.FUERA_SERVICIO
        bus.save(update_fields=['estado'])
        return bus
