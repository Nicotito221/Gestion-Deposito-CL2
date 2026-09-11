import os
import tempfile
from typing import List, Optional, Tuple

from app.repositories.supply_repository import SupplyRepository
from app.schemas.supply import DemandRowOut, SupplyConsolidateResult, SupplySummaryOut
from consolidate_production import ProductionConsolidator


class SupplyService:
    def __init__(self, repository: Optional[SupplyRepository] = None) -> None:
        self.repository = repository or SupplyRepository()

    def get_summary(self) -> SupplySummaryOut:
        return self.repository.get_consolidated_summary()

    def consolidar_archivos(
        self,
        f1_paths: Optional[List[str]] = None,
        f2_paths: Optional[List[str]] = None,
    ) -> SupplyConsolidateResult:
        from consolidate_production import DEFAULT_MATERIALS_CANDIDATES, find_default_file

        consolidator = ProductionConsolidator()
        consolidator.load_bom_from_db()

        mapping_file = find_default_file(DEFAULT_MATERIALS_CANDIDATES)
        if mapping_file:
            consolidator.load_mapping_file(mapping_file)
            consolidator.load_materials_catalog(mapping_file)

        for path in (f1_paths or []):
            if path and os.path.exists(path):
                consolidator.load_format_1_file(path)

        for path in (f2_paths or []):
            if path and os.path.exists(path):
                consolidator.load_format_2_file(path)

        headers, rows = consolidator.consolidate_demand()
        sorted_daily, all_tentative = consolidator.get_sorted_columns()

        parsed_items: List[DemandRowOut] = []
        total_unidades = 0.0

        for idx, r in enumerate(rows):
            pn = str(r[0])
            tasa = str(r[2]) or pn
            desc = str(r[5]) or pn
            dock = str(r[9]) if len(r) > 9 else ""
            tipo_caja = str(r[7]) if len(r) > 7 else ""
            cant_x_caja = int(r[8]) if len(r) > 8 and str(r[8]).isdigit() else 1

            daily_dict = {}
            for col_idx, col_name in enumerate(sorted_daily):
                val_idx = 11 + col_idx
                if val_idx < len(r):
                    daily_dict[col_name] = float(r[val_idx])

            tent_dict = {}
            tent_sum = 0.0
            tent_offset = 11 + len(sorted_daily)
            for col_idx, col_name in enumerate(all_tentative):
                val_idx = tent_offset + col_idx
                if val_idx < len(r):
                    val = float(r[val_idx])
                    if val > 0:
                        tent_dict[col_name] = val
                    tent_sum += val

            total_row = float(r[-1]) if r else 0.0
            total_unidades += total_row

            parsed_items.append(
                DemandRowOut(
                    id=str(idx + 1),
                    part_number=pn,
                    tasa_code=tasa,
                    description=desc,
                    dock=dock,
                    box_type=tipo_caja,
                    qty_per_box=cant_x_caja,
                    daily_values=daily_dict,
                    tentative_values=tent_dict,
                    tentative_total=tent_sum,
                    total=total_row,
                    status="validado" if consolidator.bom_items else "sin_bom",
                )
            )

        all_names = [os.path.basename(p) for p in (f1_paths or []) + (f2_paths or [])]
        id_importacion = self.repository.save_planned_production(
            file_names=all_names,
            items=parsed_items,
            plan_year=consolidator.plan_year,
        )

        return SupplyConsolidateResult(
            total_items=len(parsed_items),
            total_unidades=total_unidades,
            columnas_diarias=sorted_daily,
            columnas_tentativas=all_tentative,
            items=parsed_items,
            mensaje=f"Consolidación completada y guardada en base de datos (Importación #{id_importacion}): {len(parsed_items)} ítems persistidos.",
        )

    def _build_consolidator_from_db(self) -> Tuple[ProductionConsolidator, str]:
        from app.repositories.supply_repository import SPANISH_MONTHS
        from consolidate_production import (
            DEFAULT_MATERIALS_CANDIDATES,
            clean_code,
            find_default_file,
            format_part_number,
        )

        consolidator = ProductionConsolidator()
        consolidator.load_bom_from_db()

        mapping_file = find_default_file(DEFAULT_MATERIALS_CANDIDATES)
        if mapping_file:
            consolidator.load_mapping_file(mapping_file)
            consolidator.load_materials_catalog(mapping_file)

        filename, rows = self.repository.get_latest_demand_for_export()

        for prod_id, fecha_dt, cant, desc, tasa, centro in rows:
            canonical = clean_code(prod_id)
            item = consolidator.get_or_create_demand(canonical)
            item.n_parte = format_part_number(prod_id)
            item.codigo_tasa_tbar = format_part_number(tasa)
            item.descripcion = str(desc or "")
            if fecha_dt.month == 9:
                col_name = f"{fecha_dt.day}-{SPANISH_MONTHS.get(fecha_dt.month, 'mes')}"
                if col_name not in consolidator.daily_columns:
                    consolidator.daily_columns.append(col_name)
                item.daily_values[col_name] = item.daily_values.get(col_name, 0.0) + float(cant)
            else:
                col_name = SPANISH_MONTHS.get(fecha_dt.month, 'mes').capitalize()
                if col_name not in consolidator.tentative_columns_f2:
                    consolidator.tentative_columns_f2.append(col_name)
                item.tentative_values[col_name] = item.tentative_values.get(col_name, 0.0) + float(cant)
                consolidator.custom_tentative_dates[fecha_dt.month] = f"{fecha_dt.day:02d}.{fecha_dt.month:02d}.{fecha_dt.year}"
            consolidator.register_demand_item(item)

        return consolidator, filename

    def export_excel(self) -> Tuple[str, str]:
        consolidator, filename = self._build_consolidator_from_db()
        temp_file = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
        temp_path = temp_file.name
        temp_file.close()

        consolidator.export_excel(temp_path)
        base_name = os.path.splitext(filename)[0] if filename else "Consolidado"
        out_name = f"{base_name}_Demanda_BOM_Consumo.xlsx"
        return temp_path, out_name

    def export_sap_txt(self) -> Tuple[str, str]:
        consolidator, filename = self._build_consolidator_from_db()
        temp_file = tempfile.NamedTemporaryFile(suffix=".txt", delete=False)
        temp_path = temp_file.name
        temp_file.close()

        consolidator.export_sap_txt(temp_path)
        base_name = os.path.splitext(filename)[0] if filename else "Demanda"
        out_name = f"{base_name}_SAP_PIR.txt"
        return temp_path, out_name

