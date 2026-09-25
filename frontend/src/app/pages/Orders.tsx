import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { RefreshCw, ShoppingCart, Calendar, Sun, Moon, Lock, Building, User, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { getPedidos, type PedidoOut } from "../services/api";
import { formatSoloFechaAR, formatFechaHoraAR } from "../components/ui/format";

const statusConfig: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "bg-amber-100 text-amber-800 border-amber-200" },
  en_preparacion: { label: "En preparación", color: "bg-blue-100 text-blue-800 border-blue-200" },
  en_transito: { label: "En tránsito", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  parcial: { label: "Parcial", color: "bg-orange-100 text-orange-800 border-orange-200" },
  completo: { label: "Completo", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  cancelado: { label: "Cancelado", color: "bg-slate-100 text-slate-600 border-slate-200" },
};

function getOrderStatus(order: PedidoOut) {
  if (order.es_demorado && (order.estado === "pendiente" || order.estado === "en_preparacion")) {
    return { label: "Pendiente (Tarde)", color: "bg-rose-100 text-rose-800 border-rose-300 font-bold", isLate: true };
  }
  if (order.es_demorado && order.estado === "parcial") {
    return { label: "Parcial (Tarde)", color: "bg-rose-100 text-rose-800 border-rose-300 font-bold", isLate: true };
  }
  const cfg = statusConfig[order.estado] || {
    label: order.estado,
    color: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return { ...cfg, isLate: false };
}

export function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PedidoOut[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPedidos({ limit: 50 });
      setOrders(res.items);
    } catch {
      toast.error("Error al cargar pedidos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-1">Mis pedidos</h1>
          <p className="text-slate-600 text-sm">Historial y seguimiento de pedidos emitidos hacia el depósito</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Link to="/nuevo-pedido">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs">
              <ShoppingCart className="w-3.5 h-3.5" />
              Nuevo Pedido
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-slate-900 text-base font-bold">Pedidos registrados ({orders.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N.º pedido</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Fecha Emisión</TableHead>
                  <TableHead>Fecha Requerida / Turno</TableHead>
                  <TableHead className="hidden sm:table-cell">Ítems</TableHead>
                  <TableHead className="hidden sm:table-cell">Prioridad</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                      Cargando pedidos...
                    </TableCell>
                  </TableRow>
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-slate-400">
                      No hay pedidos registrados aún. Cree uno desde Conteo o Nuevo Pedido.
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => {
                    const cfg = getOrderStatus(order);

                    return (
                      <TableRow
                        key={order.id_pedido}
                        onClick={() => navigate(`/pedidos/${order.id_pedido}`)}
                        className="cursor-pointer hover:bg-blue-50/50 transition-colors"
                        title={`Ver detalle del pedido #${order.id_pedido}`}
                      >
                        <TableCell className="font-mono font-bold text-slate-900">
                          #{order.id_pedido}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-800">
                            <Building className="w-3.5 h-3.5 text-blue-600" />
                            <span>{order.sector}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {order.usuario_solicitante ? (
                            <span className="font-medium text-slate-800">{order.usuario_solicitante}</span>
                          ) : (
                            <span className="text-slate-400">Sistema</span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-600 text-xs whitespace-nowrap">
                          {formatFechaHoraAR(order.fecha_creacion)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {order.fecha_requerida ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-semibold text-slate-800">
                                {formatSoloFechaAR(order.fecha_requerida)}
                              </span>
                              {order.turno && (
                                <Badge variant="outline" className="text-[10px] py-0 bg-blue-50 text-blue-700 border-blue-200 font-bold flex items-center gap-1">
                                  {(order.turno === "Turno Mañana" || order.turno === "T1") && <Sun className="w-2.5 h-2.5 text-amber-500" />}
                                  {(order.turno === "Turno Tarde" || order.turno === "T2") && <Moon className="w-2.5 h-2.5 text-indigo-500" />}
                                  {(order.turno === "Turno Noche" || order.turno === "T3") && <Lock className="w-2.5 h-2.5 text-slate-500" />}
                                  {order.turno}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">Inmediato</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs bg-slate-50 font-mono">
                            {order.total_items} ítems
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {order.prioridad === "urgente" ? (
                            <Badge variant="destructive" className="text-xs">Urgente</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-slate-600">Normal</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[11px] bg-slate-50 text-slate-600">
                            {order.origen === "conteo_planta" ? "Conteo Planta" : order.origen}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${cfg.color} text-xs border whitespace-nowrap font-medium gap-1`} variant="outline">
                            {cfg.isLate && <AlertCircle className="w-3 h-3 text-rose-600 inline flex-shrink-0" />}
                            <span>{cfg.label}</span>
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
