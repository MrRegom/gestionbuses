from django.urls import path

from .views import DashboardView, IndicadoresView

urlpatterns = [
    path('dashboard/', DashboardView.as_view(), name='reportes-dashboard'),
    path('indicadores/', IndicadoresView.as_view(), name='reportes-indicadores'),
]
