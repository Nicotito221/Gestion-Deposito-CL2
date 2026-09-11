import { useNavigate, useParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { formatDate } from "../components/ui/format";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  ArrowLeft,
  Calendar,
  User,
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

interface MaterialItem {
  id: string;
  code: string;
  name: string;
  quantityRequested: number;
  quantityPrepared: number;
  unit: string;
  status: "pendiente" | "preparado" | "parcial";
}

// Mock data indexed by order number
const orderData: Record<
  string,
  {
    sector: string;
    date: string;
    requestedBy: string;
    preparedBy: string;
    status: "pendiente" | "en-preparacion" | "parcial" | "completo";
    priority: "normal" | "urgente";
    observations: string;
    materials: MaterialItem[];
  }
> = {
  "000154": {
    sector: "Producción",
    date: "10/06/2026",
    requestedBy: "Nicolás",
    preparedBy: "—",
    status: "en-preparacion",
    priority: "urgente",
    observations: "",
    materials: [
      { id: "1", code: "Código 001", name: "Material 1", quantityRequested: 10, quantityPrepared: 0, unit: "UN", status: "pendiente" },
      { id: "2", code: "Código 002", name: "Material 2", quantityRequested: 5, quantityPrepared: 0, unit: "KG", status: "pendiente" },
      { id: "3", code: "Código 003", name: "Material 3", quantityRequested: 8, quantityPrepared: 0, unit: "MT", status: "pendiente" },
    ],
  },
  "000149": {
    sector: "Producción",
    date: "08/06/2026",
    requestedBy: "Nicolás",
    preparedBy: "Carlos",
    status: "completo",
    priority: "normal",
    observations: "Material 3 entregado parcialmente por stock insuficiente.",
    materials: [
      { id: "1", code: "Código 001", name: "Material 1", quantityRequested: 20, quantityPrepared: 20, unit: "UN", status: "preparado" },
      { id: "2", code: "Código 004", name: "Material 4", quantityRequested: 10, quantityPrepared: 10, unit: "LT", status: "preparado" },
      { id: "3", code: "Código 005", name: "Material 5", quantityRequested: 15, quantityPrepared: 12, unit: "UN", status: "parcial" },
      { id: "4", code: "Código 006", name: "Material 6", quantityRequested: 30, quantityPrepared: 30, unit: "KG", status: "preparado" },
      { id: "5", code: "Código 002", name: "Material 2", quantityRequested: 8, quantityPrepared: 8, unit: "KG", status: "preparado" },
    ],
  },
  "000142": {
    sector: "Producción",
    date: "05/06/2026",
    requestedBy: "Nicolás",
    preparedBy: "Juan",
    status: "completo",
    priority: "normal",
    observations: "",
    materials: [
      { id: "1", code: "Código 003", name: "Material 3", quantityRequested: 50, quantityPrepared: 50, unit: "MT", status: "preparado" },
      { id: "2", code: "Código 001", name: "Material 1", quantityRequested: 5, quantityPrepared: 5, unit: "UN", status: "preparado" },
    ],
  },
  "000138": {
    sector: "Producción",
    date: "03/06/2026",
    requestedBy: "Nicolás",
    preparedBy: "Juan",
    status: "completo",
    priority: "normal",
    observations: "",
    materials: [
      { id: "1", code: "Código 002", name: "Material 2", quantityRequested: 25, quantityPrepared: 25, unit: "KG", status: "preparado" },
      { id: "2", code: "Código 005", name: "Material 5", quantityRequested: 10, quantityPrepared: 10, unit: "UN", status: "preparado" },
      { id: "3", code: "Código 006", name: "Material 6", quantityRequested: 40, quantityPrepared: 40, unit: "KG", status: "preparado" },
      { id: "4", code: "Código 004", name: "Material 4", quantityRequested: 5, quantityPrepared: 5, unit: "LT", status: "preparado" },
    ],
  },
};

const statusConfig = {
  pendiente: { label: "Pendiente", color: "bg-slate-100 text-slate-700" },
  "en-preparacion": { label: "En preparación", color: "bg-blue-100 text-blue-700" },
  parcial: { label: "Parcial", color: "bg-amber-100 text-amber-700" },
  completo: { label: "Completo", color: "bg-green-100 text-green-700" },
};

function getStatusBadge(status: MaterialItem["status"]) {
  switch (status) {
    case "preparado":
      return (
        <Badge className="bg-green-100 text-green-700" variant="outline">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Preparado
        </Badge>
      );
    case "parcial":
      return (
        <Badge className="bg-amber-100 text-amber-700" variant="outline">
          <AlertCircle className="w-3 h-3 mr-1" />
          Parcial
        </Badge>
      );
    default:
      return (
        <Badge className="bg-slate-100 text-slate-700" variant="outline">
          Pendiente
        </Badge>
      );
  }
}

export function OrderDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

  const order = orderData[id ?? ""] ?? orderData["000154"];
  const statusCfg = statusConfig[order.status];

  const totalItems = order.materials.length;
  const preparedItems = order.materials.filter(
    (m) => m.quantityPrepared === m.quantityRequested
  ).length;
  const progressPercentage =
    totalItems > 0 ? Math.round((preparedItems / totalItems) * 100) : 0;

  const hasRemito = order.status === "completo" || order.status === "parcial";

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/pedidos")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a mis pedidos
        </Button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 mb-2">
              Pedido N.º {id}
            </h1>
            <div className="flex items-center gap-2">
              <Badge className={statusCfg.color} variant="outline">
                {statusCfg.label}
              </Badge>
              {order.priority === "urgente" && (
                <Badge variant="destructive">Urgente</Badge>
              )}
              <div className="flex items-center gap-1.5 text-sm text-slate-500 ml-2">
                <Eye className="w-4 h-4" />
                <span>Solo consulta</span>
              </div>
            </div>
          </div>

          {hasRemito && (
            <Button
              onClick={() => toast.success("Descargando remito RI-" + id + "…")}
            >
              <Download className="w-4 h-4 mr-2" />
              Descargar remito
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos generales */}
          <Card>
            <CardHeader>
              <CardTitle className="text-slate-900">Datos generales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Sector solicitante</p>
                    <p className="font-semibold text-slate-900">{order.sector}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Fecha de solicitud</p>
                    <p className="font-semibold text-slate-900">{formatDate(order.date)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Usuario solicitante</p>
                    <p className="font-semibold text-slate-900">{order.requestedBy}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Preparado por</p>
                    <p className="font-semibold text-slate-900">{order.preparedBy}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Estado actual</p>
                    <Badge className={statusCfg.color} variant="outline">
                      {statusCfg.label}
                    </Badge>
                  </div>
                </div>

                {hasRemito && (
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">N.º de remito</p>
                      <p className="font-semibold text-slate-900 font-mono">
                        RI-{id}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tabla de materiales — solo lectura */}
          <Card>
            <CardHeader>
              <CardTitle className="text-slate-900">Materiales del pedido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-center">Cant. solicitada</TableHead>
                      <TableHead className="text-center">Cant. preparada</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.materials.map((material) => (
                      <TableRow key={material.id}>
                        <TableCell className="font-mono text-sm text-slate-600">
                          {material.code}
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">
                          {material.name}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-slate-700">
                          {material.quantityRequested}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`font-semibold ${
                              material.quantityPrepared === material.quantityRequested
                                ? "text-green-700"
                                : material.quantityPrepared > 0
                                ? "text-amber-700"
                                : "text-slate-400"
                            }`}
                          >
                            {material.quantityPrepared > 0
                              ? material.quantityPrepared
                              : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {material.unit}
                        </TableCell>
                        <TableCell>{getStatusBadge(material.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Observaciones — solo lectura */}
          {order.observations && (
            <Card>
              <CardHeader>
                <CardTitle className="text-slate-900">
                  Observaciones del depósito
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 text-sm bg-slate-50 rounded-lg p-4 border border-slate-100">
                  {order.observations}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Botón remito al pie — solo si corresponde */}
          {hasRemito && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => toast.success("Descargando remito RI-" + id + "…")}
              >
                <Download className="w-4 h-4 mr-2" />
                Descargar remito RI-{id}
              </Button>
            </div>
          )}
        </div>

        {/* Panel lateral */}
        <div className="space-y-6">
          {/* Progreso */}
          <Card>
            <CardHeader>
              <CardTitle className="text-slate-900">Progreso del pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">Completado</span>
                  <span className="font-bold text-slate-900">
                    {progressPercentage}%
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>

              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Total de ítems</span>
                  <span className="font-semibold text-slate-900">{totalItems}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Ítems preparados</span>
                  <Badge className="bg-green-100 text-green-700" variant="outline">
                    {preparedItems}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Ítems pendientes</span>
                  <Badge className="bg-slate-100 text-slate-700" variant="outline">
                    {totalItems - preparedItems}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Remito disponible */}
          {hasRemito && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6">
                <div className="flex gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-green-900 mb-1">
                      Remito disponible
                    </p>
                    <p className="text-sm text-green-800">
                      El remito RI-{id} fue generado automáticamente al confirmar
                      la preparación.
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => toast.success("Descargando remito RI-" + id + "…")}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar remito
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Modo solo consulta */}
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="pt-5 pb-5">
              <div className="flex gap-2">
                <Eye className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-slate-500">
                  Esta vista es de solo consulta. Las modificaciones al pedido
                  son gestionadas exclusivamente por el depósito.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
