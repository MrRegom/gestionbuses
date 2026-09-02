from django.core.validators import RegexValidator
from django.db import models

class Persona(models.Model):
    class Rol(models.TextChoices):
        CONDUCTOR = 'CONDUCTOR', 'Conductor'
        ASISTENTE = 'ASISTENTE', 'Asistente'
        # El personal de taller también es Persona: comparte RUT y nombre,
        # y así una orden de trabajo puede apuntar a quien la ejecuta.
        MECANICO = 'MECANICO', 'Mecánico'
        # Perfiles de mando y monitoreo (README §3). No conducen ni
        # reparan, pero necesitan cuenta para operar el sistema.
        JEFE_OPERACIONES = 'JEFE_OPERACIONES', 'Jefe de Operaciones'
        JEFE_MECANICOS = 'JEFE_MECANICOS', 'Jefe de Mecánicos'
        MONITOREO = 'MONITOREO', 'Sala de Monitoreo'

    class Tipo(models.TextChoices):
        TITULAR = 'TITULAR', 'Titular'
        RELEVO = 'RELEVO', 'Relevo'

    class Semaforo(models.TextChoices):
        VERDE = 'verde', 'Verde'
        AMARILLO = 'amarillo', 'Amarillo'
        ROJO = 'rojo', 'Rojo'

    # Vincula la persona del dominio con su cuenta de acceso. Nulo
    # mientras alguien no tenga login (ej. un asistente sin celular).
    usuario = models.OneToOneField(
        'auth.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='persona',
    )
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

# Composición fija de la tripulación de un servicio, confirmada con
# Operaciones: dos conductores que se turnan al volante y un asistente.
# Vive aquí, y no repartida por el código, para que cambiarla sea tocar
# una sola línea.
DOTACION_REQUERIDA = {
    'CONDUCTOR': 2,
    'ASISTENTE': 1,
}


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

    # Código operativo con el que la empresa identifica el servicio.
    # Confirmado con Operaciones: numérico de seis dígitos (ej. 112218).
    # Se guarda como texto para no perder ceros a la izquierda; si algún
    # día aparece otro largo, el cambio es este regex y nada más.
    codigo = models.CharField(
        max_length=20, unique=True,
        validators=[RegexValidator(
            r'^\d{6}$',
            'El código de postura son seis dígitos numéricos (ej. 112218).',
        )],
    )
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

    def dotacion(self):
        """Cuántos van asignados por rol."""
        conteo = {rol: 0 for rol in DOTACION_REQUERIDA}
        for a in self.tripulacion.all():
            if a.rol_en_viaje in conteo:
                conteo[a.rol_en_viaje] += 1
        return conteo

    def faltantes(self):
        """Cuántos faltan por rol para completar la tripulación."""
        actual = self.dotacion()
        return {
            rol: max(0, requerido - actual[rol])
            for rol, requerido in DOTACION_REQUERIDA.items()
        }

    @property
    def dotacion_completa(self):
        return not any(self.faltantes().values())

    @property
    def recursos_completos(self):
        """Lista para salir: con máquina y con la tripulación completa."""
        return self.bus_id is not None and self.dotacion_completa

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


class Corrida(models.Model):
    """Reemplazo de máquina cuando un bus se cae (README §2.5).

    Una corrida es el retraso en cadena que se produce si un bus falla y
    nadie reasigna sus servicios. Registrarla deja constancia de qué bus
    sustituyó a cuál, por qué, y qué posturas se traspasaron.
    """

    class Estado(models.TextChoices):
        ACTIVA = 'ACTIVA', 'Activa'
        CERRADA = 'CERRADA', 'Cerrada'

    bus_original = models.ForeignKey(
        'flota.Bus', on_delete=models.PROTECT, related_name='corridas_como_original'
    )
    bus_sustituto = models.ForeignKey(
        'flota.Bus', on_delete=models.PROTECT,
        null=True, blank=True, related_name='corridas_como_sustituto',
        help_text='Nulo si aún no se consigue reemplazo',
    )
    motivo = models.TextField()
    estado = models.CharField(
        max_length=8, choices=Estado.choices, default=Estado.ACTIVA
    )
    creado_por = models.ForeignKey(
        Persona, on_delete=models.PROTECT, related_name='corridas'
    )
    # Las posturas que se traspasaron del bus original al sustituto.
    posturas = models.ManyToManyField(
        Postura, related_name='corridas', blank=True
    )
    creado_en = models.DateTimeField(auto_now_add=True)
    cerrado_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Corrida'
        verbose_name_plural = 'Corridas'
        ordering = ['-creado_en']

    def __str__(self):
        destino = self.bus_sustituto.numero if self.bus_sustituto else 'sin reemplazo'
        return f'{self.bus_original.numero} → {destino}'
