# Gestión de turnos

Aplicación web instalable (PWA) para gestionar turnos y compartir material con pacientes.
Hecha por [Sushi Software Studio](https://sushisoftwarestudio.com.ar).

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL · Drizzle ORM.

## Estado

- [x] Paso 1: base del proyecto, PWA, base de datos, login por invitación y roles (administradora / paciente).
- [~] Paso 2: pacientes ✅ (importación CSV pendiente) · agenda ✅ (citas, otros eventos, repetición semanal, editar y cancelar, sin superposición) · notas privadas en el perfil del paciente ✅ (solo el administrador; incluye las notas de las citas del calendario).
- [x] Paso 3: vista del paciente ✅ (ver turno, confirmar asistencia, pedir cambio por mensaje) y panel «Pedidos» del administrador con contador.
- [x] Paso 4: recordatorios (push + email 24 h y 2 h antes) y botón de WhatsApp manual.
- [~] Paso 5: foro ✅ (publicaciones con audios, imágenes, documentos y enlaces; comentarios con solo el nombre de pila; moderación). Falta conectar el almacenamiento definitivo (ver «Foro»).

## Desarrollo local

Requisitos: Node 22+ y PostgreSQL 16 (o Docker).

```bash
cp .env.example .env
docker compose up -d          # PostgreSQL local (o apuntá DATABASE_URL a tu propia base)
npm install
npm run db:migrate            # crea las tablas
ADMIN_EMAIL=ana@ejemplo.com ADMIN_NAME="Ana" ADMIN_PASSWORD="una-clave-larga" npm run seed:admin
npm run dev                   # http://localhost:3000
```

Los pacientes se dan de alta desde el panel (Pacientes → Agregar paciente). También se puede invitar por consola:

```bash
npm run invite -- paciente@ejemplo.com "Nombre Apellido"   # imprime el link de invitación
```

## Cómo funciona el acceso

- Nadie se registra solo: la administradora da de alta al paciente y se genera un link de invitación (válido 7 días, un solo uso).
- Del token solo se guarda el hash. Las contraseñas se guardan con bcrypt.
- Las sesiones viven en la base de datos (cookie `httpOnly`, 30 días), así que se pueden revocar. Un paciente desactivado pierde el acceso de inmediato.
- Cada página vuelve a verificar sesión y rol en el servidor (`requireUser`); `src/proxy.ts` es solo un chequeo optimista.
- El service worker no guarda páginas ni datos en caché: la información de los pacientes no queda en el dispositivo.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` / `build` / `start` | Desarrollo, build y producción |
| `npm run db:generate` | Genera una migración a partir de `src/db/schema.ts` |
| `npm run db:migrate` | Aplica las migraciones |
| `npm run seed:admin` | Crea o actualiza a la administradora |
| `npm run seed:demo` | Crea pacientes y citas de PRUEBA (`demo1@example.com`…, clave `demo-paciente-123`). Con `-- --reset` los borra. Solo para desarrollo |
| `npm run invite` | Genera un link de invitación (desarrollo) |
| `npm run lint` / `typecheck` / `test` | Chequeos y tests |

## Agenda

- Lunes a viernes, vistas semana y día. Los horarios se guardan en UTC y se muestran en hora de Argentina (sin horario de verano).
- Dos eventos activos nunca se superponen: lo controla la app con un mensaje claro y, además, una restricción de exclusión en PostgreSQL (`events_no_overlap`). Cancelar libera el horario.
- La repetición semanal crea las citas por adelantado (4, 8, 12 o 26 semanas) y comparten una serie; al cancelar se elige "solo este" o "este y los siguientes".
- Una cita nueva queda "sin confirmar" hasta que el paciente la confirme (paso 3). Si se cambia el horario, vuelve a quedar sin confirmar.

## Lado del paciente
- El paciente solo ve sus propios turnos (fecha, hora y lugar); nunca notas privadas ni datos de otras personas.
- Confirma asistencia con un botón. Si el administrador cambia el horario, vuelve a quedar sin confirmar.
- No puede reprogramar ni cancelar: envía un mensaje (hasta 500 caracteres) y queda un pedido abierto por cita.
- El administrador lo ve en **Pedidos** (con contador en el menú) y en la cita. Reprogramar o cancelar la cita marca el pedido como atendido; también se puede marcar a mano. Responder por WhatsApp es siempre manual.

### Perfil y preferencias del paciente
- El perfil se divide en pestañas (Mis datos · Recordatorios · Contraseña, `?seccion=`). El paciente ve su nombre y email (solo lectura: los gestiona el administrador) y puede editar su celular y cambiar su contraseña. Cambiarla cierra las sesiones de otros dispositivos y limita los intentos fallidos.
- Preferencias de recordatorio (canal: email / notificación en el dispositivo; momento: 24 h / 2 h antes). Se guardan en `users` y las usa el envío de recordatorios (ver abajo). Los recordatorios llevan solo día, hora y lugar.

## Recordatorios (Paso 4)
- **Cuándo:** 24 h y 2 h antes de cada cita, según las preferencias del paciente (Perfil → Recordatorios). Si la cita se agenda con menos de 24 h de anticipación no se manda el de 24 h. Si se reprograma, el nuevo horario recibe sus propios avisos. Un aviso que se pasó de hora (más de 3 h el de 24 h, 1 h el de 2 h) se descarta.
- **Texto neutro:** solo día, hora y lugar; sin motivo ni datos clínicos.
- **Canales:** email (SMTP, cualquier proveedor) y notificación push en cada dispositivo que el paciente active. Sin SMTP o sin claves VAPID, esos canales se simulan por consola y no se marcan como enviados.
- **WhatsApp:** nunca es automático. Ana tiene un botón «Recordar por WhatsApp» en la cita y en el perfil del paciente que abre el chat con el mensaje armado.
- **Quién lo dispara:** el proceso es idempotente (tabla `reminder_log`), así que se puede correr cada 10 minutos sin duplicar avisos:
  - Local: `npm run reminders`.
  - Producción: un programador externo llama cada ~10 min a `POST /api/cron/reminders` con `Authorization: Bearer $CRON_SECRET` (cron del hosting, GitHub Actions, cron-job.org).
- **Configuración** (ver `.env.example`): `SMTP_*` y `MAIL_FROM`; `npm run vapid` genera las claves de push (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`); `CRON_SECRET` (mínimo 16 caracteres).
- En iPhone/iPad las notificaciones push solo funcionan con la app agregada a la pantalla de inicio.
- **Seguridad:** el cron exige `CRON_SECRET`; las direcciones de push solo se aceptan si pertenecen a los servicios de los navegadores (Chrome/Edge, Firefox, Safari, Windows), para que nadie use al servidor para hacer pedidos a direcciones internas; los registros no imprimen emails de pacientes.
- **Pruebas:** `npm test` (las de base de datos corren si `DATABASE_URL` está definida).

