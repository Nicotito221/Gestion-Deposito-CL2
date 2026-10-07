from datetime import date, datetime
from typing import Any, Dict, List, Optional
import pyodbc

from app.core.config import get_db_connection
from app.core.time import get_argentina_now, get_argentina_today
from app.schemas.ingreso import IngresoConfirmarRecepcion, IngresoCreate, IngresoRecepcionItem


class IngresoRepository:
    def __init__(self, connection_factory=get_db_connection) -> None:
        self._get_connection = connection_factory

    def get_ingresos(
        self,
        estado: Optional[str] = None,
        id_proveedor: Optional[int] = None,
        search: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            where_clauses: List[str] = []
            params: List[Any] = []

            if estado and estado != "all":
                where_clauses.append("im.estado = ?")
                params.append(estado)

            if id_proveedor and id_proveedor > 0:
                where_clauses.append("im.id_proveedor = ?")
                params.append(id_proveedor)

            if search and search.strip():
                term = f"%{search.strip()}%"
                where_clauses.append("(im.numero_factura LIKE ? OR im.orden_compra LIKE ? OR p.nombre LIKE ?)")
                params.extend([term, term, term])

            where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

            sql = f"""
                SELECT TOP ({limit})
                    im.id_ingreso, im.id_proveedor, p.nombre AS nombre_proveedor,
                    p.codigo_proveedor, ISNULL(p.deposito_en_planta, 0) AS deposito_en_planta,
                    im.numero_factura, im.orden_compra, im.estado,
                    im.fecha_emision, im.fecha_recepcion,
                    im.id_usuario AS id_usuario_creacion,
                    u_crea.nombre AS usuario_creacion,
                    im.id_usuario_recepcion,
                    u_rec.nombre AS usuario_recepcion,
                    im.observacion
                FROM dbo.ingreso_material im
                INNER JOIN dbo.proveedor p ON im.id_proveedor = p.id_proveedor
                LEFT JOIN dbo.usuario u_crea ON im.id_usuario = u_crea.id_usuario
                LEFT JOIN dbo.usuario u_rec ON im.id_usuario_recepcion = u_rec.id_usuario
                {where_str}
                ORDER BY im.id_ingreso DESC
            """
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            if not rows:
                return []

            ingresos: List[Dict[str, Any]] = []
            ingreso_ids: List[int] = []
            for r in rows:
                i_id = int(r[0])
                ingreso_ids.append(i_id)
                ingresos.append({
                    "id_ingreso": i_id,
                    "id_proveedor": int(r[1]),
                    "nombre_proveedor": str(r[2]),
                    "codigo_proveedor": str(r[3]),
                    "deposito_en_planta": bool(r[4]),
                    "numero_factura": str(r[5] or ""),
                    "orden_compra": str(r[6]) if r[6] else None,
                    "estado": str(r[7] or "pendiente"),
                    "fecha_emision": r[8],
                    "fecha_recepcion": r[9],
                    "id_usuario_creacion": int(r[10]) if r[10] is not None else None,
                    "usuario_creacion": str(r[11]).strip() if r[11] else None,
                    "id_usuario_recepcion": int(r[12]) if r[12] is not None else None,
                    "usuario_recepcion": str(r[13]).strip() if r[13] else None,
                    "observacion": str(r[14]) if r[14] else None,
                    "total_items": 0,
                    "items": [],
                })

            placeholders = ",".join("?" for _ in ingreso_ids)
            sql_items = f"""
                SELECT imd.id_ingreso, imd.id_ingreso_detalle, imd.id_material,
                       m.nombre AS nombre_material, ISNULL(m.unidad, 'UN') AS unidad,
                       CAST(imd.cantidad_facturada AS FLOAT) AS cantidad_facturada,
                       CAST(imd.cantidad_recibida AS FLOAT) AS cantidad_recibida,
                       ISNULL(imd.conforme, 1) AS conforme, imd.observacion
                FROM dbo.ingreso_material_detalle imd
                LEFT JOIN dbo.material m ON imd.id_material = m.id_material
                WHERE imd.id_ingreso IN ({placeholders})
                ORDER BY imd.id_ingreso, imd.id_ingreso_detalle ASC
            """
            cursor.execute(sql_items, ingreso_ids)
            items_by_ingreso: Dict[int, List[Dict[str, Any]]] = {i_id: [] for i_id in ingreso_ids}
            for ir in cursor.fetchall():
                ing_id = int(ir[0])
                items_by_ingreso[ing_id].append({
                    "id_ingreso_detalle": int(ir[1]),
                    "id_material": str(ir[2]),
                    "nombre_material": str(ir[3] or ir[2]),
                    "unidad": str(ir[4] or "UN"),
                    "cantidad_facturada": float(ir[5] or 0.0),
                    "cantidad_recibida": float(ir[6]) if ir[6] is not None else None,
                    "conforme": bool(ir[7]),
                    "observacion": str(ir[8]) if ir[8] else None,
                })

            for ing in ingresos:
                ing["items"] = items_by_ingreso.get(ing["id_ingreso"], [])
                ing["total_items"] = len(ing["items"])

            return ingresos
        finally:
            cursor.close()
            conn.close()

    def get_ingreso_by_id(self, id_ingreso: int) -> Optional[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            sql = """
                SELECT im.id_ingreso, im.id_proveedor, p.nombre AS nombre_proveedor,
                       p.codigo_proveedor, ISNULL(p.deposito_en_planta, 0) AS deposito_en_planta,
                       im.numero_factura, im.orden_compra, im.estado,
                       im.fecha_emision, im.fecha_recepcion,
                       im.id_usuario AS id_usuario_creacion,
                       u_crea.nombre AS usuario_creacion,
                       im.id_usuario_recepcion,
                       u_rec.nombre AS usuario_recepcion,
                       im.observacion
                FROM dbo.ingreso_material im
                INNER JOIN dbo.proveedor p ON im.id_proveedor = p.id_proveedor
                LEFT JOIN dbo.usuario u_crea ON im.id_usuario = u_crea.id_usuario
                LEFT JOIN dbo.usuario u_rec ON im.id_usuario_recepcion = u_rec.id_usuario
                WHERE im.id_ingreso = ?
            """
            cursor.execute(sql, (id_ingreso,))
            r = cursor.fetchone()
            if not r:
                return None

            ingreso = {
                "id_ingreso": int(r[0]),
                "id_proveedor": int(r[1]),
                "nombre_proveedor": str(r[2]),
                "codigo_proveedor": str(r[3]),
                "deposito_en_planta": bool(r[4]),
                "numero_factura": str(r[5] or ""),
                "orden_compra": str(r[6]) if r[6] else None,
                "estado": str(r[7] or "pendiente"),
                "fecha_emision": r[8],
                "fecha_recepcion": r[9],
                "id_usuario_creacion": int(r[10]) if r[10] is not None else None,
                "usuario_creacion": str(r[11]).strip() if r[11] else None,
                "id_usuario_recepcion": int(r[12]) if r[12] is not None else None,
                "usuario_recepcion": str(r[13]).strip() if r[13] else None,
                "observacion": str(r[14]) if r[14] else None,
                "total_items": 0,
                "items": [],
            }

            cursor.execute(
                """
                SELECT imd.id_ingreso_detalle, imd.id_material,
                       m.nombre AS nombre_material, ISNULL(m.unidad, 'UN') AS unidad,
                       CAST(imd.cantidad_facturada AS FLOAT) AS cantidad_facturada,
                       CAST(imd.cantidad_recibida AS FLOAT) AS cantidad_recibida,
                       ISNULL(imd.conforme, 1) AS conforme, imd.observacion
                FROM dbo.ingreso_material_detalle imd
                LEFT JOIN dbo.material m ON imd.id_material = m.id_material
                WHERE imd.id_ingreso = ?
                ORDER BY imd.id_ingreso_detalle ASC
                """,
                (id_ingreso,),
            )
            items = []
            for ir in cursor.fetchall():
                items.append({
                    "id_ingreso_detalle": int(ir[0]),
                    "id_material": str(ir[1]),
                    "nombre_material": str(ir[2] or ir[1]),
                    "unidad": str(ir[3] or "UN"),
                    "cantidad_facturada": float(ir[4] or 0.0),
                    "cantidad_recibida": float(ir[5]) if ir[5] is not None else None,
                    "conforme": bool(ir[6]),
                    "observacion": str(ir[7]) if ir[7] else None,
                })

            ingreso["items"] = items
            ingreso["total_items"] = len(items)
            return ingreso
        finally:
            cursor.close()
            conn.close()

    def create_ingreso(self, data: IngresoCreate, id_usuario: Optional[int] = None) -> int:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            clean_factura = data.numero_factura.strip()
            cursor.execute(
                "SELECT 1 FROM dbo.ingreso_material WHERE UPPER(LTRIM(RTRIM(numero_factura))) = UPPER(LTRIM(RTRIM(?)))",
                (clean_factura,),
            )
            if cursor.fetchone():
                raise ValueError(
                    f"El número de factura '{clean_factura}' ya existe en el sistema. Los números de factura deben ser únicos."
                )

            user_id = id_usuario
            if user_id:
                cursor.execute("SELECT 1 FROM dbo.usuario WHERE id_usuario = ?", (user_id,))
                if not cursor.fetchone():
                    user_id = None
            if not user_id:
                cursor.execute("SELECT TOP 1 id_usuario FROM dbo.usuario WHERE activo = 1 ORDER BY id_usuario ASC")
                u_row = cursor.fetchone()
                user_id = int(u_row[0]) if u_row else 1

            cursor.execute(
                """
                INSERT INTO dbo.ingreso_material (
                    id_proveedor, nro_remito_proveedor, numero_factura, orden_compra,
                    id_usuario, fecha_recibida, fecha_emision, completo, estado, observacion
                )
                OUTPUT INSERTED.id_ingreso
                VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'pendiente', ?)
                """,
                (
                    data.id_proveedor,
                    data.numero_factura.strip(),
                    data.numero_factura.strip(),
                    data.orden_compra.strip() if data.orden_compra else None,
                    user_id,
                    data.fecha_emision or get_argentina_today(),
                    data.fecha_emision or get_argentina_today(),
                    data.observacion,
                ),
            )
            id_ingreso = int(cursor.fetchone()[0])

            for it in data.items:
                cursor.execute(
                    """
                    INSERT INTO dbo.ingreso_material_detalle (
                        id_ingreso, id_material, cantidad_facturada, cantidad_recibida, conforme, observacion
                    )
                    VALUES (?, ?, ?, 0.0, 1, ?)
                    """,
                    (id_ingreso, it.id_material.strip(), it.cantidad_facturada, it.observacion),
                )

            conn.commit()

            if data.confirmar_inmediato:
                recep_payload = IngresoConfirmarRecepcion(
                    fecha_recepcion=data.fecha_recepcion or data.fecha_emision or get_argentina_today(),
                    observacion=data.observacion,
                    items=[
                        IngresoRecepcionItem(
                            id_material=it.id_material.strip(),
                            cantidad_recibida=it.cantidad_facturada,
                            conforme=True,
                            observacion=it.observacion,
                        )
                        for it in data.items
                    ],
                )
                self.confirmar_recepcion(id_ingreso, recep_payload, id_usuario=user_id)

            return id_ingreso
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def confirmar_recepcion(
        self, id_ingreso: int, data: IngresoConfirmarRecepcion, id_usuario: Optional[int] = None
    ) -> Dict[str, Any]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT im.id_proveedor, im.numero_factura, im.orden_compra, im.estado,
                       ISNULL(p.deposito_en_planta, 0) AS deposito_en_planta
                FROM dbo.ingreso_material im
                INNER JOIN dbo.proveedor p ON im.id_proveedor = p.id_proveedor
                WHERE im.id_ingreso = ?
                """,
                (id_ingreso,),
            )
            row = cursor.fetchone()
            if not row:
                raise ValueError(f"Comprobante de ingreso #{id_ingreso} no encontrado")

            id_prov = int(row[0])
            nro_factura = str(row[1] or "")
            po_numero = str(row[2]) if row[2] else None
            estado_actual = str(row[3] or "pendiente")
            dep_planta = bool(row[4])

            if estado_actual == "completo":
                raise ValueError(f"El ingreso #{id_ingreso} ya se encuentra completado")

            user_id = id_usuario
            if user_id:
                cursor.execute("SELECT 1 FROM dbo.usuario WHERE id_usuario = ?", (user_id,))
                if not cursor.fetchone():
                    user_id = None
            if not user_id:
                cursor.execute("SELECT TOP 1 id_usuario FROM dbo.usuario WHERE activo = 1 ORDER BY id_usuario ASC")
                u_row = cursor.fetchone()
                user_id = int(u_row[0]) if u_row else 1

            fecha_recep_date = data.fecha_recepcion or get_argentina_today()
            now_dt = get_argentina_now()

            cursor.execute(
                """
                SELECT id_ingreso_detalle, id_material, CAST(cantidad_facturada AS FLOAT), CAST(ISNULL(cantidad_recibida, 0.0) AS FLOAT)
                FROM dbo.ingreso_material_detalle
                WHERE id_ingreso = ?
                """,
                (id_ingreso,),
            )
            detalles_map = {str(r[1]): {"id_detalle": int(r[0]), "facturada": float(r[2]), "recibida_ant": float(r[3])} for r in cursor.fetchall()}

            rec_input_map = {it.id_material.strip(): it for it in data.items}

            all_completed = True
            any_received = False

            for id_mat, det_info in detalles_map.items():
                in_item = rec_input_map.get(id_mat)
                cant_rec_ahora = float(in_item.cantidad_recibida) if in_item is not None else det_info["facturada"]
                conforme_val = bool(in_item.conforme) if in_item is not None else True
                obs_val = in_item.observacion if in_item is not None else None

                cant_delta = round(cant_rec_ahora - det_info["recibida_ant"], 2)
                cursor.execute(
                    """
                    UPDATE dbo.ingreso_material_detalle
                    SET cantidad_recibida = ?, conforme = ?, observacion = COALESCE(?, observacion)
                    WHERE id_ingreso = ? AND id_material = ?
                    """,
                    (cant_rec_ahora, 1 if conforme_val else 0, obs_val, id_ingreso, id_mat),
                )

                if cant_rec_ahora < det_info["facturada"]:
                    all_completed = False
                if cant_rec_ahora > 0:
                    any_received = True

                if cant_delta > 0:
                    if dep_planta:
                        cursor.execute(
                            "SELECT id_parametro, stock_inicial_planta FROM dbo.rundown_parametro_material WHERE id_material = ? AND activo = 1",
                            (id_mat,),
                        )
                        rpm_row = cursor.fetchone()
                        id_param = int(rpm_row[0]) if rpm_row else None
                        init_p = float(rpm_row[1] or 0.0) if rpm_row else 0.0

                        if id_param:
                            cursor.execute(
                                "SELECT stock_ajustado FROM dbo.rundown_stock_ajuste WHERE id_parametro = ? AND fecha = ? AND tipo_stock = 'planta'",
                                (id_param, fecha_recep_date),
                            )
                            adj_row = cursor.fetchone()
                            if adj_row is not None:
                                cur_p = float(adj_row[0] or 0.0)
                                new_p = round(cur_p + cant_delta, 2)
                                cursor.execute(
                                    "UPDATE dbo.rundown_stock_ajuste SET stock_ajustado = ?, observacion = ?, fecha_creacion = SYSUTCDATETIME() WHERE id_parametro = ? AND fecha = ? AND tipo_stock = 'planta'",
                                    (new_p, f"Ingreso proveedor {nro_factura} (#{id_ingreso})", id_param, fecha_recep_date),
                                )
                            else:
                                cursor.execute(
                                    "SELECT TOP 1 stock_ajustado FROM dbo.rundown_stock_ajuste WHERE id_parametro = ? AND tipo_stock = 'planta' AND fecha < ? ORDER BY fecha DESC, fecha_creacion DESC",
                                    (id_param, fecha_recep_date),
                                )
                                prev_adj = cursor.fetchone()
                                cur_p = float(prev_adj[0] or 0.0) if prev_adj else init_p
                                new_p = round(cur_p + cant_delta, 2)
                                cursor.execute(
                                    """
                                    INSERT INTO dbo.rundown_stock_ajuste (id_parametro, id_proveedor, id_material, fecha, tipo_stock, stock_ajustado, observacion, id_usuario, fecha_creacion)
                                    VALUES (?, ?, ?, ?, 'planta', ?, ?, ?, SYSUTCDATETIME())
                                    """,
                                    (id_param, id_prov, id_mat, fecha_recep_date, new_p, f"Ingreso proveedor {nro_factura} (#{id_ingreso})", user_id),
                                )
                        else:
                            cursor.execute("SELECT stock_planta FROM dbo.stock_deposito WHERE id_material = ?", (id_mat,))
                            sd_row = cursor.fetchone()
                            cur_p = float(sd_row[0] or 0.0) if sd_row else 0.0
                            new_p = round(cur_p + cant_delta, 2)

                        cursor.execute(
                            """
                            MERGE dbo.stock_deposito AS target
                            USING (SELECT ? AS id_material, ? AS delta) AS source
                            ON (target.id_material = source.id_material)
                            WHEN MATCHED THEN
                                UPDATE SET stock_planta = target.stock_planta + source.delta, fecha_actualizacion = GETDATE()
                            WHEN NOT MATCHED THEN
                                INSERT (id_material, stock_actual, stock_planta, stock_warehouse, fecha_actualizacion)
                                VALUES (source.id_material, 0.0, source.delta, 0.0, GETDATE());
                            """,
                            (id_mat, cant_delta),
                        )

                        cursor.execute(
                            """
                            INSERT INTO dbo.movimiento_stock (id_material, tipo, cantidad, stock_anterior, stock_posterior, id_usuario, fecha, observacion)
                            VALUES (?, 'ingreso_proveedor', ?, ?, ?, ?, GETDATE(), ?)
                            """,
                            (id_mat, cant_delta, cur_p, new_p, user_id, f"Recepción factura {nro_factura} (#{id_ingreso}) en Planta"),
                        )
                    else:
                        cursor.execute("SELECT stock_actual FROM dbo.stock_deposito WHERE id_material = ?", (id_mat,))
                        stk_row = cursor.fetchone()
                        if stk_row is not None:
                            stk_ant = float(stk_row[0] or 0.0)
                            stk_post = round(stk_ant + cant_delta, 2)
                            cursor.execute(
                                "UPDATE dbo.stock_deposito SET stock_actual = ?, fecha_actualizacion = GETDATE() WHERE id_material = ?",
                                (stk_post, id_mat),
                            )
                        else:
                            stk_ant = 0.0
                            stk_post = cant_delta
                            cursor.execute(
                                "INSERT INTO dbo.stock_deposito (id_material, stock_actual, fecha_actualizacion) VALUES (?, ?, GETDATE())",
                                (id_mat, stk_post),
                            )

                        cursor.execute(
                            """
                            INSERT INTO dbo.movimiento_stock (id_material, tipo, cantidad, stock_anterior, stock_posterior, id_usuario, fecha, observacion)
                            VALUES (?, 'ingreso_proveedor', ?, ?, ?, ?, GETDATE(), ?)
                            """,
                            (id_mat, cant_delta, stk_ant, stk_post, user_id, f"Recepción factura {nro_factura} (#{id_ingreso}) en CL2"),
                        )

                    cursor.execute(
                        """
                        SELECT TOP 1 id_transito, fecha_eta, cantidad
                        FROM dbo.rundown_transito_arribo
                        WHERE id_material = ?
                          AND (
                            (factura_numero IS NOT NULL AND LTRIM(RTRIM(factura_numero)) = ?)
                            OR (po_numero IS NOT NULL AND ? IS NOT NULL AND LTRIM(RTRIM(po_numero)) = ?)
                          )
                        ORDER BY id_transito DESC
                        """,
                        (id_mat, nro_factura.strip(), po_numero.strip() if po_numero else None, po_numero.strip() if po_numero else None),
                    )
                    trans_row = cursor.fetchone()
                    if trans_row:
                        id_transito = int(trans_row[0])
                        cursor.execute(
                            """
                            UPDATE dbo.rundown_transito_arribo
                            SET fecha_eta = ?,
                                cantidad = ?,
                                observacion = ?,
                                estado = 'confirmado'
                            WHERE id_transito = ?
                            """,
                            (
                                fecha_recep_date,
                                cant_rec_ahora,
                                f"Recepción confirmada en CL2 el {fecha_recep_date.strftime('%d/%m/%Y')} | Factura {nro_factura}",
                                id_transito,
                            ),
                        )
                    else:
                        cursor.execute(
                            """
                            INSERT INTO dbo.rundown_transito_arribo (
                                id_proveedor, id_material, fecha_eta, tipo_via,
                                po_numero, factura_numero, cantidad, observacion, estado
                            )
                            VALUES (?, ?, ?, 'Local', ?, ?, ?, ?, 'confirmado')
                            """,
                            (
                                id_prov,
                                id_mat,
                                fecha_recep_date,
                                po_numero,
                                nro_factura,
                                cant_rec_ahora,
                                f"Recepción confirmada en CL2 | Factura {nro_factura}",
                            ),
                        )

            nuevo_estado = "completo" if all_completed else ("parcial" if any_received else "pendiente")

            cursor.execute(
                """
                UPDATE dbo.ingreso_material
                SET estado = ?,
                    completo = ?,
                    fecha_recepcion = ?,
                    id_usuario_recepcion = ?,
                    observacion = COALESCE(?, observacion)
                WHERE id_ingreso = ?
                """,
                (
                    nuevo_estado,
                    1 if nuevo_estado == "completo" else 0,
                    now_dt,
                    user_id,
                    data.observacion,
                    id_ingreso,
                ),
            )

            conn.commit()
            return self.get_ingreso_by_id(id_ingreso) or {}
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def delete_ingreso(self, id_ingreso: int, id_usuario: Optional[int] = None) -> bool:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT im.id_ingreso, im.numero_factura, im.estado, ISNULL(p.deposito_en_planta, 0) AS deposito_en_planta, im.fecha_recepcion
                FROM dbo.ingreso_material im
                INNER JOIN dbo.proveedor p ON im.id_proveedor = p.id_proveedor
                WHERE im.id_ingreso = ?
                """,
                (id_ingreso,),
            )
            ing_row = cursor.fetchone()
            if not ing_row:
                return False

            nro_factura = str(ing_row[1] or "")
            estado = str(ing_row[2] or "pendiente")
            deposito_en_planta = bool(ing_row[3])
            fecha_recep = ing_row[4]
            fecha_recep_date = (
                fecha_recep.date() if isinstance(fecha_recep, datetime) else (fecha_recep or get_argentina_today())
            )

            if estado in ("completo", "parcial"):
                cursor.execute(
                    """
                    SELECT id_material, cantidad_recibida
                    FROM dbo.ingreso_material_detalle
                    WHERE id_ingreso = ? AND cantidad_recibida > 0
                    """,
                    (id_ingreso,),
                )
                items_recibidos = cursor.fetchall()
                for r in items_recibidos:
                    id_mat = str(r[0])
                    cant_rec = float(r[1] or 0.0)
                    if cant_rec <= 0:
                        continue

                    if deposito_en_planta:
                        cursor.execute(
                            "SELECT id_parametro FROM dbo.rundown_parametro_material WHERE id_material = ? AND activo = 1",
                            (id_mat,),
                        )
                        p_row = cursor.fetchone()
                        if p_row:
                            id_param = int(p_row[0])
                            cursor.execute(
                                "SELECT stock_ajustado FROM dbo.rundown_stock_ajuste WHERE id_parametro = ? AND fecha = ? AND tipo_stock = 'planta'",
                                (id_param, fecha_recep_date),
                            )
                            adj_row = cursor.fetchone()
                            if adj_row is not None:
                                stk_ant = float(adj_row[0] or 0.0)
                                stk_post = max(0.0, stk_ant - cant_rec)
                                cursor.execute(
                                    """
                                    UPDATE dbo.rundown_stock_ajuste
                                    SET stock_ajustado = ?, observacion = ?, fecha_creacion = SYSUTCDATETIME()
                                    WHERE id_parametro = ? AND fecha = ? AND tipo_stock = 'planta'
                                    """,
                                    (stk_post, f"Reversión por eliminación de factura {nro_factura}", id_param, fecha_recep_date),
                                )
                                cursor.execute(
                                    """
                                    INSERT INTO dbo.movimiento_stock (id_material, tipo, cantidad, stock_anterior, stock_posterior, id_usuario, fecha, observacion)
                                    VALUES (?, 'ajuste_manual', ?, ?, ?, ?, GETDATE(), ?)
                                    """,
                                    (id_mat, -cant_rec, stk_ant, stk_post, id_usuario or 1, f"Reversión stock por eliminación remito #{nro_factura}"),
                                )
                    else:
                        cursor.execute("SELECT stock_actual FROM dbo.stock_deposito WHERE id_material = ?", (id_mat,))
                        stk_row = cursor.fetchone()
                        if stk_row is not None:
                            stk_ant = float(stk_row[0] or 0.0)
                            stk_post = max(0.0, stk_ant - cant_rec)
                            cursor.execute(
                                "UPDATE dbo.stock_deposito SET stock_actual = ?, fecha_actualizacion = GETDATE() WHERE id_material = ?",
                                (stk_post, id_mat),
                            )
                            cursor.execute(
                                """
                                INSERT INTO dbo.movimiento_stock (id_material, tipo, cantidad, stock_anterior, stock_posterior, id_usuario, fecha, observacion)
                                VALUES (?, 'ajuste_manual', ?, ?, ?, ?, GETDATE(), ?)
                                """,
                                (id_mat, -cant_rec, stk_ant, stk_post, id_usuario or 1, f"Reversión stock por eliminación remito #{nro_factura}"),
                            )

                    cursor.execute(
                        "DELETE FROM dbo.rundown_transito_arribo WHERE id_material = ? AND factura_numero = ?",
                        (id_mat, nro_factura),
                    )

            cursor.execute("UPDATE dbo.movimiento_stock SET id_ingreso = NULL WHERE id_ingreso = ?", (id_ingreso,))
            cursor.execute("DELETE FROM dbo.ingreso_material_detalle WHERE id_ingreso = ?", (id_ingreso,))
            cursor.execute("DELETE FROM dbo.ingreso_material WHERE id_ingreso = ?", (id_ingreso,))

            conn.commit()
            return True
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()
