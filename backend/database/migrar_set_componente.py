import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import openpyxl
import pyodbc
from app.core.config import get_db_connection

def run_migration_set_componente(source_excel: str) -> None:
    conn = get_db_connection()
    cur = conn.cursor()

    with open(os.path.join(os.path.dirname(__file__), "02_crear_tabla_set_componente.sql"), "r", encoding="utf-8") as f:
        sql_script = f.read()

    for batch in sql_script.split("GO"):
        cmd = batch.strip()
        if cmd:
            cur.execute(cmd)
    conn.commit()

    cur.execute("SELECT COUNT(*) FROM dbo.set_componente")
    existing_count = cur.fetchone()[0]

    wb = openpyxl.load_workbook(source_excel, data_only=True, read_only=True)
    ws = wb["BOM"]

    rows_to_insert = []
    for r in ws.iter_rows(values_only=True, min_row=2):
        if r and r[2] and r[4]:
            sector = str(r[0] or "").strip()
            if sector.lower() == "amnrest":
                sector = "Armrest"
            sd = str(r[1] or "").strip()
            codigo_tasa = str(r[2]).strip()
            codigo_sap_padre = str(r[3] or codigo_tasa).strip()
            id_hijo = str(r[4]).strip()
            cantidad = float(r[5]) if r[5] is not None else 1.0
            rows_to_insert.append((sector, sd, codigo_tasa, codigo_sap_padre, id_hijo, cantidad))

    if existing_count == 0 and rows_to_insert:
        cur.fast_executemany = True
        cur.executemany("""
            INSERT INTO dbo.set_componente (sector, sd, codigo_tasa, codigo_sap_padre, id_material_hijo, cantidad)
            VALUES (?, ?, ?, ?, ?, ?)
        """, rows_to_insert)
        conn.commit()
        print(f"Insertadas {len(rows_to_insert)} recetas en dbo.set_componente exitosamente.")
    else:
        print(f"dbo.set_componente ya cuenta con {existing_count} registros.")

    cur.close()
    conn.close()

if __name__ == "__main__":
    excel_path = r"C:\Users\nangerossa\Desktop\Cargar orden suministro\Interfaz.xlsm"
    run_migration_set_componente(excel_path)
