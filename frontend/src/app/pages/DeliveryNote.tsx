import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
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
  RefreshCw,
  Building,
  Layers,
  FileText,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import {
  getRemitoDetalle,
  getPedidoDetalle,
  type RemitoDetalleOut,
  type PedidoOut,
} from "../services/api";
import { formatFechaHoraAR, formatSoloFechaAR } from "../components/ui/format";

function formatDDMMAAAA(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatHora(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function DeliveryNote() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [remito, setRemito] = useState<RemitoDetalleOut | null>(null);
  const [order, setOrder] = useState<PedidoOut | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchRemitoAndOrder = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const remitoData = await getRemitoDetalle(id);
      setRemito(remitoData);
      try {
        const orderData = await getPedidoDetalle(remitoData.id_pedido);
        setOrder(orderData);
      } catch {
        // Order data optional fallback
      }
    } catch {
      toast.error(`Error al recuperar datos del remito ${id}`);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRemitoAndOrder();
  }, [fetchRemitoAndOrder]);

  const handleDownloadPDF = () => {
    window.print();
  };

  const handleSendConfirmation = () => {
    toast.success("Constancia de remito enviada correctamente");
  };

  if (loading) {
    return (
      <div className="p-8 text-center py-24 text-slate-500 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" />
        <p className="text-sm font-medium">Cargando remito interno...</p>
      </div>
    );
  }

  if (!remito) {
    return (
      <div className="p-8 text-center py-24 space-y-4">
        <FileText className="w-12 h-12 mx-auto text-slate-300" />
        <h2 className="text-lg font-bold text-slate-800">Remito {id} no encontrado</h2>
        <Button onClick={() => navigate("/deposito")} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a pedidos de depósito
        </Button>
      </div>
    );
  }

  const isPartial = order ? order.estado === "parcial" : remito.estado === "parcial";

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          body, html {
            background: #ffffff !important;
            color: #000000 !important;
            height: auto !important;
            overflow: visible !important;
          }
        }
      `}</style>

      {/* WEB VIEW INTERACTIVA */}
      <div className="print:hidden p-4 sm:p-8 space-y-6">
        <div>
          <div className="flex gap-2 mb-3 -ml-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/deposito")}
              className="text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Volver a pedidos
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/deposito/preparacion/${remito.id_pedido}`)}
              className="text-blue-700 hover:text-blue-900 font-medium"
            >
              Ir a Preparación del Pedido #{remito.id_pedido}
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
                Remito Interno de Entrega
              </h1>
              <p className="text-slate-600 text-xs sm:text-sm mt-1">
                Comprobante oficial de materiales despachados desde CL2 para abastecimiento de Planta
              </p>
            </div>
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 px-3.5 py-1.5 text-xs font-bold self-start gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {isPartial ? "Entrega Parcial" : "Completado y Despachado"}
            </Badge>
          </div>
        </div>

        {order?.remitos && order.remitos.length > 1 && (
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="py-3 px-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700">Entregas emitidas para este pedido ({order.remitos.length}):</span>
              {order.remitos.map((r, idx) => {
                const isSelected = r.id_remito === remito.id_remito;
                return (
                  <Button
                    key={r.id_remito}
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    className={`h-7 text-xs font-mono font-semibold ${
                      isSelected ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
                    }`}
                    onClick={() => navigate(`/remitos/${r.id_remito}`)}
                  >
                    Envío #{idx + 1} ({r.id_remito})
                  </Button>
                );
              })}
            </CardContent>
          </Card>
        )}

        <Card className="bg-emerald-50/60 border-emerald-200 shadow-2xs">
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-emerald-950">
                  Despacho confirmado y registrado en la trazabilidad del sistema.
                </p>
                <p className="text-emerald-800 mt-0.5">
                  Se ha generado el remito interno <strong>{remito.id_remito}</strong>. El stock fue descontado en CL2 y los materiales se encuentran registrados en tránsito para recepción en Planta.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-xs border-slate-200">
              <CardHeader className="py-3 px-6 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Cabecera del Remito
                  </CardTitle>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Número de Remito</span>
                    <span className="text-base font-bold text-blue-700 font-mono">
                      {remito.id_remito}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium block">Fecha de Emisión</span>
                    <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatFechaHoraAR(remito.fecha_emision)}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium block">Sector Destino</span>
                    <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                      <Building className="w-3.5 h-3.5 text-slate-400" />
                      <span>{remito.sector_destino || order?.sector || "Planta"}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium block">Depósito Origen</span>
                    <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                      <Warehouse className="w-3.5 h-3.5 text-slate-400" />
                      <span>Control Stock CL2</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium block">Operario Emisor</span>
                    <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{remito.usuario_emisor || "Depósito"}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium block">Pedido de Origen</span>
                    <div className="font-mono font-bold text-blue-700">
                      #{remito.id_pedido}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium block">Fecha / Turno</span>
                    <div className="text-slate-700 font-medium">
                      {remito.fecha_requerida ? formatSoloFechaAR(remito.fecha_requerida) : (order?.fecha_requerida ? formatSoloFechaAR(order.fecha_requerida) : "Inmediato")}{" "}
                      {remito.turno ? `(${remito.turno})` : (order?.turno ? `(${order.turno})` : "")}
                    </div>
                  </div>
                </div>

                {remito.observacion && (
                  <div className="mt-4 pt-3 border-t border-slate-100 text-xs">
                    <span className="text-slate-400 font-medium block mb-0.5">Observaciones:</span>
                    <p className="text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
                      "{remito.observacion}"
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-xs border-slate-200">
              <CardHeader className="py-3 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Materiales en este Remito ({remito.items.length})
                </CardTitle>
                <div className="flex gap-2">
                  {remito.total_pallets > 0 && (
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-mono text-xs">
                      {remito.total_pallets} {remito.total_pallets === 1 ? "Pallet" : "Pallets"}
                    </Badge>
                  )}
                  <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 font-mono text-xs">
                    {remito.total_unidades} UN
                  </Badge>
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
                        <TableHead className="text-center">Cant. Despachada</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {remito.items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                            No hay materiales registrados en este remito.
                          </TableCell>
                        </TableRow>
                      ) : (
                        remito.items.map((it) => {
                          const isPallet = it.tipo_empaque === "pallet" && (it.tamanio_lote || 1) > 1;

                          return (
                            <TableRow key={it.id_material} className="hover:bg-slate-50/50">
                              <TableCell className="font-mono text-xs font-bold text-slate-900">
                                {it.id_material}
                              </TableCell>
                              <TableCell className="text-xs font-medium text-slate-800">
                                {it.nombre_material || it.id_material}
                              </TableCell>
                              <TableCell className="text-center">
                                {isPallet ? (
                                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] gap-1">
                                    <Layers className="w-3 h-3 text-indigo-500" />
                                    Pallet ({it.tamanio_lote} {it.unidad})
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px]">
                                    Suelto
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-center text-xs">
                                {isPallet && it.cantidad_pallets !== null && it.cantidad_pallets !== undefined ? (
                                  <div>
                                    <span className="font-mono font-bold text-indigo-950 block">
                                      {it.cantidad_pallets} {it.cantidad_pallets === 1 ? "Pallet" : "Pallets"}
                                    </span>
                                    <span className="text-[11px] text-slate-500 font-mono block">
                                      ({it.cantidad} {it.unidad})
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-mono font-bold text-slate-900">
                                    {it.cantidad} {it.unidad}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]" variant="outline">
                                  Despachado
                                </Badge>
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

            <div className="flex gap-3 justify-end flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/deposito/preparacion/${remito.id_pedido}`)}
                className="text-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Volver a preparación
              </Button>
              <Button variant="outline" size="sm" onClick={handleSendConfirmation} className="text-xs gap-1.5">
                <Send className="w-3.5 h-3.5" />
                Enviar constancia
              </Button>
              <Button size="sm" onClick={handleDownloadPDF} className="text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                <Printer className="w-3.5 h-3.5" />
                Imprimir / PDF
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="shadow-xs border-slate-200">
              <CardHeader className="py-3 px-6 border-b border-slate-100">
                <CardTitle className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Estado del Despacho
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-3 p-3.5 bg-emerald-50 rounded-lg border border-emerald-200">
                  <Truck className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold text-emerald-950">Materiales cargados en camión</p>
                    <p className="text-emerald-800 text-[11px]">Listos para entrega en línea o sector</p>
                  </div>
                </div>

                {isPartial ? (
                  <div className="flex items-center gap-3 p-3.5 bg-amber-50 rounded-lg border border-amber-200">
                    <CheckCircle2 className="w-6 h-6 text-amber-600 shrink-0" />
                    <div className="text-xs">
                      <p className="font-bold text-amber-950">Entrega Parcial del Pedido</p>
                      <p className="text-amber-800 text-[11px]">
                        Aún restan materiales pendientes de despacho en este pedido. Puede realizar envíos sucesivos desde la pantalla de preparación.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3.5 bg-emerald-50 rounded-lg border border-emerald-200">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div className="text-xs">
                      <p className="font-bold text-emerald-950">Pedido Completado</p>
                      <p className="text-emerald-800 text-[11px]">
                        La totalidad de los materiales solicitados han sido entregados con sus respectivos remitos.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* PLANTILLA DE IMPRESIÓN OFICIAL RÉPLICA INDUSTRIAL */}
      <div className="hidden print:block font-mono text-black text-xs bg-white p-4 leading-tight">
        {/* ENCABEZADO FISCAL / DOCUMENTAL */}
        <div className="border-b-2 border-black pb-3 mb-3">
          <div className="flex justify-end items-start">
            <div className="w-5/12 text-right space-y-0.5">
              <p className="font-extrabold text-base tracking-wider">REMITO</p>
              <p className="text-[9px] font-bold uppercase tracking-tight">DOCUMENTO NO VÁLIDO COMO FACTURA</p>
              <p className="font-bold text-xs mt-1">
                N° DE CPTE: <span className="font-extrabold text-sm">{remito.id_remito}</span>
              </p>
              <p className="text-[11px]">
                FECHA: <span className="font-bold">{formatDDMMAAAA(remito.fecha_emision)}</span> &nbsp;
                HORA: <span className="font-bold">{formatHora(remito.fecha_emision)}</span>
              </p>
            </div>
          </div>
        </div>

        {/* TABLA DE MATERIALES DESPACHADOS */}
        <div className="border-t-2 border-b-2 border-black py-1 mb-2">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1 px-1 font-bold w-[25%]">CODIGO</th>
                <th className="py-1 px-1 font-bold w-[45%]">DESCRIPCION</th>
                <th className="py-1 px-1 font-bold text-right w-[15%]">CANTIDAD</th>
                <th className="py-1 px-1 font-bold text-right w-[15%]">EMPAQUE</th>
              </tr>
            </thead>
            <tbody>
              {remito.items.map((it) => {
                const isPallet = it.tipo_empaque === "pallet" && (it.tamanio_lote || 1) > 1;
                const displayCant = isPallet && it.cantidad_pallets !== null && it.cantidad_pallets !== undefined
                  ? `${it.cantidad_pallets}.00`
                  : `${it.cantidad}.00`;
                const displayUnit = isPallet && it.cantidad_pallets !== null && it.cantidad_pallets !== undefined
                  ? (it.cantidad_pallets === 1 ? "PALLET" : "PALLETS")
                  : it.unidad.toUpperCase();

                return (
                  <tr key={it.id_material} className="align-top border-b border-gray-200">
                    <td colSpan={4} className="py-1 px-1">
                      <div className="flex justify-between items-baseline font-mono">
                        <span className="w-[25%] font-bold">{it.id_material}</span>
                        <span className="w-[45%] truncate font-medium">{it.nombre_material || it.id_material}</span>
                        <span className="w-[15%] text-right font-bold">{displayCant} {displayUnit}</span>
                        <span className="w-[15%] text-right text-gray-600">
                          {isPallet ? `(${it.cantidad} ${it.unidad})` : "SUELTO"}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* TOTALES */}
        <div className="flex justify-between items-center px-2 py-1.5 border-b border-black text-[11px] font-bold mb-4">
          <div>
            TOTAL LÍNEAS / ÍTEMS: {remito.items.length}
          </div>
          <div className="flex gap-6">
            {remito.total_pallets > 0 && (
              <span>TOTAL PALLETS: {remito.total_pallets}</span>
            )}
            <span>TOTAL UNIDADES: {remito.total_unidades} UN</span>
          </div>
        </div>
      </div>
    </>
  );
}
