import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sgo_project.settings')
django.setup()

from operaciones.models import Persona

# Eliminar tripulantes existentes
Persona.objects.all().delete()

personas = [
    { 'rut':'12.345.678-9', 'nombre':'Victor Manuel Veliz Suares', 'rol':'CONDUCTOR', 'tipo':'TITULAR', 'semaforo':'verde', 'horas_hoy':3, 'razon_bloqueo':None },
    { 'rut':'9.876.543-2', 'nombre':'Reinaldo Gomez Suares', 'rol':'CONDUCTOR', 'tipo':'RELEVO', 'semaforo':'verde', 'horas_hoy':2, 'razon_bloqueo':None },
]

for p in personas:
    Persona.objects.create(**p)

print("Tripulación seeded successfully with Victor and Reinaldo.")
