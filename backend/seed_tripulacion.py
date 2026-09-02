import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sgo_project.settings')
django.setup()

from operaciones.models import Persona

personas = [
    { 'rut':'15.342.678-5', 'nombre':'Carlos Fuentes',  'rol':'CONDUCTOR', 'tipo':'TITULAR', 'semaforo':'verde',    'horas_hoy':4, 'razon_bloqueo':None },
    { 'rut':'12.980.163-0', 'nombre':'Rodrigo Vidal',   'rol':'CONDUCTOR', 'tipo':'RELEVO',  'semaforo':'verde',    'horas_hoy':2, 'razon_bloqueo':None },
    { 'rut':'14.225.441-7', 'nombre':'Miguel Soto',     'rol':'CONDUCTOR', 'tipo':'RELEVO',  'semaforo':'amarillo', 'horas_hoy':6, 'razon_bloqueo':'Lleva 6h de jornada — Revisar descanso' },
    { 'rut':'11.445.322-K', 'nombre':'Pedro Núñez',     'rol':'CONDUCTOR', 'tipo':'TITULAR', 'semaforo':'rojo',     'horas_hoy':8, 'razon_bloqueo':'Solapamiento de horario.' },
    { 'rut':'16.778.902-3', 'nombre':'Juan Araya',      'rol':'CONDUCTOR', 'tipo':'RELEVO',  'semaforo':'verde',    'horas_hoy':1, 'razon_bloqueo':None },
    { 'rut':'13.009.887-2', 'nombre':'Felipe Rojas',    'rol':'ASISTENTE', 'tipo':'TITULAR', 'semaforo':'verde',    'horas_hoy':3, 'razon_bloqueo':None },
    { 'rut':'17.334.561-8', 'nombre':'Ana Muñoz',       'rol':'ASISTENTE', 'tipo':'TITULAR', 'semaforo':'amarillo', 'horas_hoy':5, 'razon_bloqueo':'Cerca del límite de jornada.' },
    { 'rut':'18.112.445-1', 'nombre':'Camila Torres',   'rol':'ASISTENTE', 'tipo':'RELEVO',  'semaforo':'verde',    'horas_hoy':0, 'razon_bloqueo':None },
    { 'rut':'14.567.890-4', 'nombre':'David Carrasco',  'rol':'CONDUCTOR', 'tipo':'TITULAR', 'semaforo':'verde',    'horas_hoy':3, 'razon_bloqueo':None },
]

for p in personas:
    Persona.objects.get_or_create(rut=p['rut'], defaults=p)

print("Tripulación seeded successfully.")
