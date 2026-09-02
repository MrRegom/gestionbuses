import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sgo_project.settings')
django.setup()

from operaciones.models import Ciudad, Ruta, Postura
from flota.models import Bus
import datetime

# 1. Ciudades
ciudades_nombres = ['Santiago', 'Antofagasta', 'Calama', 'Concepción', 'Temuco', 'Iquique', 'La Serena']
ciudades = {}
for nombre in ciudades_nombres:
    c, _ = Ciudad.objects.get_or_create(nombre=nombre)
    ciudades[nombre] = c

# 2. Rutas
rutas_data = [
    (ciudades['Santiago'], ciudades['Antofagasta'], 18.5),
    (ciudades['Santiago'], ciudades['Calama'], 20.0),
    (ciudades['Concepción'], ciudades['Santiago'], 6.0),
    (ciudades['Santiago'], ciudades['Temuco'], 8.5),
]
rutas = []
for origen, destino, duracion in rutas_data:
    r, _ = Ruta.objects.get_or_create(origen=origen, destino=destino, defaults={'duracion_estimada': duracion})
    rutas.append(r)

# 3. Posturas (Usaremos la fecha de hoy)
hoy = datetime.date.today()
buses = list(Bus.objects.all())

posturas_data = [
    { 'codigo':'POS-001', 'ruta':rutas[0], 'fecha':hoy, 'hora_salida':'08:00', 'bus':buses[0] if len(buses)>0 else None, 'estado':'COMPLETA' },
    { 'codigo':'POS-002', 'ruta':rutas[0], 'fecha':hoy, 'hora_salida':'09:30', 'bus':buses[1] if len(buses)>1 else None, 'estado':'COMPLETA' },
    { 'codigo':'POS-003', 'ruta':rutas[0], 'fecha':hoy, 'hora_salida':'11:00', 'bus':buses[2] if len(buses)>2 else None, 'estado':'ALERTA' },
    { 'codigo':'POS-004', 'ruta':rutas[1], 'fecha':hoy, 'hora_salida':'12:30', 'bus':None, 'estado':'PROBLEMA' },
    { 'codigo':'POS-005', 'ruta':rutas[3], 'fecha':hoy, 'hora_salida':'19:00', 'bus':buses[3] if len(buses)>3 else None, 'estado':'LISTA' },
]

for p in posturas_data:
    Postura.objects.get_or_create(codigo=p['codigo'], defaults=p)

print("Planificación seeded successfully.")
