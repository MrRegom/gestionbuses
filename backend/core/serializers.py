from rest_framework import serializers

from .models import Notificacion


class NotificacionSerializer(serializers.ModelSerializer):
    postura_codigo = serializers.CharField(
        source='postura.codigo', read_only=True, default=None,
    )

    class Meta:
        model = Notificacion
        fields = [
            'id', 'tipo', 'titulo', 'detalle', 'ruta',
            'postura_codigo', 'leida', 'creado_en',
        ]
