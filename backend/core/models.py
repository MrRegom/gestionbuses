from django.db import models


class Notificacion(models.Model):
    """Aviso dirigido a una persona.

    Resuelve el segundo punto de dolor del README: la dependencia de
    WhatsApp para las asignaciones críticas. Hasta ahora el sistema
    guardaba correctamente que un conductor iba en un servicio, pero no
    se lo decía a nadie: el conductor tenía que entrar a mirar. Si no
    entraba, seguía enterándose por mensaje, que es justo lo que se
    quería eliminar.

    Es deliberadamente simple —una fila por aviso, leída o no leída— y
    no un sistema de mensajería. El canal es la propia aplicación: la
    campana de la barra superior. Un envío por push o SMS se agregaría
    encima de esta tabla sin cambiarla.
    """

    class Tipo(models.TextChoices):
        ASIGNACION = 'ASIGNACION', 'Te asignaron un servicio'
        DESASIGNACION = 'DESASIGNACION', 'Te quitaron de un servicio'
        CAMBIO_BUS = 'CAMBIO_BUS', 'Cambió la máquina de tu servicio'
        CORRIDA = 'CORRIDA', 'Corrida en un servicio tuyo'

    persona = models.ForeignKey(
        'operaciones.Persona', on_delete=models.CASCADE,
        related_name='notificaciones',
    )
    tipo = models.CharField(max_length=15, choices=Tipo.choices)
    titulo = models.CharField(max_length=120)
    detalle = models.CharField(max_length=255, blank=True)
    # A qué pantalla lleva el aviso al tocarlo.
    ruta = models.CharField(max_length=60, default='/')
    # Trazabilidad: de qué servicio salió. SET_NULL para que borrar una
    # postura no se lleve el historial de lo que se avisó sobre ella.
    postura = models.ForeignKey(
        'operaciones.Postura', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='notificaciones',
    )
    leida = models.BooleanField(default=False)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Notificación'
        verbose_name_plural = 'Notificaciones'
        ordering = ['-creado_en']
        indexes = [
            # La consulta que se hace en cada carga de pantalla es
            # "las mías, sin leer primero".
            models.Index(fields=['persona', 'leida', '-creado_en']),
        ]

    def __str__(self):
        return f'{self.persona.nombre}: {self.titulo}'
