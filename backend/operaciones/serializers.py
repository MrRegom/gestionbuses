from rest_framework import serializers
from .models import (
    Persona, Ciudad, Ruta, Postura, AsignacionTripulacion, Corrida,
    Parametros,
)
from flota.serializers import BusSerializer

class PersonaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Persona
        fields = '__all__'

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


class CorridaSerializer(serializers.ModelSerializer):
    bus_original = BusSerializer(read_only=True)
    bus_sustituto = BusSerializer(read_only=True)
    creado_por = PersonaSerializer(read_only=True)
    posturas = PosturaResumenSerializer(many=True, read_only=True)

    class Meta:
        model = Corrida
        fields = [
            'id', 'bus_original', 'bus_sustituto', 'motivo', 'estado',
            'creado_por', 'posturas', 'creado_en', 'cerrado_en',
        ]


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
