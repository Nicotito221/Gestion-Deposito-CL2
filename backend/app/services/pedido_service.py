from datetime import date, timedelta
import math
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status

from app.core.time import get_argentina_today, get_turno_sugerido_actual
from app.repositories.conteo_repository import ConteoRepository
from app.repositories.pedido_repository import PedidoRepository
from app.schemas.pedido import (
    CalcularSugerenciaRequest,
    CalcularSugerenciaResponse,
    PedidoCreate,
    PedidoExistenteItem,
    PedidoItemOut,
    PedidoOut,
    PedidosListResponse,
    PreparacionPedidoResponse,
    PreparacionPedidoUpdate,
    RemitoDetalleOut,
    RemitoItemOut,
    SugerenciaMaterialDetalle,
)


class PedidoService:
    def __init__(self) -> None:
        self._repo = PedidoRepository()
        self._conteo_repo = ConteoRepository()

    def calcular_sugerencia(self, request: CalcularSugerenciaRequest) -> CalcularSugerenciaResponse:
        today = get_argentina_today()
        yesterday = today - timedelta(days=1)
        fecha_req = request.fecha_requerida or today
        fecha_sig = fecha_req + timedelta(days=1)

        counts_map: Dict[str, float] = {}
        ids_to_query: Optional[List[str]] = None

        from app.services.rundown_service import RundownService
        rundown_svc = RundownService()
        ref_date = min(today, fecha_req) - timedelta(days=1)
        planta_stocks = rundown_svc.get_planta_stocks_map(ref_date)
        for mat_id, st in planta_stocks.items():
            counts_map[mat_id] = float(st)
        fecha_conteo: date = request.fecha_conteo or ref_date

        if request.id_conteo:
            conteo = self._conteo_repo.get_conteo_detalle(request.id_conteo)
            if conteo:
                if conteo.get("fecha_impacto"):
                    try:
                        raw_f = conteo["fecha_impacto"]
                        if isinstance(raw_f, date):
                            fecha_conteo = raw_f
                        else:
                            fecha_conteo = datetime.strptime(str(raw_f)[:10], "%Y-%m-%d").date()
                    except Exception:
                        pass
                conteo_mat_ids = []
                for it in conteo.get("items", []):
                    if fecha_conteo >= ref_date:
                        counts_map[it["id_material"]] = float(it["stock_contado"])
                    conteo_mat_ids.append(it["id_material"])
                if request.solo_conteo and conteo_mat_ids:
                    ids_to_query = conteo_mat_ids

        if request.materiales:
            ids_to_query = []
            for m in request.materiales:
                counts_map[m.id_material] = float(m.stock_contado)
                ids_to_query.append(m.id_material)

        if not request.id_conteo and not request.materiales:
            ultimo_id_conteo = self._repo.get_ultimo_id_conteo_finalizado()
            if ultimo_id_conteo:
                conteo = self._conteo_repo.get_conteo_detalle(ultimo_id_conteo)
                if conteo and conteo.get("fecha_impacto"):
                    try:
                        raw_f = conteo["fecha_impacto"]
                        f_imp = raw_f if isinstance(raw_f, date) else datetime.strptime(str(raw_f)[:10], "%Y-%m-%d").date()
                        if f_imp >= ref_date:
                            fecha_conteo = f_imp
                            for it in conteo.get("items", []):
                                counts_map[it["id_material"]] = float(it["stock_contado"])
                    except Exception:
                        pass

        materiales = self._repo.get_materiales_para_sugerencia(ids_to_query)

        all_products: List[str] = list({
            p["id_producto"]
            for m in materiales
            for p in m["productos"]
        })

        prod_map_hoy = self._repo.get_produccion_planificada_dia(today, all_products)
        if sum(prod_map_hoy.values()) == 0:
            prod_map_hoy = self._repo.get_promedio_diario_produccion(
                today.year, today.month, all_products
            )

        if fecha_req == today:
            prod_map_req = prod_map_hoy
        else:
            prod_map_req = self._repo.get_produccion_planificada_dia(fecha_req, all_products)
            if sum(prod_map_req.values()) == 0:
                prod_map_req = self._repo.get_promedio_diario_produccion(
                    fecha_req.year, fecha_req.month, all_products
                )

        prod_map_sig = self._repo.get_produccion_planificada_dia(fecha_sig, all_products)
        if sum(prod_map_sig.values()) == 0:
            prod_map_sig = self._repo.get_promedio_diario_produccion(
                fecha_sig.year, fecha_sig.month, all_products
            )

        mat_ids = [m["id_material"] for m in materiales]
        pedidos_raw_req = self._repo.get_pedidos_existentes_fecha(fecha_req, mat_ids)
        pedidos_por_mat: Dict[str, List[Dict[str, Any]]] = {}
        for p in pedidos_raw_req:
            pedidos_por_mat.setdefault(p["id_material"], []).append(p)

        pedidos_hoy_map: Dict[str, float] = {}
        if fecha_req > today:
            pedidos_hoy_raw = self._repo.get_pedidos_existentes_fecha(today, mat_ids)
            for p in pedidos_hoy_raw:
                pedidos_hoy_map[p["id_material"]] = round(
                    pedidos_hoy_map.get(p["id_material"], 0.0) + p["cantidad_pedida"], 2
                )

        modalidad = "completo"
        if request.modalidad_turnos in ("2_turnos", "3_turnos"):
            modalidad = request.modalidad_turnos

        if modalidad == "2_turnos":
            turnos_list = ["Turno Mañana", "Turno Tarde"]
        elif modalidad == "3_turnos":
            turnos_list = ["Turno Mañana", "Turno Tarde", "Turno Noche"]
        else:
            modalidad = "completo"
            turnos_list = ["Completo"]

        items_response: List[SugerenciaMaterialDetalle] = []
        materiales_a_pedir_count = 0

        for m in materiales:
            mat_id = m["id_material"]
            stock_contado = counts_map.get(mat_id, float(m.get("stock_inicial_planta") or 0.0))

            veh_prod_hoy = sum(
                prod_map_hoy.get(p["id_producto"], 0.0) * p["factor_uso"]
                for p in m["productos"]
            )
            consumo_hoy = round(
                veh_prod_hoy * m["factor_conversion"] * (1.0 + m["scrap_porcentaje"]),
                2,
            )

            veh_prod_req = sum(
                prod_map_req.get(p["id_producto"], 0.0) * p["factor_uso"]
                for p in m["productos"]
            )
            consumo_diario = round(
                veh_prod_req * m["factor_conversion"] * (1.0 + m["scrap_porcentaje"]),
                2,
            )
            if consumo_diario == 0 and consumo_hoy > 0:
                consumo_diario = consumo_hoy

            veh_prod_sig = sum(
                prod_map_sig.get(p["id_producto"], 0.0) * p["factor_uso"]
                for p in m["productos"]
            )
            consumo_sig = round(
                veh_prod_sig * m["factor_conversion"] * (1.0 + m["scrap_porcentaje"]),
                2,
            )
            if consumo_sig == 0 and consumo_diario > 0:
                consumo_sig = consumo_diario

            if fecha_req <= today:
                stock_proyectado_inicio = stock_contado
            else:
                dias_avance = (fecha_req - today).days
                consumo_intermedio = consumo_hoy * dias_avance
                pedidos_intermedios = pedidos_hoy_map.get(mat_id, 0.0)
                stock_proyectado_inicio = round(stock_contado + pedidos_intermedios - consumo_intermedio, 2)

            mat_pedidos = pedidos_por_mat.get(mat_id, [])
            pedidos_items = [
                PedidoExistenteItem(
                    id_pedido=p["id_pedido"],
                    turno=p["turno"],
                    cantidad_pedida=p["cantidad_pedida"],
                    estado=p["estado"],
                )
                for p in mat_pedidos
            ]

            pedidos_por_turno: Dict[str, float] = {}
            total_ya_pedido = 0.0
            for p in mat_pedidos:
                t = p["turno"] or "Completo"
                if t in ("T1", "Turno 1"):
                    t = "Turno Mañana"
                elif t in ("T2", "Turno 2"):
                    t = "Turno Tarde"
                elif t in ("T3", "Turno 3"):
                    t = "Turno Noche"
                pedidos_por_turno[t] = round(pedidos_por_turno.get(t, 0.0) + p["cantidad_pedida"], 2)
                total_ya_pedido = round(total_ya_pedido + p["cantidad_pedida"], 2)

            stock_con_pedidos = round(stock_proyectado_inicio + total_ya_pedido, 2)

            doh = m["doh_sugerido_planta"]
            stock_umbral_doh = round(consumo_diario * doh, 2)
            tiene_deficit_doh = (consumo_diario > 0) and (stock_con_pedidos < stock_umbral_doh)

            stock_objetivo = round(consumo_diario + (0.65 * consumo_sig), 2)
            stock_minimo_inicio = stock_umbral_doh

            deficit = max(0.0, round(stock_objetivo - stock_con_pedidos, 2)) if tiene_deficit_doh else 0.0

            tipo_empaque = m.get("tipo_empaque") or "pallet"
            lote_mts = m.get("lote_mts")
            es_pallet = (tipo_empaque in ("pallet", "rollo")) and (lote_mts is not None) and (float(lote_mts) > 1.0)
            lot_size = float(lote_mts) if (lote_mts and float(lote_mts) > 0) else 1.0

            if es_pallet:
                cant_pallets = math.ceil(deficit / lot_size) if deficit > 0 else 0
                cantidad_neta = float(cant_pallets * lot_size)
                bruto_def = max(0.0, stock_objetivo - stock_proyectado_inicio)
                sugerido_bruto = float(math.ceil(bruto_def / lot_size) * lot_size) if tiene_deficit_doh else 0.0
            else:
                cant_pallets = int(math.ceil(deficit)) if deficit > 0 else 0
                cantidad_neta = float(cant_pallets)
                sugerido_bruto = float(int(math.ceil(max(0.0, stock_objetivo - stock_proyectado_inicio)))) if tiene_deficit_doh else 0.0

            desglose_turnos: Dict[str, float] = {}
            sugerido_por_turno: Dict[str, float] = {}
            pallets_por_turno: Dict[str, int] = {}

            if modalidad == "completo":
                pallets_por_turno = {"Completo": cant_pallets}
                sugerido_por_turno = {"Completo": cantidad_neta}
                desglose_turnos = {"Completo": sugerido_bruto}
            elif modalidad == "2_turnos":
                if es_pallet:
                    p1 = math.ceil(cant_pallets / 2.0)
                    p2 = cant_pallets - p1
                    pallets_por_turno = {"Turno Mañana": p1, "Turno Tarde": p2}
                    sugerido_por_turno = {"Turno Mañana": float(p1 * lot_size), "Turno Tarde": float(p2 * lot_size)}
                    bruto_p1 = math.ceil((sugerido_bruto / lot_size) / 2.0)
                    bruto_p2 = int(round(sugerido_bruto / lot_size)) - bruto_p1
                    desglose_turnos = {"Turno Mañana": float(bruto_p1 * lot_size), "Turno Tarde": float(bruto_p2 * lot_size)}
                else:
                    u1 = math.ceil(cantidad_neta / 2.0)
                    u2 = int(cantidad_neta - u1)
                    pallets_por_turno = {"Turno Mañana": u1, "Turno Tarde": u2}
                    sugerido_por_turno = {"Turno Mañana": float(u1), "Turno Tarde": float(u2)}
                    b1 = math.ceil(sugerido_bruto / 2.0)
                    b2 = int(sugerido_bruto - b1)
                    desglose_turnos = {"Turno Mañana": float(b1), "Turno Tarde": float(b2)}
            else:
                if es_pallet:
                    p1 = math.ceil(cant_pallets / 3.0)
                    rem = cant_pallets - p1
                    p2 = math.ceil(rem / 2.0)
                    p3 = rem - p2
                    pallets_por_turno = {"Turno Mañana": p1, "Turno Tarde": p2, "Turno Noche": p3}
                    sugerido_por_turno = {
                        "Turno Mañana": float(p1 * lot_size),
                        "Turno Tarde": float(p2 * lot_size),
                        "Turno Noche": float(p3 * lot_size),
                    }
                    total_p_bruto = int(round(sugerido_bruto / lot_size))
                    bp1 = math.ceil(total_p_bruto / 3.0)
                    brem = total_p_bruto - bp1
                    bp2 = math.ceil(brem / 2.0)
                    bp3 = brem - bp2
                    desglose_turnos = {
                        "Turno Mañana": float(bp1 * lot_size),
                        "Turno Tarde": float(bp2 * lot_size),
                        "Turno Noche": float(bp3 * lot_size),
                    }
                else:
                    u1 = math.ceil(cantidad_neta / 3.0)
                    rem = int(cantidad_neta - u1)
                    u2 = math.ceil(rem / 2.0)
                    u3 = rem - u2
                    pallets_por_turno = {"Turno Mañana": u1, "Turno Tarde": u2, "Turno Noche": u3}
                    sugerido_por_turno = {"Turno Mañana": float(u1), "Turno Tarde": float(u2), "Turno Noche": float(u3)}
                    bu1 = math.ceil(sugerido_bruto / 3.0)
                    brem_u = int(sugerido_bruto - bu1)
                    bu2 = math.ceil(brem_u / 2.0)
                    bu3 = brem_u - bu2
                    desglose_turnos = {"Turno Mañana": float(bu1), "Turno Tarde": float(bu2), "Turno Noche": float(bu3)}

            if cantidad_neta > 0:
                materiales_a_pedir_count += 1

            items_response.append(
                SugerenciaMaterialDetalle(
                    id_parametro=m.get("id_parametro"),
                    id_material=mat_id,
                    nombre=m["descripcion"],
                    unidad=m["unidad"],
                    id_proveedor=m["id_proveedor"],
                    nombre_proveedor=m["nombre_proveedor"],
                    stock_contado=stock_contado,
                    stock_cl2=float(m.get("stock_cl2") or 0.0),
                    en_cl2=bool(m.get("en_cl2", True)),
                    consumo_diario=consumo_diario,
                    consumo_sig=consumo_sig,
                    doh_sugerido_planta=doh,
                    stock_objetivo=stock_objetivo,
                    stock_proyectado_inicio=stock_proyectado_inicio,
                    stock_minimo_inicio=stock_minimo_inicio,
                    lote_minimo=m["lote_mts"],
                    tipo_empaque=tipo_empaque,
                    tamanio_lote=lot_size if es_pallet else None,
                    cantidad_pallets_sugerida=cant_pallets if es_pallet else 0,
                    pallets_por_turno=pallets_por_turno if es_pallet else {},
                    pedidos_existentes=pedidos_items,
                    cantidad_ya_pedida_total=total_ya_pedido,
                    cantidad_sugerida_bruta=sugerido_bruto,
                    cantidad_sugerida_neta=cantidad_neta,
                    desglose_turnos=desglose_turnos,
                    pedidos_por_turno=pedidos_por_turno,
                    sugerido_por_turno=sugerido_por_turno,
                )
            )

        turno_sugerido = request.turno or get_turno_sugerido_actual()
        return CalcularSugerenciaResponse(
            fecha_requerida=fecha_req.strftime("%Y-%m-%d"),
            modalidad_turnos=modalidad,
            turnos=turnos_list,
            total_materiales=len(items_response),
            materiales_a_pedir=materiales_a_pedir_count,
            items=items_response,
            turno_sugerido=turno_sugerido,
        )

    def crear_pedido(self, data: PedidoCreate) -> PedidoOut:
        if not data.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El pedido debe contener al menos un material",
            )

        today = get_argentina_today()
        if data.fecha_requerida and data.fecha_requerida < today:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La fecha requerida no puede ser anterior a la fecha actual",
            )

        items_dict = [it.model_dump() for it in data.items]
        id_pedido = self._repo.create_pedido(
            sector=data.sector,
            prioridad=data.prioridad,
            origen=data.origen,
            fecha_requerida=data.fecha_requerida,
            turno=data.turno,
            id_conteo=data.id_conteo,
            comentario=data.comentario,
            items=items_dict,
            id_usuario_solicitante=data.id_usuario_solicitante,
        )

        res = self._repo.get_pedido_by_id(id_pedido)
        if not res:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al recuperar pedido creado",
            )
        return self._to_pedido_out(res)

    def crear_pedidos_multiples(self, pedidos: List[PedidoCreate]) -> List[PedidoOut]:
        results: List[PedidoOut] = []
        for p in pedidos:
            results.append(self.crear_pedido(p))
        return results

    def get_pedidos(
        self,
        fecha_requerida: Optional[date] = None,
        estado: Optional[str] = None,
        turno: Optional[str] = None,
        sector: Optional[str] = None,
        limit: int = 50,
    ) -> PedidosListResponse:
        raw_list = self._repo.get_pedidos(
            fecha_requerida=fecha_requerida,
            estado=estado,
            turno=turno,
            sector=sector,
            limit=limit,
        )
        return PedidosListResponse(
            items=[self._to_pedido_out(p) for p in raw_list],
            total=len(raw_list),
        )

    def get_pedido_by_id(self, id_pedido: int) -> PedidoOut:
        p = self._repo.get_pedido_by_id(id_pedido)
        if not p:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pedido #{id_pedido} no encontrado",
            )
        return self._to_pedido_out(p)

    def _to_pedido_out(self, p: Dict[str, Any]) -> PedidoOut:
        items_out = [
            PedidoItemOut(
                id_material=it["id_material"],
                nombre_material=it.get("nombre_material") or it["id_material"],
                unidad=it.get("unidad", "UN"),
                cantidad_pedida=float(it["cantidad_pedida"]),
                cantidad_preparada=float(it.get("cantidad_preparada", 0.0)),
                cantidad_entregada=float(it.get("cantidad_entregada", 0.0)),
                cantidad_pendiente=float(it.get("cantidad_pendiente", 0.0)),
                estado=it.get("estado", "pendiente"),
                comentario=it.get("comentario"),
                tipo_empaque=it.get("tipo_empaque", "unidad"),
                tamanio_lote=float(it.get("tamanio_lote", 1.0)),
                cantidad_pallets=it.get("cantidad_pallets"),
                cantidad_pallets_preparada=it.get("cantidad_pallets_preparada"),
                cantidad_pallets_entregada=it.get("cantidad_pallets_entregada"),
                cantidad_pallets_pendiente=it.get("cantidad_pallets_pendiente"),
            )
            for it in p.get("items", [])
        ]
        remitos_out = [
            RemitoDetalleOut(
                id_remito=r["id_remito"],
                id_pedido=r["id_pedido"],
                fecha_emision=r["fecha_emision"],
                fecha_entrega=r.get("fecha_entrega"),
                estado=r.get("estado", "emitido"),
                id_usuario_emisor=r.get("id_usuario_emisor"),
                usuario_emisor=r.get("usuario_emisor"),
                observacion=r.get("observacion"),
                sector_destino=r.get("sector_destino"),
                usuario_solicitante=r.get("usuario_solicitante"),
                fecha_requerida=r.get("fecha_requerida"),
                turno=r.get("turno"),
                total_items=r.get("total_items", len(r.get("items", []))),
                total_pallets=r.get("total_pallets", 0),
                total_unidades=r.get("total_unidades", 0.0),
                items=[
                    RemitoItemOut(
                        id_material=m["id_material"],
                        nombre_material=m.get("nombre_material"),
                        unidad=m.get("unidad", "UN"),
                        cantidad=float(m["cantidad"]),
                        tipo_empaque=m.get("tipo_empaque", "unidad"),
                        tamanio_lote=float(m.get("tamanio_lote", 1.0)),
                        cantidad_pallets=m.get("cantidad_pallets"),
                    )
                    for m in r.get("items", [])
                ],
            )
            for r in p.get("remitos", [])
        ]
        today = get_argentina_today()
        fecha_ref = p.get("fecha_requerida") or (p["fecha_creacion"].date() if p.get("fecha_creacion") else None)
        es_demorado = bool(
            fecha_ref and fecha_ref < today and p.get("estado") not in ("completo", "cancelado")
        )
        return PedidoOut(
            id_pedido=p["id_pedido"],
            sector=p["sector"],
            prioridad=p["prioridad"],
            origen=p["origen"],
            estado=p["estado"],
            fecha_creacion=p["fecha_creacion"],
            fecha_despacho=p.get("fecha_despacho"),
            fecha_entrega=p.get("fecha_entrega"),
            fecha_requerida=p.get("fecha_requerida"),
            turno=p.get("turno"),
            id_conteo=p.get("id_conteo"),
            comentario=p.get("comentario"),
            id_usuario_solicitante=p.get("id_usuario_solicitante"),
            usuario_solicitante=p.get("usuario_solicitante"),
            id_remito=p.get("id_remito"),
            remitos=remitos_out,
            total_items=p.get("total_items", len(items_out)),
            items=items_out,
            es_demorado=es_demorado,
        )

    def get_remitos_by_pedido(self, id_pedido: int) -> List[RemitoDetalleOut]:
        data = self._repo.get_remitos_by_pedido(id_pedido)
        return [
            RemitoDetalleOut(
                id_remito=r["id_remito"],
                id_pedido=r["id_pedido"],
                fecha_emision=r["fecha_emision"],
                fecha_entrega=r.get("fecha_entrega"),
                estado=r.get("estado", "emitido"),
                id_usuario_emisor=r.get("id_usuario_emisor"),
                usuario_emisor=r.get("usuario_emisor"),
                observacion=r.get("observacion"),
                sector_destino=r.get("sector_destino"),
                usuario_solicitante=r.get("usuario_solicitante"),
                fecha_requerida=r.get("fecha_requerida"),
                turno=r.get("turno"),
                total_items=r.get("total_items", len(r.get("items", []))),
                total_pallets=r.get("total_pallets", 0),
                total_unidades=r.get("total_unidades", 0.0),
                items=[
                    RemitoItemOut(
                        id_material=m["id_material"],
                        nombre_material=m.get("nombre_material"),
                        unidad=m.get("unidad", "UN"),
                        cantidad=float(m["cantidad"]),
                        tipo_empaque=m.get("tipo_empaque", "unidad"),
                        tamanio_lote=float(m.get("tamanio_lote", 1.0)),
                        cantidad_pallets=m.get("cantidad_pallets"),
                    )
                    for m in r.get("items", [])
                ],
            )
            for r in data
        ]

    def get_remito_by_id(self, id_remito: str) -> RemitoDetalleOut:
        data = self._repo.get_remito_by_id(id_remito)
        if not data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Remito {id_remito} no encontrado",
            )
        return RemitoDetalleOut(
            id_remito=data["id_remito"],
            id_pedido=data["id_pedido"],
            fecha_emision=data["fecha_emision"],
            fecha_entrega=data.get("fecha_entrega"),
            estado=data.get("estado", "emitido"),
            id_usuario_emisor=data.get("id_usuario_emisor"),
            usuario_emisor=data.get("usuario_emisor"),
            observacion=data.get("observacion"),
            sector_destino=data.get("sector_destino"),
            usuario_solicitante=data.get("usuario_solicitante"),
            fecha_requerida=data.get("fecha_requerida"),
            turno=data.get("turno"),
            total_items=data.get("total_items", len(data.get("items", []))),
            total_pallets=data.get("total_pallets", 0),
            total_unidades=data.get("total_unidades", 0.0),
            items=[
                RemitoItemOut(
                    id_material=m["id_material"],
                    nombre_material=m.get("nombre_material"),
                    unidad=m.get("unidad", "UN"),
                    cantidad=float(m["cantidad"]),
                    tipo_empaque=m.get("tipo_empaque", "unidad"),
                    tamanio_lote=float(m.get("tamanio_lote", 1.0)),
                    cantidad_pallets=m.get("cantidad_pallets"),
                )
                for m in data.get("items", [])
            ],
        )

    def actualizar_preparacion(
        self,
        id_pedido: int,
        data: PreparacionPedidoUpdate,
        id_usuario: Optional[int] = None,
    ) -> PreparacionPedidoResponse:
        items_dict = [it.model_dump() for it in data.items]
        try:
            pedido_actualizado, id_remito = self._repo.actualizar_preparacion_pedido(
                id_pedido=id_pedido,
                accion=data.accion,
                comentario=data.comentario,
                items=items_dict,
                id_usuario=id_usuario,
            )
        except ValueError as ve:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(ve),
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al procesar preparación del pedido: {str(e)}",
            )

        msg = "Avance de preparación guardado exitosamente."
        if data.accion == "confirmar_completo":
            msg = f"Pedido #{id_pedido} completado exitosamente. Remito {id_remito} emitido."
        elif data.accion == "confirmar_parcial":
            msg = f"Pedido #{id_pedido} confirmado como parcial. Remito {id_remito} emitido."

        return PreparacionPedidoResponse(
            pedido=self._to_pedido_out(pedido_actualizado),
            id_remito=id_remito,
            mensaje=msg,
        )

    def cancelar_pedido(
        self, id_pedido: int, motivo: str, id_usuario: Optional[int] = None
    ) -> PedidoOut:
        if not motivo or not motivo.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe indicar el motivo de la cancelación",
            )
        try:
            res = self._repo.cancelar_pedido(id_pedido, motivo.strip(), id_usuario)
            if not res:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Pedido #{id_pedido} no encontrado",
                )
            return self._to_pedido_out(res)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            )

