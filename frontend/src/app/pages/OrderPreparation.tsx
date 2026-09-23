import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { ArrowLeft, Calendar, User, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "../components/ui/format";
import { useAuth } from "../context/AuthContext";

interface MaterialItem {
  id: string;
  code: string;
  name: string;
  quantityRequested: number;
  quantityPrepared: number;
  unit: string;
  status: "pendiente" | "preparado" | "parcial";
  isPrepared: boolean;
}

export function OrderPreparation() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { canModifyPedidoDeposito } = useAuth();
  const [observations, setObservations] = useState("");
  const [materials, setMaterials] = useState<MaterialItem[]>([
    {
      id: "1",
      code: "Código 001",
      name: "Material 1",
      quantityRequested: 10,
      quantityPrepared: 10,
      unit: "UN",
      status: "preparado",
      isPrepared: true,
    },
    {
      id: "2",
      code: "Código 002",
      name: "Material 2",
      quantityRequested: 5,
      quantityPrepared: 5,
      unit: "KG",
      status: "preparado",
      isPrepared: true,
    },
    {
      id: "3",
      code: "Código 003",
      name: "Material 3",
      quantityRequested: 8,
      quantityPrepared: 5,
      unit: "MT",
      status: "parcial",
      isPrepared: false,
    },
  ]);

  const handleCheckboxChange = (id: string, checked: boolean) => {
    setMaterials((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              isPrepared: checked,
              status: checked ? "preparado" : "pendiente",
              quantityPrepared: checked ? item.quantityRequested : 0,
            }
          : item
      )
    );
  };

  const handleQuantityChange = (id: string, value: number) => {
    setMaterials((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQuantity = Math.min(value, item.quantityRequested);
          return {
            ...item,
            quantityPrepared: newQuantity,
            status:
              newQuantity === item.quantityRequested
                ? "preparado"
                : newQuantity > 0
                ? "parcial"
                : "pendiente",
            isPrepared: newQuantity === item.quantityRequested,
          };
        }
        return item;
      })
    );
  };

  const totalItems = materials.length;
  const preparedItems = materials.filter(
    (m) => m.quantityPrepared === m.quantityRequested
  ).length;
  const progressPercentage = Math.round((preparedItems / totalItems) * 100);

  const handleSaveProgress = () => {
    toast.success("Avance guardado correctamente");
  };

  const handleConfirmComplete = () => {
    const allPrepared = materials.every(
      (m) => m.quantityPrepared === m.quantityRequested
    );
    if (!allPrepared) {
      toast.error("No todos los materiales están completos");
      return;
    }
    toast.success("Pedido completo confirmado");
    setTimeout(() => {
      navigate(`/remitos/${id}`);
    }, 1500);
  };

  const handleConfirmPartial = () => {
    toast.success("Pedido parcial confirmado");
    setTimeout(() => {
      navigate(`/remitos/${id}`);
    }, 1500);
  };

  const getStatusBadge = (status: MaterialItem["status"]) => {
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
  };

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
        <h1 className="text-3xl font-semibold text-slate-900 mb-2">
          Preparación del pedido N.º {id}
        </h1>
        <p className="text-slate-600">
          Marque los materiales preparados y confirme el pedido
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contenido principal */}
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
                    <p className="font-semibold text-slate-900">Producción</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Fecha de solicitud</p>
                    <p className="font-semibold text-slate-900">{formatDate("10/06/2026")}</p>
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
                    <AlertCircle className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Estado actual</p>
                    <Badge className="bg-blue-100 text-blue-700" variant="outline">
                      En preparación
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de materiales */}
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
                      <TableHead className="text-center">Preparado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materials.map((material) => (
                      <TableRow key={material.id}>
                        <TableCell className="font-mono text-sm">
                          {material.code}
                        </TableCell>
                        <TableCell className="font-medium">{material.name}</TableCell>
                        <TableCell className="text-center font-semibold">
                          {material.quantityRequested}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max={material.quantityRequested}
                            value={material.quantityPrepared}
                            disabled={!canModifyPedidoDeposito}
                            onChange={(e) =>
                              handleQuantityChange(
                                material.id,
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-20 mx-auto"
                          />
                        </TableCell>
                        <TableCell>{material.unit}</TableCell>
                        <TableCell>{getStatusBadge(material.status)}</TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={material.isPrepared}
                            disabled={!canModifyPedidoDeposito}
                            onCheckedChange={(checked) =>
                              handleCheckboxChange(material.id, checked as boolean)
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Observaciones */}
          <Card>
            <CardHeader>
              <CardTitle className="text-slate-900">
                Observaciones del depósito
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Ingrese observaciones sobre la preparación del pedido (opcional)"
                value={observations}
                disabled={!canModifyPedidoDeposito}
                onChange={(e) => setObservations(e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Botones de acción */}
          <div className="flex gap-3 justify-end items-center">
            {canModifyPedidoDeposito ? (
              <>
                <Button variant="outline" onClick={handleSaveProgress}>
                  Guardar avance
                </Button>
                <Button variant="outline" onClick={handleConfirmPartial}>
                  Confirmar pedido parcial
                </Button>
                <Button onClick={handleConfirmComplete}>
                  Confirmar pedido completo
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Modo de visualización: No posee permisos para modificar pedidos en depósito.</span>
              </div>
            )}
          </div>
        </div>

        {/* Panel lateral */}
        <div className="space-y-6">
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

              <div className="pt-4 border-t border-slate-200">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Total de ítems</span>
                    <span className="font-semibold text-slate-900">
                      {totalItems}
                    </span>
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
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="pt-6">
              <div className="flex gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900 mb-1">
                    Nota importante
                  </p>
                  <p className="text-sm text-amber-800">
                    Al confirmar el pedido completo, se generará automáticamente el
                    remito interno. Verifique las cantidades antes de continuar.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
