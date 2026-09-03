from django.urls import path

from .views import (
    PlantillaChecklistView,
    ChecklistListCreateView, ChecklistDetailView,
    ChecklistResponderView, ChecklistCompletarView,
    IncidenteListCreateView, IncidenteEstadoView,
    TableroView, OrdenListCreateView, OrdenAsignarView,
    OrdenIniciarView, OrdenCompletarView,
    BusLiberarView, BusNoOperativoView,
    PlantillaEditarView, PlantillaCategoriaView,
    PlantillaItemCreateView, PlantillaItemView,
)

urlpatterns = [
    # Plantilla del formulario
    path('checklist/plantilla/', PlantillaChecklistView.as_view(), name='checklist-plantilla'),

    # Edición de la plantilla, desde Configuración
    path('plantilla/', PlantillaEditarView.as_view(), name='plantilla-list-create'),
    path('plantilla/categorias/<int:pk>/', PlantillaCategoriaView.as_view(), name='plantilla-categoria'),
    path('plantilla/items/', PlantillaItemCreateView.as_view(), name='plantilla-item-create'),
    path('plantilla/items/<int:pk>/', PlantillaItemView.as_view(), name='plantilla-item'),

    # Checklists
    path('checklist/', ChecklistListCreateView.as_view(), name='checklist-list-create'),
    path('checklist/<int:pk>/', ChecklistDetailView.as_view(), name='checklist-detail'),
    path('checklist/<int:pk>/responder/', ChecklistResponderView.as_view(), name='checklist-responder'),
    path('checklist/<int:pk>/completar/', ChecklistCompletarView.as_view(), name='checklist-completar'),

    # Incidentes
    path('incidentes/', IncidenteListCreateView.as_view(), name='incidente-list-create'),
    path('incidentes/<int:pk>/estado/', IncidenteEstadoView.as_view(), name='incidente-estado'),

    # Taller
    path('tablero/', TableroView.as_view(), name='taller-tablero'),
    path('ordenes/', OrdenListCreateView.as_view(), name='orden-list-create'),
    path('ordenes/<int:pk>/asignar/', OrdenAsignarView.as_view(), name='orden-asignar'),
    path('ordenes/<int:pk>/iniciar/', OrdenIniciarView.as_view(), name='orden-iniciar'),
    path('ordenes/<int:pk>/completar/', OrdenCompletarView.as_view(), name='orden-completar'),

    # Decisión sobre el bus
    path('buses/<int:pk>/liberar/', BusLiberarView.as_view(), name='bus-liberar'),
    path('buses/<int:pk>/no-operativo/', BusNoOperativoView.as_view(), name='bus-no-operativo'),
]
