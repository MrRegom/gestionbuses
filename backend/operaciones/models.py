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
        # Perfil transversal: entra a todas las pantallas. No es un
        # cargo de la empresa, es la cuenta con la que se revisa y se
        # administra el sistema entero sin turnarse cinco sesiones.
        ADMIN = 'ADMIN', 'Administrador'

    class Tipo(models.TextChoices):
        TITULAR = 'TITULAR', 'Titular'
        RELEVO = 'RELEVO', 'Relevo'

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

    class Meta:
        verbose_name = 'Persona'
        verbose_name_plural = 'Personas'

    def __str__(self):
        return f"{self.nombre} ({self.rut})"

# Composición fija de la tripulación de un servicio, confirmada con
# Operaciones: dos conductores que se turnan al volante y un asistente.
# Vive aquí, y no repartida por el código, para que cambiarla sea tocar
# una sola línea.
# Valores iniciales. Los vigentes los manda `Parametros`, que se edita
# desde la pantalla de Configuración: estas cifras solo sirven para
# arrancar una base vacía.
DOTACION_INICIAL = {'CONDUCTOR': 2, 'ASISTENTE': 1}


class Parametros(models.Model):
    """Las reglas del negocio, editables sin tocar el código.

    Antes vivían como constantes de Python: cambiar el tope de horas o
    la dotación exigía un programador y un despliegue. Son decisiones de
    Operaciones, no de ingeniería, así que viven en la base.

    Es una fila única (pk=1). No se usa un modelo por parámetro porque
    son pocos y se editan juntos en una sola pantalla.
    """

    conductores_por_servicio = models.PositiveSmallIntegerField(
        default=DOTACION_INICIAL['CONDUCTOR'],
        help_text='Cuántos conductores lleva cada servicio',
    )
    asistentes_por_servicio = models.PositiveSmallIntegerField(
        default=DOTACION_INICIAL['ASISTENTE'],
        help_text='Cuántos asistentes lleva cada servicio',
    )
    actualizado_en = models.DateTimeField(auto_now=True)
    actualizado_por = models.ForeignKey(
        'Persona', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+',
    )

    class Meta:
        verbose_name = 'Parámetros del sistema'
        verbose_name_plural = 'Parámetros del sistema'

    def __str__(self):
        return (f'{self.conductores_por_servicio} conductores + '
                f'{self.asistentes_por_servicio} asistentes')

    def save(self, *args, **kwargs):
        # Fila única: cualquier guardado escribe sobre la misma.
        self.pk = 1
        super().save(*args, **kwargs)
        _vigentes.clear()

    def delete(self, *args, **kwargs):
        raise ValueError('Los parámetros del sistema no se eliminan.')

    @classmethod
    def actual(cls):
        """La configuración vigente, creándola con los valores iniciales
        la primera vez.

        Se memoriza en el proceso porque `dotacion()` se llama una vez
        por postura al pintar un listado. La memoria se limpia al
        guardar; en un despliegue con varios procesos cada uno la
        refresca al guardar el suyo o al reiniciarse.
        """
        if 'obj' not in _vigentes:
            _vigentes['obj'] = cls.objects.get_or_create(pk=1)[0]
        return _vigentes['obj']

    @property
    def dotacion(self):
        return {
            'CONDUCTOR': self.conductores_por_servicio,
            'ASISTENTE': self.asistentes_por_servicio,
        }


_vigentes = {}


def dotacion_requerida():
    """Composición de la tripulación según la configuración vigente.

    Con el tope de horas continuas, un servicio más largo que ese tope
    necesita que los conductores se releven: por eso van dos. Si algún
    día cambia, se cambia aquí —desde la pantalla— y no en el código.
    """
    return Parametros.actual().dotacion

# Por qué son dos conductores: Operaciones confirmó que el máximo son
# cinco horas continuas al volante, y los viajes duran más —el de Arica,
# treinta y dos—. A mitad de camino tienen que relevarse. No van dos por
# comodidad: con uno solo el servicio no se puede hacer.
#
# El sistema no lleva la cuenta de esas horas. Se evaluó y Operaciones
# decidió que los conductores no van a marcar cuándo toman y entregan el
# volante, así que un contador aquí sería un número que nadie alimenta.
# Lo que sí se hace cumplir es la dotación de arriba.
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
        conteo = {rol: 0 for rol in dotacion_requerida()}
        for a in self.tripulacion.all():
            if a.rol_en_viaje in conteo:
                conteo[a.rol_en_viaje] += 1
        return conteo

    def faltantes(self):
        """Cuántos faltan por rol para completar la tripulación."""
        actual = self.dotacion()
        return {
            rol: max(0, requerido - actual.get(rol, 0))
            for rol, requerido in dotacion_requerida().items()
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
