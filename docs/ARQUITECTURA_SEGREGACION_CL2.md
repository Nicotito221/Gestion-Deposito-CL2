# Arquitectura de Segregación y Sincronización CL2

## 1. Contexto y Objetivos de Seguridad

Por requerimientos de cumplimiento y seguridad de la información corporativa, la operación correspondiente al depósito **CL2** (preparación de pedidos, control de stock y remitos) será operada por un proveedor externo. 

### Principio de Diseño
- **Acceso Cero a la Red Interna:** El tercero no tiene conexión directa de red ni credenciales a la base de datos interna de la empresa (SQL Server corporativo).
- **Entorno Externo Desacoplado:** El frontend y el backend/almacén de datos utilizados por el tercero se ejecutan en infraestructura aislada accesible vía Internet público bajo esquemas de autenticación y autorización independientes.
- **Consistencia de Datos:** Toda acción efectuada desde Planta (pedidos, carga de remitos, ajustes de stock CL2) se replica en la base externa, y cualquier actualización originada por el tercero (cambio de estado a "En preparación", "Completado", confirmación de cantidades) se replica en la base interna.

---

## 2. Topología de la Solución

```
+--------------------------------------------------------+
|                    ENTORNO PLANTA                      |
|                                                        |
|   +-------------------+        +-------------------+   |
|   |  Frontend Planta  |        |  SQL Server Corp  |   |
|   +---------+---------+        +---------+---------+   |
|             |                            |             |
|             +------------+---------------+             |
|                          |                             |
|                +---------v---------+                   |
|                |  Backend Planta   |                   |
|                |  (FastAPI Corp)   |                   |
|                +----+---------^----+                   |
|                     |         |                        |
+---------------------|---------|------------------------+
                      | HTTPS   | HTTPS
             Outbox / | (HMAC)  | Webhook
             Sync Job |         | (HMAC)
+---------------------|---------|------------------------+
|                     |         |                        |
|                +----v---------+----+                   |
|                |    Backend CL2    |                   |
|                |  (FastAPI / Edge) |                   |
|                +----+---------^----+                   |
|                     |         |                        |
|             +-------+         +-------+                |
|             |                         |                |
|   +---------v---------+     +---------+---------+      |
|   |  Supabase / PG    |     |   Frontend CL2    |      |
|   |  (Base Externa)   |     | (Vercel / Hosting)|      |
|   +-------------------+     +-------------------+      |
|                                                        |
|                    ENTORNO CL2 (TERCERO)               |
+--------------------------------------------------------+
```

---

## 3. Base de Datos Externa Recomendada

**Opción Seleccionada:** **Supabase (PostgreSQL administrado)**.

### Racional de Decisión
1. **Seguridad y Aislamiento:** Red independiente con cifrado en reposo y en tránsito. Soporte nativo de Row Level Security (RLS) y autenticación JWT para los operarios del tercero.
2. **Capacidades de Eventos:** Generación automática de Webhooks ante cambios en tablas de PostgreSQL (`INSERT`, `UPDATE`), facilitando la notificación reactiva al backend de Planta.
3. **Bajo Mantenimiento:** Elimina la carga de gestión de infraestructura y parches de SO para el ambiente del tercero.

---

## 4. Patrón de Sincronización: Transactional Outbox + Webhooks Seguros

Para garantizar que los datos no se pierdan ante caídas temporales de conectividad o reinicios de servicio, se descartan llamadas HTTP sincrónicas directas en los controladores transaccionales principales.

### 4.1. Flujo: Planta -> CL2 (Ej. Pedido Creado o Modificado)
1. **Transacción Local:** El usuario en Planta genera un pedido hacia CL2. En una única transacción de SQL Server se inserta el registro de negocio y un registro en la tabla `SyncOutbox` con estado `PENDING`.
2. **Worker de Despacho (Sync Worker):** Un proceso en background toma los eventos `PENDING` de `SyncOutbox`.
3. **Llamada Segura:** Envía una petición `POST` al endpoint de ingesta del Backend CL2.
   - Autenticación mediante header `X-Signature` (HMAC SHA-256 con clave secreta compartida) y timestamp anti-replay.
4. **Confirmación:** Ante respuesta `200/201 OK`, el evento se marca como `PROCESSED`. Ante fallo, se incrementa el contador de reintentos con backoff exponencial.

### 4.2. Flujo: CL2 -> Planta (Ej. Tercero confirma remito o cambia estado)
1. El operario del tercero interactúa con el Frontend CL2 y actualiza el pedido/remito.
2. La base de datos externa / Backend CL2 registra la modificación.
3. Backend CL2 despacha un Webhook al endpoint público de sincronización del Backend Planta (`/api/v1/sync/cl2-inbound`).
4. Backend Planta valida:
   - Firma HMAC de la petición.
   - Idempotencia del evento (mediante `event_id` único para evitar procesamiento duplicado).
5. Aplica la actualización en SQL Server dentro de una transacción explícita y confirma `200 OK`.

---

## 5. Entidades y Tablas en Alcance de Sincronización

Únicamente se replica el subconjunto de datos que CL2 necesita operar:

