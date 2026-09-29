import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Search,
  User,
  CheckCircle2,
  Package,
  FileText,
  Truck,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Shield,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { getAuditoriaPedidos, TraceOrder, TraceEvent } from "../services/api";

const typeConfig: Record<TraceEvent["type"], { icon: React.ReactNode; color: string; bg: string }> = {
  solicitud: { icon: <FileText className="w-4 h-4" />, color: "text-slate-600", bg: "bg-slate-100" },
  aprobacion: { icon: <CheckCircle2 className="w-4 h-4" />, color: "text-green-600", bg: "bg-green-100" },
  preparacion: { icon: <Package className="w-4 h-4" />, color: "text-blue-600", bg: "bg-blue-100" },
  entrega: { icon: <Truck className="w-4 h-4" />, color: "text-green-700", bg: "bg-green-100" },
  ajuste: { icon: <AlertCircle className="w-4 h-4" />, color: "text-amber-600", bg: "bg-amber-100" },
  sistema: { icon: <Shield className="w-4 h-4" />, color: "text-purple-600", bg: "bg-purple-100" },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "bg-slate-100 text-slate-700" },
  "en-preparacion": { label: "En preparación", color: "bg-blue-100 text-blue-700" },
  parcial: { label: "Parcial", color: "bg-amber-100 text-amber-700" },
  completo: { label: "Completo", color: "bg-green-100 text-green-700" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-700" },
};

