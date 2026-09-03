from datetime import datetime

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import OPERACIONES, RolPermitido, TienePersona, persona_de
from mantencion.serializers import ChecklistResumenSerializer, OrdenTrabajoSerializer
from operaciones.serializers import PosturaResumenSerializer

from .services import DashboardService, IndicadoresService


class DashboardView(APIView):
    """Tablero de inicio, distinto para cada perfil.

    Abierto a todos los que tengan cuenta: no hay nada que decidir
    aquí, solo el resumen de lo que a cada uno le toca.
    """
    permission_classes = [TienePersona]

    def get(self, request):
        datos = DashboardService.para(persona_de(request))

        # El servicio devuelve objetos del dominio y no diccionarios,
        # para no quedar atado a una sola representación. La traducción
        # a JSON ocurre aquí, reutilizando los serializadores que ya
        # usan las otras pantallas: así una postura se ve igual en el
        # dashboard que en planificación.
        if 'proximas' in datos:
            datos['proximas'] = PosturaResumenSerializer(
                datos['proximas'], many=True).data
        if 'ordenes' in datos:
            datos['ordenes'] = OrdenTrabajoSerializer(
                datos['ordenes'], many=True).data
        if datos.get('checklist_pendiente'):
            datos['checklist_pendiente'] = ChecklistResumenSerializer(
                datos['checklist_pendiente']).data

        return Response(datos, status=status.HTTP_200_OK)


class IndicadoresView(APIView):
    """Métricas del período para la pantalla de Auditoría."""
    permission_classes = [RolPermitido]
    roles_permitidos = OPERACIONES

    def get(self, request):
        desde_def, hasta_def = IndicadoresService.rango_por_defecto()
        try:
            desde = _fecha(request.query_params.get('desde'), desde_def)
            hasta = _fecha(request.query_params.get('hasta'), hasta_def)
        except ValueError:
            return Response(
                {'error': 'Las fechas se envían como AAAA-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST)

        if desde > hasta:
            return Response(
                {'error': 'La fecha inicial es posterior a la final.'},
                status=status.HTTP_400_BAD_REQUEST)

        return Response(IndicadoresService.resumen(desde, hasta),
                        status=status.HTTP_200_OK)


def _fecha(valor, por_defecto):
    if not valor:
        return por_defecto
    return datetime.strptime(valor, '%Y-%m-%d').date()
