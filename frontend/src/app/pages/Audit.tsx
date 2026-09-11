import { useState } from "react";
import { formatDate } from "../components/ui/format";
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
} from "lucide-react";

interface TraceEvent {
  timestamp: string;
  action: string;
  user: string;
  role: string;
  detail: string;
  type: "solicitud" | "aprobacion" | "preparacion" | "entrega" | "ajuste" | "sistema";
}

interface TraceOrder {
  id: string;
  number: string;
  sector: string;
  status: string;
  events: TraceEvent[];
}

const traceOrders: TraceOrder[] = [
  {
    id: "1",
    number: "000154",
    sector: "Producción",
    status: "en-preparacion",
    events: [
      { timestamp: "10/06/2026 09:15", action: "Pedido creado", user: "Nicolás", role: "Solicitante", detail: "Pedido de 3 materiales — prioridad urgente", type: "solicitud" },
      { timestamp: "10/06/2026 09:48", action: "Pedido aprobado", user: "Fernando", role: "Supervisor", detail: "Aprobado sin modificaciones", type: "aprobacion" },
      { timestamp: "10/06/2026 10:30", action: "Preparación iniciada", user: "Carlos", role: "Operario depósito", detail: "Inicio de preparación en sector B", type: "preparacion" },
    ],
  },
  {
    id: "2",
    number: "000153",
    sector: "Mantenimiento",
    status: "completo",
    events: [
      { timestamp: "10/06/2026 07:30", action: "Pedido creado", user: "Laura", role: "Solicitante", detail: "Pedido de 2 materiales — prioridad normal", type: "solicitud" },
      { timestamp: "10/06/2026 07:55", action: "Pedido aprobado", user: "Fernando", role: "Supervisor", detail: "Aprobado sin modificaciones", type: "aprobacion" },
      { timestamp: "10/06/2026 08:45", action: "Preparación iniciada", user: "Juan", role: "Operario depósito", detail: "Inicio de preparación", type: "preparacion" },
      { timestamp: "10/06/2026 09:10", action: "Pedido preparado", user: "Juan", role: "Operario depósito", detail: "Material 1: 10 UN, Material 2: 5 KG — completo", type: "preparacion" },
      { timestamp: "10/06/2026 09:30", action: "Entrega confirmada", user: "Laura", role: "Solicitante", detail: "Recepción confirmada. Remito RI-000153 generado.", type: "entrega" },
    ],
  },
  {
    id: "3",
    number: "000152",
    sector: "Administración",
    status: "parcial",
    events: [
      { timestamp: "09/06/2026 14:00", action: "Pedido creado", user: "Marcos", role: "Solicitante", detail: "Pedido de 4 materiales — prioridad normal", type: "solicitud" },
      { timestamp: "09/06/2026 14:30", action: "Pedido aprobado", user: "Fernando", role: "Supervisor", detail: "Aprobado sin modificaciones", type: "aprobacion" },
      { timestamp: "09/06/2026 15:45", action: "Preparación iniciada", user: "Carlos", role: "Operario depósito", detail: "Inicio de preparación", type: "preparacion" },
      { timestamp: "09/06/2026 16:20", action: "Pedido parcial confirmado", user: "Carlos", role: "Operario depósito", detail: "Material 3 con stock insuficiente (5/8 MT disponible)", type: "ajuste" },
      { timestamp: "09/06/2026 16:35", action: "Entrega parcial confirmada", user: "Marcos", role: "Solicitante", detail: "Recepción parcial confirmada. Remito RI-000152 generado.", type: "entrega" },
    ],
  },
  {
    id: "4",
    number: "000151",
    sector: "Logística",
    status: "completo",
    events: [
      { timestamp: "09/06/2026 09:00", action: "Pedido creado", user: "Pablo", role: "Solicitante", detail: "Pedido de 2 materiales — prioridad normal", type: "solicitud" },
      { timestamp: "09/06/2026 09:20", action: "Pedido aprobado", user: "Fernando", role: "Supervisor", detail: "Aprobado sin modificaciones", type: "aprobacion" },
      { timestamp: "09/06/2026 10:00", action: "Preparación iniciada", user: "Juan", role: "Operario depósito", detail: "Inicio de preparación", type: "preparacion" },
      { timestamp: "09/06/2026 10:25", action: "Pedido preparado", user: "Juan", role: "Operario depósito", detail: "Completo", type: "preparacion" },
      { timestamp: "09/06/2026 10:45", action: "Entrega confirmada", user: "Pablo", role: "Solicitante", detail: "Recepción confirmada. Remito RI-000151 generado.", type: "entrega" },
    ],
  },
];

const allLogs = traceOrders.flatMap((o) =>
  o.events.map((e) => ({ ...e, orderNumber: o.number, sector: o.sector }))
).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

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
};

export function Audit() {
  const [search, setSearch] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<string | null>("2");
  const [view, setView] = useState<"trace" | "log">("trace");
  const [logFilter, setLogFilter] = useState("all");

  const filteredOrders = traceOrders.filter(
    (o) =>
      o.number.includes(search) ||
      o.sector.toLowerCase().includes(search.toLowerCase())
  );

  const filteredLogs = allLogs.filter(
    (l) => logFilter === "all" || l.type === logFilter
  );

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900 mb-2">
          Auditoría y trazabilidad
        </h1>
        <p className="text-slate-600">
          Historial completo de acciones por pedido: quién solicitó, aprobó, preparó y entregó
        </p>
      </div>

      {/* Tabs */}
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

      {view === "trace" && (
        <>
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar por N.º de pedido o sector..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const isOpen = expandedOrder === order.id;
              const cfg = statusConfig[order.status];
              return (
                <Card key={order.id} className={isOpen ? "border-slate-300 shadow-sm" : ""}>
                  <button
                    onClick={() => setExpandedOrder(isOpen ? null : order.id)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <div className="flex-1 flex items-center gap-3">
                      <span className="font-mono font-bold text-slate-900">
                        #{order.number}
                      </span>
                      <span className="text-slate-600 text-sm">{order.sector}</span>
                      <Badge className={`${cfg.color} text-xs`} variant="outline">
                        {cfg.label}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {order.events.length} eventos
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
                      {/* Timeline */}
                      <div className="relative ml-4">
                        <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-200" />
                        <div className="space-y-4">
                          {order.events.map((event, idx) => {
                            const tc = typeConfig[event.type];
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
                    placeholder="Buscar en el log..."
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
                    <SelectItem value="aprobacion">Aprobaciones</SelectItem>
                    <SelectItem value="preparacion">Preparación</SelectItem>
                    <SelectItem value="entrega">Entregas</SelectItem>
                    <SelectItem value="ajuste">Ajustes</SelectItem>
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
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha y hora</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Acción</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log, idx) => {
                      const tc = typeConfig[log.type];
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs text-slate-600">{log.timestamp}</TableCell>
                          <TableCell className="font-mono font-semibold text-sm">#{log.orderNumber}</TableCell>
                          <TableCell>
                            <div className={`flex items-center gap-1.5 ${tc.color}`}>
                              {tc.icon}
                              <span className="text-xs capitalize">{log.type}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-sm">{log.action}</TableCell>
                          <TableCell className="text-slate-700">{log.user}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{log.role}</Badge>
                          </TableCell>
                          <TableCell className="text-slate-500 text-xs max-w-48 truncate" title={log.detail}>
                            {log.detail}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
