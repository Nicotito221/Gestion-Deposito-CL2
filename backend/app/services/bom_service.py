import os
import time
from typing import BinaryIO, Optional, Union

import pyodbc

from app.core.config import get_db_connection
from app.schemas.bom import BomImportResult, BomParseResult
from app.services.bom_parser import BomParser

BATCH_SIZE: int = 5000


class BomService:
    def __init__(self, connection_factory=get_db_connection) -> None:
        self._get_connection = connection_factory

    def importar_bom(
        self,
        source: Union[str, BinaryIO],
        nombre_archivo: Optional[str] = None
    ) -> BomImportResult:
        start_time = time.perf_counter()

        if isinstance(source, str) and nombre_archivo is None:
            nombre_archivo = os.path.basename(source)
        elif nombre_archivo is None:
            nombre_archivo = "bom_upload.tsv"

        parse_result: BomParseResult = BomParser.parse(source)

        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        cursor.fast_executemany = True

        try:
            cursor.execute("SELECT id_material FROM dbo.material")
            existentes = {row[0] for row in cursor.fetchall()}

            nuevos_materiales = [
                (m.id_material, m.nombre, m.unidad, 1)
                for m in parse_result.materiales.values()
                if m.id_material not in existentes
            ]

            if nuevos_materiales:
                cursor.executemany(
                    """
                    INSERT INTO dbo.material (id_material, nombre, unidad, controla_stock)
                    VALUES (?, ?, ?, ?)
                    """,
                    nuevos_materiales
                )

            cursor.execute(
                """
                INSERT INTO dbo.bom_version (nombre_archivo, total_lineas, es_vigente, observacion)
                OUTPUT INSERTED.id_version
                VALUES (?, ?, 0, ?)
                """,
                (nombre_archivo, len(parse_result.relaciones), f"Carga de {len(parse_result.relaciones)} relaciones")
            )
            id_version: int = cursor.fetchone()[0]

            filas_estructura = [
                (
                    id_version,
                    r.id_producto_raiz,
                    r.id_padre,
                    r.id_hijo,
                    r.cantidad,
                    r.unidad,
                    r.nivel,
                    r.orden
                )
                for r in parse_result.relaciones
            ]

            for i in range(0, len(filas_estructura), BATCH_SIZE):
                lote = filas_estructura[i : i + BATCH_SIZE]
                cursor.executemany(
                    """
                    INSERT INTO dbo.bom_estructura (
                        id_version, id_producto_raiz, id_padre, id_hijo, cantidad, unidad, nivel, orden
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    lote
                )

            cursor.execute("EXEC dbo.usp_generar_explosion_bom_version @id_version = ?", id_version)

            cursor.execute("UPDATE dbo.bom_version SET es_vigente = 0 WHERE es_vigente = 1")
            cursor.execute("UPDATE dbo.bom_version SET es_vigente = 1 WHERE id_version = ?", id_version)

            conn.commit()

            elapsed = time.perf_counter() - start_time
            return BomImportResult(
                id_version=id_version,
                nombre_archivo=nombre_archivo,
                total_lineas_procesadas=parse_result.total_lineas_archivo,
                nuevos_materiales_registrados=len(nuevos_materiales),
                total_relaciones_creadas=len(parse_result.relaciones),
                tiempo_segundos=round(elapsed, 2),
                mensaje="Importación y activación de BOM completada con éxito."
            )

        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()
