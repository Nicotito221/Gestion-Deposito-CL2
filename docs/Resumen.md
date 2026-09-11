## Inputs y Outputs

| Proceso | Input Principal | Origen | Output Principal | Destino |
| :--- | :--- | :--- | :--- | :--- |
| **Sincronización BOM** | Archivo CS11/CS12 o API | SAP | Relación Producto-Material-Cantidad | Base de datos (`bom`) |
| **Plan de Producción** | Planilla diaria por Set/Producto | SAP  | Demanda planificada diaria | Base de datos (`produccion_planificada`) |
| **Producción Real** | Declaración de fin de turno | Planta | Consumo real calculado ($\text{Prod} \times \text{BOM}$) | `rundown_diario` |
| **Conteo en Planta** | Stock físico contado | App Móvil Planta | Desvíos y stock de arranque | `material_conteo` / `rundown_diario` |
| **Rundown Vivo** | Conteo real + Plan día siguiente | Sistema | Cantidad sugerida a pedir | Pantalla Rundown / Nuevo Pedido |
| **Creación Pedido** | Aceptación sugerencia o manual | Solicitante | Pedido creado (`pendiente`) | Bandeja Depósito |
| **Picking y Despacho** | Cantidades preparadas | Depósito CL2 | Etiquetas QR por pallet + Remito Interno + Descuento Stock | Camión / En Tránsito |
| **Recepción Planta** | Escaneo de QR por bulto | App Móvil Planta | Validación física 1 a 1 y cierre de pedido | Pedido `completo` |
| **Ingreso Proveedor** | Remito papel proveedor | Proveedor externo | Alta de stock en depósito || `stock_deposito` / `movimiento_stock` |


