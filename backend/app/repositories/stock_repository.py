import unicodedata
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple
import pyodbc

from app.core.config import get_db_connection
from app.core.time import get_argentina_now, get_argentina_today


class StockRepository:
    def __init__(self, connection_factory=get_db_connection) -> None:
        self._get_connection = connection_factory

    def get_stock_deposito_paginated(
        self,
        search: Optional[str] = None,
        id_proveedor: Optional[int] = None,
        solo_con_stock: bool = False,
        tipo_almacen: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[Dict[str, Any]], int]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            where_clauses: List[str] = ["m.activo = 1", "ISNULL(m.categoria, '') <> 'CAJA_PEDIDO'"]
            params: List[Any] = []

            if search and search.strip():
                term = f"%{search.strip()}%"
                where_clauses.append("(m.id_material LIKE ? OR m.nombre LIKE ?)")
                params.extend([term, term])

            if id_proveedor and id_proveedor > 0:
                where_clauses.append("prov.id_proveedor = ?")
                params.append(id_proveedor)

            if solo_con_stock:
                if tipo_almacen == "cl2":
                    where_clauses.append("ISNULL(prov.deposito_en_planta, 0) = 0 AND ISNULL(sd.stock_actual, 0.0) > 0")
                else:
                    where_clauses.append(
                        "(ISNULL(sd.stock_actual, 0.0) + COALESCE(latest_adj.stock_ajustado, CAST(sd.stock_planta AS FLOAT), ISNULL(rpm.stock_inicial_planta, 0.0))) > 0"
                    )

            where_str = " AND ".join(where_clauses)
            offset = max(0, (page - 1) * page_size)

            count_query = f"""
                SELECT COUNT(*)
                FROM dbo.material m
                LEFT JOIN dbo.stock_deposito sd ON m.id_material = sd.id_material
                OUTER APPLY (
                    SELECT TOP 1 
                        CAST(rsa.stock_ajustado AS FLOAT) AS stock_ajustado
                    FROM dbo.rundown_stock_ajuste rsa
                    WHERE rsa.id_material = m.id_material AND rsa.tipo_stock = 'planta'
                    ORDER BY rsa.fecha DESC, rsa.fecha_creacion DESC
                ) latest_adj
                OUTER APPLY (
                    SELECT TOP 1 
                        p.id_proveedor,
                        p.nombre,
                        ISNULL(p.deposito_en_planta, 0) AS deposito_en_planta
                    FROM (
                        SELECT id_proveedor_principal AS id_proveedor, 1 AS prioridad FROM dbo.material WHERE id_material = m.id_material AND id_proveedor_principal IS NOT NULL
                        UNION ALL
                        SELECT id_proveedor, 2 AS prioridad FROM dbo.rundown_parametro_material WHERE id_material = m.id_material AND activo = 1
                        UNION ALL
                        SELECT id_proveedor, 3 AS prioridad FROM dbo.proveedor_material WHERE id_material = m.id_material AND activo = 1
                    ) src
                    JOIN dbo.proveedor p ON src.id_proveedor = p.id_proveedor
                    ORDER BY src.prioridad ASC
                ) prov
                OUTER APPLY (
                    SELECT TOP 1 
                        CAST(rpm.stock_inicial_planta AS FLOAT) AS stock_inicial_planta
                    FROM dbo.rundown_parametro_material rpm
                    WHERE rpm.id_material = m.id_material AND rpm.activo = 1
                      AND (prov.id_proveedor IS NULL OR rpm.id_proveedor = prov.id_proveedor)
                    ORDER BY CASE WHEN rpm.id_proveedor = prov.id_proveedor THEN 0 ELSE 1 END, rpm.id_parametro DESC
                ) rpm
                WHERE {where_str}
            """
            cursor.execute(count_query, params)
            total = int(cursor.fetchone()[0])

            data_query = f"""
                SELECT 
                    m.id_material,
                    m.nombre,
                    m.unidad,
                    m.categoria,
                    CASE 
                        WHEN prov.deposito_en_planta = 1 THEN 0.0
                        ELSE CAST(ISNULL(sd.stock_actual, 0.0) AS FLOAT)
                    END AS stock_cl2,
                    COALESCE(latest_adj.stock_ajustado, CAST(sd.stock_planta AS FLOAT), ISNULL(rpm.stock_inicial_planta, 0.0)) AS stock_planta,
                    CASE 
                        WHEN prov.deposito_en_planta = 1 THEN COALESCE(latest_adj.stock_ajustado, CAST(sd.stock_planta AS FLOAT), ISNULL(rpm.stock_inicial_planta, 0.0))
                        ELSE CAST(ISNULL(sd.stock_actual, 0.0) + COALESCE(latest_adj.stock_ajustado, CAST(sd.stock_planta AS FLOAT), ISNULL(rpm.stock_inicial_planta, 0.0)) AS FLOAT)
                    END AS stock_total,
                    prov.id_proveedor,
                    prov.nombre AS nombre_proveedor,
                    ISNULL(prov.deposito_en_planta, 0) AS deposito_en_planta,
                    COALESCE(latest_adj.fecha_creacion, sd.fecha_actualizacion) AS fecha_actualizacion,
                    rpm.id_parametro,
                    COALESCE(rpm.lote_mts, m.lote_minimo) AS lote_mts,
                    COALESCE(rpm.tipo_empaque, m.tipo_empaque, 'pallet') AS tipo_empaque,
                    COALESCE(rpm.unidad_por_bulto, m.unidad_por_bulto) AS unidad_por_bulto,
                    COALESCE(rpm.bultos_por_pallet, m.bultos_por_pallet) AS bultos_por_pallet
                FROM dbo.material m
                LEFT JOIN dbo.stock_deposito sd ON m.id_material = sd.id_material
                OUTER APPLY (
                    SELECT TOP 1 
                        CAST(rsa.stock_ajustado AS FLOAT) AS stock_ajustado,
                        rsa.fecha_creacion
                    FROM dbo.rundown_stock_ajuste rsa
                    WHERE rsa.id_material = m.id_material AND rsa.tipo_stock = 'planta'
                    ORDER BY rsa.fecha DESC, rsa.fecha_creacion DESC
                ) latest_adj
                OUTER APPLY (
                    SELECT TOP 1 
                        p.id_proveedor,
                        p.nombre,
                        ISNULL(p.deposito_en_planta, 0) AS deposito_en_planta
                    FROM (
                        SELECT id_proveedor_principal AS id_proveedor, 1 AS prioridad FROM dbo.material WHERE id_material = m.id_material AND id_proveedor_principal IS NOT NULL
                        UNION ALL
                        SELECT id_proveedor, 2 AS prioridad FROM dbo.rundown_parametro_material WHERE id_material = m.id_material AND activo = 1
                        UNION ALL
                        SELECT id_proveedor, 3 AS prioridad FROM dbo.proveedor_material WHERE id_material = m.id_material AND activo = 1
                    ) src
                    JOIN dbo.proveedor p ON src.id_proveedor = p.id_proveedor
                    ORDER BY src.prioridad ASC
                ) prov
                OUTER APPLY (
                    SELECT TOP 1 
                        rpm.id_parametro,
                        rpm.lote_mts,
                        rpm.tipo_empaque,
                        rpm.unidad_por_bulto,
                        rpm.bultos_por_pallet,
                        CAST(rpm.stock_inicial_planta AS FLOAT) AS stock_inicial_planta
                    FROM dbo.rundown_parametro_material rpm
                    WHERE rpm.id_material = m.id_material AND rpm.activo = 1
                      AND (prov.id_proveedor IS NULL OR rpm.id_proveedor = prov.id_proveedor)
                    ORDER BY CASE WHEN rpm.id_proveedor = prov.id_proveedor THEN 0 ELSE 1 END, rpm.id_parametro DESC
                ) rpm
                WHERE {where_str}
                ORDER BY m.id_material ASC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
            """
            cursor.execute(data_query, (*params, offset, page_size))
            rows = cursor.fetchall()

            items = [
                {
                    "id_material": str(r[0]),
                    "nombre": str(r[1]),
                    "unidad": str(r[2] or "UN"),
                    "categoria": str(r[3]) if r[3] else None,
                    "stock_cl2": float(r[4]),
                    "stock_planta": float(r[5]),
                    "stock_total": float(r[6]),
                    "stock_actual": float(r[4]) if tipo_almacen == "cl2" else float(r[6]),
                    "id_proveedor": int(r[7]) if r[7] is not None else None,
                    "nombre_proveedor": str(r[8]) if r[8] else None,
                    "deposito_en_planta": bool(r[9]),
                    "fecha_actualizacion": r[10] if isinstance(r[10], datetime) else None,
                    "id_parametro": int(r[11]) if r[11] is not None else None,
                    "lote_mts": float(r[12]) if r[12] is not None else None,
                    "tipo_empaque": str(r[13]) if r[13] else "pallet",
                    "unidad_por_bulto": float(r[14]) if len(r) > 14 and r[14] is not None else None,
                    "bultos_por_pallet": int(r[15]) if len(r) > 15 and r[15] is not None else None,
                }
                for r in rows
            ]
            return items, total
        finally:
            cursor.close()
            conn.close()

    def get_material_stock_info(self, id_material: str) -> Optional[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT 
                    m.id_material,
                    m.nombre,
                    CASE 
                        WHEN prov.deposito_en_planta = 1 THEN 0.0
                        ELSE CAST(ISNULL(sd.stock_actual, 0.0) AS FLOAT)
                    END AS stock_cl2,
                    COALESCE(latest_adj.stock_ajustado, CAST(sd.stock_planta AS FLOAT), ISNULL(rpm.stock_inicial_planta, 0.0)) AS stock_planta,
                    CASE 
                        WHEN prov.deposito_en_planta = 1 THEN COALESCE(latest_adj.stock_ajustado, CAST(sd.stock_planta AS FLOAT), ISNULL(rpm.stock_inicial_planta, 0.0))
                        ELSE CAST(ISNULL(sd.stock_actual, 0.0) + COALESCE(latest_adj.stock_ajustado, CAST(sd.stock_planta AS FLOAT), ISNULL(rpm.stock_inicial_planta, 0.0)) AS FLOAT)
                    END AS stock_total,
                    prov.id_proveedor,
                    ISNULL(prov.deposito_en_planta, 0) AS deposito_en_planta
                FROM dbo.material m
                LEFT JOIN dbo.stock_deposito sd ON m.id_material = sd.id_material
                OUTER APPLY (
                    SELECT TOP 1 
                        CAST(rsa.stock_ajustado AS FLOAT) AS stock_ajustado
                    FROM dbo.rundown_stock_ajuste rsa
                    WHERE rsa.id_material = m.id_material
                    ORDER BY rsa.fecha DESC, rsa.fecha_creacion DESC
                ) latest_adj
                OUTER APPLY (
                    SELECT TOP 1 
                        p.id_proveedor,
                        ISNULL(p.deposito_en_planta, 0) AS deposito_en_planta
                    FROM (
                        SELECT id_proveedor_principal AS id_proveedor, 1 AS prioridad FROM dbo.material WHERE id_material = m.id_material AND id_proveedor_principal IS NOT NULL
                        UNION ALL
                        SELECT id_proveedor, 2 AS prioridad FROM dbo.rundown_parametro_material WHERE id_material = m.id_material AND activo = 1
                        UNION ALL
                        SELECT id_proveedor, 3 AS prioridad FROM dbo.proveedor_material WHERE id_material = m.id_material AND activo = 1
                    ) src
                    JOIN dbo.proveedor p ON src.id_proveedor = p.id_proveedor
                    ORDER BY src.prioridad ASC
                ) prov
                OUTER APPLY (
                    SELECT TOP 1 
                        CAST(rpm.stock_inicial_planta AS FLOAT) AS stock_inicial_planta
                    FROM dbo.rundown_parametro_material rpm
                    WHERE rpm.id_material = m.id_material AND rpm.activo = 1
                      AND (prov.id_proveedor IS NULL OR rpm.id_proveedor = prov.id_proveedor)
                    ORDER BY CASE WHEN rpm.id_proveedor = prov.id_proveedor THEN 0 ELSE 1 END, rpm.id_parametro DESC
                ) rpm
                WHERE m.id_material = ?
                """,
                (id_material,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return {
                "id_material": str(row[0]),
                "nombre": str(row[1]),
                "stock_cl2": float(row[2]),
                "stock_planta": float(row[3]),
                "stock_total": float(row[4]),
                "stock_actual": float(row[4]),
                "id_proveedor": int(row[5]) if row[5] is not None else None,
                "deposito_en_planta": bool(row[6]),
            }
        finally:
            cursor.close()
            conn.close()

    def ajustar_stock_deposito(
        self,
        id_material: str,
        nuevo_stock: Optional[float] = None,
        nuevo_stock_planta: Optional[float] = None,
        nuevo_stock_cl2: Optional[float] = None,
        observacion: Optional[str] = None,
        id_usuario: Optional[int] = None,
        stock_planta_actual: Optional[float] = None,
        fecha: Optional[date] = None,
    ) -> Dict[str, Any]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            mat_info = self.get_material_stock_info(id_material)
            if not mat_info:
                raise ValueError(f"El material '{id_material}' no existe en el maestro.")
            if stock_planta_actual is not None:
                mat_info["stock_planta"] = stock_planta_actual
                if mat_info["deposito_en_planta"]:
                    mat_info["stock_total"] = stock_planta_actual
                else:
                    mat_info["stock_total"] = stock_planta_actual + mat_info["stock_cl2"]

            dep_en_planta = mat_info["deposito_en_planta"]
            ant_total = mat_info["stock_total"]
            user_id = id_usuario
            if not user_id:
                cursor.execute("SELECT TOP 1 id_usuario FROM dbo.usuario WHERE activo = 1 ORDER BY id_usuario ASC")
                u_row = cursor.fetchone()
                user_id = int(u_row[0]) if u_row else 2

            target_date = fecha or get_argentina_today()
            now_ba = get_argentina_now()

            target_cl2: Optional[float] = None
            if nuevo_stock_cl2 is not None:
                target_cl2 = float(nuevo_stock_cl2)
            elif nuevo_stock is not None and not dep_en_planta and nuevo_stock_planta is None:
                target_cl2 = float(nuevo_stock)

            if target_cl2 is not None:
                if dep_en_planta and target_cl2 > 0:
                    raise ValueError(
                        f"El material '{id_material}' pertenece a un proveedor con depósito exclusivo en planta. El stock en CL2 debe mantenerse en 0."
                    )
                ant_cl2 = mat_info["stock_cl2"]
                diff_cl2 = target_cl2 - ant_cl2
                if diff_cl2 != 0:
                    cursor.execute(
                        """
                        MERGE dbo.stock_deposito AS target
                        USING (SELECT ? AS id_material, ? AS stock_actual) AS source
                        ON (target.id_material = source.id_material)
                        WHEN MATCHED THEN
                            UPDATE SET stock_actual = source.stock_actual, fecha_actualizacion = SYSUTCDATETIME()
                        WHEN NOT MATCHED THEN
                            INSERT (id_material, stock_actual, stock_warehouse, fecha_actualizacion)
                            VALUES (source.id_material, source.stock_actual, 0.0, SYSUTCDATETIME());
                        """,
                        (id_material, target_cl2),
                    )
                    cursor.execute(
                        """
                        INSERT INTO dbo.movimiento_stock (
                            id_material, tipo, cantidad, stock_anterior, stock_posterior,
                            id_usuario, fecha, observacion
                        )
                        VALUES (?, ?, ?, ?, ?, ?, SYSUTCDATETIME(), ?);
                        """,
                        (
                            id_material,
                            "ajuste_manual",
                            abs(diff_cl2),
                            ant_cl2,
                            target_cl2,
                            user_id,
                            observacion or f"Ajuste manual de stock en CL2 de {ant_cl2} a {target_cl2}",
                        ),
                    )
                mat_info["stock_cl2"] = target_cl2

            target_planta: Optional[float] = None
            if nuevo_stock_planta is not None:
                target_planta = float(nuevo_stock_planta)
            elif nuevo_stock is not None and (dep_en_planta or nuevo_stock_cl2 is not None):
                target_planta = float(nuevo_stock)

            if target_planta is not None:
                ant_planta = mat_info["stock_planta"]
                diff_planta = target_planta - ant_planta
                if diff_planta != 0:
                    cursor.execute(
                        """
                        MERGE dbo.stock_deposito AS target
                        USING (SELECT ? AS id_material, ? AS stock_planta) AS source
                        ON (target.id_material = source.id_material)
                        WHEN MATCHED THEN
                            UPDATE SET stock_planta = source.stock_planta, fecha_actualizacion = SYSUTCDATETIME()
                        WHEN NOT MATCHED THEN
                            INSERT (id_material, stock_actual, stock_planta, stock_warehouse, fecha_actualizacion)
                            VALUES (source.id_material, 0.0, source.stock_planta, 0.0, SYSUTCDATETIME());
                        """,
                        (id_material, target_planta),
                    )

                    cursor.execute(
                        "SELECT id_parametro, id_proveedor FROM dbo.rundown_parametro_material WHERE id_material = ?",
                        (id_material,),
                    )
                    rpm_rows = cursor.fetchall()
                    for r in rpm_rows:
                        rpm_id = int(r[0])
                        p_id = int(r[1])
                        tipos_stock = ["planta", "total"] if dep_en_planta else ["planta"]
                        for t_stk in tipos_stock:
                            cursor.execute(
                                """
                                MERGE dbo.rundown_stock_ajuste AS target
                                USING (SELECT ? AS id_parametro, ? AS fecha, ? AS tipo_stock) AS source
                                ON (target.id_parametro = source.id_parametro AND target.fecha = source.fecha AND target.tipo_stock = source.tipo_stock)
                                WHEN MATCHED THEN
                                    UPDATE SET stock_ajustado = ?, observacion = ?, fecha_creacion = SYSUTCDATETIME()
                                WHEN NOT MATCHED THEN
                                    INSERT (id_parametro, id_proveedor, id_material, fecha, tipo_stock, stock_ajustado, observacion)
                                    VALUES (?, ?, ?, ?, ?, ?, ?);
                                """,
                                (
                                    rpm_id, target_date, t_stk,
                                    target_planta, observacion or "Ajuste manual desde Gestión de Stock",
                                    rpm_id, p_id, id_material, target_date, t_stk, target_planta, observacion or "Ajuste manual desde Gestión de Stock",
                                ),
                            )

                    cursor.execute(
                        """
                        INSERT INTO dbo.movimiento_stock (
                            id_material, tipo, cantidad, stock_anterior, stock_posterior,
                            id_usuario, fecha, observacion
                        )
                        VALUES (?, ?, ?, ?, ?, ?, SYSUTCDATETIME(), ?);
                        """,
                        (
                            id_material,
                            "ajuste_manual",
                            abs(diff_planta),
                            ant_planta,
                            target_planta,
                            user_id,
                            observacion or f"Ajuste manual de stock en Planta de {ant_planta} a {target_planta}",
                        ),
                    )
                mat_info["stock_planta"] = target_planta

            mat_info["stock_total"] = (
                mat_info["stock_planta"]
                if dep_en_planta
                else (mat_info["stock_planta"] + mat_info["stock_cl2"])
            )

            if target_planta is not None or target_cl2 is not None:
                cur_planta = mat_info["stock_planta"]
                cur_total = mat_info["stock_total"]

                cursor.execute(
                    "SELECT id_parametro, id_proveedor, fecha_stock_inicial FROM dbo.rundown_parametro_material WHERE id_material = ?",
                    (id_material,),
                )
                rpm_info = cursor.fetchall()
                for r in rpm_info:
                    rpm_id = int(r[0])
                    p_id = int(r[1])
                    cursor.execute(
                        """
                        MERGE dbo.rundown_stock_ajuste AS target
                        USING (SELECT ? AS id_parametro, ? AS fecha, 'total' AS tipo_stock) AS source
                        ON (target.id_parametro = source.id_parametro AND target.fecha = source.fecha AND target.tipo_stock = source.tipo_stock)
                        WHEN MATCHED THEN
                            UPDATE SET stock_ajustado = ?, observacion = ?, fecha_creacion = SYSUTCDATETIME()
                        WHEN NOT MATCHED THEN
                            INSERT (id_parametro, id_proveedor, id_material, fecha, tipo_stock, stock_ajustado, observacion)
                            VALUES (?, ?, ?, ?, 'total', ?, ?);
                        """,
                        (
                            rpm_id, target_date,
                            cur_total, observacion or "Ajuste manual desde Gestión de Stock",
                            rpm_id, p_id, id_material, target_date, cur_total, observacion or "Ajuste manual desde Gestión de Stock",
                        ),
                    )
                    if r[2] and r[2] == target_date:
                        cursor.execute(
                            """
                            UPDATE dbo.rundown_parametro_material
                            SET stock_inicial_planta = ?,
                                stock_inicial_total = ?,
                                stock_inicial_referencia = ?
                            WHERE id_parametro = ?
                            """,
                            (cur_planta, cur_total, cur_total, rpm_id),
                        )

            conn.commit()
            return {
                "id_material": id_material,
                "stock_anterior": ant_total,
                "stock_nuevo": mat_info["stock_total"],
                "stock_planta": mat_info["stock_planta"],
                "stock_cl2": mat_info["stock_cl2"],
                "stock_total": mat_info["stock_total"],
            }
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def get_movimientos_paginated(
        self,
        search: Optional[str] = None,
        tipo: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[Dict[str, Any]], int]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            where_clauses: List[str] = []
            params: List[Any] = []

            if search and search.strip():
                term = f"%{search.strip()}%"
                where_clauses.append("(ms.id_material LIKE ? OR m.nombre LIKE ? OR ms.observacion LIKE ?)")
                params.extend([term, term, term])

            if tipo and tipo.strip() and tipo != "all":
                where_clauses.append("ms.tipo = ?")
                params.append(tipo.strip())

            where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
            offset = max(0, (page - 1) * page_size)

            count_query = f"""
                SELECT COUNT(*)
                FROM dbo.movimiento_stock ms
                LEFT JOIN dbo.material m ON ms.id_material = m.id_material
                {where_str}
            """
            cursor.execute(count_query, params)
            total = int(cursor.fetchone()[0])

            data_query = f"""
                SELECT 
                    ms.id_movimiento,
                    ms.id_material,
                    m.nombre AS nombre_material,
                    m.unidad,
                    ms.tipo,
                    CAST(ms.cantidad AS FLOAT) AS cantidad,
                    CAST(ms.stock_anterior AS FLOAT) AS stock_anterior,
                    CAST(ms.stock_posterior AS FLOAT) AS stock_posterior,
                    ms.id_usuario,
                    COALESCE(u.nombre + ' ' + u.apellido, u.username, 'Usuario ' + CAST(ms.id_usuario AS VARCHAR)) AS nombre_usuario,
                    ms.fecha,
                    ms.observacion,
                    ms.id_pedido,
                    ms.id_remito
                FROM dbo.movimiento_stock ms
                LEFT JOIN dbo.material m ON ms.id_material = m.id_material
                LEFT JOIN dbo.usuario u ON ms.id_usuario = u.id_usuario
                {where_str}
                ORDER BY ms.fecha DESC, ms.id_movimiento DESC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
            """
            cursor.execute(data_query, (*params, offset, page_size))
            rows = cursor.fetchall()

            items = [
                {
                    "id_movimiento": int(r[0]),
                    "id_material": str(r[1]),
                    "nombre_material": str(r[2]) if r[2] else None,
                    "unidad": str(r[3] or "UN"),
                    "tipo": str(r[4]),
                    "cantidad": float(r[5]),
                    "stock_anterior": float(r[6]),
                    "stock_posterior": float(r[7]),
                    "id_usuario": int(r[8]),
                    "nombre_usuario": str(r[9]) if r[9] else None,
                    "fecha": r[10] if isinstance(r[10], datetime) else get_argentina_now(),
                    "observacion": str(r[11]) if r[11] else None,
                    "id_pedido": int(r[12]) if r[12] is not None else None,
                    "id_remito": str(r[13]) if r[13] else None,
                }
                for r in rows
            ]
            return items, total
        finally:
            cursor.close()
            conn.close()

    def get_materiales_configuracion_paginated(
        self,
        search: Optional[str] = None,
        id_proveedor: Optional[int] = None,
        tipo_empaque: Optional[str] = None,
        en_cl2: Optional[bool] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[Dict[str, Any]], int]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            where_clauses: List[str] = ["m.activo = 1", "ISNULL(m.categoria, '') <> 'CAJA_PEDIDO'"]
            params: List[Any] = []

            if search and search.strip():
                term = f"%{search.strip()}%"
                where_clauses.append("(m.id_material LIKE ? OR m.nombre LIKE ?)")
                params.extend([term, term])

            if id_proveedor and id_proveedor > 0:
                where_clauses.append("prov.id_proveedor = ?")
                params.append(id_proveedor)

            if tipo_empaque and tipo_empaque != "all":
                where_clauses.append("COALESCE(rpm.tipo_empaque, m.tipo_empaque, 'pallet') = ?")
                params.append(tipo_empaque)

            if en_cl2 is not None:
                where_clauses.append("COALESCE(rpm.en_cl2, m.en_cl2, 0) = ?")
                params.append(1 if en_cl2 else 0)

            where_str = " AND ".join(where_clauses)
            offset = max(0, (page - 1) * page_size)

            count_query = f"""
                SELECT COUNT(*)
                FROM dbo.material m
                OUTER APPLY (
                    SELECT TOP 1 
                        p.id_proveedor,
                        p.nombre,
                        ISNULL(p.deposito_en_planta, 0) AS deposito_en_planta,
                        p.doh_sugerido_planta
                    FROM (
                        SELECT id_proveedor_principal AS id_proveedor, 1 AS prioridad FROM dbo.material WHERE id_material = m.id_material AND id_proveedor_principal IS NOT NULL
                        UNION ALL
                        SELECT id_proveedor, 2 AS prioridad FROM dbo.rundown_parametro_material WHERE id_material = m.id_material AND activo = 1
                        UNION ALL
                        SELECT id_proveedor, 3 AS prioridad FROM dbo.proveedor_material WHERE id_material = m.id_material AND activo = 1
                    ) src
                    JOIN dbo.proveedor p ON src.id_proveedor = p.id_proveedor
                    ORDER BY src.prioridad ASC
                ) prov
                OUTER APPLY (
                    SELECT TOP 1 
                        rpm.id_parametro,
                        rpm.lote_mts,
                        rpm.unidad_por_bulto,
                        rpm.bultos_por_pallet,
                        rpm.tipo_empaque,
                        rpm.doh_sugerido_planta,
                        rpm.en_cl2
                    FROM dbo.rundown_parametro_material rpm
                    WHERE rpm.id_material = m.id_material AND rpm.activo = 1
                      AND (prov.id_proveedor IS NULL OR rpm.id_proveedor = prov.id_proveedor)
                    ORDER BY CASE WHEN rpm.id_proveedor = prov.id_proveedor THEN 0 ELSE 1 END, rpm.id_parametro DESC
                ) rpm
                WHERE {where_str}
            """
            cursor.execute(count_query, params)
            total = int(cursor.fetchone()[0])

            data_query = f"""
                SELECT 
                    m.id_material,
                    m.nombre,
                    m.unidad,
                    m.categoria,
                    prov.id_proveedor,
                    prov.nombre AS nombre_proveedor,
                    ISNULL(prov.deposito_en_planta, 0) AS deposito_en_planta,
                    COALESCE(rpm.tipo_empaque, m.tipo_empaque, 'pallet') AS tipo_empaque,
                    COALESCE(rpm.lote_mts, m.lote_minimo) AS lote_mts,
                    COALESCE(rpm.unidad_por_bulto, m.unidad_por_bulto) AS unidad_por_bulto,
                    COALESCE(rpm.bultos_por_pallet, m.bultos_por_pallet) AS bultos_por_pallet,
                    COALESCE(rpm.doh_sugerido_planta, prov.doh_sugerido_planta, 1.0) AS doh_sugerido_planta,
                    rpm.id_parametro,
                    COALESCE(rpm.en_cl2, m.en_cl2, 0) AS en_cl2
                FROM dbo.material m
                OUTER APPLY (
                    SELECT TOP 1 
                        p.id_proveedor,
                        p.nombre,
                        ISNULL(p.deposito_en_planta, 0) AS deposito_en_planta,
                        p.doh_sugerido_planta
                    FROM (
                        SELECT id_proveedor_principal AS id_proveedor, 1 AS prioridad FROM dbo.material WHERE id_material = m.id_material AND id_proveedor_principal IS NOT NULL
                        UNION ALL
                        SELECT id_proveedor, 2 AS prioridad FROM dbo.rundown_parametro_material WHERE id_material = m.id_material AND activo = 1
                        UNION ALL
                        SELECT id_proveedor, 3 AS prioridad FROM dbo.proveedor_material WHERE id_material = m.id_material AND activo = 1
                    ) src
                    JOIN dbo.proveedor p ON src.id_proveedor = p.id_proveedor
                    ORDER BY src.prioridad ASC
                ) prov
                OUTER APPLY (
                    SELECT TOP 1 
                        rpm.id_parametro,
                        rpm.lote_mts,
                        rpm.unidad_por_bulto,
                        rpm.bultos_por_pallet,
                        rpm.tipo_empaque,
                        rpm.doh_sugerido_planta,
                        rpm.en_cl2
                    FROM dbo.rundown_parametro_material rpm
                    WHERE rpm.id_material = m.id_material AND rpm.activo = 1
                      AND (prov.id_proveedor IS NULL OR rpm.id_proveedor = prov.id_proveedor)
                    ORDER BY CASE WHEN rpm.id_proveedor = prov.id_proveedor THEN 0 ELSE 1 END, rpm.id_parametro DESC
                ) rpm
                WHERE {where_str}
                ORDER BY m.id_material ASC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
            """
            cursor.execute(data_query, (*params, offset, page_size))
            rows = cursor.fetchall()

            items = [
                {
                    "id_material": str(r[0]),
                    "nombre": str(r[1]),
                    "unidad": str(r[2] or "UN"),
                    "categoria": str(r[3]) if r[3] else None,
                    "id_proveedor": int(r[4]) if r[4] is not None else None,
                    "nombre_proveedor": str(r[5]) if r[5] else None,
                    "deposito_en_planta": bool(r[6]),
                    "tipo_empaque": str(r[7] or "pallet"),
                    "lote_mts": float(r[8]) if r[8] is not None else None,
                    "unidad_por_bulto": float(r[9]) if r[9] is not None else None,
                    "bultos_por_pallet": int(r[10]) if r[10] is not None else None,
                    "doh_sugerido_planta": float(r[11] if r[11] is not None else 1.0),
                    "id_parametro": int(r[12]) if r[12] is not None else None,
                    "activo": True,
                    "en_cl2": bool(r[13]) if len(r) > 13 else True,
                }
                for r in rows
            ]
            return items, total
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def _codigo_desde_nombre(nombre: str, usados: set) -> str:
        sin_acentos = unicodedata.normalize("NFKD", nombre.upper()).encode("ascii", "ignore").decode("ascii")
        base = "".join(c for c in sin_acentos if c.isalnum())[:30] or "PROV"
        codigo = base
        sufijo = 2
        while codigo in usados:
            extra = f"-{sufijo}"
            codigo = f"{base[:30 - len(extra)]}{extra}"
            sufijo += 1
        return codigo

    def asignar_proveedores_masivo(
        self, pares: List[Tuple[int, str, str]]
    ) -> Tuple[int, int, List[str], List[str]]:
        conn: pyodbc.Connection = self._get_connection()
        conn.autocommit = False
        cursor = conn.cursor()
        asignados = 0
        sin_cambios = 0
        errores: List[str] = []
        creados: List[str] = []
        columnas_copia = (
            "descripcion, unidad, lote_mts, scrap_porcentaje, factor_conversion, categoria_cabina, "
            "stock_inicial_referencia, fecha_stock_inicial, stock_inicial_planta, stock_inicial_total, "
            "doh_sugerido_planta, tipo_empaque, unidad_por_bulto, bultos_por_pallet, en_cl2"
        )
        try:
            cursor.execute(
                "SELECT id_proveedor, UPPER(LTRIM(RTRIM(ISNULL(codigo_proveedor, '')))), UPPER(LTRIM(RTRIM(nombre))), activo FROM dbo.proveedor"
            )
            proveedores_por_clave: Dict[str, Tuple[int, bool]] = {}
            codigos_usados: set = set()
            for id_p, codigo, nombre, activo in cursor.fetchall():
                proveedores_por_clave[nombre] = (int(id_p), bool(activo))
                if codigo:
                    codigos_usados.add(codigo)
                    proveedores_por_clave.setdefault(codigo, (int(id_p), bool(activo)))

            cursor.execute("SELECT TOP 1 id_version FROM dbo.bom_version WHERE es_vigente = 1")
            fila_version = cursor.fetchone()
            id_version_vigente = int(fila_version[0]) if fila_version else None

            for fila, id_material, clave_proveedor in pares:
                proveedor = proveedores_por_clave.get(clave_proveedor)
                if proveedor is None:
                    codigo_nuevo = self._codigo_desde_nombre(clave_proveedor, codigos_usados)
                    cursor.execute(
                        """
                        INSERT INTO dbo.proveedor (codigo_proveedor, nombre, activo)
                        OUTPUT INSERTED.id_proveedor
                        VALUES (?, ?, 1)
                        """,
                        (codigo_nuevo, clave_proveedor[:100]),
                    )
                    proveedor = (int(cursor.fetchone()[0]), True)
                    proveedores_por_clave[clave_proveedor] = proveedor
                    codigos_usados.add(codigo_nuevo)
                    creados.append(f"{clave_proveedor} (código {codigo_nuevo})")
                id_proveedor, proveedor_activo = proveedor
                if not proveedor_activo:
                    errores.append(f"Fila {fila}: el proveedor '{clave_proveedor}' está inactivo.")
                    continue
                cursor.execute(
                    "SELECT nombre, unidad, lote_minimo, tipo_empaque, en_cl2 FROM dbo.material WHERE id_material = ?",
                    (id_material,),
                )
                material = cursor.fetchone()
                if material is None:
                    errores.append(f"Fila {fila}: el material '{id_material}' no existe.")
                    continue

                cursor.execute(
                    """
                    SELECT id_parametro, id_proveedor, activo
                    FROM dbo.rundown_parametro_material WITH (UPDLOCK, HOLDLOCK)
                    WHERE id_material = ?
                    """,
                    (id_material,),
                )
                parametros = [(int(r[0]), int(r[1]), bool(r[2])) for r in cursor.fetchall()]
                activos_otro = [pid for pid, prov, act in parametros if act and prov != id_proveedor]
                propio = next((pid for pid, prov, _ in parametros if prov == id_proveedor), None)
                propio_activo = any(prov == id_proveedor and act for _, prov, act in parametros)

                if propio_activo and not activos_otro:
                    sin_cambios += 1
                else:
                    origen = activos_otro[0] if activos_otro else None
                    if propio is not None:
                        cursor.execute("UPDATE dbo.rundown_parametro_material SET activo = 1 WHERE id_parametro = ?", (propio,))
                    elif origen is not None:
                        cursor.execute(
                            f"""
                            INSERT INTO dbo.rundown_parametro_material (id_proveedor, id_material, {columnas_copia}, activo)
                            OUTPUT INSERTED.id_parametro
                            SELECT ?, id_material, {columnas_copia}, 1
                            FROM dbo.rundown_parametro_material WHERE id_parametro = ?
                            """,
                            (id_proveedor, origen),
                        )
                        propio = int(cursor.fetchone()[0])
                    else:
                        cursor.execute(
                            """
                            INSERT INTO dbo.rundown_parametro_material (
                                id_proveedor, id_material, descripcion, unidad, lote_mts, tipo_empaque, en_cl2, activo
                            )
                            OUTPUT INSERTED.id_parametro
                            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                            """,
                            (
                                id_proveedor, id_material, str(material[0] or id_material)[:150],
                                str(material[1] or "UN")[:10], material[2], str(material[3] or "pallet"), material[4],
                            ),
                        )
                        propio = int(cursor.fetchone()[0])

                    cursor.execute(
                        "UPDATE dbo.rundown_parametro_material SET activo = 0 WHERE id_material = ? AND id_parametro <> ?",
                        (id_material, propio),
                    )
                    if origen is not None:
                        cursor.execute(
                            """
                            INSERT INTO dbo.rundown_parametro_producto (id_parametro, id_producto, factor_uso)
                            SELECT ?, rpp.id_producto, rpp.factor_uso
                            FROM dbo.rundown_parametro_producto rpp
                            WHERE rpp.id_parametro = ?
                              AND NOT EXISTS (
                                  SELECT 1 FROM dbo.rundown_parametro_producto x
                                  WHERE x.id_parametro = ? AND x.id_producto = rpp.id_producto
                              )
                            """,
                            (propio, origen, propio),
                        )
                    if id_version_vigente is not None:
                        cursor.execute(
                            """
                            INSERT INTO dbo.rundown_parametro_producto (id_parametro, id_producto, factor_uso)
                            SELECT ?, e.id_producto_raiz, e.factor_consumo_total
                            FROM dbo.bom_explosion_plana e
                            WHERE e.id_version = ? AND e.id_material_insumo = ?
                              AND NOT EXISTS (
                                  SELECT 1 FROM dbo.rundown_parametro_producto x
                                  WHERE x.id_parametro = ? AND x.id_producto = e.id_producto_raiz
                              )
                            """,
                            (propio, id_version_vigente, id_material, propio),
                        )
                    asignados += 1

                cursor.execute(
                    "UPDATE dbo.material SET id_proveedor_principal = ? WHERE id_material = ?",
                    (id_proveedor, id_material),
                )
                cursor.execute(
                    """
                    MERGE dbo.proveedor_material AS target
                    USING (SELECT ? AS id_proveedor, ? AS id_material) AS source
                    ON (target.id_proveedor = source.id_proveedor AND target.id_material = source.id_material)
                    WHEN MATCHED THEN UPDATE SET activo = 1
                    WHEN NOT MATCHED THEN INSERT (id_proveedor, id_material, activo) VALUES (source.id_proveedor, source.id_material, 1);
                    """,
                    (id_proveedor, id_material),
                )
                cursor.execute(
                    "UPDATE dbo.proveedor_material SET activo = 0 WHERE id_material = ? AND id_proveedor <> ?",
                    (id_material, id_proveedor),
                )

            conn.commit()
            return asignados, sin_cambios, errores, creados
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def update_material_configuracion(
        self,
        id_material: str,
        id_proveedor: Optional[int],
        deposito_en_planta: bool,
        tipo_empaque: str,
        lote_mts: Optional[float],
        unidad_por_bulto: Optional[float],
        bultos_por_pallet: Optional[int],
        doh_sugerido_planta: float,
        unidad: Optional[str] = None,
        en_cl2: Optional[bool] = None,
    ) -> None:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cl2_val = 1 if en_cl2 is True else (0 if en_cl2 is False else None)
            # 1. Update dbo.material
            cursor.execute(
                """
                UPDATE dbo.material
                SET id_proveedor_principal = ?,
                    tipo_empaque = ?,
                    lote_minimo = ?,
                    unidad_por_bulto = ?,
                    bultos_por_pallet = ?,
                    unidad = COALESCE(?, unidad),
                    en_cl2 = COALESCE(?, en_cl2)
                WHERE id_material = ?
                """,
                (id_proveedor, tipo_empaque, lote_mts, unidad_por_bulto, bultos_por_pallet, unidad, cl2_val, id_material),
            )

            # 2. Update/Insert into dbo.proveedor_material if id_proveedor is valid
            if id_proveedor and id_proveedor > 0:
                cursor.execute(
                    """
                    MERGE dbo.proveedor_material AS target
                    USING (SELECT ? AS id_proveedor, ? AS id_material) AS source
                    ON (target.id_proveedor = source.id_proveedor AND target.id_material = source.id_material)
                    WHEN MATCHED THEN
                        UPDATE SET activo = 1
                    WHEN NOT MATCHED THEN
                        INSERT (id_proveedor, id_material, activo)
                        VALUES (?, ?, 1);
                    """,
                    (id_proveedor, id_material, id_proveedor, id_material),
                )
                cursor.execute(
                    """
                    UPDATE dbo.proveedor_material
                    SET activo = 0
                    WHERE id_material = ? AND id_proveedor != ?
                    """,
                    (id_material, id_proveedor),
                )

                # 3. Update or Insert into dbo.rundown_parametro_material scoped by id_proveedor
                cursor.execute(
                    """
                    MERGE dbo.rundown_parametro_material AS target
                    USING (SELECT ? AS id_proveedor, ? AS id_material) AS source
                    ON (target.id_proveedor = source.id_proveedor AND target.id_material = source.id_material)
                    WHEN MATCHED THEN
                        UPDATE SET tipo_empaque = ?,
                                   lote_mts = ?,
                                   unidad_por_bulto = ?,
                                   bultos_por_pallet = ?,
                                   doh_sugerido_planta = ?,
                                   unidad = COALESCE(?, unidad),
                                   en_cl2 = COALESCE(?, en_cl2),
                                   activo = 1
                    WHEN NOT MATCHED THEN
                        INSERT (id_proveedor, id_material, tipo_empaque, lote_mts, unidad_por_bulto, bultos_por_pallet, doh_sugerido_planta, unidad, en_cl2, activo)
                        VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, 'UN'), COALESCE(?, 0), 1);
                    """,
                    (
                        id_proveedor, id_material,
                        tipo_empaque, lote_mts, unidad_por_bulto, bultos_por_pallet, doh_sugerido_planta, unidad, cl2_val,
                        id_proveedor, id_material, tipo_empaque, lote_mts, unidad_por_bulto, bultos_por_pallet, doh_sugerido_planta, unidad, cl2_val,
                    ),
                )
                cursor.execute(
                    """
                    UPDATE dbo.rundown_parametro_material
                    SET activo = 0
                    WHERE id_material = ? AND id_proveedor != ?
                    """,
                    (id_material, id_proveedor),
                )
            else:
                cursor.execute(
                    """
                    UPDATE dbo.proveedor_material
                    SET activo = 0
                    WHERE id_material = ?
                    """,
                    (id_material,),
                )
                cursor.execute(
                    """
                    UPDATE dbo.rundown_parametro_material
                    SET tipo_empaque = ?,
                        lote_mts = ?,
                        unidad_por_bulto = ?,
                        bultos_por_pallet = ?,
                        doh_sugerido_planta = ?,
                        unidad = COALESCE(?, unidad),
                        en_cl2 = COALESCE(?, en_cl2)
                    WHERE id_material = ?
                    """,
                    (tipo_empaque, lote_mts, unidad_por_bulto, bultos_por_pallet, doh_sugerido_planta, unidad, cl2_val, id_material),
                )
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    def _ensure_caja_tables(self, cursor: Any) -> None:
        cursor.execute("SELECT COL_LENGTH('dbo.material', 'id_material')")
        largo_material = int(cursor.fetchone()[0] or 50)
        cursor.execute(
            f"""
            IF OBJECT_ID('dbo.caja_pedido', 'U') IS NULL
            BEGIN
                CREATE TABLE dbo.caja_pedido (
                    id_caja INT IDENTITY(1,1) PRIMARY KEY,
                    codigo_caja VARCHAR(50) NOT NULL UNIQUE,
                    nombre VARCHAR(150) NOT NULL,
                    activo BIT NOT NULL DEFAULT 1,
                    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME()
                );
            END;
            IF OBJECT_ID('dbo.caja_pedido_item', 'U') IS NULL
            BEGIN
                CREATE TABLE dbo.caja_pedido_item (
                    id_caja_item INT IDENTITY(1,1) PRIMARY KEY,
                    id_caja INT NOT NULL REFERENCES dbo.caja_pedido(id_caja) ON DELETE CASCADE,
                    id_material VARCHAR({largo_material}) NOT NULL REFERENCES dbo.material(id_material),
                    cantidad DECIMAL(18,4) NOT NULL
                );
            END;
            """
        )

    def get_cajas_pedido(self) -> List[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            self._ensure_caja_tables(cursor)
            conn.commit()
            cursor.execute(
                """
                SELECT cp.id_caja, cp.codigo_caja, cp.nombre, cp.activo,
                       cpi.id_material, m.nombre AS nombre_material, ISNULL(m.unidad, 'UN') AS unidad,
                       CAST(cpi.cantidad AS FLOAT) AS cantidad
                FROM dbo.caja_pedido cp
                LEFT JOIN dbo.caja_pedido_item cpi ON cp.id_caja = cpi.id_caja
                LEFT JOIN dbo.material m ON cpi.id_material = m.id_material
                WHERE cp.activo = 1
                ORDER BY cp.nombre ASC, cpi.id_caja_item ASC
                """
            )
            cajas_map: Dict[int, Dict[str, Any]] = {}
            for r in cursor.fetchall():
                id_caja = int(r[0])
                if id_caja not in cajas_map:
                    cajas_map[id_caja] = {
                        "id_caja": id_caja,
                        "codigo_caja": str(r[1]),
                        "nombre": str(r[2]),
                        "activo": bool(r[3]),
                        "items": [],
                    }
                if r[4]:
                    cajas_map[id_caja]["items"].append({
                        "id_material": str(r[4]),
                        "nombre_material": str(r[5] or r[4]),
                        "unidad": str(r[6] or "UN"),
                        "cantidad": float(r[7] or 0.0),
                    })
            return list(cajas_map.values())
        finally:
            cursor.close()
            conn.close()

    def create_caja_pedido(
        self,
        nombre: str,
        items: List[Dict[str, Any]],
        codigo_caja: Optional[str] = None,
    ) -> Dict[str, Any]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            self._ensure_caja_tables(cursor)
            clean_nombre = nombre.strip()
            if codigo_caja and codigo_caja.strip():
                clean_code = codigo_caja.strip().upper()[:50]
            else:
                slug = "".join(ch if ch.isalnum() else "-" for ch in clean_nombre.upper()).strip("-")
                while "--" in slug:
                    slug = slug.replace("--", "-")
                clean_code = slug if slug.startswith("CAJA") else f"CAJA-{slug}"
                clean_code = clean_code[:50]

            cursor.execute(
                "SELECT id_caja, activo FROM dbo.caja_pedido WHERE codigo_caja = ?",
                (clean_code,),
            )
            existing = cursor.fetchone()
            if existing and bool(existing[1]):
                raise ValueError(f"Ya existe una caja activa con el código '{clean_code}'")

            cursor.execute(
                """
                MERGE dbo.material AS target
                USING (SELECT ? AS id_material, ? AS nombre) AS source
                ON (target.id_material = source.id_material)
                WHEN MATCHED THEN
                    UPDATE SET nombre = source.nombre,
                               unidad = 'CAJA',
                               categoria = 'CAJA_PEDIDO',
                               tipo_empaque = 'caja',
                               activo = 1,
                               en_cl2 = 1
                WHEN NOT MATCHED THEN
                    INSERT (id_material, nombre, unidad, categoria, controla_stock, activo, tipo_empaque, en_cl2)
                    VALUES (source.id_material, source.nombre, 'CAJA', 'CAJA_PEDIDO', 0, 1, 'caja', 1);
                """,
                (clean_code, clean_nombre),
            )

            if existing:
                id_caja = int(existing[0])
                cursor.execute(
                    "UPDATE dbo.caja_pedido SET nombre = ?, activo = 1 WHERE id_caja = ?",
                    (clean_nombre, id_caja),
                )
                cursor.execute("DELETE FROM dbo.caja_pedido_item WHERE id_caja = ?", (id_caja,))
            else:
                cursor.execute(
                    """
                    INSERT INTO dbo.caja_pedido (codigo_caja, nombre, activo)
                    OUTPUT INSERTED.id_caja
                    VALUES (?, ?, 1)
                    """,
                    (clean_code, clean_nombre),
                )
                id_caja = int(cursor.fetchone()[0])

            merged_items: Dict[str, float] = {}
            for it in items:
                mat_id = str(it["id_material"]).strip()
                cant = float(it["cantidad"])
                if mat_id and cant > 0:
                    merged_items[mat_id] = round(merged_items.get(mat_id, 0.0) + cant, 4)

            for mat_id, cant in merged_items.items():
                cursor.execute(
                    "INSERT INTO dbo.caja_pedido_item (id_caja, id_material, cantidad) VALUES (?, ?, ?)",
                    (id_caja, mat_id, cant),
                )

            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

        all_cajas = self.get_cajas_pedido()
        for c in all_cajas:
            if c["id_caja"] == id_caja:
                return c
        return {
            "id_caja": id_caja,
            "codigo_caja": clean_code,
            "nombre": clean_nombre,
            "activo": True,
            "items": [],
        }

    def update_caja_pedido(
        self,
        id_caja: int,
        nombre: str,
        items: List[Dict[str, Any]],
        codigo_caja: Optional[str] = None,
    ) -> Dict[str, Any]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            self._ensure_caja_tables(cursor)
            cursor.execute("SELECT codigo_caja FROM dbo.caja_pedido WHERE id_caja = ?", (id_caja,))
            row = cursor.fetchone()
            if not row:
                raise ValueError(f"Caja #{id_caja} no encontrada")
            current_code = str(row[0])
            clean_nombre = nombre.strip()

            cursor.execute(
                "UPDATE dbo.caja_pedido SET nombre = ?, activo = 1 WHERE id_caja = ?",
                (clean_nombre, id_caja),
            )
            cursor.execute(
                """
                UPDATE dbo.material
                SET nombre = ?, unidad = 'CAJA', categoria = 'CAJA_PEDIDO', tipo_empaque = 'caja', activo = 1, en_cl2 = 1
                WHERE id_material = ?
                """,
                (clean_nombre, current_code),
            )

            cursor.execute("DELETE FROM dbo.caja_pedido_item WHERE id_caja = ?", (id_caja,))
            merged_items: Dict[str, float] = {}
            for it in items:
                mat_id = str(it["id_material"]).strip()
                cant = float(it["cantidad"])
                if mat_id and cant > 0:
                    merged_items[mat_id] = round(merged_items.get(mat_id, 0.0) + cant, 4)

            for mat_id, cant in merged_items.items():
                cursor.execute(
                    "INSERT INTO dbo.caja_pedido_item (id_caja, id_material, cantidad) VALUES (?, ?, ?)",
                    (id_caja, mat_id, cant),
                )

            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

        all_cajas = self.get_cajas_pedido()
        for c in all_cajas:
            if c["id_caja"] == id_caja:
                return c
        raise ValueError(f"Caja #{id_caja} no encontrada")

    def delete_caja_pedido(self, id_caja: int) -> None:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            self._ensure_caja_tables(cursor)
            cursor.execute("SELECT codigo_caja FROM dbo.caja_pedido WHERE id_caja = ?", (id_caja,))
            row = cursor.fetchone()
            if not row:
                raise ValueError(f"Caja #{id_caja} no encontrada")
            code = str(row[0])
            cursor.execute("UPDATE dbo.caja_pedido SET activo = 0 WHERE id_caja = ?", (id_caja,))
            cursor.execute("UPDATE dbo.material SET activo = 0 WHERE id_material = ?", (code,))
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

