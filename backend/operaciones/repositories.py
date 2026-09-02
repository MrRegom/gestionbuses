from .models import Persona

class PersonaRepository:
    @staticmethod
    def get_todas_personas():
        return Persona.objects.all().order_by('id')

    @staticmethod
    def get_conductores():
        return Persona.objects.filter(rol=Persona.Rol.CONDUCTOR).order_by('id')

    @staticmethod
    def get_persona_by_id(persona_id: int):
        try:
            return Persona.objects.get(id=persona_id)
        except Persona.DoesNotExist:
            return None

    @staticmethod
    def create_persona(data: dict):
        return Persona.objects.create(**data)

    @staticmethod
    def update_persona(persona: Persona, data: dict):
        for field, value in data.items():
            setattr(persona, field, value)
        persona.save()
        return persona

class RutaRepository:
    @staticmethod
    def get_todas_rutas():
        from .models import Ruta
        return Ruta.objects.all().select_related('origen', 'destino')

    @staticmethod
    def get_ruta_by_id(ruta_id: int):
        from .models import Ruta
        try:
            return Ruta.objects.select_related('origen', 'destino').get(id=ruta_id)
        except Ruta.DoesNotExist:
            return None

class PosturaRepository:
    @staticmethod
    def get_todas_posturas():
        from .models import Postura
        return Postura.objects.all().select_related('ruta', 'ruta__origen', 'ruta__destino', 'bus').prefetch_related('tripulacion__persona').order_by('fecha', 'hora_salida')

    @staticmethod
    def get_postura_by_id(postura_id: int):
        from .models import Postura
        try:
            return Postura.objects.select_related('ruta', 'ruta__origen', 'ruta__destino', 'bus').prefetch_related('tripulacion__persona').get(id=postura_id)
        except Postura.DoesNotExist:
            return None

    @staticmethod
    def create_postura(data: dict):
        from .models import Postura
        return Postura.objects.create(**data)

    @staticmethod
    def update_postura(postura, data: dict):
        for field, value in data.items():
            setattr(postura, field, value)
        postura.save()
        return postura

    @staticmethod
    def delete_postura(postura):
        postura.delete()

    @staticmethod
    def asignar_tripulacion(postura, persona, rol):
        from .models import AsignacionTripulacion
        asignacion, created = AsignacionTripulacion.objects.update_or_create(
            postura=postura, persona=persona,
            defaults={'rol_en_viaje': rol}
        )
        return asignacion

