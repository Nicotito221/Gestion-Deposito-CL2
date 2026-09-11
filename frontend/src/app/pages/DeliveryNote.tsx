import { useNavigate, useParams } from "react-router";
import { formatNow } from "../components/ui/format";
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
import {
  Download,
  Send,
  ArrowLeft,
  CheckCircle2,
  Calendar,
  User,
  Warehouse,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

interface Material {
  id: string;
  code: string;
  name: string;
  quantityRequested: number;
  quantityDelivered: number;
  unit: string;
  observations: string;
}

const materials: Material[] = [
  {
    id: "1",
    code: "Código 001",
    name: "Material 1",
    quantityRequested: 10,
    quantityDelivered: 10,
    unit: "UN",
    observations: "",
  },
  {
    id: "2",
    code: "Código 002",
    name: "Material 2",
    quantityRequested: 5,
    quantityDelivered: 5,
    unit: "KG",
    observations: "",
  },
  {
    id: "3",
    code: "Código 003",
    name: "Material 3",
    quantityRequested: 8,
    quantityDelivered: 5,
    unit: "MT",
    observations: "Entrega parcial - stock insuficiente",
  },
];

export function DeliveryNote() {
  const navigate = useNavigate();
  const { id } = useParams();
  const remitNumber = id || "000154";

  const handleDownloadPDF = () => {
    toast.success("Descargando remito en PDF...");
  };

  const handleSendConfirmation = () => {
    toast.success("Constancia enviada correctamente");
  };

  const currentDateTime = formatNow();

  const totalRequested = materials.reduce((sum, m) => sum + m.quantityRequested, 0);
  const totalDelivered = materials.reduce((sum, m) => sum + m.quantityDelivered, 0);
  const isPartial = totalDelivered < totalRequested;

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/deposito")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a pedidos
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 mb-2">
              Remito interno generado
            </h1>
            <p className="text-slate-600">
              El pedido ha sido procesado y está listo para su entrega
            </p>
          </div>
          <Badge className="bg-green-100 text-green-700 px-4 py-2 text-base">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Confirmado
          </Badge>
        </div>
      </div>

      {/* Mensaje destacado */}
      <Card className="mb-6 bg-green-50 border-green-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-900 mb-1">
                El pedido fue confirmado correctamente y quedó registrado en el
                historial.
              </p>
              <p className="text-sm text-green-800">
                Se ha generado el remito interno N.º RI-{remitNumber} y el pedido
                está listo para carga en camión.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contenido principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos del remito */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-slate-900">Datos del remito</CardTitle>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Número de remito</p>
                  <p className="text-xl font-bold text-slate-900 font-mono">
                    RI-{remitNumber}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">
                      Fecha y hora de confirmación
                    </p>
                    <p className="font-semibold text-slate-900">{currentDateTime}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Sector solicitante</p>
                    <p className="font-semibold text-slate-900">Producción</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Warehouse className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Depósito emisor</p>
                    <p className="font-semibold text-slate-900">Depósito Central</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Usuario solicitante</p>
                    <p className="font-semibold text-slate-900">Nicolás</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Usuario que preparó</p>
                    <p className="font-semibold text-slate-900">
                      Personal de Depósito
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Usuario que confirmó</p>
                    <p className="font-semibold text-slate-900">
                      Supervisor de Depósito
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de materiales */}
          <Card>
            <CardHeader>
              <CardTitle className="text-slate-900">Materiales remitidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-center">Cant. solicitada</TableHead>
                      <TableHead className="text-center">Cant. entregada</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead>Observaciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materials.map((material) => {
                      const isComplete =
                        material.quantityDelivered === material.quantityRequested;
                      return (
                        <TableRow key={material.id}>
                          <TableCell className="font-mono text-sm">
                            {material.code}
                          </TableCell>
                          <TableCell className="font-medium">
                            {material.name}
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            {material.quantityRequested}
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={
                                isComplete
                                  ? "font-semibold text-green-700"
                                  : "font-semibold text-amber-700"
                              }
                            >
                              {material.quantityDelivered}
                            </span>
                          </TableCell>
                          <TableCell>{material.unit}</TableCell>
                          <TableCell>
                            {material.observations || (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Botones de acción */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => navigate("/deposito")}>
              Volver a pedidos
            </Button>
            <Button variant="outline" onClick={handleSendConfirmation}>
              <Send className="w-4 h-4 mr-2" />
              Enviar constancia
            </Button>
            <Button onClick={handleDownloadPDF}>
              <Download className="w-4 h-4 mr-2" />
              Descargar PDF
            </Button>
          </div>
        </div>

        {/* Panel lateral */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-slate-900">Estado del pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <Truck className="w-8 h-8 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">
                    Pedido cargado en camión
                  </p>
                  <p className="text-sm text-green-700">Listo para entrega</p>
                </div>
              </div>

              {isPartial && (
                <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <CheckCircle2 className="w-6 h-6 text-amber-600" />
                  <div>
                    <p className="font-semibold text-amber-900">Entrega parcial</p>
                    <p className="text-sm text-amber-700">
                      Algunos ítems no fueron entregados completos
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-slate-900">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Total de ítems</span>
                <span className="font-semibold text-slate-900">
                  {materials.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Unidades solicitadas</span>
                <span className="font-semibold text-slate-900">
                  {totalRequested}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Unidades entregadas</span>
                <Badge
                  className={
                    isPartial
                      ? "bg-amber-100 text-amber-700"
                      : "bg-green-100 text-green-700"
                  }
                  variant="outline"
                >
                  {totalDelivered}
                </Badge>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Eficiencia</span>
                  <span className="font-bold text-slate-900">
                    {Math.round((totalDelivered / totalRequested) * 100)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <p className="text-sm text-blue-900">
                <strong>Próximos pasos:</strong> El remito ha sido generado y
                registrado en el sistema. Puede descargarlo en PDF o enviarlo por
                correo electrónico.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
