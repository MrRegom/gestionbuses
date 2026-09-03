"""
Deja la base lista para planificar desde cero.

Borra el movimiento —posturas, asignaciones, checklists, incidentes,
órdenes, corridas y avisos— y conserva todo lo que cuesta volver a
cargar: la flota, la nómina, las cuentas de acceso, el catálogo de
ciudades y rutas, la plantilla del checklist y los parámetros.

La distinción es esa: se borra lo que pasó, no lo que existe.

Después de correrlo, los buses quedan disponibles y la tripulación con
el contador de horas en cero, que es como empieza una jornada.

Uso:
    python limpiar_operacion.py           # muestra qué borraría
    python limpiar_operacion.py --si      # lo borra
"""
import os
import sys

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sgo_project.settings')
django.setup()

from core.models import Notificacion  # noqa: E402
from flota.models import Bus  # noqa: E402
from mantencion.models import (  # noqa: E402
    Checklist, Incidente, OrdenTrabajo, RespuestaChecklist,
)
from operaciones.models import (  # noqa: E402
    AsignacionTripulacion, Corrida, Persona, Postura,
)


# El orden importa: primero lo que apunta a otras cosas. Aunque las
# relaciones son en cascada, borrar de arriba hacia abajo hace que los
# conteos que se imprimen sean los reales y no los de un efecto lateral.
A_BORRAR = [
    ('Avisos', Notificacion),
    ('Respuestas de checklist', RespuestaChecklist),
    ('Órdenes de trabajo', OrdenTrabajo),
    ('Checklists', Checklist),
    ('Incidentes', Incidente),
    ('Asignaciones de tripulación', AsignacionTripulacion),
    ('Posturas', Postura),
]

SE_CONSERVA = [
    ('Buses', Bus),
    ('Personal', Persona),
]


def resumen():
    print('\nSe borraría:')
    for nombre, modelo in A_BORRAR:
        print(f'  {modelo.objects.count():5}  {nombre}')
    print(f'  {Corrida.objects.count():5}  Corridas')

    print('\nSe conserva:')
    for nombre, modelo in SE_CONSERVA:
        print(f'  {modelo.objects.count():5}  {nombre}')
    print('        Ciudades, rutas, plantilla del checklist,')
    print('        cuentas de acceso y parámetros del sistema.')


def limpiar():
    print('\nBorrando:')

    # Las corridas van primero: sus movimientos apuntan a las posturas,
    # y `postura_origen` las protege de borrarse mientras exista.
    for corrida in Corrida.objects.all():
        corrida.movimientos.all().delete()
    print(f'  {Corrida.objects.all().delete()[0]:5}  Corridas')

    for nombre, modelo in A_BORRAR:
        print(f'  {modelo.objects.all().delete()[0]:5}  {nombre}')

    # ── Estado inicial de una jornada ──
    buses = Bus.objects.update(
        estado=Bus.Estado.DISPONIBLE, pozo=None, proxima_postura=None)
    print(f'\n  {buses:5}  buses vuelven a DISPONIBLE')




if __name__ == '__main__':
    resumen()

    if '--si' not in sys.argv:
        print('\nNo se borró nada. Para hacerlo:')
        print('    python limpiar_operacion.py --si')
        sys.exit(0)

    limpiar()
    print('\nListo. La base quedó sin movimiento y con la flota y la')
    print('nómina intactas: se puede planificar desde cero.')
