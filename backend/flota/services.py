from .repositories import BusRepository
from .models import Bus

class BusService:
    """
    Capa de Servicios.
    Contiene la Lógica de Negocio de la gestión de flota.
    """
    @staticmethod
    def get_all_buses():
        return BusRepository.get_all_buses()

    @staticmethod
    def get_bus_detail(bus_id: int):
        bus = BusRepository.get_bus_by_id(bus_id)
        if not bus:
            raise ValueError("Bus no encontrado")
        return bus

    @staticmethod
    def update_estado_bus(bus_id: int, nuevo_estado: str):
        bus = BusRepository.get_bus_by_id(bus_id)
        if not bus:
            raise ValueError("Bus no encontrado")
        
        # Lógica de negocio (Ejemplo)
        if nuevo_estado == Bus.Estado.MANTENIMIENTO and bus.estado == Bus.Estado.EN_SERVICIO:
            raise ValueError("Un bus EN_SERVICIO no puede pasar a MANTENIMIENTO directo. Debe liberarse primero.")

        return BusRepository.update_bus(bus, {'estado': nuevo_estado})
