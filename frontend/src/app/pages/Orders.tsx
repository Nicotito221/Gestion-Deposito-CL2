import { Link } from "react-router";
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
import { formatDate } from "../components/ui/format";

interface Order {
  id: string;
  number: string;
  date: string;
  sector: string;
  status: "pendiente" | "en-preparacion" | "parcial" | "completo";
  priority: "normal" | "urgente";
  itemCount: number;
}

const myOrders: Order[] = [
  { id: "1", number: "000154", date: "10/06/2026", sector: "Producción", status: "en-preparacion", priority: "urgente", itemCount: 3 },
  { id: "2", number: "000149", date: "08/06/2026", sector: "Producción", status: "completo", priority: "normal", itemCount: 5 },
  { id: "3", number: "000142", date: "05/06/2026", sector: "Producción", status: "completo", priority: "normal", itemCount: 2 },
  { id: "4", number: "000138", date: "03/06/2026", sector: "Producción", status: "completo", priority: "normal", itemCount: 4 },
];

const statusConfig = {
  pendiente: { label: "Pendiente", color: "bg-slate-100 text-slate-700" },
  "en-preparacion": { label: "En preparación", color: "bg-blue-100 text-blue-700" },
  parcial: { label: "Parcial", color: "bg-amber-100 text-amber-700" },
  completo: { label: "Completo", color: "bg-green-100 text-green-700" },
};

export function Orders() {
  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-2">Mis pedidos</h1>
        <p className="text-slate-600">Historial de pedidos realizados por Nicolás</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-slate-900">Pedidos realizados</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N.º pedido</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="hidden sm:table-cell">Ítems</TableHead>
                  <TableHead className="hidden sm:table-cell">Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myOrders.map((order) => {
                  const cfg = statusConfig[order.status];
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono font-bold text-slate-900">
                        #{order.number}
                      </TableCell>
                      <TableCell className="text-slate-600 whitespace-nowrap">
                        {formatDate(order.date)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline">{order.itemCount} ítems</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {order.priority === "urgente" ? (
                          <Badge variant="destructive">Urgente</Badge>
                        ) : (
                          <Badge variant="outline">Normal</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${cfg.color} whitespace-nowrap`} variant="outline">
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={`/pedidos/${order.number}`}>
                          <Button variant="outline" size="sm">Ver</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
