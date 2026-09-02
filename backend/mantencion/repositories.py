from .models import (
    CategoriaChecklist, ItemChecklist, Checklist, RespuestaChecklist, Incidente,
)


class PlantillaRepository:
    """Categorías e ítems que componen el formulario del checklist."""

    @staticmethod
    def get_categorias_activas():
        return (
            CategoriaChecklist.objects
            .filter(activa=True)
            .prefetch_related('items')
        )

    @staticmethod
    def get_items_activos():
        return ItemChecklist.objects.filter(
            activo=True, categoria__activa=True
        ).select_related('categoria')

    @staticmethod
    def get_item_by_id(item_id: int):
        try:
            return ItemChecklist.objects.select_related('categoria').get(id=item_id)
        except ItemChecklist.DoesNotExist:
            return None


class ChecklistRepository:
    @staticmethod
    def get_todos():
        return (
            Checklist.objects
            .select_related('bus', 'reportado_por', 'postura', 'postura__ruta')
            .prefetch_related('respuestas__item__categoria')
        )

    @staticmethod
    def get_by_id(checklist_id: int):
        try:
            return (
                Checklist.objects
                .select_related('bus', 'reportado_por', 'postura')
                .prefetch_related('respuestas__item__categoria')
                .get(id=checklist_id)
            )
        except Checklist.DoesNotExist:
            return None

    @staticmethod
    def create(data: dict):
        return Checklist.objects.create(**data)

    @staticmethod
    def update(checklist: Checklist, data: dict):
        for field, value in data.items():
            setattr(checklist, field, value)
        checklist.save()
        return checklist

    @staticmethod
    def set_respuesta(checklist: Checklist, item: ItemChecklist,
                      estado: str, observacion: str = ''):
        """Responder un ítem es idempotente: repetirlo corrige la respuesta
        anterior en vez de duplicarla."""
        respuesta, _ = RespuestaChecklist.objects.update_or_create(
            checklist=checklist, item=item,
            defaults={'estado': estado, 'observacion': observacion},
        )
        return respuesta

    @staticmethod
    def get_fallas(checklist: Checklist):
        return (
            checklist.respuestas
            .filter(estado=RespuestaChecklist.Estado.FALLA)
            .select_related('item', 'item__categoria')
        )


class IncidenteRepository:
    @staticmethod
    def get_todos():
        return (
            Incidente.objects
            .select_related('bus', 'reportado_por', 'postura', 'item', 'checklist')
        )

    @staticmethod
    def get_abiertos():
        return IncidenteRepository.get_todos().filter(
            estado__in=[Incidente.Estado.ABIERTO, Incidente.Estado.EN_REVISION]
        )

    @staticmethod
    def get_by_id(incidente_id: int):
        try:
            return (
                Incidente.objects
                .select_related('bus', 'reportado_por', 'postura', 'item')
                .get(id=incidente_id)
            )
        except Incidente.DoesNotExist:
            return None

    @staticmethod
    def create(data: dict):
        return Incidente.objects.create(**data)

    @staticmethod
    def update(incidente: Incidente, data: dict):
        for field, value in data.items():
            setattr(incidente, field, value)
        incidente.save()
        return incidente

    @staticmethod
    def create_con_codigo(data: dict):
        """Crea el incidente y le estampa el código a partir de su propio id.

        Derivarlo del id ya asignado, en vez de calcular max(id)+1 antes del
        INSERT, elimina la carrera entre dos peticiones simultáneas.
        """
        incidente = Incidente.objects.create(**data)
        incidente.codigo = f'INC-{incidente.pk:03d}'
        incidente.save(update_fields=['codigo'])
        return incidente


class OrdenTrabajoRepository:
    @staticmethod
    def get_todas():
        from .models import OrdenTrabajo
        return (
            OrdenTrabajo.objects
            .select_related('bus', 'mecanico', 'incidente')
        )

    @staticmethod
    def get_by_id(orden_id: int):
        from .models import OrdenTrabajo
        try:
            return (
                OrdenTrabajo.objects
                .select_related('bus', 'mecanico', 'incidente')
                .get(id=orden_id)
            )
        except OrdenTrabajo.DoesNotExist:
            return None

    @staticmethod
    def get_abiertas_de_bus(bus):
        from .models import OrdenTrabajo
        return OrdenTrabajo.objects.filter(bus=bus).exclude(
            estado=OrdenTrabajo.Estado.COMPLETADO
        )

    @staticmethod
    def create(data: dict):
        from .models import OrdenTrabajo
        return OrdenTrabajo.objects.create(**data)

    @staticmethod
    def update(orden, data: dict):
        for field, value in data.items():
            setattr(orden, field, value)
        orden.save()
        return orden

    @staticmethod
    def create_con_codigo(data: dict):
        """Misma estrategia que en Incidente: el código sale del id ya
        asignado, no de un max(id)+1 leído antes del INSERT."""
        from .models import OrdenTrabajo
        orden = OrdenTrabajo.objects.create(**data)
        orden.codigo = f'OT-{orden.pk:03d}'
        orden.save(update_fields=['codigo'])
        return orden

    @staticmethod
    def incidentes_sin_orden():
        """Bandeja del jefe de mecánicos: fallas que aún no se han
        convertido en trabajo."""
        from .models import Incidente
        return (
            Incidente.objects
            .filter(estado__in=[Incidente.Estado.ABIERTO, Incidente.Estado.EN_REVISION])
            .filter(ordenes__isnull=True)
            .select_related('bus', 'reportado_por')
        )
