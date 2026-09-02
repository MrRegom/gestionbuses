from rest_framework import serializers
from .models import Persona, Ciudad, Ruta, Postura, AsignacionTripulacion
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

    class Meta:
        model = Postura
        fields = '__all__'

