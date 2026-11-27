# Revisión de código — FLOW Gestión de Depósito (rama `fix/revision`)

Fecha: 2026-11-20 · Alcance: código fuente (backend Python, frontend React) y estructuras SQL (SQL Server y Supabase). Solo lectura: no se modificó código ni se consultó ninguna base.
Esta es la segunda pasada. Reemplaza el informe del 2026-11-19 y ya considera los cuatro commits de corrección de la rama.

## Resumen ejecutivo

- **Lo que se corrigió y quedó bien:**
  - Autenticación obligatoria en todos los routers, roles coherentes y errores internos ocultos.
  - `SECRET_KEY` aleatoria, descuento atómico de stock, detección de ciclos en BOM y outbox de CL2 con reintentos.
  - Guards de carrera y debounce en el frontend.
  - No se encontró inyección SQL.
- **Dos bugs introducidos en la pasada anterior, que hay que corregir antes de desplegar:**
  - La tarea que libera preparaciones vencidas inserta en `auditoria` con `id_usuario` NULL. La columna es `NOT NULL`, así que falla siempre y nunca libera nada (B-01).
  - La migración `20` no puede cambiar `bom_extension.cantidad` por un `CHECK`, pero igual se registra como aplicada. Además, su índice único de tránsitos rompe la recepción de facturas (D-01, D-02).
- **Riesgos altos que siguen abiertos:**
  - Colisión de ids de remito entre planta y CL2: se pierden remitos y su movimiento de stock (B-03).
  - El token sigue valiendo hasta 12 h aunque se desactive al usuario (B-02).
  - Doble suma de stock al confirmar una recepción en simultáneo (B-04).
  - El pull de CL2 sin paginación se va a cortar en silencio a las 1000 filas (B-05).
- **Frontend:** varias pantallas muestran acciones que el backend ahora rechaza con 403 (F-01, F-02). En Vercel, cancelar pedidos no funciona (F-03).
- **Esquema:** sigue sin poder reproducirse desde los scripts. `init_db.py` solo ejecuta `00`, el largo de `id_material` es inconsistente y hay DDL en tiempo de ejecución (D-03, D-04, D-08).

Cantidad de hallazgos: Backend 37 · Frontend 19 · Base de datos 24 (sin duplicados).

---

## Backend (Python / FastAPI)

### Alta

**B-01 · Bug (regresión) · `backend/app/services/dashboard_service.py:41-44`**
- **Descripción:** `liberar_preparaciones_vencidas` inserta en `auditoria` con `id_usuario = NULL`, pero la columna es `INT NOT NULL` (`backend/database/00_init_database.sql:583`). El insert falla y el `except` hace rollback también del `UPDATE` de pedidos. La tarea de `main.py` reintenta cada 15 min y falla siempre.
- **Por qué importa:** los pedidos `en_preparacion` vencidos nunca vuelven a `pendiente`. La regla quedó apagada desde que se sacó del GET del dashboard, salvo por el `UPDATE` que sigue en el GET de pedidos (ver B-13).
- **Sugerencia:** usar el usuario técnico (por ejemplo el de `admin`, o un usuario `sistema` sembrado) como en `cl2_sync_service`, o permitir NULL en `auditoria.id_usuario`.

**B-02 · Seguridad · `backend/app/core/auth_deps.py:15-21`, `backend/app/core/security.py:47`, `backend/app/services/usuario_service.py` (payload del token)**
- **Descripción:** `require_user` valida solo la firma y la expiración. El rol viaja en el token y no se revalida `activo`, `eliminado` ni `rol` contra la base. `/api/auth/me` (`routers/auth.py`) tampoco filtra `activo`.
- **Por qué importa:** un usuario desactivado o degradado mantiene el acceso con el rol viejo hasta 12 h.
- **Sugerencia:** verificar `activo = 1 AND eliminado = 0` y el rol actual en `require_user`, con una caché corta (por ejemplo 60 s). Otra opción es incluir un `token_version` en el payload.

**B-03 · Bug de datos · `backend/app/repositories/pedido_repository.py:819`, `backend/app/services/cl2_sync_service.py:466-472`, `backend/database/supabase/20_confirmar_preparacion_cl2.sql:47-48`**
- **Descripción:** planta y CL2 generan el id `RI-{pedido}-{COUNT(*)+1}` contando cada uno sus propios remitos. Un pedido despachado en parte en cada nodo genera el mismo id.
- **Por qué importa:** el pull ve el remito "ya existente" y lo saltea, y se pierden sus líneas en `material_remito` y la transferencia de stock CL2→Planta. El push con `merge-duplicates` pisa el remito remoto. En Supabase, `LPAD(v_seq, 2)` además trunca a partir del remito 100.
- **Sugerencia:** separar los espacios de ids (por ejemplo `RP-` en planta y `RC-` en CL2) y no truncar la secuencia.

