# USER_ROLES — Autenticación, roles y permisos

> Ver `SYSTEM_MAP.md` §3 para la tabla completa de qué pantalla verifica qué rol.

## 1. Cómo se entra a la app

Login por correo/contraseña contra Supabase Auth (`app/page.tsx`). Tras iniciar sesión, la app
consulta `usuarios.rol` y redirige:

```ts
const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', data.user.id).single()
if (usuario?.rol === 'lider') router.push('/dashboard')
else router.push('/servidor')
```

- **Recuperación de contraseña**: `resetPasswordForEmail` de Supabase → enlace mágico →
  `/reset-password`, que escucha el evento `PASSWORD_RECOVERY` y permite fijar una nueva contraseña
  (mínimo 6 caracteres).
- **Autoregistro de servidor**: `/servidor/registro` permite a un servidor sin cuenta buscar su
  nombre o cédula en `servidores_inscripcion` (búsqueda `ilike`, **sin requerir sesión iniciada**),
  elegir su registro, crear una cuenta de Supabase Auth (`signUp` + `signInWithPassword` inmediato
  para obtener el `user.id` real), y enlazarla de vuelta a su fila de `servidores_inscripcion`.

## 2. El modelo de roles

| Nivel | Campo | Valores | Efecto |
|---|---|---|---|
| Cuenta | `usuarios.rol` | `'lider' \| 'servidor'` | Decide si aterrizas en `/dashboard` o `/servidor` — es el único interruptor real de todo el sistema |
| Servidor | `servidores_inscripcion.es_interno` | boolean | Interno paga la inscripción ($380.000, con la inconsistencia de $260.000 descrita en `HARDCODED_RETREAT_DATA.md`); externo no |
| Servidor | `servidores_inscripcion.grupo` | `'palancas' \| null` | Habilita la pestaña "Palancas" en su portal |
| Servidor | `servidores_inscripcion.es_lider_palancas` | boolean | Ve el panel de coordinación de todo el equipo de Palancas |
| Servidor | `servidores_inscripcion.palancas_lider` | boolean | Campo de nombre muy similar al anterior, usado en un contexto distinto (`dashboard/retiro`) — ver nota abajo |
| Retiro | `roles_retiro.encargados` (texto libre) | — | Asigna funciones dentro del fin de semana (líder de mesa, encargado de logística, etc.) por **coincidencia difusa de nombre**, no por relación con `usuario_id` |

**Nota sobre `es_lider_palancas` vs. `palancas_lider`:** son dos columnas de nombre casi idéntico,
usadas en archivos distintos, y no quedó claro durante esta auditoría si representan el mismo
concepto duplicado o dos conceptos genuinamente distintos (coordinar el equipo completo vs. liderar
la mesa temática de Palancas dentro del cronograma del fin de semana). Se recomienda aclarar esto
directamente en el esquema antes de tocar cualquier lógica de permisos.

## 3. No hay una capa central que aplique estos roles

No existe `middleware.ts` ni `app/dashboard/layout.tsx`. El portal de servidor sí está bien
protegido: `app/servidor/layout.tsx` obtiene la sesión, redirige a `/` si no hay usuario (salvo en
`/servidor/registro`), y redirige a `/dashboard` si el usuario resulta ser líder. **Ese patrón no
existe para el lado del líder.**

De las 18 pantallas bajo `/dashboard/*` revisadas, solo **3** verifican el rol dentro del propio
componente:

| Pantalla | Verificación |
|---|---|
| `dashboard/palancas/page.tsx` | Consulta `usuarios.rol`; si no es `'lider'`, revisa `servidores_inscripcion.es_lider_palancas` como acceso alternativo; si ninguna aplica, marca `accesoDenegado = true` |
| `dashboard/reuniones/page.tsx` | Consulta `usuarios.rol`; redirige a `/servidor` si no es `'lider'` |
| `dashboard/mensajes/page.tsx` | Consulta `usuarios.rol`; redirige a `/dashboard` si no es `'lider'` |

Las 15 restantes — incluyendo **configuración**, **finanzas**, las **fichas de caminantes y
servidores**, **asistencias**, **tareas** y **reembolsos** — no tienen ninguna verificación de rol
en el componente. Hoy, la única barrera real para un servidor autenticado (o cualquiera con una
sesión válida) que navegue directamente a esas URLs es lo que permitan las políticas de **Row Level
Security de Supabase**, que no forman parte de este repositorio y por lo tanto no pudieron
auditarse en este ejercicio. Si esas políticas son permisivas (o no existen para alguna tabla), la
falta de guard en el frontend deja de ser solo un problema de UX y pasa a ser un problema real de
acceso a datos sensibles (salud, documentos de identidad, comprobantes financieros).

