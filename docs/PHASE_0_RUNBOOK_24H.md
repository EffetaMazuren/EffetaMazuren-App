# PHASE_0_RUNBOOK_24H — Runbook técnico de las primeras 24 horas

> Procedimiento operativo, no documento de análisis. Para ejecutarse **cuando existan los accesos
> reales** descritos en `PHASE_0_EXECUTION_PLAN.md`. Nada de este runbook se ejecutó al producirlo —
> es la preparación, no la acción. Escrito para que una persona técnica pueda seguirlo sin releer
> los demás documentos de `docs/`. Alcance limitado a 6 acciones: deshabilitar
> `/api/admin/impersonate`, rotar credenciales de Google Cloud (Sheets), investigar uso previo de la
> impersonación, validar RLS inicial en Supabase, confirmar ownership de Google Cloud/Apps Script, y
> revisar variables de entorno de Vercel.

---

## Tabla maestra

| Paso | Acción | Sistema | Quién debe ejecutarlo | Evidencia esperada | Riesgo si se omite |
|---|---|---|---|---|---|
| 1 | Deshabilitar temporalmente `/api/admin/impersonate` | Código / Vercel | Quien tenga acceso de escritura al repositorio y de despliegue en Vercel | Captura de la ruta respondiendo con error tras el cambio; registro del commit/despliegue con hora exacta | La puerta trasera de administración sigue activa mientras se decide su destino final |
| 2 | Rotar la API key + OAuth Client ID de Google Sheets | Google Cloud | Quien tenga rol Editor o superior en el proyecto de GCP correspondiente | Captura de la key nueva con restricciones aplicadas + captura de la key vieja marcada como revocada, ambas con timestamp | La credencial ya expuesta sigue siendo válida y utilizable por cualquiera con el repositorio |
| 3 | Investigar uso previo de `/api/admin/impersonate` | Vercel, Supabase | Quien tenga acceso a logs de funciones de Vercel y a los logs de Supabase Auth | Export o captura de los logs filtrados por esa ruta, con una conclusión escrita explícita ("hubo" / "no hubo" actividad sospechosa) | Se decidiría el destino final de la ruta sin saber si ya hubo un uso indebido |
| 4 | Validación inicial de RLS en `servidores_inscripcion`, `caminantes`, `pagos`, `transacciones` | Supabase | Quien tenga acceso a SQL Editor o al panel de Authentication → Policies | Resultado completo de las consultas a `pg_tables` y `pg_policies` por cada una de las 4 tablas, guardado como texto | La severidad real del hallazgo "sin guard de rutas" queda sin confirmar — posible exposición activa de datos de salud, identidad y finanzas |
| 5 | Confirmar ownership del proyecto de Google Cloud y de los 4 Apps Script | Google Cloud, Apps Script | Quien tenga al menos acceso de lectura a IAM del proyecto y a cada script | Lista de las 5 cuentas propietarias (1 proyecto GCP + 4 scripts), cada una marcada como institucional o personal | Riesgo de continuidad no detectado — el equipo podría depender de una cuenta que no controla, sin saberlo |
| 6 | Revisión inicial de variables de entorno de Vercel | Vercel | Quien tenga acceso a Project Settings | Lista de **nombres** de variables (nunca valores) exportada, con marca de cuáles llevan prefijo `NEXT_PUBLIC_` | Secretos mal configurados como públicos, o variables huérfanas, pasarían desapercibidos |

Orden de ejecución dentro de las 24 horas: los pasos 1, 2, 4 y 6 pueden correr en paralelo entre
distintas personas del equipo desde el minuto uno. El paso 3 alimenta una decisión que se toma en la
semana 1, no hoy — puede iniciarse en paralelo también. El paso 5 no depende de ningún otro.

---

## Para `/api/admin/impersonate`

**Cómo deshabilitar temporalmente.** Método recomendado: agregar al inicio del handler una
verificación incondicional controlada por una variable de entorno nueva (por ejemplo,
`IMPERSONATE_DISABLED`) que, si está presente, retorna un error antes de llegar a cualquier otra
lógica — sin importar si la clave enviada es correcta. Esto es reversible cambiando solo el valor de
esa variable en Vercel y volviendo a desplegar; no requiere revertir ningún commit.

