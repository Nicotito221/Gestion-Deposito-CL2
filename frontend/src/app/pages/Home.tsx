import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { formatDateLong, formatSoloFechaAR } from "../components/ui/format";
import { useAuth } from "../context/AuthContext";
import {
  getDashboardResumen,
  type DashboardResumenResponse,
} from "../services/api";
import { DeliveryNoteModal } from "../components/DeliveryNoteModal";
import {
  FilePlus,
  Warehouse,
  TrendingUp,
  Clock,
  Package,
  Truck,
  CheckCircle2,
  ArrowRight,
  ClipboardList,
  Layers,
  AlertTriangle,
  RefreshCw,
  Receipt,
  BarChart2,
} from "lucide-react";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "bg-amber-100 text-amber-800 border-amber-200" },
  en_preparacion: { label: "En preparación", color: "bg-blue-100 text-blue-700 border-blue-200" },
  parcial: { label: "Parcial", color: "bg-orange-100 text-orange-800 border-orange-200" },
  completo: { label: "Completo", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  cancelado: { label: "Cancelado", color: "bg-slate-100 text-slate-600 border-slate-200" },
};

function getHomeOrderStatus(order: { estado: string; es_demorado?: boolean }) {
  if (order.es_demorado && (order.estado === "pendiente" || order.estado === "en_preparacion")) {
    return { label: "Pendiente (Tarde)", color: "bg-rose-100 text-rose-800 border-rose-300 font-bold" };
  }
  if (order.es_demorado && order.estado === "parcial") {
    return { label: "Parcial (Tarde)", color: "bg-rose-100 text-rose-800 border-rose-300 font-bold" };
  }
  return statusConfig[order.estado] || { label: order.estado, color: "bg-slate-100 text-slate-700 border-slate-200" };
}

