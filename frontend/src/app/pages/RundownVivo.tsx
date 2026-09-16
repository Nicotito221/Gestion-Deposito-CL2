import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
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
} from "lucide-react";
import { toast } from "sonner";
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
  updateRundownScrap,
  getRundownCalendarioMes,
  saveRundownCalendarioMes,
  searchMaterialesCatalogo,
  getProveedorMateriales,
  addProveedorMaterial,
  deleteProveedorMaterial,
  getPeriodosProyeccion,
  createPeriodoProyeccion,
  deletePeriodoProyeccion,
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
} from "../services/api";

export function RundownVivo() {
  const [secciones, setSecciones] = useState<RundownSeccionItem[]>([]);
  const [selectedSeccionId, setSelectedSeccionId] = useState<number>(0);
  const [selectedSupplierCode, setSelectedSupplierCode] = useState<string>("HOWA");
  const [alcance, setAlcance] = useState<"total" | "planta">("total");
  const [selectedPeriodo, setSelectedPeriodo] = useState<string>("2026-09");

  const [report, setReport] = useState<RundownSupplierReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [activeMaterialTab, setActiveMaterialTab] = useState<string>("todos");

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
  const [newProvForm, setNewProvForm] = useState({ codigo_proveedor: "", nombre: "", id_seccion: 0 });
  const [isSavingAdmin, setIsSavingAdmin] = useState<boolean>(false);

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
  });

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

  const [scrapModalOpen, setScrapModalOpen] = useState<boolean>(false);
  const [scrapTargetMat, setScrapTargetMat] = useState<RundownMaterialGrid | null>(null);
  const [scrapInputVal, setScrapInputVal] = useState<string>("0");
  const [savingScrap, setSavingScrap] = useState<boolean>(false);

  const [calModalOpen, setCalModalOpen] = useState<boolean>(false);
  const [calData, setCalData] = useState<RundownCalendarioMesOut | null>(null);
  const [calLoading, setCalLoading] = useState<boolean>(false);
  const [calSaving, setCalSaving] = useState<boolean>(false);
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
      toast.error("Error al cargar secciones de rundown");
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
    return activeSeccion.proveedores.find((p) => p.codigo_proveedor === selectedSupplierCode) || null;
  }, [activeSeccion, selectedSupplierCode]);

  const fetchRundown = useCallback(async () => {
    if (!selectedSupplierCode) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getSupplierRundown(selectedSupplierCode, undefined, undefined, alcance, selectedPeriodo || undefined);
      setReport(data);
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al consultar rundown";
      setErrorMsg(msg);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [selectedSupplierCode, alcance, selectedPeriodo]);

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

  const filteredMaterials = useMemo(() => {
    if (!report) return [];
    if (activeMaterialTab === "todos") return report.materiales;
    return report.materiales.filter((m) => m.id_material === activeMaterialTab);
  }, [report, activeMaterialTab]);

  const kpis = useMemo(() => {
    if (!report) {
      return { totalDias: 0, totalAlertas: 0, quiebresCount: 0 };
    }
    let totalAlertas = 0;
    for (const mat of report.materiales) {
      for (const d of mat.dias) {
        if (d.alerta_quiebre) {
          totalAlertas++;
        }
      }
    }
    return {
      totalDias: report.columnas_fechas.length,
      totalAlertas,
      quiebresCount: totalAlertas,
    };
  }, [report]);

  const handleOpenTransito = (materialId?: string) => {
    if (!report) return;
    setTransitoForm({
      id_proveedor: report.id_proveedor,
      id_material: materialId || (report.materiales[0]?.id_material ?? ""),
      fecha_eta: report.columnas_fechas[0] || "2026-09-01",
      tipo_via: "Maritimo",
      po_numero: "",
      factura_numero: "",
      cantidad: 0,
      observacion: "",
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
    currentVal: number
  ) => {
    setIngresoEditForm({
      id_material: materialId,
      fecha_origen: fechaEta,
      fecha_eta: fechaEta,
      dia_nombre: diaNombre,
      tipo_via: tipoVia,
      cantidad: currentVal,
      po_numero: "",
      factura_numero: "",
      observacion: "",
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
      await upsertRundownIngresoDia({
        id_proveedor: report.id_proveedor,
        id_material: ingresoEditForm.id_material,
        fecha_eta: ingresoEditForm.fecha_eta,
        tipo_via: ingresoEditForm.tipo_via,
        cantidad: ingresoEditForm.cantidad,
        po_numero: ingresoEditForm.po_numero.trim() || undefined,
        factura_numero: ingresoEditForm.factura_numero.trim() || undefined,
        observacion: ingresoEditForm.observacion.trim() || undefined,
        fecha_origen: isShifted ? ingresoEditForm.fecha_origen : undefined,
      });
      toast.success(
        isShifted
          ? `Pedido desplazado del ${ingresoEditForm.fecha_origen} al ${ingresoEditForm.fecha_eta}`
          : "Ingreso actualizado correctamente"
      );
      setEditIngresoModalOpen(false);
      await fetchRundown();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar ingreso");
    } finally {
      setIsSavingIngreso(false);
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

    setStockForm({
      id_parametro: mat.id_parametro,
      id_proveedor: report.id_proveedor,
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
      await fetchRundown();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al actualizar stock";
      toast.error(msg);
    } finally {
      setIsSavingStock(false);
    }
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
      await fetchRundown();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al actualizar scrap";
      toast.error(msg);
    } finally {
      setSavingScrap(false);
    }
  };

  const handleCreateSeccion = async () => {
    if (!newSeccionForm.nombre.trim()) {
      toast.error("El nombre de la sección es obligatorio");
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
      toast.success("Sección creada correctamente");
      setNewSeccionForm({ codigo: "", nombre: "", descripcion: "" });
      await fetchSecciones();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear sección");
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
      });
      toast.success("Proveedor registrado correctamente");
      setNewProvForm({ codigo_proveedor: "", nombre: "", id_seccion: selectedSeccionId });
      await fetchSecciones();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar proveedor");
    } finally {
      setIsSavingAdmin(false);
    }
  };

  const handleReassignProveedor = async (idProveedor: number, newSeccionId: number) => {
    try {
      await updateRundownProveedor(idProveedor, { id_seccion: newSeccionId });
      toast.success("Sección del proveedor actualizada");
      await fetchSecciones();
    } catch {
      toast.error("Error al reasignar proveedor");
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
    setNewMaterialForm((prev) => ({
      ...prev,
      id_material: item.id_material,
      descripcion: item.nombre || item.id_material,
      unidad: item.unidad || "MTS",
    }));
    setCatalogoSearchResults([]);
    setCatalogoSearchQuery(item.id_material);
  };

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

  const loadCalendarioMes = useCallback(async (anio: number, mes: number) => {
    setCalLoading(true);
    try {
      const data = await getRundownCalendarioMes(anio, mes);
      setCalData(data);
      setCalSelectedAnio(anio);
      setCalSelectedMes(mes);
    } catch {
      toast.error("Error al cargar calendario mensual");
    } finally {
      setCalLoading(false);
    }
  }, []);

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
    loadCalendarioMes(targetAnio, targetMes);
    setCalModalOpen(true);
  }, [selectedPeriodo, loadCalendarioMes]);

  const handleToggleDiaLaboral = (fecha: string) => {
    if (!calData) return;
    const newDias = calData.dias.map((d) =>
      d.fecha === fecha ? { ...d, es_laboral: !d.es_laboral } : d
    );
    const newLaboralesCount = newDias.filter((d) => d.es_laboral).length;
    const newPromedio = newLaboralesCount > 0
      ? Math.round((calData.volumen_total_planificado / newLaboralesCount) * 10) / 10
      : 0;
    setCalData({
      ...calData,
      dias: newDias,
      dias_laborales_count: newLaboralesCount,
      promedio_diario_estimado: newPromedio,
    });
  };

  const handlePresetDias = (tipo: "lun_vie" | "todos_sabados" | "sin_sabados") => {
    if (!calData) return;
    const newDias = calData.dias.map((d) => {
      let esLab = d.es_laboral;
      if (tipo === "lun_vie") {
        esLab = d.dia_semana < 5;
      } else if (tipo === "todos_sabados") {
        if (d.dia_semana === 5) esLab = true;
      } else if (tipo === "sin_sabados") {
        if (d.dia_semana === 5) esLab = false;
      }
      return { ...d, es_laboral: esLab };
    });
    const newLaboralesCount = newDias.filter((d) => d.es_laboral).length;
    const newPromedio = newLaboralesCount > 0
      ? Math.round((calData.volumen_total_planificado / newLaboralesCount) * 10) / 10
      : 0;
    setCalData({
      ...calData,
      dias: newDias,
      dias_laborales_count: newLaboralesCount,
      promedio_diario_estimado: newPromedio,
    });
  };

  const handleSaveCalendario = async () => {
    if (!calData) return;
    setCalSaving(true);
    try {
      await saveRundownCalendarioMes({
        anio: calData.anio,
        mes: calData.mes,
        dias: calData.dias.map((d) => ({
          fecha: d.fecha,
          es_laboral: d.es_laboral,
          observacion: d.observacion,
        })),
      });
      toast.success(`Calendario de ${calData.mes_nombre} guardado exitosamente`);
      setCalModalOpen(false);
      await fetchRundown();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar calendario");
    } finally {
      setCalSaving(false);
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
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                  alcance === "planta"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Warehouse className="w-3.5 h-3.5 text-blue-600" />
                <span>Pedido a CL2 (Stock en Planta)</span>
              </button>
              <button
                type="button"
                onClick={() => setAlcance("total")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                  alcance === "total"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Globe2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Pedido a Proveedor (Stock Total)</span>
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            {alcance === "planta"
              ? "Planificación para abastecimiento de Planta desde Depósito CL2 (contempla inventario en planta)."
              : "Planificación para compras y pedidos directos al Proveedor (contempla stock total consolidado)."}
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

      <div className="bg-white border rounded-xl p-3 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-2 border-b pb-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
            Sección / Línea:
          </span>
          {secciones.map((sec) => (
            <Button
              key={sec.id_seccion}
              size="sm"
              variant={selectedSeccionId === sec.id_seccion ? "default" : "outline"}
              onClick={() => {
                setSelectedSeccionId(sec.id_seccion);
                if (sec.proveedores.length > 0) {
                  const hasHowa = sec.proveedores.find((p) => p.codigo_proveedor === "HOWA");
                  setSelectedSupplierCode(hasHowa ? "HOWA" : sec.proveedores[0].codigo_proveedor);
                } else {
                  setSelectedSupplierCode("");
                }
              }}
              className="text-xs h-8 font-medium"
            >
              {sec.nombre}
              <span className="ml-1.5 text-[10px] opacity-70">
                ({sec.proveedores.length})
              </span>
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
            Proveedores en {activeSeccion?.nombre || "Línea"}:
          </span>
          {activeSeccion && activeSeccion.proveedores.length > 0 ? (
            activeSeccion.proveedores.map((prov) => (
              <Button
                key={prov.id_proveedor}
                size="sm"
                variant={selectedSupplierCode === prov.codigo_proveedor ? "default" : "outline"}
                onClick={() => setSelectedSupplierCode(prov.codigo_proveedor)}
                className={`text-xs h-8 font-mono ${
                  selectedSupplierCode === prov.codigo_proveedor
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "text-slate-700"
                }`}
              >
                {prov.nombre}
                {prov.tiene_parametros && (
                  <span className="ml-1.5 w-2 h-2 rounded-full bg-emerald-400 inline-block" title="Rundown activo" />
                )}
              </Button>
            ))
          ) : (
            <span className="text-xs text-slate-400 italic">
              No hay proveedores asignados a esta sección. Haz clic en "Configurar Secciones" para vincularlos.
            </span>
          )}
        </div>

        {report && report.meses_disponibles && report.meses_disponibles.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
                Período:
              </span>
              {report.meses_disponibles.map((p) => (
                <Button
                  key={p.periodo}
                  size="sm"
                  variant={selectedPeriodo === p.periodo ? "default" : "outline"}
                  onClick={() => setSelectedPeriodo(p.periodo)}
                  className={`text-xs h-8 font-medium ${
                    selectedPeriodo === p.periodo
                      ? "bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  {p.label}
                  {p.es_firme ? (
                    <Badge className="ml-1.5 bg-emerald-600 text-white text-[9px] px-1 py-0 h-4 hover:bg-emerald-600">
                      Firme
                    </Badge>
                  ) : p.es_proyectado_manual ? (
                    <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 h-4 border-purple-300 bg-purple-50 text-purple-700 font-bold">
                      Extendido
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 h-4 border-slate-300 text-slate-500">
                      Proyección
                    </Badge>
                  )}
                </Button>
              ))}

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

            {!report.es_mes_firme && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[11px] bg-blue-50 text-blue-700 border-blue-200 font-medium">
                  <CalendarDays className="w-3.5 h-3.5 mr-1 text-blue-600" />
                  {report.dias_laborales_mes} días laborales (Promedio diario)
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
                  Editar días de este mes
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Proveedor</p>
                <h3 className="text-base font-bold text-slate-900 truncate">
                  {report.nombre_proveedor}
                </h3>
                <p className="text-[11px] text-slate-400">Sección: {activeSeccion?.nombre || "Headliner"}</p>
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

          <Card className="border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Espumas en Rundown</p>
                <h3 className="text-base font-bold text-slate-900">
                  {report.materiales.length} espumas
                </h3>
                <p className="text-[11px] text-slate-400 truncate">
                  {report.materiales.map((m) => m.id_material).join(", ")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className={`border shadow-sm ${kpis.quiebresCount > 0 ? "border-red-200 bg-red-50/20" : ""}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${kpis.quiebresCount > 0 ? "bg-red-100 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
                {kpis.quiebresCount > 0 ? <AlertTriangle className="w-5 h-5" /> : <PackageCheck className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Alertas de Cobertura</p>
                <div className="flex items-center gap-2">
                  <h3 className={`text-base font-bold ${kpis.quiebresCount > 0 ? "text-red-700" : "text-emerald-700"}`}>
                    {kpis.quiebresCount} días en riesgo
                  </h3>
                  {kpis.quiebresCount > 0 && (
                    <Badge className="bg-red-600 text-white text-[10px] px-1.5 py-0">
                      {"< 5 días"}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">Riesgo inminente de quiebre</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {report && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 border rounded-lg shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <Button
              size="sm"
              variant={activeMaterialTab === "todos" ? "default" : "outline"}
              onClick={() => setActiveMaterialTab("todos")}
              className="text-xs h-8"
            >
              Todas las espumas ({report.materiales.length})
            </Button>
            {report.materiales.map((m) => (
              <Button
                key={m.id_material}
                size="sm"
                variant={activeMaterialTab === m.id_material ? "default" : "outline"}
                onClick={() => setActiveMaterialTab(m.id_material)}
                className="text-xs h-8 font-mono"
              >
                {m.id_material}
              </Button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
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
            Este proveedor está registrado en la sección <strong>{activeSeccion?.nombre}</strong>. Sus recetas de consumo y materiales aún no han sido configurados en el sistema.
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
            <div className="min-w-max divide-y divide-slate-200">
              {filteredMaterials.map((mat) => (
                <div key={mat.id_material} className="p-0">
                  <div className="bg-slate-100/90 border-b border-slate-200">
                    <div className="sticky left-0 z-20 px-4 py-2 flex items-center gap-3 w-fit bg-slate-100/95 border-r border-slate-300 shadow-xs">
                      <span className="font-mono text-base font-bold text-slate-900">
                        {mat.id_material}
                      </span>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenTransito(mat.id_material)}
                        className="h-7 text-xs flex items-center gap-1 text-blue-700 border-blue-200 bg-blue-50/50 hover:bg-blue-100"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Arribo</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenStockModal(mat)}
                        className="h-7 text-xs flex items-center gap-1 text-slate-600 border border-slate-200 bg-white hover:bg-slate-100 shadow-xs"
                        title="Ajustar stock inicial"
                      >
                        <Edit3 className="w-3 h-3 text-slate-500" />
                        <span>Editar Stock</span>
                      </Button>

                      <span className="text-xs text-slate-500 ml-1">
                        Lote: <strong className="text-slate-700">{mat.lote_mts ? `${mat.lote_mts} ${mat.unidad}` : "—"}</strong>
                      </span>

                      <button
                        type="button"
                        onClick={() => handleOpenScrapModal(mat)}
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors shadow-xs ml-1"
                        title="Haga clic para editar porcentaje de scrap"
                      >
                        <Percent className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-500">Scrap:</span>
                        <strong className="text-slate-900 font-mono font-bold">
                          {(mat.scrap_porcentaje * 100).toFixed(1)}%
                        </strong>
                        <Edit3 className="w-3 h-3 text-slate-400 hover:text-slate-600 ml-0.5" />
                      </button>
                    </div>
                  </div>

                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200">
                        <th className="sticky left-0 z-10 bg-slate-100 text-left font-semibold text-slate-700 px-3 py-2 w-48 border-r border-slate-200">
                          Concepto / Fecha
                        </th>
                        {mat.dias.map((d) => (
                          <th key={d.fecha} className="px-2 py-1.5 text-center font-semibold text-slate-700 min-w-[90px] border-r border-slate-200">
                            <div className="text-[11px] font-mono text-slate-900">{d.dia_nombre.split(" ")[0]}</div>
                            <div className="text-[10px] text-slate-500 font-normal">{d.dia_nombre.split(" ")[1]}</div>
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
                            const pedidoVal = d.plan_maritimo + d.pedidos_aereos;
                            return (
                              <td
                                key={d.fecha}
                                onClick={() => handleCellClickIngreso(mat.id_material, d.fecha, d.dia_nombre, "Maritimo", pedidoVal)}
                                className="px-2 py-1.5 text-center font-mono border-r border-slate-100 cursor-pointer hover:bg-blue-100/70 transition-colors"
                                title="Haz clic para editar pedido a CL2"
                              >
                                {pedidoVal > 0 ? (
                                  <span className="bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded text-[11px] hover:bg-blue-200">
                                    +{pedidoVal.toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 hover:text-slate-600 text-[11px]">—</span>
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
                            {mat.dias.map((d) => (
                              <td
                                key={d.fecha}
                                onClick={() => handleCellClickIngreso(mat.id_material, d.fecha, d.dia_nombre, "Maritimo", d.plan_maritimo)}
                                className="px-2 py-1.5 text-center font-mono border-r border-slate-100 cursor-pointer hover:bg-blue-100/70 transition-colors"
                                title="Haz clic para editar arribo marítimo"
                              >
                                {d.plan_maritimo > 0 ? (
                                  <span className="bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded text-[11px] hover:bg-blue-200">
                                    +{d.plan_maritimo.toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 hover:text-slate-600 text-[11px]">—</span>
                                )}
                              </td>
                            ))}
                          </tr>

                          <tr className="hover:bg-purple-50/30">
                            <td className="sticky left-0 z-10 bg-white font-medium text-purple-700 px-3 py-1.5 border-r border-slate-200 flex items-center gap-1.5">
                              <Plane className="w-3.5 h-3.5 text-purple-600" />
                              <span>Pedidos Aéreos</span>
                            </td>
                            {mat.dias.map((d) => (
                              <td
                                key={d.fecha}
                                onClick={() => handleCellClickIngreso(mat.id_material, d.fecha, d.dia_nombre, "Aereo", d.pedidos_aereos)}
                                className="px-2 py-1.5 text-center font-mono border-r border-slate-100 cursor-pointer hover:bg-purple-100/70 transition-colors"
                                title="Haz clic para editar pedido aéreo"
                              >
                                {d.pedidos_aereos > 0 ? (
                                  <span className="bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded text-[11px] hover:bg-purple-200">
                                    +{d.pedidos_aereos.toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 hover:text-slate-600 text-[11px]">—</span>
                                )}
                              </td>
                            ))}
                          </tr>
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
                                  className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                                    desvio > 0
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
                            className={`px-2 py-2 text-center font-mono text-xs border-r border-slate-200 cursor-pointer transition-colors hover:ring-2 hover:ring-blue-500/50 ${
                              d.tiene_ajuste
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
                          let badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300";
                          if (d.alerta_quiebre || d.dias_cobertura < 5) {
                            badgeClass = "bg-red-600 text-white font-bold animate-pulse";
                          } else if (d.dias_cobertura <= 15) {
                            badgeClass = "bg-amber-100 text-amber-800 border-amber-300 font-semibold";
                          }
                          return (
                            <td key={d.fecha} className="px-2 py-1.5 text-center border-r border-slate-100">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-mono border ${badgeClass}`}>
                                {d.dias_cobertura >= 900 ? "∞" : `${d.dias_cobertura.toFixed(1)}d`}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
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
                <Label>Cantidad (Metros) *</Label>
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

          <DialogFooter className="pt-2">
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adminModalOpen} onOpenChange={setAdminModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              <span>Administrar Rundown — Secciones, Proveedores y Materiales</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex border-b">
              <button
                onClick={() => setAdminTab("secciones")}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  adminTab === "secciones"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                Secciones / Líneas
              </button>
              <button
                onClick={() => setAdminTab("proveedores")}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  adminTab === "proveedores"
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
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  adminTab === "materiales"
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
                    <span>Nueva Sección</span>
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
                      {isSavingAdmin ? "Guardando..." : "Agregar Sección"}
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
                        <SelectValue placeholder="Sección" />
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
                </div>

                <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-700 border-b">
                      <tr>
                        <th className="p-2 text-left">Proveedor</th>
                        <th className="p-2 text-left">Sección Asignada</th>
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
                                <SelectValue placeholder="Asignar sección" />
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
                            <Badge variant="outline" className="text-[10px]">
                              {m.unidad}
                            </Badge>
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
                              <td className="p-2 text-center font-mono">{m.lote_mts ? m.lote_mts.toLocaleString() : "—"}</td>
                              <td className="p-2 text-center font-mono">{(m.scrap_porcentaje * 100).toFixed(1)}%</td>
                              <td className="p-2 text-center">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    m.cant_productos > 0
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
                              <td className="p-2 text-center">
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
                <Label>Cantidad (Metros) *</Label>
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
                <Label>Stock de Arranque (Metros) *</Label>
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
              El valor ingresado se toma como el <strong>stock real de arranque</strong> para la fecha <strong>{stockForm.fecha}</strong>, recalculando y encadenando el saldo teórico hacia todos los días posteriores.
            </p>
          </div>

          <DialogFooter className="pt-2">
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

      <Dialog open={calModalOpen} onOpenChange={setCalModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pr-6">
              <DialogTitle className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-blue-600" />
                <span>Calendario Productivo — Días Laborales</span>
              </DialogTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Mes:</span>
                <Select
                  value={`${calSelectedAnio}-${calSelectedMes.toString().padStart(2, "0")}`}
                  onValueChange={(val) => {
                    const [a, m] = val.split("-").map(Number);
                    loadCalendarioMes(a, m);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs w-44 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(report?.meses_disponibles || [
                      { periodo: "2026-09", anio: 2026, mes: 9, label: "Septiembre 2026", es_firme: true },
                      { periodo: "2026-10", anio: 2026, mes: 10, label: "Octubre 2026", es_firme: false },
                      { periodo: "2026-11", anio: 2026, mes: 11, label: "Noviembre 2026", es_firme: false },
                      { periodo: "2026-12", anio: 2026, mes: 12, label: "Diciembre 2026", es_firme: false },
                      { periodo: "2027-01", anio: 2027, mes: 1, label: "Enero 2027", es_firme: false },
                      { periodo: "2027-02", anio: 2027, mes: 2, label: "Febrero 2027", es_firme: false },
                    ]).map((m) => (
                      <SelectItem key={m.periodo} value={m.periodo} className="text-xs">
                        {m.label} {m.es_firme ? "(Firme)" : "(Proyección)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogHeader>

          {calLoading ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600" />
              <p className="text-xs">Cargando días del calendario...</p>
            </div>
          ) : calData ? (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-lg">
                  <span className="text-[10px] font-semibold uppercase text-emerald-700">Días Laborales</span>
                  <p className="text-xl font-black text-emerald-900 mt-0.5">{calData.dias_laborales_count}</p>
                  <p className="text-[10px] text-emerald-600">Días de producción</p>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] font-semibold uppercase text-slate-500">Días No Laborales</span>
                  <p className="text-xl font-black text-slate-800 mt-0.5">
                    {calData.dias.length - calData.dias_laborales_count}
                  </p>
                  <p className="text-[10px] text-slate-500">Descansos y feriados</p>
                </div>
                <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-lg">
                  <span className="text-[10px] font-semibold uppercase text-blue-700">Volumen Planificado</span>
                  <p className="text-xl font-black text-blue-950 mt-0.5">
                    {calData.volumen_total_planificado.toLocaleString("es-AR")}
                  </p>
                  <p className="text-[10px] text-blue-600">Unidades vehiculares</p>
                </div>
                <div className="p-2.5 bg-indigo-50/60 border border-indigo-200 rounded-lg">
                  <span className="text-[10px] font-semibold uppercase text-indigo-700">Promedio Diario</span>
                  <p className="text-xl font-black text-indigo-950 mt-0.5">
                    {calData.promedio_diario_estimado.toLocaleString("es-AR")}
                  </p>
                  <p className="text-[10px] text-indigo-600">Vehículos / día laboral</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-lg border text-xs">
                <span className="text-slate-600 font-medium">Ajustes rápidos:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetDias("lun_vie")}
                    className="h-7 text-xs bg-white"
                  >
                    Solo Lun-Vie
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetDias("todos_sabados")}
                    className="h-7 text-xs bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  >
                    + Todos los Sábados
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetDias("sin_sabados")}
                    className="h-7 text-xs bg-white text-slate-700"
                  >
                    - Quitar Sábados
                  </Button>
                </div>
              </div>

              <div>
                <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-slate-500 mb-1">
                  <div>LUN</div>
                  <div>MAR</div>
                  <div>MIÉ</div>
                  <div>JUE</div>
                  <div>VIE</div>
                  <div className="text-blue-600">SÁB</div>
                  <div className="text-red-500">DOM</div>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {calData.dias.length > 0 && Array.from({ length: calData.dias[0].dia_semana }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="h-16 rounded border border-transparent bg-slate-50/30" />
                  ))}

                  {calData.dias.map((d) => {
                    const isSaturday = d.dia_semana === 5;
                    const isSunday = d.dia_semana === 6;
                    return (
                      <button
                        key={d.fecha}
                        type="button"
                        onClick={() => handleToggleDiaLaboral(d.fecha)}
                        className={`h-16 p-1.5 rounded-lg border text-left flex flex-col justify-between transition-all select-none ${
                          d.es_laboral
                            ? "border-emerald-400 bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-950 shadow-xs"
                            : "border-slate-200 bg-slate-100/80 hover:bg-slate-200/60 text-slate-400"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`text-xs font-black ${d.es_laboral ? "text-emerald-950" : "text-slate-500"}`}>
                            {d.dia}
                          </span>
                          {isSaturday && (
                            <span className="text-[9px] font-bold px-1 rounded bg-blue-100 text-blue-700">
                              Sáb
                            </span>
                          )}
                          {isSunday && (
                            <span className="text-[9px] font-bold px-1 rounded bg-red-100 text-red-700">
                              Dom
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between w-full">
                          <span
                            className={`text-[10px] font-bold ${
                              d.es_laboral ? "text-emerald-700" : "text-slate-400"
                            }`}
                          >
                            {d.es_laboral ? "Laboral" : "No lab."}
                          </span>
                          <span
                            className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold ${
                              d.es_laboral ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-600"
                            }`}
                          >
                            {d.es_laboral ? "✓" : "—"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Haz clic sobre cualquier día para alternar entre laboral y no laboral. Los cambios recalcularán automáticamente el promedio diario de unidades a producir.
              </p>
            </div>
          ) : null}

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setCalModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveCalendario}
              disabled={calSaving || calLoading}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {calSaving ? "Guardando..." : "Guardar Calendario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
