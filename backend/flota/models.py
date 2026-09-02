from django.db import models

class Bus(models.Model):
    class Estado(models.TextChoices):
        DISPONIBLE = 'DISPONIBLE', 'Disponible'
        EN_SERVICIO = 'EN_SERVICIO', 'En Servicio'
        MANTENIMIENTO = 'MANTENIMIENTO', 'Mantenimiento'
        FUERA_SERVICIO = 'FUERA_SERVICIO', 'Fuera de Servicio'

    class Servicio(models.TextChoices):
        SC = 'SC', 'Semi Cama'
        SLC = 'SLC', 'Salón Cama'
        CP = 'CP', 'Cama Premium'
        MIN = 'MIN', 'Minero'

    numero = models.CharField(max_length=20, unique=True)
    patente = models.CharField(max_length=15, unique=True)
    modelo = models.CharField(max_length=100)
    kilometraje = models.PositiveIntegerField(default=0)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.DISPONIBLE)
    servicio = models.CharField(max_length=10, choices=Servicio.choices)
    pozo = models.CharField(max_length=20, null=True, blank=True)
    proxima_postura = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        verbose_name = 'Bus'
        verbose_name_plural = 'Buses'

    def __str__(self):
        return f"{self.numero} - {self.patente}"
