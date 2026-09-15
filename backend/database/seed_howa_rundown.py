import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import get_db_connection


def seed_howa_parameters() -> None:
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT id_proveedor FROM dbo.proveedor WHERE codigo_proveedor = 'HOWA'")
    prov_row = cur.fetchone()
    if not prov_row:
        cur.execute(
            """
            INSERT INTO dbo.proveedor (codigo_proveedor, nombre, pais, activo)
            VALUES ('HOWA', 'HOWA TRAMICO S.A.', 'Argentina', 1)
            """
        )
        conn.commit()
        cur.execute("SELECT id_proveedor FROM dbo.proveedor WHERE codigo_proveedor = 'HOWA'")
        prov_row = cur.fetchone()

    id_proveedor = prov_row[0]

    materials = [
        {
            "id_material": "PU188-D1800",
            "descripcion": "TELA D-CAB",
            "unidad": "MTS",
            "lote_mts": 154.0,
            "scrap_porcentaje": 0.0350,
            "factor_conversion": 1.0000,
            "categoria_cabina": "D-CAB",
            "stock_inicial_referencia": 13752.80,
            "fecha_stock_inicial": "2026-09-01",
            "productos": [
                "63310-0KB11-B0",
                "63310-0KB11-C0",
                "63310-0KQ71-B0",
                "63310-0KQ71-C0",
            ],
        },
        {
            "id_material": "PU188-B1900",
            "descripcion": "TELA B-CAB",
            "unidad": "MTS",
            "lote_mts": 182.0,
            "scrap_porcentaje": 0.1000,
            "factor_conversion": 0.5000,
            "categoria_cabina": "B-CAB",
            "stock_inicial_referencia": 240.80,
            "fecha_stock_inicial": "2026-09-01",
            "productos": [
                "63310-0KA41-B0",
                "63310-0KB21-B0",
            ],
        },
        {
            "id_material": "PU188-S2600",
            "descripcion": "TELA SUV",
            "unidad": "MTS",
            "lote_mts": 133.0,
            "scrap_porcentaje": 0.1000,
            "factor_conversion": 1.0000,
            "categoria_cabina": "SUV",
            "stock_inicial_referencia": 1505.20,
            "fecha_stock_inicial": "2026-09-01",
            "productos": [
                "63310-0KJ31-B0",
                "63310-0KJ31-C0",
                "63310-0KL21-B0",
                "63310-0KR71-B0",
                "63310-0KR71-C0",
            ],
        },
    ]

    for mat in materials:
        cur.execute(
            """
            SELECT id_parametro FROM dbo.rundown_parametro_material
            WHERE id_proveedor = ? AND id_material = ?
            """,
            (id_proveedor, mat["id_material"]),
        )
        row = cur.fetchone()
        if not row:
            cur.execute(
                """
                INSERT INTO dbo.rundown_parametro_material 
                (id_proveedor, id_material, descripcion, unidad, lote_mts, scrap_porcentaje, factor_conversion, categoria_cabina, stock_inicial_referencia, fecha_stock_inicial, activo)
                OUTPUT INSERTED.id_parametro
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                """,
                (
                    id_proveedor,
                    mat["id_material"],
                    mat["descripcion"],
                    mat["unidad"],
                    mat["lote_mts"],
                    mat["scrap_porcentaje"],
                    mat["factor_conversion"],
                    mat["categoria_cabina"],
                    mat["stock_inicial_referencia"],
                    mat["fecha_stock_inicial"],
                ),
            )
            id_parametro = cur.fetchone()[0]
        else:
            id_parametro = row[0]
            cur.execute(
                """
                UPDATE dbo.rundown_parametro_material
                SET descripcion = ?, unidad = ?, lote_mts = ?, scrap_porcentaje = ?, factor_conversion = ?, categoria_cabina = ?, stock_inicial_referencia = ?, fecha_stock_inicial = ?
                WHERE id_parametro = ?
                """,
                (
                    mat["descripcion"],
                    mat["unidad"],
                    mat["lote_mts"],
                    mat["scrap_porcentaje"],
                    mat["factor_conversion"],
                    mat["categoria_cabina"],
                    mat["stock_inicial_referencia"],
                    mat["fecha_stock_inicial"],
                    id_parametro,
                ),
            )

        for prod in mat["productos"]:
            cur.execute(
                """
                IF NOT EXISTS (SELECT 1 FROM dbo.rundown_parametro_producto WHERE id_parametro = ? AND id_producto = ?)
                BEGIN
                    INSERT INTO dbo.rundown_parametro_producto (id_parametro, id_producto, factor_uso)
                    VALUES (?, ?, 1.0000)
                END
                """,
                (id_parametro, prod, id_parametro, prod),
            )

    conn.commit()
    cur.close()
    conn.close()


if __name__ == "__main__":
    seed_howa_parameters()
    print("Seed HOWA completado.")