**B-04 · Concurrencia · `backend/app/repositories/ingreso_repository.py:288` (`confirmar_recepcion`), `backend/app/services/cl2_sync_service.py` (`_aplicar_recepciones_ingresos`)**
- **Descripción:** se leen `ingreso_material` y `ingreso_material_detalle` (`recibida_ant`) sin `UPDLOCK`. El pull verifica `pendiente` en otra conexión antes de confirmar.
- **Por qué importa:** si depósito y el worker de CL2 confirman a la vez, los dos calculan el mismo delta y el stock se suma dos veces.
- **Sugerencia:** empezar `confirmar_recepcion` con `SELECT … FROM dbo.ingreso_material WITH (UPDLOCK, HOLDLOCK) WHERE id_ingreso = ?` y bloquear igual el detalle.

**B-05 · Sincronización CL2 · `backend/app/services/cl2_sync_service.py:504-507`**
- **Descripción:** los `_get` de `pedidos_cl2` y `remitos_cl2` traen todo el histórico, sin `order`, `limit` ni marca de agua. PostgREST corta en `max-rows` (1000 por defecto).
- **Por qué importa:** cuando el histórico pase ese límite, los registros nuevos pueden quedar afuera sin error. Además, cada ciclo reprocesa todo, con un `SELECT 1 FROM remito` por remito (N+1).
- **Sugerencia:** filtrar por una marca de actualización con `order=…asc` y paginar, guardando la marca en SQL Server.

### Media

**B-06 · Bug · `backend/app/repositories/ingreso_repository.py:410-422, 525, 562, 582-612`**
- **Descripción:** al confirmar un ingreso de un proveedor con depósito en planta se suma `stock_deposito.stock_planta`, pero al borrarlo solo se revierte `rundown_stock_ajuste`. Además, `fecha_recepcion` se guarda como `now_dt` mientras el ajuste usa `data.fecha_recepcion`, así que el borrado no lo encuentra si las fechas difieren.
- **Por qué importa:** el stock queda inflado después de borrar el comprobante.
- **Sugerencia:** guardar la misma fecha en los dos lugares y restar también `stock_planta` al borrar, registrando el movimiento.

**B-07 · Bug · `backend/app/repositories/ingreso_repository.py:347, 366`**
- **Descripción:** si un ítem no viene en la request, se lo da por recibido por la cantidad facturada completa. El pull de CL2 puede mandar solo algunos materiales. Un delta negativo (corrección a la baja) actualiza el detalle pero no descuenta stock.
- **Por qué importa:** el stock no coincide con lo recibido.
- **Sugerencia:** si falta el ítem, conservar `recibida_ant`, y tratar `cant_delta < 0` de forma simétrica.

**B-08 · Transacción · `backend/app/repositories/ingreso_repository.py:262-278`**
- **Descripción:** `create_ingreso` hace commit del ingreso y después confirma la recepción en otra conexión.
- **Por qué importa:** si la confirmación falla, la factura queda creada y el reintento falla con "número de factura ya existe".
- **Sugerencia:** confirmar dentro de la misma transacción.

**B-09 · Bug · `backend/app/repositories/pedido_repository.py:800-803` (y la misma lógica en `supabase/20_confirmar_preparacion_cl2.sql:70-74`)**
- **Descripción:** el delta de preparación mezcla dos semánticas. Con 100 pedidos y 40 entregados, si se cargan 50 el delta es 50, pero si se cargan 70 el delta es 30 (`c_input - c_prev`).
- **Por qué importa:** se despacha menos de lo indicado según el número que se cargue.
- **Sugerencia:** definir una sola semántica (por ejemplo acumulada: `delta = clamp(c_input - c_prev, 0, c_pend)`) en el backend, en la función de Supabase y en el frontend (F-05).

**B-10 · Concurrencia · `backend/app/repositories/pedido_repository.py:711, 903`**
- **Descripción:** el estado del pedido se lee sin `UPDLOCK` en `actualizar_preparacion_pedido` y en `cancelar_pedido`.
- **Por qué importa:** una confirmación que empezó antes de una cancelación igual emite el remito, descuenta stock y vuelve el pedido a `completo`/`parcial`.
- **Sugerencia:** `SELECT … FROM dbo.pedido WITH (UPDLOCK, HOLDLOCK) WHERE id_pedido = ?` en los dos.

**B-11 · Seguridad · `backend/app/routers/usuarios.py:56`, `backend/app/schemas/usuario.py:48`**
- **Descripción:** un usuario cambia su propia contraseña sin informar la actual, y el cambio no invalida los tokens vigentes.
- **Por qué importa:** con un token robado se toma la cuenta de forma permanente.
- **Sugerencia:** exigir `password_actual` cuando no es admin y verificarla con `verify_password`.

**B-12 · Zona horaria · varios repositorios**
- **Dónde:**
  - `movimiento_stock.fecha` recibe `GETDATE()` (`pedido_repository.py`, `ingreso_repository.py:427,452`) y `SYSUTCDATETIME()` (`stock_repository.py:323`, `rundown_repository.py:600,660`).
  - `produccion_planificada.fecha_carga` es UTC en `rundown_repository.py` y `SYSDATETIME()` en `supply_repository.py`.
  - Los campos de usuario (`usuario_repository.py`) se graban en UTC.
