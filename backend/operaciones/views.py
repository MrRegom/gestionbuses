from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from core.permissions import (
    EscrituraPorRol, SoloLecturaMonitoreo, OPERACIONES, TODOS,
    persona_de, puede,
)
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
from .serializers import RutaSerializer, PosturaSerializer, PosturaResumenSerializer

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

    def get(self, request, pk):
        """Una postura con su tripulación y su dotación.

        Faltaba: se podía editar y borrar una postura pero no
        consultarla, y pedirla devolvía 405.
        """
        try:
            postura = PlanificacionService.get_postura(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        return Response(PosturaSerializer(postura).data, status=status.HTTP_200_OK)

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
from .services import (  # noqa: E402
    PersonalService, CatalogoService, ParametrosService, TurnoService,
)
from .serializers import (  # noqa: E402
    CiudadSerializer, ParametrosSerializer, CicloTurnoSerializer,
    TurnoSerializer,
)


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

    def put(self, request, pk):
        serializer = RutaSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            ruta = CatalogoService.actualizar_ruta(pk, serializer.validated_data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(RutaSerializer(ruta).data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        try:
            CatalogoService.eliminar_ruta(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CiudadDetailView(APIView):
    permission_classes = [EscrituraPorRol]
    roles_permitidos = OPERACIONES

    def delete(self, request, pk):
        try:
            CatalogoService.eliminar_ciudad(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PosturasParaPersonaView(APIView):
    """Servicios que esta persona puede tomar, y por qué no los otros."""
    permission_classes = [EscrituraPorRol]
    roles_permitidos = OPERACIONES

    def get(self, request, pk):
        try:
            filas = PlanificacionService.posturas_para_persona(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        return Response([
            {
                'postura': PosturaResumenSerializer(f['postura']).data,
                'disponible': f['disponible'],
                'motivo': f['motivo'],
                'puesto': f['puesto'],
            }
            for f in filas
        ], status=status.HTTP_200_OK)


class ParametrosView(APIView):
    """Las reglas del negocio: dotación por servicio y tope de horas.

    Cualquiera con cuenta puede leerlas —la interfaz las necesita para
    saber contra qué medir— pero solo Operaciones las cambia, y la Sala
    de Monitoreo tampoco, que es de solo lectura.
    """
    permission_classes = [SoloLecturaMonitoreo]
    roles_permitidos = TODOS

    def get(self, request):
        return Response(ParametrosSerializer(ParametrosService.actuales()).data,
                        status=status.HTTP_200_OK)

    def put(self, request):
        persona = persona_de(request)
        if not puede(persona, OPERACIONES):
            return Response(
                {'error': 'Solo Operaciones puede cambiar las reglas del sistema.'},
                status=status.HTTP_403_FORBIDDEN)
        try:
            parametros = ParametrosService.actualizar(request.data, persona)
        except (ValueError, TypeError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ParametrosSerializer(parametros).data,
                        status=status.HTTP_200_OK)


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
            postura = PlanificacionService.get_postura(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        # Se acompaña de la dotación para que la interfaz sepa qué rol
        # ofrecer y cuándo dejar de ofrecerlo.
        return Response({
            'dotacion': postura.dotacion(),
            'faltantes': postura.faltantes(),
            'personal': [
                {
                    'persona': PersonaSerializer(f['persona']).data,
                    'disponible': f['disponible'],
                    'motivo': f['motivo'],
                }
                for f in filas
            ],
        }, status=status.HTTP_200_OK)


# ── CORRIDAS ─────────────────────────────────────────────────
from .services import CorridaService  # noqa: E402
from .serializers import CorridaSerializer  # noqa: E402


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


class CadenaCorridaView(APIView):
    """La cascada que habría que hacer para cubrir un servicio caído.

    Reemplaza a la búsqueda de un bus de reserva: Operaciones no tiene
    máquinas de sobra, adelanta la fila.
    """
    permission_classes = [EscrituraPorRol]
    roles_permitidos = OPERACIONES

    def get(self, request, pk):
        try:
            cadena = CorridaService.cadena_propuesta(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        return Response([
            {
                'orden': i,
                'postura': PosturaResumenSerializer(paso['postura']).data,
                'bus_saliente': (BusSerializer(paso['bus_saliente']).data
                                 if paso['bus_saliente'] else None),
                'bus_entrante': (BusSerializer(paso['bus_entrante']).data
                                 if paso['bus_entrante'] else None),
            }
            for i, paso in enumerate(cadena)
        ], status=status.HTTP_200_OK)


class CorridaCreateView(APIView):
    permission_classes = [SoloLecturaMonitoreo]
    roles_permitidos = OPERACIONES

    def post(self, request):
        try:
            corrida = CorridaService.crear(
                bus_original_id=request.data.get('bus_original_id'),
                postura_id=request.data.get('postura_id'),
                motivo=request.data.get('motivo', ''),
                persona=persona_de(request),
                hasta=request.data.get('hasta'),
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CorridaSerializer(corrida).data, status=status.HTTP_201_CREATED)


class CorridaCerrarView(APIView):
    permission_classes = [SoloLecturaMonitoreo]
    roles_permitidos = OPERACIONES

    def post(self, request, pk):
        try:
            corrida = CorridaService.cerrar(pk, request.data.get('bus_id'))
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CorridaSerializer(corrida).data, status=status.HTTP_200_OK)


# ── TURNOS ───────────────────────────────────────────────────
# Primer paso del flujo que describió Operaciones: turnos, luego
# disponibilidad, y recién ahí la asignación a una postura.
class CicloTurnoListCreateView(APIView):
    """Los patrones de trabajo: 10x4, 14x7, los que hagan falta."""
    permission_classes = [EscrituraPorRol]
    roles_permitidos = OPERACIONES

    def get(self, request):
        return Response(
            CicloTurnoSerializer(TurnoService.get_ciclos(), many=True).data,
            status=status.HTTP_200_OK)

    def post(self, request):
        try:
            ciclo = TurnoService.crear_ciclo(request.data)
        except (ValueError, TypeError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CicloTurnoSerializer(ciclo).data,
                        status=status.HTTP_201_CREATED)


class CicloTurnoDetailView(APIView):
    permission_classes = [EscrituraPorRol]
    roles_permitidos = OPERACIONES

    def put(self, request, pk):
        try:
            ciclo = TurnoService.actualizar_ciclo(pk, request.data)
        except (ValueError, TypeError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CicloTurnoSerializer(ciclo).data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        try:
            TurnoService.eliminar_ciclo(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class TurnoPersonaView(APIView):
    """El ciclo de una persona y desde qué día le corre."""
    permission_classes = [SoloLecturaMonitoreo]
    roles_permitidos = OPERACIONES

    def put(self, request, pk):
        try:
            turno = TurnoService.asignar(
                persona_id=pk,
                ciclo_id=request.data.get('ciclo_id'),
                inicio=request.data.get('inicio'),
            )
        except (ValueError, TypeError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        if turno is None:
            return Response({'turno': None}, status=status.HTTP_200_OK)
        return Response(TurnoSerializer(turno).data, status=status.HTTP_200_OK)


class DotacionDelDiaView(APIView):
    """Quién trabaja y quién descansa. Reemplaza la planilla Excel con
    la que hoy se contesta esta pregunta."""
    permission_classes = [EscrituraPorRol]
    roles_permitidos = OPERACIONES

    def get(self, request):
        from datetime import datetime

        fecha = request.query_params.get('fecha')
        try:
            fecha = (datetime.strptime(fecha, '%Y-%m-%d').date()
                     if fecha else None)
        except ValueError:
            return Response({'error': 'La fecha se envía como AAAA-MM-DD.'},
                            status=status.HTTP_400_BAD_REQUEST)

        filas = TurnoService.dotacion_del_dia(fecha)
        return Response({
            'trabajan': sum(1 for f in filas if f['trabaja']),
            'descansan': sum(1 for f in filas if not f['trabaja']),
            'sin_ciclo': sum(1 for f in filas if f['ciclo'] is None),
            'personal': [
                {
                    'persona': PersonaSerializer(f['persona']).data,
                    'trabaja': f['trabaja'],
                    'motivo': f['motivo'],
                    'ciclo': f['ciclo'],
                    'dia_del_ciclo': f['dia_del_ciclo'],
                }
                for f in filas
            ],
        }, status=status.HTTP_200_OK)
