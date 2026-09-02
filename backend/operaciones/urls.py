from django.urls import path

from .views import (
    TripulacionListView, ConductoresListView,
    PersonalCreateView, PersonalDetailView,
    CiudadListCreateView, RutaListView, RutaCreateView, RutaDetailView,
    PosturaListCreateView, PosturaDetailView,
    AsignarTripulacionView, DesasignarTripulacionView,
    PosturaBusView, PersonalDisponibleView,
    CorridaTableroView, SustitutosView, CorridaCreateView, CorridaCerrarView,
)

urlpatterns = [
    # Personal
    path('tripulacion/', TripulacionListView.as_view(), name='tripulacion-list'),
    path('conductores/', ConductoresListView.as_view(), name='conductores-list'),
    path('personal/', PersonalCreateView.as_view(), name='personal-create'),
    path('personal/<int:pk>/', PersonalDetailView.as_view(), name='personal-detail'),

    # Catálogo
    path('ciudades/', CiudadListCreateView.as_view(), name='ciudad-list-create'),
    path('rutas/', RutaListView.as_view(), name='ruta-list'),
    path('rutas/crear/', RutaCreateView.as_view(), name='ruta-create'),
    path('rutas/<int:pk>/', RutaDetailView.as_view(), name='ruta-detail'),

    # Posturas
    path('posturas/', PosturaListCreateView.as_view(), name='postura-list-create'),
    path('posturas/<int:pk>/', PosturaDetailView.as_view(), name='postura-detail'),
    path('posturas/<int:pk>/asignar/', AsignarTripulacionView.as_view(), name='postura-asignar'),
    path('posturas/<int:pk>/bus/', PosturaBusView.as_view(), name='postura-bus'),
    path('posturas/<int:pk>/disponibles/', PersonalDisponibleView.as_view(), name='postura-disponibles'),

    # Corridas
    path('corridas/tablero/', CorridaTableroView.as_view(), name='corrida-tablero'),
    path('corridas/sustitutos/', SustitutosView.as_view(), name='corrida-sustitutos'),
    path('corridas/', CorridaCreateView.as_view(), name='corrida-create'),
    path('corridas/<int:pk>/cerrar/', CorridaCerrarView.as_view(), name='corrida-cerrar'),

    # Asignaciones
    path('asignaciones/<int:pk>/', DesasignarTripulacionView.as_view(), name='asignacion-detail'),
]
