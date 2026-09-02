from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .services import ChecklistService, IncidenteService
from .serializers import (
    CategoriaChecklistSerializer, ChecklistSerializer,
    ChecklistResumenSerializer, IncidenteSerializer,
)


# ── PLANTILLA ────────────────────────────────────────────────
class PlantillaChecklistView(APIView):
    """Categorías e ítems que debe responder la tripulación."""

    def get(self, request):
        categorias = ChecklistService.get_plantilla()
        serializer = CategoriaChecklistSerializer(categorias, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ── CHECKLIST ────────────────────────────────────────────────
class ChecklistListCreateView(APIView):
    def get(self, request):
        checklists = ChecklistService.get_todos()

        estado = request.query_params.get('estado')
        if estado:
            checklists = checklists.filter(estado=estado)

        serializer = ChecklistResumenSerializer(checklists, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        try:
            checklist = ChecklistService.iniciar(
                bus_id=request.data.get('bus_id'),
                persona_id=request.data.get('persona_id'),
                momento=request.data.get('momento'),
                postura_id=request.data.get('postura_id'),
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(ChecklistSerializer(checklist).data,
                        status=status.HTTP_201_CREATED)


class ChecklistDetailView(APIView):
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
    def get(self, request):
        if request.query_params.get('abiertos') == 'true':
            incidentes = IncidenteService.get_abiertos()
        else:
            incidentes = IncidenteService.get_todos()

        serializer = IncidenteSerializer(incidentes, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        try:
            incidente = IncidenteService.reportar_en_ruta(
                bus_id=request.data.get('bus_id'),
                persona_id=request.data.get('persona_id'),
                descripcion=request.data.get('descripcion', ''),
                gravedad=request.data.get('gravedad', 'MEDIA'),
                postura_id=request.data.get('postura_id'),
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(IncidenteSerializer(incidente).data,
                        status=status.HTTP_201_CREATED)


class IncidenteEstadoView(APIView):
    def post(self, request, pk):
        try:
            incidente = IncidenteService.cambiar_estado(
                pk, request.data.get('estado')
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(IncidenteSerializer(incidente).data,
                        status=status.HTTP_200_OK)
