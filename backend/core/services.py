"""
Avisos a la tripulación.

Las funciones que crean notificaciones se llaman desde los servicios
del dominio —planificación, corridas— y no desde las vistas, porque
avisar es parte de asignar: si alguien asigna un servicio por otro
camino, el aviso tiene que salir igual.

Ninguna falla aquí puede tumbar la operación. Que no se haya podido
guardar un aviso es un problema menor comparado con no haber podido
asignar la tripulación, así que se registra y se sigue.
"""
import logging

from .models import Notificacion

log = logging.getLogger(__name__)


def _cuando(postura):
    """'mañana 12:05' se entiende mejor que una fecha ISO."""
    from django.utils import timezone

    hoy = timezone.localdate()
    dias = (postura.fecha - hoy).days
    hora = postura.hora_salida.strftime('%H:%M')

    if dias == 0:
        return f'hoy {hora}'
    if dias == 1:
        return f'mañana {hora}'
    return f'{postura.fecha.strftime("%d-%m")} {hora}'


def _ruta_de(postura):
    ruta = postura.ruta
    return f'{ruta.origen.nombre} → {ruta.destino.nombre}'


def avisar(persona, tipo, titulo, detalle='', ruta='/', postura=None):
    try:
        return Notificacion.objects.create(
            persona=persona, tipo=tipo, titulo=titulo,
            detalle=detalle, ruta=ruta, postura=postura,
        )
    except Exception:
        # Un aviso perdido no puede deshacer una asignación correcta.
        log.exception('No se pudo crear la notificación para %s', persona)
        return None


def avisar_asignacion(asignacion):
    """A quien acaban de subir a un servicio."""
    postura = asignacion.postura
    bus = f' · bus {postura.bus.numero}' if postura.bus_id else ''
    return avisar(
        persona=asignacion.persona,
        tipo=Notificacion.Tipo.ASIGNACION,
        titulo=f'Vas en la postura {postura.codigo}',
        detalle=f'{_ruta_de(postura)} · sale {_cuando(postura)}{bus}',
        ruta='/',
        postura=postura,
    )


def avisar_desasignacion(persona, postura):
    """A quien sacaron de un servicio. Enterarse tarde de esto es peor
    que enterarse tarde de una asignación: se presenta a un viaje que
    ya no es suyo."""
    return avisar(
        persona=persona,
        tipo=Notificacion.Tipo.DESASIGNACION,
        titulo=f'Ya no vas en la postura {postura.codigo}',
        detalle=f'{_ruta_de(postura)} · salía {_cuando(postura)}',
        ruta='/',
        postura=postura,
    )


def avisar_corrida(postura, bus_anterior, bus_nuevo):
    """A toda la tripulación de un servicio que cambió de máquina.

    Es el aviso que en el proceso manual llega por WhatsApp —o no
    llega— y por el que la tripulación se presenta al andén equivocado.
    """
    destino = bus_nuevo.numero if bus_nuevo else 'sin reemplazo aún'
    creadas = []
    for asignacion in postura.tripulacion.select_related('persona'):
        creadas.append(avisar(
            persona=asignacion.persona,
            tipo=Notificacion.Tipo.CORRIDA,
            titulo=f'Cambió la máquina de la postura {postura.codigo}',
            detalle=f'Sale con el bus {destino} en vez del '
                    f'{bus_anterior.numero} · {_cuando(postura)}',
            ruta='/',
            postura=postura,
        ))
    return [c for c in creadas if c]


def avisar_cambio_bus(postura, bus_nuevo):
    """A la tripulación ya asignada cuando se le pone o cambia el bus."""
    creadas = []
    for asignacion in postura.tripulacion.select_related('persona'):
        creadas.append(avisar(
            persona=asignacion.persona,
            tipo=Notificacion.Tipo.CAMBIO_BUS,
            titulo=f'La postura {postura.codigo} sale con el bus {bus_nuevo.numero}',
            detalle=f'{_ruta_de(postura)} · {_cuando(postura)}',
            ruta='/',
            postura=postura,
        ))
    return [c for c in creadas if c]


# ══════════════════════════════════════════════════════════════
#  CONSULTA
# ══════════════════════════════════════════════════════════════
class NotificacionService:

    @staticmethod
    def mias(persona, limite=30):
        return list(
            Notificacion.objects
            .filter(persona=persona)
            .select_related('postura')[:limite]
        )

    @staticmethod
    def sin_leer(persona):
        return Notificacion.objects.filter(persona=persona, leida=False).count()

    @staticmethod
    def marcar_leidas(persona, ids=None):
        """Sin `ids`, marca todas. Devuelve cuántas cambiaron."""
        qs = Notificacion.objects.filter(persona=persona, leida=False)
        if ids:
            qs = qs.filter(id__in=ids)
        return qs.update(leida=True)
