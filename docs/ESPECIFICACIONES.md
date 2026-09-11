# Sistema de Gestión de Pedidos, Stock y Rundown

## 1. Visión General y Arquitectura

El sistema digitaliza la comunicación y la operación logística entre la **Línea de Ensamble / Planta** y el **Depósito (Tercerizado / 3PL)**, automatizando el arrastre de stock diario, la explosión de recetas (BOM), la sugerencia y despacho de pedidos mediante validación física por códigos QR por bulto/pallet, y el registro de ingresos de proveedores.

---

## 2. Perímetros y Roles de Seguridad

El sistema mantiene un aislamiento estricto para proteger la información confidencial de la planta frente al operador logístico tercerizado:

```
+-----------------------------------------------------------------------------------+
|                            ZONA INTERNA (PLANTA / TI)                             |
|  - Conteo Físico en Planta (Móvil)                                                |
|  - Gestión de BOM (Recetas SAP) y Catálogo de Materiales Críticos                 |
|  - Planificación y Declaración de Producción Real                                 |
|  - Rundown Diario Vivo y Sugerencia Inteligente de Pedidos                        |
|  - Recepción y Validación por Escaneo QR                                          |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼  [API Segura / DMZ]
+-----------------------------------------------------------------------------------+
|                        ZONA TERCERIZADA (DEPÓSITO / 3PL)                          |
|  - Inventario de Stock en Depósito                                                |
|  - Bandeja de Pedidos a Preparar                                                  |
|  - Generación e Impresión de Etiquetas QR por Pallet/Bulto                        |
|  - Emisión de Remitos Internos de Despacho                                        |
|  - Recepción de Ingresos de Proveedores Externos                                  |
+-----------------------------------------------------------------------------------+
```

---

## 3. Ciclo Operativo Diario: Entradas (Inputs) y Salidas (Outputs)

### Etapa 1: Ingesta de Datos Maestros y Planificación Semanal por Línea
* **Inputs:**
  * **BOM SAP (CS11/CS12):** Archivo jerárquico (`.1` Producto / `..2` Componentes) con multiplicadores unitarios.
  * **Plan de Producción Semanal por Línea:** Matriz diaria de unidades a producir por set/producto terminado (`PROD`), versionada de forma granular por `(Línea, Semana_Plan)` (ej. `HL - 2026-W37`).
  * **Catálogo de Materiales Críticos:** Filtro de piezas controladas en depósito (espumas, estructuras, tapizados), ignorando tornillería/insumos menores C.
* **Outputs:**
  * Base de datos de recetas activas (`bom`) y demanda proyectada por producto y semana (`produccion_planificada`).

---

### Etapa 1.1: Matriz de Suministro Interactiva y Reglas de Corte (6:00 AM)
* **Grilla Visual / Web Spreadsheet (Solo Demanda y Consumo):**
  * La interfaz expone exclusivamente dos vistas principales:
    1. **Demanda:** Planificación de productos terminados / sets (padres) por día y mes.
    2. **Consumo:** Requerimientos netos de materiales y componentes (hijos) resultantes por día y mes.
  * **BOM como Motor Interno:** La estructura BOM no se muestra en la pantalla diaria; opera 100% por detrás en el backend para calcular automáticamente el consumo a partir de la demanda ($\text{Consumo} = \sum \text{Demanda} \times \text{BOM}$).
  * **Edición en Línea:** El usuario puede modificar cantidades directamente en celdas de días o períodos (en Demanda y/o Consumo) antes de emitir pedidos o exportables.
  * **Extensibilidad de Columnas (Días y Turnos):** Capacidad de agregar columnas de días adicionales o partición por turnos (T1, T2, etc. - a detallar posteriormente).
* **Corte Operativo Diario (06:00 AM):**
  * Tarea programada automática (*cron job / worker* diario a las 06:00 AM hora local).
  * **Regla de Puesta a Cero:** Toda cantidad cuya fecha sea anterior a la fecha actual ($\text{Fecha} < \text{Hoy}$) se congela y pasa automáticamente a **0** (ejemplo: a las 06:00 AM del día 8, los registros del día 7 hacia atrás pasan a 0).
  * **Propósito:** Evita arrastrar requerimientos vencidos de días pasados y delimita estrictamente la orden de suministro al horizonte presente y futuro.

---

