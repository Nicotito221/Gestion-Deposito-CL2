import os
import tempfile
from typing import List, Optional

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
        consolidator = ProductionConsolidator()
        consolidator.load_bom_from_db()

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

            tent_sum = 0.0
            tent_offset = 11 + len(sorted_daily)
            for col_idx, col_name in enumerate(all_tentative):
                val_idx = tent_offset + col_idx
                if val_idx < len(r):
                    tent_sum += float(r[val_idx])

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
