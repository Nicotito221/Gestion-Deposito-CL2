import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { formatSoloFechaAR, formatFechaHoraAR } from "../components/ui/format";
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
  FileText,
  Eye,
  RefreshCw,
  Building,
  Layers,
  Sun,
  Moon,
  Lock,
  PackageCheck,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { getPedidoDetalle, cancelarPedido, type PedidoOut } from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { DeliveryNoteModal } from "../components/DeliveryNoteModal";

const statusConfig: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "bg-amber-100 text-amber-800 border-amber-200" },
  en_preparacion: { label: "En preparación", color: "bg-blue-100 text-blue-800 border-blue-200" },
  en_transito: { label: "En tránsito", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  parcial: { label: "Parcial", color: "bg-orange-100 text-orange-800 border-orange-200" },
  completo: { label: "Completo", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  cancelado: { label: "Cancelado", color: "bg-slate-100 text-slate-600 border-slate-200" },
};

export function OrderDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();

  const [order, setOrder] = useState<PedidoOut | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [isRemitoModalOpen, setIsRemitoModalOpen] = useState<boolean>(false);
  const [selectedRemitoId, setSelectedRemitoId] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getPedidoDetalle(Number(id));
      setOrder(data);
    } catch {
      toast.error(`Error al recuperar datos del pedido #${id}`);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleCancelOrder = async () => {
    if (!order || !cancelReason.trim()) return;
    setIsCancelling(true);
    try {
      const updated = await cancelarPedido(order.id_pedido, cancelReason.trim());
      setOrder(updated);
      setIsCancelModalOpen(false);
      setCancelReason("");
      toast.success(`Pedido #${order.id_pedido} cancelado correctamente`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cancelar el pedido");
    } finally {
      setIsCancelling(false);
    }
  };

  const statusCfg = useMemo(() => {
    if (!order) return { label: "Cargando", color: "bg-slate-100" };
    if (order.es_demorado && (order.estado === "pendiente" || order.estado === "en_preparacion")) {
      return { label: "Pendiente (Tarde)", color: "bg-rose-100 text-rose-800 border-rose-300 font-bold" };
    }
    if (order.es_demorado && order.estado === "parcial") {
      return { label: "Parcial (Tarde)", color: "bg-rose-100 text-rose-800 border-rose-300 font-bold" };
    }
    return statusConfig[order.estado] || { label: order.estado, color: "bg-slate-100 text-slate-700" };
  }, [order]);

  const totalItems = order?.items.length ?? 0;
  const preparedItems = order?.items.filter(
    (m) => m.cantidad_preparada >= m.cantidad_pedida && m.cantidad_pedida > 0
  ).length ?? 0;

  const totalUnitsRequested = useMemo(
    () => order?.items.reduce((acc, it) => acc + it.cantidad_pedida, 0) ?? 0,
    [order]
  );
  const totalUnitsPrepared = useMemo(
    () => order?.items.reduce((acc, it) => acc + it.cantidad_preparada, 0) ?? 0,
    [order]
  );

  const progressPercentage =
    totalUnitsRequested > 0 ? Math.min(100, Math.round((totalUnitsPrepared / totalUnitsRequested) * 100)) : 0;

  const hasRemito = Boolean(order?.id_remito || order?.estado === "completo" || order?.estado === "parcial");
  const canPrepare = user?.rol === "administrador" || user?.rol === "deposito" || user?.rol === "operario_deposito";
  const canCancel = Boolean(order && order.estado !== "completo" && order.estado !== "cancelado");

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-600">Cargando pedido #{id}...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">Pedido #{id} no encontrado</h2>
        <p className="text-xs text-slate-500">El pedido solicitado no existe o fue eliminado.</p>
        <Button onClick={() => navigate("/pedidos")} variant="outline" size="sm">
          Volver al listado
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/pedidos")}
          className="mb-4 text-slate-600 hover:text-slate-900 gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a mis pedidos
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono">
                Pedido #{order.id_pedido}
              </h1>
              <Badge className={`${statusCfg.color} text-xs font-semibold`} variant="outline">
                {statusCfg.label}
              </Badge>
              {order.prioridad === "urgente" && (
                <Badge variant="destructive" className="text-xs font-bold">Urgente</Badge>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Registrado el {formatFechaHoraAR(order.fecha_creacion)} • Origen:{" "}
              <strong className="text-slate-700 capitalize">
                {order.origen === "conteo_planta" ? "Conteo de Planta" : order.origen}
              </strong>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canPrepare && order.estado !== "completo" && order.estado !== "cancelado" && (
              <Button
                size="sm"
                onClick={() => navigate(`/deposito/preparacion/${order.id_pedido}`)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1.5 text-xs shadow-xs"
              >
                <PackageCheck className="w-4 h-4" />
                <span>Gestionar Preparación</span>
              </Button>
            )}

            {canCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCancelModalOpen(true)}
                className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 font-bold gap-1.5 text-xs shadow-2xs"
              >
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Cancelar Pedido</span>
              </Button>
            )}

            {hasRemito && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedRemitoId(order.id_remito || String(order.id_pedido));
                  setIsRemitoModalOpen(true);
                }}
                className="text-indigo-700 border-indigo-200 hover:bg-indigo-50 font-bold gap-1.5 text-xs shadow-2xs"
              >
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>Ver Remito {order.id_remito || `RI-${order.id_pedido}`}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {order.es_demorado && order.estado !== "completo" && order.estado !== "cancelado" && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 text-rose-900 shadow-2xs">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-xs">
            <p className="font-bold text-rose-950">Pedido fuera de término (Tarde)</p>
            <p className="text-rose-700">
              Este pedido estaba programado para el {order.fecha_requerida ? formatSoloFechaAR(order.fecha_requerida) : "día anterior"} y no fue completado en la fecha requerida. Permanece en estado Pendiente para su despacho prioritario.
            </p>
          </div>
        </div>
      )}

      {order.estado === "cancelado" && (
        <div className="bg-slate-100 border border-slate-300 rounded-xl p-4 flex items-start gap-3 text-slate-800 shadow-2xs">
          <AlertCircle className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-xs">
            <p className="font-bold text-slate-900">Pedido Cancelado</p>
            <p className="text-slate-600">
              Este pedido fue anulado y no se realizarán entregas. Revise el historial de comentarios para ver el motivo y usuario responsable.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos generales */}
          <Card className="shadow-2xs">
            <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-sm font-bold text-slate-800">
                Parámetros y Sector
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50/60 border border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 font-medium">Sector Solicitante</p>
                    <p className="font-bold text-slate-900 text-sm">{order.sector}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50/60 border border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 font-medium">Solicitado Por</p>
                    <p className="font-bold text-slate-900 text-sm truncate">
                      {order.usuario_solicitante || "Sistema"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50/60 border border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 font-medium">Fecha Requerida</p>
                    <p className="font-bold text-slate-900 text-sm font-mono">
                      {order.fecha_requerida ? formatSoloFechaAR(order.fecha_requerida) : "Inmediato"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50/60 border border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0">
                    {order.turno === "Turno Tarde" ? (
                      <Moon className="w-4 h-4" />
                    ) : order.turno === "Turno Noche" ? (
                      <Lock className="w-4 h-4" />
                    ) : (
                      <Sun className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 font-medium">Turno Solicitado</p>
                    <p className="font-bold text-slate-900 text-sm">
                      {order.turno || "Jornada Completa"}
                    </p>
                  </div>
                </div>

                {order.id_conteo && (
                  <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50/60 border border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500 font-medium">Conteo Asociado</p>
                      <p className="font-bold text-slate-900 text-sm font-mono">
                        Conteo #{order.id_conteo}
                      </p>
                    </div>
                  </div>
                )}

                {hasRemito && (
                  <div
                    onClick={() => {
                      setSelectedRemitoId(order.id_remito || String(order.id_pedido));
                      setIsRemitoModalOpen(true);
                    }}
                    className="flex items-start gap-3 p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200 cursor-pointer hover:bg-emerald-100/70 transition-colors"
                    title="Haz clic para ver el remito en modal"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] text-emerald-700 font-medium">Remito Interno (clic para ver)</p>
                      <p className="font-bold text-emerald-950 text-sm font-mono">
                        {order.id_remito || `RI-${order.id_pedido}`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tabla de materiales con Pallets vs Unidades */}
          <Card className="shadow-2xs">
            <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between bg-slate-50/50">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                Materiales Solicitados
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {order.items.length} {order.items.length === 1 ? "ítem" : "ítems"}
              </Badge>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/75">
                  <TableRow>
                    <TableHead className="text-xs font-semibold text-slate-700">Código</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-700">Material</TableHead>
                    <TableHead className="text-center text-xs font-semibold text-slate-700">Presentación</TableHead>
                    <TableHead className="text-center text-xs font-semibold text-slate-700">Cant. Solicitada</TableHead>
                    <TableHead className="text-center text-xs font-semibold text-slate-700">Cant. Preparada</TableHead>
                    <TableHead className="text-center text-xs font-semibold text-slate-700">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((it) => {
                    const lotSize = it.tamanio_lote && it.tamanio_lote > 1 ? it.tamanio_lote : 1;
                    const isPallet = (it.cantidad_pallets != null && it.cantidad_pallets > 0) || (it.tipo_empaque === "pallet" && lotSize > 1 && it.cantidad_pedida >= lotSize);
                    const isReady = it.cantidad_preparada >= it.cantidad_pedida && it.cantidad_pedida > 0;
                    const isPartial = it.cantidad_preparada > 0 && it.cantidad_preparada < it.cantidad_pedida;

                    return (
                      <TableRow key={it.id_material} className="hover:bg-slate-50/50">
                        <TableCell className="font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">
                          {it.id_material}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-medium text-slate-900">{it.nombre_material || it.id_material}</div>
                          {it.comentario && (
                            <span className="text-[11px] text-slate-400 block">{it.comentario}</span>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          {isPallet ? (
                            <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold gap-1">
                              <Layers className="w-2.5 h-2.5 text-indigo-500" />
                              Pallet ({it.tamanio_lote} {it.unidad})
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 border-slate-200">
                              Unidad ({it.unidad})
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-center whitespace-nowrap">
                          {isPallet ? (
                            <div>
                              <span className="font-mono font-bold text-slate-900 text-xs block">
                                {it.cantidad_pallets ?? Math.ceil(it.cantidad_pedida / (it.tamanio_lote || 1))} Pallets
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono block">
                                ({it.cantidad_pedida.toLocaleString("es-AR")} {it.unidad})
                              </span>
                            </div>
                          ) : (
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {it.cantidad_pedida.toLocaleString("es-AR")} {it.unidad}
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="text-center whitespace-nowrap">
                          {isPallet ? (
                            <div>
                              <span
                                className={`font-mono font-bold text-xs block ${
                                  isReady ? "text-emerald-700" : isPartial ? "text-amber-700" : "text-slate-400"
                                }`}
                              >
                                {it.cantidad_pallets_preparada ?? Math.round(it.cantidad_preparada / (it.tamanio_lote || 1))} Pallets
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono block">
                                ({it.cantidad_preparada.toLocaleString("es-AR")} {it.unidad})
                              </span>
                            </div>
                          ) : (
                            <span
                              className={`font-mono font-bold text-xs ${
                                isReady ? "text-emerald-700" : isPartial ? "text-amber-700" : "text-slate-400"
                              }`}
                            >
                              {it.cantidad_preparada > 0 ? `${it.cantidad_preparada.toLocaleString("es-AR")} ${it.unidad}` : "—"}
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          {isReady ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]" variant="outline">
                              <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Preparado
                            </Badge>
                          ) : isPartial ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]" variant="outline">
                              <AlertCircle className="w-2.5 h-2.5 mr-1" /> Parcial
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]" variant="outline">
                              Pendiente
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Observaciones */}
          {order.comentario && (
            <Card className="shadow-2xs">
              <CardHeader className="py-2.5 px-5 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-xs font-bold text-slate-800">
                  Observaciones y Notas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <p className="text-xs text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-200 font-mono">
                  {order.comentario}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Panel lateral */}
        <div className="space-y-6">
          {/* Progreso */}
          <Card className="shadow-2xs">
            <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-sm font-bold text-slate-800">
                Avance de Preparación
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2 text-xs">
                  <span className="text-slate-600 font-medium">Completado</span>
                  <span className="font-bold text-slate-900 font-mono text-sm">{progressPercentage}%</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Total materiales:</span>
                  <span className="font-bold font-mono text-slate-900">{totalItems}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Líneas preparadas:</span>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[11px]" variant="outline">
                    {preparedItems} de {totalItems}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Unidades solicitadas:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {totalUnitsRequested.toLocaleString("es-AR")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Unidades preparadas:</span>
                  <span className="font-mono font-bold text-blue-700">
                    {totalUnitsPrepared.toLocaleString("es-AR")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tarjeta de Remito */}
          {hasRemito && (
            <Card className="bg-emerald-50/80 border-emerald-200 shadow-2xs">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-emerald-950 text-sm">
                      Remito interno emitido
                    </p>
                    <p className="text-emerald-800 mt-0.5">
                      Comprobante <strong>{order.id_remito || `RI-${order.id_pedido}`}</strong> generado automáticamente.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedRemitoId(order.id_remito || String(order.id_pedido));
                    setIsRemitoModalOpen(true);
                  }}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-1.5 shadow-2xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Ver Remito Interno</span>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="bg-slate-50 border-slate-200/80 shadow-2xs">
            <CardContent className="p-4 text-xs text-slate-500 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-700 font-semibold mb-1">
                <Eye className="w-4 h-4 text-slate-400" />
                <span>Modo seguimiento</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Este detalle refleja en vivo el estado del pedido, cantidades entregadas y movimientos de stock en depósito.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700 text-base font-bold">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              Cancelar Pedido #{order.id_pedido}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Esta acción anulará el pedido. Los ítems pendientes no serán preparados ni entregados por depósito.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="motivo" className="text-xs font-semibold text-slate-700">
                Motivo de la cancelación <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                id="motivo"
                placeholder="Indique la razón: ej. pedido duplicado, error en cantidades, cambio de turno..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="text-xs min-h-[90px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              disabled={isCancelling}
              onClick={() => {
                setIsCancelModalOpen(false);
                setCancelReason("");
              }}
              className="text-xs"
            >
              Volver
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isCancelling || !cancelReason.trim()}
              onClick={handleCancelOrder}
              className="text-xs font-bold gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isCancelling ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Cancelando...</span>
                </>
              ) : (
                <span>Confirmar Cancelación</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeliveryNoteModal
        isOpen={isRemitoModalOpen}
        onClose={() => setIsRemitoModalOpen(false)}
        idRemito={selectedRemitoId}
      />
    </div>
  );
}