| Entidad | Dirección | Datos Sensibles Excluidos |
| :--- | :--- | :--- |
| **Materiales / Catálogo CL2** | Planta -> CL2 | Costos, proveedores y fórmulas confidenciales (BOM completa de producción). Solo códigos, descripciones y unidades de medida. |
| **Stock CL2** | Bidireccional | Stocks de otros depósitos de planta. |
| **Pedidos CL2** | Planta -> CL2 (Alta), CL2 -> Planta (Estados/Pick) | Información financiera o comercial no operativa. |
| **Remitos CL2** | Bidireccional | Facturación interna, márgenes o valorizaciones contables. |

---

## 6. Estructura de Control de Idempotencia y Outbox

### Tabla `SyncOutbox` (SQL Server - Planta)
```sql
CREATE TABLE dbo.SyncOutbox (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    AggregateType NVARCHAR(50) NOT NULL,
    AggregateId NVARCHAR(100) NOT NULL,
    EventType NVARCHAR(50) NOT NULL,
    PayloadJson NVARCHAR(MAX) NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
    RetryCount INT NOT NULL DEFAULT 0,
    MaxRetries INT NOT NULL DEFAULT 5,
    NextRetryAt DATETIME2 NULL,
    ProcessedAt DATETIME2 NULL,
    ErrorMessage NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_SyncOutbox_Status_NextRetryAt 
ON dbo.SyncOutbox (Status, NextRetryAt);
```

### Tabla `ProcessedEvents` (Para recepción en ambos extremos)
```sql
CREATE TABLE dbo.ProcessedEvents (
    EventId NVARCHAR(100) PRIMARY KEY,
    EventType NVARCHAR(50) NOT NULL,
    ProcessedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
```

---

## 7. Despliegue y Hosting del Frontend CL2

1. **Alojamiento:** El Frontend de CL2 se compila como una aplicación web SPA independiente (React + Vite + Tailwind) y se hospeda en un servicio estático en la nube (ej. Vercel, Cloudflare Pages o AWS S3/CloudFront).
2. **Restricción de Red:**
   - Dominio independiente (ej. `cl2.empresa.com` o dominio propio del servicio).
   - Variables de entorno (`VITE_API_URL`) apuntando exclusivamente a la API externa de CL2.
   - Sin conocimiento alguno de la infraestructura o URLs de la red interna de Planta.

---

## 8. Gestión y Segregación de Usuarios (Autenticación y Roles)

El principio de segregación aplica con igual rigor a las identidades y credenciales de acceso:

1. **Aislamiento de Credenciales:**
   - Los operarios del tercero **no existen** en la base de datos interna ni en el directorio corporativo (Active Directory / LDAP).
   - Sus credenciales y sesiones residen exclusivamente en la base externa (ej. Supabase Auth / PostgreSQL externo).
2. **Trazabilidad sin Exposición de Identidades:**
   - En las transacciones replicadas hacia Planta (quién preparó o remitió un pedido), los eventos viajan con un identificador de auditoría (`external_user_id`, `operator_name`), sin compartir datos sensibles de cuentas.
3. **Control de Acceso Basado en Roles (RBAC):**
   - El entorno CL2 cuenta únicamente con roles acotados a la operación de depósito (`deposito_operador`, `deposito_supervisor`).
   - Los usuarios de Planta conservan sus credenciales internas para interactuar con los módulos locales sin necesidad de cuentas en el sistema del tercero.

---

## 9. Modelo de Auditoría para Acciones del Tercero

Para conciliar la trazabilidad legal/operativa con la segregación de identidades, la auditoría en la base interna (SQL Server) registra los eventos del tercero bajo el siguiente esquema:

### 9.1. Estructura de Campos de Auditoría en Tablas Principales
En las entidades afectadas (pedidos, remitos, movimientos de stock), se estandarizan las columnas de auditoría:
- `OrigenModificacion`: Indica el origen del cambio (`PLANTA_INTERNO` vs `CL2_EXTERNO`).
- `UsuarioId`: Identificador del usuario interno si la acción ocurrió en Planta (o `NULL` si vino de CL2).
- `UsuarioExternoNombre`: Nombre y apellido o legajo operativo provisto por el tercero (ej. `Juan Perez (CL2)`).
- `UsuarioExternoId`: UUID o identificador opaco del usuario en la base externa.
- `FechaModificacion`: Timestamp UTC del momento de aplicación.
- `SyncEventId`: ID del evento de sincronización para cruce forense de logs si fuera necesario.

### 9.2. Ejemplo de Visualización en el Histórico / UI de Planta
En las vistas de auditoría e historial del frontend de Planta, las acciones se diferencian claramente:

| Fecha / Hora | Acción | Origen | Operador Responsable | Detalle |
| :--- | :--- | :--- | :--- | :--- |
| `07/10/2026 09:15` | Creación de Pedido | **Planta** | `nangerossa` | Creado desde sugerencia de conteo |
| `07/10/2026 10:20` | Estado: En preparación | **CL2 (Externo)** | `Juan Perez (CL2)` | Preparando en depósito externo |
| `07/10/2026 11:05` | Confirmación / Remito | **CL2 (Externo)** | `Maria Gomez (CL2)` | Despachado Remito #REM-00452 |

Esto permite saber con total claridad **quién ejecutó cada acción en el depósito**, manteniendo un historial inmutable sin que los operarios del tercero tengan cuentas en la infraestructura corporativa.


