# Sistema de Gestión Operacional (SGO) - PlussChile

Este documento describe detalladamente la arquitectura, los procesos de negocio, los perfiles de usuario y el estado actual del **Sistema de Gestión Operacional (SGO)** para la flota de buses de PlussChile. Su objetivo es servir como la **guía definitiva** para que cualquier desarrollador o Inteligencia Artificial entienda el proyecto a la perfección.

---

## 1. Visión y Objetivo del Proyecto

Actualmente, la operación de buses de PlussChile depende en gran medida de procesos manuales: comunicación por WhatsApp o radio, checklists en papel, transcripción de datos físicos por digitadores y control de turnos en Excel. Esto genera problemas de trazabilidad, demoras en la comunicación entre Operaciones y Mantención, y el riesgo de generar "corridas" (retrasos en cadena) cuando un bus falla y la información no fluye rápido.

**El objetivo del SGO es digitalizar el 100% de la operación diaria:**
Crear una plataforma web centralizada (Responsive, estilo "App Nativa" para celulares y corporativa para desktop), donde cada actor del proceso interactúe en tiempo real. Desde la planificación de los viajes (posturas) hasta el reporte de fallas en ruta y la liberación del bus en el taller mecánico.

### Los Puntos de Dolor que Resolvemos:
- ❌ Eliminación del papel (Checklists físicos y firmas manuales).
- ❌ Eliminación de la dependencia de WhatsApp para asignaciones críticas.
- ❌ Eliminación de las "corridas" sorpresa por falta de comunicación entre Mantención y Operaciones.
- ✅ Visibilidad 100% en tiempo real del estado de cada bus y cada conductor.

---

## 2. Flujo de Procesos de Negocio (El "As-Is" digitalizado)

El sistema soporta los siguientes procesos clave basados en la operación real:

### 1. Planificación de Posturas (Viajes)
- **Definición:** El Jefe de Operaciones define los viajes necesarios.
- **Creación:** El Programador crea las "Posturas" (ej. `SGO-CH-001` Santiago → Chillán).
- **Asignación de Recursos:** A la postura se le asigna un **Bus** y una **Tripulación** (normalmente 2 Conductores y 1 Asistente).
- *Digitalización:* El sistema consolida todo en un "Dashboard de Planificación".

### 2. Ejecución del Viaje
- **En Ruta:** La tripulación realiza el viaje.
- **Checklist Digital:** Si hay una falla o novedad durante el viaje, el conductor la registra **directamente en su celular** a través de la App SGO, en lugar de anotarla en papel al final del viaje.

### 3. Llegada y Recepción (Terminal Santiago)
- **Checklist de Cierre:** El bus llega al terminal y ahí se hace la revisión. Es **una por viaje**: Operaciones confirmó que el checklist se llena al llegar a Santiago, no antes de salir.
- **La plantilla está agrupada por oficio** —mecánico, eléctrico, carrocero, vulcanización, informática— porque así está la hoja de papel: el jefe de mecánicos la lee y reparte el trabajo según quién sabe hacer cada cosa.
- **El conductor detalla, Mantención clasifica.** Quien reporta describe la falla y nada más; la gravedad y la prioridad las decide el taller. Una falla recién reportada queda *sin clasificar* hasta que la vea.
- **Eliminación del Digitador:** Ya no es necesario que un digitador transcriba papeles. La información de fallas viaja instantáneamente a la cola de trabajo de Mantención.

> **Qué deja un bus fuera de servicio de inmediato**, según Operaciones: fuga de aire en los circuitos, falla de frenos, falla de dirección, falla en el sistema de frenos auxiliares y parabrisas rotos. Aparte, la presencia de chinches. Esos son los ítems marcados como críticos en la plantilla, y son los únicos que deberían estarlo mientras no lo confirmen ellos.

### 4. Mantención (Taller / Pozos Mecánicos)
- **Revisión y Asignación:** El Jefe de Mecánicos ve las fallas reportadas en tiempo real. Asigna el trabajo a sus mecánicos según especialidad.
- **Reparación:** Los mecánicos registran su trabajo.
- **Decisión y Liberación:** 
  - Si el bus queda operativo: El Jefe aprueba y lo libera al sistema.
  - Si **NO** queda operativo: El sistema alerta automáticamente a Operaciones de que el bus está "caído".

