import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import {
  Search,
  Package,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sun,
  Moon,
  Lock,
  User,
  Building,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { getPedidos, type PedidoOut } from "../services/api";
import { formatSoloFechaAR, formatFechaHoraAR } from "../components/ui/format";
import { DeliveryNoteModal } from "../components/DeliveryNoteModal";

const statusConfig: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "bg-amber-100 text-amber-800 border-amber-200" },
  en_preparacion: { label: "En preparación", color: "bg-blue-100 text-blue-800 border-blue-200" },
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

const SECTORES_FILTER = ["TODOS", "Despacho", "PC", "CL2", "Recepcion", "Administracion"];

export function WarehouseOrders() {
  const [orders, setOrders] = useState<PedidoOut[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sectorFilter, setSectorFilter] = useState<string>("TODOS");
  const [search, setSearch] = useState<string>("");
  const [isRemitoModalOpen, setIsRemitoModalOpen] = useState<boolean>(false);
  const [selectedRemitoId, setSelectedRemitoId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPedidos({
        limit: 100,
        estado: (statusFilter === "all" || statusFilter === "tarde") ? undefined : statusFilter,
        sector: sectorFilter === "TODOS" ? undefined : sectorFilter,
      });
      setOrders(res.items);
    } catch {
      toast.error("Error al cargar los pedidos del depósito");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sectorFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (statusFilter === "tarde") {
      list = list.filter((o) => o.es_demorado && o.estado !== "completo" && o.estado !== "cancelado");
    }
    if (!search.trim()) return list;
    const term = search.toLowerCase();
    return list.filter((o) => {
      const idMatch = String(o.id_pedido).includes(term);
      const sectorMatch = o.sector.toLowerCase().includes(term);
      const userMatch = (o.usuario_solicitante || "").toLowerCase().includes(term);
      const commentMatch = (o.comentario || "").toLowerCase().includes(term);
      return idMatch || sectorMatch || userMatch || commentMatch;
    });
  }, [orders, search, statusFilter]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const pendingCount = orders.filter((o) => o.estado === "pendiente").length;
  const lateCount = orders.filter((o) => o.es_demorado && o.estado !== "completo" && o.estado !== "cancelado").length;
  const inProgressCount = orders.filter((o) => o.estado === "en_preparacion").length;
  const completedTodayCount = orders.filter((o) => {
    if (o.estado !== "completo") return false;
    const req = o.fecha_requerida ? String(o.fecha_requerida).slice(0, 10) : "";
    const cre = String(o.fecha_creacion).slice(0, 10);
    return req === todayIso || cre === todayIso;
  }).length;

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
            Preparación y Gestión de Pedidos
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Visualización y control de preparación de pedidos solicitados a depósito
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchOrders}
          disabled={loading}
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-amber-200/80 bg-gradient-to-br from-amber-50/40 to-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
              Pendientes
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold text-amber-950 font-mono">{pendingCount}</div>
              {lateCount > 0 && (
                <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">
                  {lateCount} tarde
                </span>
              )}
            </div>
            <p className="text-xs text-amber-700 mt-1">Esperando inicio de preparación</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200/80 bg-gradient-to-br from-blue-50/40 to-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
              En preparación
            </CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-950 font-mono">{inProgressCount}</div>
            <p className="text-xs text-blue-700 mt-1">En armado / carga en depósito</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 to-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
              Completos hoy
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-950 font-mono">{completedTodayCount}</div>
            <p className="text-xs text-emerald-700 mt-1">Despachados o finalizados hoy</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xs border-slate-200">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por N.º, solicitante o sector..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="w-full sm:w-44 text-xs">
                <SelectValue placeholder="Sector" />
              </SelectTrigger>
              <SelectContent>
                {SECTORES_FILTER.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {s === "TODOS" ? "Todos los sectores" : s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44 text-xs">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos los estados</SelectItem>
                <SelectItem value="pendiente" className="text-xs">Pendientes</SelectItem>
                <SelectItem value="tarde" className="text-xs font-semibold text-rose-700">⚠️ Demorados / Tarde</SelectItem>
                <SelectItem value="en_preparacion" className="text-xs">En preparación</SelectItem>
                <SelectItem value="parcial" className="text-xs">Parciales</SelectItem>
                <SelectItem value="completo" className="text-xs">Completos</SelectItem>
                <SelectItem value="cancelado" className="text-xs">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xs border-slate-200">
        <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-900">
            Pedidos para depósito ({filteredOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="w-24">N.º Pedido</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Fecha Requerida / Turno</TableHead>
                  <TableHead className="text-center">Ítems</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                      <span className="text-xs">Cargando pedidos de depósito...</span>
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-slate-400">
                      <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-sm font-medium">No se encontraron pedidos con los filtros aplicados</p>
                      <p className="text-xs text-slate-400 mt-1">Los pedidos creados desde Nuevo Pedido o Conteo se reflejan aquí en tiempo real.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => {
                    const cfg = getOrderStatus(order);
                    return (
                      <TableRow key={order.id_pedido} className="hover:bg-slate-50/50">
                        <TableCell className="font-mono font-bold text-slate-900 text-xs">
                          #{order.id_pedido}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="bg-slate-100 text-slate-700 font-semibold border-slate-300 gap-1">
                            <Building className="w-3 h-3 text-slate-500" />
                            {order.sector}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-700">
                          {order.usuario_solicitante ? (
                            <span className="flex items-center gap-1 font-medium">
                              <User className="w-3 h-3 text-slate-400" />
                              {order.usuario_solicitante}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Sistema</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {order.fecha_requerida ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-semibold text-slate-800">
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
                            <span className="text-slate-400">Inmediato</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs bg-slate-50 font-mono">
                            {order.total_items}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={order.prioridad === "urgente" ? "destructive" : "outline"}
                            className="text-xs capitalize"
                          >
                            {order.prioridad === "urgente" ? "Urgente" : "Normal"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${cfg.color} text-xs border whitespace-nowrap font-medium gap-1`} variant="outline">
                            {cfg.isLate && <AlertCircle className="w-3 h-3 text-rose-600 inline flex-shrink-0" />}
                            <span>{cfg.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {order.estado === "cancelado" ? (
                            <Link to={`/pedidos/${order.id_pedido}`}>
                              <Button variant="outline" size="sm" className="h-8 text-xs text-slate-500">
                                Ver
                              </Button>
                            </Link>
                          ) : order.estado === "completo" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => {
                                setSelectedRemitoId(order.id_remito || String(order.id_pedido));
                                setIsRemitoModalOpen(true);
                              }}
                            >
                              Ver Remito
                            </Button>
                          ) : (
                            <Link to={`/deposito/preparacion/${order.id_pedido}`}>
                              <Button size="sm" className="h-8 text-xs gap-1.5">
                                <span>Preparar</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                          )}
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

      <DeliveryNoteModal
        isOpen={isRemitoModalOpen}
        onClose={() => setIsRemitoModalOpen(false)}
        idRemito={selectedRemitoId}
      />
    </div>
  );
}