### Etapa 2: Declaraciones Reales de SAP y Conciliación Diaria (06:00 AM)
* **Momento 0 (Apertura del Mes):**
  * El mes arranca con la **Orden de Suministro base consolidada** (Demanda proyectada del mes $\times$ BOM) calculando el consumo mensual y diario de arranque.
* **Evolución Semanal Dinámica:**
  * Durante el mes, las líneas (`HL`, `PAF`, etc.) reciben planes semanales actualizados que reemplazan la planificación de esa semana puntual sin alterar el resto del horizonte.
* **Conciliación Diaria de Producción Real (06:00 AM):**
  * **Ejemplo Operativo:** Si para ayer había planificado producir 400 unidades del Producto A:
    1. A las 06:00 AM (o al iniciar la jornada en la oficina), el sistema incorpora las **declaraciones reales de producción emitidas por la línea en SAP** hasta las 06:00 AM.
    2. La cantidad del día de ayer se actualiza al valor real efectivamente producido (ej. 380 unidades).
    3. **Cálculo del Consumo Real de Ayer:**
       $$\text{Consumo Real}(M, \text{ayer}) = \sum (\text{Producción Real Declarada}(P, \text{ayer}) \times \text{BOM}(P, M))$$
    4. **Encadenamiento del Stock Teórico de Arranque (Hoy):**
       $$\text{Stock Teórico}(M, \text{hoy}) = \text{Conteo Real}(M, \text{ayer}) - \text{Consumo Real}(M, \text{ayer}) + \text{Entregas Recibidas}(M, \text{ayer})$$

---

### Etapa 3: Conteo Físico en Planta (Validación del Contador Cíclico)
* **Objetivo:** Revalidar en la línea física si lo calculado por el sistema coincide con la realidad de planta.
* **Ejemplo Numérico Operativo:**
  * Se inicia la jornada con **500 piezas** de un material (hijo) en planta.
  * Plan original del día: Producir **400 unidades** del Producto A.
  * Producción real declarada en el día (SAP): **380 unidades** del Producto A (consumo teórico: $380 \times 1 = 380$ piezas).
  * **Stock Teórico resultante al cierre:** $500 - 380 = \mathbf{120\text{ piezas}}$.
  * **Acción del Contador Cíclico al inicio de la mañana:**
    * El contador recorre la línea con el dispositivo para verificar si efectivamente están esas **120 piezas**.
    * **Caso A (Coincidencia exacta):** Cuenta 120 $\rightarrow$ $\text{Desvío} = 0$.
    * **Caso B (Faltante / Scrap / Merma):** Cuenta 110 $\rightarrow$ $\text{Desvío} = -10$ (se detecta scrap o piezas dañadas no notificadas).
    * **Caso C (Sobrante / Desvío positivo):** Cuenta 125 $\rightarrow$ $\text{Desvío} = +5$ (ingreso no registrado o sobredeclaración).
* **Regla de Negocio:** El conteo físico real pasa a ser la **verdad absoluta del inventario de arranque** para el nuevo día ($\text{Stock Real de Arranque}$). La sugerencia de pedido para el depósito se calcula sobre esta verdad física, no sobre el teórico del papel.
* **Outputs:**
  * Registro de auditoría del conteo (`conteo` y `material_conteo`).
  * Cálculo instantáneo del desvío:
    $$\text{Desvío} = \text{Stock Contado} - \text{Stock Teórico}$$

---

### Etapa 4: Rundown Vivo Segmentado por Línea y Sugerencia de Pedido
* **Segmentación Operativa por Línea de Producción:**
  * Los Rundowns no son monolíticos; operan divididos por línea productiva (ejemplos: `HL`, `PAF`, `IMV`, `HIACE`, `TECHOS`, etc.).
  * Cada línea agrupa su propio conjunto de productos terminados (padres) y sus materiales asociados (hijos).
* **Gestión Independiente del Plan Semanal por Línea:**
  * Cada línea productiva tiene su propio plan de producción que varía semana a semana con ritmos independientes.
  * **Importación Granular:** Al importar un plan semanal, se especifica la línea y la semana (ej: `Línea HL - Semana 2026-W37`). El sistema actualiza o reemplaza únicamente la demanda de esa línea y semana puntual, sin afectar a las demás líneas ni borrar el histórico de semanas pasadas.
