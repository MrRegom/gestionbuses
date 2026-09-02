from rest_framework import serializers

from flota.serializers import BusSerializer
from operaciones.serializers import PersonaSerializer

from .models import (
    CategoriaChecklist, ItemChecklist, Checklist, RespuestaChecklist, Incidente,
)


class ItemChecklistSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemChecklist
        fields = ['id', 'descripcion', 'orden', 'critico']


class CategoriaChecklistSerializer(serializers.ModelSerializer):
    """La plantilla llega al móvil ya agrupada, para que el frontend no
    tenga que reconstruir la jerarquía."""
    items = serializers.SerializerMethodField()

    class Meta:
        model = CategoriaChecklist
        fields = ['id', 'nombre', 'orden', 'items']

    def get_items(self, obj):
        activos = [i for i in obj.items.all() if i.activo]
        activos.sort(key=lambda i: (i.orden, i.id))
        return ItemChecklistSerializer(activos, many=True).data


class RespuestaChecklistSerializer(serializers.ModelSerializer):
    item = ItemChecklistSerializer(read_only=True)
    categoria = serializers.CharField(source='item.categoria.nombre', read_only=True)

    class Meta:
        model = RespuestaChecklist
        fields = ['id', 'item', 'categoria', 'estado', 'observacion']


class ChecklistSerializer(serializers.ModelSerializer):
    bus = BusSerializer(read_only=True)
    reportado_por = PersonaSerializer(read_only=True)
    respuestas = RespuestaChecklistSerializer(many=True, read_only=True)
    postura_codigo = serializers.CharField(source='postura.codigo', read_only=True, default=None)
    total_fallas = serializers.IntegerField(read_only=True)
    total_respuestas = serializers.IntegerField(read_only=True)

    class Meta:
        model = Checklist
        fields = [
            'id', 'bus', 'postura', 'postura_codigo', 'reportado_por',
            'momento', 'estado', 'observaciones',
            'creado_en', 'completado_en',
            'total_respuestas', 'total_fallas', 'respuestas',
        ]


class ChecklistResumenSerializer(serializers.ModelSerializer):
    """Versión liviana para el listado: sin el detalle de respuestas."""
    bus = BusSerializer(read_only=True)
    reportado_por = PersonaSerializer(read_only=True)
    postura_codigo = serializers.CharField(source='postura.codigo', read_only=True, default=None)
    total_fallas = serializers.IntegerField(read_only=True)
    total_respuestas = serializers.IntegerField(read_only=True)

    class Meta:
        model = Checklist
        fields = [
            'id', 'bus', 'postura_codigo', 'reportado_por', 'momento',
            'estado', 'creado_en', 'completado_en',
            'total_respuestas', 'total_fallas',
        ]


class IncidenteSerializer(serializers.ModelSerializer):
    bus = BusSerializer(read_only=True)
    reportado_por = PersonaSerializer(read_only=True)
    postura_codigo = serializers.CharField(source='postura.codigo', read_only=True, default=None)
    item_descripcion = serializers.CharField(source='item.descripcion', read_only=True, default=None)

    class Meta:
        model = Incidente
        fields = [
            'id', 'codigo', 'bus', 'postura', 'postura_codigo',
            'reportado_por', 'descripcion', 'gravedad', 'estado', 'origen',
            'checklist', 'item', 'item_descripcion',
            'creado_en', 'actualizado_en',
        ]
