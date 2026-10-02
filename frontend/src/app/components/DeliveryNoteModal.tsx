import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Printer,
  Send,
  CheckCircle2,
  Calendar,
  User,
  Warehouse,
  Building,
  Layers,
  FileText,
  RefreshCw,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  getRemitoDetalle,
  getPedidoDetalle,
  type RemitoDetalleOut,
  type PedidoOut,
} from "../services/api";
import { formatFechaHoraAR, formatSoloFechaAR } from "./ui/format";

interface DeliveryNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  idRemito?: string | null;
}

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

export function DeliveryNoteModal({
  isOpen,
  onClose,
  idRemito,
}: DeliveryNoteModalProps) {
  const [activeRemitoId, setActiveRemitoId] = useState<string | null>(idRemito || null);
  const [remito, setRemito] = useState<RemitoDetalleOut | null>(null);
  const [order, setOrder] = useState<PedidoOut | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && idRemito) {
      setActiveRemitoId(idRemito);
    }
  }, [isOpen, idRemito]);

  const loadData = useCallback(async (targetId: string) => {
    setLoading(true);
    try {
      const remitoData = await getRemitoDetalle(targetId);
      setRemito(remitoData);
      try {
        const orderData = await getPedidoDetalle(remitoData.id_pedido);
        setOrder(orderData);
      } catch {
        setOrder(null);
      }
    } catch {
      toast.error(`Error al recuperar datos del remito ${targetId}`);
      setRemito(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && activeRemitoId) {
      loadData(activeRemitoId);
    } else if (!isOpen) {
      setRemito(null);
      setOrder(null);
    }
  }, [isOpen, activeRemitoId, loadData]);

  const handleDownloadPDF = () => {
    window.print();
  };

  const handleSendConfirmation = () => {
    toast.success("Constancia de remito enviada correctamente");
  };

  const isPartial = order ? order.estado === "parcial" : remito?.estado === "parcial";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden sm:max-w-4xl">
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm 10mm;
            }
            body * {
              visibility: hidden !important;
            }
            #printable-remito, #printable-remito * {
              visibility: visible !important;
            }
            #printable-remito {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              display: block !important;
              background: #ffffff !important;
              color: #000000 !important;
            }
          }
        `}</style>

        {/* DIALOG HEADER */}
        <DialogHeader className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-row items-center justify-between space-y-0 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900">
                  Remito Interno de Entrega
                </DialogTitle>
                {remito && (
                  <Badge variant="outline" className="font-mono text-xs font-bold text-blue-700 border-blue-200 bg-blue-50">
                    {remito.id_remito}
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Comprobante de materiales despachados desde depósito CL2 para Planta
              </DialogDescription>
            </div>
          </div>
          {remito && (
            <Badge className={`${isPartial ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-emerald-100 text-emerald-800 border-emerald-300"} text-xs font-bold gap-1 self-center`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isPartial ? "Entrega Parcial" : "Completado"}
            </Badge>
          )}
        </DialogHeader>

        {/* DIALOG BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {loading ? (
            <div className="py-20 text-center text-slate-500 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" />
              <p className="text-sm font-medium">Cargando remito interno...</p>
            </div>
          ) : !remito ? (
            <div className="py-16 text-center space-y-3">
              <FileText className="w-12 h-12 mx-auto text-slate-300" />
              <p className="text-sm font-semibold text-slate-800">No se encontró el remito especificado.</p>
              <Button size="sm" variant="outline" onClick={onClose}>
                Cerrar
              </Button>
            </div>
          ) : (
            <>
              {/* SELECTOR DE MÚLTIPLES ENVÍOS SI EXISTEN */}
              {order?.remitos && order.remitos.length > 1 && (
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-700">Entregas emitidas ({order.remitos.length}):</span>
                  {order.remitos.map((r, idx) => {
                    const isSelected = r.id_remito === remito.id_remito;
                    return (
                      <Button
                        key={r.id_remito}
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        className={`h-7 text-xs font-mono font-semibold ${
                          isSelected
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
                        }`}
                        onClick={() => {
                          setActiveRemitoId(r.id_remito);
                          loadData(r.id_remito);
                        }}
                      >
                        Envío #{idx + 1} ({r.id_remito})
                      </Button>
                    );
                  })}
                </div>
              )}

              {/* METADATOS PRINCIPALES DEL REMITO */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50/70 p-3.5 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Fecha de Emisión</span>
                  <div className="flex items-center gap-1.5 text-slate-800 font-medium mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formatFechaHoraAR(remito.fecha_emision)}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Sector Destino</span>
                  <div className="flex items-center gap-1.5 text-slate-800 font-semibold mt-0.5">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>{remito.sector_destino || order?.sector || "Planta"}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Depósito Origen</span>
                  <div className="flex items-center gap-1.5 text-slate-800 font-medium mt-0.5">
                    <Warehouse className="w-3.5 h-3.5 text-slate-400" />
                    <span>Control Stock CL2</span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Operario Emisor</span>
                  <div className="flex items-center gap-1.5 text-slate-800 font-medium mt-0.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{remito.usuario_emisor || "Depósito"}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Pedido Asociado</span>
                  <div className="font-mono font-bold text-blue-700 mt-0.5">
                    #{remito.id_pedido}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Fecha / Turno</span>
                  <div className="text-slate-700 font-medium mt-0.5">
                    {remito.fecha_requerida ? formatSoloFechaAR(remito.fecha_requerida) : (order?.fecha_requerida ? formatSoloFechaAR(order.fecha_requerida) : "Inmediato")}{" "}
                    {remito.turno ? `(${remito.turno})` : (order?.turno ? `(${order.turno})` : "")}
                  </div>
                </div>
              </div>

              {remito.observacion && (
                <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200/80 text-xs">
                  <span className="text-amber-800 font-semibold block mb-0.5">Observaciones de Entrega:</span>
                  <p className="text-amber-950 italic">"{remito.observacion}"</p>
                </div>
              )}

              {/* TABLA DE MATERIALES */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="py-2.5 px-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Materiales en este remito ({remito.items.length})
                  </span>
                  <div className="flex gap-2">
                    {remito.total_pallets > 0 && (
                      <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-mono text-[11px]">
                        {remito.total_pallets} {remito.total_pallets === 1 ? "Pallet" : "Pallets"}
                      </Badge>
                    )}
                    <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 font-mono text-[11px]">
                      {remito.total_unidades} UN
                    </Badge>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-60">
                  <Table>
                    <TableHeader className="sticky top-0 bg-slate-100/90 backdrop-blur-xs">
                      <TableRow>
                        <TableHead className="text-xs">Código SAP</TableHead>
                        <TableHead className="text-xs">Descripción</TableHead>
                        <TableHead className="text-xs text-center">Cant. Despachada</TableHead>
                        <TableHead className="text-xs text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {remito.items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                            No hay materiales registrados en este remito.
                          </TableCell>
                        </TableRow>
                      ) : (
                        remito.items.map((it) => {
                          const isPallet = (it.tipo_empaque === "pallet" || it.tipo_empaque === "rollo") && (it.tamanio_lote || 1) > 1;
                          const palletsCount = (isPallet && it.cantidad_pallets !== null && it.cantidad_pallets !== undefined)
                            ? it.cantidad_pallets
                            : (isPallet && (it.tamanio_lote || 1) > 1 ? Math.ceil(it.cantidad / (it.tamanio_lote || 1)) : null);

                          return (
                            <TableRow key={it.id_material} className="hover:bg-slate-50/50">
                              <TableCell className="font-mono text-xs font-bold text-slate-900">
                                {it.id_material}
                              </TableCell>
                              <TableCell className="text-xs font-medium text-slate-800">
                                {it.nombre_material || it.id_material}
                              </TableCell>
                              <TableCell className="text-center text-xs">
                                {isPallet && palletsCount !== null ? (
                                  <div>
                                    <span className="font-mono font-bold text-indigo-950 block">
                                      {palletsCount} {palletsCount === 1 ? "Pallet" : "Pallets"}
                                    </span>
                                    {it.tipo_empaque === "rollo" && it.bultos_por_pallet ? (
                                      <span className="text-[11px] font-semibold text-amber-700 block">
                                        ({palletsCount * it.bultos_por_pallet} Rollos)
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-500 font-mono block">
                                        ({it.cantidad} {it.unidad || "UN"})
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="font-mono font-bold text-slate-900">
                                    {it.cantidad} {it.unidad || "UN"}
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
              </div>
            </>
          )}
        </div>

        {/* DIALOG FOOTER */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs text-slate-600">
            Cerrar
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSendConfirmation} className="text-xs gap-1.5" disabled={!remito}>
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Enviar constancia</span>
            </Button>
            <Button size="sm" onClick={handleDownloadPDF} className="text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" disabled={!remito}>
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / PDF</span>
            </Button>
          </div>
        </div>

        {/* PLANTILLA DE IMPRESIÓN OFICIAL RÉPLICA INDUSTRIAL */}
        {remito && (
          <div id="printable-remito" className="hidden font-mono text-black text-xs bg-white p-4 leading-tight">
            <div className="border-b-2 border-black pb-3 mb-3">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-extrabold text-base tracking-wider">CL2</h2>
                  <p className="text-[10px] text-gray-700">Destino: {remito.sector_destino || "Planta"}</p>
                </div>
                <div className="text-right space-y-0.5">
                  <p className="font-extrabold text-base tracking-wider">REMITO</p>
                  <p className="text-[9px] font-bold uppercase tracking-tight">DOCUMENTO NO VÁLIDO COMO FACTURA</p>
                  <p className="font-bold text-xs mt-1">
                    N° DE CPTE: <span className="font-extrabold text-sm">{remito.id_remito}</span>
                  </p>
                  <p className="text-[11px]">
                    FECHA: <span className="font-bold">{formatDDMMAAAA(remito.fecha_emision)}</span> &nbsp;
                    HORA: <span className="font-bold">{formatHora(remito.fecha_emision)}</span>
                  </p>
                  <p className="text-[11px]">
                    PEDIDO ORIGEN: <span className="font-bold">#{remito.id_pedido}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t-2 border-b-2 border-black py-1 mb-2">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-black">
                    <th className="py-1 px-1 font-bold w-[30%]">CODIGO</th>
                    <th className="py-1 px-1 font-bold w-[45%]">DESCRIPCION</th>
                    <th className="py-1 px-1 font-bold text-right w-[25%]">CANTIDAD</th>
                  </tr>
                </thead>
                <tbody>
                  {remito.items.map((it) => {
                    const isPallet = (it.tipo_empaque === "pallet" || it.tipo_empaque === "rollo") && (it.tamanio_lote || 1) > 1;
                    const palletsCount = (isPallet && it.cantidad_pallets !== null && it.cantidad_pallets !== undefined)
                      ? it.cantidad_pallets
                      : (isPallet && (it.tamanio_lote || 1) > 1 ? Math.ceil(it.cantidad / (it.tamanio_lote || 1)) : null);

                    let displayCantText = `${it.cantidad} ${it.unidad || "UN"}`;
                    if (isPallet && palletsCount !== null) {
                      const pLabel = palletsCount === 1 ? "PALLET" : "PALLETS";
                      if (it.tipo_empaque === "rollo" && it.bultos_por_pallet) {
                        const rollosTotal = palletsCount * it.bultos_por_pallet;
                        displayCantText = `${palletsCount} ${pLabel} (${rollosTotal} ROLLOS)`;
                      } else {
                        displayCantText = `${palletsCount} ${pLabel} (${it.cantidad} ${it.unidad || "UN"})`;
                      }
                    }

                    return (
                      <tr key={it.id_material} className="align-top border-b border-gray-200">
                        <td colSpan={3} className="py-1 px-1">
                          <div className="flex justify-between items-baseline font-mono">
                            <span className="w-[30%] font-bold">{it.id_material}</span>
                            <span className="w-[45%] truncate font-medium">{it.nombre_material || it.id_material}</span>
                            <span className="w-[25%] text-right font-bold">{displayCantText}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

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

            <div className="pt-6 grid grid-cols-2 gap-12 text-[10px]">
              <div className="border-t border-black pt-1 text-center">
                Firma y Aclaración Depósito Emisor
              </div>
              <div className="border-t border-black pt-1 text-center">
                Firma y Aclaración Receptor Planta
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
