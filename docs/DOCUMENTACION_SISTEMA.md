# Documentación Técnica y Funcional del Sistema

## 1. Arquitectura General

El sistema gestiona la comunicación logística entre la Planta de Ensamble y el Depósito CL2 (operador tercerizado). Automatiza la ingesta de demanda, el versionado de recetas (BOM), el arrastre de stock diario en planta, el cálculo de pedidos sugeridos, el picking con validación QR por bulto y el kardex de movimientos.

```
+-----------------------------------------------------------------------------------+
|                            ZONA INTERNA (PLANTA / TI)                             |
|  - Conteo Físico en Planta (Móvil)                                                |
|  - Ingesta de BOM (CS11/CS12) y Mapeo Set-Componente                             |
|  - Carga de Demanda / Orden de Suministro (Formatos 1 y 2)                        |
|  - Rundown Diario Vivo y Sugerencia de Pedido                                     |
|  - Recepción y Validación QR por Bulto                                            |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼  [FastAPI / Red Local]
+-----------------------------------------------------------------------------------+
|                        ZONA TERCERIZADA (DEPÓSITO / CL2)                          |
|  - Inventario de Stock en Depósito                                                |
|  - Bandeja de Pedidos y Picking                                                   |
|  - Despacho, Generación de QR por Pallet y Emisión de Remito                      |
|  - Recepción de Ingresos de Proveedores Externos                                  |
+-----------------------------------------------------------------------------------+
```

### Stack Tecnológico
- **Frontend:** React 18, TypeScript (estricto sin `any`), Vite 6, Tailwind CSS 4, Radix UI / Shadcn.
- **Backend:** Python 3.14, FastAPI 0.141, Pydantic V2, Starlette, Uvicorn.
- **Base de Datos:** Microsoft SQL Server (instancia `SQLEXPRESS`), driver `ODBC Driver 18 for SQL Server`, pyodbc 5.3.

---

## 2. Base de Datos (SQL Server: `GestionDeposito`)

### 2.1. Tablas Maestras y de Configuración

#### `dbo.material`
Catálogo de piezas e insumos controlados.
- `id_material` (`varchar(50)`, PK): Código de pieza normalizado (ej. `71611-0K080-00`).
- `nombre` (`varchar(150)`): Descripción técnica del insumo.
- `unidad` (`varchar(10)`): Unidad de medida (`UN`, `KG`, `MT`, `LT`, etc.).
- `centro` (`varchar(10)`): Centro logístico (default `'1000'`).
- `controla_stock` (`bit`): Indicador de seguimiento de inventario.

#### `dbo.producto`
Catálogo de productos terminados y sets de ensamble.
- `id_producto` (`varchar(50)`, PK): Código del set o producto terminado.
- `nombre` (`varchar(150)`): Denominación comercial/técnica.
- `descripcion` (`varchar(250)`): Detalle del conjunto.
- `sector` (`varchar(50)`): Sector de línea productiva (ej. `Seat`, `Seat Cushion`, `Seat Back`).
- `activo` (`bit`): Estado de vigencia en línea.

#### `dbo.usuario`
Usuarios del sistema con control de acceso por roles.
- `id_usuario` (`int`, IDENTITY, PK): Identificador único.
- `username` (`varchar(50)`, UNIQUE): Nombre de usuario.
- `password_hash` (`varchar(255)`): Clave cifrada.
- `nombre` (`varchar(100)`), `apellido` (`varchar(100)`): Datos de identidad.
- `rol` (`nvarchar(50)`): Restringido por CHECK a `'administrador'`, `'supervisor'`, `'operario_deposito'`, `'solicitante'`.
- `activo` (`bit`), `fecha_creacion` (`datetime2(0)`).

---

### 2.2. Estructura de Recetas (BOM)

#### `dbo.bom_version`
Control inmutable de versiones de archivos de recetas importados.
- `id_version` (`int`, IDENTITY, PK): Número correlativo de versión.
- `nombre_archivo` (`varchar(150)`): Nombre original del archivo fuente.
- `fecha_importacion` (`datetime2(0)`): Fecha y hora del proceso.
- `total_lineas` (`int`): Total de registros procesados.
- `es_vigente` (`bit`): Índice único condicional `UQ_bom_version_activa` que restringe a exactamente una única versión en estado activo (`es_vigente = 1`).
- `observacion` (`varchar(250)`).