- **Por qué importa:** los ajustes quedan 3 h corridos y cerca de medianoche caen en otro día.
- **Sugerencia:** pasar siempre `get_argentina_now_naive()` como parámetro.

**B-13 · API · `backend/app/repositories/pedido_repository.py:290-299`**
- **Descripción:** el listado de pedidos (GET) sigue ejecutando `UPDATE pedido SET estado='pendiente'` con commit y sin auditoría. Duplica la regla de B-01.
- **Por qué importa:** un GET con efectos secundarios y cambios de estado sin trazabilidad.
- **Sugerencia:** quitar el UPDATE una vez corregido B-01.

**B-14 · Rendimiento · `backend/app/routers/ingreso.py:30`, `backend/app/routers/rundown.py:294-301`, `backend/app/routers/bom.py` (uploads), `backend/app/routers/supply.py` (consolidar)**
- **Descripción:** hay endpoints `async` que hacen trabajo bloqueante (pdfplumber, openpyxl, pyodbc), y casi todos los uploads leen o copian el archivo sin límite de tamaño. Solo el PDF de ingresos tiene `MAX_PDF_BYTES`.
- **Por qué importa:** mientras se procesa un archivo se bloquea el event loop y no responde el resto de la API. Un archivo grande agota la memoria.
- **Sugerencia:** declararlos con `def` (FastAPI los corre en un pool de hilos) o usar `run_in_threadpool`, y aplicar un tope de tamaño.

**B-15 · Transacción · `backend/app/services/pedido_service.py:465-470`, `backend/app/routers/pedidos.py` (`/multiples`)**
- **Descripción:** cada pedido del lote se crea con su propio commit, y la lista no tiene tope.
- **Por qué importa:** si falla uno, los anteriores quedan creados y el cliente recibe un error.
- **Sugerencia:** una sola transacción para el lote y `max_length` en la lista.

**B-16 · Seguridad · `backend/app/services/usuario_service.py:13-37`**
- **Descripción:** el límite de intentos de login es solo por username, sin IP, y el diccionario en memoria no se purga.
- **Por qué importa:** cualquiera puede bloquear al `admin` 15 minutos con 5 intentos, y probar usernames al azar hace crecer la memoria. Con varios workers, el límite queda por proceso.
- **Sugerencia:** clave `(ip, username)`, más un límite global por IP y una purga periódica.

**B-17 · Bug · `backend/app/services/cl2_sync_service.py:469-474`, `backend/app/repositories/rundown_repository.py:450, 463, 480`**
- **Descripción:** el remito importado desde CL2 se inserta con `GETDATE()` (la hora del pull) en vez de la fecha remota. Los estados `completo`/`entregado` se mapean a `entregado`, pero el rundown solo cuenta remitos `estado = 'emitido'`.
- **Por qué importa:** son entregas que movieron stock pero no aparecen en el rundown, o aparecen en otro día.
- **Sugerencia:** usar `rem["fecha_emision"]`/`rem["fecha_entrega"]` y contar `estado IN ('emitido','entregado')`.

**B-18 · Concurrencia · `backend/app/repositories/stock_repository.py:269`, `backend/app/services/stock_service.py:167`**
- **Descripción:** el ajuste manual lee el stock "anterior" en otra conexión, sin lock, y después graba un valor absoluto.
- **Por qué importa:** un remito confirmado en el medio deja `stock_anterior` desfasado en `movimiento_stock`.
- **Sugerencia:** leer con `UPDLOCK` dentro del mismo cursor.

**B-19 · Bug · `backend/app/services/dashboard_service.py:69`**
- **Descripción:** el KPI `completados_hoy` filtra por `fecha_creacion` en lugar de `fecha_entrega`.
- **Por qué importa:** cuenta los pedidos creados hoy que ya están completos, no los que se completaron hoy.
- **Sugerencia:** `CAST(fecha_entrega AS DATE) = ?`.

### Baja

- **B-20 · Fuga de error:** `backend/app/services/supply_service.py:133-134` concatena el texto de la excepción en el mensaje de respuesta.
- **B-21 · Datos sensibles:** `backend/app/services/invoice_parser_service.py:17-18, 130-148` guarda JSON con texto de facturas en `backend/debug_invoices`, sin rotación y con `datetime.now()`.
- **B-22 · Enumeración:** `backend/app/services/usuario_service.py:48-58` responde "deshabilitada" después de validar la contraseña, lo que confirma que la contraseña es correcta, y ese caso no cuenta como fallo.
- **B-23 · Exposición:**
  - `run.py:11` usa `0.0.0.0` con `reload=True`.
  - `backend/app/main.py:64-74` deja el regex de localhost con credenciales activo también en producción.
