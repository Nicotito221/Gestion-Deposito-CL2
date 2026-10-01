from datetime import datetime
from typing import Any, Dict, List
import pyodbc

from app.core.config import get_db_connection
from app.core.time import get_argentina_now, get_turno_sugerido_actual
from app.schemas.dashboard import (
    DashboardKpis,
    DashboardMaterialCritico,
    DashboardPedidoItem,
    DashboardResumenResponse,
)
from app.services.stock_service import StockService


class DashboardService:
    def __init__(self, connection_factory=get_db_connection) -> None:
        self._get_connection = connection_factory
        self._stock_service = StockService()

    def _get_turno_actual(self, now: datetime) -> str:
        return get_turno_sugerido_actual(now)

    def get_resumen(self) -> DashboardResumenResponse:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        now = get_argentina_now()
        turno_actual = self._get_turno_actual(now)

        try:
            today = now.date()
            cursor.execute(
                """
                UPDATE dbo.pedido
                SET estado = 'pendiente'
                WHERE estado = 'en_preparacion'
                  AND COALESCE(fecha_requerida, CAST(fecha_creacion AS DATE)) < ?
                """,
                (today,),
            )
            conn.commit()

            # 1. KPIs de Pedidos
            cursor.execute(
                """
                SELECT 
                    COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) AS pendientes,
                    COUNT(CASE WHEN estado = 'en_preparacion' THEN 1 END) AS en_prep,
                    COUNT(CASE WHEN estado = 'parcial' THEN 1 END) AS parciales,
                    COUNT(CASE WHEN estado = 'completo' AND CAST(fecha_creacion AS DATE) = CAST(? AS DATE) THEN 1 END) AS completados_hoy,
                    COUNT(*) AS total_pedidos
                FROM dbo.pedido
                """,
                (now.date(),),
            )
            kpi_row = cursor.fetchone()
            pendientes = int(kpi_row[0] or 0)
            en_prep = int(kpi_row[1] or 0)
            parciales = int(kpi_row[2] or 0)
            completados_hoy = int(kpi_row[3] or 0)
            total_pedidos = int(kpi_row[4] or 0)

            # 2. Remitos de hoy
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM dbo.remito
                WHERE CAST(fecha_emision AS DATE) = CAST(? AS DATE)
                """,
                (now.date(),),
            )
            remitos_row = cursor.fetchone()
            remitos_hoy = int(remitos_row[0] or 0)

            # 3. Fill rate
            cursor.execute(
                """
                SELECT SUM(cantidad_pedida), SUM(ISNULL(cantidad_preparada, 0))
                FROM dbo.material_pedido
                """
            )
            fill_row = cursor.fetchone()
            total_pedido = float(fill_row[0] or 0.0)
            total_preparado = float(fill_row[1] or 0.0)
            fill_rate = round((total_preparado / total_pedido * 100.0), 1) if total_pedido > 0 else 100.0

            # 4. Últimos pedidos
            cursor.execute(
                """
                SELECT TOP 6 
                    p.id_pedido, p.sector, p.prioridad, p.estado,
                    p.fecha_creacion, p.fecha_requerida, p.turno,
                    LTRIM(RTRIM(CONCAT(ISNULL(u.nombre, ''), ' ', ISNULL(u.apellido, '')))) AS solicitante,
                    COUNT(mp.id_material) AS total_items,
                    (SELECT TOP 1 r.id_remito FROM dbo.remito r WHERE r.id_pedido = p.id_pedido ORDER BY r.fecha_emision DESC) AS id_remito
                FROM dbo.pedido p
                LEFT JOIN dbo.usuario u ON p.id_usuario_solicitante = u.id_usuario
                LEFT JOIN dbo.material_pedido mp ON p.id_pedido = mp.id_pedido
                GROUP BY 
                    p.id_pedido, p.sector, p.prioridad, p.estado,
                    p.fecha_creacion, p.fecha_requerida, p.turno,
                    u.nombre, u.apellido
                ORDER BY p.id_pedido DESC
                """
            )
            pedidos_rows = cursor.fetchall()
            ultimos_pedidos: List[DashboardPedidoItem] = []
            for r in pedidos_rows:
                est = str(r[3] or "pendiente")
                f_cre = r[4]
                f_req = r[5]
                f_ref = f_req or (f_cre.date() if f_cre else None)
                es_dem = bool(f_ref and f_ref < now.date() and est not in ("completo", "cancelado"))
                ultimos_pedidos.append(
                    DashboardPedidoItem(
                        id_pedido=int(r[0]),
                        sector=str(r[1] or "General"),
                        prioridad=str(r[2] or "normal"),
                        estado=est,
                        fecha_creacion=f_cre,
                        fecha_requerida=f_req,
                        turno=str(r[6]) if r[6] else None,
                        usuario_solicitante=str(r[7]).strip() if r[7] and str(r[7]).strip() else "Operario",
                        total_items=int(r[8] or 0),
                        id_remito=str(r[9]) if r[9] else None,
                        es_demorado=es_dem,
                    )
                )

        finally:
            cursor.close()
            conn.close()

        # 5. Materiales críticos
        stock_list = self._stock_service.get_stock_deposito(solo_con_stock=True, page_size=200)
        materiales_criticos: List[DashboardMaterialCritico] = []

        for m in stock_list.items:
            stock_planta = float(m.stock_planta or 0.0)
            stock_cl2 = float(m.stock_cl2 or 0.0)
            stock_total = float(m.stock_total or (stock_planta + stock_cl2))

            if stock_planta <= 0 and stock_cl2 <= 0:
                materiales_criticos.append(
                    DashboardMaterialCritico(
                        id_material=m.id_material,
                        nombre=m.nombre,
                        unidad=m.unidad,
                        stock_cl2=stock_cl2,
                        stock_planta=stock_planta,
                        stock_total=stock_total,
                        nombre_proveedor=m.nombre_proveedor,
                        alerta_tipo="quiebre_total",
                        alerta_label="Quiebre Total (Sin stock)",
                        prioridad="critica",
                        origen_alerta="ambos",
                    )
                )
            elif stock_planta <= 0 and stock_cl2 > 0:
                materiales_criticos.append(
                    DashboardMaterialCritico(
                        id_material=m.id_material,
                        nombre=m.nombre,
                        unidad=m.unidad,
                        stock_cl2=stock_cl2,
                        stock_planta=stock_planta,
                        stock_total=stock_total,
                        nombre_proveedor=m.nombre_proveedor,
                        alerta_tipo="quiebre_planta",
                        alerta_label="Quiebre Planta (Pedir a CL2)",
                        prioridad="alta",
                        origen_alerta="planta",
                    )
                )
            elif stock_planta > 0 and stock_cl2 <= 0:
                materiales_criticos.append(
                    DashboardMaterialCritico(
                        id_material=m.id_material,
                        nombre=m.nombre,
                        unidad=m.unidad,
                        stock_cl2=stock_cl2,
                        stock_planta=stock_planta,
                        stock_total=stock_total,
                        nombre_proveedor=m.nombre_proveedor,
                        alerta_tipo="sin_stock_cl2",
                        alerta_label="CL2 Agotado",
                        prioridad="media",
                        origen_alerta="tbar",
                    )
                )

        priority_order = {"critica": 0, "alta": 1, "media": 2}
        materiales_criticos.sort(key=lambda x: (priority_order.get(x.prioridad, 3), x.stock_planta))

        criticos_planta = [m for m in materiales_criticos if m.origen_alerta in ("planta", "ambos")]
        criticos_tbar = [m for m in materiales_criticos if m.origen_alerta in ("tbar", "ambos")]

        kpis = DashboardKpis(
            pedidos_pendientes=pendientes,
            pedidos_en_preparacion=en_prep,
            pedidos_parciales=parciales,
            pedidos_completados_hoy=completados_hoy,
            total_pedidos=total_pedidos,
            materiales_criticos_count=len(materiales_criticos),
            criticos_planta_count=len(criticos_planta),
            criticos_tbar_count=len(criticos_tbar),
            remitos_hoy=remitos_hoy,
            fill_rate_porcentaje=fill_rate,
            turno_actual=turno_actual,
        )

        return DashboardResumenResponse(
            kpis=kpis,
            ultimos_pedidos=ultimos_pedidos,
            materiales_criticos=materiales_criticos[:10],
        )