#### `dbo.bom_estructura`
Árbol jerárquico multinivel derivado de reportes CS11/CS12 de SAP.
- `id_bom` (`int`, IDENTITY, PK).
- `id_version` (`int`, FK -> `bom_version.id_version` ON DELETE CASCADE).
- `id_producto_raiz` (`varchar(50)`, FK -> `material.id_material`): Raíz de la receta.
- `id_padre` (`varchar(50)`, FK -> `material.id_material`): Subconjunto contenedor inmediato.
- `id_hijo` (`varchar(50)`, FK -> `material.id_material`): Componente o insumo directo.
- `cantidad` (`decimal(18, 4)`): Multiplicador de consumo unitario.
- `unidad` (`varchar(10)`): Unidad de medida.
- `nivel` (`int`): Nivel de profundidad en la estructura (1 = primer nivel, 2 = subnivel, etc.).
- `orden` (`int`): Secuencia física de lectura del reporte original.

#### `dbo.bom_explosion_plana`
Consolidación plana de factores acumulados para el cálculo instantáneo de consumos en Rundown.
- `id_version` (`int`, PK): Versión de receta activa.
- `id_producto_raiz` (`varchar(50)`, PK): Producto terminado demandado.
- `id_material_insumo` (`varchar(50)`, PK): Insumo terminal requerido.
- `factor_consumo_total` (`decimal(18, 4)`): Multiplicador total acumulado ($\prod \text{cantidades intermedias}$).
- `unidad` (`varchar(10)`).

#### `dbo.set_componente`
Mapeo operacional directo entre códigos de demanda (TASA / SAP) y materiales de primer nivel.
- `id_set_componente` (`int`, IDENTITY, PK).
- `sector` (`varchar(50)`): Sector funcional (ej. `Seat Cushion`, `Mechanism`).
- `sd` (`varchar(50)`): Código de sub-división o identificador interno.
- `codigo_tasa` (`varchar(50)`): Identificador compuesto con sufijos de planta.
- `codigo_sap_padre` (`varchar(50)`): Código base normalizado del set.
- `id_material_hijo` (`varchar(50)`): Código del componente requerido.
- `cantidad` (`decimal(18, 4)`): Ratio de consumo unitario por set producido.
- `activo` (`bit`): Bandera de inclusión en explosión de consumos.
- `fecha_creacion` (`datetime2(0)`).

---

### 2.3. Planificación y Producción

#### `dbo.importacion_archivo`
Registro de lotes de importación masiva.
- `id_importacion` (`int`, IDENTITY, PK).
- `tipo` (`nvarchar(50)`): Restringido por CHECK a `'stock_inicial'`, `'produccion_real'`, `'produccion_planificada'`, `'bom_sap'`.
- `nombre_archivo` (`varchar(150)`): Archivos incluidos en el lote.
- `id_usuario` (`int`, FK -> `usuario.id_usuario`).
- `fecha_importacion` (`datetime2(0)`).
- `estado` (`nvarchar(50)`): `'procesada'`, `'procesada_con_errores'`, `'rechazada'`.
- `observacion` (`varchar(250)`).

#### `dbo.produccion_planificada`
Matriz de demanda proyectada por producto y fecha.
- `id_produccion_planificada` (`bigint`, IDENTITY, PK).
- `id_producto` (`varchar(50)`, FK -> `producto.id_producto`): Set demandado.
- `fecha` (`date`): Fecha calendario correspondiente.
- `cantidad_planificada` (`decimal(18, 4)`): Cantidad de unidades a producir.
- `id_importacion` (`int`, FK -> `importacion_archivo.id_importacion`).
- `id_usuario` (`int`, FK -> `usuario.id_usuario`).
- `fecha_carga` (`datetime2(0)`).

#### `dbo.produccion_real`
Declaración de producción efectivamente fabricada al cierre de turno.
- `id_produccion_real` (`bigint`, IDENTITY, PK).
- `id_producto` (`varchar(50)`, FK -> `producto.id_producto`).
- `fecha` (`date`): Fecha de producción declarada.
- `turno` (`varchar(10)`): Turno operativo (T1, T2, etc.).
- `cantidad_producida` (`decimal(18, 4)`): Unidades terminadas.
- `id_usuario` (`int`, FK -> `usuario.id_usuario`).