- **B-24 · Errores tragados o código muerto:**
  - `pedido_service.py:674-679`: un segundo `except ValueError` que nunca se ejecuta.
  - `usuario_repository.py:194-195`: `update_ultimo_acceso` traga la excepción sin loguear.
  - `consolidate_production.py:826-827`: si falla la conexión devuelve `{}` en silencio.
  - `main.py:117-125`: el health check no cierra la conexión si falla el `execute`.
  - `main.py:48-49`: las tareas se cancelan sin `await` y el executor de CL2 nunca se cierra.
- **B-25 · Detección frágil y validación de duplicados:**
  - `backend/app/routers/rundown.py:70` detecta duplicados buscando "2627" en el texto del error.
  - `backend/app/repositories/ingreso_repository.py:210-217` valida la unicidad de la factura con un SELECT previo (ver D-12).
- **B-26 · Autoría:** se usan ids de usuario de respaldo fijos o "el primer activo" en `pedido_repository.py:731` (3), `stock_repository.py:284` (2), `ingreso_repository.py:227,611,628` (1) y `cl2_sync_service.py:515`.
- **B-27 · DDL en GET:** `backend/app/repositories/stock_repository.py:826-858` ejecuta `CREATE TABLE IF NOT EXISTS` y commit en cada GET de cajas (ver D-08).
- **B-28 · N+1:** `backend/app/repositories/pedido_repository.py:1024` consulta `INFORMATION_SCHEMA` por cada ítem de remito.
- **B-29 · Validación de schemas:**
  - `backend/app/schemas/pedido.py:206`: `accion` es texto libre; una acción inválida hace commit y responde 200. Conviene `Literal[...]`.
  - `pedido.py:92-94`: `sector`, `prioridad` y `origen` sin validar, así que un CHECK de la base termina en 500 en lugar de 422.
- **B-30 · Parámetros de ruta:**
  - `backend/app/routers/rundown.py:277`: `tipo_stock` sin `pattern`.
  - `rundown.py:129-135`: el `id_proveedor` del path se ignora al borrar.
- **B-31 · Códigos HTTP:** "no encontrado" devuelve 400 en vez de 404 (`ingreso_repository.py:306`, `stock_repository.py:271`, vía `ValueError`).
- **B-32 · Duplicación:**
  - `backend/app/routers/auth.py:10-23` duplica `require_user`.
  - `backend/app/routers/despacho.py` repite `require_user`, que ya aplica el router.
- **B-33 · Capas:** `routers/despacho.py` y `routers/bom.py` llaman directo al repositorio.
- **B-34 · Comentarios:** `backend/app/services/dashboard_service.py:82` tiene comentarios enumerativos (`# 2. Remitos de hoy`), contra la regla 2 de CLAUDE.md.
- **B-35 · Dependencias:** `backend/requirements.txt` usa solo `>=`, sin versiones fijas.
- **B-36 · Scripts:**
  - `backend/verificar_integridad_bom.py:3` importa `pyodbc` sin usarlo.
  - `backend/import_bom.py:10` y `verificar_integridad_bom.py:11` tienen rutas personales fijas.
- **B-37 · Rendimiento:** el fill rate de `dashboard_service.py` suma toda la tabla `material_pedido` histórica.

---

## Frontend (React / Vite)

### Alta

**F-01 · Permisos · `frontend/src/app/pages/SupplyOrderBom.tsx:124` (`canEdit`) y botones en 772, 1045, 1431, 1457, 1572, 1579, 1774, 1793, 1801**
- **Descripción:** `canEdit` solo se usa para editar celdas. "Importar conversiones", "Procesar y Consolidar", "Importar BOM", "Importar SD y SETs", "Importar Excel/CSV" y alta, edición o baja de relaciones se muestran a `operario_planta` y `supervisor`.
- **Por qué importa:** el backend exige `require_editor_planificacion` para todo eso (`supply.py`, `bom.py`), así que esos roles reciben un 403, incluso después de subir un archivo pesado.
- **Sugerencia:** envolver esos controles con `canEdit`.

**F-02 · Permisos · `frontend/src/app/pages/Stock.tsx:600-609`**
- **Descripción:** el botón "Ajustar" se muestra sin chequear rol, y `/stock` admite `operario_planta` y `supervisor`.
- **Por qué importa:** `PUT /api/stock/deposito/{id}` exige roles de planificación, así que esos usuarios reciben 403 después de completar el modal.
- **Sugerencia:** usar `hasRole(...)` con los mismos roles que el backend, como en `Materials.tsx:417`.

**F-03 · Bug Vercel · `frontend/src/app/services/api.ts:2299-2312` (`cancelarPedido`), `frontend/src/app/pages/OrderDetail.tsx:58, 136-139`**
- **Descripción:** `cancelarPedido` no tiene rama Supabase y siempre llama a `API_BASE_URL`. En cambio, `OrderDetail` muestra "Cancelar" a los roles de depósito, que son justo los usuarios CL2 de Vercel.
- **Por qué importa:** en Vercel la cancelación falla siempre.
- **Sugerencia:** implementarla vía Supabase (RPC) u ocultar el botón cuando `IS_SUPABASE_ACTIVE`.