## Foro (Paso 5)
- **Quién hace qué:** la administradora publica (título, texto, archivos y enlaces), edita, elimina, cierra o abre los comentarios y modera. Los pacientes leen y comentan; no suben archivos.
- **Archivos permitidos:** audios (mp3, m4a, aac, wav, ogg, opus), imágenes (jpg, png, webp, gif), PDF y documentos (doc/docx, xls/xlsx, ppt/pptx, odt, epub, txt). Sin HTML, SVG ni ejecutables. **Videos no se suben**: se comparten como enlace (p. ej. YouTube no listado). Tope por archivo: `FORUM_MAX_FILE_MB` (100 por defecto). Para habilitar video basta agregar sus extensiones en `src/lib/forum/files.ts`.
- **Enlaces:** solo `http`/`https`; se abren en otra pestaña con `noopener`.
- **Privacidad de los comentarios:** los pacientes ven solo el **nombre de pila** de quien comenta (el apellido se recorta en el servidor, no llega al navegador). La administradora ve el nombre completo. Un comentario oculto desaparece para los pacientes (también para su autor) y se puede restaurar; eliminar es definitivo. Cada paciente puede borrar solo los suyos. Límite: 5 comentarios cada 2 minutos y 1000 caracteres. El menú de la administradora avisa de comentarios nuevos.
- **Archivos protegidos:** nunca hay una dirección pública. Cada vista o descarga pasa por `/api/forum/files/[id]`, que exige sesión (administradora o paciente activo) y redirige a una dirección temporal firmada. Los archivos se suben directo del navegador al almacenamiento con una dirección temporal que autoriza solo ese archivo, ese tipo y ese tamaño exacto.
- **Almacenamiento intercambiable:** `STORAGE_DRIVER=local` guarda en `STORAGE_LOCAL_DIR` (`.storage`, ignorado por git) y sirve para desarrollo y pruebas; en producción pide `STORAGE_SECRET` (mínimo 32 caracteres). El resto del foro solo conoce la interfaz de `src/lib/storage`; conectar Cloudflare R2 (o S3) es agregar un driver con URLs prefirmadas, sin tocar el foro. **Pendiente de decidir el servicio definitivo.** Un hosting con disco efímero perdería los archivos del driver local.
- **Corazones y respuestas:** Ana puede dar «me gusta» (♥) a los comentarios de los pacientes y responderlos; los pacientes ven «♥ Le gustó a Ana» y la respuesta dentro del comentario. Las respuestas tienen un solo nivel (responder una respuesta cuelga del comentario original). Cada paciente puede responder solo dentro de sus propios comentarios (para seguir la charla con Ana), nunca en los de otros pacientes ni dar corazones. Ocultar o eliminar un comentario oculta/elimina sus respuestas. Migración `0009`.
- **Avisos para la paciente:** cuando Ana le da corazón a un comentario o le responde, el menú «Foro» de esa paciente muestra un contador y la respuesta lleva la marca «Nueva» hasta que abre la publicación. Es un aviso dentro de la app (no sale email ni notificación del dispositivo). Migración `0010`.
- **Aviso de material nuevo:** al publicar o editar, Ana puede tildar «Avisar a los pacientes que hay material nuevo» (**viene sin tildar**). El aviso es neutro («Hay material nuevo en el foro», sin título ni contenido) y llega por email y/o notificación según lo que cada paciente eligió en Perfil → Recordatorios; cada paciente puede apagar «Avisarme cuando haya material nuevo en el foro». Usa el mismo SMTP/VAPID que los recordatorios: sin configurar, el aviso solo se simula y la publicación no queda marcada como avisada. Un doble clic no duplica el aviso (ventana de 1 minuto) y un fallo de envío nunca pierde la publicación. Migración `0008` (`users.notify_forum`, `forum_posts.notified_at`).
- **Limitación conocida:** si Ana sube un archivo y cierra la página sin publicar, el archivo queda huérfano en el almacenamiento (al quitarlo con «Quitar» sí se borra). Se puede limpiar con un script periódico.

## Pendientes conocidos

- El límite de intentos de login es en memoria (una sola instancia); en producción con varias instancias conviene moverlo a la base o a Redis.
- Falta el flujo de "olvidé mi contraseña" (se resuelve reinvitando al paciente desde el panel).
