from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from core.permissions import (
    RolPermitido, SoloLecturaMonitoreo, OPERACIONES, TALLER, TODOS,
    persona_de, puede,
)

from flota.serializers import BusSerializer
from operaciones.serializers import PersonaSerializer

from .services import (
    ChecklistService, IncidenteService, PlantillaService, TallerService,
)
from .serializers import (
    CategoriaChecklistSerializer, CategoriaPlantillaSerializer,
    ChecklistSerializer, ChecklistResumenSerializer, IncidenteSerializer,
    ItemPlantillaSerializer, OrdenTrabajoSerializer,
)


# ── PLANTILLA ────────────────────────────────────────────────
class PlantillaChecklistView(APIView):
    """Categorías e ítems que debe responder la tripulación."""
    permission_classes = [SoloLecturaMonitoreo]
    roles_permitidos = TODOS

    def get(self, request):
        categorias = ChecklistService.get_plantilla()
        serializer = CategoriaChecklistSerializer(categorias, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ── CHECKLIST ────────────────────────────────────────────────
class ChecklistListCreateView(APIView):
    permission_classes = [SoloLecturaMonitoreo]
    roles_permitidos = TODOS
    def get(self, request):
        checklists = ChecklistService.get_todos()

        estado = request.query_params.get('estado')
        if estado:
            checklists = checklists.filter(estado=estado)

        serializer = ChecklistResumenSerializer(checklists, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        try:
            # La persona sale de la sesión: aceptar un persona_id del
            # cliente permitiría revisar en nombre de otro.
            checklist = ChecklistService.iniciar(
                bus_id=request.data.get('bus_id'),
                persona_id=persona_de(request).id,
                momento=request.data.get('momento'),
                postura_id=request.data.get('postura_id'),
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(ChecklistSerializer(checklist).data,
                        status=status.HTTP_201_CREATED)


class ChecklistDetailView(APIView):
    permission_classes = [SoloLecturaMonitoreo]
    roles_permitidos = TODOS
    def get(self, request, pk):
        try:
            checklist = ChecklistService.get_by_id(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        return Response(ChecklistSerializer(checklist).data,
                        status=status.HTTP_200_OK)


class ChecklistResponderView(APIView):
    """Registra la respuesta de un ítem. Idempotente: volver a enviar el
    mismo ítem corrige la respuesta en vez de duplicarla."""
    permission_classes = [SoloLecturaMonitoreo]
    roles_permitidos = TODOS

    def post(self, request, pk):
        try:
            ChecklistService.responder(
                checklist_id=pk,
                item_id=request.data.get('item_id'),
                estado=request.data.get('estado'),
                observacion=request.data.get('observacion', ''),
            )
            checklist = ChecklistService.get_by_id(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(ChecklistSerializer(checklist).data,
                        status=status.HTTP_200_OK)


class ChecklistCompletarView(APIView):
    """Cierra el checklist: genera los incidentes de cada falla y ajusta
    el estado del bus."""
    permission_classes = [SoloLecturaMonitoreo]
    roles_permitidos = TODOS

    def post(self, request, pk):
        try:
            checklist, incidentes = ChecklistService.completar(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'checklist': ChecklistSerializer(checklist).data,
            'incidentes_creados': IncidenteSerializer(incidentes, many=True).data,
            'bus_estado': checklist.bus.estado,
        }, status=status.HTTP_200_OK)


# ── INCIDENTES ───────────────────────────────────────────────
class IncidenteListCreateView(APIView):
    permission_classes = [SoloLecturaMonitoreo]
    roles_permitidos = TODOS
    def get(self, request):
        if request.query_params.get('abiertos') == 'true':
            incidentes = IncidenteService.get_abiertos()
        else:
            incidentes = IncidenteService.get_todos()

        serializer = IncidenteSerializer(incidentes, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        try:
            # Quien reporta es quien tiene la sesión abierta.
            incidente = IncidenteService.reportar_en_ruta(
                bus_id=request.data.get('bus_id'),
                persona_id=persona_de(request).id,
                descripcion=request.data.get('descripcion', ''),
                gravedad=request.data.get('gravedad', 'MEDIA'),
                postura_id=request.data.get('postura_id'),
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(IncidenteSerializer(incidente).data,
                        status=status.HTTP_201_CREATED)


class IncidenteEstadoView(APIView):
    permission_classes = [SoloLecturaMonitoreo]
    roles_permitidos = TODOS
    def post(self, request, pk):
        try:
            incidente = IncidenteService.cambiar_estado(
                pk, request.data.get('estado')
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(IncidenteSerializer(incidente).data,
                        status=status.HTTP_200_OK)


# ── TALLER ───────────────────────────────────────────────────
class TableroView(APIView):
    """Todo lo que el jefe de mecánicos necesita en una sola llamada:
    la bandeja de fallas sin triar, el kanban de órdenes y los mecánicos
    disponibles para asignar."""
    permission_classes = [RolPermitido]
    roles_permitidos = TALLER

    def get(self, request):
        return Response({
            'bandeja': IncidenteSerializer(TallerService.get_bandeja(), many=True).data,
            'ordenes': OrdenTrabajoSerializer(TallerService.get_ordenes(), many=True).data,
            'mecanicos': PersonaSerializer(TallerService.get_mecanicos(), many=True).data,
        }, status=status.HTTP_200_OK)


class OrdenListCreateView(APIView):
    permission_classes = [RolPermitido]
    roles_permitidos = TALLER
    def get(self, request):
        ordenes = TallerService.get_ordenes()
        estado = request.query_params.get('estado')
        if estado:
            ordenes = ordenes.filter(estado=estado)
        return Response(OrdenTrabajoSerializer(ordenes, many=True).data,
                        status=status.HTTP_200_OK)

    def post(self, request):
        """Crea una orden desde un incidente, o un preventivo si no viene
        `incidente_id`."""
        incidente_id = request.data.get('incidente_id')
        try:
            if incidente_id:
                orden = TallerService.crear_desde_incidente(
                    incidente_id=incidente_id,
                    especialidad=request.data.get('especialidad'),
                    prioridad=request.data.get('prioridad'),
                    tipo=request.data.get('tipo'),
                )
            else:
                orden = TallerService.crear_preventivo(
                    bus_id=request.data.get('bus_id'),
                    descripcion=request.data.get('descripcion', ''),
                    especialidad=request.data.get('especialidad'),
                    prioridad=request.data.get('prioridad', 'BAJA'),
                )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(OrdenTrabajoSerializer(orden).data,
                        status=status.HTTP_201_CREATED)


class OrdenAsignarView(APIView):
    permission_classes = [RolPermitido]
    roles_permitidos = TALLER
    def post(self, request, pk):
        try:
            orden = TallerService.asignar(
                pk,
                request.data.get('mecanico_id'),
                request.data.get('pozo', ''),
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(OrdenTrabajoSerializer(orden).data, status=status.HTTP_200_OK)


class OrdenIniciarView(APIView):
    permission_classes = [RolPermitido]
    roles_permitidos = TALLER
    def post(self, request, pk):
        try:
            orden = TallerService.iniciar(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(OrdenTrabajoSerializer(orden).data, status=status.HTTP_200_OK)


class OrdenCompletarView(APIView):
    permission_classes = [RolPermitido]
    roles_permitidos = TALLER
    def post(self, request, pk):
        try:
            orden = TallerService.completar(pk, request.data.get('diagnostico', ''))
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(OrdenTrabajoSerializer(orden).data, status=status.HTTP_200_OK)


class BusLiberarView(APIView):
    """Devuelve el bus a la flota. Falla si le queda trabajo abierto."""
    permission_classes = [RolPermitido]
    roles_permitidos = TALLER

    def post(self, request, pk):
        try:
            bus = TallerService.liberar_bus(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(BusSerializer(bus).data, status=status.HTTP_200_OK)


class BusNoOperativoView(APIView):
    permission_classes = [RolPermitido]
    roles_permitidos = TALLER
    def post(self, request, pk):
        try:
            bus = TallerService.marcar_no_operativo(pk, request.data.get('motivo', ''))
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(BusSerializer(bus).data, status=status.HTTP_200_OK)


# ── PLANTILLA: EDICIÓN ───────────────────────────────────────
# Quien define qué se revisa antes de salir es Operaciones, no el
# taller: es una decisión de procedimiento, no de mantenimiento.
EDITA_PLANTILLA = OPERACIONES
_SOLO_OPERACIONES = 'Solo Operaciones define qué se revisa en el checklist.'


class PlantillaEditarView(APIView):
    """Categorías del checklist, incluidas las desactivadas."""
    permission_classes = [SoloLecturaMonitoreo]
    roles_permitidos = TODOS

    def get(self, request):
        return Response(
            CategoriaPlantillaSerializer(
                PlantillaService.get_categorias(), many=True).data,
            status=status.HTTP_200_OK)

    def post(self, request):
        if not puede(persona_de(request), EDITA_PLANTILLA):
            return Response({'error': _SOLO_OPERACIONES},
                            status=status.HTTP_403_FORBIDDEN)
        try:
            categoria = PlantillaService.crear_categoria(request.data)
        except (ValueError, TypeError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CategoriaPlantillaSerializer(categoria).data,
                        status=status.HTTP_201_CREATED)


class PlantillaCategoriaView(APIView):
    permission_classes = [RolPermitido]
    roles_permitidos = EDITA_PLANTILLA

    def put(self, request, pk):
        try:
            categoria = PlantillaService.actualizar_categoria(pk, request.data)
        except (ValueError, TypeError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CategoriaPlantillaSerializer(categoria).data,
                        status=status.HTTP_200_OK)

    def delete(self, request, pk):
        try:
            PlantillaService.eliminar_categoria(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PlantillaItemCreateView(APIView):
    permission_classes = [RolPermitido]
    roles_permitidos = EDITA_PLANTILLA

    def post(self, request):
        try:
            item = PlantillaService.crear_item(request.data)
        except (ValueError, TypeError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ItemPlantillaSerializer(item).data,
                        status=status.HTTP_201_CREATED)


class PlantillaItemView(APIView):
    permission_classes = [RolPermitido]
    roles_permitidos = EDITA_PLANTILLA

    def put(self, request, pk):
        try:
            item = PlantillaService.actualizar_item(pk, request.data)
        except (ValueError, TypeError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ItemPlantillaSerializer(item).data,
                        status=status.HTTP_200_OK)

    def delete(self, request, pk):
        try:
            PlantillaService.eliminar_item(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)

