from .models import Bus

class BusRepository:
    """
    Capa de Acceso a Datos (Repository Pattern).
    Aísla las consultas del ORM de Django del resto de la aplicación.
    """
    @staticmethod
    def get_all_buses():
        return Bus.objects.all().order_by('id')

    @staticmethod
    def get_bus_by_id(bus_id: int):
        try:
            return Bus.objects.get(id=bus_id)
        except Bus.DoesNotExist:
            return None

    @staticmethod
    def get_buses_by_estado(estado: str):
        return Bus.objects.filter(estado=estado).order_by('id')

    @staticmethod
    def create_bus(data: dict):
        return Bus.objects.create(**data)

    @staticmethod
    def update_bus(bus: Bus, data: dict):
        for field, value in data.items():
            setattr(bus, field, value)
        bus.save()
        return bus

    @staticmethod
    def delete_bus(bus: Bus):
        bus.delete()