**F-04 · Concurrencia · `frontend/src/app/services/api.ts:2228-2268` (respaldo cuando la RPC devuelve 404)**
- **Descripción:** el respaldo sigue armando el id de remito en el cliente (`remitos.length + 1`) y lo inserta con `Prefer: resolution=merge-duplicates`. Son N PATCH sin transacción; `exigirOk` corta el flujo, pero no revierte lo ya escrito.
- **Por qué importa:** dos confirmaciones simultáneas pisan el remito anterior sin error. Además, una función que existe pero devuelve "not found" también da 404 y cae en este camino.
- **Sugerencia:** quitar `merge-duplicates` del respaldo, o eliminar el respaldo una vez desplegada la RPC.

### Media

**F-05 · Bug · `frontend/src/app/pages/OrderPreparation.tsx:118, 127`, `frontend/src/app/services/api.ts:2076-2091`**
- **Descripción:** el borrador restaura las unidades, pero deja pallets y bultos preparados en 0, y "Guardar avance" vuelve a mandar 0 pallets. En Supabase, `guardar_avance` guarda el delta crudo, mientras que la restauración asume el valor acumulado que guarda el backend SQL.
- **Por qué importa:** en Vercel, los pedidos con entregas previas restauran un borrador reducido o en 0, y los pallets preparados se pierden.
- **Sugerencia:** derivar los pallets de `quantityPrepared / lotSize`, y en Supabase guardar `cantEnt + delta` (ver B-09).

**F-06 · Bug Supabase · `frontend/src/app/services/api.ts:2076-2091`**
- **Descripción:** `guardar_avance` en Supabase manda `comentario: it.comentario || null`, y la UI nunca envía comentario por ítem.
- **Por qué importa:** se borran los comentarios del detalle, y las observaciones del pedido (`data.comentario`) no se guardan.
- **Sugerencia:** omitir `comentario` cuando sea `undefined` y agregar `data.comentario` al PATCH de `pedidos_cl2`.

**F-07 · Permisos · `frontend/src/app/pages/StockCount.tsx:2288-2300`**
- **Descripción:** el botón de editar lote llama a `PUT /api/rundown/materiales/lote`, que exige `ROLES_PLANTA` (sin `contador_ciclico`), pero se muestra a todos los roles de `/conteo`.
- **Por qué importa:** el contador cíclico recibe 403.
- **Sugerencia:** ocultarlo para `contador_ciclico`.

**F-08 · Sesión Supabase · `frontend/src/app/services/api.ts:2622-2686, 2747-2748`**
- **Descripción:** en Vercel se guarda el `access_token` de Supabase (1 h) sin `refresh_token`, y las llamadas a Supabase no pasan por `apiFetch`, así que un 401 no cierra la sesión. Si falta la fila en `usuarios_perfil`, el cliente asigna `operario_deposito`/`CL2` por defecto.
- **Por qué importa:** los operarios ven errores genéricos al vencer la sesión, y una cuenta sin perfil obtiene la UI de depósito (ver D-13).
- **Sugerencia:** refrescar el token, pasar las llamadas a Supabase por un wrapper que maneje el 401 y rechazar el login cuando falta el perfil.

**F-09 · Seguridad · `frontend/src/app/context/AuthContext.tsx:22-31, 66-72`, `frontend/src/app/services/api.ts:15-21`**
- **Descripción:** los tokens (del backend y de Supabase) se guardan en `localStorage`. No hay `dangerouslySetInnerHTML`, así que el riesgo actual es bajo.
- **Por qué importa:** cualquier XSS, incluida una dependencia comprometida, los puede robar.
- **Sugerencia:** cookie `HttpOnly` si el despliegue lo permite.

### Baja

- **F-10 · Código muerto:** `pages/DeliveryConfirm.tsx`, `ExecutiveDashboard.tsx`, `Suppliers.tsx` (datos mock de "06/2026") y `FutureFeatures.tsx` no se importan desde ningún lado.
- **F-11 · Fecha de respaldo fija:** `pages/SupplyOrderBom.tsx:283-286` usa `MESES[...] || 10`, así que un mes no reconocido cae en octubre fijo. `resolveDefaultSecondWednesdayIso` (109-118) usa diciembre por defecto y matchea claves cortas dentro de otras palabras.
- **F-12 · Grupos de roles duplicados:**
  - `AuthContext.tsx:96-97` (`canModifyStockCL2`, `canModifyPedidoDeposito`) y `OrderDetail.tsx:135` no coinciden con `auth_deps.py`: ocultan acciones que el backend permite, como el ajuste para `analista`.
  - Los grupos también están repetidos en `DespachosTerceros.tsx:56-58`, `SupplyOrderBom.tsx:124-127` y `MaterialConfig.tsx:162`.
  - **Sugerencia:** centralizarlos en `permisos.ts`.
