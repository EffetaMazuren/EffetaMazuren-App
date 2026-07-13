# SYSTEM_MAP — Mapa completo del sistema

> Auditoría de arquitectura, solo lectura. Ningún archivo de código fue modificado para producir este documento.
> Alcance: 100% del código fuente en `app/`, `lib/`, `components/` del repositorio `effetamazuren/effetamazuren-app`.

## 1. Qué es esta aplicación

Effetá Mazuren es una app interna de un grupo juvenil católico (Bogotá, Colombia) para organizar
su retiro espiritual anual — hoy, específicamente, el **IX Retiro** (3–5 de julio de 2026). Cubre
todo el ciclo: pre-inscripción, cobro y verificación de pagos, logística del fin de semana (mesas,
cuartos, cronograma), seguimiento pastoral de las familias ("Palancas"), finanzas del evento y
comunicación con el equipo de servidores (voluntarios).

Es una app **de un solo retiro**: prácticamente cada pantalla tiene el UUID del retiro activo
escrito directamente en el código. Ver `HARDCODED_RETREAT_DATA.md` para el detalle completo.

## 2. Estructura de carpetas

```
effeta-app/
├── app/
│   ├── page.tsx                          # login
│   ├── layout.tsx                        # shell raíz — sin guard de auth
│   ├── reset-password/                   # recuperación de contraseña (Supabase magic link)
│   ├── perfil/                           # perfil del líder
│   ├── notifications/                    # feed de notificaciones (líder)
│   │
│   ├── api/                              # ← únicas rutas server-side (usan service role key)
│   │   ├── admin/impersonate/            # genera magic-link para cualquier correo (ver USER_ROLES.md)
│   │   ├── caminantes/[id]/              # DELETE en cascada de un caminante
│   │   ├── correos/
│   │   │   ├── forms/inscripcion/        # recibe la pre-inscripción (Google Form → aquí)
│   │   │   ├── inscripcion/              # Resend: instrucciones de pago
│   │   │   └── pago-completo/            # Resend: confirmación manual de pago 100%
│   │   ├── drive/upload/                 # nombre engañoso: sube a Supabase Storage, no a Google Drive
│   │   ├── pagos/
│   │   │   ├── analizar-comprobante/     # Google Vision OCR del monto pagado
│   │   │   ├── registrar/                # registra pago de caminante
│   │   │   └── servidor/                 # registra pago de servidor
│   │   ├── servidores/[id]/tipo/         # PATCH interno/externo
│   │   └── sync-palanca/                 # proxy hacia un Google Apps Script
│   │
│   ├── dashboard/                        # ← portal LÍDER (18 pantallas, sin layout.tsx propio)
│   │   ├── page.tsx                      # home: metas, estadísticas, accesos rápidos
│   │   ├── personas/                     # hub caminantes/servidores
│   │   ├── caminantes/                   # lista (+ [id] ficha, + nuevo alta manual)
│   │   ├── servidores/                   # lista (+ [id] ficha, + nuevo alta manual)
│   │   ├── finanzas/                     # resumen (+ categoria/[id], + registrar)
│   │   ├── retiro/                       # consola operativa — 7 pestañas (ver abajo)
│   │   ├── palancas/                     # coordinación del equipo de seguimiento a familias
│   │   ├── asistencias/                  # alertas de fotos de asistencia fuera de horario
│   │   ├── reuniones/                    # CRUD de reuniones semanales + asistencia
│   │   ├── tareas/                       # to-do de organización del retiro
│   │   ├── mensajes/                     # mensajería líder → servidores
│   │   ├── reembolsos/                   # cola de aprobación de facturas/reembolsos
│   │   └── config/                       # ajustes, gestión de accesos, export CSV
│   │
│   └── servidor/                         # ← portal SERVIDOR (layout.tsx SÍ hace guard de auth/rol)
│       ├── layout.tsx                    # único guard de auth/rol real de todo el repositorio
│       ├── page.tsx                      # home del servidor
│       ├── registro/                     # autoregistro de cuenta
│       ├── pago/                         # su propio estado de pago + subir comprobante
│       ├── retiro/                       # su mesa, sus caminantes, sus roles asignados
│       ├── palancas/                     # vista individual o de líder de equipo, según el usuario
│       ├── asistencias/                  # check-in con selfie por reunión
│       ├── reembolso/                    # solicitar reembolso/factura
│       └── versiculo/                    # versículo del día + diario de reflexión personal
│
├── components/
│   ├── BottomNav.tsx                     # nav inferior del líder — reutilizado en casi todo /dashboard
│   └── servidores/BadgeTipoServidor.tsx  # badge interno/externo — reimplementado inline 2 veces más
│
├── lib/
│   └── supabase.ts                       # cliente Supabase + 7 tipos compartidos (subutilizado)
│
├── effeta-app.zip                        # snapshot de desarrollo de ~1 mes atrás, comiteado por accidente
├── INSTRUCCIONES.md                      # 3 de las 7 variables de entorno reales están documentadas aquí
└── (sin carpeta de tests, sin migraciones .sql, sin middleware.ts, sin .gitignore)
```

