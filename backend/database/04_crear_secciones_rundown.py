import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import get_db_connection


def run_migration():
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("UPDATE dbo.proveedor SET nombre = 'HOWA' WHERE codigo_proveedor = 'HOWA'")
    cur.execute("UPDATE dbo.rundown_parametro_material SET descripcion = 'ESPUMA D-CAB' WHERE id_material = 'PU188-D1800'")
    cur.execute("UPDATE dbo.rundown_parametro_material SET descripcion = 'ESPUMA B-CAB' WHERE id_material = 'PU188-B1900'")
    cur.execute("UPDATE dbo.rundown_parametro_material SET descripcion = 'ESPUMA SUV' WHERE id_material = 'PU188-S2600'")

    cur.execute("""
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rundown_seccion')
    BEGIN
        CREATE TABLE dbo.rundown_seccion (
            id_seccion INT IDENTITY(1,1) PRIMARY KEY,
            codigo VARCHAR(50) NOT NULL UNIQUE,
            nombre VARCHAR(100) NOT NULL,
            descripcion VARCHAR(255) NULL,
            orden INT NOT NULL DEFAULT 1,
            activo BIT NOT NULL DEFAULT 1,
            fecha_creacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
        );
    END
    """)

    cur.execute("""
    IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID('dbo.proveedor') AND name = 'id_seccion'
    )
    BEGIN
        ALTER TABLE dbo.proveedor ADD id_seccion INT NULL FOREIGN KEY REFERENCES dbo.rundown_seccion(id_seccion);
    END
    """)
    conn.commit()

    sections = [
        ('HEADLINER', 'Headliner', 'Línea de techos y recubrimientos', 1),
        ('SEAT', 'Seat', 'Línea de asientos y tapicería', 2),
        ('DOOR', 'Door', 'Línea de paneles de puertas', 3),
        ('ARMREST', 'Armrest', 'Línea de apoyabrazos', 4),
    ]

    for cod, nom, desc, ord_val in sections:
        cur.execute("""
            IF NOT EXISTS (SELECT 1 FROM dbo.rundown_seccion WHERE codigo = ?)
            BEGIN
                INSERT INTO dbo.rundown_seccion (codigo, nombre, descripcion, orden, activo)
                VALUES (?, ?, ?, ?, 1)
            END
        """, (cod, cod, nom, desc, ord_val))
    conn.commit()

    cur.execute("SELECT id_seccion FROM dbo.rundown_seccion WHERE codigo = 'HEADLINER'")
    id_headliner = cur.fetchone()[0]

    cur.execute("UPDATE dbo.proveedor SET id_seccion = ?, nombre = 'HOWA' WHERE codigo_proveedor = 'HOWA'", (id_headliner,))

    hl_suppliers = [
        ('TEXFYT', 'TEXFYT', 'Argentina'),
        ('TAIO', 'TAIO TECHNO', 'Argentina'),
        ('TAIAN', 'TAIAN SANYING', 'China'),
        ('TGCUIR', 'TG-CUIR', 'Argentina'),
    ]

    for cod, nom, pais in hl_suppliers:
        cur.execute("""
            IF NOT EXISTS (SELECT 1 FROM dbo.proveedor WHERE codigo_proveedor = ?)
            BEGIN
                INSERT INTO dbo.proveedor (codigo_proveedor, nombre, pais, activo, id_seccion)
                VALUES (?, ?, ?, 1, ?)
            END
            ELSE
            BEGIN
                UPDATE dbo.proveedor SET id_seccion = ? WHERE codigo_proveedor = ?
            END
        """, (cod, cod, nom, pais, id_headliner, id_headliner, cod))

    conn.commit()
    print("Migracion de secciones ejecutada exitosamente.")

    cur.execute("""
        SELECT s.nombre as seccion, p.codigo_proveedor, p.nombre, p.id_seccion
        FROM dbo.proveedor p
        JOIN dbo.rundown_seccion s ON p.id_seccion = s.id_seccion
    """)
    for r in cur.fetchall():
        print(r)

    cur.close()
    conn.close()


if __name__ == "__main__":
    run_migration()
