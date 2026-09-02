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
    def siguiente_codigo():
        """Correlativo INC-001. Se llama dentro de una transacción, así que
        dos checklists cerrados a la vez no pueden tomar el mismo número."""
        ultimo = Incidente.objects.order_by('-id').first()
        numero = (ultimo.id + 1) if ultimo else 1
        return f'INC-{numero:03d}'
