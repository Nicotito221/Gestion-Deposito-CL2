import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "../components/ui/alert-dialog";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  RefreshCw,
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit3,
  Layers,
  Ship,
  Plane,
  PackageCheck,
  Package,
  Building2,
  TrendingDown,
  Settings,
  FolderPlus,
  UserPlus,
  Warehouse,
  Globe2,
  Percent,
  CalendarDays,
  Truck,
  SlidersHorizontal,
  Trash2,
  Search,
  GripVertical,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { CalendarioLaboralModal } from "../components/CalendarioLaboralModal";
import {
  getRundownSecciones,
  createRundownSeccion,
  createRundownProveedor,
  updateRundownProveedor,
  getSupplierRundown,
  createRundownTransito,
  upsertRundownIngresoDia,
  updateRundownStockInicial,
  updateRundownStockAjuste,
  deleteRundownStockAjuste,
  updateRundownScrap,
  getRundownCalendarioMes,
  saveRundownCalendarioMes,
  searchMaterialesCatalogo,
  getMaterialCatalogoInfo,
  getProveedorMateriales,
  addProveedorMaterial,
  deleteProveedorMaterial,
  updateLoteMaterial,
  getPeriodosProyeccion,
  createPeriodoProyeccion,
  deletePeriodoProyeccion,
  previewPlanSemanal,
  confirmPlanSemanal,
  type RundownSeccionItem,
  type RundownSupplierReport,
  type RundownMaterialGrid,
  type RundownTransitoInput,
  type RundownPeriodoItem,
  type RundownCalendarioMesOut,
  type RundownCalendarioDia,
  type MaterialCatalogoItem,
  type RundownParametroMaterialItem,
  type RundownPeriodoProyeccionItem,
  type RundownPeriodoProyeccionCreate,
  type PlanSemanalPreviewOut,
  type PlanSemanalItemConfirm,
} from "../services/api";

