# SGO · Sistema de Gestión Operacional — PlussChile

> Este archivo se carga solo al abrir el proyecto. Es el contexto que no
> se puede deducir leyendo el código: qué significan las palabras del
> negocio, qué está confirmado y qué es suposición, y por qué algunas
> decisiones son como son.
>
> Para lo *estructural* —quién llama a qué, dónde vive una clase— usar
> el grafo: `graphify explain "CorridaService"`, `graphify path "A" "B"`.
> Se reconstruye solo en cada commit.

## Qué es

Digitaliza la operación de una flota de buses interurbanos que hoy
funciona con papel, planillas Excel y WhatsApp. Reemplaza a un
**digitador** que transcribe formularios a mano.

El principio del proyecto, en una línea: **la información debe llegar al
responsable antes de que el problema llegue físicamente con el bus.**

Los dos dolores que la empresa nombró como principales:

1. El tiempo que tarda Operaciones en enterarse de una falla.
2. Los turnos y la asignación de tripulantes.

Los dos están resueltos: el checklist digital resuelve el primero, y
los ciclos de turno el segundo.

## El vocabulario (esto es lo que más cuesta recuperar)

| Palabra | Qué es de verdad |
|---|---|
| **Postura** | Un servicio concreto: código de 6 dígitos, ruta, fecha, hora de salida, bus y tripulación. Ej. `112218`. |
| **Corrida** | El **adelanto en cadena** de las salidas cuando un bus se cae. NO es reemplazar por un bus de reserva. |
| **Pozo** | La fosa del taller donde se estaciona el bus para repararlo. "Está en el pozo" = en mantención. |
| **Jefe de máquina** | El conductor a cargo del viaje. Revisa los papeles antes de entregarlos a finanzas. |
| **2° conductor** | El otro conductor. Se turnan al volante. |
| **Auxiliar / Asistente** | Carga equipaje, controla pasajeros, asea el bus al final. |
| **Aumento** | Postura extra que se agrega cuando la venta está buena. |

### La corrida, en detalle

Es el concepto que más fácil se malinterpreta. Textual de Operaciones:

> "si el bus que iba a las 10:00 no puede salir por mantención, el bus
> que iba a las 11:00 cubre esa postura, por lo cual todas las que salen
> más tarde se van corriendo, hasta que el bus que quedó en los pozos
> sale y ahí se detiene la corrida"

O sea: **se corre la fila**. El último servicio de la cadena queda sin
máquina esperando a la que sale del pozo. No se busca un bus libre
porque **no hay buses libres** — la falta de máquinas es su mayor
problema.

## Reglas confirmadas por Operaciones

Estas salieron del levantamiento y de conversaciones con Manolo, que
conoce el proceso de punta a punta. **No inventar alrededor de ellas.**

- **Dotación:** 3 personas por servicio — jefe de máquina, 2° conductor
  y auxiliar. Configurable, pero jefe de máquina hay uno y solo uno.
- **Máximo 5 horas continuas al volante.** Es la razón de que vayan dos
  conductores: los viajes duran más (Arica son 32 h) y a mitad de camino
  se relevan. **El sistema no lleva ese contador** — se evaluó y
  Operaciones decidió que los conductores no marcan horas en la app.
- **Código de postura:** seis dígitos numéricos.
- **Número interno del bus:** número pelado, no "BUS 101". El 17 es real.
- **El checklist es uno por viaje, al llegar a Santiago.** No hay
  checklist de salida.
- **Quien reporta no clasifica.** El conductor detalla la falla;
  Mantención decide gravedad y prioridad.
- **Lo que deja un bus fuera de servicio de inmediato:** fuga de aire en
  los circuitos, falla de frenos, falla de dirección, falla en frenos
  auxiliares, parabrisas rotos. Y aparte: **presencia de chinches**.
- **Oficios del taller:** mecánico, eléctrico, carrocero, vulcanizador.
  La plantilla del checklist está agrupada igual, porque así es la hoja
  de papel: el jefe de mecánicos la lee y reparte según quién arregla qué.
- **Quién libera un bus:** el jefe de mecánicos, a veces tras una prueba
  en ruta.
- **Prioridad de reparación:** criterio del jefe de mecánicos, mirando
  qué postura tiene ese bus.
- **Prioridad de posturas cuando faltan buses:** lunes y martes primero
  minería; después, la salida más próxima.
- **Turnos:** ciclos **10x4** y **14x7**. El flujo es *turnos →
  disponibilidad → postura → asignación*: el turno dice cuándo alguien
  puede, la asignación a qué servicio va. Quien descansa no aparece al
  armar una postura.
- **GPS:** usan SINACH (marco legal, vía Fenabus) más un sistema interno.
  No saben qué empresa lo provee ni si tiene API.
- **Hoy la planificación se avisa por WhatsApp.** Eliminarlo es el objetivo.

## Lo que es invención mía y hay que reemplazar

