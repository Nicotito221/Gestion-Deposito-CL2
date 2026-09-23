from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple
import pyodbc

from app.core.config import get_db_connection
from app.core.time import get_argentina_now


class ConteoRepository:
    def _get_connection(self) -> pyodbc.Connection:
        return get_db_connection()

    def search_materiales_para_conteo(
        self,
        search: Optional[str] = None,
        id_proveedor: Optional[int] = None,
        target_date: Optional[date] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            where_clauses = ["m.activo = 1"]
            params: List[Any] = []

            if target_date:
                t_date = target_date
            else:
                t_date = get_argentina_now().date()

            if search and search.strip():
                term = f"%{search.strip()}%"
                where_clauses.append("(m.id_material LIKE ? OR m.nombre LIKE ?)")
                params.extend([term, term])

            if id_proveedor and id_proveedor > 0:
                where_clauses.append("prov.id_proveedor = ?")
                params.append(id_proveedor)

            where_str = " AND ".join(where_clauses)

            query = f"""
                SELECT TOP (?)
                    m.id_material,
                    m.nombre,
                    ISNULL(m.unidad, 'UN') AS unidad,
                    prov.id_proveedor,
                    prov.nombre AS nombre_proveedor,
                    ISNULL(prov.deposito_en_planta, 0) AS deposito_en_planta,
                    CAST(ISNULL(exact_adj.stock_ajustado, ISNULL(prior_adj.stock_ajustado, ISNULL(rpm.stock_inicial_planta, 0.0))) AS FLOAT) AS stock_teorico
                FROM dbo.material m
                OUTER APPLY (
                    SELECT TOP 1 
                        CAST(rsa.stock_ajustado AS FLOAT) AS stock_ajustado
                    FROM dbo.rundown_stock_ajuste rsa
                    WHERE rsa.id_material = m.id_material AND rsa.fecha = ? AND rsa.tipo_stock = 'planta'
                    ORDER BY rsa.fecha_creacion DESC
                ) exact_adj
                OUTER APPLY (
                    SELECT TOP 1 
                        CAST(rsa2.stock_ajustado AS FLOAT) AS stock_ajustado
                    FROM dbo.rundown_stock_ajuste rsa2
                    WHERE rsa2.id_material = m.id_material AND rsa2.fecha <= ? AND rsa2.tipo_stock = 'planta'
                    ORDER BY rsa2.fecha DESC, rsa2.fecha_creacion DESC
                ) prior_adj
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
                ORDER BY m.id_material ASC
            """

            full_params = [limit, t_date, t_date, *params]
            cursor.execute(query, full_params)
            rows = cursor.fetchall()

            return [
                {
                    "id_material": str(r[0]),
                    "nombre": str(r[1]),
                    "unidad": str(r[2]),
                    "id_proveedor": int(r[3]) if r[3] is not None else None,
                    "nombre_proveedor": str(r[4]) if r[4] else None,
                    "deposito_en_planta": bool(r[5]),
                    "stock_teorico": float(r[6]),
                }
                for r in rows
            ]
        finally:
            cursor.close()
            conn.close()

    def get_material_for_conteo(self, id_material: str, target_date: date) -> Optional[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            query = """
                SELECT 
                    m.id_material,
                    m.nombre,
                    ISNULL(m.unidad, 'UN') AS unidad,
                    prov.id_proveedor,
                    prov.nombre AS nombre_proveedor,
                    ISNULL(prov.deposito_en_planta, 0) AS deposito_en_planta,
                    CAST(ISNULL(exact_adj.stock_ajustado, ISNULL(prior_adj.stock_ajustado, ISNULL(rpm.stock_inicial_planta, 0.0))) AS FLOAT) AS stock_teorico
                FROM dbo.material m
                OUTER APPLY (
                    SELECT TOP 1 
                        CAST(rsa.stock_ajustado AS FLOAT) AS stock_ajustado
                    FROM dbo.rundown_stock_ajuste rsa
                    WHERE rsa.id_material = m.id_material AND rsa.fecha = ? AND rsa.tipo_stock = 'planta'
                    ORDER BY rsa.fecha_creacion DESC
                ) exact_adj
                OUTER APPLY (
                    SELECT TOP 1 
                        CAST(rsa2.stock_ajustado AS FLOAT) AS stock_ajustado
                    FROM dbo.rundown_stock_ajuste rsa2
                    WHERE rsa2.id_material = m.id_material AND rsa2.fecha <= ? AND rsa2.tipo_stock = 'planta'
                    ORDER BY rsa2.fecha DESC, rsa2.fecha_creacion DESC
                ) prior_adj
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
                WHERE m.id_material = ?
            """
            cursor.execute(query, (target_date, target_date, id_material))
            r = cursor.fetchone()
            if not r:
                return None
            return {
                "id_material": str(r[0]),
                "nombre": str(r[1]),
                "unidad": str(r[2]),
                "id_proveedor": int(r[3]) if r[3] is not None else None,
                "nombre_proveedor": str(r[4]) if r[4] else None,
                "deposito_en_planta": bool(r[5]),
                "stock_teorico": float(r[6]),
            }
        finally:
            cursor.close()
            conn.close()

    def crear_conteo_con_sincronizacion(
        self,
        target_date: date,
        items: List[Dict[str, Any]],
        id_usuario: int,
        observacion: Optional[str] = None,
        fecha_inicio: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        now_ba = get_argentina_now()
        start_time = fecha_inicio or now_ba

        try:

            cursor.execute(
                """
                INSERT INTO dbo.conteo (
                    tipo, id_usuario, estado, fecha_impacto, fecha_inicio, fecha_finalizacion, observacion
                )
                OUTPUT INSERTED.id_conteo
                VALUES ('planta', ?, 'finalizado', ?, ?, ?, ?);
                """,
                (
                    id_usuario,
                    target_date,
                    start_time,
                    now_ba,
                    observacion or f"Conteo físico de planta cierre {target_date.strftime('%Y-%m-%d')}",
                ),
            )
            conteo_row = cursor.fetchone()
            if not conteo_row:
                raise ValueError("No se pudo registrar la cabecera del conteo")
            id_conteo = int(conteo_row[0])

            detalle_result: List[Dict[str, Any]] = []

            for item in items:
                mat_id = item["id_material"]
                stock_contado = float(item["stock_contado"])
                obs_item = item.get("observacion")

                cursor.execute(
                    """
                    SELECT 
                        m.nombre,
                        ISNULL(m.unidad, 'UN') AS unidad,
                        prov.id_proveedor,
                        prov.nombre AS nombre_proveedor,
                        ISNULL(prov.deposito_en_planta, 0) AS deposito_en_planta,
                        CAST(ISNULL(exact_adj.stock_ajustado, ISNULL(prior_adj.stock_ajustado, ISNULL(rpm.stock_inicial_planta, 0.0))) AS FLOAT) AS stock_teorico
                    FROM dbo.material m
                    OUTER APPLY (
                        SELECT TOP 1 
                            CAST(rsa.stock_ajustado AS FLOAT) AS stock_ajustado
                        FROM dbo.rundown_stock_ajuste rsa
                        WHERE rsa.id_material = m.id_material AND rsa.fecha = ? AND rsa.tipo_stock = 'planta'
                        ORDER BY rsa.fecha_creacion DESC
                    ) exact_adj
                    OUTER APPLY (
                        SELECT TOP 1 
                            CAST(rsa2.stock_ajustado AS FLOAT) AS stock_ajustado
                        FROM dbo.rundown_stock_ajuste rsa2
                        WHERE rsa2.id_material = m.id_material AND rsa2.fecha <= ? AND rsa2.tipo_stock = 'planta'
                        ORDER BY rsa2.fecha DESC, rsa2.fecha_creacion DESC
                    ) prior_adj
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
                    WHERE m.id_material = ?
                    """,
                    (target_date, target_date, mat_id),
                )
                m_row = cursor.fetchone()
                if not m_row:
                    continue

                nombre_mat = str(m_row[0])
                unidad_mat = str(m_row[1])
                prov_id = int(m_row[2]) if m_row[2] is not None else None
                nombre_prov = str(m_row[3]) if m_row[3] else None
                es_dep_planta = bool(m_row[4])
                stock_teorico = (
                    float(item["stock_teorico"])
                    if "stock_teorico" in item and item["stock_teorico"] is not None
                    else float(m_row[5])
                )
                desvio = stock_contado - stock_teorico

                cursor.execute(
                    """
                    INSERT INTO dbo.material_conteo (
                        id_conteo, id_material, stock_teorico, stock_contado, desvio, observacion
                    )
                    VALUES (?, ?, ?, ?, ?, ?);
                    """,
                    (id_conteo, mat_id, stock_teorico, stock_contado, desvio, obs_item),
                )

                cursor.execute(
                    "SELECT id_parametro, id_proveedor FROM dbo.rundown_parametro_material WHERE id_material = ?",
                    (mat_id,),
                )
                rpm_rows = cursor.fetchall()
                for r in rpm_rows:
                    rpm_id = int(r[0])
                    p_id = int(r[1])
                    tipos_stock = ["planta", "total"] if es_dep_planta else ["planta"]
                    for t_stk in tipos_stock:
                        cursor.execute(
                            """
                            MERGE dbo.rundown_stock_ajuste AS target
                            USING (SELECT ? AS id_parametro, ? AS fecha, ? AS tipo_stock) AS source
                            ON (target.id_parametro = source.id_parametro AND target.fecha = source.fecha AND target.tipo_stock = source.tipo_stock)
                            WHEN MATCHED THEN
                                UPDATE SET stock_ajustado = ?, observacion = ?, fecha_creacion = ?
                            WHEN NOT MATCHED THEN
                                INSERT (id_parametro, id_proveedor, id_material, fecha, tipo_stock, stock_ajustado, observacion, fecha_creacion)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                            """,
                            (
                                rpm_id, target_date, t_stk,
                                stock_contado, f"Conteo #{id_conteo} (desvío: {desvio:+0.1f})", now_ba,
                                rpm_id, p_id, mat_id, target_date, t_stk, stock_contado, f"Conteo #{id_conteo} (desvío: {desvio:+0.1f})", now_ba,
                            ),
                        )

                if desvio != 0:
                    cursor.execute(
                        """
                        INSERT INTO dbo.movimiento_stock (
                            id_material, tipo, cantidad, stock_anterior, stock_posterior,
                            id_usuario, fecha, observacion
                        )
                        VALUES (?, 'ajuste_manual', ?, ?, ?, ?, ?, ?);
                        """,
                        (
                            mat_id,
                            abs(desvio),
                            stock_teorico,
                            stock_contado,
                            id_usuario,
                            now_ba,
                            f"Conteo de planta #{id_conteo} fecha {target_date.strftime('%Y-%m-%d')} (desvío: {desvio:+0.1f})",
                        ),
                    )

                detalle_result.append(
                    {
                        "id_conteo": id_conteo,
                        "id_material": mat_id,
                        "nombre_material": nombre_mat,
                        "unidad": unidad_mat,
                        "nombre_proveedor": nombre_prov,
                        "stock_teorico": stock_teorico,
                        "stock_contado": stock_contado,
                        "desvio": desvio,
                        "observacion": obs_item,
                    }
                )

            conn.commit()

            cursor.execute("SELECT nombre, apellido FROM dbo.usuario WHERE id_usuario = ?", (id_usuario,))
            u_row = cursor.fetchone()
            nombre_u = f"{u_row[0]} {u_row[1]}".strip() if u_row else f"Usuario #{id_usuario}"

            return {
                "id_conteo": id_conteo,
                "tipo": "planta",
                "id_usuario": id_usuario,
                "nombre_usuario": nombre_u,
                "estado": "finalizado",
                "fecha_impacto": target_date,
                "fecha_inicio": start_time,
                "fecha_finalizacion": now_ba,
                "observacion": observacion,
                "total_items": len(detalle_result),
                "items": detalle_result,
            }
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def get_historico_conteos(self, limit: int = 20, offset: int = 0) -> Tuple[List[Dict[str, Any]], int]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            count_q = "SELECT COUNT(*) FROM dbo.conteo WHERE tipo = 'planta'"
            cursor.execute(count_q)
            total = int(cursor.fetchone()[0])

            data_q = """
                SELECT 
                    c.id_conteo,
                    c.tipo,
                    c.id_usuario,
                    CONCAT(u.nombre, ' ', u.apellido) AS nombre_usuario,
                    c.estado,
                    c.fecha_impacto,
                    c.fecha_inicio,
                    c.fecha_finalizacion,
                    c.observacion,
                    ISNULL(items_agg.total_items, 0) AS total_items,
                    ISNULL(items_agg.total_desvio, 0.0) AS total_desvio
                FROM dbo.conteo c
                LEFT JOIN dbo.usuario u ON c.id_usuario = u.id_usuario
                OUTER APPLY (
                    SELECT 
                        COUNT(*) AS total_items,
                        SUM(CAST(mc.desvio AS FLOAT)) AS total_desvio
                    FROM dbo.material_conteo mc
                    WHERE mc.id_conteo = c.id_conteo
                ) items_agg
                WHERE c.tipo = 'planta'
                ORDER BY c.id_conteo DESC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
            """
            cursor.execute(data_q, (offset, limit))
            rows = cursor.fetchall()

            items = [
                {
                    "id_conteo": int(r[0]),
                    "tipo": str(r[1]),
                    "id_usuario": int(r[2]),
                    "nombre_usuario": str(r[3]) if r[3] else None,
                    "estado": str(r[4]),
                    "fecha_impacto": r[5] if isinstance(r[5], date) else None,
                    "fecha_inicio": r[6] if isinstance(r[6], datetime) else None,
                    "fecha_finalizacion": r[7] if isinstance(r[7], datetime) else None,
                    "observacion": str(r[8]) if r[8] else None,
                    "total_items": int(r[9]),
                    "total_desvio": float(r[10]),
                }
                for r in rows
            ]
            return items, total
        finally:
            cursor.close()
            conn.close()

    def get_conteo_detalle(self, id_conteo: int) -> Optional[Dict[str, Any]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            head_q = """
                SELECT 
                    c.id_conteo,
                    c.tipo,
                    c.id_usuario,
                    CONCAT(u.nombre, ' ', u.apellido) AS nombre_usuario,
                    c.estado,
                    c.fecha_impacto,
                    c.fecha_inicio,
                    c.fecha_finalizacion,
                    c.observacion
                FROM dbo.conteo c
                LEFT JOIN dbo.usuario u ON c.id_usuario = u.id_usuario
                WHERE c.id_conteo = ?
            """
            cursor.execute(head_q, (id_conteo,))
            h_row = cursor.fetchone()
            if not h_row:
                return None

            items_q = """
                SELECT 
                    mc.id_conteo,
                    mc.id_material,
                    m.nombre AS nombre_material,
                    ISNULL(m.unidad, 'UN') AS unidad,
                    prov.nombre AS nombre_proveedor,
                    CAST(mc.stock_teorico AS FLOAT) AS stock_teorico,
                    CAST(mc.stock_contado AS FLOAT) AS stock_contado,
                    CAST(mc.desvio AS FLOAT) AS desvio,
                    mc.observacion
                FROM dbo.material_conteo mc
                JOIN dbo.material m ON mc.id_material = m.id_material
                OUTER APPLY (
                    SELECT TOP 1 p.nombre
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
                WHERE mc.id_conteo = ?
                ORDER BY mc.id_material ASC
            """
            cursor.execute(items_q, (id_conteo,))
            i_rows = cursor.fetchall()

            items = [
                {
                    "id_conteo": int(r[0]),
                    "id_material": str(r[1]),
                    "nombre_material": str(r[2]),
                    "unidad": str(r[3]),
                    "nombre_proveedor": str(r[4]) if r[4] else None,
                    "stock_teorico": float(r[5]),
                    "stock_contado": float(r[6]),
                    "desvio": float(r[7]),
                    "observacion": str(r[8]) if r[8] else None,
                }
                for r in i_rows
            ]

            return {
                "id_conteo": int(h_row[0]),
                "tipo": str(h_row[1]),
                "id_usuario": int(h_row[2]),
                "nombre_usuario": str(h_row[3]) if h_row[3] else None,
                "estado": str(h_row[4]),
                "fecha_impacto": h_row[5] if isinstance(h_row[5], date) else None,
                "fecha_inicio": h_row[6] if isinstance(h_row[6], datetime) else None,
                "fecha_finalizacion": h_row[7] if isinstance(h_row[7], datetime) else None,
                "observacion": str(h_row[8]) if h_row[8] else None,
                "total_items": len(items),
                "items": items,
            }
        finally:
            cursor.close()
            conn.close()
