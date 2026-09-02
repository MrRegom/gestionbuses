from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from core.permissions import EscrituraPorRol, SoloLecturaMonitoreo, OPERACIONES
from flota.serializers import BusSerializer

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
            postura = PlanificacionService.get_postura(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        # Pasa por el serializer para que corran las validaciones del
        # modelo: escribir directo con setattr las saltaba y permitía
        # guardar un código fuera de formato al editar.
        serializer = PosturaSerializer(postura, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            postura = PlanificacionService.update_postura(pk, serializer.validated_data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PosturaSerializer(postura).data, status=status.HTTP_200_OK)

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


# ── PERSONAL ─────────────────────────────────────────────────
from .services import PersonalService, CatalogoService  # noqa: E402
from .serializers import CiudadSerializer  # noqa: E402


class PersonalCreateView(APIView):
    """Alta de personal."""
    permission_classes = [EscrituraPorRol]
    roles_permitidos = OPERACIONES

    def post(self, request):
        serializer = PersonaSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            persona = PersonalService.crear(serializer.validated_data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PersonaSerializer(persona).data, status=status.HTTP_201_CREATED)


class PersonalDetailView(APIView):
    """Edición y baja de una persona."""
    permission_classes = [EscrituraPorRol]
    roles_permitidos = OPERACIONES

    def put(self, request, pk):
        try:
            persona = PersonalService.actualizar(pk, request.data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PersonaSerializer(persona).data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        try:
            PersonalService.eliminar(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── CATÁLOGO: CIUDADES Y RUTAS ───────────────────────────────
class CiudadListCreateView(APIView):
    permission_classes = [EscrituraPorRol]
    roles_permitidos = OPERACIONES

    def get(self, request):
        return Response(CiudadSerializer(CatalogoService.get_ciudades(), many=True).data,
                        status=status.HTTP_200_OK)

    def post(self, request):
        serializer = CiudadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        ciudad = CatalogoService.crear_ciudad(serializer.validated_data)
        return Response(CiudadSerializer(ciudad).data, status=status.HTTP_201_CREATED)


class RutaCreateView(APIView):
    permission_classes = [EscrituraPorRol]
    roles_permitidos = OPERACIONES

    def post(self, request):
        serializer = RutaSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            ruta = CatalogoService.crear_ruta(serializer.validated_data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(RutaSerializer(ruta).data, status=status.HTTP_201_CREATED)


class RutaDetailView(APIView):
    permission_classes = [EscrituraPorRol]
    roles_permitidos = OPERACIONES

    def delete(self, request, pk):
        try:
            CatalogoService.eliminar_ruta(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── POSTURA: BUS, TRIPULACIÓN Y DISPONIBILIDAD ───────────────
class PosturaBusView(APIView):
    """Asigna o libera el bus de una postura."""
    permission_classes = [SoloLecturaMonitoreo]
    roles_permitidos = OPERACIONES

    def post(self, request, pk):
        try:
            PlanificacionService.asignar_bus(pk, request.data.get('bus_id'))
            postura = PlanificacionService.get_todas_posturas().get(id=pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PosturaSerializer(postura).data, status=status.HTTP_200_OK)


class DesasignarTripulacionView(APIView):
    """Quita a una persona de la postura."""
    permission_classes = [SoloLecturaMonitoreo]
    roles_permitidos = OPERACIONES

    def delete(self, request, pk):
        try:
            PlanificacionService.desasignar_tripulacion(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PersonalDisponibleView(APIView):
    """Personal apto para una postura, con el motivo de quien no lo está."""
    permission_classes = [EscrituraPorRol]
    roles_permitidos = OPERACIONES

    def get(self, request, pk):
        try:
            filas = PlanificacionService.personal_disponible(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        return Response([
            {
                'persona': PersonaSerializer(f['persona']).data,
                'disponible': f['disponible'],
                'motivo': f['motivo'],
            }
            for f in filas
        ], status=status.HTTP_200_OK)


# ── CORRIDAS ─────────────────────────────────────────────────
from core.permissions import persona_de  # noqa: E402
from .services import CorridaService  # noqa: E402
from .serializers import CorridaSerializer, PosturaResumenSerializer  # noqa: E402


class CorridaTableroView(APIView):
    """Todo lo que Operaciones necesita para gestionar una corrida:
    buses caídos con sus servicios comprometidos, y el historial."""
    permission_classes = [EscrituraPorRol]
    roles_permitidos = OPERACIONES

    def get(self, request):
        caidos = [
            {
                'bus': BusSerializer(fila['bus']).data,
                'posturas': PosturaResumenSerializer(fila['posturas'], many=True).data,
            }
            for fila in CorridaService.buses_caidos()
        ]
        return Response({
            'caidos': caidos,
            'corridas': CorridaSerializer(CorridaService.get_todas(), many=True).data,
        }, status=status.HTTP_200_OK)


class SustitutosView(APIView):
    """Buses capaces de cubrir todas las posturas indicadas."""
    permission_classes = [EscrituraPorRol]
    roles_permitidos = OPERACIONES

    def get(self, request):
        ids = [i for i in request.query_params.get('posturas', '').split(',') if i]
        buses = CorridaService.sustitutos_posibles(ids)
        return Response(BusSerializer(buses, many=True).data, status=status.HTTP_200_OK)


class CorridaCreateView(APIView):
    permission_classes = [SoloLecturaMonitoreo]
    roles_permitidos = OPERACIONES

    def post(self, request):
        try:
            corrida = CorridaService.crear(
                bus_original_id=request.data.get('bus_original_id'),
                bus_sustituto_id=request.data.get('bus_sustituto_id'),
                motivo=request.data.get('motivo', ''),
                persona=persona_de(request),
                postura_ids=request.data.get('postura_ids'),
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CorridaSerializer(corrida).data, status=status.HTTP_201_CREATED)


class CorridaCerrarView(APIView):
    permission_classes = [SoloLecturaMonitoreo]
    roles_permitidos = OPERACIONES

    def post(self, request, pk):
        try:
            corrida = CorridaService.cerrar(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CorridaSerializer(corrida).data, status=status.HTTP_200_OK)
