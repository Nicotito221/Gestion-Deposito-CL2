from datetime import date, timedelta
from typing import Dict, List, Optional, Set, Tuple

import pyodbc

from app.core.config import get_db_connection
from app.schemas.despacho import DespachoItem, DespachoUpsert, DespachoUpsertResult


def _fin_de_mes(anio: int, mes: int) -> date:
    siguiente = date(anio + 1, 1, 1) if mes == 12 else date(anio, mes + 1, 1)
    return siguiente - timedelta(days=1)


class DespachoRepository:
    def __init__(self, connection_factory=get_db_connection) -> None:
        self._get_connection = connection_factory

    def listar(self, anio_desde: int, mes_desde: int, anio_hasta: int, mes_hasta: int) -> List[DespachoItem]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT id_despacho, id_producto, empresa_destino, anio, mes,
                       CAST(cantidad AS FLOAT), observacion
                FROM dbo.demanda_despacho
                WHERE (anio * 100 + mes) BETWEEN ? AND ?
                ORDER BY empresa_destino, id_producto, anio, mes
                """,
                (anio_desde * 100 + mes_desde, anio_hasta * 100 + mes_hasta),
            )
            return [
                DespachoItem(
                    id_despacho=int(r[0]),
                    id_producto=str(r[1]),
                    empresa_destino=str(r[2]),
                    anio=int(r[3]),
                    mes=int(r[4]),
                    cantidad=float(r[5]),
                    observacion=str(r[6]) if r[6] else None,
                )
                for r in cursor.fetchall()
            ]
        finally:
            cursor.close()
            conn.close()

    def upsert_batch(self, items: List[DespachoUpsert], id_usuario: Optional[int]) -> DespachoUpsertResult:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            productos = sorted({it.id_producto for it in items})
            placeholders = ",".join("?" for _ in productos)
            cursor.execute(
                f"""
                SELECT DISTINCT e.id_producto_raiz
                FROM dbo.bom_explosion_plana e
                INNER JOIN dbo.bom_version v ON v.id_version = e.id_version AND v.es_vigente = 1
                WHERE e.id_producto_raiz IN ({placeholders})
                """,
                productos,
            )
            en_bom: Set[str] = {str(r[0]).upper() for r in cursor.fetchall()}
            no_encontrados = [p for p in productos if p not in en_bom]

            guardados = 0
            eliminados = 0
            for it in items:
                if it.id_producto not in en_bom:
                    continue
                if it.cantidad == 0:
                    cursor.execute(
                        """
                        DELETE FROM dbo.demanda_despacho
                        WHERE id_producto = ? AND empresa_destino = ? AND anio = ? AND mes = ?
                        """,
                        (it.id_producto, it.empresa_destino, it.anio, it.mes),
                    )
                    eliminados += cursor.rowcount
                    continue
                cursor.execute(
                    """
                    MERGE dbo.demanda_despacho AS target
                    USING (SELECT ? AS id_producto, ? AS empresa_destino, ? AS anio, ? AS mes) AS source
                    ON target.id_producto = source.id_producto
                       AND target.empresa_destino = source.empresa_destino
                       AND target.anio = source.anio
                       AND target.mes = source.mes
                    WHEN MATCHED THEN
                        UPDATE SET cantidad = ?, observacion = ?,
                                   fecha_actualizacion = SYSUTCDATETIME(), id_usuario_actualizacion = ?
                    WHEN NOT MATCHED THEN
                        INSERT (id_producto, empresa_destino, anio, mes, cantidad, observacion, id_usuario_creacion)
                        VALUES (source.id_producto, source.empresa_destino, source.anio, source.mes, ?, ?, ?);
                    """,
                    (
                        it.id_producto, it.empresa_destino, it.anio, it.mes,
                        it.cantidad, it.observacion, id_usuario,
                        it.cantidad, it.observacion, id_usuario,
                    ),
                )
                guardados += 1

            vinculables = [p for p in productos if p in en_bom]
            if vinculables:
                ph = ",".join("?" for _ in vinculables)
                cursor.execute(
                    f"""
                    INSERT INTO dbo.rundown_parametro_producto (id_parametro, id_producto, factor_uso)
                    SELECT pm.id_parametro, e.id_producto_raiz, e.factor_consumo_total
                    FROM dbo.rundown_parametro_material pm
                    INNER JOIN dbo.bom_explosion_plana e ON e.id_material_insumo = pm.id_material
                    INNER JOIN dbo.bom_version v ON v.id_version = e.id_version AND v.es_vigente = 1
                    WHERE pm.activo = 1
                      AND e.id_producto_raiz IN ({ph})
                      AND NOT EXISTS (
                          SELECT 1 FROM dbo.rundown_parametro_producto rpp
                          WHERE rpp.id_parametro = pm.id_parametro AND rpp.id_producto = e.id_producto_raiz
                      )
                    """,
                    vinculables,
                )

            conn.commit()
            return DespachoUpsertResult(
                guardados=guardados,
                eliminados=eliminados,
                productos_no_encontrados=no_encontrados,
            )
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def eliminar(self, id_despacho: int) -> bool:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("DELETE FROM dbo.demanda_despacho WHERE id_despacho = ?", (id_despacho,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            cursor.close()
            conn.close()

    def get_mensual_desde(self, anio: int, mes: int) -> Dict[Tuple[str, int, int], float]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT id_producto, anio, mes, CAST(SUM(cantidad) AS FLOAT)
                FROM dbo.demanda_despacho
                WHERE (anio * 100 + mes) >= ?
                GROUP BY id_producto, anio, mes
                """,
                (anio * 100 + mes,),
            )
            return {(str(r[0]), int(r[1]), int(r[2])): float(r[3] or 0.0) for r in cursor.fetchall()}
        finally:
            cursor.close()
            conn.close()

    def get_diario(
        self, product_ids: Optional[List[str]], fecha_desde: date, fecha_hasta: date
    ) -> Dict[str, Dict[date, float]]:
        if product_ids is not None and not product_ids:
            return {}
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            periodo_desde = fecha_desde.year * 100 + fecha_desde.month
            periodo_hasta = fecha_hasta.year * 100 + fecha_hasta.month
            sql = """
                SELECT id_producto, anio, mes, CAST(SUM(cantidad) AS FLOAT)
                FROM dbo.demanda_despacho
                WHERE (anio * 100 + mes) BETWEEN ? AND ?
            """
            params: List[object] = [periodo_desde, periodo_hasta]
            filtro = set(product_ids) if product_ids is not None else None
            if filtro is not None and len(filtro) <= 2000:
                sql += f" AND id_producto IN ({','.join('?' for _ in filtro)})"
                params.extend(filtro)
            sql += " GROUP BY id_producto, anio, mes"
            cursor.execute(sql, params)
            mensuales = [
                (str(r[0]), int(r[1]), int(r[2]), float(r[3] or 0.0))
                for r in cursor.fetchall()
                if filtro is None or str(r[0]) in filtro
            ]
            if not mensuales:
                return {}

            meses = {(a, m) for _, a, m, _ in mensuales}
            cal_desde = min(date(a, m, 1) for a, m in meses)
            cal_hasta = max(_fin_de_mes(a, m) for a, m in meses)
            cursor.execute(
                "SELECT fecha, es_laboral FROM dbo.rundown_calendario_laboral WHERE fecha BETWEEN ? AND ?",
                (cal_desde, cal_hasta),
            )
            overrides: Dict[date, bool] = {r[0]: bool(r[1]) for r in cursor.fetchall()}

            laborales_por_mes: Dict[Tuple[int, int], List[date]] = {}
            for a, m in meses:
                dias: List[date] = []
                d = date(a, m, 1)
                fin = _fin_de_mes(a, m)
                while d <= fin:
                    if overrides.get(d, d.weekday() < 5):
                        dias.append(d)
                    d += timedelta(days=1)
                laborales_por_mes[(a, m)] = dias

            resultado: Dict[str, Dict[date, float]] = {}
            for prod, a, m, cant in mensuales:
                dias = laborales_por_mes[(a, m)]
                if not dias:
                    continue
                cuota = cant / len(dias)
                destino = resultado.setdefault(prod, {})
                for d in dias:
                    if fecha_desde <= d <= fecha_hasta:
                        destino[d] = destino.get(d, 0.0) + cuota
            return resultado
        finally:
            cursor.close()
            conn.close()