## 3. Inventario de pantallas

| Portal | Ruta | Pantalla | Verificación de rol en el archivo |
|---|---|---|---|
| Público | `/` | Login | — |
| Público | `/reset-password` | Recuperar contraseña | — |
| Líder | `/dashboard` | Home | Ausente |
| Líder | `/dashboard/personas` | Hub caminantes/servidores | Ausente |
| Líder | `/dashboard/caminantes` | Lista de caminantes | Ausente |
| Líder | `/dashboard/caminantes/[id]` | Ficha de caminante | Ausente |
| Líder | `/dashboard/caminantes/nuevo` | Alta manual de caminante | Ausente |
| Líder | `/dashboard/servidores` | Lista de servidores | Ausente |
| Líder | `/dashboard/servidores/[id]` | Ficha de servidor | Ausente |
| Líder | `/dashboard/servidores/nuevo` | Alta manual de servidor | Ausente |
| Líder | `/dashboard/finanzas` | Resumen financiero (6 pestañas) | Ausente |
| Líder | `/dashboard/finanzas/categoria/[id]` | Detalle por categoría | Ausente |
| Líder | `/dashboard/finanzas/registrar` | Registrar ingreso/egreso | Ausente |
| Líder | `/dashboard/config` | Configuración | Ausente |
| Líder | `/dashboard/asistencias` | Alertas de asistencia | Ausente |
| Líder | `/dashboard/tareas` | To-do del retiro | Ausente |
| Líder | `/dashboard/reembolsos` | Aprobación de reembolsos | Ausente |
| Líder | `/dashboard/retiro` | Consola operativa (7 pestañas) | No confirmada en la lectura |
| Líder | `/dashboard/palancas` | Coordinación Palancas | **Presente** (chequea `usuarios.rol` y `es_lider_palancas`) |
| Líder | `/dashboard/reuniones` | CRUD de reuniones | **Presente** (redirige si `rol !== 'lider'`) |
| Líder | `/dashboard/mensajes` | Mensajería | **Presente** (redirige si `rol !== 'lider'`) |
| Líder | `/perfil` | Perfil | — |
| Líder | `/notifications` | Notificaciones | — |
| Servidor | `/servidor` | Home | **Presente** (a nivel de `layout.tsx`) |
| Servidor | `/servidor/registro` | Autoregistro | **Presente** (a nivel de `layout.tsx`, con excepción explícita) |
| Servidor | `/servidor/pago` | Mi pago | **Presente** (a nivel de `layout.tsx`) |
| Servidor | `/servidor/retiro` | Mi retiro (mesa, roles) | **Presente** (a nivel de `layout.tsx`) |
| Servidor | `/servidor/palancas` | Palancas (individual o líder) | **Presente** (a nivel de `layout.tsx`) |
| Servidor | `/servidor/asistencias` | Check-in con selfie | **Presente** (a nivel de `layout.tsx`) |
| Servidor | `/servidor/reembolso` | Solicitar reembolso | **Presente** (a nivel de `layout.tsx`) |
| Servidor | `/servidor/versiculo` | Versículo + diario | **Presente** (a nivel de `layout.tsx`) |