- **F-13 · Título engañoso:** `pages/Orders.tsx:50, 67` dice "Mis pedidos" pero muestra los de todos.
- **F-14 · Toast de una respuesta vieja:** `pages/Remitos.tsx:220-222`, el `catch` de `fetchIngresosList` no chequea `requestId`.
- **F-15 · Pedido duplicado:** `pages/SupplyOrderBom.tsx:221-226, 246` pide `/api/bom/estructura-activa` dos veces al montar (efecto con debounce más `fetchData`).
- **F-16 · Requests en serie:** `services/api.ts:2075-2092`, `guardar_avance` en Supabase hace un PATCH por material, más dos lecturas del pedido.
- **F-17 · Nombre fijo:** `pages/Home.tsx:93` usa `user?.nombre || "Nicolás"`.
- **F-18 · URL de respaldo:** `services/api.ts:1-5` cae a `127.0.0.1` si falta `VITE_API_URL`.
- **F-19 · Tamaño y placeholders:**
  - Archivos muy grandes: `RundownVivo.tsx` (~4540 líneas), `StockCount.tsx` (~2525), `SupplyOrderBom.tsx` (~2070) y `api.ts` (~3500, mezcla backend y Supabase).
  - `DeliveryNote.tsx` y `DeliveryNoteModal.tsx` duplican la carga de remito y pedido.
  - `CyclicCount.tsx` es un placeholder que aparece en el menú.

---

## Base de datos (SQL Server / Supabase)

### Alta

**D-01 · Migración (regresión) · `backend/database/20_revision_integridad_indices.sql:46-47, 126-128`, `backend/database/11_bom_extension.sql:26`**
- **Descripción:** `bom_extension.cantidad` tiene un `CHECK (cantidad > 0)` sin nombre, y SQL Server no permite `ALTER COLUMN` de precisión sobre una columna con CHECK. El error corta solo esa sentencia, el batch sigue y al final se inserta `'20'` en `schema_migration`.
- **Por qué importa:** la extensión sigue redondeando a 4 decimales y la tabla de migraciones dice que todo se aplicó.
- **Sugerencia:**
  - Buscar el nombre del CHECK en `sys.check_constraints`, hacer DROP, ALTER y recrearlo con nombre (`CK_bom_extension_cantidad`).
  - Envolver la migración en `SET XACT_ABORT ON` con `TRY/CATCH` e insertar en `schema_migration` solo si no hubo errores (ver D-06).

**D-02 · Integridad (regresión) · `backend/database/20_revision_integridad_indices.sql:99-111`, `backend/app/repositories/ingreso_repository.py:474-500`, `backend/app/repositories/rundown_repository.py:506-515`**
- **Descripción:** el índice único `UX_transito_clave (id_proveedor, id_material, fecha_eta, tipo_via, destino)` choca con la recepción de facturas. Esa recepción busca el tránsito por factura o PO, le pone `fecha_eta` = fecha de recepción o inserta uno nuevo con `Local/total`. `create_transito` tampoco verifica la clave.
- **Por qué importa:** dos facturas del mismo proveedor y material recibidas el mismo día disparan el error 2601. Se aborta toda la recepción (stock, movimientos, estado) y el usuario ve un 500.
- **Sugerencia:** que esos caminos hagan upsert por la misma clave que `upsert_transito` (`rundown_repository.py:1046`), sumando la cantidad. Si no, quitar el índice o incluir el número de factura en la clave.

**D-03 · Migraciones · `backend/database/init_db.py:14, 176`**
- **Descripción:** solo ejecuta `00`. En una base nueva faltan `bom_componente_directo`, `bom_extension`, `bom_sd_set`, `bom_set_producto`, `demanda_despacho`, `conversion_orden_suministro`, `schema_migration` y todo lo de la `20`.
- **Por qué importa:** la primera importación de BOM falla (`bom_service.py:121`).
- **Sugerencia:** que `init_db.py` ejecute en orden todos los `NN_*.sql` que no figuren en `schema_migration`.

**D-04 · Tipos e integridad · `backend/database/00_init_database.sql:70` vs `01_migracion_bom_multinivel.sql:41-43, 68-69`, `18_bom_sd_set.sql:5, 12, 22-23, 27-28`, `19_conversion_orden_suministro.sql:4-6`**
- **Descripción:** `id_material` mide 50 en `00` y 30 en las tablas con FK de `01` y `18`. SQL Server exige el mismo largo en las FK (error 1753). El código ya esquiva el problema leyendo `COL_LENGTH` (`11_bom_extension.sql:1`, `rundown_repository.py`, `stock_repository.py`).
- **Por qué importa:** el esquema no se puede reproducir y la `18` falla sobre una base creada con `00`. En la base local el largo es 30.
- **Sugerencia:** fijar el largo de producción en todos los scripts, o generar el DDL de `18`/`19` con `COL_LENGTH`.

### Media

**D-05 · Integridad · `backend/database/20_revision_integridad_indices.sql:87-96`, `backend/app/repositories/rundown_repository.py:1873-1876, 1932, 1956`**
- **Descripción:** `UX_rpm_material_activo` (un parámetro activo por material) choca con `create_or_update_parametro_material`, que siempre deja `activo = 1` buscando por `(id_proveedor, id_material)`.
- **Por qué importa:** cargar un material que ya está activo con otro proveedor da error 2601 y un 500.
- **Sugerencia:** desactivar los otros parámetros del material en la misma transacción, o devolver un 400 claro. Hay que confirmar la regla de negocio (ver Dudas).

