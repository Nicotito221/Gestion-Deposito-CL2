import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
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
import {
  ArrowLeft,
  Calendar,
  User,
  AlertCircle,
  CheckCircle2,
  Package,
  Building,
  RefreshCw,
  Sun,
  Moon,
  Lock,
  Layers,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  getPedidoDetalle,
  updatePreparacionPedido,
  type PedidoOut,
  type PreparacionPedidoUpdate,
} from "../services/api";
import { formatSoloFechaAR, formatFechaHoraAR } from "../components/ui/format";
import { useAuth } from "../context/AuthContext";
import { DeliveryNoteModal } from "../components/DeliveryNoteModal";

interface MaterialItem {
  id: string;
  code: string;
  name: string;
  quantityRequested: number;
  quantityDelivered: number;
  quantityPending: number;
  quantityPrepared: number;
  unit: string;
  status: "pendiente" | "preparado" | "parcial";
  isPrepared: boolean;
  tipo_empaque: string;
  tamanio_lote: number;
  bultos_por_pallet?: number | null;
  unidad_por_bulto?: number | null;
  cantidad_pallets: number | null;
  cantidad_pallets_entregada: number | null;
  cantidad_pallets_pendiente: number | null;
  cantidad_pallets_preparada: number | null;
  cantidad_bultos?: number | null;
  cantidad_bultos_entregada?: number | null;
  cantidad_bultos_pendiente?: number | null;
  cantidad_bultos_preparada?: number | null;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "bg-amber-100 text-amber-800 border-amber-200" },
  en_preparacion: { label: "En preparación", color: "bg-blue-100 text-blue-800 border-blue-200" },
  parcial: { label: "Parcial", color: "bg-orange-100 text-orange-800 border-orange-200" },
  completo: { label: "Completo", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  cancelado: { label: "Cancelado", color: "bg-slate-100 text-slate-600 border-slate-200" },
};

