from rest_framework import serializers
from .models import (
    Persona, Ciudad, Ruta, Postura, AsignacionTripulacion, Corrida,
    MovimientoCorrida, Parametros, CicloTurno, Turno,
)
from flota.serializers import BusSerializer

class PersonaSerializer(serializers.ModelSerializer):
    # `__all__` no trae las relaciones inversas, y el turno es lo que la
    # ficha necesita para decir de qué días dispone esa persona.
    turno = serializers.SerializerMethodField()

    class Meta:
        model = Persona
        fields = '__all__'

    def get_turno(self, obj):
        turno = getattr(obj, 'turno', None)
        if not turno:
            return None
        return {
            'id': turno.id,
            'inicio': turno.inicio,
            'ciclo': {
                'id': turno.ciclo_id,
                'nombre': turno.ciclo.nombre,
                'dias_trabajo': turno.ciclo.dias_trabajo,
                'dias_descanso': turno.ciclo.dias_descanso,
            },
        }

class CiudadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ciudad
        fields = '__all__'

class RutaSerializer(serializers.ModelSerializer):
    origen = CiudadSerializer(read_only=True)
    destino = CiudadSerializer(read_only=True)
    origen_id = serializers.PrimaryKeyRelatedField(queryset=Ciudad.objects.all(), source='origen', write_only=True)
    destino_id = serializers.PrimaryKeyRelatedField(queryset=Ciudad.objects.all(), source='destino', write_only=True)

    class Meta:
        model = Ruta
        fields = '__all__'

class AsignacionTripulacionSerializer(serializers.ModelSerializer):
    persona = PersonaSerializer(read_only=True)
    persona_id = serializers.PrimaryKeyRelatedField(queryset=Persona.objects.all(), source='persona', write_only=True)

    class Meta:
        model = AsignacionTripulacion
        fields = ['id', 'persona', 'persona_id', 'rol_en_viaje']

class PosturaSerializer(serializers.ModelSerializer):
    ruta = RutaSerializer(read_only=True)
    ruta_id = serializers.PrimaryKeyRelatedField(queryset=Ruta.objects.all(), source='ruta', write_only=True)
    bus = BusSerializer(read_only=True)
    bus_id = serializers.PrimaryKeyRelatedField(queryset=BusSerializer.Meta.model.objects.all(), source='bus', write_only=True, required=False, allow_null=True)
    tripulacion = AsignacionTripulacionSerializer(many=True, read_only=True)
    dotacion = serializers.SerializerMethodField()
    faltantes = serializers.SerializerMethodField()
    dotacion_completa = serializers.BooleanField(read_only=True)
    recursos_completos = serializers.BooleanField(read_only=True)

    class Meta:
        model = Postura
        fields = '__all__'

    def get_dotacion(self, obj):
        return obj.dotacion()

    def get_faltantes(self, obj):
        return obj.faltantes()



class PosturaResumenSerializer(serializers.ModelSerializer):
    """Versión ligera para listar posturas dentro de otra respuesta."""
    ruta = RutaSerializer(read_only=True)
    bus = BusSerializer(read_only=True)

    class Meta:
        model = Postura
        fields = ['id', 'codigo', 'ruta', 'fecha', 'hora_salida', 'estado', 'bus']


class MovimientoCorridaSerializer(serializers.ModelSerializer):
    """Un eslabón de la cadena: qué servicio pasa de qué bus a cuál."""
    postura = PosturaResumenSerializer(read_only=True)
    bus_saliente = BusSerializer(read_only=True)
    bus_entrante = BusSerializer(read_only=True)

    class Meta:
        model = MovimientoCorrida
        fields = ['id', 'orden', 'postura', 'bus_saliente', 'bus_entrante']


class CorridaSerializer(serializers.ModelSerializer):
    bus_original = BusSerializer(read_only=True)
    bus_cierre = BusSerializer(read_only=True)
    postura_origen = PosturaResumenSerializer(read_only=True)
    creado_por = PersonaSerializer(read_only=True)
    movimientos = MovimientoCorridaSerializer(many=True, read_only=True)
    # El servicio que quedó esperando la máquina del pozo. Es lo que
    # hay que resolver para cerrar la corrida.
    postura_en_espera = serializers.SerializerMethodField()

    class Meta:
        model = Corrida
        fields = [
            'id', 'bus_original', 'postura_origen', 'motivo', 'estado',
            'creado_por', 'movimientos', 'postura_en_espera', 'bus_cierre',
            'creado_en', 'cerrado_en',
        ]

    def get_postura_en_espera(self, obj):
        p = obj.postura_en_espera
        return PosturaResumenSerializer(p).data if p else None


class ParametrosSerializer(serializers.ModelSerializer):
    """Las reglas vigentes tal como las ve la pantalla de Configuración."""
    actualizado_por_nombre = serializers.CharField(
        source='actualizado_por.nombre', read_only=True, default=None,
    )

    class Meta:
        model = Parametros
        fields = [
            'conductores_por_servicio', 'asistentes_por_servicio',
            'actualizado_en', 'actualizado_por_nombre',
        ]


class CicloTurnoSerializer(serializers.ModelSerializer):
    largo = serializers.IntegerField(read_only=True)
    en_uso = serializers.SerializerMethodField()

    class Meta:
        model = CicloTurno
        fields = ['id', 'nombre', 'dias_trabajo', 'dias_descanso',
                  'largo', 'activo', 'en_uso']

    def get_en_uso(self, obj):
        """Cuánta gente lo tiene. Con gente encima no se puede eliminar."""
        return obj.turnos.count()


class TurnoSerializer(serializers.ModelSerializer):
    ciclo = CicloTurnoSerializer(read_only=True)
    persona_nombre = serializers.CharField(source='persona.nombre', read_only=True)

    class Meta:
        model = Turno
        fields = ['id', 'persona', 'persona_nombre', 'ciclo', 'inicio',
                  'actualizado_en']
