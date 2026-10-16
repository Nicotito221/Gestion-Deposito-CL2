import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Truck,
  Package,
  FileText,
  Boxes,
  RefreshCw,
  Building2,
  ArrowRight,
  Eye,
  Check,
  Upload,
  Sparkles,
  FileSearch,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import {
  getIngresos,
  getIngresoById,
  createIngreso,
  confirmarRecepcionIngreso,
  deleteIngreso,
  getRundownSecciones,
  searchMaterialesCatalogo,
  parseInvoicePdf,
  type IngresoOut,
  type IngresoCreate,
  type IngresoConfirmarRecepcion,
  type RundownSeccionItem,
  type MaterialCatalogoItem,
  type ParsedInvoiceResult,
} from "../services/api";
import { getTodayISODate } from "../components/ui/format";

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pendiente: { label: "Pendiente de recepción", color: "bg-amber-50 text-amber-800 border-amber-300", icon: Clock },
  parcial: { label: "Recibido parcial", color: "bg-blue-50 text-blue-800 border-blue-300", icon: AlertCircle },
  completo: { label: "Recibido completo", color: "bg-emerald-50 text-emerald-800 border-emerald-300", icon: CheckCircle2 },
};

export function Remitos() {
  const { hasRole } = useAuth();
  const canDeleteRemito = hasRole(["gerente", "jefe"]);

  const [ingresos, setIngresos] = useState<IngresoOut[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [secciones, setSecciones] = useState<RundownSeccionItem[]>([]);
  const [search, setSearch] = useState<string>("");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [filterProveedor, setFilterProveedor] = useState<string>("all");

  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [targetToDelete, setTargetToDelete] = useState<IngresoOut | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [newModalOpen, setNewModalOpen] = useState<boolean>(false);
  const [isSubmittingNew, setIsSubmittingNew] = useState<boolean>(false);
  const [newForm, setNewForm] = useState<{
    id_proveedor: string;
    numero_factura: string;
    orden_compra: string;
    fecha_emision: string;
    observacion: string;
    confirmar_inmediato: boolean;
  }>({
    id_proveedor: "",
    numero_factura: "",
    orden_compra: "",
    fecha_emision: getTodayISODate(),
    observacion: "",
    confirmar_inmediato: false,
  });
  const [newItems, setNewItems] = useState<
    { id_material: string; nombre: string; unidad: string; cantidad: number; observacion: string }[]
  >([]);
  const [matSearch, setMatSearch] = useState<string>("");
  const [matSearchResults, setMatSearchResults] = useState<MaterialCatalogoItem[]>([]);
  const [isSearchingMat, setIsSearchingMat] = useState<boolean>(false);

  const [isParsingOcr, setIsParsingOcr] = useState<boolean>(false);
  const [ocrResult, setOcrResult] = useState<ParsedInvoiceResult | null>(null);
  const [ocrFileName, setOcrFileName] = useState<string>("");

  const handleOcrFileSelect = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Seleccione un archivo en formato PDF.");
      return;
    }
    setIsParsingOcr(true);
    setOcrFileName(file.name);
    try {
      const res = await parseInvoicePdf(file);
      setOcrResult(res);

      setNewForm((prev) => ({
        ...prev,
        id_proveedor: res.id_proveedor ? String(res.id_proveedor) : prev.id_proveedor,
        numero_factura: res.numero_factura || prev.numero_factura,
        orden_compra: res.orden_compra || prev.orden_compra,
        fecha_emision: res.fecha_emision || prev.fecha_emision,
      }));

      if (res.items && res.items.length > 0) {
        const mappedItems = res.items.map((it) => ({
          id_material: it.id_material,
          nombre: it.nombre_material || it.id_material,
          unidad: it.unidad || "UN",
          cantidad: it.cantidad_facturada,
          observacion: it.linea_origen ? `Detectado en PDF: "${it.linea_origen.slice(0, 60)}..."` : "",
        }));
        setNewItems(mappedItems);
        toast.success(`OCR exitoso: ${res.items.length} material(es) detectado(s).`);
      } else {
        toast.info("PDF procesado: verifique o complete los materiales manualmente.");
      }

      if (res.warnings && res.warnings.length > 0) {
        res.warnings.forEach((w) => toast.warning(w));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al procesar el archivo con OCR";
      toast.error(msg);
    } finally {
      setIsParsingOcr(false);
    }
  };


  const [recepcionModalOpen, setRecepcionModalOpen] = useState<boolean>(false);
  const [isSubmittingRec, setIsSubmittingRec] = useState<boolean>(false);
  const [targetIngreso, setTargetIngreso] = useState<IngresoOut | null>(null);
  const [recepcionFecha, setRecepcionFecha] = useState<string>(getTodayISODate());
  const [recepcionObs, setRecepcionObs] = useState<string>("");
  const [recepcionItems, setRecepcionItems] = useState<
    { id_material: string; nombre: string; unidad: string; facturada: number; recibida: number; conforme: boolean; observacion: string }[]
  >([]);

  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [selectedDetail, setSelectedDetail] = useState<IngresoOut | null>(null);

  const proveedoresList = useMemo(() => {
    const list: { id_proveedor: number; nombre: string; deposito_en_planta?: boolean }[] = [];
    secciones.forEach((sec) => {
      sec.proveedores?.forEach((p) => {
        if (!list.some((it) => it.id_proveedor === p.id_proveedor)) {
          list.push({
            id_proveedor: p.id_proveedor,
            nombre: p.nombre,
            deposito_en_planta: p.deposito_en_planta,
          });
        }
      });
    });
    ingresos.forEach((ing) => {
      if (ing.nombre_proveedor && !list.some((it) => it.nombre === ing.nombre_proveedor)) {
        list.push({
          id_proveedor: ing.id_proveedor || list.length + 1,
          nombre: ing.nombre_proveedor,
          deposito_en_planta: false,
        });
      }
    });
    return list.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [secciones, ingresos]);

  const fetchIngresosList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getIngresos({
        estado: filterEstado !== "all" ? filterEstado : undefined,
        id_proveedor: filterProveedor !== "all" ? parseInt(filterProveedor, 10) : undefined,
        search: search.trim() || undefined,
      });
      setIngresos(data);
    } catch {
      toast.error("Error al cargar comprobantes de ingreso");
    } finally {
      setLoading(false);
    }
  }, [filterEstado, filterProveedor, search]);

  const fetchProveedores = useCallback(async () => {
    try {
      const secs = await getRundownSecciones();
      setSecciones(secs);
    } catch {
      toast.error("Error al cargar proveedores");
    }
  }, []);

  useEffect(() => {
    fetchProveedores();
  }, [fetchProveedores]);

  useEffect(() => {
    fetchIngresosList();
  }, [fetchIngresosList]);

  useEffect(() => {
    if (!matSearch.trim()) {
      setMatSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingMat(true);
      try {
        const results = await searchMaterialesCatalogo(matSearch.trim());
        setMatSearchResults(results.slice(0, 8));
      } catch {
        setMatSearchResults([]);
      } finally {
        setIsSearchingMat(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [matSearch]);

  const handleAddMaterialToNew = (mat: MaterialCatalogoItem) => {
    if (newItems.some((it) => it.id_material === mat.id_material)) {
      toast.warning("El material ya está en la lista");
      return;
    }
    setNewItems((prev) => [
      ...prev,
      {
        id_material: mat.id_material,
        nombre: mat.nombre,
        unidad: mat.unidad || "UN",
        cantidad: 1,
        observacion: "",
      },
    ]);
    setMatSearch("");
    setMatSearchResults([]);
  };

  const handleRemoveMaterialFromNew = (idMat: string) => {
    setNewItems((prev) => prev.filter((it) => it.id_material !== idMat));
  };

  const handleCreateIngresoSubmit = async () => {
    if (!newForm.id_proveedor || newForm.id_proveedor === "none") {
      toast.error("Seleccione un proveedor");
      return;
    }
    if (!newForm.numero_factura.trim()) {
      toast.error("Ingrese el número de factura o remito");
      return;
    }
    const cleanFactura = newForm.numero_factura.trim().toLowerCase();
    const isDuplicate = ingresos.some(
      (i) => i.numero_factura.trim().toLowerCase() === cleanFactura
    );
    if (isDuplicate) {
      toast.error(`La factura #${newForm.numero_factura.trim()} ya se encuentra registrada. El número de factura debe ser único.`);
      return;
    }
    if (newItems.length === 0) {
      toast.error("Agregue al menos un material con cantidad facturada");
      return;
    }
    for (const it of newItems) {
      if (it.cantidad <= 0 || isNaN(it.cantidad)) {
        toast.error(`La cantidad para ${it.id_material} debe ser mayor a 0`);
        return;
      }
    }

    const payload: IngresoCreate = {
      id_proveedor: parseInt(newForm.id_proveedor, 10),
      numero_factura: newForm.numero_factura.trim(),
      orden_compra: newForm.orden_compra.trim() || undefined,
      fecha_emision: newForm.fecha_emision || undefined,
      observacion: newForm.observacion.trim() || undefined,
      confirmar_inmediato: newForm.confirmar_inmediato,
      fecha_recepcion: newForm.fecha_emision || undefined,
      items: newItems.map((it) => ({
        id_material: it.id_material,
        cantidad_facturada: it.cantidad,
        observacion: it.observacion.trim() || undefined,
      })),
    };

    setIsSubmittingNew(true);
    try {
      await createIngreso(payload);
      if (newForm.confirmar_inmediato) {
        toast.success(`Factura #${newForm.numero_factura} registrada e ingresada al stock exitosamente.`);
      } else {
        toast.success(`Factura #${newForm.numero_factura} cargada exitosamente como pendiente de recepción.`);
      }
      setNewModalOpen(false);
      setNewForm({
        id_proveedor: "",
        numero_factura: "",
        orden_compra: "",
        fecha_emision: getTodayISODate(),
        observacion: "",
        confirmar_inmediato: false,
      });
      setNewItems([]);
      await fetchIngresosList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar comprobante");
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const handleOpenRecepcionModal = (ing: IngresoOut) => {
    setTargetIngreso(ing);
    setRecepcionFecha(getTodayISODate());
    setRecepcionObs(ing.observacion || "");
    setRecepcionItems(
      ing.items.map((it) => ({
        id_material: it.id_material,
        nombre: it.nombre_material || it.id_material,
        unidad: it.unidad || "UN",
        facturada: it.cantidad_facturada,
        recibida: it.cantidad_recibida !== null && it.cantidad_recibida !== undefined ? it.cantidad_recibida : it.cantidad_facturada,
        conforme: it.conforme,
        observacion: it.observacion || "",
      }))
    );
    setRecepcionModalOpen(true);
  };

  const handleMarkAllComplete = () => {
    setRecepcionItems((prev) =>
      prev.map((it) => ({
        ...it,
        recibida: it.facturada,
        conforme: true,
      }))
    );
    toast.info("Cantidades recibidas igualadas a las cantidades facturadas");
  };

  const handleSubmitRecepcion = async () => {
    if (!targetIngreso) return;

    for (const it of recepcionItems) {
      if (it.recibida < 0 || isNaN(it.recibida)) {
        toast.error(`Cantidad inválida para ${it.id_material}`);
        return;
      }
    }

    const payload: IngresoConfirmarRecepcion = {
      fecha_recepcion: recepcionFecha,
      observacion: recepcionObs.trim() || undefined,
      items: recepcionItems.map((it) => ({
        id_material: it.id_material,
        cantidad_recibida: it.recibida,
        conforme: it.conforme,
        observacion: it.observacion.trim() || undefined,
      })),
    };

    setIsSubmittingRec(true);
    try {
      const res = await confirmarRecepcionIngreso(targetIngreso.id_ingreso, payload);
      const destinoStr = res.deposito_en_planta ? "Planta" : "CL2";
      toast.success(
        `Recepción de Factura #${res.numero_factura} confirmada. Stock incrementado en ${destinoStr} y sincronizado en Rundown.`
      );
      setRecepcionModalOpen(false);
      await fetchIngresosList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al confirmar recepción");
    } finally {
      setIsSubmittingRec(false);
    }
  };

  const handleOpenDetailModal = async (idIngreso: number) => {
    try {
      const res = await getIngresoById(idIngreso);
      setSelectedDetail(res);
      setDetailModalOpen(true);
    } catch {
      toast.error("Error al cargar detalle del comprobante");
    }
  };

  const handleDeleteIngreso = async () => {
    if (!targetToDelete) return;
    setIsDeleting(true);
    try {
      await deleteIngreso(targetToDelete.id_ingreso);
      toast.success(`Factura / Remito #${targetToDelete.numero_factura} eliminado correctamente`);
      setDeleteModalOpen(false);
      setTargetToDelete(null);
      await fetchIngresosList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar comprobante");
    } finally {
      setIsDeleting(false);
    }
  };

  const kpis = useMemo(() => {
    const total = ingresos.length;
    const pendientes = ingresos.filter((i) => i.estado === "pendiente").length;
    const parciales = ingresos.filter((i) => i.estado === "parcial").length;
    const completos = ingresos.filter((i) => i.estado === "completo").length;
    return { total, pendientes, parciales, completos };
  }, [ingresos]);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Remitos e Ingresos de Proveedores
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Carga de facturas/comprobantes desde TBAR y confirmación de recepción física en depósito
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchIngresosList}
            disabled={loading}
            className="text-xs h-9 gap-1.5 border-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setNewModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 gap-1.5 shadow-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Cargar Factura / Remito</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="shadow-xs border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 rounded-lg text-slate-600">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Comprobantes</p>
              <p className="text-xl font-bold text-slate-900">{kpis.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-lg text-amber-700">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Pendientes Recepción</p>
              <p className="text-xl font-bold text-amber-700">{kpis.pendientes}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-lg text-blue-700">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Recibidos Parcial</p>
              <p className="text-xl font-bold text-blue-700">{kpis.parciales}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-lg text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Recibidos Completo</p>
              <p className="text-xl font-bold text-emerald-700">{kpis.completos}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xs border-slate-200">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                placeholder="Buscar por N° Factura, PO o proveedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <Select value={filterEstado} onValueChange={setFilterEstado}>
                <SelectTrigger className="h-9 w-44 text-xs">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pendiente">Pendientes</SelectItem>
                  <SelectItem value="parcial">Recibidos Parcial</SelectItem>
                  <SelectItem value="completo">Recibidos Completo</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterProveedor} onValueChange={setFilterProveedor}>
                <SelectTrigger className="h-9 w-48 text-xs">
                  <SelectValue placeholder="Proveedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los proveedores</SelectItem>
                  {proveedoresList.map((p) => (
                    <SelectItem key={p.id_proveedor} value={String(p.id_proveedor)}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-28 text-xs font-semibold text-slate-700">Estado</TableHead>
                  <TableHead className="w-36 text-xs font-semibold text-slate-700">N° Factura / Remito</TableHead>
                  <TableHead className="w-32 text-xs font-semibold text-slate-700">Orden de Compra</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Proveedor</TableHead>
                  <TableHead className="w-28 text-xs font-semibold text-slate-700 text-center">F. Emisión</TableHead>
                  <TableHead className="w-28 text-xs font-semibold text-slate-700 text-center">F. Recepción</TableHead>
                  <TableHead className="w-24 text-xs font-semibold text-slate-700 text-center">Ítems</TableHead>
                  <TableHead className="w-36 text-xs font-semibold text-slate-700 text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Cargando comprobantes...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : ingresos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                      No se encontraron comprobantes de ingreso.
                    </TableCell>
                  </TableRow>
                ) : (
                  ingresos.map((ing) => {
                    const cfg = statusConfig[ing.estado] || statusConfig.pendiente;
                    const Icon = cfg.icon;
                    return (
                      <TableRow key={ing.id_ingreso} className="hover:bg-slate-50/80 transition-colors">
                        <TableCell>
                          <Badge variant="outline" className={`${cfg.color} text-[11px] font-semibold flex items-center gap-1 w-fit`}>
                            <Icon className="w-3 h-3" />
                            <span>{cfg.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-slate-800">
                          {ing.numero_factura}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-600">
                          {ing.orden_compra || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium text-slate-800">{ing.nombre_proveedor}</div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Destino: {ing.deposito_en_planta ? "Planta" : "CL2 (Depósito)"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-xs font-mono text-slate-600">
                          {ing.fecha_emision ? String(ing.fecha_emision).split("T")[0] : "—"}
                        </TableCell>
                        <TableCell className="text-center text-xs font-mono text-slate-600">
                          {ing.fecha_recepcion ? String(ing.fecha_recepcion).split("T")[0] : "—"}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs font-semibold text-slate-700">
                          {ing.total_items}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenDetailModal(ing.id_ingreso)}
                              className="h-7 px-2 text-xs border-slate-300 text-slate-700"
                              title="Ver detalle de factura"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>

                            {ing.estado !== "completo" && (
                              <Button
                                size="sm"
                                onClick={() => handleOpenRecepcionModal(ing)}
                                className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1 shadow-xs"
                                title="Confirmar recepción física en depósito para sumar al stock"
                              >
                                <Truck className="w-3.5 h-3.5" />
                                <span>Ingresar Stock</span>
                              </Button>
                            )}

                            {canDeleteRemito && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setTargetToDelete(ing);
                                  setDeleteModalOpen(true);
                                }}
                                className="h-7 px-2 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                title="Eliminar remito (solo Jefe / Gerente / Administrador)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
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

      {/* MODAL NUEVA FACTURA / REMITO (CARGA DESDE TBAR) */}
      <Dialog open={newModalOpen} onOpenChange={setNewModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>Cargar Factura / Remito de Proveedor</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Registra los datos de la factura y los materiales con sus cantidades reales (en unidad de medida, no pallets).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* ZONA DE CARGA INTELIGENTE OCR / PDF */}
            <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-blue-900 flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
                  <span>Autocompletar con OCR (Factura PDF)</span>
                </span>
                {ocrResult?.debug_log_file && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    Log: {ocrResult.debug_log_file}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleOcrFileSelect(f);
                    }}
                    disabled={isParsingOcr}
                  />
                  <div className="flex items-center justify-center gap-2 border-2 border-dashed border-blue-300 hover:border-blue-500 hover:bg-white/80 transition-all rounded-md p-2.5 text-center bg-white/50">
                    {isParsingOcr ? (
                      <>
                        <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                        <span className="font-medium text-blue-700">Analizando documento y extrayendo ítems...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-slate-700">
                          {ocrFileName ? `Archivo: ${ocrFileName}` : "Arrastra o selecciona un PDF de Factura/Remito"}
                        </span>
                      </>
                    )}
                  </div>
                </label>
              </div>

              {ocrResult && (
                <div className="text-[11px] text-slate-600 bg-white/80 p-2 rounded border border-blue-100 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-emerald-700">✓ Extracción lista: </span>
                    <span>{ocrResult.items.length} material(es) detectado(s).</span>
                    {ocrResult.codigo_proveedor && (
                      <span className="ml-1 text-slate-500 font-mono">({ocrResult.codigo_proveedor})</span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-slate-500 hover:text-slate-700 px-1.5"
                    onClick={() => {
                      setOcrResult(null);
                      setOcrFileName("");
                    }}
                  >
                    Limpiar
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Proveedor *</span>
                </Label>
                <Select
                  value={newForm.id_proveedor}
                  onValueChange={(val) => setNewForm({ ...newForm, id_proveedor: val })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {proveedoresList.map((p) => (
                      <SelectItem key={p.id_proveedor} value={String(p.id_proveedor)}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700">N° Factura / Remito *</Label>
                  <span className="text-[10px] text-slate-400">Debe ser único</span>
                </div>
                <Input
                  value={newForm.numero_factura}
                  onChange={(e) => setNewForm({ ...newForm, numero_factura: e.target.value })}
                  placeholder="Ej: FC-0001-00045231"
                  className={`h-9 text-xs font-mono font-bold ${
                    newForm.numero_factura.trim() &&
                    ingresos.some(
                      (i) =>
                        i.numero_factura.trim().toLowerCase() ===
                        newForm.numero_factura.trim().toLowerCase()
                    )
                      ? "border-red-500 focus-visible:ring-red-500"
                      : ""
                  }`}
                />
                {newForm.numero_factura.trim() &&
                  ingresos.some(
                    (i) =>
                      i.numero_factura.trim().toLowerCase() ===
                      newForm.numero_factura.trim().toLowerCase()
                  ) && (
                    <p className="text-[11px] text-red-600 font-medium">
                      Esta factura ya se encuentra registrada en el sistema.
                    </p>
                  )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700">Orden de Compra (PO)</Label>
                  <span className="text-[10px] text-slate-400">Puede repetirse</span>
                </div>
                <Input
                  value={newForm.orden_compra}
                  onChange={(e) => setNewForm({ ...newForm, orden_compra: e.target.value })}
                  placeholder="Ej: PO-2026-9812"
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Fecha de Emisión / Factura</span>
                </Label>
                <Input
                  type="date"
                  value={newForm.fecha_emision}
                  onChange={(e) => setNewForm({ ...newForm, fecha_emision: e.target.value })}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Observaciones Generales</Label>
              <Textarea
                rows={2}
                value={newForm.observacion}
                onChange={(e) => setNewForm({ ...newForm, observacion: e.target.value })}
                placeholder="Detalle o notas de la factura..."
                className="text-xs"
              />
            </div>

            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-lg flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="chk-inmediato" className="text-xs font-bold text-blue-950 cursor-pointer flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Ingresar al stock de inmediato</span>
                </Label>
                <p className="text-[11px] text-blue-800">
                  Si el material ya fue descargado físicamente, se suma directamente al stock y se sincroniza el arribo en el Rundown.
                </p>
              </div>
              <input
                id="chk-inmediato"
                type="checkbox"
                checked={newForm.confirmar_inmediato}
                onChange={(e) => setNewForm({ ...newForm, confirmar_inmediato: e.target.checked })}
                className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
              />
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span>Materiales en la Factura ({newItems.length})</span>
                </Label>
                <span className="text-[11px] text-slate-500 font-medium">
                  Carga por cantidades reales (NO PALLETS)
                </span>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <Input
                  placeholder="Buscar material por código SAP o descripción..."
                  value={matSearch}
                  onChange={(e) => setMatSearch(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
                {isSearchingMat && (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 absolute right-3 top-3" />
                )}

                {matSearchResults.length > 0 && (
                  <div className="absolute top-10 left-0 right-0 z-50 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {matSearchResults.map((m) => (
                      <button
                        key={m.id_material}
                        type="button"
                        onClick={() => handleAddMaterialToNew(m)}
                        className="w-full text-left p-2.5 hover:bg-blue-50/70 flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <span className="font-mono font-bold text-slate-800">{m.id_material}</span>
                          <span className="text-slate-600 ml-2">{m.nombre}</span>
                        </div>
                        <Badge variant="outline" className="font-mono text-[10px] text-indigo-700 bg-indigo-50 border-indigo-200">
                          {m.unidad || "UN"}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {newItems.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
                  Busque y agregue materiales a la factura usando el buscador arriba.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-xs font-semibold text-slate-700">Material</TableHead>
                        <TableHead className="w-24 text-xs font-semibold text-slate-700 text-center">Unidad</TableHead>
                        <TableHead className="w-32 text-xs font-semibold text-slate-700 text-center">Cantidad</TableHead>
                        <TableHead className="w-10 text-center"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-100">
                      {newItems.map((it) => (
                        <TableRow key={it.id_material}>
                          <TableCell className="text-xs">
                            <div className="font-mono font-bold text-slate-800">{it.id_material}</div>
                            <div className="text-slate-500 text-[11px] truncate max-w-[260px]">{it.nombre}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {it.unidad}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min="0.01"
                              step="any"
                              value={it.cantidad}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setNewItems((prev) =>
                                  prev.map((item) =>
                                    item.id_material === it.id_material ? { ...item, cantidad: val } : item
                                  )
                                );
                              }}
                              className="h-8 text-xs font-mono font-bold text-center w-28 mx-auto"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMaterialFromNew(it.id_material)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setNewModalOpen(false)} disabled={isSubmittingNew}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleCreateIngresoSubmit}
              disabled={isSubmittingNew}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {isSubmittingNew ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Registrar Factura</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL RECEPCIÓN EN DEPÓSITO */}
      <Dialog open={recepcionModalOpen} onOpenChange={setRecepcionModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Truck className="w-5 h-5 text-blue-600" />
              <span>Confirmación de Recepción en Depósito</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Verifique las cantidades recibidas físicamente. Al confirmar, se actualizará el stock y el tránsito en el Rundown.
            </DialogDescription>
          </DialogHeader>

          {targetIngreso && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-slate-500 block">N° Factura:</span>
                  <span className="font-mono font-bold text-slate-800">{targetIngreso.numero_factura}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Orden de Compra:</span>
                  <span className="font-mono text-slate-700">{targetIngreso.orden_compra || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Proveedor:</span>
                  <span className="font-medium text-slate-800">{targetIngreso.nombre_proveedor}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Destino Stock:</span>
                  <Badge variant="outline" className="font-semibold text-blue-700 bg-blue-50 border-blue-200">
                    {targetIngreso.deposito_en_planta ? "Planta" : "CL2 (Depósito)"}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Fecha Real de Llegada a Depósito:</span>
                  </Label>
                  <Input
                    type="date"
                    value={recepcionFecha}
                    onChange={(e) => setRecepcionFecha(e.target.value)}
                    className="h-8 text-xs font-mono w-40"
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllComplete}
                  className="h-8 text-xs text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Tildar Todo Completo</span>
                </Button>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-xs font-semibold text-slate-700">Material</TableHead>
                      <TableHead className="w-28 text-xs font-semibold text-slate-700 text-center">Cant. Facturada</TableHead>
                      <TableHead className="w-36 text-xs font-semibold text-slate-700 text-center">Cant. Recibida</TableHead>
                      <TableHead className="w-24 text-xs font-semibold text-slate-700 text-center">Conforme</TableHead>
                      <TableHead className="w-44 text-xs font-semibold text-slate-700">Observación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100">
                    {recepcionItems.map((it) => {
                      const diff = it.recibida - it.facturada;
                      return (
                        <TableRow key={it.id_material}>
                          <TableCell className="text-xs">
                            <div className="font-mono font-bold text-slate-800">{it.id_material}</div>
                            <div className="text-slate-500 text-[11px] truncate max-w-[200px]">{it.nombre}</div>
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs font-bold text-slate-800">
                            {it.facturada.toLocaleString("es-AR")} <span className="text-[11px] text-slate-500 font-normal">{it.unidad}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="space-y-1">
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                value={it.recibida}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setRecepcionItems((prev) =>
                                    prev.map((item) =>
                                      item.id_material === it.id_material ? { ...item, recibida: val } : item
                                    )
                                  );
                                }}
                                className={`h-8 text-xs font-mono font-bold text-center w-28 mx-auto ${
                                  diff < 0 ? "border-amber-400 bg-amber-50/50" : diff > 0 ? "border-blue-400 bg-blue-50/50" : ""
                                }`}
                              />
                              {diff !== 0 && (
                                <span className={`text-[10px] font-mono font-semibold block ${diff < 0 ? "text-amber-700" : "text-blue-700"}`}>
                                  {diff > 0 ? `+${diff}` : diff} {it.unidad}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={it.conforme}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setRecepcionItems((prev) =>
                                  prev.map((item) =>
                                    item.id_material === it.id_material ? { ...item, conforme: checked } : item
                                  )
                                );
                              }}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={it.observacion}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRecepcionItems((prev) =>
                                  prev.map((item) =>
                                    item.id_material === it.id_material ? { ...item, observacion: val } : item
                                  )
                                );
                              }}
                              placeholder="Opcional..."
                              className="h-8 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Observación de Recepción</Label>
                <Textarea
                  rows={2}
                  value={recepcionObs}
                  onChange={(e) => setRecepcionObs(e.target.value)}
                  placeholder="Detalles de entrega, precintos, camión..."
                  className="text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setRecepcionModalOpen(false)} disabled={isSubmittingRec}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitRecepcion}
              disabled={isSubmittingRec}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs font-semibold"
            >
              {isSubmittingRec ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Procesando Ingreso...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar Recepción y Sumar al Stock</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DETALLE DE COMPROBANTE */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="w-5 h-5 text-slate-700" />
              <span>Detalle de Comprobante #{selectedDetail?.numero_factura}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Información de la factura, materiales registrados y estado de entrega.
            </DialogDescription>
          </DialogHeader>

          {selectedDetail && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-slate-500 block">Proveedor:</span>
                  <span className="font-semibold text-slate-900">{selectedDetail.nombre_proveedor}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">N° Factura / Remito:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedDetail.numero_factura}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Orden de Compra:</span>
                  <span className="font-mono text-slate-700">{selectedDetail.orden_compra || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Estado:</span>
                  <span className="font-semibold text-slate-900 capitalize">{selectedDetail.estado}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Fecha Emisión:</span>
                  <span className="font-mono text-slate-700">
                    {selectedDetail.fecha_emision ? String(selectedDetail.fecha_emision).split("T")[0] : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Fecha Recepción:</span>
                  <span className="font-mono text-slate-700">
                    {selectedDetail.fecha_recepcion ? String(selectedDetail.fecha_recepcion).split("T")[0] : "—"}
                  </span>
                </div>
              </div>

              {selectedDetail.observacion && (
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-slate-600">
                  <span className="font-semibold text-slate-700 block mb-0.5">Observaciones:</span>
                  {selectedDetail.observacion}
                </div>
              )}

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-xs font-semibold text-slate-700">Código SAP</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-700">Descripción</TableHead>
                      <TableHead className="w-28 text-xs font-semibold text-slate-700 text-center">Facturado</TableHead>
                      <TableHead className="w-28 text-xs font-semibold text-slate-700 text-center">Recibido</TableHead>
                      <TableHead className="w-20 text-xs font-semibold text-slate-700 text-center">Conforme</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100">
                    {selectedDetail.items.map((it) => (
                      <TableRow key={it.id_ingreso_detalle}>
                        <TableCell className="font-mono font-bold text-slate-800 text-xs">
                          {it.id_material}
                        </TableCell>
                        <TableCell className="text-xs text-slate-700">
                          {it.nombre_material || it.id_material}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs font-bold text-slate-800">
                          {it.cantidad_facturada.toLocaleString("es-AR")} {it.unidad}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs font-bold text-blue-700">
                          {it.cantidad_recibida !== null && it.cantidad_recibida !== undefined
                            ? `${it.cantidad_recibida.toLocaleString("es-AR")} ${it.unidad}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {it.conforme ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-amber-600 mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button size="sm" onClick={() => setDetailModalOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL CONFIRMAR ELIMINACIÓN DE REMITO */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-red-600">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span>Eliminar Comprobante #{targetToDelete?.numero_factura}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          {targetToDelete && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <p>
                  <strong className="text-slate-700">Proveedor:</strong> {targetToDelete.nombre_proveedor}
                </p>
                <p>
                  <strong className="text-slate-700">Estado:</strong>{" "}
                  <span className="capitalize font-semibold">{targetToDelete.estado}</span>
                </p>
                {targetToDelete.orden_compra && (
                  <p>
                    <strong className="text-slate-700">Orden de Compra:</strong> {targetToDelete.orden_compra}
                  </p>
                )}
                <p>
                  <strong className="text-slate-700">Total ítems:</strong> {targetToDelete.total_items}
                </p>
              </div>

              {targetToDelete.estado !== "pendiente" ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5 text-xs text-red-900">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>¡Atención: Stock ya ingresado!</span>
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Este remito ya impactó en el stock ({targetToDelete.deposito_en_planta ? "Planta" : "CL2 Depósito"}).
                    Al eliminarlo, se revertirá automáticamente el stock ingresado y se eliminará el arribo registrado en el Rundown.
                  </p>
                </div>
              ) : (
                <p className="text-slate-600 text-xs">
                  ¿Confirmas que deseas eliminar esta factura pendiente? No impactará en el stock de materiales.
                </p>
              )}
            </div>
          )}

          <DialogFooter className="pt-2 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteModalOpen(false);
                setTargetToDelete(null);
              }}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleDeleteIngreso}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5 shadow-xs font-semibold"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Eliminando...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar Definitivamente</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
