# DATA_FLOW — Diagrama de flujo de datos

> Diagramas en Mermaid (se renderizan automáticamente en GitHub). Ver `ARCHITECTURE.md` para el
> detalle del stack y `EXTERNAL_INTEGRATIONS.md` para el detalle de cada integración marcada aquí.

## 1. Mapa de sistemas conectados

```mermaid
flowchart LR
    subgraph Cliente["Navegador (líder / servidor)"]
        UI["Páginas Next.js\n'use client'"]
    end

    subgraph Vercel["Next.js en Vercel"]
        API["10 rutas /api\n(service role key)"]
    end

    subgraph SB["Supabase — fuente de verdad"]
        DB[("Postgres\n~24 tablas/vistas")]
        AUTH["Auth\n(email + magic link)"]
        STORE["Storage\ncomprobantes-pagos"]
        RT["Realtime\npostgres_changes"]
    end

    RESEND["Resend\ncorreo transaccional"]
    VISION["Google Vision API\nOCR de comprobantes"]
    SCRIPTS["4× Google Apps Script\n(código fuera del repo,\nsin auth, fire-and-forget)"]
    SHEETS["Google Sheets\nespejo de inscritos +\ncotizaciones de proveedores"]
    GMAIL["Gmail\n(vía Apps Script)\ncorreos de confirmación de pago"]
    FORM["Google Form\npre-inscripción pública"]

    UI -- "anon key, directo" --> DB
    UI -- "anon key" --> AUTH
    UI -- "anon key" --> STORE
    UI -- "suscripción" --> RT
    UI -- "API key + OAuth implícito\nen el bundle público" -.-> SHEETS

    UI --> API
    API -- "service role key" --> DB
    API --> RESEND
    API -- "base64 de imagen" --> VISION
    API --> SCRIPTS

    SCRIPTS --> SHEETS
    SCRIPTS --> GMAIL
    FORM -. "trigger externo,\nno visible en este repo" .-> API

    style SCRIPTS fill:#3a2510,stroke:#ac5300
    style SHEETS fill:#1b1d29,stroke:#ac5300
```

**Líneas punteadas:** conexiones que evitan por completo las rutas API de Next.js. El navegador
habla directo con la API de Google Sheets (pestaña "Cotizaciones" de finanzas) y el Google Form
dispara la pre-inscripción por su cuenta, mediante un trigger que no está en este repositorio.

## 2. Ciclo de vida de un caminante: de la pre-inscripción al cupo confirmado

```mermaid
sequenceDiagram
    participant C as Caminante
    participant F as Google Form
    participant API1 as /api/correos/forms/inscripcion
    participant DB as Supabase (caminantes, contactos_emergencia)
    participant L as Líder (dashboard)
    participant R as Resend
    participant U as Líder (sube comprobante)
    participant V as Google Vision (OCR opcional)
    participant API2 as /api/pagos/registrar
    participant AS as Apps Script (correos + hojas)

    C->>F: Llena el formulario público
    F-->>API1: trigger externo (no versionado en el repo)
    API1->>DB: valida cupo (vista_cupos) y duplicado (numero_documento)
    API1->>DB: INSERT caminantes (estado_correo='sin_enviar') + contactos_emergencia
    L->>DB: ve el nuevo caminante en /dashboard/caminantes
    L->>R: "Enviar correo" → instrucciones de pago (cuenta bancaria hardcodeada)
    Note over C: paga y envía comprobante fuera de la app (WhatsApp/correo)
    U->>V: (opcional) sube foto del comprobante para autocompletar el monto
    U->>API2: POST /api/pagos/registrar { caminanteId, valor, fileUrl, ... }
    API2->>DB: INSERT pagos
    API2->>DB: suma total pagado por el caminante
    alt total pagado >= $500.000
        API2->>DB: UPDATE caminantes SET inscrito_oficialmente = true
    end
    API2->>AS: POST { tipo: 'confirmacion_pago' | 'sorpresa_pago', ... }
    AS->>AS: envía correo de confirmación (Gmail) + agrega fila al Sheet espejo
    Note over AS: si es_sorpresa=true, el correo va al contacto de emergencia,\nnunca al caminante
```