* **Control Visual y Alertas de Plan Desactualizado:**
  * La pantalla de cada Rundown muestra en cabecera un badge indicador:
    * *Ejemplo: "Plan Cargado: Semana 37 / 2026 | Última actualización: 08/09/2026"*.
  * **Alerta Preventiva:** Si la semana del plan cargado no coincide con la semana del calendario operativo, el sistema muestra una advertencia destacada en amarillo/rojo para evitar generar pedidos con planes de producción obsoletos.
* **Inputs:**
  * Stock real contado en planta (específico de la línea).
  * Consumo estimado del día siguiente (obtenido de `Producción Planificada` de la línea $\times$ `BOM`).
  * Entregas recibidas en planta durante la jornada.
* **Outputs:**
  * Tabla consolidada del Rundown Vivo por Línea:
    * *Material | Stock Inicial | Conteo Real | Desvío | Consumo Estimado | Consumo Real | Prod. Día Siguiente | Cantidad Sugerida a Pedir*.
  * Sugerencia automática de pedido por línea:
    $$\text{Cantidad Sugerida} = (\text{Consumo Estimado Día Sig.} + \text{Stock Seguridad}) - \text{Stock Real Planta}$$

---

### Etapa 5: Alta de Pedidos (Manual y Sugerido)
* **Inputs:**
  * **Flujo Sugerido:** Clic en "Crear Pedido" desde el Rundown (pantalla "Nuevo Pedido" precargada con cantidades editables).
  * **Flujo Manual:** Búsqueda en catálogo y carga manual de cantidades (para reposiciones puntuales o materiales fuera de rundown).
* **Outputs:**
  * Registro del pedido en estado `pendiente` en la bandeja del depósito (`pedido` y `material_pedido`).

---

### Etapa 6: Preparación, Etiquetado QR y Despacho en Depósito (3PL)
* **Inputs:**
  * Operario del depósito abre el pedido y confirma cantidades preparadas en el carro/camión.
  * Clic en **"Despachar"**.
* **Outputs:**
  * Generación de **1 etiqueta QR única por cada pallet/bulto físico** (ej. 4 pallets de espuma = 4 etiquetas QR independientes con token único).
  * Emisión automática del **Remito Interno de Salida** en PDF.
  * Descuento transaccional del inventario en `stock_deposito`.
  * Cambio de estado del pedido a `en_transito`.

---

### Etapa 7: Recepción y Validación QR en Planta
* **Inputs:**
  * Llegada del camión a planta.
  * Operario de planta escanea con la cámara del celular cada una de las etiquetas QR pegadas en los pallets.
* **Outputs:**
  * Validación en tiempo real (cada escaneo suma +1 pallet y valida que pertenezca al pedido).
  * Alerta preventiva si se intenta escanear un QR duplicado o ajeno.
  * Cierre del pedido a estado `completo` (o `parcial` con discrepancia registrada si faltaron bultos).
  * Registro de la entrega para el arrastre del Rundown.

---

### Etapa 8: Ingresos de Proveedores Externos en Depósito (3PL)
* **Inputs:**
  * Llegada de camión de proveedor externo al depósito.
  * Carga del número de remito/factura del proveedor y cantidades recibidas por material.
* **Outputs:**
  * Registro de ingreso (`ingreso_material` e `ingreso_material_detalle`).
  * Incremento automático en `stock_deposito`.
  * Generación del movimiento en el kardex auditado (`movimiento_stock`).

---

## 4. Matriz Resumen de Inputs y Outputs

| Proceso | Input Principal | Origen | Output Principal | Destino |
| :--- | :--- | :--- | :--- | :--- |
| **Sincronización BOM** | Archivo CS11/CS12 o API | SAP | Relación Producto-Material-Cantidad | Base de datos (`bom`) |
| **Plan de Producción** | Planilla diaria por Set/Producto | SAP / PCP | Demanda planificada diaria | Base de datos (`produccion_planificada`) |
| **Producción Real** | Declaración de fin de turno | Planta | Consumo real calculado ($\text{Prod} \times \text{BOM}$) | `rundown_diario` |
| **Conteo en Planta** | Stock físico contado | App Móvil Planta | Desvíos y stock de arranque | `material_conteo` / `rundown_diario` |
| **Rundown Vivo** | Conteo real + Plan día siguiente | Sistema | Cantidad sugerida a pedir | Pantalla Rundown / Nuevo Pedido |
| **Creación Pedido** | Aceptación sugerencia o manual | Solicitante | Pedido creado (`pendiente`) | Bandeja Depósito |
| **Picking y Despacho** | Cantidades preparadas | Depósito 3PL | Etiquetas QR por pallet + Remito Interno + Descuento Stock | Camión / En Tránsito |
| **Recepción Planta** | Escaneo de QR por bulto | App Móvil Planta | Validación física 1 a 1 y cierre de pedido | Pedido `completo` |
| **Ingreso Proveedor** | Remito papel proveedor | Proveedor externo | Alta de stock en depósito y Kardex | `stock_deposito` / `movimiento_stock` |

