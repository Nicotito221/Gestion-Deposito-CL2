# Sistema de Gestión de Pedidos, Stock y Rundown

## 1. Visión General y Arquitectura

El sistema digitaliza la comunicación y la operación logística entre la **Línea / Planta** y el **Depósito (CL2)**, automatizando el arrastre de stock diario, la explosión de recetas (BOM), la sugerencia y despacho de pedidos mediante validación física por códigos QR por bulto/pallet, y el registro de ingresos de proveedores.

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
|                        ZONA TERCERIZADA (DEPÓSITO / CL2)                          |
|  - Inventario de Stock en Depósito                                                |
|  - Bandeja de Pedidos a Preparar                                                  |
|  - Generación e Impresión de Etiquetas QR por Pallet/Bulto                        |
|  - Emisión de Remitos Internos de Despacho                                        |
|  - Recepción de Ingresos de Proveedores Externos                                  |
+-----------------------------------------------------------------------------------+
```

---

## 3. Ciclo Operativo Diario: Entradas (Inputs) y Salidas (Outputs)

### Etapa 1: Ingesta de Datos Maestros y Planificación
* **Inputs:**
  * **BOM SAP (CS11/CS12):** Archivo jerárquico (`.1` Producto / `..2` Componentes) con multiplicadores unitarios.
  * **Plan de Producción (Semanal/Mensual):** Matriz diaria de unidades a producir por set de asientos/producto terminado (`PROD`).
  * **Catálogo de Materiales Críticos:** Filtro de piezas controladas en depósito (espumas, estructuras, tapizados), ignorando tornillería/insumos menores C.
* **Outputs:**
  * Base de datos de recetas activas (`bom`) y demanda proyectada por producto (`produccion_planificada`).

---

### Etapa 2: Producción Real y Consumo Teórico
* **Inputs:**
  * Declaración de producción real acumulada al cierre de turno de la línea de ensamble.
* **Outputs:**
  * Cálculo instantáneo de consumo de materiales:
    $$\text{Consumo Teórico}(M, \text{ayer}) = \sum (\text{Producción Real}(P, \text{ayer}) \times \text{BOM}(P, M))$$

---

### Etapa 3: Conteo Físico en Planta
* **Inputs:**
  * Recorrido de planta con dispositivo móvil.
  * Carga de stock contado físico real de materiales (auditoría diaria o cíclica).
* **Outputs:**
  * Registro de auditoría de conteo (`conteo` y `material_conteo`).
  * Cálculo del desvío frente al stock teórico:
    $$\text{Desvío} = \text{Stock Contado} - \text{Stock Teórico}$$
  * Actualización del stock real de partida en el Rundown para los materiales productivos.

---

### Etapa 4: Rundown Vivo y Sugerencia de Pedido
* **Inputs:**
  * Stock real contado en planta.
  * Consumo estimado del día siguiente (obtenido de `Producción Planificada` $\times$ `BOM`).
  * Entregas recibidas en planta durante la jornada.
* **Outputs:**
  * Tabla consolidada del Rundown Vivo:
    * *Material | Stock Inicial | Conteo Real | Desvío | Consumo Estimado | Consumo Real | Prod. Día Siguiente | Cantidad Sugerida a Pedir*.
  * Sugerencia automática de pedido:
    $$\text{Cantidad Sugerida} = (\text{Consumo Estimado Día Sig.} + \text{Stock Seguridad}) - \text{Stock Real Planta}$$

---

### Etapa 5: Alta de Pedidos (Manual y Sugerido)
* **Inputs:**
  * **Flujo Sugerido:** Clic en "Crear Pedido" desde el Rundown (pantalla "Nuevo Pedido" precargada con cantidades editables).
  * **Flujo Manual:** Búsqueda en catálogo y carga manual de cantidades (para reposiciones puntuales o materiales fuera de rundown).
* **Outputs:**
  * Registro del pedido en estado `pendiente` en la bandeja del depósito (`pedido` y `material_pedido`).

---

### Etapa 6: Preparación, Etiquetado QR y Despacho en Depósito (CL2)
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

### Etapa 8: Ingresos de Proveedores Externos en Depósito (CL2)
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
| **Picking y Despacho** | Cantidades preparadas | Depósito CL2 | Etiquetas QR por pallet + Remito Interno + Descuento Stock | Camión / En Tránsito |
| **Recepción Planta** | Escaneo de QR por bulto | App Móvil Planta | Validación física 1 a 1 y cierre de pedido | Pedido `completo` |
| **Ingreso Proveedor** | Remito papel proveedor | Proveedor externo | Alta de stock en depósito y Kardex | `stock_deposito` / `movimiento_stock` |