## 4. Puerta trasera de administración — hallazgo crítico

`app/api/admin/impersonate/route.ts`:

```ts
const CLAVE_SECRETA = 'effeta2026admin'
// ...
if (clave !== CLAVE_SECRETA) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
// ...
const { data } = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email, ... })
return NextResponse.json({ link: data.properties.action_link })
```

Genera un magic-link de acceso a **cualquier correo** que se le pase por query string, usando la
`service role key` (máximo privilegio de Supabase). La única protección es una clave fija escrita
en texto plano en el código fuente. Al estar en un repositorio de git:

- Es visible para cualquiera con acceso de lectura al repositorio, hoy.
- Queda en el **historial de git para siempre**, incluso si se cambia el valor en un commit futuro
  — cualquiera que clone el repo completo (no solo el HEAD actual) puede recuperarla.
- Con esa clave y el correo de una cuenta de líder conocida, cualquiera obtiene sesión de líder sin
  necesitar la contraseña de esa cuenta.

**Severidad: crítica.** Debe tratarse como una credencial ya comprometida — no basta con quitarla
del código, se requiere reescribir o invalidar el acceso, y adicionalmente evaluar si esta ruta
debería existir en producción.

## 5. Exposición no autenticada de datos personales en el autoregistro

`app/servidor/registro/page.tsx` permite a cualquier visitante sin sesión iniciada buscar por
nombre o cédula parcial dentro de **toda** la tabla `servidores_inscripcion`:

```ts
supabase.from('servidores_inscripcion').select('*')
  .or(`nombre.ilike.%${termino}%,numero_documento.ilike.%${termino}%`)
```

El resultado expone nombre completo, número de documento, tipo (interno/externo), y si la cuenta ya
existe, de cualquier servidor cuyo nombre o cédula coincida parcialmente con la búsqueda. Esto
depende enteramente de que las políticas RLS de Supabase restrinjan qué puede leer un usuario
anónimo sobre esta tabla — la interfaz en sí no impone ningún límite adicional. Debe verificarse
directamente en el panel de Supabase.

## 6. Auto-otorgamiento de acceso a Palancas por coincidencia de nombre

`app/servidor/palancas/page.tsx` contiene un mapa hardcodeado `PALANCAS_NOMBRE_A_ID` (variantes de
nombre, con y sin tilde, de 12 personas). Si el nombre normalizado del servidor que entra a esta
página coincide con una entrada del mapa, el código actualiza automáticamente su fila
(`grupo: 'palancas'`, enlaza `usuario_id`) **sin ninguna verificación del lado del servidor** — es
una decisión de autorización tomada enteramente en el cliente, a partir de un string comparado
contra un arreglo embebido en el bundle público. Ver `HARDCODED_RETREAT_DATA.md` para el listado
completo de nombres/UUIDs hardcodeados en esta y otras pantallas.

## 7. Edición de datos sensibles sin confirmación ni auditoría

`app/servidor/retiro/page.tsx` permite a cualquier servidor asignado a una mesa editar directamente
(campo por campo, sin confirmación) las alergias, restricciones alimentarias, medicamentos y
"conocido en el retiro" de los caminantes de su mesa:

```ts
await supabase.from('caminantes').update({ [campo]: valor }).eq('id', caminanteId)
```

No hay registro de quién hizo el cambio ni cuándo, más allá de lo que Postgres/Supabase capture por
defecto. Cualquier servidor de mesa puede sobrescribir esta información médica sin que quede rastro
visible en la interfaz.

## 8. Resumen de hallazgos de esta sección, por severidad

| Severidad | Hallazgo |
|---|---|
| Crítico | Clave de impersonación fija en el código fuente, con acceso a `service role key` |
| Crítico | Sin capa central de autorización para `/dashboard/*` — 15 de 18 pantallas de líder sin guard propio |
| Alto | Búsqueda no autenticada de nombre/cédula en `servidores_inscripcion` |
| Medio | Auto-otorgamiento de acceso a Palancas por coincidencia de nombre, sin verificación de servidor |
| Medio | Edición de datos de salud de caminantes sin confirmación ni auditoría |
| Bajo | Ambigüedad entre `es_lider_palancas` y `palancas_lider` — riesgo de mantenimiento, no de seguridad |

## 9. Ver también

- `EXTERNAL_INTEGRATIONS.md` §11 — variables de entorno relacionadas con `service role key`.
- `MULTI_RETREAT_MIGRATION_PLAN.md` (Fase 0 y Fase 1) — remediación propuesta: rotar/retirar la
  clave de impersonación y construir un guard de rutas central.
