import os
import time
from decimal import Decimal
from typing import BinaryIO, Dict, List, Optional, Tuple, Union

import pyodbc

from app.core.config import get_db_connection
from app.schemas.bom import (
    BomComponenteDirecto,
    BomExtensionImportResult,
    BomExtensionItem,
    BomExtensionResult,
    BomExtensionUpsert,
    BomImportResult,
    BomParseResult,
    SdParseResult,
    SdSetImportResult,
)
from app.services.bom_parser import BomParser

BATCH_SIZE: int = 5000
FACTOR_QUANTUM: Decimal = Decimal("0.00000001")


class BomExtensionError(ValueError):
    pass


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

            filas_directas: Dict[Tuple[str, str], List[object]] = {}
            for padre, componentes in parse_result.hijos_por_padre.items():
                for comp in componentes:
                    clave = (padre, comp.id_hijo)
                    if clave in filas_directas:
                        filas_directas[clave][1] += comp.cantidad
                    else:
                        filas_directas[clave] = [comp.unidad, comp.cantidad]
            lote_directo = [
                (id_version, padre, hijo, cant, unidad)
                for (padre, hijo), (unidad, cant) in filas_directas.items()
            ]
            for i in range(0, len(lote_directo), BATCH_SIZE):
                cursor.executemany(
                    """
                    INSERT INTO dbo.bom_componente_directo (id_version, id_padre, id_hijo, cantidad, unidad)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    lote_directo[i : i + BATCH_SIZE]
                )

            self._regenerar_explosion(cursor, id_version)

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

    def _regenerar_explosion(self, cursor: pyodbc.Cursor, id_version: int) -> int:
        cursor.execute(
            "SELECT id_padre, id_hijo, cantidad, unidad FROM dbo.bom_componente_directo WHERE id_version = ?",
            id_version,
        )
        hijos: Dict[str, Dict[str, BomComponenteDirecto]] = {}
        for padre, hijo, cant, unidad in cursor.fetchall():
            hijos.setdefault(str(padre), {})[str(hijo)] = BomComponenteDirecto(
                id_hijo=str(hijo), cantidad=Decimal(cant), unidad=str(unidad)
            )

        cursor.execute("SELECT id_set, id_producto, cantidad, unidad FROM dbo.bom_set_producto")
        filas_set = cursor.fetchall()
        for id_set in {str(r[0]) for r in filas_set}:
            hijos[id_set] = {}
        for padre, hijo, cant, unidad in filas_set:
            hijos[str(padre)][str(hijo)] = BomComponenteDirecto(
                id_hijo=str(hijo), cantidad=Decimal(cant), unidad=str(unidad)
            )

        cursor.execute("SELECT id_padre, id_hijo, cantidad, unidad FROM dbo.bom_extension")
        for padre, hijo, cant, unidad in cursor.fetchall():
            hijos.setdefault(str(padre), {})[str(hijo)] = BomComponenteDirecto(
                id_hijo=str(hijo), cantidad=Decimal(cant), unidad=str(unidad)
            )

        try:
            explosion = BomParser.explotar({p: list(c.values()) for p, c in hijos.items()})
        except ValueError as err:
            raise BomExtensionError(str(err)) from err
        filas_explosion = [
            (id_version, pieza, insumo, factor.quantize(FACTOR_QUANTUM), unidad)
            for pieza, insumos in explosion.items()
            for insumo, (factor, unidad) in insumos.items()
        ]

        cursor.execute("DELETE FROM dbo.bom_explosion_plana WHERE id_version = ?", id_version)
        for i in range(0, len(filas_explosion), BATCH_SIZE):
            cursor.executemany(
                """
                INSERT INTO dbo.bom_explosion_plana (
                    id_version, id_producto_raiz, id_material_insumo, factor_consumo_total, unidad
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                filas_explosion[i : i + BATCH_SIZE]
            )

        cursor.execute(
            """
            UPDATE rpp
            SET rpp.factor_uso = e.factor_consumo_total
            FROM dbo.rundown_parametro_producto rpp
            INNER JOIN dbo.rundown_parametro_material pm ON pm.id_parametro = rpp.id_parametro
            INNER JOIN dbo.bom_explosion_plana e
                ON e.id_version = ?
               AND e.id_producto_raiz = rpp.id_producto
               AND e.id_material_insumo = pm.id_material
            WHERE rpp.factor_uso <> e.factor_consumo_total
            """,
            id_version,
        )
        cursor.execute(
            """
            INSERT INTO dbo.rundown_parametro_producto (id_parametro, id_producto, factor_uso)
            SELECT pm.id_parametro, e.id_producto_raiz, e.factor_consumo_total
            FROM dbo.rundown_parametro_material pm
            INNER JOIN dbo.bom_explosion_plana e
                ON e.id_version = ?
               AND e.id_material_insumo = pm.id_material
            WHERE pm.activo = 1
              AND NOT EXISTS (
                  SELECT 1
                  FROM dbo.rundown_parametro_producto rpp
                  WHERE rpp.id_parametro = pm.id_parametro
                    AND rpp.id_producto = e.id_producto_raiz
              )
            """,
            id_version,
        )
        cursor.execute(
            """
            DELETE rpp
            FROM dbo.rundown_parametro_producto rpp
            INNER JOIN dbo.rundown_parametro_material pm ON pm.id_parametro = rpp.id_parametro
            WHERE EXISTS (
                  SELECT 1 FROM dbo.bom_explosion_plana x
                  WHERE x.id_producto_raiz = rpp.id_producto
              )
              AND NOT EXISTS (
                  SELECT 1 FROM dbo.bom_explosion_plana e
                  WHERE e.id_version = ?
                    AND e.id_producto_raiz = rpp.id_producto
                    AND e.id_material_insumo = pm.id_material
              )
            """,
            id_version,
        )
        return len(filas_explosion)

    def _version_vigente_regenerable(self, cursor: pyodbc.Cursor) -> int:
        cursor.execute("SELECT TOP 1 id_version FROM dbo.bom_version WHERE es_vigente = 1")
        row = cursor.fetchone()
        if not row:
            raise BomExtensionError("No hay una BOM vigente cargada.")
        id_version = int(row[0])
        cursor.execute("SELECT TOP 1 1 FROM dbo.bom_componente_directo WHERE id_version = ?", id_version)
        if not cursor.fetchone():
            raise BomExtensionError(
                "La BOM vigente se importó con la versión anterior del sistema. Reimportala para poder usar la extensión."
            )
        return id_version

    def listar_extension(self) -> List[BomExtensionItem]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT e.id_extension, e.id_padre, COALESCE(mp.nombre, e.id_padre),
                       e.id_hijo, COALESCE(mh.nombre, e.id_hijo),
                       CAST(e.cantidad AS FLOAT), e.unidad, e.observacion
                FROM dbo.bom_extension e
                LEFT JOIN dbo.material mp ON mp.id_material = e.id_padre
                LEFT JOIN dbo.material mh ON mh.id_material = e.id_hijo
                ORDER BY e.id_padre, e.id_hijo
                """
            )
            return [
                BomExtensionItem(
                    id_extension=int(r[0]),
                    id_padre=str(r[1]),
                    nombre_padre=str(r[2]),
                    id_hijo=str(r[3]),
                    nombre_hijo=str(r[4]),
                    cantidad=float(r[5]),
                    unidad=str(r[6]),
                    observacion=str(r[7]) if r[7] else None,
                )
                for r in cursor.fetchall()
            ]
        finally:
            cursor.close()
            conn.close()

    def guardar_extension(self, data: BomExtensionUpsert, id_usuario: Optional[int]) -> BomExtensionResult:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        cursor.fast_executemany = True
        try:
            id_version = self._version_vigente_regenerable(cursor)
            for id_mat, nombre in ((data.id_padre, data.nombre_padre), (data.id_hijo, data.nombre_hijo)):
                cursor.execute(
                    """
                    IF NOT EXISTS (SELECT 1 FROM dbo.material WHERE id_material = ?)
                        INSERT INTO dbo.material (id_material, nombre, unidad, controla_stock)
                        VALUES (?, ?, ?, 1)
                    """,
                    (id_mat, id_mat, (nombre or id_mat)[:100], data.unidad),
                )
            cursor.execute(
                """
                MERGE dbo.bom_extension AS target
                USING (SELECT ? AS id_padre, ? AS id_hijo) AS source
                ON target.id_padre = source.id_padre AND target.id_hijo = source.id_hijo
                WHEN MATCHED THEN
                    UPDATE SET cantidad = ?, unidad = ?, observacion = ?,
                               fecha_actualizacion = SYSUTCDATETIME(), id_usuario_actualizacion = ?
                WHEN NOT MATCHED THEN
                    INSERT (id_padre, id_hijo, cantidad, unidad, observacion, id_usuario_creacion)
                    VALUES (source.id_padre, source.id_hijo, ?, ?, ?, ?);
                """,
                (
                    data.id_padre, data.id_hijo,
                    data.cantidad, data.unidad, data.observacion, id_usuario,
                    data.cantidad, data.unidad, data.observacion, id_usuario,
                ),
            )
            filas = self._regenerar_explosion(cursor, id_version)
            conn.commit()
            return BomExtensionResult(ok=True, filas_explosion=filas)
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def eliminar_extension(self, id_extension: int) -> BomExtensionResult:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        cursor.fast_executemany = True
        try:
            id_version = self._version_vigente_regenerable(cursor)
            cursor.execute("DELETE FROM dbo.bom_extension WHERE id_extension = ?", id_extension)
            if cursor.rowcount == 0:
                raise BomExtensionError("La línea de extensión no existe.")
            filas = self._regenerar_explosion(cursor, id_version)
            conn.commit()
            return BomExtensionResult(ok=True, filas_explosion=filas)
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def importar_sd_sets(self, source: Union[str, BinaryIO], nombre_archivo: str) -> SdSetImportResult:
        parse_result: SdParseResult = BomParser.parse_sd_sets(source)
        if not parse_result.sd_sets:
            raise BomExtensionError("El archivo no tiene filas de SD y SET reconocibles (SD en columna A, SET en B).")

        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        cursor.fast_executemany = True
        try:
            id_version = self._version_vigente_regenerable(cursor)

            cursor.execute("SELECT id_material FROM dbo.material")
            existentes = {str(r[0]) for r in cursor.fetchall()}
            nuevos = [
                (m.id_material, m.nombre, m.unidad, 1)
                for m in parse_result.materiales.values()
                if m.id_material not in existentes
            ]
            if nuevos:
                cursor.executemany(
                    "INSERT INTO dbo.material (id_material, nombre, unidad, controla_stock) VALUES (?, ?, ?, ?)",
                    nuevos,
                )

            cursor.execute("DELETE FROM dbo.bom_set_producto")
            cursor.execute("DELETE FROM dbo.bom_sd_set")

            nombre = nombre_archivo[:255]
            cursor.executemany(
                """
                INSERT INTO dbo.bom_sd_set (codigo_sd, id_set, descripcion_sd, cantidad, unidad, nombre_archivo)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                [
                    (s.codigo_sd, s.id_set, s.descripcion_sd or None, s.cantidad, s.unidad, nombre)
                    for s in parse_result.sd_sets
                ],
            )

            lineas: Dict[Tuple[str, str], List[object]] = {}
            for id_set, productos in parse_result.set_productos.items():
                for comp in productos:
                    clave = (id_set, comp.id_hijo)
                    if clave in lineas:
                        lineas[clave][1] += comp.cantidad
                    else:
                        lineas[clave] = [comp.unidad, comp.cantidad]
            filas = [(s, p, cant, unidad) for (s, p), (unidad, cant) in lineas.items()]
            for i in range(0, len(filas), BATCH_SIZE):
                cursor.executemany(
                    "INSERT INTO dbo.bom_set_producto (id_set, id_producto, cantidad, unidad) VALUES (?, ?, ?, ?)",
                    filas[i : i + BATCH_SIZE],
                )

            cursor.execute(
                "SELECT DISTINCT id_padre FROM dbo.bom_componente_directo WHERE id_version = ?",
                id_version,
            )
            padres_bom = {str(r[0]) for r in cursor.fetchall()}
            cursor.execute("SELECT DISTINCT id_padre FROM dbo.bom_extension")
            padres_bom |= {str(r[0]) for r in cursor.fetchall()}

            sets = {s.id_set for s in parse_result.sd_sets}
            sets_sin_estructura = sorted(s for s in sets if s not in parse_result.set_productos and s not in padres_bom)
            productos_sin_bom = sorted(
                {p for _, p, _, _ in filas if p not in padres_bom and p not in parse_result.set_productos}
            )

            filas_explosion = self._regenerar_explosion(cursor, id_version)
            conn.commit()
            return SdSetImportResult(
                nombre_archivo=nombre_archivo,
                total_sd=len({s.codigo_sd for s in parse_result.sd_sets}),
                total_sets=len(sets),
                total_set_producto=len(filas),
                nuevos_materiales_registrados=len(nuevos),
                filas_explosion=filas_explosion,
                sets_sin_estructura=sets_sin_estructura,
                productos_sin_bom=productos_sin_bom,
            )
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def importar_extension(
        self, source: Union[str, BinaryIO], nombre_archivo: str, id_usuario: Optional[int]
    ) -> BomExtensionImportResult:
        parse_result: BomParseResult = BomParser.parse_relaciones_planas(source)
        if not parse_result.hijos_por_padre:
            raise BomExtensionError("El archivo no tiene estructuras de BOM reconocibles.")

        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        cursor.fast_executemany = True
        try:
            id_version = self._version_vigente_regenerable(cursor)

            cursor.execute("SELECT id_material FROM dbo.material")
            existentes = {str(r[0]) for r in cursor.fetchall()}
            nuevos = [
                (m.id_material, m.nombre, m.unidad, 1)
                for m in parse_result.materiales.values()
                if m.id_material not in existentes
            ]
            if nuevos:
                cursor.executemany(
                    "INSERT INTO dbo.material (id_material, nombre, unidad, controla_stock) VALUES (?, ?, ?, ?)",
                    nuevos,
                )

            lineas: Dict[Tuple[str, str], List[object]] = {}
            for padre, componentes in parse_result.hijos_por_padre.items():
                for comp in componentes:
                    clave = (padre, comp.id_hijo)
                    if clave in lineas:
                        lineas[clave][1] += comp.cantidad
                    else:
                        lineas[clave] = [comp.unidad, comp.cantidad]

            padres = sorted(parse_result.hijos_por_padre.keys())
            for i in range(0, len(padres), 1000):
                lote = padres[i : i + 1000]
                cursor.execute(
                    f"DELETE FROM dbo.bom_extension WHERE id_padre IN ({','.join('?' for _ in lote)})",
                    lote,
                )

            observacion = f"Importado de {nombre_archivo}"[:250]
            filas = [
                (padre, hijo, cant, unidad, observacion, id_usuario)
                for (padre, hijo), (unidad, cant) in lineas.items()
                if padre != hijo and cant > 0
            ]
            for i in range(0, len(filas), BATCH_SIZE):
                cursor.executemany(
                    """
                    INSERT INTO dbo.bom_extension (id_padre, id_hijo, cantidad, unidad, observacion, id_usuario_creacion)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    filas[i : i + BATCH_SIZE],
                )

            filas_explosion = self._regenerar_explosion(cursor, id_version)
            conn.commit()
            return BomExtensionImportResult(
                nombre_archivo=nombre_archivo,
                productos_importados=len(padres),
                lineas_importadas=len(filas),
                nuevos_materiales_registrados=len(nuevos),
                filas_explosion=filas_explosion,
            )
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()