**D-06 · Migraciones · `backend/database/20_revision_integridad_indices.sql:34-65, 126-128`**
- **Descripción:** la migración no es atómica. El DROP de los índices de BOM está en un batch y la recreación en otro, sin `XACT_ABORT` ni transacción, y el registro en `schema_migration` es incondicional. Tampoco hay `SET QUOTED_IDENTIFIER ON`, que los índices filtrados necesitan con `sqlcmd` sin `-I`.
- **Por qué importa:** un fallo intermedio deja la base en un estado mixto marcado como aplicado.
- **Sugerencia:** `SET XACT_ABORT ON; SET QUOTED_IDENTIFIER ON;` con `TRY/CATCH` y registro condicional.

**D-07 · Integridad · `backend/app/repositories/rundown_repository.py:65-85` vs `backend/database/00_init_database.sql:546-550`; `03_crear_tablas_rundown.sql:8-57` vs `00:433-439, 469-470`**
- **Descripción:** `rundown_diario` creada en tiempo de ejecución no tiene las FK de `00`. Las tablas creadas con `03` no tienen columnas que el código usa (`stock_inicial_planta/total`, `tipo_empaque`, `en_cl2`, `rundown_transito_arribo.estado`), y ninguna migración las agrega.
- **Por qué importa:** según qué script creó cada tabla, faltan FK o columnas.
- **Sugerencia:** una migración con `IF COL_LENGTH(...) IS NULL ALTER TABLE ... ADD` y las FK.

**D-08 · Migraciones · `backend/database/` (faltan 06, 09, 15-17), `stock_repository.py:833-848`, `supply_repository.py:39`, `explosion_consumo_repository.py:31`**
- **Descripción:** `caja_pedido` y `caja_pedido_item` solo existen como DDL en tiempo de ejecución, y `plan_mes_diario` y `explosion_consumo_material` se crean desde Python además del script. CLAUDE.md menciona `09_planificacion_contenedores.sql`, que no está en esta rama.
- **Por qué importa:** el esquema real depende de qué endpoints se llamaron, y el usuario de la app necesita permisos DDL.
- **Sugerencia:** `21_caja_pedido.sql` y quitar el DDL de los repositorios.

**D-09 · FKs faltantes**
- **Dónde:**
  - `rundown_parametro_material.id_material` (`00:422`) y `rundown_transito_arribo.id_material` (`00:461`).
  - `rundown_stock_ajuste` (`00:479-481`), además con columnas redundantes.
  - `rundown_parametro_producto.id_producto` (`00:449`) y `set_componente.id_material_hijo` (`00:196`).
  - `bom_componente_directo.id_padre/id_hijo` (`11_bom_extension.sql:10-11`) e `ingreso_material.id_usuario_recepcion` (`00:320`).
  - `demanda_despacho` (`10_demanda_despacho.sql:5,12,14`) y `explosion_consumo_material.id_importacion` (`12:13`).
- **Por qué importa:** pueden quedar huérfanos y códigos inexistentes.
- **Sugerencia:** agregar las FK después de limpiar los datos (`WITH NOCHECK` y luego `CHECK CONSTRAINT`).

**D-10 · Zona horaria en el esquema · defaults de `00` (`:22` vs `:54`) y columnas mixtas (ver B-12)**
- **Descripción:** los defaults mezclan `SYSUTCDATETIME()` y `SYSDATETIME()`.
- **Por qué importa:** el orden de `IX_mov_fecha` y los filtros por día dan resultados corridos.
- **Sugerencia:** unificar en hora local Argentina, igual que `core/time.py`.

**D-11 · Precisión · `backend/database/supabase/20_confirmar_preparacion_cl2.sql:66, 87-89`, `backend/app/repositories/pedido_repository.py:780, 810, 839`**
- **Descripción:** las cantidades son `DECIMAL(18,4)`, pero la lógica de despacho redondea a 2 decimales. Con 1,2345 pedido y 1,23 entregado, el pendiente redondea a 0.
- **Por qué importa:** la línea nunca pasa a `completo` y salta "No se especificaron cantidades".
- **Sugerencia:** comparar con tolerancia o redondear la cantidad pedida al guardarla.

**D-12 · Índices · `backend/database/00_init_database.sql:315, 328`, `backend/app/repositories/ingreso_repository.py:97-99, 211, 333-335`**
- **Descripción:** `ingreso_material_detalle.id_ingreso` no tiene índice. `ingreso_material.numero_factura` no tiene UNIQUE, y la validación en la app usa una expresión no sargable.
- **Por qué importa:** cada consulta de ingresos hace un scan, y dos requests simultáneas pueden duplicar una factura.
- **Sugerencia:** `CREATE INDEX IX_imd_ingreso ON dbo.ingreso_material_detalle(id_ingreso);` y un índice único sobre el número de factura normalizado.

