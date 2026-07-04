# Plataforma de Preparación Académica (v2)

Monorepo para una plataforma docente/estudiante con dos cursos (Álgebra y Cálculo / Aritmética y Estadística). Cada tema funciona como un **explorador de archivos** administrado por el docente, las **categorías de evaluación y sus pesos son configurables libremente** por unidad, los exámenes soportan **preguntas con 4-5 alternativas y una o más correctas** (puntaje parcial), exámenes con **activación global** y una componente de **evidencia** subida por el alumno, seguimiento **manual de progreso**, **dashboard** de pendientes, **perfil/configuración** (tema claro/oscuro) e **información de curso** editable.

Stack: **Angular 22** (standalone components, Router, Reactive Forms, ng2-charts/Chart.js) + **Node.js/Express** + **Prisma** (SQLite en desarrollo local, PostgreSQL en producción — ver [Despliegue en producción](#despliegue-en-producción-render)).

## Estructura

```
/                 package.json raíz (npm workspaces) con scripts para levantar todo junto
/server           API Express + Prisma + Jest
  /prisma          schema.prisma (SQLite, desarrollo), schema.production.prisma (Postgres, producción), seed.ts, curriculum.ts
  /src
    /auth /courses /units /topics /folders /files /questions /sessions
    /enrollments /evaluation-categories /entregas /rubric /export /dashboard /profile
    /middleware      auth (JWT + cookie httpOnly), rol, rate limit, manejo de errores
    /lib             prisma client, zod helpers, límites de texto, subida de archivos (multer)
/client           Angular app (standalone), tema oscuro/claro con CSS variables
```

Los archivos que suben docente/estudiantes (material de clase, evidencias, entregas, avatares) se guardan como bytes dentro de la base de datos (columnas `Bytes` en Prisma), no en el disco del servidor — así sobreviven a reinicios y redeploys en hosting sin almacenamiento persistente.

## Instalación

Requisitos: Node.js 20+ (probado con Node 24) y npm 10+.

```bash
npm install
```

Esto instala las dependencias de `/server` y `/client` (npm workspaces).

## Base de datos: migraciones y seed

El seed está dividido en las mismas 3 fases en que se construyó la plataforma. Actualmente siembra las Fases 1 y 2 (usuarios demo + currículo completo con sus carpetas fijas); las categorías de evaluación, el banco de preguntas y las sesiones (Fase 3) las crea el docente desde la plataforma (o se pueden sembrar de ejemplo siguiendo el flujo de prueba descrito más abajo).

```bash
cd server
npx prisma migrate dev --name init   # crea server/prisma/dev.db y aplica el esquema
npx prisma db seed                    # siembra usuarios demo + currículo completo + carpetas fijas
```

Para reiniciar todo en limpio:

```bash
npx prisma db push --force-reset
npx prisma db seed
```

### Credenciales demo

| Rol        | Correo               | Contraseña     |
|------------|----------------------|----------------|
| Docente    | docente@curso.pe     | docente123     |
| Estudiante | estudiante@curso.pe  | estudiante123  |

El estudiante demo ya está inscrito en ambos cursos.

### Cuentas reales

| Rol        | Nombre  | Correo                     |
|------------|---------|----------------------------|
| Docente    | Jesús   | gmz.alvarojesus@gmail.com  |
| Estudiante | Jeremi  | jeremiventura18@gmail.com  |

Jeremi ya está matriculado en ambos cursos. Las contraseñas se compartieron por fuera del repositorio y se pueden cambiar en cualquier momento desde **Perfil > Cambiar contraseña**.

### Alta de nuevas cuentas de estudiante

Hay dos formas de dar de alta a un estudiante:

1. **El docente la crea manualmente** desde la pestaña "Estudiantes y Rúbrica" de cualquier unidad (nombre, correo y contraseña), y queda matriculado en ese curso.
2. **Registro abierto**: cualquier persona puede crear su propia cuenta de estudiante en `/registro` (enlazado desde la pantalla de login). Queda matriculada automáticamente en todos los cursos existentes. El endpoint (`POST /api/auth/register`) está limitado a 10 intentos por hora por IP para evitar abuso, y solo puede crear cuentas con rol estudiante.

## Cómo correr en desarrollo

Desde la raíz del repositorio:

```bash
npm run dev
```

Esto levanta **el backend en `http://localhost:3000`** y **el frontend en `http://localhost:4200`** en paralelo (usa `concurrently`). El cliente Angular usa un proxy (`client/proxy.conf.json`) para reenviar `/api/*` al backend, así que en el navegador todo se sirve desde `http://localhost:4200` sin problemas de cookies entre orígenes.

Scripts individuales también disponibles: `npm run dev:server`, `npm run dev:client`.

## Pruebas

```bash
npm test
```

Corre la suite de Jest del backend. El foco está en `server/src/rubric/rubric.service.test.ts`, que cubre el cálculo de la rúbrica genérica (la lógica más sensible del proyecto): categorías con/sin datos, promedio ponderado, renormalización cuando faltan categorías, cualquier cantidad/nombre de categorías, y redondeo.

## Cómo funciona el contenido de un tema (explorador de archivos)

Cada tema nace con **4 carpetas raíz fijas** (no se pueden renombrar ni borrar): *Concepto y Marco Teórico*, *Mecánica y Ejemplos*, *Actividad Práctica*, *Aplicación a la Economía y Administración*. Dentro de cada una, el docente crea subcarpetas, sube archivos (PDF, Word, PowerPoint, Excel, imágenes) o escribe notas de texto directamente, como en un Explorador de Archivos. El estudiante navega el mismo árbol en modo lectura y **marca manualmente cada carpeta como "completada"**, lo que alimenta la barra de progreso del tema, de la unidad y del dashboard general.

## Cómo funciona la evaluación

- El docente define, **por unidad**, las **categorías de evaluación** que necesite (nombre libre + peso %): Participación en Clase, Examen Parcial, Proyecto de Investigación, Retos, Tareas extra, etc. No hay categorías fijas del sistema.
- Cada categoría tiene un `tipoEvaluacion` interno que controla su comportamiento: `examen` (con temporizador y activación global), `participacion_clase`, `participacion_activa`, `entrega` (texto/archivo puro) o `generica`.
- Una **sesión** (examen, práctica, tarea, entrega...) pertenece a una categoría. Si tiene preguntas, se resuelve con el flujo de examen; si no tiene preguntas, es una entrega pura (texto y/o archivo).
- **Preguntas multi-correcta**: cada pregunta tiene 4 o 5 alternativas y una o más marcadas como correctas. El puntaje de una pregunta es `(alternativas correctas marcadas ÷ total de correctas)`, sin penalización por marcar además una incorrecta.
- **Examen con evidencia**: el docente puede exigir que, además de responder las preguntas (aciertos automáticos), el alumno suba un archivo con el desarrollo completo. La nota de la sesión combina ambas partes según los pesos configurados (por defecto 40% aciertos / 60% evidencia calificada manualmente por el docente).
- **Activación de examen**: interruptor global por sesión — el docente "abre" el examen cuando corresponde y todos los inscritos pueden entrar a la vez; mientras está cerrado, el alumno ve un aviso y no puede iniciarlo.
- **Rúbrica**: `calcularRubrica` (en `server/src/rubric/rubric.service.ts`) recibe una lista de categorías ya resueltas (`{nombre, peso, nota}`) y calcula la nota final ponderada. Los componentes **sin datos no se tratan como 0**: se renormaliza solo sobre las categorías con información, y se expone `porcentajePonderadoConDatos` para dejar claro cuánto de la rúbrica ya es real.

## Seguridad implementada

- Contraseñas con `bcrypt` (12 rondas), nunca texto plano.
- Sesión vía JWT firmado guardado en cookie **httpOnly, SameSite=Lax** (Secure en producción) — nunca en localStorage.
- `express-rate-limit` en `/api/auth/login` (5 intentos/minuto por IP).
- Validación de **todo** input con `zod`, incluyendo límites de longitud en notas de carpetas, enunciados y entregas.
- Rutas protegidas por rol tanto con middleware Express (`requireAuth` + `requireRole`) como con guards de Angular (`authGuard`, `roleGuard`) — el backend es la única fuente de verdad real.
- Contenido de usuario (entregas, notas de carpetas, enunciados) siempre se muestra con interpolación `{{ }}` de Angular, nunca `[innerHTML]`, para evitar XSS.
- Archivos subidos: `multer` con límite de tamaño (20MB material/evidencia, 2MB avatar) y lista blanca de tipos MIME; el material de clase y las evidencias se descargan por un endpoint autenticado que valida rol/inscripción antes de servir el archivo (nunca una carpeta pública).
- Manejo de errores centralizado: nunca se exponen stack traces al cliente; hay página 404 amigable en el frontend.

## Utilidades incluidas

- **Explorador de archivos por tema** con progreso manual (ver arriba).
- **Aleatorización**: el orden de las preguntas se baraja y persiste por estudiante al iniciar una sesión; el orden de las alternativas se deriva de forma determinística (semilla = sesión + estudiante + pregunta) y se registra en cada `Attempt` (`shownOptionOrder`) para poder auditar qué vio cada estudiante.
- **Temporizador y activación global** de examen (ver arriba). Las respuestas se autoguardan pregunta por pregunta, así que si el tiempo vence, lo respondido hasta ese momento queda entregado automáticamente (el servidor lo detecta en cualquier lectura posterior, no depende de que el navegador siga abierto).
- **Fecha límite**: opcional en sesiones, con indicador visual de "Vencido" para estudiante y docente.
- **Dashboard del estudiante**: progreso general (carpetas completadas) y cuenta regresiva de pendientes con fecha límite próxima.
- **Perfil**: datos básicos, foto, contraseña, tema claro/oscuro y notificaciones dentro de la plataforma.
- **Información de Curso**: página por curso con tabla autogenerada de categorías/pesos por unidad + texto libre editable por el docente.
- **Exportar notas**: CSV por unidad o por curso completo, con columnas dinámicas según las categorías configuradas.
- **Aviso de banco insuficiente**: si un tema tiene menos de 50 preguntas, el docente ve un aviso.
- **Buscador/filtro** de preguntas por nivel, tipo, sección y texto.
- **Historial de intentos**: el estudiante ve qué respondió y cuándo en cada sesión ya entregada.
- **Exportar a PDF**: notas de texto de las carpetas fijas de un tema, para repaso offline.

## Flujo de prueba sugerido (para verificar todo end-to-end)

1. Entra como docente, abre una unidad → pestaña **Categorías de Evaluación** → crea 2-3 categorías (que sumen 100%).
2. Abre un tema → sube una nota de texto en alguna de las 4 carpetas fijas, y crea una pregunta con 4-5 alternativas marcando 1 o más como correctas.
3. Vuelve a la unidad → pestaña **Sesiones** → crea una sesión (elige la categoría, el tema, las preguntas y, si es examen, si requiere evidencia) → pulsa **Abrir** para activarla.
4. Entra como estudiante → resuelve la sesión (checkboxes, temporizador si aplica) → si requiere evidencia, sube texto/archivo → **Entregar sesión**.
5. Como docente, califica la evidencia (si aplica) desde **Ver entregas**, y revisa la rúbrica del estudiante en **Estudiantes y Rúbrica**.
6. Exporta las notas a CSV desde la pestaña **Exportar**.

## Despliegue en producción (Render)

La app se despliega como **un solo servicio Node**: el mismo Express sirve la API (`/api/*`) y el build de Angular (todo lo demás), sobre una base de datos Postgres gratuita. Esto evita problemas de CORS/cookies cross-site (todo vive en el mismo origen) y no depende de que ninguna laptop personal esté prendida.

### 1. Base de datos Postgres gratuita (Neon o Supabase)

1. Crea una cuenta gratuita en [neon.tech](https://neon.tech) (o supabase.com).
2. Crea un proyecto/base de datos nueva y copia la **cadena de conexión** (`postgresql://usuario:password@host/db?sslmode=require`).
3. Desde tu máquina, con esa cadena en `DATABASE_URL`, crea las tablas y siembra el currículo (una sola vez):
   ```bash
   cd server
   DATABASE_URL="<tu-cadena-de-neon>" npx prisma db push --schema=prisma/schema.production.prisma
   DATABASE_URL="<tu-cadena-de-neon>" npx ts-node prisma/seed.ts
   ```
   (En PowerShell: `$env:DATABASE_URL="<tu-cadena>"; npx prisma db push --schema=prisma/schema.production.prisma`, luego el seed en otra línea con el mismo `$env:DATABASE_URL` ya seteado.)

### 2. Repositorio en GitHub

```bash
git init
git add .
git commit -m "Despliegue inicial"
git remote add origin <url-de-tu-repo-vacio-en-github>
git push -u origin main
```

### 3. Servicio web en Render

1. En [render.com](https://render.com), crea una cuenta gratuita y un **New Web Service** conectado a tu repo de GitHub.
2. **Build Command**: `npm run render-build`
3. **Start Command**: `npm run render-start`
4. Variables de entorno:
   - `DATABASE_URL` → la misma cadena de conexión de Neon/Supabase del paso 1.
   - `JWT_SECRET` → un valor largo y aleatorio (no el de `.env.example`).
   - `JWT_EXPIRES_IN` → `8h`.
   - `NODE_ENV` → `production` (activa la cookie de sesión `Secure`, que requiere HTTPS — Render lo da automáticamente).
5. Al desplegar, Render te da una URL pública (`https://tu-app.onrender.com`); ábrela desde cualquier navegador, laptop o celular.

El plan gratuito de Render "duerme" el servicio tras ~15 minutos sin tráfico; el primer request tras eso tarda ~30-50 segundos en responder mientras despierta.

### Notas

- `server/prisma/schema.prisma` (SQLite) es solo para desarrollo local y no se toca para desplegar; `server/prisma/schema.production.prisma` (Postgres) es la que usa Render vía `render-build`.
- Los archivos subidos (material de clase, evidencias, entregas, avatares) se guardan como bytes en la base de datos, no en disco — sobreviven a que Render reinicie o redespliegue el servicio.
- Si en el futuro se necesita re-sembrar o resetear la base de producción, se repite el paso 1 con `--force-reset` (esto borra todos los datos).

## Qué quedó pendiente

- No hay refresh token: la sesión expira a las 8 horas y hay que volver a iniciar sesión.
- No hay envío de correos ni notificaciones push: los avisos de fechas límite y calificaciones se calculan en vivo dentro del dashboard, no hay tabla de notificaciones persistente ni correo.
- El soporte para Postgres (`schema.production.prisma`) y el almacenamiento de archivos como bytes en la base de datos ya están implementados y probados localmente (build de producción corrido con `NODE_ENV=production` contra SQLite); falta únicamente crear la base Postgres real y el servicio en Render siguiendo la sección de despliegue.
- Si el docente configura pesos de categorías que no suman 100%, la plataforma lo advierte visualmente (badge) pero no bloquea la operación — el cálculo sigue siendo matemáticamente consistente vía renormalización.
- El docente no tiene una vista de "revisar respuesta por respuesta" de un estudiante en una sesión de preguntas (sí ve la nota agregada vía rúbrica, las entregas de texto/archivo, y el CSV); el historial detallado pregunta-por-pregunta está pensado para el propio estudiante.
- El banco de preguntas y el currículo de ejemplo (Fase 3) no vienen sembrados por defecto: el flujo de prueba sugerido arriba muestra cómo crearlos manualmente o repetir lo que se validó durante el desarrollo.