De 18 pantallas de líder revisadas en detalle, solo **3** verifican el rol dentro del propio
componente. Las 15 restantes no tienen ninguna barrera de código — dependen enteramente de lo que
permitan las políticas de Row Level Security de Supabase, que no forman parte de este repositorio.
Ver `USER_ROLES.md`.

## 4. La consola "Retiro" — la pantalla más compleja del sistema

`app/dashboard/retiro/page.tsx` (1.248 líneas) concentra la operación del fin de semana en 7
pestañas:

| Pestaña | Qué hace |
|---|---|
| Minuto a Minuto | Cronograma del fin de semana, cargado con un mini-lenguaje de texto propio (`parsearTextoMM`) |
| Roles | Asignación de roles operativos (`roles_retiro`) |
| Mesas | Asignación de adultos/líderes/colíderes a cada mesa |
| Caminantes | Asignación de caminantes a mesas, marcado de "casos difíciles", seguimiento de llamadas |
| Cuartos | Asignación de habitaciones |
| Tabla | Edición tipo hoja de cálculo de mesas + cuartos en una sola vista |
| Manual | Un único enlace de salida a un Google Doc — no es una función, es un bookmark |

Sincroniza mesas y habitaciones hacia dos Google Apps Script distintos por `fetch` "dispara y
olvida": si Google no responde, el único rastro del error es un `console.error` en el navegador del
líder — nunca llega a la interfaz.

## 5. Componentes reutilizables (y los que deberían serlo pero no lo son)

| Componente | Uso real |
|---|---|
| `components/BottomNav.tsx` | Reutilizado correctamente en casi todas las pantallas de `/dashboard` |
| `components/servidores/BadgeTipoServidor.tsx` | Existe como componente compartido, pero `dashboard/servidores/page.tsx` y `dashboard/servidores/[id]/page.tsx` **reimplementan su propia copia inline** en vez de importarlo — 3 versiones del mismo componente de ~30 líneas |
| Emparejador de nombres difuso (`norm`/`tokensOf`/`nombreMatch`) | Copiado y pegado entre `dashboard/retiro/page.tsx` y `servidor/retiro/page.tsx`, con un comentario que advierte que ambas copias deben mantenerse idénticas a mano |
| Panel de coordinación de Palancas | Implementado dos veces casi en su totalidad: `dashboard/palancas/page.tsx` y la rama "líder de equipo" de `servidor/palancas/page.tsx` (~400 líneas cada una) |
| Patrón de "autovinculación" de cuenta de servidor | Repetido casi idéntico en `servidor/layout.tsx`, `servidor/page.tsx` y `servidor/pago/page.tsx` |

## 6. Funcionalidades incompletas o simuladas (stubs)

| Dónde | Qué promete | Qué hace en realidad |
|---|---|---|
| `dashboard/config/page.tsx` — botón "Sincronizar datos" | Sincronizar información | Solo vuelve a consultar la tabla `retiros` y muestra un toast de éxito, sin acción real |
| `dashboard/config/page.tsx` — toggle "Modo oscuro" | Activar tema oscuro | Muestra un toast "Próximamente disponible" |
| `dashboard/mensajes/page.tsx` — "Los mensajes desaparecen automáticamente después de 24 horas" | Auto-expiración de mensajes | Es solo un contador visual (`tiempoRestante()`); no existe ningún job ni lógica de servidor que borre los mensajes |
| `app/notifications/page.tsx` — campo `leida` | Marcar notificaciones como leídas | Siempre se inicializa en `false`; no hay ninguna escritura que lo cambie — el estado de lectura no se persiste nunca |
| `dashboard/retiro/page.tsx` — pestaña "Manual" | Una función más de la consola | Es un único enlace externo a un Google Doc |

## 7. Ver también

- Detalle de arquitectura y patrones: `ARCHITECTURE.md`
- Diagramas de flujo de datos: `DATA_FLOW.md`
- Tablas y vistas de la base de datos: `DATABASE_SCHEMA.md`
- Integraciones externas: `EXTERNAL_INTEGRATIONS.md`
- Roles y permisos: `USER_ROLES.md`
- Todo lo hardcodeado a este retiro específico: `HARDCODED_RETREAT_DATA.md`
- Plan de transformación a multi-retiro: `MULTI_RETREAT_MIGRATION_PLAN.md`