---

### 2.4. Control de Inventario y Depósito

#### `dbo.stock_deposito`
Inventario físico disponible en el depósito CL2.
- `id_stock` (`int`, IDENTITY, PK).
- `id_material` (`varchar(50)`, FK -> `material.id_material`).
- `cantidad_actual` (`decimal(18, 4)`): Stock físico en depósito.
- `lote` (`varchar(50)`): Identificador de lote.
- `ubicacion` (`varchar(50)`): Posición física de estantería o pasillo.
- `fecha_actualizacion` (`datetime2(0)`).

#### `dbo.movimiento_stock`
Kardex de auditoría inmutable (append-only) para todo movimiento de inventario.
- `id_movimiento` (`bigint`, IDENTITY, PK).
- `id_material` (`varchar(50)`, FK -> `material.id_material`).
- `tipo_movimiento` (`nvarchar(50)`): `'ingreso_proveedor'`, `'despacho_pedido'`, `'ajuste_conteo'`, `'merma'`.
- `cantidad` (`decimal(18, 4)`).
- `stock_anterior` (`decimal(18, 4)`), `stock_posterior` (`decimal(18, 4)`).
- `id_usuario` (`int`, FK -> `usuario.id_usuario`).
- `fecha_movimiento` (`datetime2(0)`).
- `motivo` (`varchar(250)`).

---

### 2.5. Pedidos, Despacho y Trazabilidad QR

#### `dbo.pedido`
Encabezado de solicitudes de reposición emitidas por Planta hacia Depósito.
- `id_pedido` (`int`, IDENTITY, PK).
- `id_usuario_solicitante` (`int`, FK -> `usuario.id_usuario`).
- `id_usuario_preparador` (`int`, NULL, FK -> `usuario.id_usuario`).
- `fecha_creacion` (`datetime2(0)`), `fecha_entrega` (`datetime2(0)`, NULL).
- `estado` (`nvarchar(50)`): `'pendiente'`, `'en_preparacion'`, `'en_transito'`, `'completo'`, `'parcial'`, `'cancelado'`.
- `tipo_pedido` (`nvarchar(50)`): `'sugerido_rundown'`, `'manual_reposicion'`, `'urgencia'`.

#### `dbo.material_pedido`
Detalle de líneas de un pedido.
- `id_pedido` (`int`, FK -> `pedido.id_pedido`).
- `id_material` (`varchar(50)`, FK -> `material.id_material`).
- `cantidad_solicitada` (`decimal(18, 4)`).
- `cantidad_preparada` (`decimal(18, 4)`).
- `estado_item` (`nvarchar(50)`): `'pendiente'`, `'preparado'`, `'discrepante'`.

#### `dbo.etiqueta_qr`
Tokens únicos por bulto/pallet generados al despachar un pedido.
- `id_etiqueta` (`bigint`, IDENTITY, PK).
- `id_pedido` (`int`, FK -> `pedido.id_pedido`).
- `id_material` (`varchar(50)`, FK -> `material.id_material`).
- `token_qr` (`varchar(100)`, UNIQUE): Hash único legible por escáner móvil.
- `estado` (`nvarchar(50)`): `'generada'`, `'validada'`, `'anulada'`.
- `fecha_escaneo` (`datetime2(0)`, NULL).

#### `dbo.remito`
Documento de remito interno de entrega.
- `id_remito` (`int`, IDENTITY, PK).
- `id_pedido` (`int`, FK -> `pedido.id_pedido`).
- `numero_remito` (`varchar(50)`, UNIQUE): Numeración correlativa interna.
- `fecha_emision` (`datetime2(0)`).
- `pdf_path` (`varchar(255)`): Ruta de almacenamiento del comprobante emitido.
- `estado` (`nvarchar(50)`): `'emitido'`, `'firmado'`, `'observado'`.

---

### 2.6. Auditorías de Planta y Rundown

#### `dbo.conteo` y `dbo.material_conteo`
Auditorías de conteo físico ejecutadas en planta con dispositivo móvil.
- `conteo`: `id_conteo`, `id_usuario`, `fecha_conteo`, `estado`, `sector`.
- `material_conteo`: `id_conteo`, `id_material`, `stock_teorico`, `stock_contado`, `desvio` ($\text{Desvío} = \text{Contado} - \text{Teórico}$).