El umbral de `$500.000` y el cupo máximo no viven en una tabla de configuración: son literales
repetidos en varios archivos (`dashboard/caminantes/[id]/page.tsx`, `api/pagos/registrar/route.ts`).
Ver `HARDCODED_RETREAT_DATA.md`.

## 3. Flujo de pago de un servidor interno

```mermaid
sequenceDiagram
    participant S as Servidor (portal propio)
    participant DB as Supabase (pagos, servidores_inscripcion)
    participant API as /api/pagos/servidor
    participant AS as Apps Script (correos)
    participant L as Líder (ficha de servidor)

    S->>DB: sube comprobante directo a Storage (comprobantes-pagos/servidores/...)
    S->>DB: INSERT pagos { estado: 'pendiente', valor: 0 }
    Note over L: el líder revisa el comprobante y escribe el monto real confirmado
    L->>DB: UPDATE pagos SET estado='confirmado', valor=<monto verificado>
    L->>API: (alta manual alternativa) POST /api/pagos/servidor
    API->>DB: INSERT pagos { estado: 'confirmado' }
    API->>DB: suma total pagado, calcula esPagoCompleto (>= $380.000)
    API->>AS: POST { tipo: 'confirmacion_pago_servidor', ... }
    AS->>AS: envía correo de confirmación
```

Nótese que la confirmación de un pago pendiente puede hacerse de dos maneras distintas dentro del
mismo flujo: edición directa de la fila `pagos` desde la ficha del servidor, o vía
`/api/pagos/servidor`. Ninguna de las dos valida del lado del servidor que quien confirma tenga
efectivamente rol de líder (ver `USER_ROLES.md`).

## 4. Autenticación y enrutamiento por rol

```mermaid
flowchart TD
    Login["/  (login)"] -->|"signInWithPassword"| Check{"usuarios.rol"}
    Check -->|"lider"| Dash["/dashboard"]
    Check -->|"servidor"| Serv["/servidor"]
    NoAcc["Servidor sin cuenta"] --> Reg["/servidor/registro"]
    Reg -->|"busca por nombre/cédula\nen servidores_inscripcion\n(sin autenticar)"| Create["signUp + signInWithPassword"]
    Create --> Link["UPDATE servidores_inscripcion\nSET usuario_id = auth.user.id"]
    Link --> Serv
    Dash -.->|"sin middleware ni layout guard"| DashPages["15 de 18 pantallas de líder\nsin verificación de rol propia"]
    Serv -->|"servidor/layout.tsx"| ServPages["Todas las pantallas de servidor\n(guard centralizado real)"]
```

## 5. Sincronización de logística del retiro (mesas y cuartos)

```mermaid
flowchart LR
    L["Líder en /dashboard/retiro"] -->|"asigna mesas/cuartos"| DB[("Supabase\nmesas, habitaciones,\nasignaciones_*")]
    DB -->|"syncMesas()"| AM["Apps Script — Mesas"]
    DB -->|"syncHabitaciones()"| AH["Apps Script — Cuartos"]
    AM -->|"try/catch vacío"| X1["Google Sheet de mesas"]
    AH -->|"try/catch vacío"| X2["Google Sheet de cuartos"]
    AM -.->|"si falla"| Silencio1["console.error only —\nel líder nunca se entera"]
    AH -.->|"si falla"| Silencio2["console.error only —\nel líder nunca se entera"]
```

## 6. Notificaciones — dos fuentes que no coinciden entre sí

`app/dashboard/page.tsx` calcula su propio contador de alertas
(`reembolsosPendientes + alertasAsistencia`), mientras que `app/notifications/page.tsx` agrega **6**
fuentes distintas (pagos pendientes, caminantes nuevos, alertas de asistencia, reembolsos
pendientes, mensajes recientes, actualizaciones de Palancas) de forma completamente independiente,
sin estado de lectura persistido. El número que ve el líder en la campana del dashboard y el
contenido real del feed de notificaciones son dos cálculos separados que pueden no coincidir.

## 7. Ver también

- `EXTERNAL_INTEGRATIONS.md` — detalle de cada sistema externo mencionado en estos diagramas.
- `DATABASE_SCHEMA.md` — columnas completas de cada tabla involucrada.
- `HARDCODED_RETREAT_DATA.md` — todos los valores literales (montos, umbrales, URLs) que aparecen
  en estos flujos.