Alternativa si el plan de Vercel incluye Firewall/Edge Middleware: bloquear la ruta por path a nivel
de red, sin tocar el código de la aplicación — más rápido de aplicar, pero no todos los planes lo
soportan; verificar disponibilidad antes de depender de esta opción.

**Qué validar antes.** Confirmar, en la medida de lo posible en el momento, que nadie del equipo la
está usando activamente para un flujo de soporte real justo en ese instante. Dicho esto: dado que es
una vulnerabilidad activa y confirmada, el sesgo por defecto debe ser deshabilitar primero — no
esperar a tener certeza total de que nadie la usa, porque el costo de una interrupción momentánea es
mucho menor que el de dejar la puerta abierta un día más.

**Qué evidencia guardar.** El estado del código antes del cambio (diff o captura), la respuesta HTTP
de la ruta antes (200, con el magic link) y después (error) del cambio, y el timestamp exacto junto a
quién lo ejecutó.

**Cómo revertir si fuera necesario.** Cambiar la variable de entorno de vuelta y volver a desplegar.
Importante: revertir sin haber completado antes la investigación (paso 3) ni la decisión de destino
final volvería a abrir exactamente la misma vulnerabilidad que se cerró — no debería hacerse solo
porque algo dejó de funcionar sin antes confirmar que ese algo era, en efecto, un uso legítimo.

**Qué información necesitamos para decidir eliminarlo o protegerlo después.** El resultado del paso
3. Si aparece evidencia de uso legítimo y recurrente por parte de líderes conocidos del equipo (no
un único evento aislado o irreconocible), eso inclina hacia proteger la ruta con autenticación real
en la semana 1. Si no hay ningún registro de uso, o el único uso detectado es de origen
desconocido, eso inclina hacia eliminarla por completo. Esta decisión **no se toma en las primeras 24
horas** — se toma en la semana 1, con el resultado de la investigación ya en mano.

---

## Para Google Cloud

**Cómo identificar la API key expuesta.** El valor exacto de la key y del OAuth Client ID hoy
hardcodeados en `app/dashboard/finanzas/page.tsx` está documentado en `docs/HARDCODED_RETREAT_DATA.md`
§6. Copiar ese valor y buscarlo en Google Cloud Console → APIs & Services → Credentials — aparecerá
listado por ese identificador exacto, lo que confirma en qué proyecto de GCP vive.

**Cómo identificar APIs habilitadas.** Una vez localizado el proyecto, ir a APIs & Services →
Enabled APIs & services. Listar cada API habilitada y anotar si alguna tiene alcance más allá de
Google Sheets (por ejemplo, Drive, Gmail, o cualquier API con acceso a datos personales) — esto
determina qué tan grande fue la exposición real, no solo la teórica.

**Cómo rotar credenciales.**
1. En Credentials, generar una **nueva** API key.
2. Restringirla de inmediato: Application restrictions (HTTP referrers del dominio de producción) +
   API restrictions (limitarla solo a Google Sheets API — nunca dejarla "sin restricción").
3. **No revocar la key vieja todavía.**
4. Probar la key nueva contra el flujo real antes de continuar (ver validación abajo).
5. Solo después de confirmar que funciona, revocar/eliminar la key vieja.
6. Actualizar el código de la aplicación para referenciar la key nueva vía variable de entorno queda
   fuera del alcance de estas 24 horas — es tarea de la semana 1 según `PHASE_0_EXECUTION_PLAN.md`.

**Cómo validar que la aplicación sigue funcionando después.** Probar manualmente, en un entorno de
preview si es posible, el flujo de "Cotizaciones" de `dashboard/finanzas`: conectar la cuenta de
Google, sincronizar, y agregar o editar un ítem — confirmar que responde igual que antes de la
rotación.

**Qué evidencia guardar.** Captura de la key vieja marcada como revocada con su timestamp, captura de
la key nueva con sus restricciones visibles, y el resultado de la prueba funcional posterior.

---

## Para Supabase RLS

**Tablas prioritarias, en este orden:** `servidores_inscripcion`, `caminantes`, `pagos`,
`transacciones`.

**Qué revisar por cada tabla:**
- ¿RLS está habilitado en la tabla? → `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = '<tabla>';`
- ¿Existe al menos una política? → `SELECT * FROM pg_policies WHERE tablename = '<tabla>';`
- ¿Qué roles cubre cada política (`anon`, `authenticated`, ambos)?
- ¿Qué condición aplica en `USING`/`WITH CHECK` — restringe algo específico, o permite todo?

