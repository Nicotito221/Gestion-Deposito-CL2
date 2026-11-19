from typing import Dict, List, Optional, Set, Tuple

import pyodbc

from app.core.config import get_db_connection
from app.schemas.supply import ConversionOrdenResumen

BATCH_SIZE: int = 5000


class ConversionOrdenRepository:
    def __init__(self, connection_factory=get_db_connection) -> None:
        self._get_connection = connection_factory

    def reemplazar(self, filas: List[Tuple[str, str, Optional[str]]], nombre_archivo: str) -> None:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        cursor.fast_executemany = True
        try:
            cursor.execute("DELETE FROM dbo.conversion_orden_suministro")
            nombre = nombre_archivo[:255]
            lote = [(pn, tasa, sap, nombre) for pn, tasa, sap in filas]
            for i in range(0, len(lote), BATCH_SIZE):
                cursor.executemany(
                    """
                    INSERT INTO dbo.conversion_orden_suministro (pn_orden, codigo_tasa, codigo_sap, nombre_archivo)
                    VALUES (?, ?, ?, ?)
                    """,
                    lote[i : i + BATCH_SIZE],
                )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def obtener_mapa(self) -> Dict[str, Tuple[Optional[str], Optional[str]]]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT pn_orden, codigo_tasa, codigo_sap FROM dbo.conversion_orden_suministro")
            return {
                str(r[0]): (str(r[1]) if r[1] else None, str(r[2]) if r[2] else None)
                for r in cursor.fetchall()
            }
        finally:
            cursor.close()
            conn.close()

    def obtener_padres_bom_vigente(self) -> Set[str]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT DISTINCT e.id_producto_raiz
                FROM dbo.bom_explosion_plana e
                WHERE e.id_version = (
                    SELECT TOP 1 id_version FROM dbo.bom_version ORDER BY es_vigente DESC, id_version DESC
                )
                """
            )
            return {str(r[0]) for r in cursor.fetchall()}
        finally:
            cursor.close()
            conn.close()

    def resumen(self) -> ConversionOrdenResumen:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT COUNT(*), MAX(nombre_archivo), MAX(fecha_carga)
                FROM dbo.conversion_orden_suministro
                """
            )
            row = cursor.fetchone()
            return ConversionOrdenResumen(
                total_conversiones=int(row[0] or 0),
                nombre_archivo=str(row[1]) if row[1] else None,
                fecha_carga=row[2].strftime("%d/%m/%Y %H:%M") if row[2] else None,
            )
        finally:
            cursor.close()
            conn.close()
