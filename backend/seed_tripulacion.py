"""
Semilla de la tripulación.

Cada servicio lleva dos conductores y un asistente, así que la dotación
sembrada tiene que dar para cubrir varias posturas de la jornada.

Los nombres de Patricio Rolla y Joao Dos Santos vienen de la planilla
real que compartió Operaciones, junto a Victor Veliz.

Es aditiva a propósito: la versión anterior hacía
`Persona.objects.all().delete()`, lo que se llevaría por delante a los
mecánicos y a las personas vinculadas a una cuenta de acceso.

Uso:  python seed_tripulacion.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sgo_project.settings')
django.setup()

from operaciones.models import Persona  # noqa: E402


# (rut, nombre, rol, tipo)
TRIPULACION = [
    # ── Conductores ──
    ('12.345.678-9', 'Victor Manuel Veliz Suares', 'CONDUCTOR', 'TITULAR'),
    ('9.876.543-2',  'Reinaldo Gomez Suares',      'CONDUCTOR', 'RELEVO'),
    ('13.456.789-0', 'Patricio Rolla Muñoz',       'CONDUCTOR', 'TITULAR'),
    ('14.567.890-1', 'Joao Dos Santos Lima',       'CONDUCTOR', 'TITULAR'),
    ('15.678.901-2', 'Cristián Fuentes Aravena',   'CONDUCTOR', 'TITULAR'),
    ('16.789.012-3', 'Mauricio Soto Bravo',        'CONDUCTOR', 'RELEVO'),
    ('17.890.123-4', 'Jorge Palma Riquelme',       'CONDUCTOR', 'TITULAR'),
    ('18.901.234-5', 'Nelson Cárcamo Vidal',       'CONDUCTOR', 'RELEVO'),

    # ── Asistentes ──
    ('19.012.345-6', 'Daniela Pérez Sandoval',     'ASISTENTE', 'TITULAR'),
    ('20.123.456-7', 'Camila Órdenes Fuentes',     'ASISTENTE', 'TITULAR'),
    ('21.234.567-8', 'Ignacio Bustos Leiva',       'ASISTENTE', 'TITULAR'),
    ('22.345.678-9', 'Fernanda Cortés Naranjo',    'ASISTENTE', 'RELEVO'),
]


def run():
    conductores = asistentes = 0

    for rut, nombre, rol, tipo in TRIPULACION:
        persona, creada = Persona.objects.update_or_create(
            rut=rut,
            defaults={
                'nombre': nombre,
                'rol': rol,
                'tipo': tipo,
            },
        )
        if rol == 'CONDUCTOR':
            conductores += 1
        else:
            asistentes += 1
        print(f'{"+" if creada else "="} {nombre:30} {rol}')

    print()
    print(f'Tripulación: {conductores} conductores, {asistentes} asistentes.')
    print(f'Total de personal en el sistema: {Persona.objects.count()}')
    print('Cada postura requiere 2 conductores y 1 asistente.')


if __name__ == '__main__':
    run()