export function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardResumenResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRemitoModalOpen, setIsRemitoModalOpen] = useState<boolean>(false);
  const [selectedRemitoId, setSelectedRemitoId] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDashboardResumen();
      setData(res);
    } catch {
      toast.error("Error al cargar datos del tablero");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const isDepositoOrCL2 =
    user?.rol === "deposito" ||
    user?.rol === "operario_deposito" ||
    user?.sector?.toUpperCase() === "CL2";

  return (
    <div className="p-4 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
              Hola, {user?.nombre || "Nicolás"}
            </h1>
            {user?.sector && (
              <Badge variant="outline" className="text-xs bg-slate-100 text-slate-700 border-slate-300 font-medium">
                {user.sector}
              </Badge>
            )}
            {data?.kpis.turno_actual && (
              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-semibold gap-1">
                <Clock className="w-3 h-3 text-indigo-600" />
                {data.kpis.turno_actual}
              </Badge>
            )}
          </div>
          <p className="text-slate-600 text-xs sm:text-sm mt-1 capitalize">
            {formatDateLong()} · Tablero general de control operativo
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboard}
            disabled={loading}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          {!isDepositoOrCL2 && (
            <Button
              size="sm"
              onClick={() => navigate("/nuevo-pedido")}
              className="text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <FilePlus className="w-3.5 h-3.5" />
              Nuevo pedido
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <Card
          className="transition-all hover:shadow-md hover:border-amber-400 cursor-pointer"
          onClick={() => navigate(isDepositoOrCL2 ? "/deposito" : "/pedidos")}
          title="Ver pedidos pendientes"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-semibold text-slate-600">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {loading ? "..." : data?.kpis.pedidos_pendientes ?? 0}
            </div>
            <p className="text-[11px] text-amber-700 mt-0.5 font-medium">
              {data && data.kpis.pedidos_pendientes > 0 ? "Requieren preparación" : "Sin demoras"}
            </p>
          </CardContent>
        </Card>

        <Card
          className="transition-all hover:shadow-md hover:border-blue-400 cursor-pointer"
          onClick={() => navigate("/deposito")}
          title="Ver pedidos en preparación"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-semibold text-slate-600">En preparación</CardTitle>
            <Warehouse className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {loading ? "..." : data?.kpis.pedidos_en_preparacion ?? 0}
            </div>
            <p className="text-[11px] text-blue-600 mt-0.5 font-medium">En depósito CL2</p>
          </CardContent>
        </Card>

        <Card
          className="transition-all hover:shadow-md hover:border-indigo-400 cursor-pointer"
          onClick={() => navigate("/deposito")}
          title="Ver entregas parciales"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-semibold text-slate-600">Entregas parciales</CardTitle>
            <Truck className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {loading ? "..." : data?.kpis.pedidos_parciales ?? 0}
            </div>
            <p className="text-[11px] text-indigo-600 mt-0.5 font-medium">Saldos pendientes</p>
          </CardContent>
        </Card>

        <Card
          className="transition-all hover:shadow-md hover:border-emerald-400 cursor-pointer"
          onClick={() => navigate("/remitos")}
          title="Ver remitos completados"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-semibold text-slate-600">Completados hoy</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {loading ? "..." : data?.kpis.pedidos_completados_hoy ?? 0}
            </div>
            <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">Despachos totales</p>
          </CardContent>
        </Card>

        <Card
          className="transition-all hover:shadow-md hover:border-rose-400 cursor-pointer border-rose-200 bg-rose-50/20"
          onClick={() => {
            if (isDepositoOrCL2) {
              navigate("/materiales");
            } else {
              navigate("/rundown?riesgo=1");
            }
          }}
          title="Haz clic para ver materiales con menor DOH"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-semibold text-slate-600">Stock crítico</CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-bold text-rose-600 font-mono">
              {loading ? "..." : data?.kpis.materiales_criticos_count ?? 0}
            </div>
            <p className="text-[11px] text-rose-700 mt-0.5 font-medium flex items-center gap-1">
              Menor DOH <ArrowRight className="w-3 h-3" />
            </p>
          </CardContent>
        </Card>

        <Card
          className="transition-all hover:shadow-md hover:border-blue-400 cursor-pointer"
          onClick={() => navigate("/remitos")}
          title="Ver remitos y despachos"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-semibold text-slate-600">Fill rate hoy</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-bold text-blue-700 font-mono">
              {loading ? "..." : `${data?.kpis.fill_rate_porcentaje ?? 100}%`}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {loading ? "..." : `${data?.kpis.remitos_hoy ?? 0} remitos emitidos`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Principal: Pedidos Recientes */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="py-3 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-700" />
                <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Pedidos Recientes
                </CardTitle>
              </div>
              <Link to="/deposito">
                <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-800 h-7 px-2">
                  Ver todos
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-xs">Cargando pedidos...</div>
              ) : !data || data.ultimos_pedidos.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No hay pedidos registrados en el sistema.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.ultimos_pedidos.map((order) => {
                    const cfg = getHomeOrderStatus(order);

                    return (
                      <div
                        key={order.id_pedido}
                        className="flex items-center justify-between py-3 px-6 hover:bg-slate-50/50 transition-colors gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono font-bold text-blue-700 text-xs flex-shrink-0">
                            #{order.id_pedido}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-slate-800">
                                {order.sector}
                              </span>
                              {order.prioridad === "urgente" && (
                                <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                                  Urgente
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate">
                              Sol: {order.usuario_solicitante || "Operario"} · {order.total_items} {order.total_items === 1 ? "ítem" : "ítems"}
                              {order.turno ? ` · ${order.turno}` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {order.fecha_requerida && (
                            <span className="text-[11px] text-slate-500 hidden sm:inline font-mono">
                              {formatSoloFechaAR(order.fecha_requerida)}
                            </span>
                          )}
                          <Badge className={`${cfg.color} text-[10px] font-semibold border`} variant="outline">
                            {cfg.label}
                          </Badge>
                          {order.id_remito ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs font-medium"
                              onClick={() => {
                                setSelectedRemitoId(order.id_remito);
                                setIsRemitoModalOpen(true);
                              }}
                            >
                              Remito
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs font-medium"
                              onClick={() => navigate(`/deposito/preparacion/${order.id_pedido}`)}
                            >
                              Ver
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Columna Lateral (1 columna de ancho) */}
        <div className="space-y-6">
          {/* Card: Acciones Rápidas */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="py-3 px-6 border-b border-slate-100">
              <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Acciones Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2">
              {!isDepositoOrCL2 && (
                <Link to="/nuevo-pedido" className="block">
                  <Button className="w-full justify-start text-xs bg-blue-600 hover:bg-blue-700 text-white" size="default">
                    <FilePlus className="w-4 h-4 mr-2.5" />
                    Crear nuevo pedido
                  </Button>
                </Link>
              )}

              <Link to="/deposito" className="block">
                <Button variant="outline" className="w-full justify-start text-xs text-slate-800 hover:bg-slate-100" size="default">
                  <Warehouse className="w-4 h-4 mr-2.5 text-slate-500" />
                  Preparación de pedidos CL2
                </Button>
              </Link>

              {!isDepositoOrCL2 && (
                <Link to="/conteo" className="block">
                  <Button variant="outline" className="w-full justify-start text-xs text-slate-800 hover:bg-slate-100" size="default">
                    <ClipboardList className="w-4 h-4 mr-2.5 text-slate-500" />
                    Conteo físico de planta
                  </Button>
                </Link>
              )}

              <Link to="/materiales" className="block">
                <Button variant="outline" className="w-full justify-start text-xs text-slate-800 hover:bg-slate-100" size="default">
                  <Package className="w-4 h-4 mr-2.5 text-slate-500" />
                  Control Stock CL2
                </Button>
              </Link>

              {!isDepositoOrCL2 && (
                <Link to="/rundown" className="block">
                  <Button variant="outline" className="w-full justify-start text-xs text-slate-800 hover:bg-slate-100" size="default">
                    <BarChart2 className="w-4 h-4 mr-2.5 text-slate-500" />
                    Rundown vivo
                  </Button>
                </Link>
              )}

              <Link to="/remitos" className="block">
                <Button variant="outline" className="w-full justify-start text-xs text-slate-800 hover:bg-slate-100" size="default">
                  <Receipt className="w-4 h-4 mr-2.5 text-slate-500" />
                  Histórico de remitos
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Card: Nivel de Servicio / Fill Rate */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="py-3 px-6 border-b border-slate-100">
              <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Cumplimiento de Despacho
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-center py-2">
                <div className="text-4xl font-extrabold text-slate-900 font-mono mb-1">
                  {loading ? "..." : `${data?.kpis.fill_rate_porcentaje ?? 100}%`}
                </div>
                <p className="text-xs text-slate-500 mb-3">Tasa de entrega (Unidades preparadas vs solicitadas)</p>

                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(data?.kpis.fill_rate_porcentaje ?? 100, 100)}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-100">
                  <span>Remitos despachados:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {loading ? "..." : data?.kpis.remitos_hoy ?? 0}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1">
                  <span>Total pedidos registrados:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {loading ? "..." : data?.kpis.total_pedidos ?? 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <DeliveryNoteModal
        isOpen={isRemitoModalOpen}
        onClose={() => setIsRemitoModalOpen(false)}
        idRemito={selectedRemitoId}
      />
    </div>
  );
}