export function RundownVivo() {
  const [secciones, setSecciones] = useState<RundownSeccionItem[]>([]);
  const [selectedSeccionId, setSelectedSeccionId] = useState<number>(0);
  const [selectedSupplierCode, setSelectedSupplierCode] = useState<string>("HOWA");
  const [searchParams] = useSearchParams();
  const initAlcance = searchParams.get("alcance") === "planta" ? "planta" : "total";
  const [alcance, setAlcance] = useState<"total" | "planta">(initAlcance);
  const [selectedPeriodo, setSelectedPeriodo] = useState<string>("");

  const [report, setReport] = useState<RundownSupplierReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const initRiesgo = searchParams.get("riesgo") === "1" || searchParams.get("filtro") === "riesgo";
  const [activeMaterialTab, setActiveMaterialTab] = useState<string>("todos");
  const [filterSoloRiesgo, setFilterSoloRiesgo] = useState<boolean>(initRiesgo);

  useEffect(() => {
    const urlAlcance = searchParams.get("alcance");
    if (urlAlcance === "planta" || urlAlcance === "total") {
      setAlcance(urlAlcance);
    }
    if (searchParams.get("riesgo") === "1" || searchParams.get("filtro") === "riesgo") {
      setFilterSoloRiesgo(true);
    }
  }, [searchParams]);
  const [riskJumpIndex, setRiskJumpIndex] = useState<number>(0);
  const [highlightedRiskId, setHighlightedRiskId] = useState<string | null>(null);

  const [umbralesModalOpen, setUmbralesModalOpen] = useState<boolean>(false);
  const [isSavingUmbrales, setIsSavingUmbrales] = useState<boolean>(false);
  const [umbralesForm, setUmbralesForm] = useState<{
    dias_rojo: number;
    dias_amarillo: number;
  }>({ dias_rojo: 5, dias_amarillo: 15 });

  const [adminModalOpen, setAdminModalOpen] = useState<boolean>(false);
  const [adminTab, setAdminTab] = useState<"secciones" | "proveedores" | "materiales">("secciones");
  const [adminMaterialProvId, setAdminMaterialProvId] = useState<number>(0);
  const [provMaterialesList, setProvMaterialesList] = useState<RundownParametroMaterialItem[]>([]);
  const [loadingProvMateriales, setLoadingProvMateriales] = useState<boolean>(false);
  const [catalogoSearchResults, setCatalogoSearchResults] = useState<MaterialCatalogoItem[]>([]);
  const [catalogoSearchQuery, setCatalogoSearchQuery] = useState<string>("");
  const [isSearchingCatalogo, setIsSearchingCatalogo] = useState<boolean>(false);
  const [newMaterialForm, setNewMaterialForm] = useState<{
    id_material: string;
    descripcion: string;
    unidad: string;
    lote_mts: number;
    scrap_porcentaje: number;
    stock_inicial_planta: number;
    stock_inicial_total: number;
  }>({
    id_material: "",
    descripcion: "",
    unidad: "MTS",
    lote_mts: 0,
    scrap_porcentaje: 0,
    stock_inicial_planta: 0,
    stock_inicial_total: 0,
  });
  const [isAddingMaterial, setIsAddingMaterial] = useState<boolean>(false);
  const [newSeccionForm, setNewSeccionForm] = useState({ codigo: "", nombre: "", descripcion: "" });
  const [newProvForm, setNewProvForm] = useState({ codigo_proveedor: "", nombre: "", id_seccion: 0, deposito_en_planta: false });
  const [isSavingAdmin, setIsSavingAdmin] = useState<boolean>(false);
  const [editProvModalOpen, setEditProvModalOpen] = useState<boolean>(false);
  const [isSavingEditProv, setIsSavingEditProv] = useState<boolean>(false);
  const [editProvForm, setEditProvForm] = useState<{
    id_proveedor: number;
    codigo_proveedor: string;
    nombre: string;
    id_seccion: number;
    deposito_en_planta: boolean;
    dias_alerta_rojo: number;
    dias_alerta_amarillo: number;
    doh_sugerido_planta: number;
    activo: boolean;
  }>({
    id_proveedor: 0,
    codigo_proveedor: "",
    nombre: "",
    id_seccion: 0,
    deposito_en_planta: false,
    dias_alerta_rojo: 5,
    dias_alerta_amarillo: 15,
    doh_sugerido_planta: 1.0,
    activo: true,
  });

  const [loteMaterialModalOpen, setLoteMaterialModalOpen] = useState<boolean>(false);
  const [editingLoteMaterial, setEditingLoteMaterial] = useState<{
    id_parametro: number;
    id_material: string;
    descripcion: string;
    tipo_empaque: string;
    lote_mts: number;
  } | null>(null);
  const [isSavingLoteMaterial, setIsSavingLoteMaterial] = useState<boolean>(false);

  const [transitoModalOpen, setTransitoModalOpen] = useState<boolean>(false);
  const [isSavingTransito, setIsSavingTransito] = useState<boolean>(false);
  const [transitoForm, setTransitoForm] = useState<RundownTransitoInput>({
    id_proveedor: 1,
    id_material: "PU188-D1800",
    fecha_eta: "2026-09-04",
    tipo_via: "Maritimo",
    po_numero: "",
    factura_numero: "",
    cantidad: 0,
    observacion: "",
    estado: "planificado",
  });

  const [editIngresoModalOpen, setEditIngresoModalOpen] = useState<boolean>(false);
  const [isSavingIngreso, setIsSavingIngreso] = useState<boolean>(false);
  const [ingresoEditForm, setIngresoEditForm] = useState<{
    id_material: string;
    fecha_origen: string;
    fecha_eta: string;
    dia_nombre: string;
    tipo_via: "Maritimo" | "Aereo" | "Local" | "AjusteScrap";
    cantidad: number;
    po_numero: string;
    factura_numero: string;
    observacion: string;
    estado: "planificado" | "confirmado";
  }>({
    id_material: "",
    fecha_origen: "",
    fecha_eta: "",
    dia_nombre: "",
    tipo_via: "Maritimo",
    cantidad: 0,
    po_numero: "",
    factura_numero: "",
    observacion: "",
    estado: "planificado",
  });

  const [draggedPedido, setDraggedPedido] = useState<{
    id_material: string;
    fecha_origen: string;
    tipo_via: "Maritimo" | "Aereo" | "Local" | "AjusteScrap";
    cantidad: number;
  } | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{
    id_material: string;
    fecha: string;
    tipo_via: string;
  } | null>(null);

  const [stockModalOpen, setStockModalOpen] = useState<boolean>(false);
  const [isSavingStock, setIsSavingStock] = useState<boolean>(false);
  const [stockForm, setStockForm] = useState<{
    id_parametro: number;
    id_proveedor: number;
    id_material: string;
    fecha: string;
    material_label: string;
    stock_inicial: number;
    tipo_stock: "total" | "planta";
    observacion: string;
  }>({
    id_parametro: 0,
    id_proveedor: 0,
    id_material: "",
    fecha: "",
    material_label: "",
    stock_inicial: 0,
    tipo_stock: "total",
    observacion: "",
  });

  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionText: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: "",
    description: "",
    actionText: "Eliminar",
    onConfirm: async () => { },
  });
  const [isDeletingItem, setIsDeletingItem] = useState<boolean>(false);

  const [scrapModalOpen, setScrapModalOpen] = useState<boolean>(false);
  const [scrapTargetMat, setScrapTargetMat] = useState<RundownMaterialGrid | null>(null);
  const [scrapInputVal, setScrapInputVal] = useState<string>("0");
  const [savingScrap, setSavingScrap] = useState<boolean>(false);

  const [calModalOpen, setCalModalOpen] = useState<boolean>(false);
  const [calSelectedAnio, setCalSelectedAnio] = useState<number>(2026);
  const [calSelectedMes, setCalSelectedMes] = useState<number>(10);

  const [horizonteModalOpen, setHorizonteModalOpen] = useState<boolean>(false);
  const [periodosProyeccion, setPeriodosProyeccion] = useState<RundownPeriodoProyeccionItem[]>([]);
  const [loadingProyecciones, setLoadingProyecciones] = useState<boolean>(false);
  const [isSavingProyeccion, setIsSavingProyeccion] = useState<boolean>(false);
  const [newProyeccionForm, setNewProyeccionForm] = useState<{
    anio: number;
    mes: number;
    periodo_copia: string;
    observacion: string;
  }>({
    anio: 2027,
    mes: 3,
    periodo_copia: "2027-02",
    observacion: "",
  });

  const [planModalOpen, setPlanModalOpen] = useState<boolean>(false);
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [planPreview, setPlanPreview] = useState<PlanSemanalPreviewOut | null>(null);
  const [planLoading, setPlanLoading] = useState<boolean>(false);
  const [planSaving, setPlanSaving] = useState<boolean>(false);
  const [planOverrideFecha, setPlanOverrideFecha] = useState<string>("");
  const planFileInputRef = useRef<HTMLInputElement | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState<number>(0);

  const updateScrollWidth = useCallback(() => {
    if (tableContainerRef.current) {
      setScrollWidth(tableContainerRef.current.scrollWidth);
    }
  }, []);

  const fetchSecciones = useCallback(async () => {
    try {
      const data = await getRundownSecciones();
      setSecciones(data);
      if (data.length > 0 && selectedSeccionId === 0) {
        setSelectedSeccionId(data[0].id_seccion);
        if (data[0].proveedores.length > 0) {
          const howaProv = data[0].proveedores.find((p) => p.codigo_proveedor === "HOWA");
          setSelectedSupplierCode(howaProv ? howaProv.codigo_proveedor : data[0].proveedores[0].codigo_proveedor);
        }
      }
    } catch {
      toast.error("Error al cargar líneas de rundown");
    }
  }, [selectedSeccionId]);

  useEffect(() => {
    fetchSecciones();
  }, [fetchSecciones]);

  const activeSeccion = useMemo(() => {
    return secciones.find((s) => s.id_seccion === selectedSeccionId) || secciones[0];
  }, [secciones, selectedSeccionId]);

  const activeSupplier = useMemo(() => {
    if (!activeSeccion) return null;
    if (selectedSupplierCode === "TODOS") {
      return {
        id_proveedor: 0,
        codigo_proveedor: "TODOS",
        nombre: "Todos los Proveedores",
        tiene_parametros: true,
      };
    }
    return activeSeccion.proveedores.find((p) => p.codigo_proveedor === selectedSupplierCode) || null;
  }, [activeSeccion, selectedSupplierCode]);

  const fetchRundown = useCallback(async (isSilent: boolean = false) => {
    if (!selectedSupplierCode) return;
    if (!isSilent) {
      setLoading(true);
    }
    setErrorMsg(null);
    try {
      const data = await getSupplierRundown(
        selectedSupplierCode,
        undefined,
        undefined,
        alcance,
        selectedPeriodo || undefined,
        selectedSeccionId || undefined
      );

      const currentScrollX = tableContainerRef.current?.scrollLeft || 0;
      const currentScrollY = window.scrollY;

      setReport(data);

      if (filterSoloRiesgo) {
        const diasRojoTarget = alcance === "planta" ? 1.0 : (data.dias_alerta_rojo ?? 5.0);
        const hasRisk = data.materiales.some((m) =>
          m.dias.some((d) => d.alerta_quiebre || d.dias_cobertura < diasRojoTarget)
        );
        if (!hasRisk) {
          toast.info(
            `No se detectaron alertas de riesgo para ${data.nombre_proveedor} en Rundown ${alcance === "planta" ? "Planta" : "TBAR"}. Mostrando todos los materiales.`
          );
          setFilterSoloRiesgo(false);
        }
      }

      if (!selectedPeriodo || (data.meses_disponibles.length > 0 && !data.meses_disponibles.some((m) => m.periodo === selectedPeriodo))) {
        setSelectedPeriodo(data.periodo_actual);
      }
      if (data.materiales.length > 0 && transitoForm.cantidad === 0) {
        setTransitoForm((prev) => ({
          ...prev,
          id_proveedor: data.id_proveedor,
          id_material: data.materiales[0].id_material,
          fecha_eta: data.columnas_fechas[0] || "2026-09-01",
        }));
      }

      requestAnimationFrame(() => {
        if (tableContainerRef.current && currentScrollX > 0) {
          tableContainerRef.current.scrollLeft = currentScrollX;
        }
        if (topScrollRef.current && currentScrollX > 0) {
          topScrollRef.current.scrollLeft = currentScrollX;
        }
        if (currentScrollY > 0) {
          window.scrollTo({ top: currentScrollY, behavior: "instant" as ScrollBehavior });
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al consultar rundown";
      setErrorMsg(msg);
      if (!isSilent) setReport(null);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [selectedSupplierCode, alcance, selectedPeriodo, selectedSeccionId, transitoForm.cantidad]);

  useEffect(() => {
    if (activeSupplier?.tiene_parametros || selectedSupplierCode === "HOWA") {
      fetchRundown();
    } else {
      setReport(null);
      setLoading(false);
      setErrorMsg(null);
    }
  }, [selectedSupplierCode, activeSupplier, fetchRundown]);

  useEffect(() => {
    updateScrollWidth();
    const handleResize = () => updateScrollWidth();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateScrollWidth, report]);

  const handleTopScroll = () => {
    if (topScrollRef.current && tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleTableScroll = () => {
    if (topScrollRef.current && tableContainerRef.current) {
      topScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
    }
  };

  const { diasRojoActual, diasAmarilloActual } = useMemo(() => {
    if (alcance === "planta") {
      const dohPlanta = report?.doh_sugerido_planta || 1.5;
      return {
        diasRojoActual: 1.0,
        diasAmarilloActual: Math.max(1.5, dohPlanta),
      };
    }
    return {
      diasRojoActual: report?.dias_alerta_rojo ?? 5.0,
      diasAmarilloActual: report?.dias_alerta_amarillo ?? 15.0,
    };
  }, [alcance, report]);

  const riskPoints = useMemo(() => {
    if (!report) return [];
    const items: { materialId: string; fecha: string; diasCob: number; elementId: string }[] = [];
    for (const m of report.materiales) {
      for (const d of m.dias) {
        if (d.alerta_quiebre || d.dias_cobertura < diasRojoActual) {
          items.push({
            materialId: m.id_material,
            fecha: d.fecha,
            diasCob: d.dias_cobertura,
            elementId: `cell-risk-${m.id_material}-${d.fecha}`,
          });
        }
      }
    }
    return items.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [report, diasRojoActual]);

  const materialesEnRiesgoCount = useMemo(() => {
    if (!report) return 0;
    return report.materiales.filter((m) =>
      m.dias.some((d) => d.alerta_quiebre || d.dias_cobertura < diasRojoActual)
    ).length;
  }, [report, diasRojoActual]);

  const filteredMaterials = useMemo(() => {
    if (!report) return [];
    let list = report.materiales;
    if (filterSoloRiesgo) {
      list = list.filter((m) => m.dias.some((d) => d.alerta_quiebre || d.dias_cobertura < diasRojoActual));
      list = [...list].sort((a, b) => {
        const minA = a.dias.length > 0 ? Math.min(...a.dias.map((d) => d.dias_cobertura)) : 999;
        const minB = b.dias.length > 0 ? Math.min(...b.dias.map((d) => d.dias_cobertura)) : 999;
        return minA - minB;
      });
    }
    if (activeMaterialTab === "todos") return list;
    return list.filter((m) => m.id_material === activeMaterialTab);
  }, [report, activeMaterialTab, filterSoloRiesgo]);

  const kpis = useMemo(() => {
    if (!report) {
      return { totalDias: 0, totalAlertas: 0, quiebresCount: 0 };
    }
    const count = riskPoints.length;
    return {
      totalDias: report.columnas_fechas.length,
      totalAlertas: count,
      quiebresCount: count,
    };
  }, [report, riskPoints]);

  const handleJumpToRisk = () => {
    if (riskPoints.length === 0) {
      toast.info("No hay materiales con alerta de riesgo en este período.");
      return;
    }
    const idx = riskJumpIndex % riskPoints.length;
    const target = riskPoints[idx];
    setRiskJumpIndex(idx + 1);

    if (activeMaterialTab !== "todos" && activeMaterialTab !== target.materialId) {
      setActiveMaterialTab("todos");
    }

    setTimeout(() => {
      const el = document.getElementById(target.elementId);
      if (el) {
        el.scrollIntoView({ behavior: "auto", block: "center" });
        if (tableContainerRef.current) {
          const containerRect = tableContainerRef.current.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          const targetScrollLeft =
            tableContainerRef.current.scrollLeft +
            (elRect.left - containerRect.left) -
            containerRect.width / 2 +
            elRect.width / 2;
          const clampedScroll = Math.max(0, targetScrollLeft);
          tableContainerRef.current.scrollLeft = clampedScroll;
          if (topScrollRef.current) {
            topScrollRef.current.scrollLeft = clampedScroll;
          }
        }
        setHighlightedRiskId(target.elementId);
        setTimeout(() => setHighlightedRiskId(null), 3000);
      }
    }, 50);

    const diasTexto = target.diasCob < 900 ? `${target.diasCob.toFixed(1)}d` : "0d";
    toast.warning(
      `Alerta ${idx + 1} de ${riskPoints.length}: ${target.materialId} el ${target.fecha} (${diasTexto} de cobertura)`
    );
  };

  const handleOpenUmbralesModal = () => {
    if (!report) return;
    if (selectedSupplierCode === "TODOS") {
      toast.info("Para configurar el semáforo de un proveedor, selecciónelo individualmente en el filtro.");
      return;
    }
    setUmbralesForm({
      dias_rojo: report.dias_alerta_rojo ?? 5,
      dias_amarillo: report.dias_alerta_amarillo ?? 15,
    });
    setUmbralesModalOpen(true);
  };

  const handleSaveUmbrales = async () => {
    if (!report) return;
    if (umbralesForm.dias_rojo < 0 || umbralesForm.dias_amarillo <= umbralesForm.dias_rojo) {
      toast.error("El umbral amarillo debe ser mayor al umbral rojo");
      return;
    }
    setIsSavingUmbrales(true);
    try {
      await updateRundownProveedor(report.id_proveedor, {
        dias_alerta_rojo: umbralesForm.dias_rojo,
        dias_alerta_amarillo: umbralesForm.dias_amarillo,
      });
      toast.success(`Umbrales de semáforo actualizados para ${report.nombre_proveedor}`);
      setUmbralesModalOpen(false);
      await fetchRundown(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar umbrales de semáforo");
    } finally {
      setIsSavingUmbrales(false);
    }
  };

  const handleOpenTransito = (materialId?: string) => {
    if (!report) return;
    const targetMat = report.materiales.find((m) => m.id_material === materialId);
    const provId = targetMat?.id_proveedor || report.id_proveedor;
    setTransitoForm({
      id_proveedor: provId,
      id_material: materialId || (report.materiales[0]?.id_material ?? ""),
      fecha_eta: report.columnas_fechas[0] || "2026-09-01",
      tipo_via: "Maritimo",
      po_numero: "",
      factura_numero: "",
      cantidad: 0,
      observacion: "",
      estado: "planificado",
    });
    setTransitoModalOpen(true);
  };

  const handleSubmitTransito = async () => {
    if (transitoForm.cantidad === 0) {
      toast.error("Ingrese una cantidad válida mayor a 0");
      return;
    }
    setIsSavingTransito(true);
    try {
      const res = await createRundownTransito(transitoForm);
      toast.success(res.mensaje);
      setTransitoModalOpen(false);
      await fetchRundown();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al registrar arribo";
      toast.error(msg);
    } finally {
      setIsSavingTransito(false);
    }
  };

  const handleCellClickIngreso = (
    materialId: string,
    fechaEta: string,
    diaNombre: string,
    tipoVia: "Maritimo" | "Aereo" | "Local" | "AjusteScrap",
    currentVal: number,
    existingPo?: string | null,
    existingFactura?: string | null,
    existingObs?: string | null,
    existingEstado?: "planificado" | "confirmado" | null
  ) => {
    setIngresoEditForm({
      id_material: materialId,
      fecha_origen: fechaEta,
      fecha_eta: fechaEta,
      dia_nombre: diaNombre,
      tipo_via: tipoVia,
      cantidad: currentVal,
      po_numero: existingPo || "",
      factura_numero: existingFactura || "",
      observacion: existingObs || "",
      estado: existingEstado || "planificado",
    });
    setEditIngresoModalOpen(true);
  };

  const handleShiftDate = (days: number) => {
    if (!ingresoEditForm.fecha_eta) return;
    const [y, m, d] = ingresoEditForm.fecha_eta.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    const newY = dt.getFullYear();
    const newM = (dt.getMonth() + 1).toString().padStart(2, "0");
    const newD = dt.getDate().toString().padStart(2, "0");
    const newDateStr = `${newY}-${newM}-${newD}`;

    const mat = report?.materiales.find((m) => m.id_material === ingresoEditForm.id_material);
    const dayCell = mat?.dias.find((d) => d.fecha === newDateStr);
    const newDiaNombre = dayCell ? dayCell.dia_nombre : `${newD}/${newM}`;

    setIngresoEditForm((prev) => ({
      ...prev,
      fecha_eta: newDateStr,
      dia_nombre: newDiaNombre,
    }));
  };

  const handleDirectDateChange = (newDateStr: string) => {
    if (!newDateStr) return;
    const parts = newDateStr.split("-");
    if (parts.length !== 3) return;
    const [, newM, newD] = parts;
    const mat = report?.materiales.find((m) => m.id_material === ingresoEditForm.id_material);
    const dayCell = mat?.dias.find((d) => d.fecha === newDateStr);
    const newDiaNombre = dayCell ? dayCell.dia_nombre : `${newD}/${newM}`;

    setIngresoEditForm((prev) => ({
      ...prev,
      fecha_eta: newDateStr,
      dia_nombre: newDiaNombre,
    }));
  };

  const handleSubmitEditIngreso = async () => {
    if (!report) return;
    setIsSavingIngreso(true);
    try {
      const isShifted = ingresoEditForm.fecha_origen && ingresoEditForm.fecha_origen !== ingresoEditForm.fecha_eta;
      const provId = report.materiales.find((m) => m.id_material === ingresoEditForm.id_material)?.id_proveedor || report.id_proveedor;
      await upsertRundownIngresoDia({
        id_proveedor: provId,
        id_material: ingresoEditForm.id_material,
        fecha_eta: ingresoEditForm.fecha_eta,
        tipo_via: ingresoEditForm.tipo_via,
        cantidad: ingresoEditForm.cantidad,
        po_numero: ingresoEditForm.po_numero.trim() || undefined,
        factura_numero: ingresoEditForm.factura_numero.trim() || undefined,
        observacion: ingresoEditForm.observacion.trim() || undefined,
        fecha_origen: isShifted ? ingresoEditForm.fecha_origen : undefined,
        estado: ingresoEditForm.estado,
      });
      toast.success(
        isShifted
          ? `Pedido desplazado del ${ingresoEditForm.fecha_origen} al ${ingresoEditForm.fecha_eta}`
          : "Ingreso actualizado correctamente"
      );
      setEditIngresoModalOpen(false);
      await fetchRundown(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar ingreso");
    } finally {
      setIsSavingIngreso(false);
    }
  };

  const handleRequestDeleteIngreso = () => {
    if (!report) return;
    setConfirmDelete({
      isOpen: true,
      title: "¿Eliminar pedido / arribo?",
      description: `¿Está seguro de que desea eliminar el pedido de ${ingresoEditForm.cantidad.toLocaleString("es-AR")} mts (${ingresoEditForm.tipo_via}) para el día ${ingresoEditForm.fecha_eta}?\n\nEsta acción descontará el volumen del stock proyectado inmediatamente.`,
      actionText: "Sí, eliminar pedido",
      onConfirm: async () => {
        try {
          const provId = report.materiales.find((m) => m.id_material === ingresoEditForm.id_material)?.id_proveedor || report.id_proveedor;
          await upsertRundownIngresoDia({
            id_proveedor: provId,
            id_material: ingresoEditForm.id_material,
            fecha_eta: ingresoEditForm.fecha_eta,
            tipo_via: ingresoEditForm.tipo_via,
            cantidad: 0,
          });
          if (ingresoEditForm.fecha_origen && ingresoEditForm.fecha_origen !== ingresoEditForm.fecha_eta) {
            await upsertRundownIngresoDia({
              id_proveedor: provId,
              id_material: ingresoEditForm.id_material,
              fecha_eta: ingresoEditForm.fecha_origen,
              tipo_via: ingresoEditForm.tipo_via,
              cantidad: 0,
            });
          }
          toast.success("Pedido eliminado correctamente");
          setEditIngresoModalOpen(false);
          await fetchRundown(true);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Error al eliminar pedido");
        }
      },
    });
  };

  const handleDropPedido = async (
    targetMaterialId: string,
    targetFecha: string,
    targetTipoVia?: "Maritimo" | "Aereo" | "Local" | "AjusteScrap"
  ) => {
    if (!report || !draggedPedido) return;
    if (
      draggedPedido.id_material !== targetMaterialId ||
      draggedPedido.fecha_origen === targetFecha ||
      (targetTipoVia && alcance === "total" && draggedPedido.tipo_via !== targetTipoVia)
    ) {
      setDraggedPedido(null);
      setDragOverCell(null);
      return;
    }

    const { id_material, fecha_origen, tipo_via, cantidad } = draggedPedido;
    const currentScrollX = tableContainerRef.current?.scrollLeft || 0;
    const currentScrollY = window.scrollY;

    setDraggedPedido(null);
    setDragOverCell(null);

    // Optimistic UI update immediately in memory
    setReport((prevReport) => {
      if (!prevReport) return prevReport;
      return {
        ...prevReport,
        materiales: prevReport.materiales.map((m) => {
          if (m.id_material !== id_material) return m;
          const newDias = m.dias.map((d) => {
            let pMar = d.plan_maritimo;
            let pAer = d.pedidos_aereos;
            let pLoc = d.entregas_locales || 0;

            if (d.fecha === fecha_origen) {
              if (tipo_via === "Local") {
                pLoc = Math.max(0, pLoc - cantidad);
              } else {
                const subMar = Math.min(pMar, cantidad);
                pMar -= subMar;
                const rem = cantidad - subMar;
                if (rem > 0) pAer = Math.max(0, pAer - rem);
              }
            }
            if (d.fecha === targetFecha) {
              if (tipo_via === "Aereo") {
                pAer += cantidad;
              } else if (tipo_via === "Local") {
                pLoc += cantidad;
              } else {
                pMar += cantidad;
              }
            }
            return {
              ...d,
              plan_maritimo: pMar,
              pedidos_aereos: pAer,
              entregas_locales: pLoc,
            };
          });

          let runningStock = alcance === "planta" ? m.stock_inicial_planta : m.stock_inicial_total;
          let lastDiasCob = 0;
          const recalculatedDias = newDias.map((d) => {
            if (d.tiene_ajuste) {
              runningStock = d.stock_final;
            } else {
              runningStock = Math.round(
                runningStock - d.uso + (d.plan_maritimo + d.pedidos_aereos + d.entregas_locales) - d.ajuste_scrap
              );
            }
            let diasCob = 0;
            if (d.uso > 0) {
              diasCob = Math.round((runningStock / d.uso) * 100) / 100;
              lastDiasCob = diasCob;
            } else if (runningStock > 0) {
              diasCob = lastDiasCob;
            }
            return {
              ...d,
              stock_final: runningStock,
              dias_cobertura: diasCob,
              alerta_quiebre: diasCob < 5 || runningStock <= 0,
            };
          });

          return {
            ...m,
            dias: recalculatedDias,
          };
        }),
      };
    });

    try {
      const provId = report.materiales.find((m) => m.id_material === id_material)?.id_proveedor || report.id_proveedor;
      await upsertRundownIngresoDia({
        id_proveedor: provId,
        id_material,
        fecha_eta: targetFecha,
        tipo_via,
        cantidad,
        fecha_origen,
      });
      toast.success(`Pedido desplazado del ${fecha_origen} al ${targetFecha}`);
      await fetchRundown(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al desplazar pedido");
      await fetchRundown(true);
    } finally {
      requestAnimationFrame(() => {
        if (tableContainerRef.current && currentScrollX > 0) {
          tableContainerRef.current.scrollLeft = currentScrollX;
        }
        if (topScrollRef.current && currentScrollX > 0) {
          topScrollRef.current.scrollLeft = currentScrollX;
        }
        if (currentScrollY > 0) {
          window.scrollTo({ top: currentScrollY, behavior: "instant" as ScrollBehavior });
        }
      });
    }
  };

  const handleOpenStockModal = (mat: RundownMaterialGrid, targetFecha?: string) => {
    if (!report) return;
    const fechaToUse = targetFecha || report.columnas_fechas[0] || "";
    const dayCell = mat.dias.find((d) => d.fecha === fechaToUse);
    const initialVal = dayCell
      ? Math.round(dayCell.stock_final)
      : alcance === "planta"
        ? Math.round(mat.stock_inicial_planta)
        : Math.round(mat.stock_inicial_total);

    const provId = mat.id_proveedor || report.id_proveedor;
    setStockForm({
      id_parametro: mat.id_parametro,
      id_proveedor: provId,
      id_material: mat.id_material,
      fecha: fechaToUse,
      material_label: `${mat.id_material} — ${mat.descripcion}`,
      stock_inicial: initialVal,
      tipo_stock: alcance,
      observacion: "",
    });
    setStockModalOpen(true);
  };

  const handleSubmitStock = async () => {
    if (stockForm.stock_inicial < 0) {
      toast.error("El stock no puede ser negativo");
      return;
    }
    if (!stockForm.fecha) {
      toast.error("Debe seleccionar una fecha para el stock");
      return;
    }
    setIsSavingStock(true);
    try {
      const res = await updateRundownStockAjuste({
        id_parametro: stockForm.id_parametro,
        id_proveedor: stockForm.id_proveedor,
        id_material: stockForm.id_material,
        fecha: stockForm.fecha,
        tipo_stock: stockForm.tipo_stock,
        stock_ajustado: Math.round(stockForm.stock_inicial),
        observacion: stockForm.observacion.trim() || undefined,
      });
      toast.success(res.mensaje);
      setStockModalOpen(false);
      await fetchRundown(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al actualizar stock";
      toast.error(msg);
    } finally {
      setIsSavingStock(false);
    }
  };

  const handleRequestDeleteStockAjuste = () => {
    setConfirmDelete({
      isOpen: true,
      title: "¿Eliminar ajuste de stock?",
      description: `¿Está seguro de que desea eliminar el ajuste de stock del día ${stockForm.fecha} para ${stockForm.material_label}?\n\nEl stock volverá a calcularse de forma teórica automáticamente a partir de los consumos y arribos.`,
      actionText: "Sí, eliminar ajuste",
      onConfirm: async () => {
        try {
          await deleteRundownStockAjuste(
            stockForm.id_parametro,
            stockForm.fecha,
            stockForm.tipo_stock
          );
          toast.success("Ajuste de stock eliminado correctamente");
          setStockModalOpen(false);
          await fetchRundown(true);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Error al eliminar ajuste de stock");
        }
      },
    });
  };

  const handleOpenScrapModal = (mat: RundownMaterialGrid) => {
    setScrapTargetMat(mat);
    setScrapInputVal((mat.scrap_porcentaje * 100).toFixed(1));
    setScrapModalOpen(true);
  };

  const handleSubmitScrap = async () => {
    if (!scrapTargetMat) return;
    const parsed = parseFloat(scrapInputVal.replace(",", "."));
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      toast.error("Ingrese un porcentaje de scrap válido entre 0% y 100%");
      return;
    }
    setSavingScrap(true);
    try {
      const res = await updateRundownScrap(scrapTargetMat.id_parametro, parsed / 100);
      toast.success(res.mensaje);
      setScrapModalOpen(false);
      await fetchRundown(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al actualizar scrap";
      toast.error(msg);
    } finally {
      setSavingScrap(false);
    }
  };

  const handleCreateSeccion = async () => {
    if (!newSeccionForm.nombre.trim()) {
      toast.error("El nombre de la línea es obligatorio");
      return;
    }
    const cod = newSeccionForm.codigo.trim() || newSeccionForm.nombre.trim().toUpperCase().replace(/\s+/g, "_");
    setIsSavingAdmin(true);
    try {
      await createRundownSeccion({
        codigo: cod,
        nombre: newSeccionForm.nombre.trim(),
        descripcion: newSeccionForm.descripcion.trim() || undefined,
      });
      toast.success("Línea creada correctamente");
      setNewSeccionForm({ codigo: "", nombre: "", descripcion: "" });
      await fetchSecciones();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear línea");
    } finally {
      setIsSavingAdmin(false);
    }
  };

  const handleCreateProveedor = async () => {
    if (!newProvForm.nombre.trim()) {
      toast.error("El nombre del proveedor es obligatorio");
      return;
    }
    const cod = newProvForm.codigo_proveedor.trim() || newProvForm.nombre.trim().toUpperCase().replace(/\s+/g, "_");
    setIsSavingAdmin(true);
    try {
      await createRundownProveedor({
        codigo_proveedor: cod,
        nombre: newProvForm.nombre.trim().toUpperCase(),
        id_seccion: newProvForm.id_seccion > 0 ? newProvForm.id_seccion : (selectedSeccionId || undefined),
        deposito_en_planta: newProvForm.deposito_en_planta,
      });
      toast.success("Proveedor registrado correctamente");
      setNewProvForm({ codigo_proveedor: "", nombre: "", id_seccion: selectedSeccionId, deposito_en_planta: false });
      await fetchSecciones();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar proveedor");
    } finally {
      setIsSavingAdmin(false);
    }
  };

  const handleToggleDepositoEnPlanta = async (prov: RundownProveedorItem) => {
    const nextVal = !prov.deposito_en_planta;
    try {
      await updateRundownProveedor(prov.id_proveedor, { deposito_en_planta: nextVal });
      toast.success(
        nextVal
          ? `Depósito unificado en Planta para ${prov.nombre}`
          : `Depósito CL2 habilitado para ${prov.nombre}`
      );
      await fetchSecciones();
      if (selectedSupplierCode === prov.codigo_proveedor) {
        await fetchRundown(true);
      }
    } catch {
      toast.error("Error al actualizar configuración de depósito");
    }
  };

  const handleReassignProveedor = async (idProveedor: number, newSeccionId: number) => {
    try {
      await updateRundownProveedor(idProveedor, { id_seccion: newSeccionId });
      toast.success("Línea del proveedor actualizada");
      await fetchSecciones();
    } catch {
      toast.error("Error al reasignar proveedor");
    }
  };

  const handleOpenEditProveedor = (prov: RundownProveedorItem) => {
    setEditProvForm({
      id_proveedor: prov.id_proveedor,
      codigo_proveedor: prov.codigo_proveedor,
      nombre: prov.nombre,
      id_seccion: prov.id_seccion,
      deposito_en_planta: Boolean(prov.deposito_en_planta),
      dias_alerta_rojo: prov.dias_alerta_rojo ?? 5,
      dias_alerta_amarillo: prov.dias_alerta_amarillo ?? 15,
      doh_sugerido_planta: prov.doh_sugerido_planta ?? 1.0,
      activo: prov.activo,
    });
    setEditProvModalOpen(true);
  };

  const handleSubmitEditProveedor = async () => {
    if (!editProvForm.id_proveedor) return;
    if (!editProvForm.nombre.trim()) {
      toast.error("El nombre del proveedor no puede estar vacío");
      return;
    }
    if (editProvForm.dias_alerta_amarillo <= editProvForm.dias_alerta_rojo) {
      toast.error("El umbral amarillo debe ser mayor que el umbral rojo");
      return;
    }
    setIsSavingEditProv(true);
    try {
      await updateRundownProveedor(editProvForm.id_proveedor, {
        nombre: editProvForm.nombre.trim(),
        id_seccion: editProvForm.id_seccion,
        deposito_en_planta: editProvForm.deposito_en_planta,
        dias_alerta_rojo: Number(editProvForm.dias_alerta_rojo),
        dias_alerta_amarillo: Number(editProvForm.dias_alerta_amarillo),
        doh_sugerido_planta: Number(editProvForm.doh_sugerido_planta),
        activo: editProvForm.activo,
      });
      toast.success("Proveedor actualizado correctamente");
      setEditProvModalOpen(false);
      await fetchSecciones();
      if (selectedSupplierCode === editProvForm.codigo_proveedor) {
        await fetchRundown(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar proveedor");
    } finally {
      setIsSavingEditProv(false);
    }
  };

  const fetchProvMateriales = useCallback(async (idProv: number) => {
    if (!idProv) return;
    setLoadingProvMateriales(true);
    try {
      const list = await getProveedorMateriales(idProv);
      setProvMaterialesList(list);
    } catch {
      toast.error("Error al cargar materiales del proveedor");
    } finally {
      setLoadingProvMateriales(false);
    }
  }, []);

  const handleSearchCatalogo = async (query: string) => {
    setCatalogoSearchQuery(query);
    if (!query.trim()) {
      setCatalogoSearchResults([]);
      return;
    }
    setIsSearchingCatalogo(true);
    try {
      const res = await searchMaterialesCatalogo(query.trim());
      setCatalogoSearchResults(res);
    } catch {
      toast.error("Error al buscar en catálogo de materiales");
    } finally {
      setIsSearchingCatalogo(false);
    }
  };

  const handleSelectCatalogoItem = (item: MaterialCatalogoItem) => {
    const isDepPlanta = Boolean(item.deposito_en_planta);
    const stPlanta = item.stock_planta ?? 0;
    const stCl2 = isDepPlanta ? 0 : (item.stock_cl2 ?? 0);
    const stTotal = item.stock_total ?? (stPlanta + stCl2);

    setNewMaterialForm((prev) => ({
      ...prev,
      id_material: item.id_material,
      descripcion: item.nombre || item.id_material,
      unidad: item.unidad || "MTS",
      lote_mts: item.tamanio_lote && item.tamanio_lote > 0 ? item.tamanio_lote : prev.lote_mts,
      stock_inicial_planta: stPlanta,
      stock_inicial_total: stTotal,
    }));
    if (item.id_proveedor) {
      setAdminMaterialProvId(item.id_proveedor);
      fetchProvMateriales(item.id_proveedor);
    }
    setCatalogoSearchResults([]);
    setCatalogoSearchQuery(item.id_material);
  };

  const handleMaterialCodeLookup = useCallback(async (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;
    try {
      const mat = await getMaterialCatalogoInfo(cleanCode);
      if (mat) {
        const isDepPlanta = Boolean(mat.deposito_en_planta);
        const stPlanta = mat.stock_planta ?? 0;
        const stCl2 = isDepPlanta ? 0 : (mat.stock_cl2 ?? 0);
        const stTotal = mat.stock_total ?? (stPlanta + stCl2);

        setNewMaterialForm((prev) => ({
          ...prev,
          id_material: mat.id_material,
          descripcion: mat.nombre || prev.descripcion,
          unidad: mat.unidad || prev.unidad || "MTS",
          lote_mts: mat.tamanio_lote && mat.tamanio_lote > 0 ? mat.tamanio_lote : prev.lote_mts,
          stock_inicial_planta: stPlanta,
          stock_inicial_total: stTotal,
        }));
        if (mat.id_proveedor) {
          setAdminMaterialProvId(mat.id_proveedor);
          fetchProvMateriales(mat.id_proveedor);
        }
      }
    } catch {
      // Ignorar si no existe
    }
  }, [fetchProvMateriales]);

  useEffect(() => {
    const code = newMaterialForm.id_material.trim();
    if (!code || code.length < 3) return;
    const timer = setTimeout(() => {
      handleMaterialCodeLookup(code);
    }, 450);
    return () => clearTimeout(timer);
  }, [newMaterialForm.id_material, handleMaterialCodeLookup]);

  const handleAddMaterialToProveedor = async () => {
    if (!adminMaterialProvId) {
      toast.error("Seleccione un proveedor");
      return;
    }
    if (!newMaterialForm.id_material.trim()) {
      toast.error("Ingrese el código del material");
      return;
    }
    setIsAddingMaterial(true);
    try {
      const res = await addProveedorMaterial(adminMaterialProvId, {
        id_material: newMaterialForm.id_material.trim().toUpperCase(),
        descripcion: newMaterialForm.descripcion.trim(),
        unidad: newMaterialForm.unidad.trim() || "MTS",
        lote_mts: newMaterialForm.lote_mts,
        scrap_porcentaje: newMaterialForm.scrap_porcentaje / 100,
        stock_inicial_planta: Math.round(newMaterialForm.stock_inicial_planta),
        stock_inicial_total: Math.round(newMaterialForm.stock_inicial_total),
      });
      toast.success(res.mensaje);
      setNewMaterialForm({
        id_material: "",
        descripcion: "",
        unidad: "MTS",
        lote_mts: 0,
        scrap_porcentaje: 0,
        stock_inicial_planta: 0,
        stock_inicial_total: 0,
      });
      setCatalogoSearchQuery("");
      await fetchProvMateriales(adminMaterialProvId);
      await fetchSecciones();
      if (activeSupplier && activeSupplier.id_proveedor === adminMaterialProvId) {
        await fetchRundown();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al agregar material";
      toast.error(msg);
    } finally {
      setIsAddingMaterial(false);
    }
  };

  const handleDeleteMaterialParam = async (idParametro: number) => {
    if (!confirm("¿Confirma que desea eliminar este material del Rundown de este proveedor?")) return;
    try {
      await deleteProveedorMaterial(adminMaterialProvId, idParametro);
      toast.success("Material eliminado del Rundown");
      await fetchProvMateriales(adminMaterialProvId);
      await fetchSecciones();
      if (activeSupplier && activeSupplier.id_proveedor === adminMaterialProvId) {
        await fetchRundown();
      }
    } catch {
      toast.error("Error al eliminar material");
    }
  };

  const handleSaveLoteMaterial = async () => {
    if (!editingLoteMaterial) return;
    setIsSavingLoteMaterial(true);
    try {
      await updateLoteMaterial({
        id_parametro: editingLoteMaterial.id_parametro,
        lote_mts: editingLoteMaterial.lote_mts,
        tipo_empaque: editingLoteMaterial.tipo_empaque,
      });
      toast.success(`Lote de ${editingLoteMaterial.id_material} actualizado correctamente`);
      setLoteMaterialModalOpen(false);
      if (adminMaterialProvId) {
        await fetchProvMateriales(adminMaterialProvId);
      }
      if (activeSupplier) {
        await fetchRundown();
      }
    } catch {
      toast.error("Error al actualizar lote del material");
    } finally {
      setIsSavingLoteMaterial(false);
    }
  };

  const handleOpenAdminMateriales = (idProv?: number) => {
    const targetId = idProv || activeSupplier?.id_proveedor || (secciones[0]?.proveedores[0]?.id_proveedor ?? 0);
    setAdminMaterialProvId(targetId);
    setAdminTab("materiales");
    setAdminModalOpen(true);
    if (targetId) {
      fetchProvMateriales(targetId);
    }
  };

  const fetchPeriodosProyeccion = useCallback(async () => {
    setLoadingProyecciones(true);
    try {
      const data = await getPeriodosProyeccion();
      setPeriodosProyeccion(data);
    } catch {
      toast.error("Error al cargar períodos de proyección");
    } finally {
      setLoadingProyecciones(false);
    }
  }, []);

  const handleOpenHorizonteModal = () => {
    let nextAnio = 2027;
    let nextMes = 3;
    let baseCopia = "2027-02";

    if (report && report.meses_disponibles.length > 0) {
      const last = report.meses_disponibles[report.meses_disponibles.length - 1];
      baseCopia = last.periodo;
      if (last.mes === 12) {
        nextAnio = last.anio + 1;
        nextMes = 1;
      } else {
        nextAnio = last.anio;
        nextMes = last.mes + 1;
      }
    }

    setNewProyeccionForm({
      anio: nextAnio,
      mes: nextMes,
      periodo_copia: baseCopia,
      observacion: "",
    });
    fetchPeriodosProyeccion();
    setHorizonteModalOpen(true);
  };

  const handleCreateProyeccion = async () => {
    setIsSavingProyeccion(true);
    try {
      const res = await createPeriodoProyeccion(newProyeccionForm);
      toast.success(res.mensaje);
      await fetchPeriodosProyeccion();
      await fetchRundown();
      setSelectedPeriodo(`${newProyeccionForm.anio}-${newProyeccionForm.mes.toString().padStart(2, "0")}`);
      setHorizonteModalOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al agregar proyección";
      toast.error(msg);
    } finally {
      setIsSavingProyeccion(false);
    }
  };

  const handleDeleteProyeccion = async (idProyeccion: number) => {
    if (!confirm("¿Confirma que desea eliminar este mes extendido del horizonte?")) return;
    try {
      await deletePeriodoProyeccion(idProyeccion);
      toast.success("Mes de proyección eliminado");
      await fetchPeriodosProyeccion();
      await fetchRundown();
    } catch {
      toast.error("Error al eliminar mes de proyección");
    }
  };

  const handleOpenCalendarioModal = useCallback((anio?: number, mes?: number) => {
    let targetAnio = anio;
    let targetMes = mes;
    if (!targetAnio || !targetMes) {
      if (selectedPeriodo) {
        const parts = selectedPeriodo.split("-").map(Number);
        targetAnio = parts[0];
        targetMes = parts[1];
      } else {
        targetAnio = 2026;
        targetMes = 10;
      }
    }
    setCalSelectedAnio(targetAnio);
    setCalSelectedMes(targetMes);
    setCalModalOpen(true);
  }, [selectedPeriodo]);

  const handleOpenPlanSemanalModal = () => {
    setPlanFile(null);
    setPlanPreview(null);
    setPlanOverrideFecha("");
    setPlanModalOpen(true);
  };

  const executePlanPreview = async (file: File, overrideFecha?: string) => {
    if (!selectedSeccionId) {
      toast.error("Seleccione una línea");
      return;
    }
    setPlanLoading(true);
    try {
      const preview = await previewPlanSemanal(selectedSeccionId, file, overrideFecha || undefined);
      setPlanPreview(preview);
      if (!overrideFecha) {
        setPlanOverrideFecha(preview.fecha_inicio);
      }
      toast.success(`Plan analizado: ${preview.filas.length} SDs identificados`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al previsualizar plan semanal";
      toast.error(msg);
      setPlanPreview(null);
    } finally {
      setPlanLoading(false);
    }
  };

  const handlePlanFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPlanFile(file);
    await executePlanPreview(file, planOverrideFecha);
  };

  const handleConfirmPlan = async () => {
    if (!planPreview || !selectedSeccionId) return;
    setPlanSaving(true);
    try {
      const items: PlanSemanalItemConfirm[] = [];
      for (const f of planPreview.filas) {
        if (f.mapeado && f.id_producto) {
          for (const [diaStr, cant] of Object.entries(f.cantidades)) {
            items.push({
              sd: f.sd,
              id_producto: f.id_producto,
              fecha: diaStr,
              cantidad: cant,
            });
          }
        }
      }

      const res = await confirmPlanSemanal(selectedSeccionId, {
        fecha_inicio: planPreview.fecha_inicio,
        fecha_fin: planPreview.fecha_fin,
        items,
      });

      toast.success(res.mensaje);
      setPlanModalOpen(false);
      await fetchRundown(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al guardar el plan semanal";
      toast.error(msg);
    } finally {
      setPlanSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-full">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Rundown Vivo
            </h1>
            <div className="inline-flex rounded-lg border bg-slate-100 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setAlcance("planta")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${alcance === "planta"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                <Warehouse className="w-3.5 h-3.5 text-blue-600" />
                <span>Rundown Warehouse</span>
              </button>
              <button
                type="button"
                onClick={() => setAlcance("total")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${alcance === "total"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                <Globe2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Rundown TBAR</span>
              </button>
            </div>
            {activeSupplier?.deposito_en_planta && (
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[11px] font-medium py-0.5">
                Depósito en Planta (Stock Unificado)
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {activeSupplier?.deposito_en_planta
              ? "Depósito unificado en Planta: el inventario y consumos aplican directamente en planta sin stock intermedio CL2."
              : alcance === "planta"
                ? "Rundown Warehouse / CL2: Planificación para abastecimiento y seguimiento de inventario operativo en planta y reposición desde CL2."
                : "Rundown TBAR: Planificación de suministro y compras al Proveedor (contempla stock total consolidado)."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => handleOpenTransito()}
            disabled={!report}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Arribo / PO</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenPlanSemanalModal}
            className="flex items-center gap-1.5 text-indigo-700 hover:text-indigo-900 border-indigo-300 hover:bg-indigo-50 shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
            <span>Plan Semanal de Línea</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const [a, m] = (selectedPeriodo || "2026-10").split("-").map(Number);
              handleOpenCalendarioModal(a, m);
            }}
            className="flex items-center gap-1.5 text-slate-700 hover:text-slate-900 border-slate-300 shadow-xs"
          >
            <CalendarDays className="w-4 h-4 text-blue-600" />
            <span>Calendario Productivo</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdminModalOpen(true)}
            className="flex items-center gap-1.5 text-slate-700 hover:text-slate-900"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span>Configurar Rundown</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchRundown}
            disabled={loading || !activeSupplier?.tiene_parametros}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : "text-slate-600"}`} />
            <span>Actualizar</span>
          </Button>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Línea:
            </span>
            <Select
              value={String(selectedSeccionId)}
              onValueChange={(val) => {
                const secId = Number(val);
                setSelectedSeccionId(secId);
                const targetSec = secciones.find((s) => s.id_seccion === secId);
                if (targetSec && targetSec.proveedores.length > 0) {
                  const hasHowa = targetSec.proveedores.find((p) => p.codigo_proveedor === "HOWA");
                  setSelectedSupplierCode(hasHowa ? "HOWA" : targetSec.proveedores[0].codigo_proveedor);
                } else {
                  setSelectedSupplierCode("");
                }
              }}
            >
              <SelectTrigger className="h-8 w-44 text-xs font-medium bg-slate-50/50 border-slate-300">
                <SelectValue placeholder="Seleccionar Línea" />
              </SelectTrigger>
              <SelectContent>
                {secciones.map((sec) => (
                  <SelectItem key={sec.id_seccion} value={String(sec.id_seccion)} className="text-xs">
                    {sec.nombre} ({sec.proveedores.length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Proveedor:
            </span>
            {activeSeccion && activeSeccion.proveedores.length > 0 ? (
              <Select
                value={selectedSupplierCode}
                onValueChange={(val) => setSelectedSupplierCode(val)}
              >
                <SelectTrigger className="h-8 w-48 text-xs font-mono font-medium bg-slate-50/50 border-slate-300">
                  <SelectValue placeholder="Seleccionar Proveedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS" className="text-xs font-mono font-semibold">
                    <div className="flex items-center justify-between w-full gap-2">
                      <span>★ Todos los proveedores</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({activeSeccion.proveedores.length})
                      </span>
                    </div>
                  </SelectItem>
                  {activeSeccion.proveedores.map((prov) => (
                    <SelectItem key={prov.id_proveedor} value={prov.codigo_proveedor} className="text-xs font-mono">
                      <div className="flex items-center justify-between w-full gap-2">
                        <span>{prov.nombre}</span>
                        {prov.tiene_parametros && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Rundown activo" />
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-xs text-slate-400 italic">
                Sin proveedores en esta línea
              </span>
            )}
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {report && report.meses_disponibles && report.meses_disponibles.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Período:
              </span>
              <Select
                value={selectedPeriodo}
                onValueChange={(val) => setSelectedPeriodo(val)}
              >
                <SelectTrigger className="h-8 w-60 text-xs font-medium bg-slate-50/50 border-slate-300">
                  <SelectValue placeholder="Seleccionar Período" />
                </SelectTrigger>
                <SelectContent className="min-w-[15rem]">
                  {report.meses_disponibles.map((p) => (
                    <SelectItem key={p.periodo} value={p.periodo} className="text-xs">
                      <div className="flex items-center justify-between w-full gap-2">
                        <span>{p.label}</span>
                        {p.es_firme ? (
                          <Badge className="bg-emerald-600 text-white text-[9px] px-1 py-0 h-4">Firme</Badge>
                        ) : p.es_finalizado ? (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-slate-300 bg-slate-100 text-slate-500 font-normal">Finalizado</Badge>
                        ) : p.es_proyectado_manual ? (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-purple-300 bg-purple-50 text-purple-700">Extendido</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-slate-300 text-slate-500">Proy.</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                size="sm"
                variant="outline"
                onClick={handleOpenHorizonteModal}
                className="text-xs h-8 text-indigo-700 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/70"
                title="Extender horizonte de meses futuros"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>Extender Meses</span>
              </Button>
            </div>
          )}
        </div>

        {report && !report.es_mes_firme && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[11px] bg-blue-50 text-blue-700 border-blue-200 font-medium">
              <CalendarDays className="w-3.5 h-3.5 mr-1 text-blue-600" />
              {report.dias_laborales_mes} días laborales
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const [a, m] = (selectedPeriodo || "2026-10").split("-").map(Number);
                handleOpenCalendarioModal(a, m);
              }}
              className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 font-medium"
            >
              Editar días
            </Button>
          </div>
        )}
      </div>

      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Proveedor</p>
                <h3 className="text-base font-bold text-slate-900 truncate">
                  {selectedSupplierCode === "TODOS" ? "Todos los Proveedores" : report.nombre_proveedor}
                </h3>
                <p className="text-[11px] text-slate-400">Línea: {activeSeccion?.nombre || "Headliner"}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Horizonte Temporal</p>
                <h3 className="text-base font-bold text-slate-900">
                  {kpis.totalDias} días programados
                </h3>
                <p className="text-[11px] text-slate-400">
                  {report.fecha_desde} al {report.fecha_hasta}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            onClick={kpis.quiebresCount > 0 ? handleJumpToRisk : undefined}
            className={`border shadow-sm transition-all select-none ${kpis.quiebresCount > 0
                ? "border-red-300 bg-red-50/30 hover:bg-red-50/60 cursor-pointer hover:shadow-md"
                : ""
              }`}
            title={kpis.quiebresCount > 0 ? "Haz clic para ir a la próxima celda en riesgo" : undefined}
          >
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${kpis.quiebresCount > 0 ? "bg-red-100 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
                  {kpis.quiebresCount > 0 ? <AlertTriangle className="w-5 h-5 animate-pulse" /> : <PackageCheck className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Alertas de Cobertura</p>
                  <div className="flex items-center gap-2">
                    <h3 className={`text-base font-bold ${kpis.quiebresCount > 0 ? "text-red-700" : "text-emerald-700"}`}>
                      {kpis.quiebresCount} {kpis.quiebresCount === 1 ? "día en riesgo" : "días en riesgo"}
                    </h3>
                    <Badge className={kpis.quiebresCount > 0 ? "bg-red-600 text-white text-[10px] px-1.5 py-0" : "bg-emerald-600 text-white text-[10px] px-1.5 py-0"}>
                      {`< ${diasRojoActual}d`}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {kpis.quiebresCount > 0 ? "Clic para saltar a celda crítica" : "Sin alertas en el período"}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenUmbralesModal();
                }}
                className="h-8 px-2 text-xs text-slate-600 hover:text-slate-900 border-slate-300 gap-1 shrink-0 bg-white"
                title="Configurar semáforo de días de cobertura"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden xl:inline">Semáforo</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {report && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 border rounded-lg shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <Button
              size="sm"
              variant={activeMaterialTab === "todos" && !filterSoloRiesgo ? "default" : "outline"}
              onClick={() => {
                setActiveMaterialTab("todos");
                setFilterSoloRiesgo(false);
              }}
              className="text-xs h-8"
            >
              Todas ({report.materiales.length})
            </Button>
            {materialesEnRiesgoCount > 0 && (
              <Button
                size="sm"
                variant={filterSoloRiesgo ? "destructive" : "outline"}
                onClick={() => setFilterSoloRiesgo(!filterSoloRiesgo)}
                className={`text-xs h-8 gap-1.5 ${filterSoloRiesgo
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "text-red-700 border-red-300 hover:bg-red-50"
                  }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <span>Solo en Riesgo ({materialesEnRiesgoCount})</span>
              </Button>
            )}
            {report.materiales.map((m) => (
              <Button
                key={m.id_material}
                size="sm"
                variant={activeMaterialTab === m.id_material && !filterSoloRiesgo ? "default" : "outline"}
                onClick={() => {
                  setActiveMaterialTab(m.id_material);
                  setFilterSoloRiesgo(false);
                }}
                className="text-xs h-8 font-mono"
              >
                {m.id_material}
              </Button>
            ))}
          </div>
        </div>
      )}

      {loading && !report ? (
        <Card className="p-12 text-center text-slate-500 border">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
          <p className="font-medium text-slate-700">Calculando proyección y cobertura de stock para {selectedSupplierCode}...</p>
          <p className="text-xs text-slate-400 mt-1">Consultando producción planificada y tránsitos en SQL Server</p>
        </Card>
      ) : !report ? (
        <Card className="p-12 text-center border bg-slate-50/50">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-slate-400" />
          <h3 className="text-base font-bold text-slate-800">
            {activeSupplier ? activeSupplier.nombre : selectedSupplierCode}
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Este proveedor está registrado en la línea <strong>{activeSeccion?.nombre}</strong>. Sus recetas de consumo y materiales aún no han sido configurados en el sistema.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              size="sm"
              onClick={() => handleOpenAdminMateriales(activeSupplier?.id_proveedor)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Configurar Materiales para {activeSupplier ? activeSupplier.nombre : selectedSupplierCode}
            </Button>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            O seleccione <strong>HOWA</strong> para visualizar el Rundown activo de Headliner.
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          <div
            ref={topScrollRef}
            onScroll={handleTopScroll}
            className="overflow-x-auto h-3 border-t border-b border-slate-200 bg-slate-100/70 rounded"
          >
            <div style={{ width: `${scrollWidth}px`, height: "1px" }} />
          </div>

          <div
            ref={tableContainerRef}
            onScroll={handleTableScroll}
            className="overflow-x-auto border rounded-xl shadow-sm bg-white"
          >
            <div className="min-w-max">
              {filteredMaterials.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-xl space-y-3 min-w-[600px] mx-auto">
                  <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
                  <p className="text-sm font-semibold text-slate-800">
                    {filterSoloRiesgo
                      ? `No se detectaron materiales con riesgo de cobertura (menor a ${diasRojoActual} días) para ${activeSupplier?.nombre || selectedSupplierCode} en Rundown ${alcance === "planta" ? "Planta" : "TBAR"}`
                      : "No hay materiales para mostrar con el filtro actual"}
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    El stock actual se encuentra por encima del umbral de alerta en el período consultado.
                  </p>
                  {filterSoloRiesgo && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setFilterSoloRiesgo(false);
                        setActiveMaterialTab("todos");
                      }}
                      className="text-xs mt-2"
                    >
                      Ver todos los materiales ({report.materiales.length})
                    </Button>
                  )}
                </div>
              ) : (
                filteredMaterials.map((mat, idx) => (
                  <div key={mat.id_material} className={`p-0 ${idx > 0 ? "border-t-4 border-[oklch(0.59_0_0)]" : ""}`}>
                    <div className="bg-[oklch(0.59_0_0)] border-b border-[oklch(0.50_0_0)]">
                      <div className="sticky left-0 z-20 px-4 py-2 flex items-center gap-3 w-fit bg-[oklch(0.59_0_0)] border-r border-[oklch(0.50_0_0)] shadow-xs">
                        <span className="font-mono text-base font-bold text-white tracking-wide">
                          {mat.id_material}
                        </span>
                        {mat.nombre_proveedor && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-black/30 text-white/95 border border-white/20 tracking-wide uppercase shadow-xs">
                            {mat.nombre_proveedor}
                          </span>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenTransito(mat.id_material)}
                          className="h-7 text-xs flex items-center gap-1 text-blue-900 border border-blue-200 bg-white/95 hover:bg-white shadow-xs font-semibold"
                        >
                          <Plus className="w-3.5 h-3.5 text-blue-600" />
                          <span>Arribo</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenStockModal(mat)}
                          className="h-7 text-xs flex items-center gap-1 text-slate-800 border border-slate-300 bg-white/95 hover:bg-white shadow-xs font-medium"
                          title="Ajustar stock inicial"
                        >
                          <Edit3 className="w-3 h-3 text-slate-500" />
                          <span>Editar Stock</span>
                        </Button>

                        <span className="text-xs text-white/90 ml-1">
                          Lote: <strong className="text-white font-bold">{mat.lote_mts ? `${mat.lote_mts} ${mat.unidad}` : "—"}</strong>
                        </span>

                        <button
                          type="button"
                          onClick={() => handleOpenScrapModal(mat)}
                          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-slate-300 bg-white/95 hover:bg-white text-slate-800 transition-colors shadow-xs ml-1"
                          title="Haga clic para editar porcentaje de scrap"
                        >
                          <Percent className="w-3 h-3 text-slate-500" />
                          <span className="text-slate-600">Scrap:</span>
                          <strong className="text-slate-900 font-mono font-bold">
                            {(mat.scrap_porcentaje * 100).toFixed(1)}%
                          </strong>
                          <Edit3 className="w-3 h-3 text-slate-500 hover:text-slate-700 ml-0.5" />
                        </button>
                      </div>
                    </div>

                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-[oklch(0.93_0_0)] border-b-2 border-[oklch(0.59_0_0)]">
                          <th className="sticky left-0 z-10 bg-[oklch(0.93_0_0)] text-left font-bold text-slate-800 px-3 py-2 w-48 border-r border-[oklch(0.80_0_0)]">
                            Concepto / Fecha
                          </th>
                          {mat.dias.map((d) => (
                            <th key={d.fecha} className="px-2 py-1.5 text-center font-bold text-slate-800 min-w-[90px] border-r border-[oklch(0.85_0_0)] bg-[oklch(0.93_0_0)]">
                              <div className="text-[11px] font-mono text-slate-900 font-bold">{d.dia_nombre.split(" ")[0]}</div>
                              <div className="text-[10px] text-slate-600 font-semibold">{d.dia_nombre.split(" ")[1]}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr className="hover:bg-slate-50/50">
                          <td className="sticky left-0 z-10 bg-white font-medium text-slate-600 px-3 py-1.5 border-r border-slate-200 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-slate-300" />
                            <span>Producción</span>
                          </td>
                          {mat.dias.map((d) => (
                            <td key={d.fecha} className="px-2 py-1.5 text-center font-mono text-slate-700 border-r border-slate-100">
                              {d.produccion_vehiculos > 0 ? d.produccion_vehiculos.toLocaleString() : "—"}
                            </td>
                          ))}
                        </tr>

                        <tr className="hover:bg-slate-50/50 bg-slate-50/30">
                          <td className="sticky left-0 z-10 bg-slate-50/90 font-medium text-slate-900 px-3 py-1.5 border-r border-slate-200 flex items-center gap-1.5">
                            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                            <span>Uso Proyectado</span>
                          </td>
                          {mat.dias.map((d) => (
                            <td key={d.fecha} className="px-2 py-1.5 text-center font-mono font-semibold text-red-600 border-r border-slate-100">
                              {d.uso > 0 ? d.uso.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—"}
                            </td>
                          ))}
                        </tr>

                        {alcance === "planta" ? (
                          <tr className="hover:bg-blue-50/30">
                            <td className="sticky left-0 z-10 bg-white font-medium text-blue-700 px-3 py-1.5 border-r border-slate-200 flex items-center gap-1.5">
                              <Truck className="w-3.5 h-3.5 text-blue-600" />
                              <span>Pedido</span>
                            </td>
                            {mat.dias.map((d) => {
                              const isPlantaOnly = report.deposito_en_planta;
                              const pedidoVal = isPlantaOnly
                                ? ((d.plan_maritimo || 0) + (d.pedidos_aereos || 0) + (d.entregas_locales || 0))
                                : (d.entregas_locales || 0);
                              const viaToUse: "Maritimo" | "Aereo" | "Local" = isPlantaOnly
                                ? ((d.entregas_locales || 0) > 0 ? "Local" : ((d.pedidos_aereos || 0) > 0 ? "Aereo" : "Maritimo"))
                                : "Local";
                              const existingPo = viaToUse === "Local" ? d.local_po : (viaToUse === "Aereo" ? d.aereo_po : d.maritimo_po);
                              const existingFactura = viaToUse === "Local" ? d.local_factura : (viaToUse === "Aereo" ? d.aereo_factura : d.maritimo_factura);
                              const existingObs = viaToUse === "Local" ? d.local_obs : (viaToUse === "Aereo" ? d.aereo_obs : d.maritimo_obs);
                              const existingEstado = viaToUse === "Local" ? d.local_estado : (viaToUse === "Aereo" ? d.aereo_estado : d.maritimo_estado);
                              const isBeingDragged =
                                draggedPedido?.id_material === mat.id_material &&
                                draggedPedido?.fecha_origen === d.fecha;
                              const isDropTarget =
                                dragOverCell?.id_material === mat.id_material &&
                                dragOverCell?.fecha === d.fecha;
                              const isValidDropZone =
                                draggedPedido &&
                                draggedPedido.id_material === mat.id_material &&
                                draggedPedido.fecha_origen !== d.fecha;

                              return (
                                <td
                                  key={d.fecha}
                                  onClick={() => {
                                    if (!draggedPedido) {
                                      handleCellClickIngreso(mat.id_material, d.fecha, d.dia_nombre, viaToUse, pedidoVal, existingPo, existingFactura, existingObs, existingEstado);
                                    }
                                  }}
                                  onDragOver={(e) => {
                                    if (isValidDropZone) {
                                      e.preventDefault();
                                      e.dataTransfer.dropEffect = "move";
                                      if (dragOverCell?.fecha !== d.fecha) {
                                        setDragOverCell({ id_material: mat.id_material, fecha: d.fecha, tipo_via: viaToUse });
                                      }
                                    }
                                  }}
                                  onDragLeave={() => {
                                    if (dragOverCell?.fecha === d.fecha) {
                                      setDragOverCell(null);
                                    }
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDropPedido(mat.id_material, d.fecha);
                                  }}
                                  className={`px-2 py-1.5 text-center font-mono border-r border-slate-100 transition-all ${isDropTarget
                                      ? "bg-blue-200 ring-2 ring-blue-500 ring-inset scale-105"
                                      : isValidDropZone
                                        ? "hover:bg-blue-100/60"
                                        : "hover:bg-blue-100/70"
                                    }`}
                                  title={pedidoVal > 0 ? "Arrastra para mover de día o haz clic para editar" : "Haz clic para cargar pedido"}
                                >
                                  {pedidoVal > 0 ? (
                                    <span
                                      draggable
                                      onDragStart={(e) => {
                                        e.stopPropagation();
                                        e.dataTransfer.setData("text/plain", `${mat.id_material}:${d.fecha}`);
                                        e.dataTransfer.effectAllowed = "move";
                                        setDraggedPedido({
                                          id_material: mat.id_material,
                                          fecha_origen: d.fecha,
                                          tipo_via: viaToUse,
                                          cantidad: pedidoVal,
                                        });
                                      }}
                                      onDragEnd={() => {
                                        setDraggedPedido(null);
                                        setDragOverCell(null);
                                      }}
                                      className={`inline-flex items-center gap-0.5 bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded text-[11px] hover:bg-blue-200 cursor-grab active:cursor-grabbing select-none transition-all shadow-sm ${isBeingDragged ? "opacity-30 scale-95" : ""
                                        }`}
                                    >
                                      <GripVertical className="w-2.5 h-2.5 opacity-50 -ml-0.5" />
                                      +{pedidoVal.toLocaleString()}
                                      {(existingFactura || existingPo) && (
                                        <span className="text-[9px] font-mono text-blue-950 font-normal ml-0.5 px-1 py-0 bg-blue-200/80 rounded">
                                          #{existingFactura || existingPo}
                                        </span>
                                      )}
                                      {existingEstado === "confirmado" ? (
                                        <span className="text-[9px] font-semibold text-emerald-700 ml-0.5 px-1 py-0 bg-emerald-100 border border-emerald-300 rounded" title="Ingreso Confirmado en Stock">
                                          ✓ Conf
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-normal text-slate-500 ml-0.5 px-1 py-0 bg-slate-100 rounded" title="Planificación estimada">
                                          Plan
                                        </span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 hover:text-slate-600 text-[11px] pointer-events-none select-none">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ) : (
                          <>
                            <tr className="hover:bg-blue-50/30">
                              <td className="sticky left-0 z-10 bg-white font-medium text-blue-700 px-3 py-1.5 border-r border-slate-200 flex items-center gap-1.5">
                                <Ship className="w-3.5 h-3.5 text-blue-600" />
                                <span>Plan Marítimo</span>
                              </td>
                              {mat.dias.map((d) => {
                                const isBeingDragged =
                                  draggedPedido?.id_material === mat.id_material &&
                                  draggedPedido?.fecha_origen === d.fecha &&
                                  draggedPedido?.tipo_via === "Maritimo";
                                const isDropTarget =
                                  dragOverCell?.id_material === mat.id_material &&
                                  dragOverCell?.fecha === d.fecha &&
                                  dragOverCell?.tipo_via === "Maritimo";
                                const isValidDropZone =
                                  draggedPedido &&
                                  draggedPedido.id_material === mat.id_material &&
                                  draggedPedido.tipo_via === "Maritimo" &&
                                  draggedPedido.fecha_origen !== d.fecha;

                                return (
                                  <td
                                    key={d.fecha}
                                    onClick={() => {
                                      if (!draggedPedido) {
                                        handleCellClickIngreso(mat.id_material, d.fecha, d.dia_nombre, "Maritimo", d.plan_maritimo, d.maritimo_po, d.maritimo_factura, d.maritimo_obs, d.maritimo_estado);
                                      }
                                    }}
                                    onDragOver={(e) => {
                                      if (isValidDropZone) {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = "move";
                                        if (dragOverCell?.fecha !== d.fecha) {
                                          setDragOverCell({ id_material: mat.id_material, fecha: d.fecha, tipo_via: "Maritimo" });
                                        }
                                      }
                                    }}
                                    onDragLeave={() => {
                                      if (dragOverCell?.fecha === d.fecha) {
                                        setDragOverCell(null);
                                      }
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleDropPedido(mat.id_material, d.fecha, "Maritimo");
                                    }}
                                    className={`px-2 py-1.5 text-center font-mono border-r border-slate-100 transition-all ${isDropTarget
                                        ? "bg-blue-200 ring-2 ring-blue-500 ring-inset scale-105"
                                        : isValidDropZone
                                          ? "hover:bg-blue-100/60"
                                          : "hover:bg-blue-100/70"
                                      }`}
                                    title={
                                      d.maritimo_factura || d.maritimo_po
                                        ? `Factura: ${d.maritimo_factura || "—"} | PO: ${d.maritimo_po || "—"}${d.maritimo_obs ? ` (${d.maritimo_obs})` : ""}`
                                        : d.plan_maritimo > 0 ? "Arrastra para mover de día o haz clic para editar" : "Haz clic para cargar arribo marítimo"
                                    }
                                  >
                                    {d.plan_maritimo > 0 ? (
                                      <span
                                        draggable
                                        onDragStart={(e) => {
                                          e.stopPropagation();
                                          e.dataTransfer.setData("text/plain", `${mat.id_material}:${d.fecha}`);
                                          e.dataTransfer.effectAllowed = "move";
                                          setDraggedPedido({
                                            id_material: mat.id_material,
                                            fecha_origen: d.fecha,
                                            tipo_via: "Maritimo",
                                            cantidad: d.plan_maritimo,
                                          });
                                        }}
                                        onDragEnd={() => {
                                          setDraggedPedido(null);
                                          setDragOverCell(null);
                                        }}
                                        className={`inline-flex items-center gap-0.5 bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded text-[11px] hover:bg-blue-200 cursor-grab active:cursor-grabbing select-none transition-all shadow-sm ${isBeingDragged ? "opacity-30 scale-95" : ""
                                          }`}
                                      >
                                        <GripVertical className="w-2.5 h-2.5 opacity-50 -ml-0.5" />
                                        +{d.plan_maritimo.toLocaleString()}
                                        {(d.maritimo_factura || d.maritimo_po) && (
                                          <span className="text-[9px] font-mono text-blue-950 font-normal ml-0.5 px-1 py-0 bg-blue-200/80 rounded">
                                            #{d.maritimo_factura || d.maritimo_po}
                                          </span>
                                        )}
                                        {d.maritimo_estado === "confirmado" ? (
                                          <span className="text-[9px] font-semibold text-emerald-700 ml-0.5 px-1 py-0 bg-emerald-100 border border-emerald-300 rounded" title="Ingreso Confirmado en Stock">
                                            ✓ Conf
                                          </span>
                                        ) : (
                                          <span className="text-[9px] font-normal text-slate-500 ml-0.5 px-1 py-0 bg-slate-100 rounded" title="Planificación estimada">
                                            Plan
                                          </span>
                                        )}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300 hover:text-slate-600 text-[11px] pointer-events-none select-none">—</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>

                            <tr className="hover:bg-purple-50/30">
                              <td className="sticky left-0 z-10 bg-white font-medium text-purple-700 px-3 py-1.5 border-r border-slate-200 flex items-center gap-1.5">
                                <Plane className="w-3.5 h-3.5 text-purple-600" />
                                <span>Pedidos Aéreos</span>
                              </td>
                              {mat.dias.map((d) => {
                                const isBeingDragged =
                                  draggedPedido?.id_material === mat.id_material &&
                                  draggedPedido?.fecha_origen === d.fecha &&
                                  draggedPedido?.tipo_via === "Aereo";
                                const isDropTarget =
                                  dragOverCell?.id_material === mat.id_material &&
                                  dragOverCell?.fecha === d.fecha &&
                                  dragOverCell?.tipo_via === "Aereo";
                                const isValidDropZone =
                                  draggedPedido &&
                                  draggedPedido.id_material === mat.id_material &&
                                  draggedPedido.tipo_via === "Aereo" &&
                                  draggedPedido.fecha_origen !== d.fecha;

                                return (
                                  <td
                                    key={d.fecha}
                                    onClick={() => {
                                      if (!draggedPedido) {
                                        handleCellClickIngreso(
                                          mat.id_material,
                                          d.fecha,
                                          d.dia_nombre,
                                          "Aereo",
                                          d.pedidos_aereos,
                                          d.aereo_po,
                                          d.aereo_factura,
                                          d.aereo_obs,
                                          d.aereo_estado
                                        );
                                      }
                                    }}
                                    onDragOver={(e) => {
                                      if (isValidDropZone) {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = "move";
                                        if (dragOverCell?.fecha !== d.fecha) {
                                          setDragOverCell({ id_material: mat.id_material, fecha: d.fecha, tipo_via: "Aereo" });
                                        }
                                      }
                                    }}
                                    onDragLeave={() => {
                                      if (dragOverCell?.fecha === d.fecha) {
                                        setDragOverCell(null);
                                      }
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleDropPedido(mat.id_material, d.fecha, "Aereo");
                                    }}
                                    className={`px-2 py-1.5 text-center font-mono border-r border-slate-100 transition-all ${isDropTarget
                                        ? "bg-purple-200 ring-2 ring-purple-500 ring-inset scale-105"
                                        : isValidDropZone
                                          ? "hover:bg-purple-100/60"
                                          : "hover:bg-purple-100/70"
                                      }`}
                                    title={
                                      d.aereo_factura || d.aereo_po
                                        ? `Factura: ${d.aereo_factura || "—"} | PO: ${d.aereo_po || "—"}${d.aereo_obs ? ` (${d.aereo_obs})` : ""}`
                                        : d.pedidos_aereos > 0 ? "Arrastra para mover de día o haz clic para editar" : "Haz clic para cargar pedido aéreo"
                                    }
                                  >
                                    {d.pedidos_aereos > 0 ? (
                                      <span
                                        draggable
                                        onDragStart={(e) => {
                                          e.stopPropagation();
                                          e.dataTransfer.setData("text/plain", `${mat.id_material}:${d.fecha}`);
                                          e.dataTransfer.effectAllowed = "move";
                                          setDraggedPedido({
                                            id_material: mat.id_material,
                                            fecha_origen: d.fecha,
                                            tipo_via: "Aereo",
                                            cantidad: d.pedidos_aereos,
                                          });
                                        }}
                                        onDragEnd={() => {
                                          setDraggedPedido(null);
                                          setDragOverCell(null);
                                        }}
                                        className={`inline-flex items-center gap-0.5 bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded text-[11px] hover:bg-purple-200 cursor-grab active:cursor-grabbing select-none transition-all shadow-sm ${isBeingDragged ? "opacity-30 scale-95" : ""
                                          }`}
                                      >
                                        <GripVertical className="w-2.5 h-2.5 opacity-50 -ml-0.5" />
                                        +{d.pedidos_aereos.toLocaleString()}
                                        {(d.aereo_factura || d.aereo_po) && (
                                          <span className="text-[9px] font-mono text-purple-950 font-normal ml-0.5 px-1 py-0 bg-purple-200/80 rounded">
                                            #{d.aereo_factura || d.aereo_po}
                                          </span>
                                        )}
                                        {d.aereo_estado === "confirmado" ? (
                                          <span className="text-[9px] font-semibold text-emerald-700 ml-0.5 px-1 py-0 bg-emerald-100 border border-emerald-300 rounded" title="Ingreso Confirmado en Stock">
                                            ✓ Conf
                                          </span>
                                        ) : (
                                          <span className="text-[9px] font-normal text-slate-500 ml-0.5 px-1 py-0 bg-slate-100 rounded" title="Planificación estimada">
                                            Plan
                                          </span>
                                        )}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300 hover:text-slate-600 text-[11px] pointer-events-none select-none">—</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                            {mat.dias.some((d) => (d.entregas_locales || 0) > 0) && (
                              <tr className="hover:bg-emerald-50/30">
                                <td className="sticky left-0 z-10 bg-white font-medium text-emerald-700 px-3 py-1.5 border-r border-slate-200 flex items-center gap-1.5">
                                  <Truck className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Arribo Prov. Local</span>
                                </td>
                                {mat.dias.map((d) => (
                                  <td
                                    key={d.fecha}
                                    onClick={() => {
                                      if (!draggedPedido) {
                                        handleCellClickIngreso(
                                          mat.id_material,
                                          d.fecha,
                                          d.dia_nombre,
                                          "Local",
                                          d.entregas_locales,
                                          d.local_po,
                                          d.local_factura,
                                          d.local_obs,
                                          d.local_estado
                                        );
                                      }
                                    }}
                                    className="px-2 py-1.5 text-center font-mono border-r border-slate-100 hover:bg-emerald-100/60 cursor-pointer"
                                    title={
                                      d.local_factura || d.local_po
                                        ? `Factura: ${d.local_factura || "—"} | PO: ${d.local_po || "—"}${d.local_obs ? ` (${d.local_obs})` : ""}`
                                        : (d.entregas_locales || 0) > 0
                                          ? "Haz clic para ver/editar ingreso local"
                                          : "Haz clic para cargar ingreso local"
                                    }
                                  >
                                    {(d.entregas_locales || 0) > 0 ? (
                                      <span className="inline-flex items-center gap-0.5 bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded text-[11px]">
                                        +{(d.entregas_locales || 0).toLocaleString()}
                                        {(d.local_factura || d.local_po) && (
                                          <span className="text-[9px] font-mono text-emerald-950 font-normal ml-0.5 px-1 py-0 bg-emerald-200/80 rounded">
                                            #{d.local_factura || d.local_po}
                                          </span>
                                        )}
                                        {d.local_estado === "confirmado" ? (
                                          <span className="text-[9px] font-semibold text-emerald-700 ml-0.5 px-1 py-0 bg-emerald-200/80 rounded" title="Confirmado">
                                            ✓ Conf
                                          </span>
                                        ) : (
                                          <span className="text-[9px] font-normal text-emerald-700/70 ml-0.5 px-1 py-0 bg-white/70 rounded" title="Plan">
                                            Plan
                                          </span>
                                        )}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300 text-[11px]">—</span>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            )}
                          </>
                        )}

                        <tr className="hover:bg-amber-50/40">
                          <td className="sticky left-0 z-10 bg-white font-medium text-slate-600 px-3 py-1.5 border-r border-slate-200 flex items-center gap-1.5">
                            <PackageCheck className="w-3.5 h-3.5 text-amber-600" />
                            <span>Ajustes</span>
                          </td>
                          {mat.dias.map((d) => {
                            const desvio = d.desvio_ajuste !== undefined ? Math.round(d.desvio_ajuste) : 0;
                            return (
                              <td
                                key={d.fecha}
                                onClick={() => handleOpenStockModal(mat, d.fecha)}
                                className="px-2 py-1.5 text-center font-mono border-r border-slate-100 cursor-pointer hover:bg-amber-100/60 transition-colors"
                                title="Diferencia entre stock estimado y conteo real físico del día. Haz clic para ajustar stock."
                              >
                                {desvio !== 0 ? (
                                  <span
                                    className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${desvio > 0
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-amber-100 text-amber-900"
                                      }`}
                                  >
                                    {desvio > 0 ? `+${desvio.toLocaleString("es-AR")}` : desvio.toLocaleString("es-AR")}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 hover:text-slate-600 text-[11px]">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        <tr className="bg-slate-100/60 font-semibold border-t border-b border-slate-200">
                          <td className="sticky left-0 z-10 bg-slate-100 font-bold text-slate-900 px-3 py-2 border-r border-slate-200">
                            Stock Proyectado
                          </td>
                          {mat.dias.map((d) => (
                            <td
                              key={d.fecha}
                              onClick={() => handleOpenStockModal(mat, d.fecha)}
                              title={`Clic para editar o cargar conteo físico en ${d.fecha}`}
                              className={`px-2 py-2 text-center font-mono text-xs border-r border-slate-200 cursor-pointer transition-colors hover:ring-2 hover:ring-blue-500/50 ${d.tiene_ajuste
                                  ? "ring-1 ring-blue-500 bg-blue-50/60 font-black text-blue-900"
                                  : d.stock_final <= 0
                                    ? "bg-red-200 text-red-900 font-black"
                                    : d.stock_final < 500
                                      ? "text-amber-800 font-bold"
                                      : "text-slate-900 font-bold"
                                }`}
                            >
                              <div className="flex items-center justify-center gap-1">
                                {d.tiene_ajuste && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" title="Stock ajustado manualmente / Conteo" />
                                )}
                                <span>
                                  {Math.round(d.stock_final).toLocaleString("es-AR")}
                                </span>
                              </div>
                            </td>
                          ))}
                        </tr>

                        <tr className="hover:bg-slate-50/50">
                          <td className="sticky left-0 z-10 bg-white font-semibold text-slate-800 px-3 py-2 border-r border-slate-200">
                            Días de Cobertura
                          </td>
                          {mat.dias.map((d) => {
                            const cellId = `cell-risk-${mat.id_material}-${d.fecha}`;
                            const isHighlighted = highlightedRiskId === cellId;
                            const isCritical = d.alerta_quiebre || d.dias_cobertura < diasRojoActual;

                            let badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300";
                            if (isCritical) {
                              badgeClass = "bg-red-600 text-white font-bold animate-pulse";
                            } else if (d.dias_cobertura <= diasAmarilloActual) {
                              badgeClass = "bg-amber-100 text-amber-800 border-amber-300 font-semibold";
                            }
                            return (
                              <td
                                key={d.fecha}
                                id={cellId}
                                className={`px-2 py-1.5 text-center border-r border-slate-100 transition-all duration-300 ${isHighlighted
                                    ? "ring-4 ring-red-500 ring-offset-2 z-20 bg-red-100 scale-105 shadow-md"
                                    : ""
                                  }`}
                              >
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-mono border ${badgeClass}`}>
                                  {d.dias_cobertura >= 900 ? "—" : `${d.dias_cobertura.toFixed(1)}d`}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={editIngresoModalOpen} onOpenChange={setEditIngresoModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-blue-600" />
              <span>Editar Ingreso / Arribo Diario</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <div className="bg-slate-50 p-3 rounded-lg border text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-500">Material:</span>
                  <p className="font-mono font-bold text-slate-900">{ingresoEditForm.id_material}</p>
                </div>
                {ingresoEditForm.fecha_origen && ingresoEditForm.fecha_origen !== ingresoEditForm.fecha_eta && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[10px]">
                    Desplazando desde {ingresoEditForm.fecha_origen}
                  </Badge>
                )}
              </div>

              <div className="pt-1 border-t border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-slate-600 font-medium flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    Fecha ETA / Arribo:
                  </span>
                  <span className="font-mono text-xs text-slate-700 font-semibold">
                    {ingresoEditForm.dia_nombre}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs font-mono"
                    onClick={() => handleShiftDate(-7)}
                    title="Retroceder 1 semana (-7 días)"
                  >
                    -7d
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs font-mono"
                    onClick={() => handleShiftDate(-1)}
                    title="Retroceder 1 día"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Input
                    type="date"
                    value={ingresoEditForm.fecha_eta}
                    onChange={(e) => handleDirectDateChange(e.target.value)}
                    className="h-8 text-xs font-mono flex-1 text-center"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs font-mono"
                    onClick={() => handleShiftDate(1)}
                    title="Avanzar 1 día"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs font-mono"
                    onClick={() => handleShiftDate(7)}
                    title="Avanzar 1 semana (+7 días)"
                  >
                    +7d
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
              <Label className="text-xs font-semibold text-slate-700">Tipo de Arribo</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIngresoEditForm({ ...ingresoEditForm, estado: "planificado" })}
                  className={`flex flex-col items-center justify-center p-2 rounded-md border text-xs font-medium transition-all ${ingresoEditForm.estado === "planificado"
                      ? "border-blue-600 bg-blue-50/80 text-blue-900 font-semibold shadow-xs"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                >
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                    Planificación
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal mt-0.5">
                    Proyección (no altera stock físico)
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIngresoEditForm({ ...ingresoEditForm, estado: "confirmado" })}
                  className={`flex flex-col items-center justify-center p-2 rounded-md border text-xs font-medium transition-all ${ingresoEditForm.estado === "confirmado"
                      ? "border-emerald-600 bg-emerald-50/80 text-emerald-900 font-semibold shadow-xs"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                >
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Confirmación
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal mt-0.5">
                    Físico (suma al stock del depósito)
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo de Vía *</Label>
                <Select
                  value={ingresoEditForm.tipo_via}
                  onValueChange={(val: "Maritimo" | "Aereo" | "Local" | "AjusteScrap") =>
                    setIngresoEditForm({ ...ingresoEditForm, tipo_via: val })
                  }
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Vía" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Maritimo">Plan Marítimo</SelectItem>
                    <SelectItem value="Aereo">Pedido Aéreo</SelectItem>
                    <SelectItem value="Local">Entrega Local (Planta)</SelectItem>
                    <SelectItem value="AjusteScrap">Ajuste de Scrap (-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Cantidad *</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="0 para borrar"
                  value={ingresoEditForm.cantidad === 0 ? "" : ingresoEditForm.cantidad}
                  onChange={(e) =>
                    setIngresoEditForm({ ...ingresoEditForm, cantidad: parseFloat(e.target.value) || 0 })
                  }
                  className="text-xs font-mono font-bold"
                />
                <p className="text-[10px] text-slate-400">Poner 0 elimina el arribo de esa fecha.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>N.º PO (Orden de Compra)</Label>
                <Input
                  placeholder="ej. PO-1099-0901"
                  value={ingresoEditForm.po_numero}
                  onChange={(e) => setIngresoEditForm({ ...ingresoEditForm, po_numero: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label>Factura N.º</Label>
                <Input
                  placeholder="ej. FAC-001"
                  value={ingresoEditForm.factura_numero}
                  onChange={(e) => setIngresoEditForm({ ...ingresoEditForm, factura_numero: e.target.value })}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Observación / Nota</Label>
              <Input
                placeholder="ej. Arribo confirmado en Zárate"
                value={ingresoEditForm.observacion}
                onChange={(e) => setIngresoEditForm({ ...ingresoEditForm, observacion: e.target.value })}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between sm:justify-between w-full">
            <Button
              type="button"
              variant="outline"
              onClick={handleRequestDeleteIngreso}
              disabled={isSavingIngreso}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 gap-1.5"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
              <span>Eliminar Pedido</span>
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setEditIngresoModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmitEditIngreso}
                disabled={isSavingIngreso}
                className={
                  ingresoEditForm.fecha_origen && ingresoEditForm.fecha_origen !== ingresoEditForm.fecha_eta
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }
              >
                {isSavingIngreso
                  ? "Guardando..."
                  : ingresoEditForm.fecha_origen && ingresoEditForm.fecha_origen !== ingresoEditForm.fecha_eta
                    ? `Desplazar pedido al ${ingresoEditForm.fecha_eta}`
                    : "Guardar Cambios"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adminModalOpen} onOpenChange={setAdminModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              <span>Administrar Rundown — Líneas, Proveedores y Materiales</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex border-b">
              <button
                onClick={() => setAdminTab("secciones")}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${adminTab === "secciones"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
              >
                Líneas
              </button>
              <button
                onClick={() => setAdminTab("proveedores")}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${adminTab === "proveedores"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
              >
                Proveedores y Asignaciones
              </button>
              <button
                onClick={() => {
                  setAdminTab("materiales");
                  const pId = adminMaterialProvId || activeSupplier?.id_proveedor || (secciones[0]?.proveedores[0]?.id_proveedor ?? 0);
                  if (pId) {
                    setAdminMaterialProvId(pId);
                    fetchProvMateriales(pId);
                  }
                }}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${adminTab === "materiales"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
              >
                Materiales en Rundown
              </button>
            </div>

            {adminTab === "secciones" ? (
              <div className="space-y-4">
                <div className="border rounded-lg p-3 bg-slate-50 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <FolderPlus className="w-4 h-4 text-blue-600" />
                    <span>Nueva Línea</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      placeholder="Nombre (ej. Paneles)"
                      value={newSeccionForm.nombre}
                      onChange={(e) => setNewSeccionForm({ ...newSeccionForm, nombre: e.target.value })}
                      className="text-xs h-8"
                    />
                    <Input
                      placeholder="Descripción (opcional)"
                      value={newSeccionForm.descripcion}
                      onChange={(e) => setNewSeccionForm({ ...newSeccionForm, descripcion: e.target.value })}
                      className="text-xs h-8"
                    />
                    <Button
                      onClick={handleCreateSeccion}
                      disabled={isSavingAdmin || !newSeccionForm.nombre.trim()}
                      className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {isSavingAdmin ? "Guardando..." : "Agregar Línea"}
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-700 border-b">
                      <tr>
                        <th className="p-2 text-left">Código</th>
                        <th className="p-2 text-left">Nombre</th>
                        <th className="p-2 text-center">Proveedores</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {secciones.map((s) => (
                        <tr key={s.id_seccion} className="hover:bg-slate-50">
                          <td className="p-2 font-mono font-bold text-slate-800">{s.codigo}</td>
                          <td className="p-2 text-slate-700">{s.nombre}</td>
                          <td className="p-2 text-center">
                            <Badge variant="outline" className="text-[10px]">
                              {s.proveedores.length} proveedores
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : adminTab === "proveedores" ? (
              <div className="space-y-4">
                <div className="border rounded-lg p-3 bg-slate-50 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <UserPlus className="w-4 h-4 text-blue-600" />
                    <span>Nuevo Proveedor</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      placeholder="Nombre del proveedor"
                      value={newProvForm.nombre}
                      onChange={(e) => setNewProvForm({ ...newProvForm, nombre: e.target.value })}
                      className="text-xs h-8"
                    />
                    <Select
                      value={newProvForm.id_seccion ? String(newProvForm.id_seccion) : String(selectedSeccionId)}
                      onValueChange={(val) => setNewProvForm({ ...newProvForm, id_seccion: parseInt(val, 10) })}
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue placeholder="Línea" />
                      </SelectTrigger>
                      <SelectContent>
                        {secciones.map((s) => (
                          <SelectItem key={s.id_seccion} value={String(s.id_seccion)}>
                            {s.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleCreateProveedor}
                      disabled={isSavingAdmin || !newProvForm.nombre.trim()}
                      className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {isSavingAdmin ? "Guardando..." : "Agregar Proveedor"}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <input
                      type="checkbox"
                      id="new-prov-dep-planta"
                      checked={newProvForm.deposito_en_planta}
                      onChange={(e) => setNewProvForm({ ...newProvForm, deposito_en_planta: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                    />
                    <Label htmlFor="new-prov-dep-planta" className="text-xs text-slate-700 font-medium cursor-pointer select-none">
                      Depósito en Planta (Stock único sin transferencia intermedia desde CL2)
                    </Label>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-700 border-b">
                      <tr>
                        <th className="p-2 text-left">Proveedor</th>
                        <th className="p-2 text-left">Línea Asignada</th>
                        <th className="p-2 text-center">Tipo Depósito</th>
                        <th className="p-2 text-center">Estado</th>
                        <th className="p-2 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {secciones.flatMap((s) => s.proveedores).map((p) => (
                        <tr key={p.id_proveedor} className="hover:bg-slate-50">
                          <td className="p-2 font-mono font-bold text-slate-800">{p.nombre}</td>
                          <td className="p-2">
                            <Select
                              value={p.id_seccion ? String(p.id_seccion) : ""}
                              onValueChange={(val) => handleReassignProveedor(p.id_proveedor, parseInt(val, 10))}
                            >
                              <SelectTrigger className="text-xs h-7 w-40">
                                <SelectValue placeholder="Asignar línea" />
                              </SelectTrigger>
                              <SelectContent>
                                {secciones.map((sec) => (
                                  <SelectItem key={sec.id_seccion} value={String(sec.id_seccion)}>
                                    {sec.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleDepositoEnPlanta(p)}
                              title="Haga clic para alternar: Depósito unificado en Planta o con Depósito intermedio CL2"
                              className="focus:outline-none transition-transform active:scale-95"
                            >
                              {p.deposito_en_planta ? (
                                <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] cursor-pointer shadow-xs">
                                  En Planta (Unificado)
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-slate-600 border-slate-300 text-[10px] hover:bg-slate-100 cursor-pointer">
                                  Con Depósito CL2
                                </Badge>
                              )}
                            </button>
                          </td>
                          <td className="p-2 text-center">
                            {p.tiene_parametros ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                                Configurado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-slate-400 text-[10px]">
                                Sin recetas
                              </Badge>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenEditProveedor(p)}
                                className="h-6 px-2 text-[11px] border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center gap-1"
                                title="Configurar proveedor"
                              >
                                <Settings className="w-3 h-3 text-slate-500" />
                                Configurar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setAdminMaterialProvId(p.id_proveedor);
                                  fetchProvMateriales(p.id_proveedor);
                                  setAdminTab("materiales");
                                }}
                                className="h-6 px-2 text-[11px] text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                              >
                                Materiales →
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Warehouse className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-700">Proveedor a configurar:</span>
                  </div>
                  <Select
                    value={adminMaterialProvId ? String(adminMaterialProvId) : ""}
                    onValueChange={(val) => {
                      const numVal = parseInt(val, 10);
                      setAdminMaterialProvId(numVal);
                      fetchProvMateriales(numVal);
                    }}
                  >
                    <SelectTrigger className="text-xs h-8 w-64 bg-white font-semibold">
                      <SelectValue placeholder="Seleccione proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {secciones.flatMap((s) =>
                        s.proveedores.map((p) => (
                          <SelectItem key={p.id_proveedor} value={String(p.id_proveedor)} className="text-xs">
                            {p.nombre} ({s.nombre}) {p.tiene_parametros ? "✓" : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border rounded-lg p-3 bg-blue-50/30 border-blue-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Plus className="w-4 h-4 text-blue-600" />
                      <span>Agregar Material al Rundown</span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Vinculación automática con BOM de vehículos
                    </span>
                  </div>

                  <div className="relative">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <Input
                        placeholder="Buscar por código o descripción en el catálogo de materiales..."
                        value={catalogoSearchQuery}
                        onChange={(e) => handleSearchCatalogo(e.target.value)}
                        className="pl-8 text-xs h-8 bg-white"
                      />
                    </div>
                    {isSearchingCatalogo && (
                      <div className="absolute top-9 left-0 right-0 z-20 bg-white border rounded shadow-md p-2 text-center text-xs text-slate-400">
                        Buscando materiales...
                      </div>
                    )}
                    {catalogoSearchResults.length > 0 && (
                      <div className="absolute top-9 left-0 right-0 z-20 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y text-xs">
                        {catalogoSearchResults.map((m) => (
                          <button
                            key={m.id_material}
                            type="button"
                            onClick={() => handleSelectCatalogoItem(m)}
                            className="w-full p-2 text-left hover:bg-blue-50 flex items-center justify-between transition-colors"
                          >
                            <div>
                              <span className="font-mono font-bold text-slate-900">{m.id_material}</span>
                              <span className="text-slate-600 ml-2">{m.nombre}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {((m.stock_total ?? 0) > 0 || (m.stock_planta ?? 0) > 0) && (
                                <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-mono font-semibold">
                                  Stock: {(m.stock_total ?? 0).toLocaleString("es-AR")}
                                </span>
                              )}
                              <Badge variant="outline" className="text-[10px]">
                                {m.unidad}
                              </Badge>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <Label className="text-[11px] text-slate-600">Código Material *</Label>
                      <Input
                        placeholder="ej. PU188-D1800"
                        value={newMaterialForm.id_material}
                        onChange={(e) => setNewMaterialForm({ ...newMaterialForm, id_material: e.target.value })}
                        onBlur={(e) => handleMaterialCodeLookup(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleMaterialCodeLookup(newMaterialForm.id_material);
                          }
                        }}
                        className="text-xs h-8 font-mono bg-white mt-1"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-[11px] text-slate-600">Descripción</Label>
                      <Input
                        placeholder="ej. ESPUMA HEADLINER 1.8M"
                        value={newMaterialForm.descripcion}
                        onChange={(e) => setNewMaterialForm({ ...newMaterialForm, descripcion: e.target.value })}
                        className="text-xs h-8 bg-white mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-600">Unidad</Label>
                      <Input
                        placeholder="MTS, UN, KG"
                        value={newMaterialForm.unidad}
                        onChange={(e) => setNewMaterialForm({ ...newMaterialForm, unidad: e.target.value })}
                        className="text-xs h-8 bg-white mt-1 font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <Label className="text-[11px] text-slate-600">Lote Estándar</Label>
                      <Input
                        type="number"
                        placeholder="ej. 2464"
                        value={newMaterialForm.lote_mts || ""}
                        onChange={(e) =>
                          setNewMaterialForm({ ...newMaterialForm, lote_mts: parseFloat(e.target.value) || 0 })
                        }
                        className="text-xs h-8 bg-white mt-1 font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-600">Scrap (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="ej. 1.0"
                        value={newMaterialForm.scrap_porcentaje || ""}
                        onChange={(e) =>
                          setNewMaterialForm({ ...newMaterialForm, scrap_porcentaje: parseFloat(e.target.value) || 0 })
                        }
                        className="text-xs h-8 bg-white mt-1 font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-600">Stock Inicial Planta</Label>
                      <Input
                        type="number"
                        step="1"
                        placeholder="0"
                        value={newMaterialForm.stock_inicial_planta || ""}
                        onChange={(e) =>
                          setNewMaterialForm({
                            ...newMaterialForm,
                            stock_inicial_planta: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="text-xs h-8 bg-white mt-1 font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-600">Stock Inicial Total</Label>
                      <Input
                        type="number"
                        step="1"
                        placeholder="0"
                        value={newMaterialForm.stock_inicial_total || ""}
                        onChange={(e) =>
                          setNewMaterialForm({
                            ...newMaterialForm,
                            stock_inicial_total: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="text-xs h-8 bg-white mt-1 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      onClick={handleAddMaterialToProveedor}
                      disabled={isAddingMaterial || !newMaterialForm.id_material.trim() || !adminMaterialProvId}
                      className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {isAddingMaterial ? "Vinculando..." : "Agregar al Rundown"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600 font-semibold px-1">
                    <span>Materiales en este Rundown ({provMaterialesList.length})</span>
                    {loadingProvMateriales && <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />}
                  </div>

                  <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 text-slate-700 border-b">
                        <tr>
                          <th className="p-2 text-left">Material</th>
                          <th className="p-2 text-left">Descripción</th>
                          <th className="p-2 text-center">Unidad</th>
                          <th className="p-2 text-center">Lote</th>
                          <th className="p-2 text-center">Scrap</th>
                          <th className="p-2 text-center">Vehículos BOM</th>
                          <th className="p-2 text-right">Stock Inicial</th>
                          <th className="p-2 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {provMaterialesList.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-6 text-center text-slate-400">
                              No hay materiales configurados para este proveedor. Busque un insumo arriba para agregarlo.
                            </td>
                          </tr>
                        ) : (
                          provMaterialesList.map((m) => (
                            <tr key={m.id_parametro} className="hover:bg-slate-50">
                              <td className="p-2 font-mono font-bold text-slate-800">{m.id_material}</td>
                              <td className="p-2 text-slate-600 truncate max-w-[160px]" title={m.descripcion}>
                                {m.descripcion}
                              </td>
                              <td className="p-2 text-center font-mono">{m.unidad}</td>
                              <td className="p-2 text-center font-mono">
                                {m.tipo_empaque === "pallet" && m.lote_mts ? (
                                  <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold">
                                    {m.lote_mts.toLocaleString()} pal
                                  </Badge>
                                ) : (
                                  <span className="text-slate-500 text-xs">{m.lote_mts ? `${m.lote_mts.toLocaleString()} un` : "1 un"}</span>
                                )}
                              </td>
                              <td className="p-2 text-center font-mono">{(m.scrap_porcentaje * 100).toFixed(1)}%</td>
                              <td className="p-2 text-center">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${m.cant_productos > 0
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                      : "bg-amber-50 text-amber-800 border-amber-200"
                                    }`}
                                >
                                  {m.cant_productos} recetas
                                </Badge>
                              </td>
                              <td className="p-2 text-right font-mono font-semibold text-slate-800">
                                {Math.round(m.stock_inicial_total).toLocaleString()}
                              </td>
                              <td className="p-2 text-center whitespace-nowrap">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingLoteMaterial({
                                      id_parametro: m.id_parametro,
                                      id_material: m.id_material,
                                      descripcion: m.descripcion,
                                      tipo_empaque: m.tipo_empaque || "pallet",
                                      lote_mts: m.lote_mts || 1,
                                    });
                                    setLoteMaterialModalOpen(true);
                                  }}
                                  className="h-7 w-7 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 mr-1"
                                  title="Editar lote y presentación (pallet/unidades)"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteMaterialParam(m.id_parametro)}
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  title="Eliminar del Rundown"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdminModalOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE EDICIÓN DE LOTE Y PRESENTACIÓN DEL MATERIAL */}
      <Dialog open={loteMaterialModalOpen} onOpenChange={setLoteMaterialModalOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Package className="w-5 h-5 text-indigo-600" />
              Configurar Lote y Empaque del Material
            </DialogTitle>
          </DialogHeader>

          {editingLoteMaterial && (
            <div className="space-y-4 py-2">
              <div>
                <span className="text-xs text-slate-400 block">Material</span>
                <span className="font-mono font-bold text-sm text-slate-800">
                  {editingLoteMaterial.id_material} - {editingLoteMaterial.descripcion}
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Tipo de Empaque</Label>
                <Select
                  value={editingLoteMaterial.tipo_empaque}
                  onValueChange={(val) =>
                    setEditingLoteMaterial({ ...editingLoteMaterial, tipo_empaque: val })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Seleccionar empaque" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pallet">Pallet (piezas por pallet)</SelectItem>
                    <SelectItem value="unidad">Unidades (sueltas)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editingLoteMaterial.tipo_empaque === "pallet" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Tamaño de Lote (Piezas por Pallet)
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={editingLoteMaterial.lote_mts}
                    onChange={(e) =>
                      setEditingLoteMaterial({
                        ...editingLoteMaterial,
                        lote_mts: Math.max(1, parseFloat(e.target.value) || 1),
                      })
                    }
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[11px] text-slate-500">
                    Ej: Para espumas, 182 piezas forman un pallet completo. La sugerencia de pedidos se calculará en múltiplos enteros de este lote.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLoteMaterialModalOpen(false)}
              disabled={isSavingLoteMaterial}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveLoteMaterial}
              disabled={isSavingLoteMaterial}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              {isSavingLoteMaterial && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Guardar Lote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transitoModalOpen} onOpenChange={setTransitoModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ship className="w-5 h-5 text-blue-600" />
              <span>Registrar Arribo en Tránsito / PO</span>
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 py-2 text-sm">
            <div className="space-y-1">
              <Label>Espuma *</Label>
              <Select
                value={transitoForm.id_material}
                onValueChange={(val) => setTransitoForm({ ...transitoForm, id_material: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione espuma" />
                </SelectTrigger>
                <SelectContent>
                  {report?.materiales.map((m) => (
                    <SelectItem key={m.id_material} value={m.id_material}>
                      {m.id_material}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
              <Label className="text-xs font-semibold text-slate-700">Tipo de Arribo</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTransitoForm({ ...transitoForm, estado: "planificado" })}
                  className={`flex flex-col items-center justify-center p-2 rounded-md border text-xs font-medium transition-all ${transitoForm.estado === "planificado"
                      ? "border-blue-600 bg-blue-50/80 text-blue-900 font-semibold shadow-xs"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                >
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                    Planificación
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal mt-0.5">
                    Proyección (no altera stock físico)
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTransitoForm({ ...transitoForm, estado: "confirmado" })}
                  className={`flex flex-col items-center justify-center p-2 rounded-md border text-xs font-medium transition-all ${transitoForm.estado === "confirmado"
                      ? "border-emerald-600 bg-emerald-50/80 text-emerald-900 font-semibold shadow-xs"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                >
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Confirmación
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal mt-0.5">
                    Físico (suma al stock del depósito)
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo de Vía *</Label>
                <Select
                  value={transitoForm.tipo_via}
                  onValueChange={(val: "Maritimo" | "Aereo" | "Local" | "AjusteScrap") =>
                    setTransitoForm({ ...transitoForm, tipo_via: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vía" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Maritimo">Plan Marítimo</SelectItem>
                    <SelectItem value="Aereo">Pedido Aéreo</SelectItem>
                    <SelectItem value="Local">Entrega Local (Planta)</SelectItem>
                    <SelectItem value="AjusteScrap">Ajuste de Scrap (-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Fecha ETA (Arribo) *</Label>
                <Input
                  type="date"
                  value={transitoForm.fecha_eta}
                  onChange={(e) => setTransitoForm({ ...transitoForm, fecha_eta: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cantidad *</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="ej. 2464"
                  value={transitoForm.cantidad === 0 ? "" : transitoForm.cantidad}
                  onChange={(e) =>
                    setTransitoForm({ ...transitoForm, cantidad: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="space-y-1">
                <Label>N.º PO (Orden de Compra)</Label>
                <Input
                  placeholder="ej. 5500001099-0901"
                  value={transitoForm.po_numero || ""}
                  onChange={(e) => setTransitoForm({ ...transitoForm, po_numero: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Factura N.º</Label>
              <Input
                placeholder="ej. Fact. 2026-0044"
                value={transitoForm.factura_numero || ""}
                onChange={(e) => setTransitoForm({ ...transitoForm, factura_numero: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label>Observación / Nota</Label>
              <Input
                placeholder="ej. Contenedor puerto Zárate"
                value={transitoForm.observacion || ""}
                onChange={(e) => setTransitoForm({ ...transitoForm, observacion: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setTransitoModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitTransito}
              disabled={isSavingTransito || transitoForm.cantidad === 0}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              {isSavingTransito ? "Guardando..." : "Guardar Arribo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stockModalOpen} onOpenChange={setStockModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-blue-600" />
              <span>Ajustar Stock / Conteo Físico</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <div className="p-3 bg-slate-50 border rounded text-xs grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500">Espuma / Material:</span>
                <p className="font-mono font-bold text-slate-900 mt-0.5">{stockForm.material_label}</p>
              </div>
              <div>
                <span className="text-slate-500">Ámbito:</span>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {stockForm.tipo_stock === "planta" ? "Stock en Planta" : "Stock Total (Planta + CL2)"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Fecha del Stock *</Label>
                <Select
                  value={stockForm.fecha}
                  onValueChange={(val) => {
                    const mat = report?.materiales.find((m) => m.id_parametro === stockForm.id_parametro);
                    const dayCell = mat?.dias.find((d) => d.fecha === val);
                    const valForDay = dayCell
                      ? Math.round(dayCell.stock_final)
                      : Math.round(stockForm.stock_inicial);
                    setStockForm({
                      ...stockForm,
                      fecha: val,
                      stock_inicial: valForDay,
                    });
                  }}
                >
                  <SelectTrigger className="text-xs font-mono">
                    <SelectValue placeholder="Seleccione fecha" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {report?.columnas_fechas.map((f) => {
                      const mat = report?.materiales.find((m) => m.id_parametro === stockForm.id_parametro);
                      const dayCell = mat?.dias.find((d) => d.fecha === f);
                      return (
                        <SelectItem key={f} value={f} className="text-xs font-mono">
                          {f} ({dayCell?.dia_nombre || ""})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Stock Real / Revalidado *</Label>
                <Input
                  type="number"
                  step="1"
                  value={Math.round(stockForm.stock_inicial)}
                  onChange={(e) =>
                    setStockForm({ ...stockForm, stock_inicial: parseInt(e.target.value, 10) || 0 })
                  }
                  className="font-mono font-bold text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Observación / Motivo (Opcional)</Label>
              <Input
                placeholder="ej. Conteo físico de planta, inventario semanal"
                value={stockForm.observacion}
                onChange={(e) => setStockForm({ ...stockForm, observacion: e.target.value })}
                className="text-xs"
              />
            </div>

            <p className="text-[11px] bg-blue-50/80 p-2.5 rounded-lg border border-blue-100 text-blue-900 leading-relaxed">
              El valor ingresado se toma como el <strong>stock real definitivo</strong> para la fecha <strong>{stockForm.fecha}</strong> (fijando el valor final de ese día y calculando el desvío contra el teórico). A partir del día siguiente se reanuda el encadenamiento restando consumos y sumando ingresos.
            </p>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between sm:justify-between w-full">
            {report?.materiales
              .find((m) => m.id_parametro === stockForm.id_parametro)
              ?.dias.find((d) => d.fecha === stockForm.fecha)?.tiene_ajuste ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleRequestDeleteStockAjuste}
                disabled={isSavingStock}
                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 gap-1.5"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
                <span>Eliminar Ajuste</span>
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setStockModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmitStock}
                disabled={isSavingStock}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {isSavingStock ? "Guardando..." : "Guardar Ajuste"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scrapModalOpen} onOpenChange={setScrapModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-blue-600" />
              <span>Editar Porcentaje de Scrap</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <div className="p-3 bg-slate-50 border rounded text-xs">
              <span className="text-slate-500">Material / Espuma:</span>
              <p className="font-mono font-bold text-slate-900 mt-0.5">
                {scrapTargetMat?.id_material} — {scrapTargetMat?.descripcion}
              </p>
            </div>

            <div className="space-y-1">
              <Label>Porcentaje de Scrap (%) *</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={scrapInputVal}
                  onChange={(e) => setScrapInputVal(e.target.value)}
                  className="font-mono font-bold pr-8"
                  autoFocus
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">
                  %
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-400">Comunes:</span>
                {[0, 3.5, 5, 10].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setScrapInputVal(pct.toString())}
                    className="text-[11px] px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 pt-1">
                El scrap ajusta automáticamente el consumo diario: <br />
                <span className="font-mono text-slate-600">Uso = Consumo × (1 + Scrap)</span>
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setScrapModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitScrap}
              disabled={savingScrap || scrapInputVal.trim() === ""}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {savingScrap ? "Guardando..." : "Guardar Scrap"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CalendarioLaboralModal
        open={calModalOpen}
        onOpenChange={setCalModalOpen}
        initialAnio={calSelectedAnio}
        initialMes={calSelectedMes}
        mesesDisponibles={report?.meses_disponibles}
        onSaved={fetchRundown}
      />

      <Dialog open={horizonteModalOpen} onOpenChange={setHorizonteModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-indigo-600" />
              <span>Horizonte Extendido — Meses Proyectados a Futuro</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg text-xs space-y-1">
              <p className="font-semibold text-indigo-950">Planificación de Pedidos y Tránsitos a Largo Plazo</p>
              <p className="text-indigo-800">
                Permite proyectar meses futuros más allá del alcance de la orden de suministro oficial (ej. Marzo a Mayo 2027) para simular pedidos marítimos.
                Cada mes extendido replica la demanda diaria del mes base seleccionado, y tanto el horizonte como los pedidos cargados persisten cuando se importe una nueva orden de suministro.
              </p>
            </div>

            <div className="border rounded-lg p-3 bg-slate-50 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>Agregar Nuevo Mes al Horizonte</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <Label className="text-[11px] text-slate-600">Mes a Proyectar *</Label>
                  <Select
                    value={`${newProyeccionForm.anio}-${newProyeccionForm.mes.toString().padStart(2, "0")}`}
                    onValueChange={(val) => {
                      const [a, m] = val.split("-").map(Number);
                      setNewProyeccionForm({ ...newProyeccionForm, anio: a, mes: m });
                    }}
                  >
                    <SelectTrigger className="text-xs h-8 bg-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        { anio: 2027, mes: 3, label: "Marzo 2027" },
                        { anio: 2027, mes: 4, label: "Abril 2027" },
                        { anio: 2027, mes: 5, label: "Mayo 2027" },
                        { anio: 2027, mes: 6, label: "Junio 2027" },
                        { anio: 2027, mes: 7, label: "Julio 2027" },
                        { anio: 2027, mes: 8, label: "Agosto 2027" },
                        { anio: 2027, mes: 9, label: "Septiembre 2027" },
                        { anio: 2027, mes: 10, label: "Octubre 2027" },
                        { anio: 2027, mes: 11, label: "Noviembre 2027" },
                        { anio: 2027, mes: 12, label: "Diciembre 2027" },
                      ].map((item) => (
                        <SelectItem key={`${item.anio}-${item.mes}`} value={`${item.anio}-${item.mes.toString().padStart(2, "0")}`} className="text-xs">
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] text-slate-600">Copiar Consumo Base de *</Label>
                  <Select
                    value={newProyeccionForm.periodo_copia}
                    onValueChange={(val) => setNewProyeccionForm({ ...newProyeccionForm, periodo_copia: val })}
                  >
                    <SelectTrigger className="text-xs h-8 bg-white mt-1 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(report?.meses_disponibles || []).map((m) => (
                        <SelectItem key={m.periodo} value={m.periodo} className="text-xs font-mono">
                          {m.label} ({m.periodo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] text-slate-600">Observación</Label>
                  <Input
                    placeholder="ej. Simulación marítima"
                    value={newProyeccionForm.observacion}
                    onChange={(e) => setNewProyeccionForm({ ...newProyeccionForm, observacion: e.target.value })}
                    className="text-xs h-8 bg-white mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  onClick={handleCreateProyeccion}
                  disabled={isSavingProyeccion || !newProyeccionForm.periodo_copia}
                  className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isSavingProyeccion ? "Agregando..." : "Agregar Mes al Horizonte"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600 font-semibold px-1">
                <span>Meses Extendido Configurados ({periodosProyeccion.length})</span>
                {loadingProyecciones && <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />}
              </div>

              <div className="border rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-700 border-b">
                    <tr>
                      <th className="p-2 text-left">Período</th>
                      <th className="p-2 text-left">Mes Proyectado</th>
                      <th className="p-2 text-left">Consumo Replicado de</th>
                      <th className="p-2 text-center">Estado</th>
                      <th className="p-2 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {periodosProyeccion.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400">
                          No hay meses extendidos agregados manualmente. Use el formulario superior para extender el horizonte.
                        </td>
                      </tr>
                    ) : (
                      periodosProyeccion.map((p) => (
                        <tr key={p.id_proyeccion} className="hover:bg-slate-50">
                          <td className="p-2 font-mono font-bold text-slate-800">{p.periodo}</td>
                          <td className="p-2 text-slate-800 font-medium">{p.label}</td>
                          <td className="p-2 font-mono text-slate-600">{p.periodo_copia}</td>
                          <td className="p-2 text-center">
                            {p.es_oficial ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                                Oficializado por Ord. Suministro
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-purple-300 bg-purple-50 text-purple-700 text-[10px]">
                                Proyección Manual
                              </Badge>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteProyeccion(p.id_proyeccion)}
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              title="Eliminar mes del horizonte"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setHorizonteModalOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Plan de Producción Semanal por Línea */}
      <Dialog open={planModalOpen} onOpenChange={setPlanModalOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-900 text-lg">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              <span>Importar Plan de Producción Semanal por Línea</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Línea seleccionada: <strong className="text-slate-800">{activeSeccion?.nombre || "Headliner"}</strong>.
              Permite cargar la distribución de turnos por código SD, sumar automáticamente los turnos por día e impactar el cálculo de consumos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="md:col-span-2 space-y-2">
                <Label className="text-xs font-semibold text-slate-700">Archivo Excel del Plan (.xlsx)</Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={planFileInputRef}
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handlePlanFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => planFileInputRef.current?.click()}
                    className="border-dashed border-2 border-indigo-300 hover:border-indigo-500 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 w-full justify-center h-10 gap-2 font-medium"
                  >
                    <UploadCloud className="w-4 h-4 text-indigo-600" />
                    <span>{planFile ? planFile.name : "Seleccionar o arrastrar archivo de plan..."}</span>
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700">Lunes de Inicio (Semana)</Label>
                <div className="flex gap-1.5">
                  <Input
                    type="date"
                    value={planOverrideFecha}
                    onChange={(e) => setPlanOverrideFecha(e.target.value)}
                    className="text-xs h-10 bg-white"
                  />
                  {planFile && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => planFile && executePlanPreview(planFile, planOverrideFecha)}
                      disabled={planLoading}
                      className="h-10 px-2.5 text-xs text-indigo-700"
                      title="Re-analizar con nueva fecha"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${planLoading ? "animate-spin" : ""}`} />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {planLoading && (
              <div className="flex items-center justify-center p-8 bg-white border rounded-xl">
                <div className="flex flex-col items-center gap-2 text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                  <span className="text-xs font-medium">Interpretando turnos y mapeando SDs a piezas...</span>
                </div>
              </div>
            )}

            {planPreview && !planLoading && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-indigo-50/70 border border-indigo-100 rounded-lg p-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-600">
                      Período: <strong className="text-indigo-950 font-mono">{planPreview.fecha_inicio}</strong> al <strong className="text-indigo-950 font-mono">{planPreview.fecha_fin}</strong>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-600">
                      SDs Detectados: <strong className="text-indigo-950">{planPreview.filas.length}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-indigo-600 hover:bg-indigo-600 text-white font-mono text-xs">
                      Total Semana: {Math.round(planPreview.total_general).toLocaleString()} un.
                    </Badge>
                  </div>
                </div>

                {planPreview.advertencias.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-800 text-xs font-semibold">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Advertencias de mapeo:</span>
                    </div>
                    {planPreview.advertencias.map((adv, idx) => (
                      <p key={idx} className="text-xs text-amber-700 pl-5">
                        • {adv}
                      </p>
                    ))}
                  </div>
                )}

                <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto bg-white">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-700 border-b sticky top-0 z-10">
                      <tr>
                        <th className="p-2 text-left font-semibold">SD</th>
                        <th className="p-2 text-left font-semibold">Parte Toyota</th>
                        {planPreview.dias.map((d) => (
                          <th key={d.fecha} className="p-2 text-right font-semibold">
                            <div>{d.nombre.slice(0, 3)}</div>
                            <div className="text-[10px] font-normal text-slate-500 font-mono">
                              {d.fecha.slice(5).replace("-", "/")}
                            </div>
                          </th>
                        ))}
                        <th className="p-2 text-right font-semibold bg-indigo-50/50 text-indigo-950">Total</th>
                        <th className="p-2 text-center font-semibold">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {planPreview.filas.map((f) => (
                        <tr key={f.sd} className="hover:bg-slate-50">
                          <td className="p-2 font-mono font-bold text-slate-800">{f.sd}</td>
                          <td className="p-2 font-mono text-slate-600">
                            {f.id_producto ? (
                              <span>{f.id_producto}</span>
                            ) : (
                              <span className="text-amber-600 italic">Sin mapeo</span>
                            )}
                          </td>
                          {planPreview.dias.map((d) => {
                            const val = f.cantidades[d.fecha] || 0;
                            return (
                              <td
                                key={d.fecha}
                                className={`p-2 text-right font-mono ${val > 0 ? "font-semibold text-slate-900 bg-slate-50/40" : "text-slate-300"
                                  }`}
                              >
                                {val > 0 ? Math.round(val).toLocaleString() : "-"}
                              </td>
                            );
                          })}
                          <td className="p-2 text-right font-mono font-bold text-indigo-900 bg-indigo-50/40">
                            {Math.round(f.total_semana).toLocaleString()}
                          </td>
                          <td className="p-2 text-center">
                            {f.mapeado ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] gap-1 py-0 h-5">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Vinculado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-[10px]">
                                Pendiente
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t text-slate-900 sticky bottom-0">
                      <tr>
                        <td colSpan={2} className="p-2 text-right text-xs">
                          TOTAL DIARIO:
                        </td>
                        {planPreview.dias.map((d) => (
                          <td key={d.fecha} className="p-2 text-right font-mono text-xs text-indigo-900">
                            {Math.round(planPreview.totales_dia[d.fecha] || 0).toLocaleString()}
                          </td>
                        ))}
                        <td className="p-2 text-right font-mono text-xs text-indigo-950 bg-indigo-100/50">
                          {Math.round(planPreview.total_general).toLocaleString()}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between">
            <Button variant="outline" onClick={() => setPlanModalOpen(false)}>
              Cerrar
            </Button>
            <Button
              onClick={handleConfirmPlan}
              disabled={planSaving || planLoading || !planPreview || planPreview.filas.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              {planSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sincronizando producción...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar e Impactar Plan</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmDelete.isOpen}
        onOpenChange={(open) => setConfirmDelete((prev) => ({ ...prev, isOpen: open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-slate-900">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{confirmDelete.title}</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
              {confirmDelete.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel disabled={isDeletingItem}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isDeletingItem}
              onClick={async () => {
                setIsDeletingItem(true);
                try {
                  await confirmDelete.onConfirm();
                  setConfirmDelete((prev) => ({ ...prev, isOpen: false }));
                } finally {
                  setIsDeletingItem(false);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
            >
              {isDeletingItem ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Eliminando...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>{confirmDelete.actionText}</span>
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={umbralesModalOpen} onOpenChange={setUmbralesModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <SlidersHorizontal className="w-5 h-5 text-blue-600" />
              <span>Configuración de Semáforo ({report?.nombre_proveedor})</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <p className="text-xs text-slate-500">
              Define los umbrales de cobertura en días para clasificar el stock de este proveedor en el Rundown.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 p-3 rounded-lg border border-red-200 bg-red-50/40">
                <Label className="text-xs font-bold text-red-900 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
                  Alerta Crítica / Rojo
                </Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={umbralesForm.dias_rojo}
                    onChange={(e) =>
                      setUmbralesForm((prev) => ({
                        ...prev,
                        dias_rojo: Math.max(0, parseFloat(e.target.value) || 0),
                      }))
                    }
                    className="h-8 font-mono text-sm bg-white"
                  />
                  <span className="text-xs text-slate-500 font-medium">días</span>
                </div>
                <p className="text-[10px] text-red-700">
                  Menor a este valor se marcará en rojo con alerta de quiebre.
                </p>
              </div>

              <div className="space-y-1.5 p-3 rounded-lg border border-amber-200 bg-amber-50/40">
                <Label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  Precaución / Amarillo
                </Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={umbralesForm.dias_amarillo}
                    onChange={(e) =>
                      setUmbralesForm((prev) => ({
                        ...prev,
                        dias_amarillo: Math.max(0, parseFloat(e.target.value) || 0),
                      }))
                    }
                    className="h-8 font-mono text-sm bg-white"
                  />
                  <span className="text-xs text-slate-500 font-medium">días</span>
                </div>
                <p className="text-[10px] text-amber-700">
                  Entre rojo y este valor se marcará en amarillo como advertencia.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border rounded-lg text-xs space-y-1.5">
              <span className="font-semibold text-slate-700">Escala resultante para {report?.nombre_proveedor}:</span>
              <div className="flex items-center gap-2 pt-1 font-mono text-[11px]">
                <Badge className="bg-red-600 text-white">&lt; {umbralesForm.dias_rojo}d (Riesgo)</Badge>
                <Badge className="bg-amber-100 text-amber-800 border-amber-300">{umbralesForm.dias_rojo}d - {umbralesForm.dias_amarillo}d (Atención)</Badge>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">&gt; {umbralesForm.dias_amarillo}d (Óptimo)</Badge>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between">
            <Button variant="outline" onClick={() => setUmbralesModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveUmbrales}
              disabled={isSavingUmbrales || umbralesForm.dias_amarillo <= umbralesForm.dias_rojo}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {isSavingUmbrales ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Guardar Umbrales</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editProvModalOpen} onOpenChange={setEditProvModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Settings className="w-4 h-4 text-blue-600" />
              Configurar Proveedor
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Nombre del Proveedor</Label>
              <Input
                value={editProvForm.nombre}
                onChange={(e) => setEditProvForm({ ...editProvForm, nombre: e.target.value })}
                placeholder="Nombre del proveedor"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Línea Asignada</Label>
              <Select
                value={editProvForm.id_seccion ? String(editProvForm.id_seccion) : ""}
                onValueChange={(val) => setEditProvForm({ ...editProvForm, id_seccion: parseInt(val, 10) })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Seleccionar línea" />
                </SelectTrigger>
                <SelectContent>
                  {secciones.map((s) => (
                    <SelectItem key={s.id_seccion} value={String(s.id_seccion)}>
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-slate-50 border rounded-lg space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Modalidad de Depósito</Label>
              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit-prov-dep-planta"
                  checked={editProvForm.deposito_en_planta}
                  onChange={(e) => setEditProvForm({ ...editProvForm, deposito_en_planta: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 cursor-pointer"
                />
                <Label htmlFor="edit-prov-dep-planta" className="text-xs text-slate-700 font-normal cursor-pointer leading-relaxed">
                  <span className="font-semibold text-slate-900 block">Depósito unificado en Planta</span>
                  Stock único sin transferencias intermedias. Los cambios en el stock de planta y total se sincronizan en ambos rundowns.
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Umbrales de Semáforo de Riesgo</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 p-2.5 rounded-md border border-red-200 bg-red-50/40">
                  <Label className="text-[11px] font-bold text-red-900 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
                    Crítico / Rojo (&lt;)
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={editProvForm.dias_alerta_rojo}
                      onChange={(e) =>
                        setEditProvForm({
                          ...editProvForm,
                          dias_alerta_rojo: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="h-7 font-mono text-xs bg-white"
                    />
                    <span className="text-[11px] text-slate-500">días</span>
                  </div>
                </div>

                <div className="space-y-1 p-2.5 rounded-md border border-amber-200 bg-amber-50/40">
                  <Label className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    Atención / Amarillo (&lt;)
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={editProvForm.dias_alerta_amarillo}
                      onChange={(e) =>
                        setEditProvForm({
                          ...editProvForm,
                          dias_alerta_amarillo: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="h-7 font-mono text-xs bg-white"
                    />
                    <span className="text-[11px] text-slate-500">días</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1 p-2.5 rounded-md border border-blue-200 bg-blue-50/50 mt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-bold text-blue-900 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                    DOH Sugerido Planta (Objetivo)
                  </Label>
                  <span className="text-[10px] text-blue-600 font-medium">Cobertura piso de planta</span>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <Input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={editProvForm.doh_sugerido_planta}
                    onChange={(e) =>
                      setEditProvForm({
                        ...editProvForm,
                        doh_sugerido_planta: Math.max(0.1, parseFloat(e.target.value) || 1.0),
                      })
                    }
                    className="h-7 font-mono text-xs bg-white w-28"
                  />
                  <span className="text-[11px] text-slate-600">días de producción</span>
                </div>
                <p className="text-[10px] text-slate-500 pt-0.5">
                  Días de stock a mantener en planta para la sugerencia de pedidos diaria (independiente del DOH de TBAR).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="edit-prov-activo"
                checked={editProvForm.activo}
                onChange={(e) => setEditProvForm({ ...editProvForm, activo: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
              />
              <Label htmlFor="edit-prov-activo" className="text-xs text-slate-700 font-medium cursor-pointer">
                Proveedor activo en el sistema
              </Label>
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setEditProvModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitEditProveedor}
              disabled={
                isSavingEditProv ||
                !editProvForm.nombre.trim() ||
                editProvForm.dias_alerta_amarillo <= editProvForm.dias_alerta_rojo
              }
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {isSavingEditProv ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Guardar Cambios</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
