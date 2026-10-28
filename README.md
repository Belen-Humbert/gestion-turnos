# Gestión de turnos

Aplicación web instalable (PWA) para gestionar turnos y compartir material con pacientes.
Hecha por [Sushi Software Studio](https://sushisoftwarestudio.com.ar).

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL · Drizzle ORM.

## Estado

- [x] Paso 1: base del proyecto, PWA, base de datos, login por invitación y roles (administradora / paciente).
- [~] Paso 2: pacientes ✅ (importación CSV pendiente) · agenda ✅ (citas, otros eventos, repetición semanal, editar y cancelar, sin superposición) · notas privadas en el perfil del paciente ✅ (solo el administrador; incluye las notas de las citas del calendario).
- [x] Paso 3: vista del paciente ✅ (ver turno, confirmar asistencia, pedir cambio por mensaje) y panel «Pedidos» del administrador con contador.
- [ ] Paso 4: recordatorios (push + email 24 h y 2 h antes) y botón de WhatsApp manual.
- [ ] Paso 5: foro con archivos, comentarios y moderación.

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
- El paciente ve su nombre y email (solo lectura: los gestiona el administrador) y puede editar su celular y cambiar su contraseña. Cambiarla cierra las sesiones de otros dispositivos y limita los intentos fallidos.
- Preferencias de recordatorio (canal: email / notificación en el dispositivo; momento: 24 h / 2 h antes). Se guardan en `users` y las usará el Paso 4. Los recordatorios llevan solo día, hora y lugar.

## Pendientes conocidos

- El límite de intentos de login es en memoria (una sola instancia); en producción con varias instancias conviene moverlo a la base o a Redis.
- Falta el flujo de "olvidé mi contraseña" (se resuelve reinvitando al paciente desde el panel).
