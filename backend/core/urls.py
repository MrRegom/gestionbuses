from django.urls import path

from .views import (
    SesionView, LoginView, LogoutView, PerfilView, NotificacionesView,
)

urlpatterns = [
    path('sesion/', SesionView.as_view(), name='auth-sesion'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('perfil/', PerfilView.as_view(), name='auth-perfil'),
    path('notificaciones/', NotificacionesView.as_view(), name='notificaciones'),
]
