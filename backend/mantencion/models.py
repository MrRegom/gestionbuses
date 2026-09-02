from django.db import models


# ══════════════════════════════════════════════════════════════
#  PLANTILLA DEL CHECKLIST
#  Las categorías y sus ítems son datos, no código: el jefe de
#  operaciones puede cambiarlos sin tocar el sistema. Se cargan
#  con seed_checklist.py.
# ══════════════════════════════════════════════════════════════
class CategoriaChecklist(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    orden = models.PositiveSmallIntegerField(default=0)
    activa = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Categoría de Checklist'
        verbose_name_plural = 'Categorías de Checklist'
        ordering = ['orden', 'id']

    def __str__(self):
        return self.nombre


class ItemChecklist(models.Model):
    categoria = models.ForeignKey(
        CategoriaChecklist, on_delete=models.CASCADE, related_name='items'
    )
    descripcion = models.CharField(max_length=200)
    orden = models.PositiveSmallIntegerField(default=0)
    # Una falla en un ítem crítico deja el bus fuera de servicio, no
    # solo en mantenimiento. Ej: frenos, luces, extintores.
    critico = models.BooleanField(
        default=False,
        help_text='Si falla, el bus queda fuera de servicio de inmediato',
    )
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Ítem de Checklist'
        verbose_name_plural = 'Ítems de Checklist'
        ordering = ['categoria__orden', 'orden', 'id']
        unique_together = ('categoria', 'descripcion')

    def __str__(self):
        return f'{self.categoria.nombre} · {self.descripcion}'


# ══════════════════════════════════════════════════════════════
#  CHECKLIST EJECUTADO
# ══════════════════════════════════════════════════════════════
class Checklist(models.Model):
    class Momento(models.TextChoices):
        SALIDA = 'SALIDA', 'Preventivo de salida'
        LLEGADA = 'LLEGADA', 'Recepción en terminal'

    class Estado(models.TextChoices):
        EN_CURSO = 'EN_CURSO', 'En curso'
        COMPLETADO = 'COMPLETADO', 'Completado'

    bus = models.ForeignKey(
        'flota.Bus', on_delete=models.PROTECT, related_name='checklists'
    )
    postura = models.ForeignKey(
        'operaciones.Postura', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='checklists',
    )
    # FK a Persona desde el primer día. Hoy la elige el usuario; cuando
    # exista autenticación se rellenará con el usuario de la sesión sin
    # necesidad de migrar el esquema.
    reportado_por = models.ForeignKey(
        'operaciones.Persona', on_delete=models.PROTECT, related_name='checklists'
    )
    momento = models.CharField(
        max_length=10, choices=Momento.choices, default=Momento.SALIDA
    )
    estado = models.CharField(
        max_length=12, choices=Estado.choices, default=Estado.EN_CURSO
    )
    observaciones = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    completado_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Checklist'
        verbose_name_plural = 'Checklists'
        ordering = ['-creado_en']

    def __str__(self):
        return f'Checklist {self.get_momento_display()} · {self.bus.numero}'

    @property
    def total_respuestas(self):
        return self.respuestas.count()

    @property
    def total_fallas(self):
        return self.respuestas.filter(estado=RespuestaChecklist.Estado.FALLA).count()


class RespuestaChecklist(models.Model):
    class Estado(models.TextChoices):
        OK = 'OK', 'Conforme'
        FALLA = 'FALLA', 'Con falla'
        NA = 'NA', 'No aplica'

    checklist = models.ForeignKey(
        Checklist, on_delete=models.CASCADE, related_name='respuestas'
    )
    item = models.ForeignKey(ItemChecklist, on_delete=models.PROTECT)
    estado = models.CharField(max_length=5, choices=Estado.choices)
    observacion = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name = 'Respuesta de Checklist'
        verbose_name_plural = 'Respuestas de Checklist'
        # Un ítem se responde una sola vez por checklist.
        unique_together = ('checklist', 'item')
        ordering = ['item__categoria__orden', 'item__orden']

    def __str__(self):
        return f'{self.item.descripcion}: {self.estado}'


# ══════════════════════════════════════════════════════════════
#  INCIDENTE
#  Nace de una falla del checklist o lo reporta la tripulación en
#  ruta desde el celular. Es la cola de trabajo de Mantención.
# ══════════════════════════════════════════════════════════════
class Incidente(models.Model):
    class Gravedad(models.TextChoices):
        BAJA = 'BAJA', 'Baja'
        MEDIA = 'MEDIA', 'Media'
        ALTA = 'ALTA', 'Alta'

    class Estado(models.TextChoices):
        ABIERTO = 'ABIERTO', 'Abierto'
        EN_REVISION = 'EN_REVISION', 'En revisión'
        RESUELTO = 'RESUELTO', 'Resuelto'
        DESCARTADO = 'DESCARTADO', 'Descartado'

    class Origen(models.TextChoices):
        CHECKLIST = 'CHECKLIST', 'Checklist'
        RUTA = 'RUTA', 'Reportado en ruta'

    codigo = models.CharField(max_length=20, unique=True)
    bus = models.ForeignKey(
        'flota.Bus', on_delete=models.PROTECT, related_name='incidentes'
    )
    postura = models.ForeignKey(
        'operaciones.Postura', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='incidentes',
    )
    reportado_por = models.ForeignKey(
        'operaciones.Persona', on_delete=models.PROTECT, related_name='incidentes'
    )
    descripcion = models.TextField()
    gravedad = models.CharField(
        max_length=6, choices=Gravedad.choices, default=Gravedad.MEDIA
    )
    estado = models.CharField(
        max_length=12, choices=Estado.choices, default=Estado.ABIERTO
    )
    origen = models.CharField(
        max_length=10, choices=Origen.choices, default=Origen.RUTA
    )
    # Trazabilidad: de qué checklist y de qué ítem salió el incidente.
    checklist = models.ForeignKey(
        Checklist, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='incidentes',
    )
    item = models.ForeignKey(
        ItemChecklist, on_delete=models.SET_NULL, null=True, blank=True
    )
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Incidente'
        verbose_name_plural = 'Incidentes'
        ordering = ['-creado_en']

    def __str__(self):
        return f'{self.codigo} · {self.bus.numero}'