### 5. Operaciones y "Corridas"
- **Monitoreo:** La Sala de Operaciones (Dashboard) monitorea las alertas.
- **Gestión de Corridas:** Una corrida es el **adelanto en cadena de las salidas** cuando una máquina se cae. Operaciones lo describió así: si el bus de las 10:00 no puede salir por mantención, el de las 11:00 cubre esa postura; entonces el de las 12:00 cubre la de las 11:00, y así se van corriendo todas las salidas posteriores, hasta que el bus que quedó en el pozo sale y ahí se detiene la corrida.

> **No es un reemplazo por un bus de reserva.** La empresa no tiene máquinas de sobra —"la falta de máquinas para todas las posturas" es su principal problema— y por eso el mecanismo consiste en correr la fila. El sistema calcula la cascada y Operaciones decide hasta dónde se corre; el último servicio de la cadena queda esperando la máquina del pozo.

---

## 3. Perfiles de Usuario (Roles)

Para soportar el flujo anterior, el SGO requiere los siguientes perfiles con accesos restringidos según su labor:

1. **Jefe de Operaciones / Programador:** Acceso total a Planificación, Flota y Conductores. Crea posturas y asigna recursos.
2. **Conductores / Asistentes:** Usan principalmente la vista móvil. Ven sus posturas asignadas ("Mi Ficha") y llenan el Checklist de incidentes/novedades del bus.
3. **Jefe de Mecánicos:** Acceso al módulo de Mantenimiento. Recibe los checklists, asigna tareas a mecánicos y aprueba la liberación de máquinas.
4. **Mecánicos:** Vista móvil o tablet para ver sus órdenes de trabajo asignadas en el pozo mecánico y marcarlas como completadas.
5. **Sala de Monitoreo:** Acceso al Dashboard de solo lectura o alta prioridad para reaccionar ante alertas rojas (buses caídos, corridas activas, servicios sin dotación).

*(El rol del antiguo "Digitador" desaparece o se transforma, ya que los datos nacen digitales).*

---

## 4. Arquitectura y Stack Tecnológico

El proyecto está concebido con una arquitectura moderna y separada (Frontend / Backend):

- **Frontend:** React.js (Vite).
  - Estilo de diseño corporativo "Microsoft Fluent" (neutro, profesional, limpio).
  - Totalmente *Mobile-First*. Las tablas complejas se transforman en *Cards* en pantallas pequeñas usando CSS avanzado.
  - Enrutamiento basado en Hash (`HashRouter`) para evitar errores 404 en el servidor estático.
- **Backend:** Python (Django REST Framework).
  - Expone APIs RESTful para el frontend.
  - Contiene los modelos de dominio: `Persona` (Conductores), `Bus`, `Postura`, `Ruta`, etc.
- **Base de Datos:** SQLite (actualmente).
  - Contiene scripts de "semilla" (seeders) para cargar datos de prueba consistentes (ej. `seed_planificacion.py` con las rutas reales del sur de Chile).

---

## 5. Despliegue y Conexión GitHub -> Vercel

El proyecto está configurado para integración y despliegue continuo (CI/CD) utilizando **Vercel** conectado directamente al repositorio de **GitHub** (`MrRegom/gestionbuses`).

### Flujo de Trabajo (Workflow):
1. **Desarrollo Local:** Los cambios se realizan y prueban en el entorno local (React Vite en `localhost:5173` y Django en `localhost:8000`).
2. **Git Commit & Push:** Al enviar cambios a la rama `main` de GitHub (`git push origin main`), Vercel detecta automáticamente la actualización.
3. **Build & Deploy:** Vercel ejecuta los comandos de construcción.
   - Construye el frontend (`npm run build`).
   - Levanta el backend como funciones *Serverless* (usando el archivo `wsgi.py`).
4. **Producción:** En segundos, los cambios están en vivo en la URL pública: `gestionbuses.vercel.app`.

### Dónde se trabaja y dónde se muestra

**El entorno de trabajo es el local. Vercel es solo la ventana para que el cliente mire.**