#### `dbo.rundown_diario`
Cierre diario consolidado del inventario de planta.
- `id_rundown` (`bigint`, IDENTITY, PK).
- `fecha` (`date`): Fecha operativa del balance.
- `id_material` (`varchar(50)`).
- `stock_inicial` (`decimal(18, 4)`): Saldo arrastrado del día anterior.
- `conteo_fisico` (`decimal(18, 4)`, NULL): Valor real contado en planta.
- `consumo_estimado` (`decimal(18, 4)`): $\text{Producción Proyectada} \times \text{BOM}$.
- `consumo_real` (`decimal(18, 4)`): $\text{Producción Real} \times \text{BOM}$.
- `cantidad_sugerida` (`decimal(18, 4)`): Cantidad resultante a solicitar.

---

## 3. Backend (FastAPI + SQL Server)

### 3.1. Módulos y Capas

```
backend/
├── app/
│   ├── main.py                       # Configuración FastAPI, CORS y registro de routers
│   ├── core/
│   │   └── config.py                 # Conexión pyodbc a SQL Server
│   ├── schemas/
│   │   ├── bom.py                    # Schemas Pydantic V2 para BOM y recetas
│   │   └── supply.py                 # Schemas Pydantic V2 para orden de suministro
│   ├── repositories/
│   │   ├── bom_repository.py         # Consultas SQL para versiones y set_componente
│   │   └── supply_repository.py      # Persistencia masiva y consultas de demanda
│   ├── services/
│   │   ├── bom_parser.py             # Parser estructural de reportes SAP CS11/CS12
│   │   ├── bom_service.py            # Orquestador de importación de BOM multinivel
│   │   └── supply_service.py         # Motor de consolidación y persistencia de suministro
│   └── routers/
│       ├── bom.py                    # Endpoints /api/bom/*
│       └── supply.py                 # Endpoints /api/suministro/*
└── consolidate_production.py         # Motor matricial para planillas F1, F2 y BOM
```

---

### 3.2. Catálogo de Endpoints REST

#### Módulo BOM (`/api/bom`)

| Método | Ruta | Parámetros / Body | Respuesta | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/bom/versiones` | Ninguno | `List[BomVersionOut]` | Retorna historial de versiones de BOM ordenadas por estado vigente y fecha. |
| `GET` | `/api/bom/relaciones` | `sector?: str`, `search?: str`, `limit: int = 300`, `offset: int = 0` | `{"items": List[SetComponenteOut], "total": int}` | Lista paginada de relaciones Set-Componente con JOIN a `material` para descripción. |
| `POST` | `/api/bom/relaciones` | `SetComponenteCreate` (JSON) | `SetComponenteOut` (201) | Registra una nueva relación en `dbo.set_componente`. |
| `PUT` | `/api/bom/relaciones/{id}` | `id: int`, `SetComponenteUpdate` (JSON) | `SetComponenteOut` | Modifica una relación existente en `dbo.set_componente`. |
| `PATCH` | `/api/bom/relaciones/{id}/toggle` | `id: int` | `{"id_set_componente": int, "activo": bool}` | Alterna el bit `activo` (1 <-> 0). |
| `POST` | `/api/bom/upload` | `file: UploadFile` (Multipart) | `BomImportResult` | Importa archivo de receta SAP CS11/CS12, regenera explosión y activa nueva versión. |

#### Módulo Orden de Suministro (`/api/suministro`)

| Método | Ruta | Parámetros / Body | Respuesta | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/suministro/resumen` | Ninguno | `SupplySummaryOut` | Consulta el último lote persistido en `dbo.produccion_planificada` o catálogo base. |
| `POST` | `/api/suministro/consolidar` | `files_f1: List[UploadFile]`, `files_f2: List[UploadFile]` | `SupplyConsolidateResult` | Procesa planillas F1 y F2, consolida consumos frente a BOM y persiste en SQL Server. |

#### Módulo Health (`/api/health`)

| Método | Ruta | Parámetros | Respuesta | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Ninguno | `{"status": "ok", "database": "ok"}` | Verifica conectividad contra la base de datos SQL Server. |

---

### 3.3. Servicios y Repositorios Clave

