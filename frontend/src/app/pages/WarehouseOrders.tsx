import { useState } from "react";
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
import { Search, Package, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { formatDate } from "../components/ui/format";

type OrderStatus = "pendiente" | "en-preparacion" | "parcial" | "completo";

interface Order {
  id: string;
  number: string;
  date: string;
  sector: string;
  itemCount: number;
  priority: "normal" | "urgente";
  status: OrderStatus;
}

const mockOrders: Order[] = [
  { id: "1", number: "000154", date: "10/06/2026", sector: "PC", itemCount: 5, priority: "urgente", status: "pendiente" },
  { id: "2", number: "000153", date: "10/06/2026", sector: "Despacho", itemCount: 3, priority: "normal", status: "en-preparacion" },
  { id: "3", number: "000152", date: "09/06/2026", sector: "Administracion", itemCount: 8, priority: "normal", status: "parcial" },
  { id: "4", number: "000151", date: "09/06/2026", sector: "Recepcion", itemCount: 4, priority: "normal", status: "completo" },
  { id: "5", number: "000150", date: "09/06/2026", sector: "CL2", itemCount: 6, priority: "urgente", status: "en-preparacion" },
];

const statusConfig: Record<OrderStatus, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "bg-slate-100 text-slate-700" },
  "en-preparacion": { label: "En preparación", color: "bg-blue-100 text-blue-700" },
  parcial: { label: "Parcial", color: "bg-amber-100 text-amber-700" },
  completo: { label: "Completo", color: "bg-green-100 text-green-700" },
};

export function WarehouseOrders() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filteredOrders = mockOrders.filter((order) => {
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesSearch =
      search === "" ||
      order.number.includes(search) ||
      order.sector.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const pendingCount = mockOrders.filter((o) => o.status === "pendiente").length;
  const inProgressCount = mockOrders.filter((o) => o.status === "en-preparacion").length;
  const completedTodayCount = mockOrders.filter(
    (o) => o.status === "completo" && o.date === "10/06/2026"
  ).length;

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-2">
          Pedidos pendientes
        </h1>
        <p className="text-slate-600">Gestione los pedidos recibidos del depósito</p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3 sm:gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-600">Pendientes</CardTitle>
            <AlertCircle className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{pendingCount}</div>
            <p className="text-xs text-slate-500 mt-1 hidden sm:block">Requieren atención</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-600">En preparación</CardTitle>
            <Package className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{inProgressCount}</div>
            <p className="text-xs text-slate-500 mt-1 hidden sm:block">En proceso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-600">Completos hoy</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{completedTodayCount}</div>
            <p className="text-xs text-slate-500 mt-1 hidden sm:block">Finalizados hoy</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por N.º o sector"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="sm:w-48">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="en-preparacion">En preparación</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="completo">Completo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle className="text-slate-900">
            Lista de pedidos ({filteredOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N.º pedido</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="hidden sm:table-cell">Sector</TableHead>
                  <TableHead className="hidden md:table-cell">Ítems</TableHead>
                  <TableHead className="hidden md:table-cell">Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono font-bold text-slate-900">
                      #{order.number}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-slate-600">
                      {formatDate(order.date)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-slate-700">
                      {order.sector}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline">{order.itemCount} ítems</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant={order.priority === "urgente" ? "destructive" : "outline"}>
                        {order.priority === "urgente" ? "Urgente" : "Normal"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusConfig[order.status].color} whitespace-nowrap`} variant="outline">
                        {statusConfig[order.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/deposito/preparacion/${order.number}`}>
                        <Button variant="outline" size="sm">Ver</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
