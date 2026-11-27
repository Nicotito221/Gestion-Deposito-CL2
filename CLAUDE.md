# FLOW — Gestión de Depósito, Stock y Tracción

Sistema de logística de planta industrial: stock tri-nivel, abastecimiento a líneas, sincronización con depósito externo CL2 y planificación semanal de tracción de contenedores.

Repo: https://github.com/Nicotito221/Gestion-Deposito-CL2.git

## Stack

- **Backend:** Python FastAPI + Pydantic V2 + `pyodbc` (ODBC Driver 18/17 for SQL Server). Sin ORM.
- **Frontend:** React 18 + TypeScript + Vite + Tailwind + Lucide + Radix/shadcn.
- **DB principal:** SQL Server `GestionDeposito` en `.\SQLEXPRESS`.
- **Nodo externo:** Supabase/PostgreSQL con RLS, usado por operarios de CL2 (front en Vercel).
- **Ejecución:** `dev.py` (FastAPI `:8000` + Vite `:5173`), `run.py` / `start.bat`, PM2 vía `ecosystem.config.js`.

## Reglas de desarrollo

1. Task-driven: trabajar solo sobre la tarea pedida, sin cambios masivos ni refactors no solicitados.
2. Cero comentarios obvios o decorativos en el código.
3. Tipado estricto: nada de `any` en TypeScript; Pydantic V2 (`BaseModel`) en backend.
4. Rendimiento: evitar N+1 en SQL Server; memoizar en React para evitar re-renders.
5. Respetar la arquitectura existente: Routers → Services → Repositories → Schemas.

## Backend (`backend/app/`)

- `routers/`: endpoints HTTP, dependencias, códigos de estado.
- `services/`: lógica de negocio, algoritmos de asignación, parseo de planillas (BOM, Contenedores, Calendario, Invoices), sincronización.
- `repositories/`: SQL parametrizado con `pyodbc`, transacciones explícitas (`BEGIN TRAN` / `COMMIT` / `ROLLBACK`).
- `schemas/`: DTOs Pydantic V2.
- `core/`: `config.py`, `time.py` (horario Argentina), `security.py`.

Conexión sin autocommit para operaciones transaccionales. T-SQL: `DATETIME2`, `OFFSET FETCH`, `MERGE`/`UPDATE`.

## Frontend (`frontend/src/app/`)

- Servicios centralizados (`services/api.ts`, `services/contenedorService.ts`) con `fetch` tipado.
- Estado local en componentes.
- RBAC con `ProtectedRoute`. Roles: `administrador`, `gerente`, `jefe`, `analista`, `contador_ciclico`, `deposito`, `operario_deposito`, `operario_planta`, `supervisor`. Sectores: `CL2`, `Planta`.

## Dominio

**Stock tri-nivel** por material:
1. **Planta:** pie de línea, consumido por producción diaria.
2. **CL2:** depósito satélite gestionado por tercero logístico.
3. **TBAR:** depósito central / tracción (amortiguación).

Se consolidan los tres saldos para calcular desvíos, stock de seguridad y pedidos de reposición diaria.

**Sincronización CL2 (Planta ↔ Supabase):** la planta no expone puertos a Internet.
- Push: `Cl2SyncService` envía pedidos por HTTPS saliente a Supabase.
- Pull: worker `_cl2_sync_polling_loop` consulta cada `CL2_SYNC_INTERVAL_SECONDS` remitos/pedidos preparados y los refleja en SQL Server.

## Módulos

| Módulo | Ruta frontend | Router backend |
|---|---|---|
| Auth y usuarios | `/login`, `/usuarios` | `/api/auth`, `/api/usuarios` |
| Materiales y BOM | `/materiales`, `/configuracion-materiales` | `/api/bom` |
| Conteo en planta | `/conteo`, `/conteo-ciclico` | `/api/conteo` |
| Rundown vivo | `/rundown` | `/api/rundown` |
| Pedidos | `/nuevo-pedido`, `/pedidos`, `/pedidos/:id` | `/api/pedidos` |
| Preparación depósito | `/deposito`, `/deposito/preparacion/:id` | `/api/pedidos` |
| Remitos y entregas | `/remitos`, `/remitos/:id`, `/confirmar-entrega/:id` | `/api/pedidos`, `/api/ingresos` |
| Stock tri-nivel | `/stock` | `/api/stock` |
| Suministro BOM / SAP PIR | `/suministro-bom` | `/api/suministro` |
| Planificación contenedores | `/contenedores-planificacion` | `/api/contenedores` |
| Auditoría | `/trazabilidad` | `/api/auditoria` |

Estados de pedido: `pendiente`, `en_preparacion`, `completo`.

## Base de datos (`backend/database/`)

- `00_init_database.sql`: materiales, stock, pedidos, remitos, usuarios.
- `01_migracion_bom_multinivel.sql`: BOM multinivel.
- `02_crear_tabla_set_componente.sql`: productos ↔ conjuntos de componentes.
- `03_crear_tablas_rundown.sql`: `rundown_diario`, `calendario_productivo`, `produccion_planificada`.
- `04_crear_secciones_rundown.py`: secciones lógicas del rundown.
- `05_migracion_usuarios.sql`: perfil, sectores, acceso.
- `07_migracion_sync_cl2.sql`: `SyncOutbox` y marcas de replicación.
- `08_esquema_deposito_cl2.sql`: depósitos satélites.
- `09_planificacion_contenedores.sql`: `factura_contenedor`, `contenedor`, `contenedor_detalle`, `plan_traccion`, `plan_traccion_detalle`.

## Ramas

- `main` / `testing`: estables, sincronizadas con GitHub.
- `nuevas-funcionalidades`: rama activa. Foco actual: refinamiento del módulo de **planificación de contenedores** (parseo de Inbound Plan / Packing List con `origen`, deduplicación de contenedores, exportación Excel del plan semanal de tracción con `openpyxl`).
- `backup_pre_three_tier_stock`: punto de restauración previo al stock tri-nivel. Solo referencia, no fusionar.
- `stash@{0}` (en `testing`, `wip-supply-order`): exportación SAP PIR con segundo miércoles del mes (`get_second_wednesday`), fecha de corte, encoding `windows-1252` y modal de fechas tentativas. Pendiente decidir dónde integrarlo.

## Git

- No subir nada relacionado a IA (ya cubierto en `.gitignore`, incluido este archivo).
- Commits en estilo convencional: `feat(modulo): ...`, `fix(modulo): ...`.