#### `BomRepository` (`app/repositories/bom_repository.py`)
- `get_versions() -> List[BomVersionOut]`: Consulta `dbo.bom_version` proyectando columnas exactas sin `SELECT *`.
- `get_set_componentes(sector, search, limit, offset) -> Tuple[List[SetComponenteOut], int]`: Realiza un `LEFT JOIN dbo.material m ON s.id_material_hijo = m.id_material` para resolver la descripción de cada pieza en una única consulta, evitando consultas $N+1$. Aplica paginación nativa SQL Server con `OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`.
- `create_set_componente(data: SetComponenteCreate) -> SetComponenteOut`: Inserta en `dbo.set_componente` dentro de una transacción explícita (`OUTPUT INSERTED.id_set_componente`).
- `update_set_componente(id, data)` / `toggle_set_componente(id)`: Modifica registros garantizando integridad con commit/rollback.

#### `SupplyRepository` (`app/repositories/supply_repository.py`)
- `get_consolidated_summary() -> SupplySummaryOut`: Obtiene el último lote procesado de `dbo.importacion_archivo` (`tipo = 'produccion_planificada'`, `estado = 'procesada'`). Agrupa las cantidades por producto y fecha desde `dbo.produccion_planificada` devolviendo la matriz diaria reconstruida.
- `save_planned_production(file_names, items, plan_year) -> int`:
  1. Identifica el usuario activo en `dbo.usuario` (o inicializa el registro base).
  2. Crea el encabezado en `dbo.importacion_archivo`.
  3. Inserta en `dbo.producto` los productos o sets ausentes para satisfacer las claves foráneas.
  4. Convierte las columnas de días a fechas calendario (`date`) e inserta en lote en `dbo.produccion_planificada` utilizando `cursor.fast_executemany = True`.

#### `BomParser` (`app/services/bom_parser.py`)
- `BomParser.parse(source: Union[str, BinaryIO]) -> BomParseResult`:
  - Detecta codificación del archivo de texto delimitado por tabulaciones (`utf-8`, `latin-1`, `cp1252`).
  - Interpreta la jerarquía SAP analizando el prefijo de puntos en la columna de material:
    - `.1` $\rightarrow$ Nivel 1 (raíz o componente directo).
    - `..2` $\rightarrow$ Nivel 2 (sub-componente).
    - `...3` $\rightarrow$ Nivel 3.
  - Rastrea la pila de padres activos (`active_parents[level]`) para reconstruir las tuplas jerárquicas `(id_producto_raiz, id_padre, id_hijo, cantidad, unidad, nivel, orden)`.

#### `BomService` (`app/services/bom_service.py`)
- `importar_bom(source, nombre_archivo) -> BomImportResult`:
  - Ejecuta `BomParser.parse`.
  - Registra nuevos materiales en `dbo.material` que no existieran previamente.
  - Inserta la versión en `dbo.bom_version` (en estado inactivo `es_vigente = 0`).
  - Inserta las relaciones en `dbo.bom_estructura` en lotes de 5.000 registros con `fast_executemany`.
  - Ejecuta el Stored Procedure `dbo.usp_generar_explosion_bom_version @id_version = ?` para poblar `dbo.bom_explosion_plana`.
  - Desmarca versiones anteriores y activa la nueva versión (`UPDATE dbo.bom_version SET es_vigente = 1 WHERE id_version = ?`).

#### `ProductionConsolidator` (`consolidate_production.py`)
- Motor matricial de consolidación que vincula tres fuentes de datos:
  - Formato 1 (Demanda Diaria): Columnas correspondientes a días (`1-sept`, `2-sept`, etc.) asociadas a piezas terminadas o sets.
  - Formato 2 (Proyecciones de Mediano Plazo): Columnas mensuales de proveedores (`oct`, `nov`, `dic`).
  - Recetas BOM: Carga de relaciones `set_componente` desde SQL Server o archivo auxiliar.
- Métodos matriciales:
  - `consolidate_demand()`: Matriz de productos demandados con suma horizontal de días firmes y meses tentativos.
  - `consolidate_bom()`: Proyección de demanda de cada padre multiplicada por el factor de uso unitario de cada hijo.
  - `calculate_consumption()`: Suma vertical acumulada de consumos por material hijo único terminal.
  - `export_excel(path)`: Genera libro `.xlsx` con 3 pestañas protegidas y formateadas (`Demanda`, `BOM`, `Consumo Materiales`).
  - `export_sap_txt(path)`: Genera archivo plano delimitado por tabulaciones para carga masiva SAP PIR (transacción MD61).

