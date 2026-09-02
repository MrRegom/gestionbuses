import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sgo_project.settings')
django.setup()

from flota.models import Bus

# El número interno es el que usa la planilla de Operaciones: un
# número pelado, no "BUS 101". El 17 es real; el resto son de
# muestra con el mismo formato.
buses = [
    { 'numero':'17', 'patente':'BCLK45', 'modelo':'Volvo 9800',   'kilometraje':124500, 'estado':'DISPONIBLE',    'servicio':'SLC', 'pozo':None,   'proxima_postura':'08:30' },
    { 'numero':'23', 'patente':'BCLK46', 'modelo':'Scania K440',  'kilometraje':98200,  'estado':'EN_SERVICIO',   'servicio':'SC',  'pozo':None,   'proxima_postura':'En ruta' },
    { 'numero':'28', 'patente':'BCLK47', 'modelo':'Marcopolo G8', 'kilometraje':211300, 'estado':'DISPONIBLE',    'servicio':'SC',  'pozo':None,   'proxima_postura':'10:00' },
    { 'numero':'31', 'patente':'BCLK48', 'modelo':'Volvo 9800',   'kilometraje':178900, 'estado':'MANTENIMIENTO', 'servicio':'SLC', 'pozo':'P-02', 'proxima_postura':'~14:00' },
    { 'numero':'34', 'patente':'HTYB-45','modelo':'Volvo 9800',   'kilometraje':95600,  'estado':'EN_SERVICIO',   'servicio':'SC',  'pozo':None,   'proxima_postura':'En ruta' },
    { 'numero':'42', 'patente':'BCLK50', 'modelo':'Mercedes O500','kilometraje':302100, 'estado':'DISPONIBLE',    'servicio':'MIN', 'pozo':None,   'proxima_postura':'Sin asignar' },
    { 'numero':'45', 'patente':'HTYG-21','modelo':'Marcopolo G8', 'kilometraje':56800,  'estado':'DISPONIBLE',    'servicio':'SLC', 'pozo':None,   'proxima_postura':'13:00' },
    { 'numero':'51', 'patente':'HTYD-77','modelo':'Scania K440',  'kilometraje':189400, 'estado':'FUERA_SERVICIO','servicio':'SC',  'pozo':'P-01', 'proxima_postura':'—' },
    { 'numero':'58', 'patente':'HTYF-32','modelo':'Volvo 9800',   'kilometraje':67300,  'estado':'EN_SERVICIO',   'servicio':'SLC', 'pozo':None,   'proxima_postura':'En ruta' },
    { 'numero':'63', 'patente':'HTYK-18','modelo':'Marcopolo G7', 'kilometraje':143200, 'estado':'DISPONIBLE',    'servicio':'SC',  'pozo':None,   'proxima_postura':'Sin asignar' },
]

for b in buses:
    Bus.objects.get_or_create(numero=b['numero'], defaults=b)

print("Buses seeded successfully.")
