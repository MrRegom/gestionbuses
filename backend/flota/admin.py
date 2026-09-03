from django.contrib import admin

from .models import Bus


@admin.register(Bus)
class BusAdmin(admin.ModelAdmin):
    list_display = ('numero', 'patente', 'modelo', 'servicio', 'estado',
                    'kilometraje', 'pozo')
    list_filter = ('estado', 'servicio')
    search_fields = ('numero', 'patente', 'modelo')
    ordering = ('numero',)