---

## 4. Frontend (React + TypeScript)

### 4.1. Estructura de Rutas (`routes.tsx`)

| Ruta | Componente | Función Operativa |
| :--- | :--- | :--- |
| `/login` | `Login` | Autenticación y acceso al sistema. |
| `/inicio` | `Home` | Panel de accesos directos y estado global de la operación. |
| `/suministro-bom` | `SupplyOrderBom` | Carga de órdenes de suministro, consolidación de demanda y ABM de recetas BOM. |
| `/rundown` | `RundownVivo` | Matriz viva de arrastre de stock, desvíos frente al conteo real y sugerencia de pedidos. |
| `/conteo` | `StockCount` | Formulario móvil para conteo físico diario en la línea de ensamble. |
| `/conteo-ciclico` | `CyclicCount` | Auditorías rotativas y muestreos periódicos en planta. |
| `/nuevo-pedido` | `NewOrder` | Creación de pedidos a depósito (manual o precargado desde sugerencia de conteo). |
| `/pedidos` | `Orders` | Listado y seguimiento de pedidos emitidos por Planta. |
| `/pedidos/:id` | `OrderDetail` | Consulta de detalle, trazabilidad y estado de una orden. |
| `/deposito` | `WarehouseOrders` | Bandeja de preparación de pedidos en el depósito CL2. |
| `/deposito/preparacion/:id` | `OrderPreparation` | Picking físico, confirmación de bultos, despacho y generación de QR. |
| `/confirmar-entrega/:id` | `DeliveryConfirm` | Validación por escaneo de QR bulto a bulto al descargar en planta. |
| `/remitos` | `Remitos` | Archivo centralizado de remitos internos emitidos. |
| `/remitos/:id` | `DeliveryNote` | Vista previa e impresión del remito interno formal. |
| `/materiales` | `Materials` | Catálogo de materiales e inventario en depósito CL2. |
| `/stock` | `Stock` | Gestión de stock, ajustes manuales auditados y balances teóricos vs reales. |
| `/trazabilidad` | `Audit` | Registro de eventos y auditoría de acciones de usuarios. |

---

### 4.2. Cliente de Integración API (`src/app/services/api.ts`)

Módulo con tipado TypeScript estricto que consume el backend en `http://127.0.0.1:8000`:
- `getBomVersions(): Promise<BomVersionItem[]>`: Obtiene listado de versiones de BOM.
- `getSetComponentes(params): Promise<{ items: SetComponenteItem[]; total: number }>`: Consulta relaciones filtradas por sector o búsqueda.
- `createSetComponente(data): Promise<SetComponenteItem>`: Crea relación directa de componentes.
- `updateSetComponente(id, data): Promise<SetComponenteItem>`: Modifica multiplicador o datos de una relación.
- `toggleSetComponente(id): Promise<{ id_set_componente: number; activo: boolean }>`: Conmuta estado activo/inactivo.
- `uploadBomFile(file: File)`: Sube planilla de receta para explosión y versión nueva.
- `getSupplySummary(): Promise<SupplySummaryApi>`: Recupera la demanda consolidada guardada en SQL Server.
- `consolidateSupply({ f1Files, f2Files })`: Envía múltiples archivos multipart bajo las claves `files_f1` y `files_f2` para procesamiento y persistencia automática en base de datos.

---

### 4.3. Módulo `SupplyOrderBom.tsx`

Vista modular organizada en dos pestañas (`Tabs`):

#### Pestaña 1: Orden de Suministro
- **Métricas Superiores:** Período de planificación activo, total de demanda consolidada en unidades, productos mapeados y estado de conexión a SQL Server.
- **Zona de Ingesta Multi-Archivo:**
  - Formato 1 (Demanda Diaria): Selector con soporte de selección múltiple (`multiple`), acumulación de archivos, previsualización de chips individuales con botón de eliminación (`X`) y limpieza total.
  - Formato 2 (Mediano Plazo / Proveedores): Selector idéntico para proyecciones mensuales de compra.
  - Botón *"Procesar y Consolidar en Servidor"*: Envía los archivos seleccionados vía multipart al backend, persiste los resultados en `dbo.importacion_archivo` y `dbo.produccion_planificada`, y actualiza la grilla.
