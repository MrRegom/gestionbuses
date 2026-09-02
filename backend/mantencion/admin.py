from django.contrib import admin

from .models import (
    CategoriaChecklist, ItemChecklist, Checklist, RespuestaChecklist,
    Incidente, OrdenTrabajo,
)


class ItemChecklistInline(admin.TabularInline):
    model = ItemChecklist
    extra = 1


@admin.register(CategoriaChecklist)
class CategoriaChecklistAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'orden', 'activa')
    list_editable = ('orden', 'activa')
    inlines = [ItemChecklistInline]


@admin.register(ItemChecklist)
class ItemChecklistAdmin(admin.ModelAdmin):
    list_display = ('descripcion', 'categoria', 'critico', 'activo')
    list_filter = ('categoria', 'critico', 'activo')
    search_fields = ('descripcion',)


class RespuestaChecklistInline(admin.TabularInline):
    model = RespuestaChecklist
    extra = 0


@admin.register(Checklist)
class ChecklistAdmin(admin.ModelAdmin):
    list_display = ('id', 'bus', 'momento', 'estado', 'reportado_por', 'creado_en')
    list_filter = ('momento', 'estado')
    inlines = [RespuestaChecklistInline]


@admin.register(Incidente)
class IncidenteAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'bus', 'gravedad', 'estado', 'origen', 'creado_en')
    list_filter = ('gravedad', 'estado', 'origen')
    search_fields = ('codigo', 'descripcion')


@admin.register(OrdenTrabajo)
class OrdenTrabajoAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'bus', 'especialidad', 'estado', 'prioridad', 'mecanico', 'pozo')
    list_filter = ('estado', 'especialidad', 'tipo', 'prioridad')
    search_fields = ('codigo', 'descripcion')
