from typing import List, Optional, Tuple
import pyodbc

from app.core.config import get_db_connection
from app.schemas.bom import (
    BomEstructuraItemOut,
    BomEstructuraResponse,
    BomVersionOut,
    SetComponenteOut,
    SetComponenteCreate,
    SetComponenteUpdate,
)


class BomRepository:
    def __init__(self, connection_factory=get_db_connection) -> None:
        self._get_connection = connection_factory

    def get_versions(self) -> List[BomVersionOut]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT id_version, nombre_archivo, fecha_importacion, total_lineas, es_vigente, observacion
                FROM dbo.bom_version
                ORDER BY es_vigente DESC, id_version DESC
                """
            )
            rows = cursor.fetchall()
            return [
                BomVersionOut(
                    id_version=int(r[0]),
                    nombre_archivo=str(r[1]),
                    fecha_importacion=r[2].strftime("%d/%m/%Y · %H:%M") if r[2] else "",
                    total_lineas=int(r[3]),
                    es_vigente=bool(r[4]),
                    observacion=str(r[5]) if r[5] else None,
                )
                for r in rows
            ]
        finally:
            cursor.close()
            conn.close()

    def get_set_componentes(
        self,
        sector: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 200,
        offset: int = 0,
    ) -> Tuple[List[SetComponenteOut], int]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            where_clauses: List[str] = []
            params: List[object] = []

            if sector and sector != "todos":
                where_clauses.append("s.sector = ?")
                params.append(sector)

            if search:
                pattern = f"%{search.strip()}%"
                where_clauses.append(
                    "(s.codigo_tasa LIKE ? OR s.codigo_sap_padre LIKE ? OR s.id_material_hijo LIKE ? OR m.nombre LIKE ?)"
                )
                params.extend([pattern, pattern, pattern, pattern])

            where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

            count_sql = f"""
                SELECT COUNT(1)
                FROM dbo.set_componente s
                LEFT JOIN dbo.material m ON s.id_material_hijo = m.id_material
                {where_sql}
            """
            cursor.execute(count_sql, params)
            total_count: int = cursor.fetchone()[0]

            data_sql = f"""
                SELECT 
                    s.id_set_componente,
                    s.sector,
                    s.sd,
                    s.codigo_tasa,
                    s.codigo_sap_padre,
                    s.id_material_hijo,
                    COALESCE(m.nombre, s.id_material_hijo) AS descripcion_hijo,
                    s.cantidad,
                    COALESCE(m.unidad, 'UN') AS unidad,
                    s.activo
                FROM dbo.set_componente s
                LEFT JOIN dbo.material m ON s.id_material_hijo = m.id_material
                {where_sql}
                ORDER BY s.id_set_componente ASC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
            """
            cursor.execute(data_sql, params + [offset, limit])
            rows = cursor.fetchall()

            items = [
                SetComponenteOut(
                    id_set_componente=int(r[0]),
                    sector=str(r[1]) if r[1] else None,
                    sd=str(r[2]) if r[2] else None,
                    codigo_tasa=str(r[3]),
                    codigo_sap_padre=str(r[4]),
                    id_material_hijo=str(r[5]),
                    descripcion_hijo=str(r[6]) if r[6] else None,
                    cantidad=float(r[7]),
                    unidad=str(r[8]),
                    activo=bool(r[9]),
                )
                for r in rows
            ]
            return items, total_count
        finally:
            cursor.close()
            conn.close()

    def create_set_componente(self, data: SetComponenteCreate) -> SetComponenteOut:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO dbo.set_componente (
                    sector, sd, codigo_tasa, codigo_sap_padre, id_material_hijo, cantidad, activo
                )
                OUTPUT INSERTED.id_set_componente
                VALUES (?, ?, ?, ?, ?, ?, 1)
                """,
                (
                    data.sector,
                    data.sd,
                    data.codigo_tasa,
                    data.codigo_sap_padre,
                    data.id_material_hijo,
                    data.cantidad,
                ),
            )
            new_id: int = cursor.fetchone()[0]

            cursor.execute(
                "SELECT nombre, unidad FROM dbo.material WHERE id_material = ?",
                data.id_material_hijo,
            )
            mat_row = cursor.fetchone()
            desc = mat_row[0] if mat_row else data.id_material_hijo
            unit = mat_row[1] if mat_row else data.unidad

            conn.commit()
            return SetComponenteOut(
                id_set_componente=new_id,
                sector=data.sector,
                sd=data.sd,
                codigo_tasa=data.codigo_tasa,
                codigo_sap_padre=data.codigo_sap_padre,
                id_material_hijo=data.id_material_hijo,
                descripcion_hijo=desc,
                cantidad=data.cantidad,
                unidad=unit,
                activo=True,
            )
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def update_set_componente(
        self, id_set_componente: int, data: SetComponenteUpdate
    ) -> Optional[SetComponenteOut]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            update_fields: List[str] = []
            params: List[object] = []

            if data.sector is not None:
                update_fields.append("sector = ?")
                params.append(data.sector)
            if data.sd is not None:
                update_fields.append("sd = ?")
                params.append(data.sd)
            if data.codigo_tasa is not None:
                update_fields.append("codigo_tasa = ?")
                params.append(data.codigo_tasa)
            if data.codigo_sap_padre is not None:
                update_fields.append("codigo_sap_padre = ?")
                params.append(data.codigo_sap_padre)
            if data.id_material_hijo is not None:
                update_fields.append("id_material_hijo = ?")
                params.append(data.id_material_hijo)
            if data.cantidad is not None:
                update_fields.append("cantidad = ?")
                params.append(data.cantidad)
            if data.activo is not None:
                update_fields.append("activo = ?")
                params.append(1 if data.activo else 0)

            if not update_fields:
                return None

            params.append(id_set_componente)
            sql = f"""
                UPDATE dbo.set_componente
                SET {', '.join(update_fields)}
                WHERE id_set_componente = ?
            """
            cursor.execute(sql, params)
            conn.commit()

            cursor.execute(
                """
                SELECT 
                    s.id_set_componente,
                    s.sector,
                    s.sd,
                    s.codigo_tasa,
                    s.codigo_sap_padre,
                    s.id_material_hijo,
                    COALESCE(m.nombre, s.id_material_hijo) AS descripcion_hijo,
                    s.cantidad,
                    COALESCE(m.unidad, 'UN') AS unidad,
                    s.activo
                FROM dbo.set_componente s
                LEFT JOIN dbo.material m ON s.id_material_hijo = m.id_material
                WHERE s.id_set_componente = ?
                """,
                id_set_componente,
            )
            row = cursor.fetchone()
            if not row:
                return None
            return SetComponenteOut(
                id_set_componente=int(row[0]),
                sector=str(row[1]) if row[1] else None,
                sd=str(row[2]) if row[2] else None,
                codigo_tasa=str(row[3]),
                codigo_sap_padre=str(row[4]),
                id_material_hijo=str(row[5]),
                descripcion_hijo=str(row[6]) if row[6] else None,
                cantidad=float(row[7]),
                unidad=str(row[8]),
                activo=bool(row[9]),
            )
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def toggle_set_componente(self, id_set_componente: int) -> Optional[bool]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                UPDATE dbo.set_componente
                SET activo = CASE WHEN activo = 1 THEN 0 ELSE 1 END
                OUTPUT INSERTED.activo
                WHERE id_set_componente = ?
                """,
                id_set_componente,
            )
            row = cursor.fetchone()
            if not row:
                return None
            conn.commit()
            return bool(row[0])
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def get_bom_estructura(
        self,
        id_version: Optional[int] = None,
        search: Optional[str] = None,
        limit: int = 200,
        offset: int = 0,
    ) -> BomEstructuraResponse:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            target_version_id = id_version
            nombre_archivo = None
            if not target_version_id:
                cursor.execute(
                    "SELECT TOP 1 id_version, nombre_archivo FROM dbo.bom_version WHERE es_vigente = 1 ORDER BY id_version DESC"
                )
                v_row = cursor.fetchone()
                if v_row:
                    target_version_id = int(v_row[0])
                    nombre_archivo = str(v_row[1])
            else:
                cursor.execute(
                    "SELECT nombre_archivo FROM dbo.bom_version WHERE id_version = ?",
                    (target_version_id,),
                )
                v_row = cursor.fetchone()
                if v_row:
                    nombre_archivo = str(v_row[0])

            if not target_version_id:
                return BomEstructuraResponse(id_version=None, nombre_archivo=None, total=0, items=[])

            where_conditions = ["b.id_version = ?"]
            params: List[object] = [target_version_id]

            if search and search.strip():
                s = f"%{search.strip()}%"
                where_conditions.append(
                    "(b.id_producto_raiz LIKE ? OR b.id_padre LIKE ? OR b.id_hijo LIKE ? OR m.nombre LIKE ?)"
                )
                params.extend([s, s, s, s])

            where_sql = " AND ".join(where_conditions)

            count_query = f"""
                SELECT COUNT(*)
                FROM dbo.bom_estructura b
                LEFT JOIN dbo.material m ON b.id_hijo = m.id_material
                WHERE {where_sql}
            """
            cursor.execute(count_query, params)
            total = int(cursor.fetchone()[0])

            data_query = f"""
                SELECT b.id_bom, b.id_version, b.nivel, b.id_producto_raiz, b.id_padre, b.id_hijo,
                       ISNULL(m.nombre, b.id_hijo) AS descripcion_hijo,
                       CAST(b.cantidad AS FLOAT) AS cantidad, b.unidad, b.orden
                FROM dbo.bom_estructura b
                LEFT JOIN dbo.material m ON b.id_hijo = m.id_material
                WHERE {where_sql}
                ORDER BY b.orden ASC, b.id_bom ASC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
            """
            data_params = params + [offset, limit]
            cursor.execute(data_query, data_params)
            rows = cursor.fetchall()

            items = [
                BomEstructuraItemOut(
                    id_bom=int(r[0]),
                    id_version=int(r[1]),
                    nivel=int(r[2]),
                    id_producto_raiz=str(r[3]),
                    id_padre=str(r[4]),
                    id_hijo=str(r[5]),
                    descripcion_hijo=str(r[6]) if r[6] else None,
                    cantidad=float(r[7]),
                    unidad=str(r[8]),
                    orden=int(r[9]),
                )
                for r in rows
            ]

            return BomEstructuraResponse(
                id_version=target_version_id,
                nombre_archivo=nombre_archivo,
                total=total,
                items=items,
            )
        finally:
            cursor.close()
            conn.close()