Todo esto se edita desde la app, sin tocar código. Pero el contenido
tiene que salir de ellos.

- **Los ítems del checklist** (36). Los 6 marcados como **críticos** sí
  son reales; el resto son suposiciones. Es lo más urgente de validar:
  define qué revisa el conductor cada mañana.
- **La flota.** Solo el bus 17 es real; los otros nueve números,
  patentes y modelos los inventé.
- **La nómina.** Reales: Victor Veliz, Patricio Rolla y Joao Dos Santos.
  Los otros ~45 los generé para que la programación cuadrara.
- **Duraciones de rutas al norte.** Solo Arica (32 h) está confirmada.
  Calama 22 h, Iquique 27 h y Antofagasta 18 h son estimaciones.
- **Pozos** ("POZO 1" a "POZO 4") y la historia de `seed_operacion.py`.

## Preguntas abiertas

1. Al gestionar una corrida, ¿solo cambian la máquina o también mueven
   horarios de salida? La frase "adelantar servicios" podría significar
   lo segundo, y eso sería una función que no existe.
2. ¿Qué empresa provee el GPS interno y tiene API?
3. ¿Quiénes de la tripulación necesitan cuenta en la app? Hoy no hay
   pantalla para crearlas — salen de un script.

## Arquitectura

**Backend** Django 5.2 + DRF, por capas:
`models → repositories → services → serializers → views → urls`.
La lógica de negocio vive en los **services**; las vistas solo traducen
HTTP. Si una regla se puede escribir en dos lados, va en el service.

Apps: `core` (auth, permisos, notificaciones), `operaciones`
(posturas, tripulación, corridas, parámetros), `flota` (buses),
`mantencion` (checklist, incidentes, órdenes), `reportes` (dashboard e
indicadores).

**Frontend** React 19 + Vite, HashRouter, axios. Sin librería de estado:
cada pantalla pide lo suyo.

**Base** SQLite. En Vercel vive en `/tmp` y se pierde — ver README §5.

### Reglas de diseño que ya costaron caro

- **Las reglas del negocio viven en el servidor, nunca copiadas en el
  frontend.** Hubo un `HORAS_MAX = 9` duplicado en una pantalla que
  quedó desfasado cuando cambió la regla. Lo configurable viaja en la
  sesión (`reglas`).
- **El puesto en el viaje no es el cargo de la persona.** `Persona.rol`
  es lo que alguien *es*; `AsignacionTripulacion.rol_en_viaje` es lo que
  *hace* en ese viaje.
- **Solapamiento por ventana de tiempo, no por fecha.** Un viaje de 32 h
  cruza días. Filtrar por `fecha` igual dejaba pasar choques reales.
- **Avisar es parte de asignar.** Las notificaciones se emiten desde los
  services, no desde las vistas.
- **Nada de cifras inventadas en pantalla.** Si no hay datos, la
  pantalla lo dice. Un número falso se cree; un vacío se nota.

## Cómo se trabaja

```bash
cd C:\proyectos\buses && iniciar.bat     # levanta Django y Vite
```

Local es donde se trabaja (los datos se guardan). Vercel es solo la
vitrina para el cliente y **pierde todo lo que se cargue ahí**.

Cuentas: `admin`, `operaciones`, `taller`, `monitoreo`, `vveliz`,
`rherrera` — contraseña `sgo2026`. `admin` entra a todo y a `/admin`.

```bash
python limpiar_operacion.py --si   # vacía el movimiento, conserva catálogos
python seed_operacion.py --reset   # 30 días de historia de muestra
```

### Verificar antes de decir que algo funciona

Hay suites en el scratchpad de la sesión (`test_*.py`) que corren contra
el servidor real. **Y además hay que abrir la pantalla**: una vez un
`ReferenceError` en JSX pasó el build y las 177 pruebas de API, y la
pantalla salía en blanco. Compilar no es funcionar.

El servidor se levanta con `--noreload` en las pruebas: **si se edita
Python hay que reiniciarlo** o se depura código viejo.

## Convenciones

- **Todo en castellano**: código, comentarios, mensajes, commits.
- Los comentarios explican **por qué**, no qué. Si documentan una
  decisión que se tomó contra una alternativa razonable, mejor.
- Los mensajes de error se le hablan al usuario: dicen qué pasó y qué
  hacer, no un código.
- Los commits cuentan el problema antes que la solución.

## Estado

Construido: turnos, planificación, corridas, flota, tripulación,
checklist, incidentes, taller, dashboard por perfil, auditoría,
configuración, notificaciones, autenticación por rol.

Pendiente: rastreo GPS, planilla de ruta, nómina de pasajeros, avisos
por WhatsApp, y una pantalla para crear cuentas de acceso.

Antes de producción: `DEBUG=True`, `SECRET_KEY` por defecto,
`ALLOWED_HOSTS=['*']` y las contraseñas del seed. Y PostgreSQL.
