import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.bom_service import BomService


def main() -> None:
    default_path = r"C:\Users\nangerossa\Desktop\BOM.XLS"
    target_path = sys.argv[1] if len(sys.argv) > 1 else default_path

    if not os.path.exists(target_path):
        print(f"Error: No se encontro el archivo en {target_path}")
        sys.exit(1)

    print(f"Iniciando importacion masiva de BOM desde: {target_path}...")
    service = BomService()
    try:
        res = service.importar_bom(target_path)
        print("=" * 60)
        print("RESULTADO DE LA IMPORTACION")
        print("=" * 60)
        print(f"ID Version creada      : {res.id_version} (Activa/Vigente)")
        print(f"Archivo                : {res.nombre_archivo}")
        print(f"Lineas de archivo      : {res.total_lineas_procesadas:,}")
        print(f"Nuevos materiales      : {res.nuevos_materiales_registrados:,}")
        print(f"Relaciones creadas     : {res.total_relaciones_creadas:,}")
        print(f"Tiempo total           : {res.tiempo_segundos:.2f} segundos")
        print(f"Estado                 : {res.mensaje}")
        print("=" * 60)
    except Exception as e:
        print(f"Fallo critico durante la importacion: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
