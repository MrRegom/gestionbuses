from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from core.permissions import EscrituraPorRol, OPERACIONES, TALLER

from .services import BusService
from .serializers import BusSerializer


class BusListView(APIView):
    """Listado y alta de buses.

    Todo el personal puede consultar la flota —la tripulación necesita
    elegir su bus en el checklist—, pero darlos de alta es atribución de
    Operaciones y del taller.
    """
    permission_classes = [EscrituraPorRol]
    roles_permitidos = OPERACIONES | TALLER

    def get(self, request):
        buses = BusService.get_all_buses()
        return Response(BusSerializer(buses, many=True).data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = BusSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            bus = BusService.crear_bus(serializer.validated_data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(BusSerializer(bus).data, status=status.HTTP_201_CREATED)


class BusDetailView(APIView):
    """Detalle, edición y baja de un bus."""
    permission_classes = [EscrituraPorRol]
    roles_permitidos = OPERACIONES | TALLER

    def get(self, request, pk):
        try:
            bus = BusService.get_bus_detail(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        return Response(BusSerializer(bus).data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        try:
            bus = BusService.get_bus_detail(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        serializer = BusSerializer(bus, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            bus = BusService.actualizar_bus(pk, serializer.validated_data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(BusSerializer(bus).data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        try:
            BusService.eliminar_bus(pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class BusUpdateEstadoView(APIView):
    """Cambio puntual de estado, con las reglas del negocio."""
    permission_classes = [EscrituraPorRol]
    roles_permitidos = OPERACIONES | TALLER

    def post(self, request, pk):
        nuevo_estado = request.data.get('estado')
        if not nuevo_estado:
            return Response({'error': 'Falta el estado'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            bus = BusService.update_estado_bus(pk, nuevo_estado)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(BusSerializer(bus).data, status=status.HTTP_200_OK)
