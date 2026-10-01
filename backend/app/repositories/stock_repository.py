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
            where_clauses: List[str] = ["m.activo = 1"]
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
                        "(ISNULL(sd.stock_actual, 0.0) + ISNULL(latest_adj.stock_ajustado, ISNULL(rpm.stock_inicial_planta, 0.0))) > 0"
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
                    WHERE rsa.id_material = m.id_material
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
                    CAST(ISNULL(latest_adj.stock_ajustado, ISNULL(rpm.stock_inicial_planta, 0.0)) AS FLOAT) AS stock_planta,
                    CASE 
                        WHEN prov.deposito_en_planta = 1 THEN CAST(ISNULL(latest_adj.stock_ajustado, ISNULL(rpm.stock_inicial_planta, 0.0)) AS FLOAT)
                        ELSE CAST(ISNULL(sd.stock_actual, 0.0) + ISNULL(latest_adj.stock_ajustado, ISNULL(rpm.stock_inicial_planta, 0.0)) AS FLOAT)
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
                    WHERE rsa.id_material = m.id_material
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
                    CAST(ISNULL(latest_adj.stock_ajustado, ISNULL(rpm.stock_inicial_planta, 0.0)) AS FLOAT) AS stock_planta,
                    CASE 
                        WHEN prov.deposito_en_planta = 1 THEN CAST(ISNULL(latest_adj.stock_ajustado, ISNULL(rpm.stock_inicial_planta, 0.0)) AS FLOAT)
                        ELSE CAST(ISNULL(sd.stock_actual, 0.0) + ISNULL(latest_adj.stock_ajustado, ISNULL(rpm.stock_inicial_planta, 0.0)) AS FLOAT)
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
            where_clauses: List[str] = ["m.activo = 1"]
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