- **Grilla de Demanda Consolidada:** Tabla con búsqueda instantánea por código de pieza o descripción, filtro de estado (`Validado con BOM` vs `Sin BOM`), desglose de cantidades diarias y botones de exportación a Excel consolidado y SAP PIR delimitado por tabulaciones.

#### Pestaña 2: BOM y Relaciones
- **Tarjetas de Estado:** Versión de receta actualmente vigente en SQL Server (`dbo.bom_version`), total de relaciones de componentes activas y fecha de última sincronización.
- **Carga de Nueva Versión:** Input de archivo de receta SAP CS11/CS12 y botón de importación directa a base de datos.
- **Historial de Versiones:** Tabla histórica con versionado inmutable, fechas de ingesta, total de líneas calculadas y badge de vigencia.
- **Explorador y ABM de Relaciones Set-Componente:**
  - Grilla interactiva con sector, SD, código TASA, padre SAP, código de material hijo, descripción real (resuelta vía JOIN), multiplicador de uso unitario y badge interactivo para activar/desactivar.
  - Botón *"Nueva Relación"* y botones de edición por fila: Abren un modal (`Dialog`) con validaciones de formulario para alta o edición directa en `dbo.set_componente`.

---

## 5. Algoritmos y Reglas de Negocio

### 5.1. Normalización de Part Numbers
Implementado en `consolidate_production.format_part_number`:
1. Eliminación de sufijos de planta productiva: `-SJ`, `-UJ`, `-MTA`.
2. Detección de máscaras:
   - Formato estándar 10 dígitos: `XXXXX-XXXXX` (ej. `71010-0K310`).
   - Formato estándar 12 dígitos: `XXXXX-XXXXX-XX` (ej. `71010-0K310-C0`).
3. Limpieza de caracteres diacríticos, símbolos de grado (`º`, `°`) y conversión a mayúsculas.

### 5.2. Consumo Teórico de Materiales
El consumo teórico de un insumo $M$ para una demanda de productos terminados $P$ se calcula como:
$$\text{Consumo Teórico}(M, \text{día}) = \sum_{P} \left( \text{Demanda}(P, \text{día}) \times \text{Factor BOM}(P, M) \right)$$

### 5.3. Arrastre de Stock Diario en Planta (Rundown)
El stock teórico al arranque de la jornada actual ($\text{hoy}$) se encadena a partir del balance de la jornada previa ($\text{ayer}$):
$$\text{Stock Teórico}(M, \text{hoy}) = \text{Stock Real Arranque}(M, \text{ayer}) - \text{Consumo Real}(M, \text{ayer}) + \text{Entregas Confirmadas}(M, \text{ayer})$$

Donde:
- $\text{Stock Real Arranque}(M, \text{ayer})$ proviene del conteo físico validado en planta.
- $\text{Consumo Real}(M, \text{ayer}) = \sum \text{Producción Real Declarada}(P, \text{ayer}) \times \text{Factor BOM}(P, M)$.
- $\text{Entregas Confirmadas}(M, \text{ayer})$ corresponde a los bultos con QR validados en planta procedentes de remitos internos.

### 5.4. Sugerencia Automática de Pedido
$$\text{Cantidad Sugerida}(M) = \max\left(0, \; (\text{Consumo Estimado Día Siguiente}(M) + \text{Stock Seguridad}(M)) - \text{Stock Físico Planta}(M)\right)$$

### 5.5. Regla de Despacho y Trazabilidad por Bulto
- Cada pedido confirmado en depósito genera un remito interno correlativo y un conjunto discreto de etiquetas QR:
  $$\text{Cantidad Etiquetas} = \sum \left\lceil \frac{\text{Cantidad Preparada}(M)}{\text{Capacidad Empaque / Pallet}(M)} \right\rceil$$
- Cada etiqueta posee un token criptográfico único.
- En la recepción en planta, cada escaneo valida la pertenencia al remito en tránsito, incrementa el conteo de recepción en $+1$ unidad de empaque y previene duplicados. El pedido únicamente pasa a estado `completo` cuando todas las etiquetas asociadas han sido escaneadas satisfactoriamente.