La distinción importa porque en Vercel *no se puede guardar nada*. La base
`db.sqlite3` viaja en el repositorio y Vercel la copia a `/tmp` en cada
arranque, porque el sistema de archivos es de solo lectura. Cuando la función
se recicla —tras un despliegue o tras un rato sin uso— esa copia vuelve a
cero. Se pierde:

- Todo lo que alguien haya cargado desde la aplicación: buses, posturas,
  asignaciones, checklists.
- Las sesiones abiertas, porque Django las guarda en la base. Por eso en
  Vercel el sistema pide entrar de nuevo cada cierto tiempo.

Lo que sí sobrevive es lo que está en el repositorio, que es la semilla. Por
eso el demo siempre vuelve a verse igual.

En consecuencia:

| | Local | Vercel |
|---|---|---|
| Se guarda lo que cargas | Sí | No |
| Sesión estable | Sí | Se cae al reciclar |
| Sirve para trabajar | Sí | No |
| Sirve para mostrar | — | Sí |

Los datos que se vean en el demo son los que estaban en `db.sqlite3` al hacer
el último `git push`: lo que se trabaja en local termina siendo lo que el
cliente ve.

### Levantar el entorno local

Dos terminales, una por servicio:

```bash
cd backend && python manage.py runserver
```

```bash
cd frontend && npm run dev
```

La aplicación queda en `http://localhost:5173`. Vite reenvía `/api` a Django
en el puerto 8000 (ver `vite.config.js`), igual que Vercel en producción.

### Cuándo dejar de trabajar así

Este arreglo funciona mientras el sistema se construye y se revisa. Deja de
servir el día que haya usuarios reales cargando datos, porque entonces hace
falta que lo cargado no se pierda y que dos personas puedan escribir a la vez
—dos cosas que SQLite sobre `/tmp` no da. Ese es el momento de migrar a
PostgreSQL (Neon, Supabase, Render) y de resolver lo que queda pendiente en
`settings.py`: `DEBUG`, la `SECRET_KEY` por defecto y las contraseñas de
desarrollo que hoy están en `seed_usuarios.py`.

---

## 6. Estado Actual del Desarrollo (Lo que ya funciona)

El sistema se encuentra en fase de Prototipo Funcional de Alta Fidelidad Avanzado:
- **UI/UX Corporativa:** Sistema de diseño propio (Fluent Design), completamente responsivo. El menú lateral en desktop se convierte en un menú hamburguesa en mobile; los modales se adaptan perfectamente a las pantallas táctiles.
- **Módulo de Planificación:** Listado de posturas reales (Rutas del Sur).
- **Módulo de Conductores:** Directorio de todo el personal. La ficha, en panel lateral deslizante (bottom-sheet en móvil), muestra los datos de la persona y sus servicios, y permite **asignarla a una postura**: el sistema ofrece solo los servicios que puede tomar y explica por qué descarta los demás.

> **Sobre el control de fatiga.** El sistema llegó a tener un contador de horas al volante con semáforo verde/amarillo/rojo. Se retiró: Operaciones decidió que los conductores no van a marcar en la aplicación cuándo toman y entregan el volante, y sin esa fuente el contador quedaba en cero para siempre, aparentando un control de seguridad que no existía. Lo que sí se hace cumplir es la dotación: el máximo de cinco horas continuas es la razón por la que cada servicio lleva dos conductores, y esa regla se valida en cada asignación.
- **Base de Datos Local:** Modelos de Django consolidados y scripts de semilla actualizados a la realidad de PlussChile.

## 7. Próximos Pasos (Hoja de Ruta)

Para llevar este prototipo a producción, los siguientes pasos son necesarios:
1. **Módulo de Checklist / Incidentes:** Crear la interfaz móvil para que el conductor reporte fallas en ruta.
2. **Módulo de Mantención:** Crear la vista Kanban para que el Jefe de Mecánicos gestione los buses averiados.
3. **Autenticación (Auth):** Implementar Login (JWT o sesiones) para separar las vistas según los Perfiles de Usuario descritos en la sección 3.
4. **Migración de Base de Datos:** Cambiar SQLite por PostgreSQL para garantizar persistencia y concurrencia segura en producción real.
