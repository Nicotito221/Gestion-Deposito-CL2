from datetime import date, timedelta
import os
import tempfile
from typing import Dict, List, Optional, Tuple

from app.repositories.despacho_repository import DespachoRepository
from app.repositories.explosion_consumo_repository import ExplosionConsumoRepository, FilaExplosionConsumo
from app.repositories.supply_repository import SupplyRepository
from app.schemas.supply import DemandRowOut, SupplyConsolidateResult, SupplySummaryOut
from app.services.conversion_orden_service import ConversionOrdenService
from consolidate_production import ProductionConsolidator


class SupplyService:
    def __init__(
        self,
        repository: Optional[SupplyRepository] = None,
        despacho_repository: Optional[DespachoRepository] = None,
        explosion_repository: Optional[ExplosionConsumoRepository] = None,
        conversion_service: Optional[ConversionOrdenService] = None,
    ) -> None:
        self.repository = repository or SupplyRepository()
        self.conversion_service = conversion_service or ConversionOrdenService()
        self.despacho_repository = despacho_repository or DespachoRepository()
        self.explosion_repository = explosion_repository or ExplosionConsumoRepository()

    def get_summary(self) -> SupplySummaryOut:
        return self.repository.get_consolidated_summary()

    def update_produccion_diaria(
        self, id_producto: str, fecha: "datetime.date", cantidad: float, id_usuario: Optional[int] = None
    ) -> None:
        self.repository.update_produccion_diaria(
            id_producto=id_producto,
            fecha=fecha,
            cantidad=cantidad,
            id_usuario=id_usuario,
        )

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

        parsed_items, convertidos, sin_match = self.conversion_service.aplicar(parsed_items)

        all_names = [os.path.basename(p) for p in (f1_paths or []) + (f2_paths or [])]
        id_importacion = self.repository.save_planned_production(
            file_names=all_names,
            items=parsed_items,
            plan_year=consolidator.plan_year,
            pn_reemplazados=[original for original, _ in convertidos],
        )

        mensaje = f"Consolidación completada y guardada en base de datos (Importación #{id_importacion}): {len(parsed_items)} ítems persistidos."
        if convertidos:
            mensaje += f" {len(convertidos)} PN convertidos con la tabla de conversiones."
        if sin_match:
            mensaje += f" {len(sin_match)} PN sin BOM ni conversión: {', '.join(sin_match[:20])}{'…' if len(sin_match) > 20 else ''}."
        if f1_paths:
            try:
                filas = self.actualizar_explosion_consumo(id_importacion)
                mensaje += f" Explosión de consumo actualizada: {filas} filas."
            except Exception as err:
                mensaje += f" No se pudo actualizar la explosión de consumo: {err}"

        return SupplyConsolidateResult(
            total_items=len(parsed_items),
            total_unidades=total_unidades,
            columnas_diarias=sorted_daily,
            columnas_tentativas=all_tentative,
            items=parsed_items,
            mensaje=mensaje,
        )

    def actualizar_explosion_consumo(self, id_importacion: Optional[int] = None, meses_extra: int = 2) -> int:
        from app.repositories.supply_repository import SPANISH_MONTHS
        from consolidate_production import get_second_wednesday

        consolidator, _, mes_firme = self._construir_desde_db()
        if mes_firme is None:
            return self.explosion_repository.reemplazar([], id_importacion)

        anio_firme, num_mes_firme = mes_firme
        indice_firme = anio_firme * 12 + num_mes_firme - 1
        meses_por_abrev = {abrev: num for num, abrev in SPANISH_MONTHS.items()}

        def periodo_de_columna(col: str) -> Optional[Tuple[str, date]]:
            partes_dia = col.split("-", 1)
            if len(partes_dia) == 2 and partes_dia[0].isdigit():
                mes_dia = meses_por_abrev.get(partes_dia[1].lower())
                if mes_dia is None:
                    return None
                anio_dia = anio_firme + (1 if mes_dia < num_mes_firme else 0)
                if not 0 <= (anio_dia * 12 + mes_dia - 1) - indice_firme <= meses_extra:
                    return None
                return "D", date(anio_dia, mes_dia, int(partes_dia[0]))
            partes_mes = col.split()
            if len(partes_mes) == 2 and partes_mes[1].isdigit():
                mes = meses_por_abrev.get(partes_mes[0].lower())
                anio = int(partes_mes[1])
                if mes is not None and 0 < (anio * 12 + mes - 1) - indice_firme <= meses_extra:
                    return "M", get_second_wednesday(anio, mes)
            return None

        headers, rows = consolidator.calculate_consumption()
        columnas = [(idx, periodo_de_columna(col)) for idx, col in enumerate(headers[3:-1], start=3)]
        columnas = [(idx, periodo) for idx, periodo in columnas if periodo is not None]

        filas: List[FilaExplosionConsumo] = []
        for row in rows:
            material = str(row[0]).strip()
            if not material:
                continue
            for idx, (tipo, fecha) in columnas:
                cantidad = float(row[idx] or 0.0)
                if cantidad > 0:
                    filas.append(
                        FilaExplosionConsumo(material, str(row[1] or ""), str(row[2] or ""), tipo, fecha, cantidad)
                    )

        return self.explosion_repository.reemplazar(filas, id_importacion)

    def _build_consolidator_from_db(self) -> Tuple[ProductionConsolidator, str]:
        consolidator, filename, _ = self._construir_desde_db()
        return consolidator, filename

    def _construir_desde_db(self) -> Tuple[ProductionConsolidator, str, Optional[Tuple[int, int]]]:
        from app.repositories.supply_repository import SPANISH_MONTHS
        from consolidate_production import (
            DEFAULT_MATERIALS_CANDIDATES,
            clean_code,
            find_default_file,
            format_part_number,
            get_second_wednesday,
        )

        consolidator = ProductionConsolidator()
        consolidator.load_bom_from_db()

        mapping_file = find_default_file(DEFAULT_MATERIALS_CANDIDATES)
        if mapping_file:
            consolidator.load_mapping_file(mapping_file)
            consolidator.load_materials_catalog(mapping_file)

        filename, rows = self.repository.get_latest_demand_for_export()

        month_dates: dict = {}
        for _, fecha_dt, cant, _, _, _ in rows:
            if float(cant or 0.0) > 0 and hasattr(fecha_dt, "year") and hasattr(fecha_dt, "month"):
                k = (fecha_dt.year, fecha_dt.month)
                month_dates.setdefault(k, set()).add(fecha_dt)

        daily_month_keys: set = set()
        if month_dates:
            mes_inicial = min(month_dates.keys())
            daily_month_keys = {mes_inicial} | {
                ym for ym in self.repository.get_meses_diarios() if ym in month_dates and ym > mes_inicial
            }
        if month_dates:
            consolidator.plan_year = min(month_dates.keys())[0]

        for prod_id, fecha_dt, cant, desc, tasa, centro in rows:
            canonical = clean_code(prod_id)
            item = consolidator.get_or_create_demand(canonical)
            item.n_parte = format_part_number(prod_id)
            item.codigo_tasa_tbar = format_part_number(tasa)
            item.descripcion = str(desc or "")
            if (fecha_dt.year, fecha_dt.month) in daily_month_keys:
                col_name = f"{fecha_dt.day}-{SPANISH_MONTHS.get(fecha_dt.month, 'mes')}"
                if col_name not in consolidator.daily_columns:
                    consolidator.daily_columns.append(col_name)
                    consolidator.custom_tentative_dates[col_name] = fecha_dt.strftime("%d.%m.%Y")
                item.daily_values[col_name] = item.daily_values.get(col_name, 0.0) + float(cant)
            elif float(cant or 0.0) > 0:
                col_name = f"{SPANISH_MONTHS.get(fecha_dt.month, 'mes').capitalize()} {fecha_dt.year}"
                if col_name not in consolidator.tentative_columns_f2:
                    consolidator.tentative_columns_f2.append(col_name)
                item.tentative_values[col_name] = item.tentative_values.get(col_name, 0.0) + float(cant)
                sec_wed = get_second_wednesday(fecha_dt.year, fecha_dt.month)
                sec_wed_str = f"{sec_wed.day:02d}.{sec_wed.month:02d}.{sec_wed.year}"
                consolidator.custom_tentative_dates[col_name] = sec_wed_str
                consolidator.custom_tentative_dates[f"{fecha_dt.year}-{fecha_dt.month:02d}"] = sec_wed_str
                consolidator.custom_tentative_dates[fecha_dt.month] = sec_wed_str
            consolidator.register_demand_por_codigo(item)

        self._agregar_despachos(consolidator, month_dates, daily_month_keys)
        return consolidator, filename, (min(month_dates.keys()) if month_dates else None)

    def _agregar_despachos(
        self,
        consolidator: ProductionConsolidator,
        month_dates: Dict[Tuple[int, int], set],
        daily_month_keys: set,
    ) -> None:
        from app.repositories.supply_repository import SPANISH_MONTHS
        from app.core.time import get_argentina_today
        from consolidate_production import clean_code, format_part_number, get_second_wednesday

        hoy = get_argentina_today()
        anio_desde, mes_desde = min(month_dates.keys()) if month_dates else (hoy.year, hoy.month)
        mensuales = self.despacho_repository.get_mensual_desde(anio_desde, mes_desde)
        if not mensuales:
            return

        diarios_por_mes: Dict[Tuple[int, int], Dict[str, Dict[date, float]]] = {}
        for (anio, mes) in {(a, m) for (_, a, m) in mensuales if (a, m) in daily_month_keys}:
            fin = date(anio + 1, 1, 1) if mes == 12 else date(anio, mes + 1, 1)
            diarios_por_mes[(anio, mes)] = self.despacho_repository.get_diario(
                None, date(anio, mes, 1), fin - timedelta(days=1)
            )

        for (prod_id, anio, mes), cant in mensuales.items():
            if cant <= 0:
                continue
            item = consolidator.get_or_create_demand(clean_code(prod_id))
            if not item.n_parte:
                item.n_parte = format_part_number(prod_id)
                item.codigo_tasa_tbar = item.n_parte
            if (anio, mes) in daily_month_keys:
                for dia, cuota in diarios_por_mes.get((anio, mes), {}).get(prod_id, {}).items():
                    col_name = f"{dia.day}-{SPANISH_MONTHS.get(dia.month, 'mes')}"
                    if col_name not in consolidator.daily_columns:
                        consolidator.daily_columns.append(col_name)
                    item.daily_values[col_name] = item.daily_values.get(col_name, 0.0) + cuota
            else:
                col_name = f"{SPANISH_MONTHS.get(mes, 'mes').capitalize()} {anio}"
                if col_name not in consolidator.tentative_columns_f2:
                    consolidator.tentative_columns_f2.append(col_name)
                item.tentative_values[col_name] = item.tentative_values.get(col_name, 0.0) + cant
                if col_name not in consolidator.custom_tentative_dates:
                    sec_wed = get_second_wednesday(anio, mes)
                    consolidator.custom_tentative_dates[col_name] = sec_wed.strftime("%d.%m.%Y")
            consolidator.register_demand_item(item)

    @staticmethod
    def _aplicar_fechas_tentativas(
        consolidator: ProductionConsolidator, fechas_tentativas: Optional[Dict[str, str]]
    ) -> None:
        for col_key, iso_val in (fechas_tentativas or {}).items():
            val_clean = str(iso_val or "").strip()
            if not val_clean:
                continue
            if "-" in val_clean and len(val_clean) >= 10:
                parts = val_clean[:10].split("-")
                if len(parts) == 3 and len(parts[0]) == 4:
                    fmt_date = f"{parts[2]}.{parts[1]}.{parts[0]}"
                else:
                    fmt_date = val_clean.replace("-", ".")
            else:
                fmt_date = val_clean.replace("/", ".")
            consolidator.custom_tentative_dates[col_key] = fmt_date

    def export_excel(
        self,
        fecha_corte: Optional[date] = None,
        fechas_tentativas: Optional[Dict[str, str]] = None,
    ) -> Tuple[str, str]:
        consolidator, filename = self._build_consolidator_from_db()
        self._aplicar_fechas_tentativas(consolidator, fechas_tentativas)
        if fecha_corte is not None:
            consolidator.aplicar_fecha_corte(fecha_corte)
        temp_file = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
        temp_path = temp_file.name
        temp_file.close()

        consolidator.export_excel(temp_path)
        base_name = os.path.splitext(filename)[0] if filename else "Consolidado"
        corte_sufijo = f"_desde_{fecha_corte.strftime('%Y%m%d')}" if fecha_corte else ""
        out_name = f"{base_name}_Demanda_BOM_Consumo{corte_sufijo}.xlsx"
        return temp_path, out_name

    def export_sap_txt(
        self,
        fecha_corte: Optional[date] = None,
        fechas_tentativas: Optional[Dict[str, str]] = None,
    ) -> Tuple[str, str]:
        consolidator, filename = self._build_consolidator_from_db()
        self._aplicar_fechas_tentativas(consolidator, fechas_tentativas)

        temp_file = tempfile.NamedTemporaryFile(suffix=".txt", delete=False)
        temp_path = temp_file.name
        temp_file.close()

        consolidator.export_sap_txt(temp_path, fecha_corte=fecha_corte)
        base_name = os.path.splitext(filename)[0] if filename else "Demanda"
        corte_sufijo = f"_desde_{fecha_corte.strftime('%Y%m%d')}" if fecha_corte else ""
        out_name = f"{base_name}_SAP_PIR{corte_sufijo}.txt"
        return temp_path, out_name

