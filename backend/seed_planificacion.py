import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sgo_project.settings')
django.setup()

from operaciones.models import Ciudad, Ruta, Postura, AsignacionTripulacion
from flota.models import Bus
import datetime

# ── 1. Limpiar datos anteriores ────────────────────────────────────────────────
Postura.objects.all().delete()
Ruta.objects.all().delete()
Ciudad.objects.all().delete()

# ── 2. Ciudades reales de la operación PlussChile ──────────────────────────────
# Todos los destinos son desde/hacia Santiago (zona sur)
ciudades_nombres = [
    'Santiago',
    'Chillán',
    'Concepción',
    'Los Ángeles',
    'Talcahuano',
    'Tomé',
    'Coronel',
    'Lota',
    'Cañete',
]
ciudades = {}
for nombre in ciudades_nombres:
    c = Ciudad.objects.create(nombre=nombre)
    ciudades[nombre] = c

stgo = ciudades['Santiago']

# ── 3. Rutas IDA y VUELTA Santiago ↔ cada destino ──────────────────────────────
# (duracion_estimada en horas, estimación real por distancia)
rutas_data = [
    # IDA (Santiago → Destino)
    (stgo, ciudades['Chillán'],      5.0),
    (stgo, ciudades['Concepción'],   6.0),
    (stgo, ciudades['Los Ángeles'],  6.5),
    (stgo, ciudades['Talcahuano'],   6.5),
    (stgo, ciudades['Tomé'],         6.5),
    (stgo, ciudades['Coronel'],      6.5),
    (stgo, ciudades['Lota'],         7.0),
    (stgo, ciudades['Cañete'],       7.5),
    # VUELTA (Destino → Santiago)
    (ciudades['Chillán'],      stgo, 5.0),
    (ciudades['Concepción'],   stgo, 6.0),
    (ciudades['Los Ángeles'],  stgo, 6.5),
    (ciudades['Talcahuano'],   stgo, 6.5),
    (ciudades['Tomé'],         stgo, 6.5),
    (ciudades['Coronel'],      stgo, 6.5),
    (ciudades['Lota'],         stgo, 7.0),
    (ciudades['Cañete'],       stgo, 7.5),
]

rutas = []
for origen, destino, duracion in rutas_data:
    r = Ruta.objects.create(origen=origen, destino=destino, duracion_estimada=duracion)
    rutas.append(r)

# Mapear rutas para fácil acceso
def ruta(origen, destino):
    return Ruta.objects.get(origen__nombre=origen, destino__nombre=destino)

# ── 4. Buses disponibles ────────────────────────────────────────────────────────
buses = list(Bus.objects.all())
def bus(i): return buses[i] if len(buses) > i else None

# ── 5. Posturas del día ─────────────────────────────────────────────────────────
hoy = datetime.date.today()

posturas_data = [
    # IDA — Salidas desde Santiago (mañana y tarde)
    { 'codigo':'112201', 'ruta': ruta('Santiago','Chillán'),      'fecha':hoy, 'hora_salida':'07:00', 'bus':bus(0), 'estado':'COMPLETA' },
    { 'codigo':'112202', 'ruta': ruta('Santiago','Concepción'),   'fecha':hoy, 'hora_salida':'07:30', 'bus':bus(1), 'estado':'COMPLETA' },
    { 'codigo':'112203', 'ruta': ruta('Santiago','Los Ángeles'),  'fecha':hoy, 'hora_salida':'08:00', 'bus':bus(2), 'estado':'EN_CURSO' },
    { 'codigo':'112204', 'ruta': ruta('Santiago','Talcahuano'),   'fecha':hoy, 'hora_salida':'08:30', 'bus':bus(3), 'estado':'EN_CURSO' },
    { 'codigo':'112205', 'ruta': ruta('Santiago','Tomé'),         'fecha':hoy, 'hora_salida':'09:00', 'bus':bus(4), 'estado':'LISTA'    },
    { 'codigo':'112206', 'ruta': ruta('Santiago','Coronel'),      'fecha':hoy, 'hora_salida':'09:30', 'bus':bus(5), 'estado':'LISTA'    },
    { 'codigo':'112207', 'ruta': ruta('Santiago','Lota'),         'fecha':hoy, 'hora_salida':'10:00', 'bus':None,   'estado':'PROBLEMA' },
    { 'codigo':'112208', 'ruta': ruta('Santiago','Cañete'),       'fecha':hoy, 'hora_salida':'10:30', 'bus':bus(6), 'estado':'LISTA'    },
    # Salidas nocturnas
    { 'codigo':'112209', 'ruta': ruta('Santiago','Concepción'),   'fecha':hoy, 'hora_salida':'22:00', 'bus':bus(7), 'estado':'LISTA'    },
    { 'codigo':'112210', 'ruta': ruta('Santiago','Chillán'),      'fecha':hoy, 'hora_salida':'23:00', 'bus':bus(8), 'estado':'LISTA'    },
    # VUELTA — Salidas desde destino hacia Santiago
    { 'codigo':'112211', 'ruta': ruta('Chillán','Santiago'),      'fecha':hoy, 'hora_salida':'06:00', 'bus':bus(9), 'estado':'COMPLETA' },
    { 'codigo':'112212', 'ruta': ruta('Concepción','Santiago'),   'fecha':hoy, 'hora_salida':'06:30', 'bus':bus(0), 'estado':'COMPLETA' },
    { 'codigo':'112213', 'ruta': ruta('Los Ángeles','Santiago'),  'fecha':hoy, 'hora_salida':'07:00', 'bus':bus(1), 'estado':'ALERTA'   },
    { 'codigo':'112214', 'ruta': ruta('Talcahuano','Santiago'),   'fecha':hoy, 'hora_salida':'07:30', 'bus':bus(2), 'estado':'EN_CURSO' },
]

for p in posturas_data:
    Postura.objects.create(**p)

print(f"OK Rutas creadas: {Ruta.objects.count()}")
print(f"OK Posturas creadas: {Postura.objects.count()}")
print("Planificacion real zona sur seeded successfully.")
