import os
import sys
import pyodbc

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import get_db_connection


def main() -> None:
    excel_path = r"C:\Users\nangerossa\Desktop\BOM.XLS"
    if not os.path.exists(excel_path):
        print(f"Error: No se encontro el archivo en {excel_path}")
        sys.exit(1)

    print("=" * 70)
    print("TEST 1: VERIFICACION DE COBERTURA TOTAL DE IDS (EXCEL VS SQL)")
    print("=" * 70)

    excel_ids = set()
    encodings = ["utf-8", "latin-1", "cp1252"]
    lines = []
    for enc in encodings:
        try:
            with open(excel_path, mode="r", encoding=enc) as f:
                lines = f.readlines()
            break
        except UnicodeDecodeError:
            continue

    for line in lines:
        cols = line.split("\t")
        for idx in range(min(6, len(cols))):
            val = cols[idx].strip().upper()
            if val and val not in ("MATERIAL", "PARTE", "CODIGO", "Nº PARTE", "N° PARTE"):
                excel_ids.add(val[:30])
                break

    print(f"Total IDs unicos encontrados en el archivo Excel: {len(excel_ids):,}")

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id_material FROM dbo.material")
    db_ids = {row[0].strip().upper() for row in cursor.fetchall()}
    print(f"Total IDs existentes en dbo.material en SQL Server: {len(db_ids):,}")

    faltantes = excel_ids - db_ids
    if not faltantes:
        print(f"\n[OK EXITO] Cobertura 100%: Los {len(excel_ids):,} IDs del Excel existen en SQL Server.")
        print("Diferencia de IDs faltantes: 0")
    else:
        print(f"\n[ERROR] Hay {len(faltantes)} IDs del Excel que no existen en SQL Server:")
        for f_id in list(faltantes)[:10]:
            print(f"  - {f_id}")

    print("\n" + "=" * 70)
    print("TEST 2: VERIFICACION DE ARBOL COMPLETO PARA UN PRODUCTO (NIVEL 0/1)")
    print("=" * 70)

    test_prod = "79210-0K781"
    print(f"Auditando arbol jerarquico para el producto: {test_prod}")

    cursor.execute("""
        SELECT b.orden, b.nivel, b.id_padre, b.id_hijo, m.nombre, b.cantidad, b.unidad
        FROM dbo.bom_estructura b
        INNER JOIN dbo.material m ON b.id_hijo = m.id_material
        WHERE b.id_version = 1 AND b.id_producto_raiz = ?
        ORDER BY b.orden
    """, test_prod)
    relaciones_arbol = cursor.fetchall()

    print(f"Total registros secuenciales en el arbol de {test_prod}: {len(relaciones_arbol)}")
    print("\nPrimeras ramas del arbol (orden exacto del Excel):")
    print(f"{'ORDEN':<6} | {'NIVEL':<6} | {'PADRE':<16} -> {'HIJO':<16} | {'CANT':<8} | {'UNIDAD'} | {'NOMBRE'}")
    print("-" * 90)
    for r in relaciones_arbol[:20]:
        indent = "  " * (r[1] - 1)
        print(f"{r[0]:<6} | Nivel {r[1]:<1} | {r[2]:<16} -> {indent}{r[3]:<14} | {r[5]:<8.4f} | {r[6]:<6} | {r[4][:30]}")

    print("\nConsumos consolidados calculados en dbo.bom_explosion_plana para el Rundown:")
    cursor.execute("""
        SELECT p.id_material_insumo, m.nombre, p.factor_consumo_total, p.unidad
        FROM dbo.bom_explosion_plana p
        INNER JOIN dbo.material m ON p.id_material_insumo = m.id_material
        WHERE p.id_producto_raiz = ?
        ORDER BY p.id_material_insumo
    """, test_prod)
    plana_rows = cursor.fetchall()
    print(f"Total componentes terminales consolidados: {len(plana_rows)}")
    for row in plana_rows[:10]:
        print(f"  - Insumo: {row[0]:<16} | Cantidad total: {row[2]:<8.4f} {row[3]:<4} | {row[1][:35]}")

    conn.close()


if __name__ == "__main__":
    main()
