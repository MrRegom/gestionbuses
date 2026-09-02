from django.db import models

class Persona(models.Model):
    class Rol(models.TextChoices):
        CONDUCTOR = 'CONDUCTOR', 'Conductor'
        ASISTENTE = 'ASISTENTE', 'Asistente'
        # El personal de taller también es Persona: comparte RUT y nombre,
        # y así una orden de trabajo puede apuntar a quien la ejecuta.
        MECANICO = 'MECANICO', 'Mecánico'

    class Tipo(models.TextChoices):
        TITULAR = 'TITULAR', 'Titular'
        RELEVO = 'RELEVO', 'Relevo'

    class Semaforo(models.TextChoices):
        VERDE = 'verde', 'Verde'
        AMARILLO = 'amarillo', 'Amarillo'
        ROJO = 'rojo', 'Rojo'

    rut = models.CharField(max_length=15, unique=True)
    nombre = models.CharField(max_length=150)
    rol = models.CharField(max_length=20, choices=Rol.choices, default=Rol.CONDUCTOR)
    tipo = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.TITULAR)
    horas_hoy = models.DecimalField(max_digits=4, decimal_places=1, default=0)
    semaforo = models.CharField(max_length=15, choices=Semaforo.choices, default=Semaforo.VERDE)
    razon_bloqueo = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        verbose_name = 'Persona'
        verbose_name_plural = 'Personas'

    def __str__(self):
        return f"{self.nombre} ({self.rut})"

class Ciudad(models.Model):
    nombre = models.CharField(max_length=100, unique=True)

    class Meta:
        verbose_name = 'Ciudad'
        verbose_name_plural = 'Ciudades'

    def __str__(self):
        return self.nombre

class Ruta(models.Model):
    origen = models.ForeignKey(Ciudad, on_delete=models.RESTRICT, related_name='rutas_origen')
    destino = models.ForeignKey(Ciudad, on_delete=models.RESTRICT, related_name='rutas_destino')
    duracion_estimada = models.DecimalField(max_digits=4, decimal_places=1, help_text='Horas estimadas')

    class Meta:
        verbose_name = 'Ruta'
        verbose_name_plural = 'Rutas'

    def __str__(self):
        return f"{self.origen.nombre} -> {self.destino.nombre}"

class Postura(models.Model):
    class Estado(models.TextChoices):
        LISTA = 'LISTA', 'Lista'
        ALERTA = 'ALERTA', 'Alerta'
        PROBLEMA = 'PROBLEMA', 'Problema'
        EN_CURSO = 'EN_CURSO', 'En Curso'
        COMPLETA = 'COMPLETA', 'Completa'

    codigo = models.CharField(max_length=20, unique=True)
    ruta = models.ForeignKey(Ruta, on_delete=models.RESTRICT)
    fecha = models.DateField()
    hora_salida = models.TimeField()
    bus = models.ForeignKey('flota.Bus', on_delete=models.SET_NULL, null=True, blank=True)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.LISTA)

    class Meta:
        verbose_name = 'Postura'
        verbose_name_plural = 'Posturas'
        ordering = ['fecha', 'hora_salida']

    def __str__(self):
        return self.codigo

class AsignacionTripulacion(models.Model):
    postura = models.ForeignKey(Postura, on_delete=models.CASCADE, related_name='tripulacion')
    persona = models.ForeignKey(Persona, on_delete=models.CASCADE)
    rol_en_viaje = models.CharField(max_length=20, choices=Persona.Rol.choices)

    class Meta:
        verbose_name = 'Asignación de Tripulación'
        verbose_name_plural = 'Asignaciones de Tripulación'
        unique_together = ('postura', 'persona')

    def __str__(self):
        return f"{self.persona.nombre} en {self.postura.codigo}"
