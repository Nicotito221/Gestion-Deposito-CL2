from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple
from fastapi import HTTPException, status

from app.repositories.rundown_repository import RundownRepository
from app.schemas.rundown import (
    RundownDayCell,
    RundownMaterialGrid,
    RundownSupplierReport,
    RundownTransitoCreate,
    RundownTransitoOut,
    RundownSeccionItem,
    RundownSeccionCreate,
    RundownProveedorItem,
    RundownProveedorCreate,
    RundownProveedorUpdate,
    RundownIngresoDiaUpdate,
    RundownStockAjusteUpdate,
    RundownPeriodoItem,
    RundownCalendarioDia,
    RundownCalendarioMesOut,
    RundownCalendarioDiaUpdate,
    RundownCalendarioMesSave,
)

DIAS_ESP = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]


class RundownService:
    def __init__(self, repository: Optional[RundownRepository] = None) -> None:
        self._repo = repository or RundownRepository()

    def get_supplier_rundown(
        self,
        identifier: str,
        fecha_desde: Optional[date] = None,
        fecha_hasta: Optional[date] = None,
        alcance: str = "total",
        periodo: Optional[str] = None,
    ) -> RundownSupplierReport:
        proveedor = self._repo.get_proveedor(identifier)
        if not proveedor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Proveedor '{identifier}' no encontrado en el sistema",
            )

        parametros = self._repo.get_parametros_proveedor(proveedor["id_proveedor"])
        if not parametros:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No se encontraron parámetros de rundown configurados para {proveedor['nombre']}",
            )

        all_products = sorted(
            list(
                {
                    prod["id_producto"]
                    for param in parametros
                    for prod in param.get("productos", [])
                }
            )
        )

        meses_raw = self._repo.get_meses_disponibles()
        meses_disponibles = [
            RundownPeriodoItem(
                periodo=m["periodo"],
                anio=m["anio"],
                mes=m["mes"],
                label=m["label"],
                es_firme=m["es_firme"],
            )
            for m in meses_raw
        ]

        if periodo:
            target_periodo = periodo
        elif fecha_desde:
            target_periodo = f"{fecha_desde.year:04d}-{fecha_desde.month:02d}"
        elif meses_raw:
            target_periodo = meses_raw[0]["periodo"]
        else:
            target_periodo = "2026-09"

        anio, mes = [int(x) for x in target_periodo.split("-")]
        mes_info = next((m for m in meses_raw if m["periodo"] == target_periodo), None)
        es_mes_firme = mes_info["es_firme"] if mes_info else (mes == 9 and anio == 2026)

        d_start = date(anio, mes, 1)
        d_next = date(anio + 1, 1, 1) if mes == 12 else date(anio, mes + 1, 1)
        d_end = d_next - timedelta(days=1)

        dates_timeline: List[date] = []
        curr = d_start
        while curr <= d_end:
            dates_timeline.append(curr)
            curr += timedelta(days=1)

        overrides = self._repo.get_calendario_overrides(d_start, d_end)
        dias_laborales = [
            d for d in dates_timeline
            if (overrides[d][0] if d in overrides else d.weekday() < 5)
        ]
        cant_laborales = len(dias_laborales)

        if es_mes_firme:
            prod_map = self._repo.get_produccion_planificada(all_products, d_start, d_end)
        else:
            monthly_vols = self._repo.get_produccion_mensual_productos(all_products, anio, mes)
            prod_map = {}
            for p in all_products:
                tot_p = monthly_vols.get(p, 0.0)
                daily_p = round(tot_p / cant_laborales, 2) if cant_laborales > 0 else 0.0
                prod_map[p] = {d: daily_p for d in dias_laborales}

        transitos = self._repo.get_transitos(proveedor["id_proveedor"], d_start, d_end)
        ajustes_map = self._repo.get_stock_ajustes(proveedor["id_proveedor"], d_start, d_end)

        transito_map: Dict[Tuple[str, date, str], float] = {}
        for t in transitos:
            t_date = date.fromisoformat(t.fecha_eta)
            key = (t.id_material, t_date, t.tipo_via)
            transito_map[key] = transito_map.get(key, 0.0) + t.cantidad

        columnas_fechas = [d.strftime("%Y-%m-%d") for d in dates_timeline]
        material_grids: List[RundownMaterialGrid] = []

        for param in parametros:
            s_planta = float(round(self._compute_carryover_stock(param, all_products, d_start, "planta", meses_raw)))
            s_total = float(round(self._compute_carryover_stock(param, all_products, d_start, "total", meses_raw)))
            stock_corriente = s_planta if alcance == "planta" else s_total
            cells: List[RundownDayCell] = []
            total_uso = 0.0
            total_ingresos = 0.0

            for d in dates_timeline:
                ajuste_key = (param["id_parametro"], d, alcance)
                tiene_ajuste = ajuste_key in ajustes_map
                if tiene_ajuste:
                    stock_corriente = float(round(ajustes_map[ajuste_key]))

                veh_prod = sum(
                    prod_map.get(p["id_producto"], {}).get(d, 0.0) * p["factor_uso"]
                    for p in param["productos"]
                )

                uso = round(
                    veh_prod
                    * param["factor_conversion"]
                    * (1.0 + param["scrap_porcentaje"]),
                    2,
                )

                maritimo = transito_map.get((param["id_material"], d, "Maritimo"), 0.0)
                aereo = transito_map.get((param["id_material"], d, "Aereo"), 0.0)
                local = transito_map.get((param["id_material"], d, "Local"), 0.0)
                scrap = transito_map.get((param["id_material"], d, "AjusteScrap"), 0.0)

                ingresos_dia = maritimo + aereo + local
                stock_corriente = float(round(stock_corriente - uso + ingresos_dia - scrap))

                if uso > 0:
                    dias_cobertura = round(stock_corriente / uso, 2)
                elif stock_corriente > 0:
                    dias_cobertura = 999.0
                else:
                    dias_cobertura = 0.0

                alerta_quiebre = dias_cobertura < 5.0 or stock_corriente <= 0

                cells.append(
                    RundownDayCell(
                        fecha=d.strftime("%Y-%m-%d"),
                        dia_nombre=f"{d.strftime('%d/%m')} {DIAS_ESP[d.weekday()]}",
                        produccion_vehiculos=round(veh_prod, 1),
                        uso=uso,
                        plan_maritimo=maritimo,
                        pedidos_aereos=aereo,
                        entregas_locales=local,
                        ajuste_scrap=scrap,
                        stock_final=stock_corriente,
                        dias_cobertura=dias_cobertura,
                        alerta_quiebre=alerta_quiebre,
                        tiene_ajuste=tiene_ajuste,
                    )
                )

                total_uso += uso
                total_ingresos += ingresos_dia

            material_grids.append(
                RundownMaterialGrid(
                    id_parametro=param["id_parametro"],
                    id_material=param["id_material"],
                    descripcion=param["descripcion"],
                    categoria_cabina=param["categoria_cabina"],
                    unidad=param["unidad"],
                    lote_mts=param["lote_mts"],
                    scrap_porcentaje=param["scrap_porcentaje"],
                    stock_inicial=stock_corriente,
                    stock_inicial_planta=s_planta,
                    stock_inicial_total=s_total,
                    dias=cells,
                    total_uso=round(total_uso, 2),
                    total_ingresos=round(total_ingresos, 2),
                )
            )

        return RundownSupplierReport(
            id_proveedor=proveedor["id_proveedor"],
            codigo_proveedor=proveedor["codigo_proveedor"],
            nombre_proveedor=proveedor["nombre"],
            fecha_desde=d_start.strftime("%Y-%m-%d"),
            fecha_hasta=d_end.strftime("%Y-%m-%d"),
            alcance=alcance,
            periodo_actual=target_periodo,
            es_mes_firme=es_mes_firme,
            dias_laborales_mes=cant_laborales,
            meses_disponibles=meses_disponibles,
            columnas_fechas=columnas_fechas,
            materiales=material_grids,
        )

    def add_transito(self, data: RundownTransitoCreate) -> int:
        return self._repo.create_transito(data)

    def delete_transito(self, id_transito: int) -> bool:
        deleted = self._repo.delete_transito(id_transito)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tránsito ID {id_transito} no encontrado",
            )
        return True

    def update_stock_inicial(self, id_parametro: int, stock_inicial: float, tipo_stock: str = "total") -> bool:
        updated = self._repo.update_stock_inicial(id_parametro, stock_inicial, tipo_stock)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parámetro ID {id_parametro} no encontrado",
            )
        return True

    def upsert_stock_ajuste(self, data: RundownStockAjusteUpdate) -> bool:
        return self._repo.upsert_stock_ajuste(
            id_parametro=data.id_parametro,
            id_proveedor=data.id_proveedor,
            id_material=data.id_material,
            fecha=data.fecha,
            tipo_stock=data.tipo_stock,
            stock_ajustado=data.stock_ajustado,
            observacion=data.observacion,
        )

    def update_scrap_porcentaje(self, id_parametro: int, scrap_porcentaje: float) -> bool:
        if scrap_porcentaje < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El porcentaje de scrap no puede ser negativo",
            )
        updated = self._repo.update_scrap_porcentaje(id_parametro, scrap_porcentaje)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parámetro ID {id_parametro} no encontrado",
            )
        return True

    def upsert_ingreso_dia(self, data: RundownIngresoDiaUpdate) -> bool:
        return self._repo.upsert_ingreso_dia(
            id_proveedor=data.id_proveedor,
            id_material=data.id_material,
            fecha_eta=data.fecha_eta,
            tipo_via=data.tipo_via,
            cantidad=data.cantidad,
            po_numero=data.po_numero,
            factura_numero=data.factura_numero,
            observacion=data.observacion,
        )

    def get_secciones(self) -> List[RundownSeccionItem]:
        raw_list = self._repo.get_secciones_con_proveedores()
        result: List[RundownSeccionItem] = []
        for s in raw_list:
            provs = [
                RundownProveedorItem(
                    id_proveedor=p["id_proveedor"],
                    codigo_proveedor=p["codigo_proveedor"],
                    nombre=p["nombre"],
                    id_seccion=p["id_seccion"],
                    activo=p["activo"],
                    tiene_parametros=p["tiene_parametros"],
                )
                for p in s["proveedores"]
            ]
            result.append(
                RundownSeccionItem(
                    id_seccion=s["id_seccion"],
                    codigo=s["codigo"],
                    nombre=s["nombre"],
                    descripcion=s["descripcion"],
                    orden=s["orden"],
                    activo=s["activo"],
                    proveedores=provs,
                )
            )
        return result

    def create_seccion(self, data: RundownSeccionCreate) -> int:
        return self._repo.create_seccion(
            codigo=data.codigo,
            nombre=data.nombre,
            descripcion=data.descripcion,
            orden=data.orden,
        )

    def create_proveedor(self, data: RundownProveedorCreate) -> int:
        return self._repo.create_proveedor(
            codigo_proveedor=data.codigo_proveedor,
            nombre=data.nombre,
            id_seccion=data.id_seccion,
            pais=data.pais,
        )

    def update_proveedor(self, id_proveedor: int, data: RundownProveedorUpdate) -> bool:
        updated = self._repo.update_proveedor(
            id_proveedor=id_proveedor,
            nombre=data.nombre,
            id_seccion=data.id_seccion,
            activo=data.activo,
        )
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Proveedor ID {id_proveedor} no encontrado",
            )
        return True

    def get_calendario_mes(self, anio: int, mes: int) -> RundownCalendarioMesOut:
        MESES_NOMBRES = (
            "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        )
        d_start = date(anio, mes, 1)
        d_next = date(anio + 1, 1, 1) if mes == 12 else date(anio, mes + 1, 1)
        d_end = d_next - timedelta(days=1)

        overrides = self._repo.get_calendario_overrides(d_start, d_end)
        meses_disp = self._repo.get_meses_disponibles()
        mes_info = next((m for m in meses_disp if m["anio"] == anio and m["mes"] == mes), None)
        es_firme = mes_info["es_firme"] if mes_info else (mes == 9 and anio == 2026)
        volumen_total = mes_info["total_volumen"] if mes_info else 0.0

        dias: List[RundownCalendarioDia] = []
        curr = d_start
        dias_laborales_count = 0
        while curr <= d_end:
            if curr in overrides:
                es_lab, obs = overrides[curr]
            else:
                es_lab = (curr.weekday() < 5)
                obs = None

            if es_lab:
                dias_laborales_count += 1

            dias.append(
                RundownCalendarioDia(
                    fecha=curr.strftime("%Y-%m-%d"),
                    dia=curr.day,
                    dia_semana=curr.weekday(),
                    dia_nombre=f"{curr.strftime('%d/%m')} {DIAS_ESP[curr.weekday()]}",
                    es_laboral=es_lab,
                    observacion=obs,
                )
            )
            curr += timedelta(days=1)

        promedio_diario = round(volumen_total / dias_laborales_count, 1) if dias_laborales_count > 0 else 0.0

        return RundownCalendarioMesOut(
            anio=anio,
            mes=mes,
            mes_nombre=f"{MESES_NOMBRES[mes]} {anio}",
            es_mes_firme=es_firme,
            dias_laborales_count=dias_laborales_count,
            volumen_total_planificado=volumen_total,
            promedio_diario_estimado=promedio_diario,
            dias=dias,
        )

    def save_calendario_mes(self, data: RundownCalendarioMesSave) -> bool:
        tuplas = [
            (date.fromisoformat(d.fecha), d.es_laboral, d.observacion)
            for d in data.dias
        ]
        return self._repo.save_calendario_dias(tuplas)

    def _compute_carryover_stock(
        self,
        param: Dict[str, Any],
        all_products: List[str],
        target_start: date,
        alcance: str,
        meses_raw: List[Dict[str, Any]],
    ) -> float:
        init_date = param.get("fecha_stock_inicial") or date(2026, 9, 1)
        init_stock_field = "stock_inicial_planta" if alcance == "planta" else "stock_inicial_total"
        s_val = float(param.get(init_stock_field, 0.0) or param.get("stock_inicial_referencia", 0.0) or 0.0)

        if target_start <= init_date:
            return s_val

        end_prev = target_start - timedelta(days=1)
        prev_ajustes = self._repo.get_stock_ajustes(param["id_proveedor"], init_date, end_prev)
        prev_transitos = self._repo.get_transitos(param["id_proveedor"], init_date, end_prev)
        transito_map: Dict[Tuple[str, date, str], float] = {}
        for t in prev_transitos:
            t_date = date.fromisoformat(t.fecha_eta)
            transito_map[(t.id_material, t_date, t.tipo_via)] = transito_map.get((t.id_material, t_date, t.tipo_via), 0.0) + t.cantidad

        firm_prod_map = self._repo.get_produccion_planificada(all_products, init_date, end_prev)
        forecast_cache: Dict[Tuple[int, int], Dict[date, float]] = {}

        curr = init_date
        while curr <= end_prev:
            aj_key = (param["id_parametro"], curr, alcance)
            if aj_key in prev_ajustes:
                s_val = prev_ajustes[aj_key]

            m_key = (curr.year, curr.month)
            m_info = next((m for m in meses_raw if m["anio"] == curr.year and m["mes"] == curr.month), None)
            is_firm = m_info["es_firme"] if m_info else (curr.month == 9 and curr.year == 2026)

            if is_firm:
                veh_prod = sum(
                    firm_prod_map.get(p["id_producto"], {}).get(curr, 0.0) * p["factor_uso"]
                    for p in param["productos"]
                )
            else:
                if m_key not in forecast_cache:
                    m_start = date(curr.year, curr.month, 1)
                    m_next = date(curr.year + 1, 1, 1) if curr.month == 12 else date(curr.year, curr.month + 1, 1)
                    m_end = m_next - timedelta(days=1)
                    m_ovs = self._repo.get_calendario_overrides(m_start, m_end)
                    m_days: List[date] = []
                    c_tmp = m_start
                    while c_tmp <= m_end:
                        m_days.append(c_tmp)
                        c_tmp += timedelta(days=1)
                    m_lab = [d for d in m_days if (m_ovs[d][0] if d in m_ovs else d.weekday() < 5)]
                    n_lab = len(m_lab)
                    m_vols = self._repo.get_produccion_mensual_productos(all_products, curr.year, curr.month)
                    forecast_cache[m_key] = {}
                    for d_lab in m_lab:
                        forecast_cache[m_key][d_lab] = sum(
                            (m_vols.get(p["id_producto"], 0.0) / n_lab if n_lab > 0 else 0.0) * p["factor_uso"]
                            for p in param["productos"]
                        )
                veh_prod = forecast_cache[m_key].get(curr, 0.0)

            uso = round(veh_prod * param["factor_conversion"] * (1.0 + param["scrap_porcentaje"]), 2)
            maritimo = transito_map.get((param["id_material"], curr, "Maritimo"), 0.0)
            aereo = transito_map.get((param["id_material"], curr, "Aereo"), 0.0)
            local = transito_map.get((param["id_material"], curr, "Local"), 0.0)
            scrap = transito_map.get((param["id_material"], curr, "AjusteScrap"), 0.0)
            s_val = float(round(s_val - uso + (maritimo + aereo + local) - scrap))
            curr += timedelta(days=1)

        return float(round(s_val))