---

## 5. Módulo de Consolidación y Exportación a SAP (PIR / MD61)

* **Ingesta Multi-archivo:**
  * Archivos Formato 1 (Demanda diaria por día/mes).
  * Archivos Formato 2 (Demanda agregada por meses tentativos de proveedores/MTA/TT).
  * Recetas BOM (`Interfaz.xlsm`).
  * Catálogo maestro de partes (`PRD - Septiembre...csv`).
* **Normalización de Part Numbers:**
  * Formato 10 dígitos: `XXXXX-XXXXX` (ej. `71020-0KN90`).
  * Formato 12 dígitos: `XXXXX-XXXXX-XX` (ej. `79100-YP390-C0`).
  * Eliminación de sufijos de planta en códigos (`-SJ`, `-UJ`, `-MTA`).
* **Reglas de Exportación SAP PIR:**
  * Delimitador: Tabulaciones (`\t`), terminación `\r\n`.
  * Columnas: `Radio button Material` (`X`), `Material`, `Centro` (`1000`), `Versión de plan` (`00`), `fecha` (`DD.MM.YYYY`), `Tipo formato fecha` (estrictamente `D`), `Cantidad`.
  * Exclusión de totales del mes firme para evitar doble imputación.
  * **Asignación de Fechas para Meses Tentativos:** Selección editable de 5 fechas calendario específicas para los 5 meses no firmes posteriores al mes de producción activo.

---

## 6. Arquitectura de Datos y Tablas en SQL Server (`GestionDeposito`)

El sistema opera sobre 18 tablas relacionales normalizadas en SQL Server:
1. **Usuarios y Auditoría:** `usuario`, `auditoria`.
2. **Catálogos y Materiales:** `proveedor`, `material`, `proveedor_material`.
   * *Campos de empaque y logística:* `tipo_caja`, `cant_x_caja`, `dock_routing`, `n_interno`, `destino`, `lote_minimo`, `stock_seguridad`.
3. **Estructura de Recetas (BOM):** `producto`, `bom` (desacoplada temporalmente de formato SAP, administrada por motor de cálculo).
4. **Inventario y Doble Stock:**
   * `stock_deposito`: Stock buffer físico del operador logístico tercerizado (3PL).
   * `stock_planta`: Stock en línea de ensamble para consumo de producción.
   * `movimiento_stock`: Kardex inmutable (*append-only*) con registro de `stock_anterior`, `stock_posterior`, `ubicacion` (`deposito` / `planta`) y trazabilidad por pedido/remito/ingreso/conteo.
5. **Planificación:** `produccion_planificada` (indexada por semana y fecha), `produccion_real`.
6. **Pedidos y Trazabilidad QR:**
   * `pedido`, `material_pedido`.
   * `etiqueta_qr`: 1 token QR único por cada pallet/bulto físico para validación unitaria en descarga de camión.
7. **Conteo en Planta y Rundown Vivo:** `conteo`, `material_conteo`, `rundown_diario`.
8. **Documentación e Ingresos:** `remito`, `material_remito`, `ingreso_material`, `ingreso_material_detalle`.
9. **Control de ETL:** `importacion_archivo`, `importacion_error`.

---

## 7. Matriz de Roles y Perímetros

| Rol | Vistas y Capacidades Clave |
| :--- | :--- |
| **Solicitante (Planta)** | Conteo físico móvil, visualización del Rundown Vivo, alta de pedidos (sugerido/manual), recepción y escaneo QR de pallets. |
| **Operario Depósito (3PL)** | Bandeja de pedidos pendientes, preparación de bultos, impresión de etiquetas QR y remito interno, recepción de ingresos de proveedores. No accede a planes ni datos confidenciales de planta. |
| **Supervisor** | Autorización de pedidos urgentes, aprobación de justificaciones de desvíos grandes de stock, ajustes manuales de inventario auditados. |
| **Administrador** | Gestión de usuarios y roles, ejecución de importaciones masivas y configuración del sistema. |

