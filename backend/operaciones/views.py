from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from core.permissions import EscrituraPorRol, SoloLecturaMonitoreo, OPERACIONES

from .services import TripulacionService
from .serializers import PersonaSerializer

class TripulacionListView(APIView):
    def get(self, request):
        personas = TripulacionService.get_todas_personas()
        serializer = PersonaSerializer(personas, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class ConductoresListView(APIView):
    def get(self, request):
        conductores = TripulacionService.get_conductores()
        serializer = PersonaSerializer(conductores, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

from .services import PlanificacionService
from .serializers import RutaSerializer, PosturaSerializer

class RutaListView(APIView):
    def get(self, request):
        rutas = PlanificacionService.get_todas_rutas()
        serializer = RutaSerializer(rutas, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class PosturaListCreateView(APIView):
    # La tripulación consulta posturas para su checklist; crearlas es
    # atribución del jefe de operaciones.
    permission_classes = [EscrituraPorRol]
    roles_permitidos = OPERACIONES
    def get(self, request):
        posturas = PlanificacionService.get_todas_posturas()
        serializer = PosturaSerializer(posturas, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = PosturaSerializer(data=request.data)
        if serializer.is_valid():
            postura = PlanificacionService.create_postura(serializer.validated_data)
            return Response(PosturaSerializer(postura).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PosturaDetailView(APIView):
    permission_classes = [SoloLecturaMonitoreo]
    roles_permitidos = OPERACIONES
    def put(self, request, pk):
        try:
            postura = PlanificacionService.update_postura(pk, request.data)
            return Response(PosturaSerializer(postura).data, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, pk):
        try:
            PlanificacionService.delete_postura(pk)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

class AsignarTripulacionView(APIView):
    permission_classes = [SoloLecturaMonitoreo]
    roles_permitidos = OPERACIONES
    def post(self, request, pk):
        persona_id = request.data.get('persona_id')
        rol = request.data.get('rol_en_viaje')
        try:
            PlanificacionService.asignar_tripulacion(pk, persona_id, rol)
            # Retornar la postura actualizada
            postura = PlanificacionService.get_todas_posturas().get(id=pk)
            return Response(PosturaSerializer(postura).data, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