export function OrderPreparation() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { canModifyPedidoDeposito } = useAuth();

  const [order, setOrder] = useState<PedidoOut | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [observations, setObservations] = useState<string>("");
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [isRemitoModalOpen, setIsRemitoModalOpen] = useState<boolean>(false);
  const [selectedRemitoId, setSelectedRemitoId] = useState<string | null>(null);

  const fetchOrderDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getPedidoDetalle(Number(id));
      setOrder(data);
      setObservations(data.comentario || "");
      setMaterials(
        data.items.map((it) => {
          const lotSize = it.tamanio_lote && it.tamanio_lote > 1 ? it.tamanio_lote : 1;
          const isPallet = it.tipo_empaque === "rollo" || it.tipo_empaque === "pallet" || (it.cantidad_pallets != null && it.cantidad_pallets > 0) || (lotSize > 1 && it.cantidad_pedida >= lotSize);
          const cantPed = it.cantidad_pedida;
          const cantEnt = it.cantidad_entregada || 0;
          const cantPend = it.cantidad_pendiente ?? Math.max(0, cantPed - cantEnt);
          const palReq = isPallet ? (it.cantidad_pallets ?? Math.ceil(cantPed / lotSize)) : null;
          const palEnt = isPallet ? (it.cantidad_pallets_entregada ?? Math.round(cantEnt / lotSize)) : null;
          const palPend = isPallet ? (it.cantidad_pallets_pendiente ?? Math.max(0, (palReq ?? 0) - (palEnt ?? 0))) : null;
          const bpp = it.bultos_por_pallet;
          const isDone = cantPend <= 0;

          return {
            id: it.id_material,
            code: it.id_material,
            name: it.nombre_material || it.id_material,
            quantityRequested: cantPed,
            quantityDelivered: cantEnt,
            quantityPending: cantPend,
            quantityPrepared: 0,
            unit: it.unidad || "UN",
            status: isDone ? "preparado" : (cantEnt > 0 ? "parcial" : "pendiente"),
            isPrepared: isDone,
            tipo_empaque: it.tipo_empaque || "unidad",
            tamanio_lote: lotSize,
            bultos_por_pallet: bpp,
            unidad_por_bulto: it.unidad_por_bulto,
            cantidad_pallets: palReq,
            cantidad_pallets_entregada: palEnt,
            cantidad_pallets_pendiente: palPend,
            cantidad_pallets_preparada: 0,
            cantidad_bultos: (palReq && bpp) ? palReq * bpp : it.cantidad_bultos,
            cantidad_bultos_entregada: (palEnt && bpp) ? palEnt * bpp : it.cantidad_bultos_entregada,
            cantidad_bultos_pendiente: (palPend && bpp) ? palPend * bpp : it.cantidad_bultos_pendiente,
            cantidad_bultos_preparada: 0,
          };
        })
      );
    } catch {
      toast.error(`Error al recuperar el pedido #${id}`);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrderDetail();
  }, [fetchOrderDetail]);

  const handleCheckboxChange = (matId: string, checked: boolean) => {
    setMaterials((prev) =>
      prev.map((item) => {
        if (item.id === matId) {
          if (item.quantityPending <= 0) return item;
          const isPallet = (item.tipo_empaque === "pallet" || item.tipo_empaque === "rollo") || item.tamanio_lote > 1;
          const maxPal = item.cantidad_pallets_pendiente ?? 0;
          const palPrep = checked ? (isPallet ? maxPal : null) : (isPallet ? 0 : null);
          const bPrep = (item.tipo_empaque === "rollo" && item.bultos_por_pallet && palPrep !== null)
            ? palPrep * item.bultos_por_pallet
            : null;
          return {
            ...item,
            isPrepared: checked,
            quantityPrepared: checked ? item.quantityPending : 0,
            cantidad_pallets_preparada: palPrep,
            cantidad_bultos_preparada: bPrep,
          };
        }
        return item;
      })
    );
  };

  const handleQuantityChange = (matId: string, value: number) => {
    setMaterials((prev) =>
      prev.map((item) => {
        if (item.id === matId) {
          const maxAllowed = item.quantityPending;
          const newQuantity = Math.max(0, Math.min(value, maxAllowed));
          const isPallet = (item.tipo_empaque === "pallet" || item.tipo_empaque === "rollo") || item.tamanio_lote > 1;
          const palPrep = isPallet ? Math.round(newQuantity / item.tamanio_lote) : null;
          const bPrep = (item.tipo_empaque === "rollo" && item.bultos_por_pallet && palPrep !== null)
            ? palPrep * item.bultos_por_pallet
            : null;
          return {
            ...item,
            quantityPrepared: newQuantity,
            cantidad_pallets_preparada: palPrep,
            cantidad_bultos_preparada: bPrep,
            isPrepared: newQuantity === maxAllowed && maxAllowed > 0,
          };
        }
        return item;
      })
    );
  };

  const handlePalletsChange = (matId: string, palletsVal: number) => {
    setMaterials((prev) =>
      prev.map((item) => {
        if (item.id === matId) {
          const maxPallets = item.cantidad_pallets_pendiente ?? 0;
          const clampedPallets = Math.max(0, Math.min(palletsVal, maxPallets));
          const newUnits = Math.min(item.quantityPending, clampedPallets * item.tamanio_lote);
          const isDone = clampedPallets === maxPallets && maxPallets > 0;
          const bPrep = (item.tipo_empaque === "rollo" && item.bultos_por_pallet)
            ? clampedPallets * item.bultos_por_pallet
            : null;
          return {
            ...item,
            quantityPrepared: newUnits,
            cantidad_pallets_preparada: clampedPallets,
            cantidad_bultos_preparada: bPrep,
            isPrepared: isDone,
          };
        }
        return item;
      })
    );
  };

  const totalItems = materials.length;
  const itemsFullyDelivered = materials.filter((m) => m.quantityPending <= 0).length;
  const itemsPreparingNow = materials.filter((m) => m.quantityPrepared > 0).length;
  const totalDeliveredUnits = materials.reduce((acc, m) => acc + m.quantityDelivered, 0);
  const totalRequestedUnits = materials.reduce((acc, m) => acc + m.quantityRequested, 0);
  const progressPercentage = totalRequestedUnits > 0
    ? Math.round((totalDeliveredUnits / totalRequestedUnits) * 100)
    : 0;

  const handleSaveProgress = async () => {
    if (!order) return;
    setIsSubmitting(true);
    try {
      const payload: PreparacionPedidoUpdate = {
        accion: "guardar_avance",
        comentario: observations,
        items: materials.map((m) => ({
          id_material: m.id,
          cantidad_preparada: m.quantityPrepared,
          estado: m.status,
        })),
      };
      const res = await updatePreparacionPedido(order.id_pedido, payload);
      setOrder(res.pedido);
      toast.success(res.mensaje || "Avance de preparación guardado exitosamente");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar avance");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmPartial = async () => {
    if (!order) return;
    const hasAnyPrepared = materials.some((m) => m.quantityPrepared > 0);
    if (!hasAnyPrepared) {
      toast.error("Debe indicar al menos una cantidad mayor a 0 a despachar en esta entrega.");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: PreparacionPedidoUpdate = {
        accion: "confirmar_parcial",
        comentario: observations,
        items: materials.map((m) => ({
          id_material: m.id,
          cantidad_preparada: m.quantityPrepared,
          estado: m.quantityPrepared >= m.quantityPending ? "completo" : (m.quantityPrepared > 0 ? "parcial" : "pendiente"),
        })),
      };
      const res = await updatePreparacionPedido(order.id_pedido, payload);
      toast.success(res.mensaje || "Entrega parcial confirmada correctamente");
      if (res.id_remito) {
        setSelectedRemitoId(res.id_remito);
        setIsRemitoModalOpen(true);
      }
      await fetchOrderDetail();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al confirmar pedido parcial");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmComplete = async () => {
    if (!order) return;
    const payloadItems = materials.map((m) => {
      const qtyToSend = m.quantityPrepared > 0 ? m.quantityPrepared : m.quantityPending;
      return {
        id_material: m.id,
        cantidad_preparada: qtyToSend,
        estado: "completo",
      };
    });

    const totalToDispatch = payloadItems.reduce((acc, it) => acc + it.cantidad_preparada, 0);
    if (totalToDispatch <= 0 && materials.some((m) => m.quantityPending > 0)) {
      toast.error("No hay materiales pendientes a despachar.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: PreparacionPedidoUpdate = {
        accion: "confirmar_completo",
        comentario: observations,
        items: payloadItems,
      };
      const res = await updatePreparacionPedido(order.id_pedido, payload);
      toast.success(res.mensaje || "Pedido completo confirmado exitosamente");
      if (res.id_remito) {
        setSelectedRemitoId(res.id_remito);
        setIsRemitoModalOpen(true);
      }
      await fetchOrderDetail();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al confirmar pedido completo");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: MaterialItem["status"]) => {
    switch (status) {
      case "preparado":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completo
          </Badge>
        );
      case "parcial":
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200" variant="outline">
            <AlertCircle className="w-3 h-3 mr-1" />
            Parcial
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-100 text-slate-700 border-slate-200" variant="outline">
            Pendiente
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center py-24 text-slate-500 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" />
        <p className="text-sm font-medium">Cargando preparación del pedido #{id}...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center py-24 space-y-4">
        <Package className="w-12 h-12 mx-auto text-slate-300" />
        <h2 className="text-lg font-bold text-slate-800">Pedido #{id} no encontrado</h2>
        <Button onClick={() => navigate("/deposito")} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al listado de depósito
        </Button>
      </div>
    );
  }

  const orderCfg = statusConfig[order.estado] || {
    label: order.estado,
    color: "bg-slate-100 text-slate-700 border-slate-200",
  };
  const isOrderFinalized = order.estado === "completo" || order.estado === "cancelado";

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/deposito")}
          className="mb-3 text-slate-600 hover:text-slate-900 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Volver a pedidos de depósito
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
                Preparación del Pedido #{order.id_pedido}
              </h1>
              <Badge className={`${orderCfg.color} text-xs font-semibold`} variant="outline">
                {orderCfg.label}
              </Badge>
              {order.prioridad === "urgente" && (
                <Badge variant="destructive" className="text-xs">Urgente</Badge>
              )}
              {order.remitos && order.remitos.length > 0 && (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-xs gap-1">
                  <FileText className="w-3 h-3 text-emerald-600" />
                  {order.remitos.length} {order.remitos.length === 1 ? "Remito Emitido" : "Remitos Emitidos"}
                </Badge>
              )}
            </div>
            <p className="text-slate-600 text-xs sm:text-sm mt-1">
              Verifique y arme los materiales solicitados por el sector solicitante
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOrderDetail}
            disabled={loading || isSubmitting}
            className="gap-2 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Recargar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-xs border-slate-200">
            <CardHeader className="py-3 px-6 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Información del Pedido
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium block">Sector Solicitante</span>
                  <Badge variant="outline" className="font-semibold bg-slate-50 text-slate-800 gap-1 text-xs">
                    <Building className="w-3 h-3 text-slate-500" />
                    {order.sector}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium block">Usuario Solicitante</span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{order.usuario_solicitante || "Sistema"}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium block">Fecha Solicitud</span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono">{formatFechaHoraAR(order.fecha_creacion)}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium block">Fecha / Turno Requerido</span>
                  <div className="text-xs">
                    {order.fecha_requerida ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-slate-800">
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
                      <span className="text-slate-400 italic">Inmediato</span>
                    )}
                  </div>
                </div>
              </div>

              {order.comentario && (
                <div className="mt-4 pt-3 border-t border-slate-100 text-xs">
                  <span className="text-slate-400 font-medium block mb-0.5">Comentario del Solicitante:</span>
                  <p className="text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
                    "{order.comentario}"
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sección de Remitos Emitidos */}
          <Card className="shadow-xs border-slate-200">
            <CardHeader className="py-3 px-6 border-b border-slate-100 flex flex-row items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <CardTitle className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Remitos de Entrega Emitidos ({order.remitos?.length || 0})
                </CardTitle>
              </div>
              {order.remitos && order.remitos.length > 0 && (
                <span className="text-[11px] text-slate-500 font-medium">
                  {order.remitos.length === 1 ? "1 entrega realizada" : `${order.remitos.length} entregas realizadas`}
                </span>
              )}
            </CardHeader>
            <CardContent className="p-4">
              {!order.remitos || order.remitos.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-medium text-slate-600">Aún no se han emitido remitos para este pedido.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Al confirmar una entrega parcial o completa, el sistema generará automáticamente el remito numerado.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {order.remitos.map((remito, idx) => (
                    <div
                      key={remito.id_remito}
                      className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-blue-700">
                              {remito.id_remito}
                            </span>
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] py-0 font-semibold">
                              Envío #{idx + 1}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {formatFechaHoraAR(remito.fecha_emision)}
                            {remito.usuario_emisor && (
                              <span className="text-slate-600 font-medium"> • Por: {remito.usuario_emisor}</span>
                            )}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-8 gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
                          onClick={() => {
                            setSelectedRemitoId(remito.id_remito);
                            setIsRemitoModalOpen(true);
                          }}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Ver Remito
                        </Button>
                      </div>

                      <div className="border-t border-slate-100 pt-2 text-xs">
                        <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                          Materiales despachados ({remito.items.length}):
                        </span>
                        <ul className="space-y-1">
                          {remito.items.map((m) => (
                            <li key={m.id_material} className="flex justify-between items-center text-slate-700">
                              <span className="font-mono text-[11px] font-medium text-slate-800">
                                {m.id_material} <span className="text-slate-500 font-sans font-normal">({m.nombre_material || m.id_material})</span>
                              </span>
                              <span className="font-mono font-bold text-xs text-slate-900">
                                {m.cantidad_pallets !== null && m.cantidad_pallets !== undefined ? (
                                  <>
                                    {m.cantidad_pallets} {m.cantidad_pallets === 1 ? "Pallet" : "Pallets"}
                                    {m.tipo_empaque === "rollo" && m.bultos_por_pallet ? (
                                      <span className="text-amber-800 font-sans font-semibold ml-1">
                                        ({m.cantidad_pallets * m.bultos_por_pallet} Rollos)
                                      </span>
                                    ) : (
                                      <span className="text-slate-500 font-normal font-sans ml-1">
                                        ({m.cantidad} {m.unidad})
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <>{m.cantidad} {m.unidad}</>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-xs border-slate-200">
            <CardHeader className="py-3 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Materiales a Preparar ({materials.length})
                </CardTitle>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Ingrese las cantidades a despachar en esta entrega. El sistema bloquea exceder el remanente pendiente.
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead>Código SAP</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-center">Tipo Empaque</TableHead>
                      <TableHead className="text-center">Cant. Solicitada</TableHead>
                      <TableHead className="text-center">Ya Entregado</TableHead>
                      <TableHead className="text-center">Pendiente</TableHead>
                      <TableHead className="text-center">A Despachar (Esta Entrega)</TableHead>
                      <TableHead className="text-center">Listo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materials.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                          Este pedido no posee materiales asociados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      materials.map((material) => {
                        const isPackaging = material.tipo_empaque === "rollo" || material.tipo_empaque === "pallet" || (material.cantidad_pallets != null && material.cantidad_pallets > 0) || (material.tamanio_lote > 1 && material.quantityRequested >= material.tamanio_lote);
                        const isFullyDone = material.quantityPending <= 0;

                        return (
                          <TableRow key={material.id} className="hover:bg-slate-50/50">
                            <TableCell className="font-mono text-xs font-bold text-slate-900">
                              {material.code}
                            </TableCell>
                            <TableCell className="text-xs font-medium text-slate-800">
                              {material.name}
                            </TableCell>
                            <TableCell className="text-center">
                              {material.tipo_empaque === "rollo" ? (
                                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 font-semibold text-[10px] gap-1">
                                  <Layers className="w-3 h-3 text-amber-600" />
                                  {material.bultos_por_pallet ? `${material.bultos_por_pallet} Rollos / Pallet` : `Rollo (${material.tamanio_lote} ${material.unit})`}
                                </Badge>
                              ) : isPackaging ? (
                                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold text-[10px] gap-1">
                                  <Layers className="w-3 h-3 text-indigo-500" />
                                  Pallet ({material.tamanio_lote} {material.unit})
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px]">
                                  Suelto / Unidad
                                </Badge>
                              )}
                            </TableCell>

                            <TableCell className="text-center">
                              {isPackaging ? (
                                <div>
                                  <span className="font-mono font-bold text-xs text-indigo-950 block">
                                    {material.cantidad_pallets} {material.cantidad_pallets === 1 ? "Pallet" : "Pallets"}
                                  </span>
                                  {material.tipo_empaque === "rollo" && material.bultos_por_pallet ? (
                                    <span className="text-[11px] text-amber-800 font-semibold font-mono block">
                                      ({(material.cantidad_pallets ?? 0) * material.bultos_por_pallet} Rollos)
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-slate-500 font-mono block">
                                      ({material.quantityRequested} {material.unit})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="font-mono font-bold text-xs text-slate-900">
                                  {material.quantityRequested} {material.unit}
                                </span>
                              )}
                            </TableCell>

                            <TableCell className="text-center">
                              {isPackaging ? (
                                <div>
                                  <span className="font-mono font-semibold text-xs text-slate-700 block">
                                    {material.cantidad_pallets_entregada ?? 0} {material.cantidad_pallets_entregada === 1 ? "Pallet" : "Pallets"}
                                  </span>
                                  {material.tipo_empaque === "rollo" && material.bultos_por_pallet ? (
                                    <span className="text-[11px] text-amber-700 font-mono block">
                                      ({(material.cantidad_pallets_entregada ?? 0) * material.bultos_por_pallet} Rollos)
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-slate-400 font-mono block">
                                      ({material.quantityDelivered} {material.unit})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="font-mono text-xs text-slate-600">
                                  {material.quantityDelivered} {material.unit}
                                </span>
                              )}
                            </TableCell>

                            <TableCell className="text-center">
                              {isFullyDone ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                                  0 {material.unit} (Completado)
                                </Badge>
                              ) : isPackaging ? (
                                <div>
                                  <span className="font-mono font-bold text-xs text-amber-700 block">
                                    {material.cantidad_pallets_pendiente} {material.cantidad_pallets_pendiente === 1 ? "Pallet" : "Pallets"}
                                  </span>
                                  {material.tipo_empaque === "rollo" && material.bultos_por_pallet ? (
                                    <span className="text-[11px] text-amber-800 font-semibold font-mono block">
                                      ({(material.cantidad_pallets_pendiente ?? 0) * material.bultos_por_pallet} Rollos)
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-amber-600 font-mono block">
                                      ({material.quantityPending} {material.unit})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="font-mono font-bold text-xs text-amber-700">
                                  {material.quantityPending} {material.unit}
                                </span>
                              )}
                            </TableCell>

                            <TableCell>
                              {isFullyDone ? (
                                <div className="text-center">
                                  <span className="text-[11px] font-semibold text-emerald-700 flex items-center justify-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    Entregado 100%
                                  </span>
                                </div>
                              ) : isPackaging ? (
                                <div className="flex flex-col items-center gap-1">
                                  <div className="flex items-center gap-1.5 justify-center">
                                    <Input
                                      type="number"
                                      min="0"
                                      max={material.cantidad_pallets_pendiente ?? 0}
                                      value={material.cantidad_pallets_preparada ?? 0}
                                      disabled={!canModifyPedidoDeposito || isSubmitting || isOrderFinalized}
                                      onChange={(e) =>
                                        handlePalletsChange(material.id, parseInt(e.target.value, 10) || 0)
                                      }
                                      className="w-16 h-8 text-center text-xs font-mono font-bold"
                                    />
                                    <span className="text-xs font-medium text-slate-700">Pallets</span>
                                  </div>
                                  {material.tipo_empaque === "rollo" && material.bultos_por_pallet ? (
                                    <span className="text-[11px] text-amber-800 font-semibold font-mono">
                                      ({(material.cantidad_pallets_preparada ?? 0) * material.bultos_por_pallet} Rollos / {material.quantityPrepared} {material.unit}) [Máx: {material.cantidad_pallets_pendiente} pal]
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-slate-500 font-mono">
                                      ({material.quantityPrepared} {material.unit}) [Máx: {material.cantidad_pallets_pendiente} pal]
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-1">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <Input
                                      type="number"
                                      min="0"
                                      max={material.quantityPending}
                                      value={material.quantityPrepared}
                                      disabled={!canModifyPedidoDeposito || isSubmitting || isOrderFinalized}
                                      onChange={(e) =>
                                        handleQuantityChange(
                                          material.id,
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      className="w-20 mx-auto h-8 text-center text-xs font-mono font-semibold"
                                    />
                                    <span className="text-xs text-slate-500 font-mono">{material.unit}</span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    (Máx: {material.quantityPending} {material.unit})
                                  </span>
                                </div>
                              )}
                            </TableCell>

                            <TableCell className="text-center">
                              <Checkbox
                                checked={isFullyDone || material.isPrepared}
                                disabled={!canModifyPedidoDeposito || isSubmitting || isOrderFinalized || isFullyDone}
                                onCheckedChange={(checked) =>
                                  handleCheckboxChange(material.id, checked as boolean)
                                }
                              />
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

          <Card className="shadow-xs border-slate-200">
            <CardHeader className="py-3 px-6 border-b border-slate-100">
              <CardTitle className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Observaciones del Depósito
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Textarea
                placeholder="Observaciones de preparación, lotes o aclaraciones de carga..."
                value={observations}
                disabled={!canModifyPedidoDeposito || isSubmitting || isOrderFinalized}
                onChange={(e) => setObservations(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end items-center flex-wrap">
            {canModifyPedidoDeposito ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleSaveProgress}
                  disabled={isSubmitting || isOrderFinalized}
                  className="text-xs gap-1.5"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Guardar avance
                </Button>
                <Button
                  variant="outline"
                  onClick={handleConfirmPartial}
                  disabled={isSubmitting || isOrderFinalized || itemsPreparingNow === 0}
                  className="text-xs gap-1.5 border-orange-300 text-orange-800 hover:bg-orange-50"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Confirmar entrega parcial
                </Button>
                <Button
                  onClick={handleConfirmComplete}
                  disabled={isSubmitting || isOrderFinalized}
                  className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Confirmar entrega completa
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

        <div className="space-y-6">
          <Card className="shadow-xs border-slate-200">
            <CardHeader className="py-3 px-6 border-b border-slate-100">
              <CardTitle className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Progreso del Pedido
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-600">Avance Total Entregado</span>
                  <span className="font-bold text-slate-900 font-mono text-sm">
                    {progressPercentage}%
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Total de ítems:</span>
                  <span className="font-bold font-mono text-slate-900">{totalItems}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Ítems completados (100%):</span>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-mono text-xs">
                    {itemsFullyDelivered} / {totalItems}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Unidades entregadas:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {totalDeliveredUnits} / {totalRequestedUnits}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">A despachar en esta sesión:</span>
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-mono text-xs">
                    {itemsPreparingNow} ítems
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-50/70 border-amber-200 shadow-2xs">
            <CardContent className="pt-4 pb-4">
              <div className="flex gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-amber-900 mb-1">
                    Control de Preparación y Múltiples Remitos
                  </p>
                  <p className="text-amber-800 leading-relaxed">
                    Cada confirmación (parcial o completa) genera un nuevo remito oficial numerado (RI-0000XX-01, 02...). El stock se descuenta en CL2 por cada despacho puntual y se ajusta el remanente disponible para futuras preparaciones.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <DeliveryNoteModal
        isOpen={isRemitoModalOpen}
        onClose={() => setIsRemitoModalOpen(false)}
        idRemito={selectedRemitoId}
      />
    </div>
  );
}