**D-13 · Supabase · `backend/database/08_esquema_deposito_cl2.sql:66, 129-177, 188`, `backend/database/supabase/20_confirmar_preparacion_cl2.sql:12, 47`**
- **Descripción:** con políticas `USING (true)`, la función `SECURITY INVOKER` es opcional: cualquier `authenticated` sigue pudiendo escribir directo en `pedidos_cl2_detalle` y `remitos_cl2`. `remitos_cl2.id_pedido` no tiene índice y la función filtra por esa columna.
- **Por qué importa:** se pueden saltear el bloqueo y las validaciones de la función.
- **Sugerencia:**
  - Pasar la función a `SECURITY DEFINER` (el `search_path` ya está fijado) y restringir las políticas de escritura directa.
  - `CREATE INDEX IF NOT EXISTS ix_remitos_cl2_pedido ON public.remitos_cl2(id_pedido);`

**D-14 · Diseño · `backend/database/00_init_database.sql:79-82` vs `436-439`; `00:392, 406` vs `00:161`, `18:28`**
- **Descripción:** el empaque está en `material` y otra vez en `rundown_parametro_material`. Además hay dos catálogos de producto: `producto` (FK de producción) y `material` (FK de BOM).
- **Por qué importa:** los datos divergen y hay que dar de alta el mismo código en dos tablas (`supply_repository.py`).
- **Sugerencia:** queda en la lista de reestructuraciones postergadas.

### Baja

- **D-15 · Procedimiento con precisión vieja:** `usp_generar_explosion_bom_version` (`00:636,648`, `01:112,124`) sigue usando `decimal(18,4)` y contradice la `20`. No se usa desde la app.
- **D-16 · Índice de calendario:** `20_revision_integridad_indices.sql:115-120` decide si borrarlo con `is_unique = 1`, que también matchea la PK. Falta `AND i.is_primary_key = 0` y verificar que la clave sea `fecha`.
- **D-17 · CHECK no confiable:** `CK_usuario_rol` se crea `WITH NOCHECK` (`20:19`). Conviene `WITH CHECK` después de verificar los datos.
- **D-18 · Reconstrucción innecesaria:** la `20` borra y recrea los índices de BOM en cada ejecución (`20:34-65`). Condicionarlo a `sys.columns.scale < 8`.
- **D-19 · Ids de remito en Supabase:** `LPAD(v_seq, 2)` y `LPAD(id_pedido, 6)` truncan (`supabase/20...sql:48`), a diferencia de Python. Ver B-03.
- **D-20 · Script no re-ejecutable:** `CREATE POLICY` sin `DROP POLICY IF EXISTS` en `08_esquema_deposito_cl2.sql:113-177`.
- **D-21 · FLOAT en parámetros:** `proveedor.dias_alerta_*` y `doh_sugerido_planta` (`00:36-39, 435`).
- **D-22 · Script destructivo:** `01_migracion_bom_multinivel.sql:6` tiene `USE GestionDeposito` fijo y `:9-12` hace `DROP TABLE dbo.bom` sin backup.
- **D-23 · Definiciones divergentes:** índices de `set_componente` (`00:201-202` vs `02:21-26`) y FKs de BOM con y sin `ON DELETE CASCADE` (`01:48,73` vs `00:160,176`).
- **D-24 · Redundancias y CHECK faltantes:**
  - `stock_inicial_referencia` se escribe igual que `stock_inicial_total` (`rundown_repository.py:1934-1935`).
  - `ingreso_material.estado` no tiene CHECK (`00:319`).

---

## Dudas / a verificar

- **Antes de correr la migración `20` en producción:**
  - Si hay estadísticas, índices manuales o vistas `SCHEMABINDING` que incluyan `cantidad` o `factor_uso`: bloquearían sus `ALTER COLUMN`.
  - Si `pedido.comentario` ya es `VARCHAR(MAX)` (`COL_LENGTH` = -1): la `20` lo achicaría a 2000.
- **Base real de producción:**
  - El largo de `material.id_material` (D-04).
  - Si `numero_factura` y `username` tienen UNIQUE.
  - Si el servidor SQL corre en hora de Argentina.
- **Supabase:**
  - Cuál es el `max-rows` de PostgREST y cuántas filas tiene hoy `remitos_cl2` (B-05).
  - Si RLS rechaza cuentas sin `usuarios_perfil` (F-08).
- **Reglas de negocio:**
  - Si un mismo pedido puede despacharse en parte en planta y en parte en CL2 (B-03).
  - Si un material puede estar activo con más de un proveedor (D-05).
  - Si las cantidades pedidas tienen más de 2 decimales en la práctica (D-11).
  - Si el doble registro de stock en planta (`rundown_stock_ajuste` + `stock_deposito.stock_planta`) es intencional (B-06).
  - Si "Cancelar pedido" debe estar disponible en Vercel (F-03).
  - Si el rol `solicitante` sigue vigente.
- **Despliegue:** si uvicorn corre con varios workers en producción; en ese caso el límite de login y el executor de CL2 quedan por proceso.
