from datetime import datetime
from typing import Any, Dict, List, Optional
import pyodbc
from app.core.config import get_db_connection


class UsuarioRepository:
    def _row_to_dict(self, row: pyodbc.Row) -> Dict[str, Any]:
        return {
            "id_usuario": row.id_usuario,
            "username": row.username,
            "password_hash": row.password_hash,
            "nombre": row.nombre,
            "apellido": row.apellido,
            "rol": row.rol,
            "sector": row.sector,
            "email": row.email,
            "activo": bool(row.activo),
            "eliminado": bool(getattr(row, "eliminado", 0)),
            "fecha_creacion": row.fecha_creacion,
            "ultimo_acceso": row.ultimo_acceso,
        }

    def get_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                """
                SELECT id_usuario, username, password_hash, nombre, apellido, rol, sector, email, activo, eliminado, fecha_creacion, ultimo_acceso
                FROM dbo.usuario
                WHERE username = ? AND (eliminado = 0 OR eliminado IS NULL)
                """,
                (username,),
            )
            row = cur.fetchone()
            if not row:
                return None
            return self._row_to_dict(row)
        finally:
            cur.close()
            conn.close()

    def get_by_id(self, id_usuario: int) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                """
                SELECT id_usuario, username, password_hash, nombre, apellido, rol, sector, email, activo, eliminado, fecha_creacion, ultimo_acceso
                FROM dbo.usuario
                WHERE id_usuario = ? AND (eliminado = 0 OR eliminado IS NULL)
                """,
                (id_usuario,),
            )
            row = cur.fetchone()
            if not row:
                return None
            return self._row_to_dict(row)
        finally:
            cur.close()
            conn.close()

    def list_all(
        self,
        rol: Optional[str] = None,
        sector: Optional[str] = None,
        solo_activos: bool = False,
    ) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            query = """
                SELECT id_usuario, username, password_hash, nombre, apellido, rol, sector, email, activo, eliminado, fecha_creacion, ultimo_acceso
                FROM dbo.usuario
                WHERE (eliminado = 0 OR eliminado IS NULL)
            """
            params: List[Any] = []
            if rol:
                query += " AND rol = ?"
                params.append(rol)
            if sector and sector != "TODOS":
                query += " AND (sector = ? OR sector = 'TODOS')"
                params.append(sector)
            if solo_activos:
                query += " AND activo = 1"
            query += " ORDER BY nombre ASC, apellido ASC"

            cur.execute(query, params)
            rows = cur.fetchall()
            return [self._row_to_dict(r) for r in rows]
        finally:
            cur.close()
            conn.close()

    def create(
        self,
        username: str,
        password_hash: str,
        nombre: str,
        apellido: str,
        rol: str,
        sector: str = "TODOS",
        email: Optional[str] = None,
        activo: bool = True,
    ) -> Dict[str, Any]:
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                """
                INSERT INTO dbo.usuario (username, password_hash, nombre, apellido, rol, sector, email, activo, fecha_creacion)
                OUTPUT INSERTED.id_usuario, INSERTED.username, INSERTED.password_hash, INSERTED.nombre,
                       INSERTED.apellido, INSERTED.rol, INSERTED.sector, INSERTED.email, INSERTED.activo,
                       INSERTED.fecha_creacion, INSERTED.ultimo_acceso
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, SYSUTCDATETIME())
                """,
                (username, password_hash, nombre, apellido, rol, sector, email, 1 if activo else 0),
            )
            row = cur.fetchone()
            conn.commit()
            return self._row_to_dict(row)
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    def update(
        self,
        id_usuario: int,
        fields: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        if not fields:
            return self.get_by_id(id_usuario)

        conn = get_db_connection()
        cur = conn.cursor()
        try:
            sets: List[str] = []
            params: List[Any] = []
            allowed_cols = {"nombre", "apellido", "rol", "sector", "email", "activo"}
            for col, val in fields.items():
                if col in allowed_cols:
                    sets.append(f"{col} = ?")
                    params.append(val)

            if not sets:
                return self.get_by_id(id_usuario)

            params.append(id_usuario)
            query = f"""
                UPDATE dbo.usuario
                SET {", ".join(sets)}
                WHERE id_usuario = ?
            """
            cur.execute(query, params)
            conn.commit()
            return self.get_by_id(id_usuario)
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    def update_password(self, id_usuario: int, password_hash: str) -> bool:
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                "UPDATE dbo.usuario SET password_hash = ? WHERE id_usuario = ?",
                (password_hash, id_usuario),
            )
            conn.commit()
            return cur.rowcount > 0
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    def update_ultimo_acceso(self, id_usuario: int) -> None:
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                "UPDATE dbo.usuario SET ultimo_acceso = SYSUTCDATETIME() WHERE id_usuario = ?",
                (id_usuario,),
            )
            conn.commit()
        except Exception:
            conn.rollback()
        finally:
            cur.close()
            conn.close()

    def delete(self, id_usuario: int) -> bool:
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                "UPDATE dbo.usuario SET eliminado = 1, activo = 0 WHERE id_usuario = ?",
                (id_usuario,),
            )
            conn.commit()
            return cur.rowcount > 0
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()
