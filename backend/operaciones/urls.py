from django.urls import path
from .views import TripulacionListView, ConductoresListView, RutaListView, PosturaListCreateView, PosturaDetailView, AsignarTripulacionView

urlpatterns = [
    path('tripulacion/', TripulacionListView.as_view(), name='tripulacion-list'),
    path('conductores/', ConductoresListView.as_view(), name='conductores-list'),
    path('rutas/', RutaListView.as_view(), name='ruta-list'),
    path('posturas/', PosturaListCreateView.as_view(), name='postura-list-create'),
    path('posturas/<int:pk>/', PosturaDetailView.as_view(), name='postura-detail'),
    path('posturas/<int:pk>/asignar/', AsignarTripulacionView.as_view(), name='postura-asignar'),
]
