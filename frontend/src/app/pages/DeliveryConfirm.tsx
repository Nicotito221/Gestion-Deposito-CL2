import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { formatNow } from "../components/ui/format";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
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
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  User,
  Calendar,
  Truck,
  PenLine,
} from "lucide-react";
import { toast } from "sonner";

interface ReceivedItem {
  id: string;
  code: string;
  name: string;
  delivered: number;
  received: number;
  unit: string;
  notes: string;
}

const deliveredItems: ReceivedItem[] = [
  { id: "1", code: "Código 001", name: "Material 1", delivered: 10, received: 10, unit: "UN", notes: "" },
  { id: "2", code: "Código 002", name: "Material 2", delivered: 5, received: 5, unit: "KG", notes: "" },
  { id: "3", code: "Código 003", name: "Material 3", delivered: 5, received: 5, unit: "MT", notes: "" },
];

export function DeliveryConfirm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const orderNumber = id || "000154";

  const [items, setItems] = useState<ReceivedItem[]>(deliveredItems);
  const [confirmed, setConfirmed] = useState(false);
  const [signature, setSignature] = useState("");
  const [observations, setObservations] = useState("");

  const now = formatNow();

  const handleQuantityChange = (id: string, value: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, received: Math.min(value, item.delivered) } : item
      )
    );
  };

  const handleNotesChange = (id: string, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, notes: value } : item))
    );
  };

  const totalDelivered = items.reduce((s, i) => s + i.delivered, 0);
  const totalReceived = items.reduce((s, i) => s + i.received, 0);
  const hasDifferences = items.some((i) => i.received !== i.delivered);
  const allComplete = items.every((i) => i.received === i.delivered);

  const handleConfirm = () => {
    if (!signature.trim()) {
      toast.error("Ingrese su nombre o firma para confirmar");
      return;
    }
    setConfirmed(true);
    toast.success("Recepción confirmada correctamente");
  };

  if (confirmed) {
    return (
      <div className="p-4 sm:p-8 max-w-2xl mx-auto">
        <Card className="bg-green-50 border-green-300">
          <CardContent className="pt-8 pb-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-green-900 mb-2">
              Entrega confirmada
            </h2>
            <p className="text-green-800 mb-1">Pedido N.º {orderNumber}</p>
            <p className="text-sm text-green-700">
              Receptor: {signature} · {now}
            </p>
            {hasDifferences && (
              <div className="mt-4 p-3 bg-amber-100 rounded-lg border border-amber-300">
                <p className="text-sm text-amber-900">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  Se registraron diferencias en la recepción. Notificado al depósito.
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-center mt-6">
              <Button variant="outline" onClick={() => navigate("/pedidos")}>
                Ver mis pedidos
              </Button>
              <Button onClick={() => navigate(`/remitos/${orderNumber}`)}>
                Ver remito
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <h1 className="text-3xl font-semibold text-slate-900 mb-2">
          Confirmación de entrega
        </h1>
        <p className="text-slate-600">
          Verifique los materiales recibidos y confirme la recepción
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Datos del remito */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-slate-900">Datos de la entrega</CardTitle>
                <div className="text-right">
                  <p className="text-sm text-slate-500">N.º de pedido</p>
                  <p className="font-bold font-mono text-slate-900">#{orderNumber}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Fecha y hora</p>
                    <p className="font-semibold text-slate-900">{now}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Usuario receptor</p>
                    <p className="font-semibold text-slate-900">Nicolás</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Entregado por</p>
                    <p className="font-semibold text-slate-900">Carlos (Depósito Central)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Sector receptor</p>
                    <p className="font-semibold text-slate-900">Producción</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de verificación */}
          <Card>
            <CardHeader>
              <CardTitle className="text-slate-900">
                Verificación de materiales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-center">Enviado</TableHead>
                      <TableHead className="text-center">Recibido</TableHead>
                      <TableHead>Observación</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const ok = item.received === item.delivered;
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-xs text-slate-400 font-mono">{item.code}</p>
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            {item.delivered} {item.unit}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center">
                              <Input
                                type="number"
                                min="0"
                                max={item.delivered}
                                value={item.received}
                                onChange={(e) =>
                                  handleQuantityChange(item.id, parseInt(e.target.value) || 0)
                                }
                                className="w-20 text-center"
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder="Opcional"
                              value={item.notes}
                              onChange={(e) => handleNotesChange(item.id, e.target.value)}
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            {ok ? (
                              <Badge className="bg-green-100 text-green-700" variant="outline">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Conforme
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-700" variant="outline">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Diferencia
                              </Badge>
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

          {/* Firma */}
          <Card>
            <CardHeader>
              <CardTitle className="text-slate-900 flex items-center gap-2">
                <PenLine className="w-5 h-5" />
                Confirmación de recepción
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signature">Nombre y apellido del receptor *</Label>
                <Input
                  id="signature"
                  placeholder="Ingrese su nombre completo para confirmar"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  className="text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="obs">Observaciones generales</Label>
                <Textarea
                  id="obs"
                  placeholder="Observaciones sobre la recepción (opcional)"
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Confirmar recepción
            </Button>
          </div>
        </div>

        {/* Panel lateral */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-slate-900">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Total ítems</span>
                <span className="font-semibold">{items.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Unidades enviadas</span>
                <span className="font-semibold">{totalDelivered}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Unidades a recibir</span>
                <span className="font-semibold">{totalReceived}</span>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Estado</span>
                  {allComplete ? (
                    <Badge className="bg-green-100 text-green-700" variant="outline">Completo</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-700" variant="outline">Con diferencias</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {hasDifferences && (
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="pt-6">
                <div className="flex gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900 mb-1">Diferencias detectadas</p>
                    <p className="text-sm text-amber-800">
                      Se registraron diferencias entre lo enviado y lo recibido. El depósito recibirá una notificación automática.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <p className="text-sm text-blue-900">
                <strong>Al confirmar:</strong> Se generará el remito de recepción y se actualizará el stock automáticamente.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
