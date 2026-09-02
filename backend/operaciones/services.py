from .repositories import PersonaRepository
from .models import Persona

class TripulacionService:
    @staticmethod
    def get_todas_personas():
        return PersonaRepository.get_todas_personas()

    @staticmethod
    def get_conductores():
        return PersonaRepository.get_conductores()

    @staticmethod
    def registrar_horas(persona_id: int, horas_agregadas: float):
        persona = PersonaRepository.get_persona_by_id(persona_id)
        if not persona:
            raise ValueError("Persona no encontrada")
        
        nuevas_horas = float(persona.horas_hoy) + horas_agregadas
        estado_semaforo = Persona.Semaforo.VERDE
        razon = None

        if nuevas_horas >= 8:
            estado_semaforo = Persona.Semaforo.ROJO
            razon = 'Exceso de jornada diaria (>8h)'
        elif nuevas_horas >= 6:
            estado_semaforo = Persona.Semaforo.AMARILLO
            razon = 'Precaución: Jornada acercándose al límite'

        return PersonaRepository.update_persona(persona, {
            'horas_hoy': nuevas_horas,
            'semaforo': estado_semaforo,
            'razon_bloqueo': razon
        })

class PlanificacionService:
    @staticmethod
    def get_todas_posturas():
        from .repositories import PosturaRepository
        return PosturaRepository.get_todas_posturas()

    @staticmethod
    def get_todas_rutas():
        from .repositories import RutaRepository
        return RutaRepository.get_todas_rutas()

    @staticmethod
    def create_postura(data: dict):
        from .repositories import PosturaRepository
        # Lógica de validación podría ir aquí (ej. verificar si el bus ya tiene viaje en esa fecha)
        return PosturaRepository.create_postura(data)

    @staticmethod
    def update_postura(postura_id: int, data: dict):
        from .repositories import PosturaRepository
        postura = PosturaRepository.get_postura_by_id(postura_id)
        if not postura:
            raise ValueError("Postura no encontrada")
        return PosturaRepository.update_postura(postura, data)

    @staticmethod
    def delete_postura(postura_id: int):
        from .repositories import PosturaRepository
        postura = PosturaRepository.get_postura_by_id(postura_id)
        if not postura:
            raise ValueError("Postura no encontrada")
        PosturaRepository.delete_postura(postura)

    @staticmethod
    def asignar_tripulacion(postura_id: int, persona_id: int, rol: str):
        from .repositories import PosturaRepository
        from .repositories import PersonaRepository
        from .models import Persona

        postura = PosturaRepository.get_postura_by_id(postura_id)
        persona = PersonaRepository.get_persona_by_id(persona_id)

        if not postura or not persona:
            raise ValueError("Postura o Persona no encontrada")

        if persona.semaforo == Persona.Semaforo.ROJO:
            raise ValueError(f"No se puede asignar a {persona.nombre} porque está bloqueado (Semaforo Rojo).")

        return PosturaRepository.asignar_tripulacion(postura, persona, rol)

