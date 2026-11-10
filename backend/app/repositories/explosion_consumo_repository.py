from datetime import date
from typing import List, NamedTuple, Optional

import pyodbc

from app.core.config import get_db_connection


class FilaExplosionConsumo(NamedTuple):
    id_material: str
    descripcion: str
    proveedor: str
    tipo_periodo: str
    fecha: date
    cantidad: float


class ExplosionConsumoRepository:
    def __init__(self, connection_factory=get_db_connection) -> None:
        self._get_connection = connection_factory

    def reemplazar(self, filas: List[FilaExplosionConsumo], id_importacion: Optional[int]) -> int:
        conn: pyodbc.Connection = self._get_connection()
        conn.autocommit = False
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                IF OBJECT_ID('dbo.explosion_consumo_material', 'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.explosion_consumo_material (
                        id_explosion_consumo BIGINT IDENTITY(1,1) PRIMARY KEY,
                        id_material VARCHAR(50) NOT NULL,
                        descripcion NVARCHAR(250) NULL,
                        proveedor NVARCHAR(150) NULL,
                        tipo_periodo CHAR(1) NOT NULL CHECK (tipo_periodo IN ('D', 'M')),
                        anio INT NOT NULL,
                        mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
                        fecha DATE NOT NULL,
                        cantidad DECIMAL(18,4) NOT NULL,
                        id_importacion INT NULL,
                        fecha_generacion DATETIME2 NOT NULL DEFAULT SYSDATETIME()
                    );
                    CREATE INDEX IX_explosion_consumo_material_material ON dbo.explosion_consumo_material (id_material, fecha);
                    CREATE INDEX IX_explosion_consumo_material_periodo ON dbo.explosion_consumo_material (anio, mes, tipo_periodo);
                END
                """
            )
            cursor.execute("DELETE FROM dbo.explosion_consumo_material")
            if filas:
                cursor.fast_executemany = True
                cursor.executemany(
                    """
                    INSERT INTO dbo.explosion_consumo_material
                        (id_material, descripcion, proveedor, tipo_periodo, anio, mes, fecha, cantidad, id_importacion)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        (
                            f.id_material[:50],
                            (f.descripcion or None) and f.descripcion[:250],
                            (f.proveedor or None) and f.proveedor[:150],
                            f.tipo_periodo,
                            f.fecha.year,
                            f.fecha.month,
                            f.fecha,
                            round(f.cantidad, 4),
                            id_importacion,
                        )
                        for f in filas
                    ],
                )
            conn.commit()
            return len(filas)
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()
