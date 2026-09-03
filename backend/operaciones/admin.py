"""
Panel de Django para revisar los datos en crudo.

No sustituye a la aplicación —el jefe de operaciones trabaja en las
pantallas, no aquí— pero sirve para mirar una tabla completa, corregir
un dato suelto o entender por qué algo salió como salió.
"""
from django.contrib import admin

from .models import (
    AsignacionTripulacion, Ciudad, Corrida, Parametros, Persona, Postura, Ruta,
)


@admin.register(Persona)
class PersonaAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'rut', 'rol', 'tipo', 'usuario')
    list_filter = ('rol', 'tipo')
    search_fields = ('nombre', 'rut')
    ordering = ('nombre',)


@admin.register(Ciudad)
class CiudadAdmin(admin.ModelAdmin):
    list_display = ('nombre',)
    search_fields = ('nombre',)


@admin.register(Ruta)
class RutaAdmin(admin.ModelAdmin):
    list_display = ('origen', 'destino', 'duracion_estimada')
    list_filter = ('origen', 'destino')


class TripulacionInline(admin.TabularInline):
    model = AsignacionTripulacion
    extra = 0
    autocomplete_fields = ('persona',)


@admin.register(Postura)
class PosturaAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'fecha', 'hora_salida', 'ruta', 'bus', 'estado')
    list_filter = ('estado', 'fecha')
    search_fields = ('codigo',)
    date_hierarchy = 'fecha'
    inlines = [TripulacionInline]


@admin.register(Corrida)
class CorridaAdmin(admin.ModelAdmin):
    list_display = ('bus_original', 'bus_sustituto', 'estado', 'creado_en')
    list_filter = ('estado',)
    filter_horizontal = ('posturas',)


@admin.register(Parametros)
class ParametrosAdmin(admin.ModelAdmin):
    """Se edita desde Configuración; aquí solo se consulta.

    Dejarlo escribible por dos caminos invita a que uno de los dos se
    salte las validaciones del servicio.
    """
    list_display = ('conductores_por_servicio', 'asistentes_por_servicio',
                    'actualizado_en', 'actualizado_por')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
