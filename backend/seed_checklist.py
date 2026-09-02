"""
Semilla de la plantilla del checklist.

Los 28 ítems provienen de prototipo/js/app.js (DATA.checklist_items), que
es la definición operativa que ya se había validado con PlussChile.

`critico=True` marca los ítems cuya falla deja el bus FUERA_SERVICIO en
vez de solo MANTENIMIENTO: son los que impiden legalmente circular o
comprometen la seguridad de los pasajeros.

Uso:  python seed_checklist.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sgo_project.settings')
django.setup()

from mantencion.models import CategoriaChecklist, ItemChecklist  # noqa: E402


# (categoría, [(descripción, crítico), ...])
PLANTILLA = [
    ('Documentación y Seguridad', [
        ('Licencia de conducir vigente',        True),
        ('Padrón del vehículo',                 True),
        ('Permiso de circulación',              True),
        ('Seguro SOAP vigente',                 True),
        ('Cinturones de seguridad (todos)',     True),
        ('Extintores cargados y sellados',      True),
    ]),
    ('Motor y Mecánica', [
        ('Nivel de aceite motor',               False),
        ('Nivel de agua radiador',              False),
        ('Nivel de frenos',                     True),
        ('Presión neumáticos (todos)',          True),
        ('Freno de mano operativo',             True),
        ('Dirección sin juego excesivo',        True),
    ]),
    ('Luces y Eléctrico', [
        ('Luces delanteras altas/bajas',        True),
        ('Luces traseras / stop',               True),
        ('Luces de emergencia',                 True),
        ('Panel de instrumentos operativo',     False),
        ('Bocina',                              False),
        ('Limpiaparabrisas',                    False),
    ]),
    ('Interior del Bus', [
        ('Asientos sin daños',                  False),
        ('Salidas de emergencia sin obstrucción', True),
        ('Pasillos libres',                     False),
        ('Aire acondicionado operativo',        False),
        ('Sistema multimedia',                  False),
        ('Boleterías y validadores',            False),
    ]),
    ('Carrocería y Exterior', [
        ('Sin daños en carrocería',             False),
        ('Espejos laterales en posición',       True),
        ('Maleteros se cierran correctamente',  False),
        ('Neumático de repuesto',               False),
    ]),
]


def run():
    total_items = 0
    criticos = 0

    for orden_cat, (nombre_cat, items) in enumerate(PLANTILLA):
        categoria, creada = CategoriaChecklist.objects.update_or_create(
            nombre=nombre_cat,
            defaults={'orden': orden_cat, 'activa': True},
        )
        print(f'{"+" if creada else "="} {nombre_cat}')

        for orden_item, (descripcion, critico) in enumerate(items):
            ItemChecklist.objects.update_or_create(
                categoria=categoria,
                descripcion=descripcion,
                defaults={'orden': orden_item, 'critico': critico, 'activo': True},
            )
            total_items += 1
            if critico:
                criticos += 1
            print(f'    {"[!]" if critico else "[ ]"} {descripcion}')

    print()
    print(f'Plantilla lista: {len(PLANTILLA)} categorías, {total_items} ítems '
          f'({criticos} críticos).')
    print('[!] = su falla deja el bus FUERA DE SERVICIO')


if __name__ == '__main__':
    run()