**Qué evidencia exportar.** El resultado completo (texto o captura) de ambas consultas, por cada una
de las 4 tablas, con fecha y hora de extracción.

**Qué resultado sería GO.** Cada una de las 4 tablas tiene RLS habilitado **y** al menos una
política cuya condición restringe el acceso de forma coherente con el rol esperado — por ejemplo, un
servidor no puede leer los pagos de otra persona, y un usuario sin sesión no puede leer nada de
`caminantes`.

**Qué resultado sería NO-GO / incidente.** Cualquiera de estas tres condiciones, en cualquiera de las
4 tablas:
1. RLS deshabilitado por completo.
2. RLS habilitado pero sin ninguna política asociada (confirmar el comportamiento real en ese caso,
   no asumirlo).
3. Existe una política, pero su condición es efectivamente "verdadero siempre" para el rol `anon` o
   `authenticated`, sin ninguna restricción real.

Si aparece cualquiera de estas tres condiciones: **detener la checklist de Fase 0 y escalarlo como
incidente de exposición de datos activa** — no continuar como si fuera un hallazgo más de la lista,
tal como ya quedó definido en el criterio de NO-GO de `PHASE_0_EXECUTION_PLAN.md`.

---

## Para Vercel

**Qué revisar.** Project Settings → Environment Variables (lista completa), y Project Settings →
Functions/Logs si están disponibles y retenidos por el plan actual.

**Qué NO compartir públicamente.** Los **valores** de ninguna variable. Al documentar o reportar el
resultado de esta revisión — incluso internamente por Slack o correo — registrar solo **nombres** de
variables y su alcance (solo-servidor vs. `NEXT_PUBLIC_`), nunca los valores reales, ni en capturas
de pantalla.

**Qué nombres de variables validar.** Las 7 ya conocidas por el código:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`RESEND_API_KEY`, `GOOGLE_VISION_API_KEY`, `APPS_SCRIPT_CORREOS_URL`,
`NEXT_PUBLIC_APPS_SCRIPT_PALANCAS_URL` — confirmar que las 7 existen, y anotar cualquier variable
adicional no reconocida (podría ser configuración huérfana o algo no documentado por la auditoría).

**Qué evidencia guardar.** Lista de nombres exportada (sin valores), con marca explícita de cuáles
llevan el prefijo `NEXT_PUBLIC_`. **Cualquier secreto real** (`SUPABASE_SERVICE_ROLE_KEY`,
`RESEND_API_KEY`, `GOOGLE_VISION_API_KEY`) que aparezca con ese prefijo es un hallazgo grave a
escalar de inmediato — significaría que ese secreto ya está expuesto en el navegador de cualquier
visitante — no algo para documentar y seguir de largo.

---

## Para Google Apps Script

**Cómo confirmar propietario.** Entrar a cada uno de los 4 scripts vía script.google.com usando las
URLs ya documentadas en `docs/EXTERNAL_INTEGRATIONS.md` §4 y `docs/HARDCODED_RETREAT_DATA.md` §6.
Dentro de cada proyecto, ir al ícono de engranaje ("Configuración del proyecto") y revisar el correo
de la cuenta bajo la cual está creado.

**Cómo confirmar despliegues.** Dentro de cada script, ir a "Implementar" → "Gestionar
implementaciones" — verificar que la URL de la implementación activa coincide exactamente con la
referenciada en el código de la aplicación.

**Cómo identificar si depende de una cuenta personal.** Si el correo de la cuenta corresponde a un
dominio genérico personal, o es identificable como la cuenta personal de un miembro específico del
equipo (en vez de una cuenta institucional o compartida del grupo) — marcarlo explícitamente como
"dependencia de cuenta personal" en la evidencia del paso 5. No hace falta resolverlo en estas 24
horas — solo documentarlo, para que no se descubra como sorpresa más adelante.

---

## Nota de cierre

Este runbook cubre únicamente las 6 acciones en alcance. No incluye la decisión final sobre
`/api/admin/impersonate`, la actualización del código para referenciar credenciales rotadas, ni el
dump del esquema de Supabase — esas tareas están descritas en el bloque de "primera semana" de
`PHASE_0_EXECUTION_PLAN.md` y del plan de ejecución técnico ya entregado, y no forman parte de este
documento.
