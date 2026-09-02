from django.urls import path

from .views import (
    PlantillaChecklistView,
    ChecklistListCreateView, ChecklistDetailView,
    ChecklistResponderView, ChecklistCompletarView,
    IncidenteListCreateView, IncidenteEstadoView,
)

urlpatterns = [
    # Plantilla del formulario
    path('checklist/plantilla/', PlantillaChecklistView.as_view(), name='checklist-plantilla'),

    # Checklists
    path('checklist/', ChecklistListCreateView.as_view(), name='checklist-list-create'),
    path('checklist/<int:pk>/', ChecklistDetailView.as_view(), name='checklist-detail'),
    path('checklist/<int:pk>/responder/', ChecklistResponderView.as_view(), name='checklist-responder'),
    path('checklist/<int:pk>/completar/', ChecklistCompletarView.as_view(), name='checklist-completar'),

    # Incidentes
    path('incidentes/', IncidenteListCreateView.as_view(), name='incidente-list-create'),
    path('incidentes/<int:pk>/estado/', IncidenteEstadoView.as_view(), name='incidente-estado'),
]
