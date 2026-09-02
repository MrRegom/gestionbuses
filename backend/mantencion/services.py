from django.db import transaction
from django.utils import timezone

from flota.models import Bus
from operaciones.models import Persona, Postura

from .models import Checklist, RespuestaChecklist, Incidente
from .repositories import (
    PlantillaRepository, ChecklistRepository, IncidenteRepository,
)


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
            incidentes.append(IncidenteRepository.create({
                'codigo': IncidenteRepository.siguiente_codigo(),
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

        incidente = IncidenteRepository.create({
            'codigo': IncidenteRepository.siguiente_codigo(),
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
