import os
import sys
import re
from pathlib import Path
import pyodbc

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.core.config import get_connection_string, get_db_connection
from app.core.security import hash_password

SQL_INIT_FILE = Path(__file__).resolve().parent / "00_init_database.sql"


def ensure_database_exists() -> None:
    conn_str = get_connection_string()
    db_name_match = re.search(r"DATABASE=([^;]+)", conn_str, re.IGNORECASE)
    db_name = db_name_match.group(1).strip() if db_name_match else "GestionDeposito"

    master_conn_str = re.sub(
        r"DATABASE=[^;]+;",
        "DATABASE=master;",
        conn_str,
        flags=re.IGNORECASE,
    )
    if "DATABASE=" not in master_conn_str:
        master_conn_str += ";DATABASE=master;"

    conn = pyodbc.connect(master_conn_str, autocommit=True)
    cursor = conn.cursor()
    try:
        cursor.execute(
            f"IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = '{db_name}') CREATE DATABASE [{db_name}];"
        )
    finally:
        cursor.close()
        conn.close()


def execute_sql_file(file_path: Path) -> None:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        content = file_path.read_text(encoding="utf-8")
        batches = [b.strip() for b in re.split(r"(?im)^\s*GO\s*$", content) if b.strip()]
        for batch in batches:
            cursor.execute(batch)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def seed_admin_user(password: str = "admin123") -> None:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        pwd_hash = hash_password(password)
        cursor.execute("SELECT id_usuario FROM dbo.usuario WHERE username = 'admin'")
        row = cursor.fetchone()
        if row:
            cursor.execute(
                """
                UPDATE dbo.usuario
                SET password_hash = ?,
                    nombre = 'Administrador',
                    apellido = 'Sistema',
                    rol = 'administrador',
                    sector = 'TODOS',
                    activo = 1,
                    eliminado = 0
                WHERE username = 'admin'
                """,
                (pwd_hash,),
            )
        else:
            cursor.execute(
                """
                INSERT INTO dbo.usuario (
                    username, password_hash, nombre, apellido, rol, activo, sector, email, eliminado
                )
                VALUES ('admin', ?, 'Administrador', 'Sistema', 'administrador', 1, 'TODOS', 'admin@gestiondeposito.com', 0)
                """,
                (pwd_hash,),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def seed_default_configuration() -> None:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            IF NOT EXISTS (SELECT 1 FROM dbo.configuracion_sistema WHERE clave = 'factor_consumo_siguiente')
            BEGIN
                INSERT INTO dbo.configuracion_sistema (clave, valor, descripcion)
                VALUES ('factor_consumo_siguiente', '0.65', 'Factor multiplicador para el consumo del día siguiente en la regla de pedido sugerido');
            END
            """
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def reset_clean_state(wipe_operational_data: bool = False) -> None:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id_usuario FROM dbo.usuario WHERE username = 'admin'")
        admin_row = cursor.fetchone()
        if not admin_row:
            return
        admin_id = int(admin_row[0])

        if wipe_operational_data:
            cursor.execute("DELETE FROM dbo.material_remito")
            cursor.execute("DELETE FROM dbo.material_pedido")
            cursor.execute("DELETE FROM dbo.material_conteo")
            cursor.execute("DELETE FROM dbo.ingreso_material_detalle")
            cursor.execute("DELETE FROM dbo.etiqueta_qr")
            cursor.execute("DELETE FROM dbo.movimiento_stock")
            cursor.execute("DELETE FROM dbo.remito")
            cursor.execute("UPDATE dbo.pedido SET id_conteo = NULL")
            cursor.execute("UPDATE dbo.conteo SET id_pedido_generado = NULL")
            cursor.execute("DELETE FROM dbo.pedido")
            cursor.execute("DELETE FROM dbo.conteo")
            cursor.execute("DELETE FROM dbo.ingreso_material")
            cursor.execute("DELETE FROM dbo.rundown_transito_arribo")
            cursor.execute("DELETE FROM dbo.rundown_stock_ajuste")
            cursor.execute("DELETE FROM dbo.rundown_diario")
            cursor.execute("DELETE FROM dbo.auditoria")
            cursor.execute("DELETE FROM dbo.importacion_error")
            cursor.execute("DELETE FROM dbo.produccion_planificada")
            cursor.execute("DELETE FROM dbo.produccion_real")
            cursor.execute("DELETE FROM dbo.importacion_archivo")
        else:
            cursor.execute("UPDATE dbo.auditoria SET id_usuario = ? WHERE id_usuario <> ?", (admin_id, admin_id))
            cursor.execute("UPDATE dbo.conteo SET id_usuario = ? WHERE id_usuario <> ?", (admin_id, admin_id))
            cursor.execute("UPDATE dbo.movimiento_stock SET id_usuario = ? WHERE id_usuario <> ?", (admin_id, admin_id))
            cursor.execute("UPDATE dbo.pedido SET id_usuario_solicitante = ? WHERE id_usuario_solicitante <> ?", (admin_id, admin_id))
            cursor.execute("UPDATE dbo.remito SET id_usuario_emisor = ? WHERE id_usuario_emisor <> ?", (admin_id, admin_id))
            cursor.execute("UPDATE dbo.ingreso_material SET id_usuario = ? WHERE id_usuario <> ?", (admin_id, admin_id))
            cursor.execute("UPDATE dbo.ingreso_material SET id_usuario_recepcion = ? WHERE id_usuario_recepcion IS NOT NULL AND id_usuario_recepcion <> ?", (admin_id, admin_id))
            cursor.execute("UPDATE dbo.produccion_planificada SET id_usuario = ? WHERE id_usuario <> ?", (admin_id, admin_id))
            cursor.execute("UPDATE dbo.produccion_real SET id_usuario = ? WHERE id_usuario <> ?", (admin_id, admin_id))
            cursor.execute("UPDATE dbo.importacion_archivo SET id_usuario = ? WHERE id_usuario <> ?", (admin_id, admin_id))
            cursor.execute("UPDATE dbo.etiqueta_qr SET id_usuario_emision = ? WHERE id_usuario_emision <> ?", (admin_id, admin_id))
            cursor.execute("UPDATE dbo.etiqueta_qr SET id_usuario_recepcion = ? WHERE id_usuario_recepcion IS NOT NULL AND id_usuario_recepcion <> ?", (admin_id, admin_id))
            cursor.execute("UPDATE dbo.rundown_diario SET id_usuario_actualizacion = ? WHERE id_usuario_actualizacion <> ?", (admin_id, admin_id))

        cursor.execute("DELETE FROM dbo.usuario WHERE username <> 'admin'")
        cursor.execute(
            """
            IF OBJECT_ID('dbo.rundown_parametro_material_backup_20260930', 'U') IS NOT NULL
                DROP TABLE dbo.rundown_parametro_material_backup_20260930;
            IF OBJECT_ID('dbo.rundown_stock_ajuste_backup_20260930', 'U') IS NOT NULL
                DROP TABLE dbo.rundown_stock_ajuste_backup_20260930;
            IF OBJECT_ID('dbo.stock_deposito_backup_20260930', 'U') IS NOT NULL
                DROP TABLE dbo.stock_deposito_backup_20260930;
            """
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def init_database(reset_other_users: bool = True, wipe_operational_data: bool = False) -> None:
    ensure_database_exists()
    execute_sql_file(SQL_INIT_FILE)
    seed_default_configuration()
    seed_admin_user("admin123")
    if reset_other_users:
        reset_clean_state(wipe_operational_data=wipe_operational_data)


if __name__ == "__main__":
    wipe = "--wipe" in sys.argv
    init_database(reset_other_users=True, wipe_operational_data=wipe)
    print("Inicialización de la base de datos completada exitosamente.")
