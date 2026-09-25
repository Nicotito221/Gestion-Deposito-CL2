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
    MaterialCatalogoItem,
    RundownParametroMaterialCreate,
    RundownParametroMaterialItem,
    RundownLoteMaterialUpdate,
    RundownPeriodoProyeccionItem,
    RundownPeriodoProyeccionCreate,
    PlanSemanalPreviewOut,
    PlanSemanalDiaHeader,
    PlanSemanalFila,
    PlanSemanalConfirmRequest,
    PlanSemanalConfirmOut,
)
from app.services.plan_semanal_parser import parse_plan_semanal_excel

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
        id_seccion: Optional[int] = None,
    ) -> RundownSupplierReport:
        is_multi_prov = str(identifier).upper() in ["TODOS", "ALL"]
        if is_multi_prov:
            secciones_raw = self._repo.get_secciones_con_proveedores()
            if id_seccion:
                target_sec = next((s for s in secciones_raw if s["id_seccion"] == id_seccion), None)
                prov_list = target_sec["proveedores"] if target_sec else []
            else:
                prov_list = [p for s in secciones_raw for p in s["proveedores"]]

            prov_ids = [p["id_proveedor"] for p in prov_list]
            prov_map = {p["id_proveedor"]: p for p in prov_list}
            parametros = []
            for pid in prov_ids:
                parametros.extend(self._repo.get_parametros_proveedor(pid))

            proveedor_nombre = "Todos los Proveedores"
            proveedor_codigo = "TODOS"
            proveedor_id = 0
            default_rojo = 5.0
            default_amarillo = 15.0
        else:
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

            prov_ids = [proveedor["id_proveedor"]]
            prov_map = {proveedor["id_proveedor"]: proveedor}
            proveedor_nombre = proveedor["nombre"]
            proveedor_codigo = proveedor["codigo_proveedor"]
            proveedor_id = proveedor["id_proveedor"]
            default_rojo = float(proveedor.get("dias_alerta_rojo") if proveedor.get("dias_alerta_rojo") is not None else 5.0)
            default_amarillo = float(proveedor.get("dias_alerta_amarillo") if proveedor.get("dias_alerta_amarillo") is not None else 15.0)

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
                es_proyectado_manual=bool(m.get("es_proyectado_manual", False)),
                periodo_copia=m.get("periodo_copia"),
                total_volumen=float(m.get("total_volumen", 0.0)),
            )
            for m in meses_raw
        ]

        if periodo:
            target_periodo = periodo
        elif fecha_desde:
            target_periodo = f"{fecha_desde.year:04d}-{fecha_desde.month:02d}"
        else:
            from app.core.time import get_argentina_today
            now_period = get_argentina_today().strftime("%Y-%m")
            if any(m["periodo"] == now_period for m in meses_raw):
                target_periodo = now_period
            else:
                firme_p = next((m["periodo"] for m in meses_raw if m.get("es_firme")), None)
                target_periodo = firme_p or (meses_raw[0]["periodo"] if meses_raw else "2026-09")

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

        transitos = self._repo.get_transitos(prov_ids, d_start, d_end)
        ajustes_map = self._repo.get_stock_ajustes(prov_ids, d_start, d_end)
        pedidos_planta_map = (
            self._repo.get_entregas_pedidos_planta(prov_ids, d_start, d_end)
            if alcance == "planta"
            else {}
        )

        transito_map: Dict[Tuple[str, date, str], float] = {}
        transito_meta_map: Dict[Tuple[str, date, str], Dict[str, Any]] = {}
        for t in transitos:
            t_date = date.fromisoformat(t.fecha_eta)
            key = (t.id_material, t_date, t.tipo_via)
            transito_map[key] = transito_map.get(key, 0.0) + t.cantidad
            if key not in transito_meta_map:
                transito_meta_map[key] = {
                    "po_numero": t.po_numero,
                    "factura_numero": t.factura_numero,
                    "observacion": t.observacion,
                }
            else:
                if t.po_numero and not transito_meta_map[key]["po_numero"]:
                    transito_meta_map[key]["po_numero"] = t.po_numero
                if t.factura_numero and not transito_meta_map[key]["factura_numero"]:
                    transito_meta_map[key]["factura_numero"] = t.factura_numero
                if t.observacion and not transito_meta_map[key]["observacion"]:
                    transito_meta_map[key]["observacion"] = t.observacion

        columnas_fechas = [d.strftime("%Y-%m-%d") for d in dates_timeline]
        material_grids: List[RundownMaterialGrid] = []

        for param in parametros:
            p_info = prov_map.get(param["id_proveedor"], {})
            dias_rojo = float(p_info.get("dias_alerta_rojo", default_rojo))
            dias_amarillo = float(p_info.get("dias_alerta_amarillo", default_amarillo))
            es_dep_en_planta = bool(p_info.get("deposito_en_planta", False))
            stock_cl2 = 0.0 if es_dep_en_planta else float(param.get("stock_cl2", 0.0))

            s_planta = float(round(self._compute_carryover_stock(param, all_products, d_start, "planta", meses_raw)))
            s_total = float(round(self._compute_carryover_stock(param, all_products, d_start, "total", meses_raw)))
            if es_dep_en_planta:
                s_unificado = s_planta if s_planta > 0 else s_total
                s_planta = s_unificado
                s_total = s_unificado
                stock_corriente = s_unificado
            else:
                s_total = s_planta + stock_cl2
                stock_corriente = s_planta if alcance == "planta" else s_total
            cells: List[RundownDayCell] = []
            total_uso = 0.0
            total_ingresos = 0.0

            for d in dates_timeline:
                planta_key = (param["id_parametro"], d, "planta")
                total_key = (param["id_parametro"], d, "total")

                tiene_ajuste = False
                stock_real = 0.0

                if alcance == "planta":
                    if planta_key in ajustes_map:
                        tiene_ajuste = True
                        stock_real = float(round(ajustes_map[planta_key]))
                    elif es_dep_en_planta and total_key in ajustes_map:
                        tiene_ajuste = True
                        stock_real = float(round(ajustes_map[total_key]))
                else:
                    if total_key in ajustes_map:
                        tiene_ajuste = True
                        stock_real = float(round(ajustes_map[total_key]))
                    elif es_dep_en_planta and planta_key in ajustes_map:
                        tiene_ajuste = True
                        stock_real = float(round(ajustes_map[planta_key]))
                    elif not es_dep_en_planta and planta_key in ajustes_map:
                        tiene_ajuste = True
                        stock_real = float(round(ajustes_map[planta_key] + stock_cl2))

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
                if alcance == "planta":
                    local += pedidos_planta_map.get((param["id_material"], d), 0.0)
                scrap = transito_map.get((param["id_material"], d, "AjusteScrap"), 0.0)

                ingresos_dia = maritimo + aereo + local
                stock_teorico = float(round(stock_corriente - uso + ingresos_dia - scrap))

                desvio = 0.0
                if tiene_ajuste:
                    desvio = float(round(stock_real - stock_teorico))
                    stock_corriente = stock_real
                else:
                    stock_corriente = stock_teorico

                if uso > 0:
                    dias_cobertura = round(stock_corriente / uso, 2)
                elif stock_corriente > 0:
                    if cells:
                        dias_cobertura = cells[-1].dias_cobertura
                    else:
                        primer_uso = next(
                            (
                                round(
                                    sum(prod_map.get(p["id_producto"], {}).get(dt, 0.0) * p["factor_uso"] for p in param["productos"])
                                    * param["factor_conversion"]
                                    * (1.0 + param["scrap_porcentaje"]),
                                    2,
                                )
                                for dt in dates_timeline
                                if sum(prod_map.get(p["id_producto"], {}).get(dt, 0.0) * p["factor_uso"] for p in param["productos"]) > 0
                            ),
                            0.0,
                        )
                        dias_cobertura = round(stock_corriente / primer_uso, 2) if primer_uso > 0 else 0.0
                else:
                    dias_cobertura = 0.0

                alerta_quiebre = dias_cobertura < dias_rojo or stock_corriente <= 0

                m_meta = transito_meta_map.get((param["id_material"], d, "Maritimo"), {})
                a_meta = transito_meta_map.get((param["id_material"], d, "Aereo"), {})
                l_meta = transito_meta_map.get((param["id_material"], d, "Local"), {})

                cells.append(
                    RundownDayCell(
                        fecha=d.strftime("%Y-%m-%d"),
                        dia_nombre=f"{d.strftime('%d/%m')} {DIAS_ESP[d.weekday()]}",
                        produccion_vehiculos=round(veh_prod, 1),
                        uso=uso,
                        plan_maritimo=maritimo,
                        maritimo_po=m_meta.get("po_numero"),
                        maritimo_factura=m_meta.get("factura_numero"),
                        maritimo_obs=m_meta.get("observacion"),
                        pedidos_aereos=aereo,
                        aereo_po=a_meta.get("po_numero"),
                        aereo_factura=a_meta.get("factura_numero"),
                        aereo_obs=a_meta.get("observacion"),
                        entregas_locales=local,
                        local_po=l_meta.get("po_numero"),
                        local_factura=l_meta.get("factura_numero"),
                        local_obs=l_meta.get("observacion"),
                        ajuste_scrap=scrap,
                        stock_final=stock_corriente,
                        dias_cobertura=dias_cobertura,
                        alerta_quiebre=alerta_quiebre,
                        tiene_ajuste=tiene_ajuste,
                        desvio_ajuste=desvio,
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
                    tipo_empaque=param.get("tipo_empaque", "pallet"),
                    scrap_porcentaje=param["scrap_porcentaje"],
                    stock_inicial=stock_corriente,
                    stock_inicial_planta=s_planta,
                    stock_inicial_total=s_total,
                    dias=cells,
                    total_uso=round(total_uso, 2),
                    total_ingresos=round(total_ingresos, 2),
                    id_proveedor=param["id_proveedor"],
                    nombre_proveedor=p_info.get("nombre"),
                )
            )

        return RundownSupplierReport(
            id_proveedor=proveedor_id,
            codigo_proveedor=proveedor_codigo,
            nombre_proveedor=proveedor_nombre,
            fecha_desde=d_start.strftime("%Y-%m-%d"),
            fecha_hasta=d_end.strftime("%Y-%m-%d"),
            alcance=alcance,
            periodo_actual=target_periodo,
            es_mes_firme=es_mes_firme,
            dias_laborales_mes=cant_laborales,
            meses_disponibles=meses_disponibles,
            columnas_fechas=columnas_fechas,
            materiales=material_grids,
            dias_alerta_rojo=default_rojo,
            dias_alerta_amarillo=default_amarillo,
            deposito_en_planta=bool(proveedor.get("deposito_en_planta", False)) if not is_multi_prov else False,
            doh_sugerido_planta=float(proveedor.get("doh_sugerido_planta", 1.0)) if not is_multi_prov else 1.0,
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

    def delete_stock_ajuste(self, id_parametro: int, fecha: date, tipo_stock: str = "total") -> bool:
        return self._repo.delete_stock_ajuste(id_parametro, fecha, tipo_stock)

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
            fecha_origen=data.fecha_origen,
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
                    dias_alerta_rojo=float(p.get("dias_alerta_rojo") or 5.0),
                    dias_alerta_amarillo=float(p.get("dias_alerta_amarillo") or 15.0),
                    deposito_en_planta=bool(p.get("deposito_en_planta", False)),
                    doh_sugerido_planta=float(p.get("doh_sugerido_planta", 1.0)),
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
            deposito_en_planta=data.deposito_en_planta,
            doh_sugerido_planta=data.doh_sugerido_planta or 1.0,
        )

    def update_proveedor(self, id_proveedor: int, data: RundownProveedorUpdate) -> bool:
        updated = self._repo.update_proveedor(
            id_proveedor=id_proveedor,
            nombre=data.nombre,
            id_seccion=data.id_seccion,
            activo=data.activo,
            dias_alerta_rojo=data.dias_alerta_rojo,
            dias_alerta_amarillo=data.dias_alerta_amarillo,
            deposito_en_planta=data.deposito_en_planta,
            doh_sugerido_planta=data.doh_sugerido_planta,
        )
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Proveedor ID {id_proveedor} no encontrado",
            )
        return True

    def search_materiales_catalogo(self, query: str) -> List[MaterialCatalogoItem]:
        rows = self._repo.search_materiales_catalogo(query, limit=40)
        return [
            MaterialCatalogoItem(
                id_material=r["id_material"],
                nombre=r["nombre"],
                unidad=r["unidad"],
                categoria=r["categoria"],
                tipo_empaque=r.get("tipo_empaque", "unidad"),
                tamanio_lote=r.get("tamanio_lote", 1.0),
            )
            for r in rows
        ]

    def get_materiales_proveedor(
        self, id_proveedor: int
    ) -> List[RundownParametroMaterialItem]:
        rows = self._repo.get_parametros_material_proveedor(id_proveedor)
        return [
            RundownParametroMaterialItem(
                id_parametro=r["id_parametro"],
                id_proveedor=r["id_proveedor"],
                id_material=r["id_material"],
                descripcion=r["descripcion"],
                unidad=r["unidad"],
                lote_mts=r["lote_mts"],
                tipo_empaque=r.get("tipo_empaque", "pallet"),
                scrap_porcentaje=r["scrap_porcentaje"],
                factor_conversion=r["factor_conversion"],
                categoria_cabina=r["categoria_cabina"],
                stock_inicial_planta=r["stock_inicial_planta"],
                stock_inicial_total=r["stock_inicial_total"],
                doh_sugerido_planta=r.get("doh_sugerido_planta"),
                cant_productos=r["cant_productos"],
                activo=r["activo"],
            )
            for r in rows
        ]

    def update_lote_material(self, data: RundownLoteMaterialUpdate) -> None:
        self._repo.update_lote_material(
            id_parametro=data.id_parametro,
            lote_mts=data.lote_mts,
            tipo_empaque=data.tipo_empaque,
            id_material=data.id_material,
        )

    def add_material_proveedor(
        self, id_proveedor: int, data: RundownParametroMaterialCreate
    ) -> int:
        param_id = self._repo.create_or_update_parametro_material(
            id_proveedor=id_proveedor,
            data=data.model_dump(),
        )
        self._repo.auto_link_bom_productos(param_id, data.id_material)
        return param_id

    def delete_material_proveedor(self, id_parametro: int) -> bool:
        deleted = self._repo.delete_parametro_material(id_parametro)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parámetro de material ID {id_parametro} no encontrado",
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

    def get_periodos_proyeccion(self) -> List[RundownPeriodoProyeccionItem]:
        MESES_NOMBRES = (
            "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        )
        rows = self._repo.get_periodos_proyeccion()
        meses_disp = self._repo.get_meses_disponibles()
        official_set = {(m["anio"], m["mes"]) for m in meses_disp if not m.get("es_proyectado_manual")}

        result = []
        for r in rows:
            anio = r["anio"]
            mes = r["mes"]
            nom = MESES_NOMBRES[mes] if 1 <= mes <= 12 else str(mes)
            c_part = r["periodo_copia"].split("-")
            c_nom = MESES_NOMBRES[int(c_part[1])] if len(c_part) == 2 and 1 <= int(c_part[1]) <= 12 else r["periodo_copia"]
            result.append(
                RundownPeriodoProyeccionItem(
                    id_proyeccion=r["id_proyeccion"],
                    anio=anio,
                    mes=mes,
                    periodo=r["periodo"],
                    periodo_copia=r["periodo_copia"],
                    label=f"{nom} {anio} (Copia de {c_nom})",
                    observacion=r.get("observacion"),
                    es_oficial=(anio, mes) in official_set,
                    activo=r["activo"],
                )
            )
        return result

    def create_periodo_proyeccion(self, data: RundownPeriodoProyeccionCreate) -> int:
        return self._repo.create_or_update_periodo_proyeccion(
            anio=data.anio,
            mes=data.mes,
            periodo_copia=data.periodo_copia,
            observacion=data.observacion,
        )

    def delete_periodo_proyeccion(self, id_proyeccion: int) -> bool:
        deleted = self._repo.delete_periodo_proyeccion(id_proyeccion)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Proyección ID {id_proyeccion} no encontrada",
            )
        return True

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
        if alcance == "total" and not param.get("deposito_en_planta", False):
            stock_cl2 = float(param.get("stock_cl2", 0.0))
            s_val = float(param.get("stock_inicial_planta", 0.0) or 0.0) + stock_cl2

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
            stock_teorico = float(round(s_val - uso + (maritimo + aereo + local) - scrap))

            pl_key = (param["id_parametro"], curr, "planta")
            tot_key = (param["id_parametro"], curr, "total")
            if alcance == "planta":
                if pl_key in prev_ajustes:
                    s_val = float(round(prev_ajustes[pl_key]))
                elif param.get("deposito_en_planta") and tot_key in prev_ajustes:
                    s_val = float(round(prev_ajustes[tot_key]))
                else:
                    s_val = stock_teorico
            else:
                if tot_key in prev_ajustes:
                    s_val = float(round(prev_ajustes[tot_key]))
                elif param.get("deposito_en_planta") and pl_key in prev_ajustes:
                    s_val = float(round(prev_ajustes[pl_key]))
                elif not param.get("deposito_en_planta") and pl_key in prev_ajustes:
                    stock_cl2_val = float(param.get("stock_cl2", 0.0))
                    s_val = float(round(prev_ajustes[pl_key] + stock_cl2_val))
                else:
                    s_val = stock_teorico

            curr += timedelta(days=1)

        return float(round(s_val))

    def preview_plan_semanal(
        self, id_seccion: int, file_bytes: bytes, override_fecha_inicio: Optional[date] = None
    ) -> PlanSemanalPreviewOut:
        seccion = self._repo.get_seccion_info(id_seccion)
        if not seccion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Sección con ID {id_seccion} no encontrada",
            )

        try:
            parsed = parse_plan_semanal_excel(file_bytes, override_fecha_inicio)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error al interpretar el archivo de plan semanal: {str(e)}",
            )

        sd_mapping = self._repo.get_sd_mappings_by_seccion(id_seccion)
        advertencias: List[str] = []
        filas_out: List[PlanSemanalFila] = []

        for f in parsed["filas"]:
            sd_code = f["sd"].strip().upper()
            mapping_info = sd_mapping.get(sd_code)
            is_mapped = mapping_info is not None
            if not is_mapped:
                advertencias.append(f"El código SD '{sd_code}' no tiene un número de parte asociado en la sección.")

            filas_out.append(
                PlanSemanalFila(
                    sd=sd_code,
                    id_producto=mapping_info["id_producto"] if mapping_info else None,
                    descripcion=mapping_info["descripcion"] if mapping_info else None,
                    cantidades=f["cantidades"],
                    total_semana=f["total_semana"],
                    mapeado=is_mapped,
                )
            )

        dias_out = [
            PlanSemanalDiaHeader(
                nombre=d["nombre"],
                fecha=d["fecha"],
                total=d["total"],
            )
            for d in parsed["dias"]
        ]

        return PlanSemanalPreviewOut(
            id_seccion=id_seccion,
            seccion_nombre=seccion["nombre"],
            fecha_inicio=parsed["fecha_inicio"],
            fecha_fin=parsed["fecha_fin"],
            dias=dias_out,
            filas=filas_out,
            totales_dia=parsed["totales_dia"],
            total_general=parsed["total_general"],
            advertencias=advertencias,
        )

    def confirm_plan_semanal(
        self, id_seccion: int, payload: PlanSemanalConfirmRequest
    ) -> PlanSemanalConfirmOut:
        seccion = self._repo.get_seccion_info(id_seccion)
        if not seccion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Sección con ID {id_seccion} no encontrada",
            )

        if not payload.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se enviaron registros para confirmar en el plan semanal",
            )

        reg_linea, reg_plan = self._repo.save_plan_semanal_linea(
            id_seccion=id_seccion,
            items=payload.items,
        )

        return PlanSemanalConfirmOut(
            success=True,
            registros_plan_linea=reg_linea,
            registros_produccion_planificada=reg_plan,
            mensaje=f"Plan semanal para {seccion['nombre']} guardado exitosamente. Se sincronizaron {reg_plan} registros de producción.",
        )

    def get_planta_stocks_map(self, target_date: Optional[date] = None) -> Dict[str, float]:
        from app.core.time import get_argentina_today
        t_date = target_date or get_argentina_today()
        periodo_str = f"{t_date.year:04d}-{t_date.month:02d}"
        report = self.get_supplier_rundown(identifier="TODOS", alcance="planta", periodo=periodo_str)
        t_str = t_date.strftime("%Y-%m-%d")
        result: Dict[str, float] = {}
        for m in report.materiales:
            matched_cell = next((c for c in m.dias if c.fecha == t_str), None)
            if matched_cell:
                result[m.id_material] = round(matched_cell.stock_final, 2)
            elif m.dias:
                if t_str < m.dias[0].fecha:
                    result[m.id_material] = round(m.stock_inicial, 2)
                else:
                    result[m.id_material] = round(m.dias[-1].stock_final, 2)
            else:
                result[m.id_material] = round(m.stock_inicial, 2)
        return result


