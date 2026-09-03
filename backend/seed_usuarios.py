"""
Cuentas de acceso, una por perfil del README §3.

Cada usuario de Django queda vinculado a una Persona: el rol del dominio
es el que decide qué puede hacer, no los permisos de Django.

Las contraseñas son de desarrollo. Antes de exponer esto a usuarios
reales hay que cambiarlas y quitar este script del despliegue.

Uso:  python seed_usuarios.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sgo_project.settings')
django.setup()

from django.contrib.auth.models import User  # noqa: E402
from operaciones.models import Persona  # noqa: E402


CLAVE_DEV = 'sgo2026'

# (usuario, nombre, rut, rol)
CUENTAS = [
    ('operaciones', 'Felipe Contreras',  '11.111.111-1', Persona.Rol.JEFE_OPERACIONES),
    ('taller',      'Sergio Muñoz',      '12.222.222-2', Persona.Rol.JEFE_MECANICOS),
    ('monitoreo',   'Carla Espinoza',    '13.333.333-3', Persona.Rol.MONITOREO),
    ('admin',       'Administrador SGO', '10.000.000-0', Persona.Rol.ADMIN),
]

# La cuenta de administrador además entra al panel de Django (/admin),
# donde se ven las tablas en crudo. Las demás no lo necesitan: su
# trabajo ocurre en las pantallas de la aplicación.
SUPERUSUARIOS = {'admin'}

# Personal que ya existe en la base: se le crea cuenta reutilizando su RUT.
POR_RUT = [
    ('vveliz',   '12.345.678-9'),   # conductor
    ('rherrera', '15.234.567-8'),   # mecánico
]


def vincular(usuario_nombre, persona):
    user, creado = User.objects.get_or_create(
        username=usuario_nombre,
        defaults={'first_name': persona.nombre.split(' ')[0]},
    )
    user.set_password(CLAVE_DEV)
    if usuario_nombre in SUPERUSUARIOS:
        user.is_staff = True
        user.is_superuser = True
    user.save()

    persona.usuario = user
    persona.save(update_fields=['usuario'])
    return creado


def run():
    for username, nombre, rut, rol in CUENTAS:
        persona, _ = Persona.objects.update_or_create(
            rut=rut,
            defaults={'nombre': nombre, 'rol': rol, 'tipo': Persona.Tipo.TITULAR},
        )
        creado = vincular(username, persona)
        print(f'{"+" if creado else "="} {username:12} {persona.get_rol_display()}')

    for username, rut in POR_RUT:
        persona = Persona.objects.filter(rut=rut).first()
        if not persona:
            print(f'! {username:12} sin persona con RUT {rut} — omitido')
            continue
        creado = vincular(username, persona)
        print(f'{"+" if creado else "="} {username:12} {persona.get_rol_display()}')

    print()
    print(f'Contraseña de desarrollo para todas las cuentas: {CLAVE_DEV}')
    print('Cámbiala antes de exponer el sistema a usuarios reales.')


if __name__ == '__main__':
    run()
