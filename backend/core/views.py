from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from django.utils.decorators import method_decorator

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from operaciones.serializers import PersonaSerializer

from .permissions import TienePersona, persona_de


def _sesion(persona):
    """Payload que el frontend necesita para decidir qué mostrar."""
    return {
        'persona': PersonaSerializer(persona).data,
        'rol': persona.rol,
        'rol_label': persona.get_rol_display(),
        'nombre': persona.nombre,
    }


@method_decorator(ensure_csrf_cookie, name='dispatch')
class SesionView(APIView):
    """Quién soy.

    Va con AllowAny a propósito: responde 401 en vez de reventar cuando
    todavía no hay sesión, y así el frontend puede preguntar al arrancar.
    Además `ensure_csrf_cookie` deja el token en la cookie, que es lo que
    permite hacer el POST de login inmediatamente después.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        persona = persona_de(request)
        if not persona:
            return Response(
                {'autenticado': False},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return Response({'autenticado': True, **_sesion(persona)},
                        status=status.HTTP_200_OK)


@method_decorator(csrf_protect, name='dispatch')
class LoginView(APIView):
    """Inicio de sesión.

    `csrf_protect` es imprescindible aquí. DRF marca toda APIView como
    csrf_exempt y delega la verificación a SessionAuthentication, que
    solo actúa cuando ya existe sesión — y en el login todavía no la
    hay. Sin este decorador el endpoint queda expuesto a login CSRF:
    forzar al navegador de la víctima a iniciar sesión con la cuenta
    del atacante para después observar lo que hace.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        username = (request.data.get('username') or '').strip()
        password = request.data.get('password') or ''

        if not username or not password:
            return Response({'error': 'Usuario y contraseña son obligatorios.'},
                            status=status.HTTP_400_BAD_REQUEST)

        usuario = authenticate(request, username=username, password=password)
        if usuario is None:
            # Mismo mensaje para usuario inexistente y clave incorrecta:
            # distinguirlos permitiría enumerar cuentas válidas.
            return Response({'error': 'Usuario o contraseña incorrectos.'},
                            status=status.HTTP_401_UNAUTHORIZED)

        persona = getattr(usuario, 'persona', None)
        if persona is None:
            return Response(
                {'error': 'La cuenta no está vinculada a una persona del sistema.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        login(request, usuario)
        return Response({'autenticado': True, **_sesion(persona)},
                        status=status.HTTP_200_OK)


@method_decorator(csrf_protect, name='dispatch')
class LogoutView(APIView):
    """Cierre de sesión. También protegido: sin CSRF, un tercero podría
    desloguear al usuario de forma remota."""
    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response({'autenticado': False}, status=status.HTTP_200_OK)


class PerfilView(APIView):
    """Datos del usuario en sesión. Exige Persona vinculada."""
    permission_classes = [TienePersona]

    def get(self, request):
        return Response(_sesion(persona_de(request)), status=status.HTTP_200_OK)