export function Audit() {
  const [orders, setOrders] = useState<TraceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [view, setView] = useState<"trace" | "log">("trace");

  const [logSearch, setLogSearch] = useState("");
  const [logFilter, setLogFilter] = useState("all");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAuditoriaPedidos();
      setOrders(res.orders);
      if (res.orders.length > 0 && !expandedOrder) {
        setExpandedOrder(res.orders[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar historial de auditoría");
    } finally {
      setLoading(false);
    }
  }, [expandedOrder]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const uniqueSectors = useMemo(() => {
    const s = new Set<string>();
    orders.forEach((o) => {
      if (o.sector) s.add(o.sector);
    });
    return Array.from(s).sort();
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      const matchSearch =
        !q ||
        o.number.toLowerCase().includes(q) ||
        o.sector.toLowerCase().includes(q) ||
        o.events.some((e) => e.detail.toLowerCase().includes(q) || e.user.toLowerCase().includes(q));

      const matchSector = sectorFilter === "all" || o.sector === sectorFilter;
      const matchStatus = statusFilter === "all" || o.status === statusFilter;

      return matchSearch && matchSector && matchStatus;
    });
  }, [orders, search, sectorFilter, statusFilter]);

  const allLogs = useMemo(() => {
    return orders.flatMap((o) =>
      o.events.map((e) => ({ ...e, orderNumber: o.number, sector: o.sector }))
    );
  }, [orders]);

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return allLogs.filter((l) => {
      const matchType = logFilter === "all" || l.type === logFilter;
      const matchSearch =
        !q ||
        l.orderNumber.toLowerCase().includes(q) ||
        l.sector.toLowerCase().includes(q) ||
        l.user.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.detail.toLowerCase().includes(q);

      return matchType && matchSearch;
    });
  }, [allLogs, logFilter, logSearch]);

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 mb-2">
            Auditoría y trazabilidad
          </h1>
          <p className="text-slate-600">
            Historial completo de acciones por pedido: quién solicitó, aprobó, preparó y entregó
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadData()}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      <div className="flex gap-2 mb-6">
        <Button
          variant={view === "trace" ? "default" : "outline"}
          onClick={() => setView("trace")}
        >
          Trazabilidad por pedido
        </Button>
        <Button
          variant={view === "log" ? "default" : "outline"}
          onClick={() => setView("log")}
        >
          Log de auditoría
        </Button>
      </div>

      {error && (
        <Card className="mb-6 border-red-200 bg-red-50 text-red-700">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </CardContent>
        </Card>
      )}

      {loading && orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-slate-400" />
          <p className="text-sm">Cargando registros de trazabilidad...</p>
        </div>
      ) : (
        <>
          {view === "trace" && (
            <>
              <Card className="mb-4">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative md:col-span-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Buscar por N.º de pedido o solicitante..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <div>
                      <Select value={sectorFilter} onValueChange={setSectorFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Filtrar por sector" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los sectores</SelectItem>
                          {uniqueSectors.map((sec) => (
                            <SelectItem key={sec} value={sec}>
                              {sec}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Filtrar por estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los estados</SelectItem>
                          <SelectItem value="pendiente">Pendiente</SelectItem>
                          <SelectItem value="en-preparacion">En preparación</SelectItem>
                          <SelectItem value="parcial">Parcial</SelectItem>
                          <SelectItem value="completo">Completo</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {filteredOrders.length === 0 ? (
                <Card className="p-8 text-center text-slate-500">
                  <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-base font-medium text-slate-700">No se encontraron pedidos</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {search || sectorFilter !== "all" || statusFilter !== "all"
                      ? "Prueba modificando los filtros aplicados"
                      : "Aún no se registraron pedidos en el sistema"}
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredOrders.map((order) => {
                    const isOpen = expandedOrder === order.id;
                    const cfg = statusConfig[order.status] || {
                      label: order.status,
                      color: "bg-slate-100 text-slate-700",
                    };
                    return (
                      <Card key={order.id} className={isOpen ? "border-slate-300 shadow-sm" : ""}>
                        <button
                          onClick={() => setExpandedOrder(isOpen ? null : order.id)}
                          className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          <div className="flex-1 flex flex-wrap items-center gap-3">
                            <span className="font-mono font-bold text-slate-900">
                              #{order.number}
                            </span>
                            <span className="text-slate-600 text-sm">{order.sector}</span>
                            <Badge className={`${cfg.color} text-xs`} variant="outline">
                              {cfg.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {order.events.length} evento{order.events.length !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                          {isOpen ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </button>

                        {isOpen && (
                          <CardContent className="pt-0 pb-5 px-5">
                            <div className="relative ml-4">
                              <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-200" />
                              <div className="space-y-4">
                                {order.events.map((event, idx) => {
                                  const tc = typeConfig[event.type] || typeConfig.sistema;
                                  return (
                                    <div key={idx} className="flex gap-4 relative">
                                      <div
                                        className={`w-7 h-7 rounded-full ${tc.bg} flex items-center justify-center flex-shrink-0 relative z-10 -ml-0.5 ${tc.color}`}
                                      >
                                        {tc.icon}
                                      </div>
                                      <div className="flex-1 pb-2">
                                        <div className="flex items-start justify-between gap-2">
                                          <div>
                                            <p className="font-semibold text-slate-900 text-sm">
                                              {event.action}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                              <User className="w-3 h-3 text-slate-400" />
                                              <span className="text-xs text-slate-600">
                                                {event.user}
                                              </span>
                                              <span className="text-xs text-slate-400">·</span>
                                              <span className="text-xs text-slate-400">
                                                {event.role}
                                              </span>
                                            </div>
                                            {event.detail && (
                                              <p className="text-xs text-slate-500 mt-1 bg-slate-50 rounded px-2 py-1 border border-slate-100">
                                                {event.detail}
                                              </p>
                                            )}
                                          </div>
                                          <span className="text-xs text-slate-400 font-mono flex-shrink-0">
                                            {event.timestamp}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {view === "log" && (
            <>
              <Card className="mb-4">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Buscar en el log por texto, usuario o pedido..."
                        value={logSearch}
                        onChange={(e) => setLogSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={logFilter} onValueChange={setLogFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filtrar por tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los eventos</SelectItem>
                        <SelectItem value="solicitud">Solicitudes</SelectItem>
                        <SelectItem value="aprobacion">Aprobaciones / Validaciones</SelectItem>
                        <SelectItem value="preparacion">Preparación</SelectItem>
                        <SelectItem value="entrega">Entregas</SelectItem>
                        <SelectItem value="ajuste">Ajustes</SelectItem>
                        <SelectItem value="sistema">Sistema</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-slate-900">
                    Log de auditoría ({filteredLogs.length} registros)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredLogs.length === 0 ? (
                    <div className="py-8 text-center text-slate-500">
                      <p className="text-sm">No hay eventos que coincidan con los filtros seleccionados.</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha y hora</TableHead>
                            <TableHead>Pedido</TableHead>
                            <TableHead>Sector</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Acción</TableHead>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Rol</TableHead>
                            <TableHead>Detalle</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredLogs.map((log, idx) => {
                            const tc = typeConfig[log.type] || typeConfig.sistema;
                            return (
                              <TableRow key={idx}>
                                <TableCell className="font-mono text-xs text-slate-600 whitespace-nowrap">
                                  {log.timestamp}
                                </TableCell>
                                <TableCell className="font-mono font-semibold text-sm whitespace-nowrap">
                                  #{log.orderNumber}
                                </TableCell>
                                <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                                  {log.sector}
                                </TableCell>
                                <TableCell>
                                  <div className={`flex items-center gap-1.5 ${tc.color}`}>
                                    {tc.icon}
                                    <span className="text-xs capitalize">{log.type}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium text-sm whitespace-nowrap">{log.action}</TableCell>
                                <TableCell className="text-slate-700 text-xs whitespace-nowrap">{log.user}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs whitespace-nowrap">{log.role}</Badge>
                                </TableCell>
                                <TableCell className="text-slate-500 text-xs max-w-72 truncate" title={log.detail}>
                                  {log.detail}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
