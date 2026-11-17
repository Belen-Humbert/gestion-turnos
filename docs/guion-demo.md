# Guion de la demo para Ana

Recorrido de unos 12 minutos. Se comparte pantalla desde la computadora; el celular se muestra al final.

## Antes de empezar (5 minutos antes)
1. `npm run db:migrate`
2. `npm run seed:showcase` carga pacientes, turnos de esta semana y la que viene, un pedido de cambio, notas privadas y tres publicaciones del foro con comentarios, corazones y respuestas. Conviene correrlo **el mismo día de la reunión**, porque las citas se arman alrededor de la semana actual.
3. `npm run dev` y abrir http://localhost:3000.
4. Dos ventanas del navegador, una al lado de la otra:
   - **Ana:** el email y la contraseña de la cuenta de administradora.
   - **Paciente** (ventana privada): `demo1@example.com` / `demo-paciente-123` (Lucía).
5. Sin email ni notificaciones configurados, los recordatorios y avisos se muestran como simulados. Aclararlo si preguntan.

## 1. La agenda de Ana (3 min)
- Entrar como Ana. Mostrar la **semana**: colores por tipo (confirmada, sin confirmar, otro evento) y cómo se muestran u ocultan. Pasar a **Día** y a **Mes**.
- Tocar **+ Agregar → Agregar cita**: elegir paciente, día y hora; mostrar la repetición semanal y la nota privada. Mostrar que no deja superponer horarios.
- **Agregar → Otro evento** (clase, supervisión): no avisa a ningún paciente.

## 2. Pacientes y notas privadas (2 min)
- Menú **Pacientes**: listado con búsqueda y filtro de activos. Entrar al perfil de Lucía: datos, turnos y **notas privadas** (solo las ve Ana).
- Mencionar el alta uno por uno con invitación por email, y que la importación por planilla (CSV) se hace con la lista de Ana.

## 3. El turno visto por la paciente (3 min)
- En la ventana de Lucía: **Inicio** con el próximo turno y el botón de confirmar.
- Entrar a **Turnos**: próximos y anteriores. Mostrar que la paciente **no elige horario**: solo envía un mensaje para pedir un cambio.
- Volver a Ana → **Pedidos**: leer el pedido de Sofía y mostrar el botón de WhatsApp con el mensaje ya escrito (lo envía Ana con un toque).
- **Perfil** de la paciente: cómo recibir recordatorios (email, notificación en el celular, 24 h y/o 2 h antes). Aclarar que el texto es neutro: solo día, hora y lugar.

## 4. El foro (3 min)
- Ana → **Foro**: publicación «Respiración guiada para dormir» con **audio con reproductor y PDF**. Mostrar **Nueva publicación**: subir archivos, pegar enlaces (los videos se comparten como enlace de YouTube «no listado») y la casilla **«Avisar a los pacientes»** (viene sin tildar).
- Lucía → **Foro**: filtros por tipo, reproducir el audio, comentar. Mostrar que en los comentarios solo se ve el **nombre de pila**.
- Ana: ver el comentario nuevo, darle **corazón** y **responder**. Volver a Lucía: el menú **Foro** muestra un número, y en la publicación aparece «♥ Le gustó a Ana» y la respuesta.
- Moderación: **Ocultar** y **Eliminar** un comentario, y **Cerrar comentarios** (la publicación «Una postal de primavera» ya los tiene cerrados).

## 5. Privacidad (1 min)
- Los pacientes no ven datos de otros pacientes ni las notas; los comentarios muestran solo el nombre de pila; el acceso es solo por invitación y la contraseña se puede recuperar por email.

## Cierre
- La app se instala en el celular como cualquier aplicación (PWA). Mostrar el celular si hay oportunidad.
- Lo que queda: ponerla en línea (servidor, dominio, email), cargar los pacientes reales y una capacitación corta.
- Temas para charlar: **costos mensuales** (hoja aparte), forma de pago de las 3 cuotas y la lista de pacientes para importar.

## Si algo falla en vivo
- Si no aparecen datos: `npm run seed:showcase` de nuevo y recargar.
- Para volver a empezar la demo de cero: `npm run seed:showcase -- --reset` y luego sin `--reset`.
