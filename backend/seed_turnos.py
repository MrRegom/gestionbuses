"""
Ciclos de turno.

Operaciones nombró dos: 10x4 y 14x7. Se cargan como datos porque un
ciclo nuevo es una decisión de ellos, no un cambio de código; se agregan
y editan desde Configuración.

Este script solo deja los ciclos disponibles. Asignarle un ciclo a cada
persona —y desde qué día le corre— se hace en su ficha, porque el dato
de cuándo empezó su vuelta lo tiene Operaciones y nadie más.

Uso:  python seed_turnos.py
"""
import os

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sgo_project.settings')
django.setup()

from operaciones.models import CicloTurno  # noqa: E402


CICLOS = [
    ('10x4', 10, 4),
    ('14x7', 14, 7),
]


def run():
    for nombre, trabajo, descanso in CICLOS:
        ciclo, creado = CicloTurno.objects.update_or_create(
            nombre=nombre,
            defaults={'dias_trabajo': trabajo,
                      'dias_descanso': descanso,
                      'activo': True},
        )
        print(f'{"+" if creado else "="} {nombre}: {trabajo} de trabajo, '
              f'{descanso} de descanso (ciclo de {ciclo.largo} días)')

    print()
    print('Los ciclos quedan disponibles. El turno de cada persona se')
    print('asigna en su ficha, en la pantalla de Conductores.')


if __name__ == '__main__':
    run()
