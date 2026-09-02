"""
Permisos por perfil de usuario (README §3).

El rol vive en `Persona.rol`, no en grupos de Django, para que el
dominio siga siendo la única fuente de verdad: un mecánico es mecánico
tanto para una orden de trabajo como para entrar al sistema.
"""
from rest_framework.permissions import BasePermission

from operaciones.models import Persona


# Atajos de lectura: quiénes componen cada bloque funcional.
OPERACIONES = {Persona.Rol.JEFE_OPERACIONES, Persona.Rol.MONITOREO}
TALLER = {Persona.Rol.JEFE_MECANICOS, Persona.Rol.MECANICO}
TRIPULACION = {Persona.Rol.CONDUCTOR, Persona.Rol.ASISTENTE}
TODOS = OPERACIONES | TALLER | TRIPULACION


def persona_de(request):
    """La Persona detrás del usuario autenticado, o None."""
    usuario = getattr(request, 'user', None)
    if not usuario or not usuario.is_authenticated:
        return None
    return getattr(usuario, 'persona', None)


class TienePersona(BasePermission):
    """Exige sesión iniciada y una Persona vinculada.

    Un usuario de Django sin Persona (por ejemplo un superusuario creado
    a mano) no tiene rol en el dominio, así que no puede operar el
    sistema aunque esté autenticado.
    """
    message = 'Tu cuenta no está vinculada a una persona del sistema.'

    def has_permission(self, request, view):
        return persona_de(request) is not None


class RolPermitido(TienePersona):
    """Restringe la vista a los roles listados en `roles_permitidos`.

    Se declara en la vista:

        class MiVista(APIView):
            permission_classes = [RolPermitido]
            roles_permitidos = TALLER
    """

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        roles = getattr(view, 'roles_permitidos', None)
        if not roles:
            return True

        persona = persona_de(request)
        if persona.rol in roles:
            return True

        self.message = (
            f'Tu perfil ({persona.get_rol_display()}) no tiene acceso a esta sección.'
        )
        return False


class EscrituraPorRol(TienePersona):
    """Cualquiera con cuenta puede leer; solo `roles_permitidos` escribe.

    La tripulación necesita consultar las posturas para asociar su
    checklist al viaje, pero no debe poder crearlas ni modificarlas.
    Cerrar la lectura entera dejaría al conductor sin poder trabajar.
    """

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True

        roles = getattr(view, 'roles_permitidos', None)
        if not roles:
            return True

        persona = persona_de(request)
        if persona.rol in roles:
            return True

        self.message = (
            f'Tu perfil ({persona.get_rol_display()}) no puede modificar esta sección.'
        )
        return False


class SoloLecturaMonitoreo(RolPermitido):
    """La Sala de Monitoreo observa, no modifica (README §3.5)."""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        persona = persona_de(request)
        if persona.rol == Persona.Rol.MONITOREO and request.method not in ('GET', 'HEAD', 'OPTIONS'):
            self.message = 'La Sala de Monitoreo tiene acceso de solo lectura.'
            return False

        return True
