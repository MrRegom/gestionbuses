"""
Semilla del personal de taller.

Los mecánicos son Persona con rol MECANICO: comparten RUT y nombre con el
resto del personal, y así una orden de trabajo puede apuntar a quien la
ejecuta sin duplicar el modelo de personas.

Uso:  python seed_mecanicos.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sgo_project.settings')
django.setup()

from operaciones.models import Persona  # noqa: E402


MECANICOS = [
    ('15.234.567-8', 'Rodrigo Herrera'),
    ('16.876.543-2', 'Manuel Castro'),
    ('14.555.888-1', 'Francisco Rojas'),
    ('17.222.999-5', 'Patricio Salinas'),
]


def run():
    for rut, nombre in MECANICOS:
        persona, creada = Persona.objects.update_or_create(
            rut=rut,
            defaults={
                'nombre': nombre,
                'rol': Persona.Rol.MECANICO,
                'tipo': Persona.Tipo.TITULAR,
            },
        )
        print(f'{"+" if creada else "="} {nombre} ({rut})')

    total = Persona.objects.filter(rol=Persona.Rol.MECANICO).count()
    print(f'\nPersonal de taller: {total} mecánicos.')


if __name__ == '__main__':
    run()
