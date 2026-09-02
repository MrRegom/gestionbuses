from django.urls import path
from .views import BusListView, BusDetailView, BusUpdateEstadoView

urlpatterns = [
    path('buses/', BusListView.as_view(), name='bus-list'),
    path('buses/<int:pk>/', BusDetailView.as_view(), name='bus-detail'),
    path('buses/<int:pk>/estado/', BusUpdateEstadoView.as_view(), name='bus-update-estado'),
]
