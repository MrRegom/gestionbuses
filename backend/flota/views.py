from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .services import BusService
from .serializers import BusSerializer

class BusListView(APIView):
    """
    Controlador para listar buses.
    """
    def get(self, request):
        buses = BusService.get_all_buses()
        serializer = BusSerializer(buses, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class BusDetailView(APIView):
    """
    Controlador para detalle de bus.
    """
    def get(self, request, pk):
        try:
            bus = BusService.get_bus_detail(pk)
            serializer = BusSerializer(bus)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

class BusUpdateEstadoView(APIView):
    """
    Controlador para cambiar el estado de un bus.
    """
    def post(self, request, pk):
        nuevo_estado = request.data.get('estado')
        if not nuevo_estado:
            return Response({'error': 'Falta el estado'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            bus = BusService.update_estado_bus(pk, nuevo_estado)
            serializer = BusSerializer(bus)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
