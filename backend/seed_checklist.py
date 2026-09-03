"""
Plantilla del checklist de llegada a Santiago.

La estructura sale del formulario físico que se levantó con Operaciones:
"novedades informáticas, mantención y novedades del sistema mecánico,
eléctrico, carrocero y vulcanización". Por eso las categorías son
oficios y no partes del bus: el jefe de mecánicos lee la hoja y reparte
el trabajo según quién sabe hacer cada cosa.

LOS ÍTEMS SON PROVISORIOS. Están armados a partir de lo que Operaciones
alcanzó a describir, no copiados de su hoja. Hay que sentarse con el
papel que usan hoy y corregirlos. Se pueden editar desde Configuración
sin tocar este archivo; esta semilla solo sirve para arrancar.

LO QUE SÍ ES REAL son los ítems marcados como críticos. Operaciones
nombró exactamente qué deja un bus fuera de servicio de inmediato:

    "No terminar la falla sobre todo si es fuga de aire en los
     circuitos, falla de frenos, falla de dirección o falla en sistema
     de frenos auxiliares, parabrisas rotos"

y aparte, como motivo de bloqueo: "presencia de chinches".

Ningún otro ítem debería estar marcado como crítico mientras no lo
confirmen ellos.

Uso:  python seed_checklist.py
"""
import os

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sgo_project.settings')
django.setup()

from mantencion.models import CategoriaChecklist, ItemChecklist  # noqa: E402


# (categoría, orden, [(ítem, crítico)])
#
# El nombre de cada categoría coincide con la especialidad del taller a
# la que se deriva el trabajo. No es casualidad: es cómo está armada la
# hoja de papel.
PLANTILLA = [
    ('Mecánico', 1, [
        ('Sistema de frenos', True),
        ('Frenos auxiliares / retardador', True),
        ('Dirección', True),
        ('Circuito de aire, sin fugas', True),
        ('Nivel de aceite de motor', False),
        ('Nivel de agua / refrigerante', False),
        ('Nivel de líquido de frenos', False),
        ('Embrague y caja', False),
        ('Suspensión y amortiguadores', False),
        ('Ruidos o vibraciones no habituales', False),
    ]),
    ('Eléctrico', 2, [
        ('Luces altas y bajas', False),
        ('Luces traseras y de freno', False),
        ('Intermitentes y balizas', False),
        ('Luces de emergencia', False),
        ('Alternador y carga de batería', False),
        ('Bocina', False),
        ('Limpiaparabrisas', False),
        ('Aire acondicionado / calefacción', False),
    ]),
    ('Carrocero', 3, [
        ('Parabrisas sin trizaduras', True),
        ('Puertas de servicio abren y cierran', False),
        ('Maleteros cierran y aseguran', False),
        ('Espejos completos y firmes', False),
        ('Asientos y cinturones sin daño', False),
        ('Baño operativo', False),
        ('Daños en carrocería', False),
    ]),
    ('Vulcanización', 4, [
        ('Neumáticos delanteros', False),
        ('Neumáticos traseros', False),
        ('Presión de neumáticos', False),
        ('Neumático de repuesto', False),
        ('Pernos y tuercas de rueda', False),
    ]),
    ('Informática', 5, [
        ('Equipo de monitoreo / GPS', False),
        ('Validador y sistema de boletos', False),
        ('Pantallas y multimedia', False),
        ('Cámaras', False),
    ]),
    # Va aparte porque no la arregla un mecánico: el bus se saca de
    # servicio y se fumiga. Operaciones la nombró como motivo de bloqueo
    # junto a las fallas mecánicas.
    ('Sanidad', 6, [
        ('Sin presencia de chinches u otra plaga', True),
        ('Aseo interior realizado', False),
    ]),
]


def run():
    categorias = items = criticos = 0

    for nombre, orden, lista in PLANTILLA:
        categoria, creada = CategoriaChecklist.objects.update_or_create(
            nombre=nombre,
            defaults={'orden': orden, 'activa': True},
        )
        categorias += 1

        for i, (descripcion, critico) in enumerate(lista, start=1):
            ItemChecklist.objects.update_or_create(
                categoria=categoria,
                descripcion=descripcion,
                defaults={'orden': i, 'critico': critico, 'activo': True},
            )
            items += 1
            criticos += 1 if critico else 0

        marca = '+' if creada else '='
        print(f'{marca} {nombre:16} {len(lista):2} ítems')

    print()
    print(f'{categorias} categorías, {items} ítems, {criticos} críticos.')
    print()
    print('Los ítems son provisorios: hay que contrastarlos con la hoja')
    print('que usa la tripulación hoy. Se editan desde Configuración.')
    print('Los críticos sí salen de lo que nombró Operaciones.')


if __name__ == '__main__':
    run()
