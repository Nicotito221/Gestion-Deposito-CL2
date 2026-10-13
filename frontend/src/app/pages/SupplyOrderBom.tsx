import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
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
  Upload,
  FileSpreadsheet,
  FileText,
  Layers,
  Plus,
  Search,
  CheckCircle2,
  Calendar,
  Download,
  RefreshCw,
  Clock,
  Trash2,
  Edit2,
  GitFork,
  AlertCircle,
  X,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { CalendarioLaboralModal } from "../components/CalendarioLaboralModal";
import {
  getBomVersions,
  getBomEstructuraActiva,
  getSetComponentes,
  createSetComponente,
  updateSetComponente,
  toggleSetComponente,
  uploadBomFile,
  getSupplySummary,
  consolidateSupply,
  downloadExcelConsolidado,
  downloadSapPirTxt,
  updateSupplyDailyProduction,
  type BomVersionItem,
  type BomEstructuraItem,
  type SetComponenteItem,
  type DemandItemApi,
} from "../services/api";
import { useAuth } from "../context/AuthContext";

export function SupplyOrderBom() {
  const { user: currentUser } = useAuth();
  const canEdit = Boolean(
    currentUser &&
      ["administrador", "gerente", "jefe", "analista"].includes(currentUser.rol?.toLowerCase() || "")
  );

  const [demandItems, setDemandItems] = useState<DemandItemApi[]>([]);
  const [dailyColumns, setDailyColumns] = useState<string[]>([]);
  const [tentativeColumns, setTentativeColumns] = useState<string[]>([]);
  const [dateMap, setDateMap] = useState<Record<string, string>>({});
  const [editingCell, setEditingCell] = useState<{ partNumber: string; col: string; value: string } | null>(null);
  const [savingCell, setSavingCell] = useState<boolean>(false);
  const [periodo, setPeriodo] = useState<string>("Octubre 2026");
  const [relations, setRelations] = useState<SetComponenteItem[]>([]);
  const [versions, setVersions] = useState<BomVersionItem[]>([]);
  const [bomEstructura, setBomEstructura] = useState<BomEstructuraItem[]>([]);
  const [bomEstructuraTotal, setBomEstructuraTotal] = useState<number>(0);
  const [searchEstructura, setSearchEstructura] = useState<string>("");
  const [activeBomSubTab, setActiveBomSubTab] = useState<"estructura" | "sets">("estructura");

  const [calModalOpen, setCalModalOpen] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [searchDemand, setSearchDemand] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  const [searchRelation, setSearchRelation] = useState<string>("");
  const [filterSector, setFilterSector] = useState<string>("todos");

  const [f1Files, setF1Files] = useState<File[]>([]);
  const [f2Files, setF2Files] = useState<File[]>([]);
  const [isProcessingDemand, setIsProcessingDemand] = useState<boolean>(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState<boolean>(false);
  const [isDownloadingSap, setIsDownloadingSap] = useState<boolean>(false);
  const [sapModalOpen, setSapModalOpen] = useState<boolean>(false);
  const [sapAplicarCorte, setSapAplicarCorte] = useState<boolean>(true);
  const [sapFechaCorte, setSapFechaCorte] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });

  const [bomFile, setBomFile] = useState<File | null>(null);
  const [isUploadingBom, setIsUploadingBom] = useState<boolean>(false);

  const [relationDialogOpen, setRelationDialogOpen] = useState<boolean>(false);
  const [editingRelation, setEditingRelation] = useState<SetComponenteItem | null>(null);
  const [relationForm, setRelationForm] = useState({
    sector: "Seat",
    sd: "",
    codigo_tasa: "",
    codigo_sap_padre: "",
    id_material_hijo: "",
    cantidad: "1",
    unidad: "UN",
  });
  const [relationErrors, setRelationErrors] = useState<Record<string, string>>({});
  const [isSavingRelation, setIsSavingRelation] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [versionsData, relationsData, supplyData, estructuraData] = await Promise.all([
        getBomVersions().catch(() => []),
        getSetComponentes({ limit: 500 }).catch(() => ({ items: [], total: 0 })),
        getSupplySummary().catch(() => ({
          periodo: "Septiembre 2026",
          total_demanda: 0,
          piezas_validadas: 0,
          total_piezas: 0,
          columnas_diarias: [],
          columnas_tentativas: [],
          items: [],
        })),
        getBomEstructuraActiva({ limit: 300 }).catch(() => ({ id_version: null, nombre_archivo: null, total: 0, items: [] })),
      ]);

      setVersions(versionsData);
      setRelations(relationsData.items);
      setBomEstructura(estructuraData.items);
      setBomEstructuraTotal(estructuraData.total);
      setDemandItems(supplyData.items);
      setPeriodo(supplyData.periodo);
      setDailyColumns(supplyData.columnas_diarias || []);
      setTentativeColumns(supplyData.columnas_tentativas || []);
      setDateMap(supplyData.columnas_fechas_map || {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al conectar con el servidor";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const parsePeriodoToAnioMes = useCallback((pStr: string): { anio: number; mes: number } => {
    const MESES: Record<string, number> = {
      enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
      julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
    };
    const parts = (pStr || "").trim().toLowerCase().split(/\s+/);
    if (parts.length >= 2) {
      const mes = MESES[parts[0]] || 10;
      const anio = parseInt(parts[1], 10) || new Date().getFullYear();
      return { anio, mes };
    }
    return { anio: new Date().getFullYear(), mes: new Date().getMonth() + 1 };
  }, []);

  const { anio: calAnio, mes: calMes } = useMemo(() => {
    return parsePeriodoToAnioMes(periodo);
  }, [periodo, parsePeriodoToAnioMes]);

  const handleOpenCalendario = () => {
    setCalModalOpen(true);
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredDemand = useMemo(() => {
    return demandItems.filter((item) => {
      const matchSearch =
        item.part_number.toLowerCase().includes(searchDemand.toLowerCase()) ||
        item.tasa_code.toLowerCase().includes(searchDemand.toLowerCase()) ||
        item.description.toLowerCase().includes(searchDemand.toLowerCase());
      const matchStatus =
        filterStatus === "todos" ? true : item.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [demandItems, searchDemand, filterStatus]);

  const extractedDaily = useMemo(() => {
    if (dailyColumns.length > 0) return dailyColumns;
    const daySet = new Set<string>();
    for (const it of demandItems) {
      if (it.daily_values) {
        Object.keys(it.daily_values).forEach((k) => daySet.add(k));
      }
    }
    return Array.from(daySet).sort((a, b) => {
      const ma = a.match(/^(\d{1,2})/);
      const mb = b.match(/^(\d{1,2})/);
      const na = ma ? parseInt(ma[1], 10) : 999;
      const nb = mb ? parseInt(mb[1], 10) : 999;
      return na - nb;
    });
  }, [dailyColumns, demandItems]);

  const dailyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const col of extractedDaily) {
      totals[col] = 0;
    }
    for (const item of filteredDemand) {
      for (const col of extractedDaily) {
        totals[col] += item.daily_values?.[col] || 0;
      }
    }
    return totals;
  }, [filteredDemand, extractedDaily]);

  const tentativeTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const col of tentativeColumns) {
      totals[col] = 0;
    }
    for (const item of filteredDemand) {
      for (const col of tentativeColumns) {
        totals[col] += item.tentative_values?.[col] ?? item.daily_values?.[col] ?? 0;
      }
    }
    return totals;
  }, [filteredDemand, tentativeColumns]);

  const grandTotal = useMemo(() => {
    return filteredDemand.reduce((acc, curr) => acc + curr.total, 0);
  }, [filteredDemand]);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const filteredRelations = useMemo(() => {
    return relations.filter((rel) => {
      const matchSearch =
        rel.codigo_tasa.toLowerCase().includes(searchRelation.toLowerCase()) ||
        rel.codigo_sap_padre.toLowerCase().includes(searchRelation.toLowerCase()) ||
        rel.id_material_hijo.toLowerCase().includes(searchRelation.toLowerCase()) ||
        (rel.descripcion_hijo && rel.descripcion_hijo.toLowerCase().includes(searchRelation.toLowerCase()));
      const matchSector =
        filterSector === "todos" ? true : rel.sector === filterSector;
      return matchSearch && matchSector;
    });
  }, [relations, searchRelation, filterSector]);

  const sectorsList = useMemo(() => {
    const list = new Set(relations.map((r) => r.sector).filter(Boolean) as string[]);
    return Array.from(list);
  }, [relations]);

  const activeVersion = useMemo(() => {
    return versions.find((v) => v.es_vigente) ?? versions[0];
  }, [versions]);

  const filteredEstructura = useMemo(() => {
    if (!searchEstructura.trim()) return bomEstructura;
    const q = searchEstructura.toLowerCase();
    return bomEstructura.filter(
      (it) =>
        it.id_producto_raiz.toLowerCase().includes(q) ||
        it.id_padre.toLowerCase().includes(q) ||
        it.id_hijo.toLowerCase().includes(q) ||
        (it.descripcion_hijo && it.descripcion_hijo.toLowerCase().includes(q))
    );
  }, [bomEstructura, searchEstructura]);

  const handleProcessDemand = async () => {
    if (f1Files.length === 0 && f2Files.length === 0) {
      toast.error("Seleccione al menos un archivo de producción (F1 o F2)");
      return;
    }
    setIsProcessingDemand(true);
    try {
      const result = await consolidateSupply({ f1Files, f2Files });
      setDemandItems(result.items);
      setDailyColumns(result.columnas_diarias || []);
      setTentativeColumns(result.columnas_tentativas || []);
      setDateMap(result.columnas_fechas_map || {});
      setF1Files([]);
      setF2Files([]);
      toast.success(result.mensaje);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al procesar demanda";
      toast.error(msg);
    } finally {
      setIsProcessingDemand(false);
    }
  };

  const handleSaveCell = async (partNumber: string, col: string, newValStr: string) => {
    const parsed = parseFloat(newValStr);
    const newQty = isNaN(parsed) || parsed < 0 ? 0 : Math.round(parsed);
    const isoDate = dateMap[col];

    if (!isoDate) {
      toast.error(`No se encontró fecha mapeada para la columna ${col}`);
      setEditingCell(null);
      return;
    }

    setSavingCell(true);
    try {
      await updateSupplyDailyProduction({
        id_producto: partNumber,
        fecha: isoDate,
        cantidad: newQty,
      });

      setDemandItems((prev) =>
        prev.map((item) => {
          if (item.part_number !== partNumber) return item;
          const oldVal = item.daily_values?.[col] || 0;
          const diff = newQty - oldVal;
          const updatedDaily = {
            ...(item.daily_values || {}),
            [col]: newQty,
          };
          return {
            ...item,
            daily_values: updatedDaily,
            total: Math.max(0, (item.total || 0) + diff),
          };
        })
      );
      toast.success(`Actualizado ${partNumber} (${col}): ${newQty}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al guardar valor";
      toast.error(msg);
    } finally {
      setSavingCell(false);
      setEditingCell(null);
    }
  };

  const handleDownloadExcel = async () => {
    setIsDownloadingExcel(true);
    try {
      await downloadExcelConsolidado();
      toast.success("Libro Excel consolidado descargado correctamente");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al descargar Excel");
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  const handleOpenSapModal = () => {
    setSapModalOpen(true);
  };

  const handleConfirmDownloadSapPir = async () => {
    setIsDownloadingSap(true);
    try {
      const corteParam = sapAplicarCorte && sapFechaCorte ? sapFechaCorte : undefined;
      await downloadSapPirTxt(corteParam);
      toast.success(
        corteParam
          ? `Archivo SAP PIR descargado (días anteriores a ${corteParam} en 0)`
          : "Archivo SAP PIR descargado (mes completo)"
      );
      setSapModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al descargar SAP PIR");
    } finally {
      setIsDownloadingSap(false);
    }
  };

  const handleUploadBom = async () => {
    if (!bomFile) {
      toast.error("Seleccione un archivo de BOM (.xls, .xlsx o .tsv)");
      return;
    }
    setIsUploadingBom(true);
    try {
      const result = await uploadBomFile(bomFile);
      toast.success(`Versión #${result.id_version} importada: ${result.total_relaciones_creadas} relaciones creadas.`);
      setBomFile(null);
      await fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al importar BOM";
      toast.error(msg);
    } finally {
      setIsUploadingBom(false);
    }
  };

  const openNewRelationDialog = () => {
    setEditingRelation(null);
    setRelationForm({
      sector: "Seat",
      sd: "",
      codigo_tasa: "",
      codigo_sap_padre: "",
      id_material_hijo: "",
      cantidad: "1",
      unidad: "UN",
    });
    setRelationErrors({});
    setRelationDialogOpen(true);
  };

  const openEditRelationDialog = (rel: SetComponenteItem) => {
    setEditingRelation(rel);
    setRelationForm({
      sector: rel.sector || "Seat",
      sd: rel.sd || "",
      codigo_tasa: rel.codigo_tasa,
      codigo_sap_padre: rel.codigo_sap_padre,
      id_material_hijo: rel.id_material_hijo,
      cantidad: String(rel.cantidad),
      unidad: rel.unidad,
    });
    setRelationErrors({});
    setRelationDialogOpen(true);
  };

  const handleSaveRelation = async () => {
    const errs: Record<string, string> = {};
    if (!relationForm.codigo_tasa.trim()) errs.codigo_tasa = "Requerido";
    if (!relationForm.codigo_sap_padre.trim()) errs.codigo_sap_padre = "Requerido";
    if (!relationForm.id_material_hijo.trim()) errs.id_material_hijo = "Requerido";
    const usageNum = parseFloat(relationForm.cantidad);
    if (isNaN(usageNum) || usageNum <= 0) errs.cantidad = "Debe ser mayor a 0";

    if (Object.keys(errs).length > 0) {
      setRelationErrors(errs);
      return;
    }

    setIsSavingRelation(true);
    try {
      if (editingRelation) {
        const updated = await updateSetComponente(editingRelation.id_set_componente, {
          sector: relationForm.sector,
          sd: relationForm.sd,
          codigo_tasa: relationForm.codigo_tasa.trim(),
          codigo_sap_padre: relationForm.codigo_sap_padre.trim(),
          id_material_hijo: relationForm.id_material_hijo.trim(),
          cantidad: usageNum,
          unidad: relationForm.unidad,
        });
        setRelations((prev) =>
          prev.map((r) => (r.id_set_componente === updated.id_set_componente ? updated : r))
        );
        toast.success("Relación actualizada en SQL Server");
      } else {
        const created = await createSetComponente({
          sector: relationForm.sector,
          sd: relationForm.sd,
          codigo_tasa: relationForm.codigo_tasa.trim(),
          codigo_sap_padre: relationForm.codigo_sap_padre.trim(),
          id_material_hijo: relationForm.id_material_hijo.trim(),
          cantidad: usageNum,
          unidad: relationForm.unidad,
        });
        setRelations((prev) => [created, ...prev]);
        toast.success("Nueva relación registrada en dbo.set_componente");
      }
      setRelationDialogOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al guardar relación";
      toast.error(msg);
    } finally {
      setIsSavingRelation(false);
    }
  };

  const handleToggleRelationActive = async (id: number) => {
    try {
      const res = await toggleSetComponente(id);
      setRelations((prev) =>
        prev.map((r) =>
          r.id_set_componente === id ? { ...r, activo: res.activo } : r
        )
      );
      toast.success(res.activo ? "Relación activada" : "Relación desactivada");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al modificar estado";
      toast.error(msg);
    }
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 mb-2 flex items-center gap-3">
            <FileSpreadsheet className="w-7 h-7" />
            Orden de Suministro y BOM
          </h1>
          <p className="text-slate-600">
            Ingesta de demandas de producción, gestión de recetas activas y relaciones de componentes
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Recargar datos
        </Button>
      </div>

      {errorMsg && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div className="flex-1 text-sm text-red-800">
              <span className="font-semibold">Aviso de conexión:</span> {errorMsg}. Asegúrese de que el servidor FastAPI esté en ejecución en <code>http://127.0.0.1:8000</code>.
            </div>
            <Button size="sm" variant="outline" onClick={fetchData}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="demanda" className="space-y-6">
        <TabsList className="mb-2">
          <TabsTrigger value="demanda" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Orden de Suministro
          </TabsTrigger>
          <TabsTrigger value="bom" className="flex items-center gap-2">
            <GitFork className="w-4 h-4" />
            BOM y Relaciones ({relations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="demanda" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-2 border-slate-900 bg-slate-900 text-white">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white/60 text-xs uppercase tracking-wider">Período Planificado</p>
                    <p className="font-bold text-white text-base">{periodo}</p>
                    <p className="text-emerald-400 text-xs font-medium mt-0.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {dailyColumns.length} días productivos
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Layers className="w-5 h-5 text-slate-700" />
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wider">Demanda Consolidada</p>
                    <p className="font-bold text-slate-900 text-xl">
                      {demandItems.reduce((acc, curr) => acc + curr.total, 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">unid.</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wider">Productos Mapeados</p>
                    <p className="font-bold text-slate-900 text-xl">
                      {demandItems.filter((d) => d.status === "validado").length} / {demandItems.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-slate-700" />
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wider">Base de Datos</p>
                    <p className="font-bold text-slate-900 text-xl">SQL Server</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-slate-600" />
                Cargar Archivos de Producción y Demanda
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Formato 1 (Demanda Diaria)
                      </span>
                      {f1Files.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setF1Files([])}
                        >
                          Limpiar ({f1Files.length})
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 font-medium mt-1">
                      Planillas diarias con desglose por día/turno
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Selección múltiple permitida (.xlsx, .xlsm, .csv)
                    </p>
                  </div>
                  <div className="mt-3">
                    <Input
                      type="file"
                      multiple
                      accept=".xlsx,.xlsm,.csv,.txt"
                      className="bg-white text-xs cursor-pointer"
                      onChange={(e) => {
                        const selected = Array.from(e.target.files || []);
                        if (selected.length > 0) {
                          setF1Files((prev) => {
                            const existingNames = new Set(prev.map((f) => f.name));
                            const newFiles = selected.filter((f) => !existingNames.has(f.name));
                            return [...prev, ...newFiles];
                          });
                        }
                        e.target.value = "";
                      }}
                    />
                    {f1Files.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-white border border-slate-200 rounded-md">
                        {f1Files.map((file, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="text-xs flex items-center gap-1.5 py-0.5 px-2 bg-slate-100 text-slate-800"
                          >
                            <span className="truncate max-w-[170px]">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => setF1Files((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-slate-400 hover:text-slate-700 ml-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Formato 2 (Mediano Plazo / Proveedores)
                      </span>
                      {f2Files.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setF2Files([])}
                        >
                          Limpiar ({f2Files.length})
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 font-medium mt-1">
                      Plan tentativo de meses no firmes / compras
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Selección múltiple permitida (.xlsx, .xlsm, .csv)
                    </p>
                  </div>
                  <div className="mt-3">
                    <Input
                      type="file"
                      multiple
                      accept=".xlsx,.xlsm,.csv,.txt"
                      className="bg-white text-xs cursor-pointer"
                      onChange={(e) => {
                        const selected = Array.from(e.target.files || []);
                        if (selected.length > 0) {
                          setF2Files((prev) => {
                            const existingNames = new Set(prev.map((f) => f.name));
                            const newFiles = selected.filter((f) => !existingNames.has(f.name));
                            return [...prev, ...newFiles];
                          });
                        }
                        e.target.value = "";
                      }}
                    />
                    {f2Files.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-white border border-slate-200 rounded-md">
                        {f2Files.map((file, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="text-xs flex items-center gap-1.5 py-0.5 px-2 bg-slate-100 text-slate-800"
                          >
                            <span className="truncate max-w-[170px]">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => setF2Files((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-slate-400 hover:text-slate-700 ml-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Archivos cargados:</span>
                  <Badge variant="outline" className="text-xs font-mono">
                    F1: {f1Files.length} archivo{f1Files.length === 1 ? "" : "s"}
                  </Badge>
                  <Badge variant="outline" className="text-xs font-mono">
                    F2: {f2Files.length} archivo{f2Files.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleProcessDemand}
                    disabled={isProcessingDemand || (f1Files.length === 0 && f2Files.length === 0)}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isProcessingDemand ? "animate-spin" : ""}`} />
                    Procesar y Consolidar en Servidor
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
              <div>
                <CardTitle className="text-slate-900 text-lg">Demanda Consolidada por Producto ({filteredDemand.length})</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Planilla de requerimientos diarios calculados frente a la receta activa en SQL Server
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenCalendario}
                  className="flex items-center gap-2 border-indigo-600 text-indigo-700 hover:bg-indigo-50 font-semibold"
                >
                  <CalendarDays className="w-4 h-4 text-indigo-600" />
                  <span>Calendario de Producción</span>
                  {dailyColumns.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-indigo-100 text-indigo-800">
                      {dailyColumns.length} días
                    </Badge>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isDownloadingExcel || filteredDemand.length === 0}
                  onClick={handleDownloadExcel}
                  className="flex items-center gap-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <FileSpreadsheet className={`w-4 h-4 ${isDownloadingExcel ? "animate-spin" : ""}`} />
                  {isDownloadingExcel ? "Generando..." : "Descargar Excel (.xlsx)"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isDownloadingSap || filteredDemand.length === 0}
                  onClick={handleOpenSapModal}
                  className="flex items-center gap-2 border-blue-600 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                >
                  <FileText className={`w-4 h-4 ${isDownloadingSap ? "animate-spin" : ""}`} />
                  {isDownloadingSap ? "Generando..." : "Descargar TXT SAP PIR"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por Nº de Parte, Código TASA o descripción..."
                    className="pl-9"
                    value={searchDemand}
                    onChange={(e) => setSearchDemand(e.target.value)}
                  />
                </div>
                <div className="w-full sm:w-48">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los estados</SelectItem>
                      <SelectItem value="validado">Validado con BOM</SelectItem>
                      <SelectItem value="sin_bom">Sin receta activa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div
                ref={tableContainerRef}
                className="border border-slate-200 rounded-lg overflow-x-auto max-h-[calc(100vh-280px)] min-h-[420px] overflow-y-auto bg-white shadow-xs"
              >
                <table className="min-w-full border-separate border-spacing-0 text-xs">
                  <thead className="sticky top-0 z-30 shadow-xs">
                    <tr className="border-b border-slate-300">
                      <th className="sticky left-0 bg-slate-200 z-40 font-bold border-b border-r border-slate-300 min-w-[140px] px-3 py-2 text-left text-slate-900 select-none">
                        Nº Parte
                      </th>
                      <th className="font-semibold bg-slate-100 border-b border-r border-slate-200 min-w-[130px] px-3 py-2 text-left text-slate-700 whitespace-nowrap">
                        Código TASA
                      </th>
                      <th className="font-semibold bg-slate-100 border-b border-r border-slate-200 min-w-[200px] px-3 py-2 text-left text-slate-700 whitespace-nowrap">
                        Descripción
                      </th>
                      <th className="font-semibold bg-slate-100 border-b border-r border-slate-200 min-w-[65px] px-2 py-2 text-center text-slate-700 whitespace-nowrap">
                        Dock
                      </th>
                      <th className="font-semibold bg-slate-100 border-b border-r border-slate-200 min-w-[75px] px-2 py-2 text-center text-slate-700 whitespace-nowrap">
                        Empaque
                      </th>

                      {extractedDaily.map((col) => (
                        <th
                          key={col}
                          className="font-mono font-semibold bg-slate-100 border-b border-r border-slate-200 min-w-[65px] px-2.5 py-2 text-right text-slate-700 whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}

                      {tentativeColumns.map((col) => (
                        <th
                          key={col}
                          className="font-mono font-semibold bg-slate-100 border-b border-r border-slate-200 min-w-[85px] px-2.5 py-2 text-right text-slate-700 whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}

                      <th className="sticky right-0 bg-slate-200 font-mono font-bold border-b border-l border-slate-300 min-w-[90px] px-3 py-2 text-right text-slate-900 z-35 shadow-xs whitespace-nowrap">
                        Total
                      </th>
                      <th className="font-semibold bg-slate-100 border-b min-w-[85px] px-2 py-2 text-center text-slate-700 whitespace-nowrap">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <TableBody>
                    {filteredDemand.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7 + extractedDaily.length + tentativeColumns.length}
                          className="text-center text-slate-400 py-12"
                        >
                          {loading ? "Cargando matriz de demanda..." : "No se encontraron registros de demanda"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDemand.map((d) => (
                        <TableRow key={d.id} className="hover:bg-slate-50/80 border-b border-slate-100 group">
                          <TableCell className="sticky left-0 bg-white group-hover:bg-slate-50 z-10 font-mono text-xs font-semibold px-3 py-1.5 border-r border-slate-200 text-slate-900 whitespace-nowrap">
                            {d.part_number}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-600 px-3 py-1.5 border-r border-slate-200 whitespace-nowrap">
                            {d.tasa_code}
                          </TableCell>
                          <TableCell className="text-xs text-slate-800 px-3 py-1.5 border-r border-slate-200 truncate max-w-[220px]">
                            {d.description}
                          </TableCell>
                          <TableCell className="text-center px-2 py-1.5 border-r border-slate-200">
                            <span className="font-mono text-xs text-slate-600">{d.dock || "DK-01"}</span>
                          </TableCell>
                          <TableCell className="text-center px-2 py-1.5 border-r border-slate-200 text-xs text-slate-500 font-mono">
                            {d.box_type || "RACK"} {d.qty_per_box > 1 ? `(${d.qty_per_box}u)` : ""}
                          </TableCell>

                          {extractedDaily.map((col) => {
                            const val = d.daily_values?.[col] || 0;
                            const isEditing =
                              editingCell?.partNumber === d.part_number && editingCell?.col === col;

                            if (isEditing) {
                              return (
                                <TableCell
                                  key={col}
                                  className="p-0 border-r border-slate-100 bg-amber-50/80 min-w-[65px]"
                                >
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    autoFocus
                                    disabled={savingCell}
                                    defaultValue={val === 0 ? "" : val}
                                    className="w-full h-8 text-right font-mono text-xs px-2 bg-transparent border-0 outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                                    onBlur={(e) =>
                                      handleSaveCell(d.part_number, col, e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        (e.target as HTMLInputElement).blur();
                                      } else if (e.key === "Escape") {
                                        setEditingCell(null);
                                      }
                                    }}
                                  />
                                </TableCell>
                              );
                            }

                            return (
                              <TableCell
                                key={col}
                                onClick={() => {
                                  if (canEdit && !savingCell) {
                                    setEditingCell({
                                      partNumber: d.part_number,
                                      col,
                                      value: String(val),
                                    });
                                  }
                                }}
                                className={`text-right font-mono text-xs px-2.5 py-1.5 border-r border-slate-100 whitespace-nowrap select-none ${
                                  canEdit ? "cursor-pointer hover:bg-amber-50/50" : ""
                                } ${
                                  val > 0 ? "text-slate-900 font-semibold bg-slate-50/40" : "text-slate-300"
                                }`}
                                title={canEdit ? `Click para editar ${d.part_number} (${col})` : undefined}
                              >
                                {val > 0 ? val.toLocaleString() : "-"}
                              </TableCell>
                            );
                          })}

                          {tentativeColumns.map((col) => {
                            const val = d.tentative_values?.[col] ?? d.daily_values?.[col] ?? 0;
                            return (
                              <TableCell
                                key={col}
                                className={`text-right font-mono text-xs px-2.5 py-1.5 border-r border-slate-100 whitespace-nowrap ${
                                  val > 0 ? "text-slate-900 font-semibold bg-slate-50/40" : "text-slate-300"
                                }`}
                              >
                                {val > 0 ? val.toLocaleString() : "-"}
                              </TableCell>
                            );
                          })}

                          <TableCell className="sticky right-0 bg-slate-50 group-hover:bg-slate-100 font-mono text-xs font-bold text-slate-900 text-right px-3 py-1.5 border-l border-slate-200 z-10">
                            {d.total.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center px-2 py-1.5 whitespace-nowrap">
                            {d.status === "validado" ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] py-0" variant="outline">
                                Validado
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[11px] py-0" variant="outline">
                                Sin BOM
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  {filteredDemand.length > 0 && (
                    <TableFooter className="bg-slate-100 sticky bottom-0 z-20 border-t-2 border-slate-300 shadow-inner">
                      <TableRow className="border-0">
                        <TableCell className="sticky left-0 bg-slate-100 z-30 font-bold text-xs uppercase tracking-wider text-slate-800 px-3 py-2.5 border-r border-slate-300 whitespace-nowrap">
                          Totales Diarios
                        </TableCell>
                        <TableCell className="border-r border-slate-200 px-3 py-2.5" />
                        <TableCell className="border-r border-slate-200 px-3 py-2.5 text-xs text-slate-500 font-medium">
                          {filteredDemand.length} productos
                        </TableCell>
                        <TableCell className="border-r border-slate-200 px-2 py-2.5" />
                        <TableCell className="border-r border-slate-200 px-2 py-2.5" />

                        {extractedDaily.map((col) => {
                          const sumVal = dailyTotals[col] || 0;
                          return (
                            <TableCell
                              key={col}
                              className="text-right font-mono text-xs font-bold text-slate-900 px-2.5 py-2.5 border-r border-slate-200 whitespace-nowrap"
                            >
                              {sumVal > 0 ? sumVal.toLocaleString() : "-"}
                            </TableCell>
                          );
                        })}

                        {tentativeColumns.map((col) => {
                          const sumVal = tentativeTotals[col] || 0;
                          return (
                            <TableCell
                              key={col}
                              className="text-right font-mono text-xs font-bold text-slate-900 px-2.5 py-2.5 border-r border-slate-200 whitespace-nowrap"
                            >
                              {sumVal > 0 ? sumVal.toLocaleString() : "-"}
                            </TableCell>
                          );
                        })}

                        <TableCell className="sticky right-0 bg-slate-200 font-mono text-xs font-black text-slate-900 text-right px-3 py-2.5 border-l border-slate-300 z-20 shadow-sm whitespace-nowrap">
                          {grandTotal.toLocaleString()}
                        </TableCell>
                        <TableCell className="px-2 py-2.5 text-center text-[11px] text-slate-500 font-medium whitespace-nowrap">
                          100%
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bom" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-2 border-slate-900 bg-slate-900 text-white">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white/60 text-xs uppercase tracking-wider">Versión Vigente en SQL Server</p>
                    <p className="font-bold text-white text-base">
                      {activeVersion ? `Versión #${activeVersion.id_version}` : "Sin versión activa"}
                    </p>
                    <p className="text-white/80 text-xs truncate max-w-[200px] mt-0.5">
                      {activeVersion?.nombre_archivo || "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Layers className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wider">Estructura Multinivel Vigente</p>
                    <p className="font-bold text-slate-900 text-xl">
                      {bomEstructuraTotal.toLocaleString()} <span className="text-xs font-normal text-slate-500">en dbo.bom_estructura</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-slate-700" />
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wider">Importación de Receta</p>
                    <p className="font-semibold text-slate-900 text-sm">{activeVersion?.fecha_importacion || "—"}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{activeVersion?.total_lineas.toLocaleString() || 0} líneas calculadas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-slate-600" />
                Cargar Nueva Versión de Receta BOM (SAP CS11 / CS12)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 mb-4">
                <p className="text-sm text-slate-700 font-medium">
                  Actualización masiva de estructura de materiales
                </p>
                <p className="text-xs text-slate-500 mt-0.5 mb-3">
                  El sistema genera una nueva versión inmutable en <code>dbo.bom_version</code> y recalcula la explosión plana de factores de consumo unitario en SQL Server.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <Input
                    type="file"
                    accept=".xls,.xlsx,.xlsm,.tsv,.csv,.txt"
                    className="bg-white text-xs max-w-md"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setBomFile(f);
                    }}
                  />
                  <Button
                    onClick={handleUploadBom}
                    disabled={isUploadingBom}
                    className="flex items-center gap-2 w-full sm:w-auto"
                  >
                    <RefreshCw className={`w-4 h-4 ${isUploadingBom ? "animate-spin" : ""}`} />
                    Procesar e Importar a Base de Datos
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Versión</TableHead>
                      <TableHead>Nombre de Archivo</TableHead>
                      <TableHead>Fecha Importación</TableHead>
                      <TableHead className="text-right">Total Líneas</TableHead>
                      <TableHead>Observación</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versions.map((v) => (
                      <TableRow key={v.id_version}>
                        <TableCell className="font-semibold">v{v.id_version}</TableCell>
                        <TableCell className="font-mono text-xs">{v.nombre_archivo}</TableCell>
                        <TableCell className="text-xs text-slate-600">{v.fecha_importacion}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{v.total_lineas.toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-slate-600">{v.observacion || "—"}</TableCell>
                        <TableCell className="text-center">
                          {v.es_vigente ? (
                            <Badge className="bg-green-100 text-green-700" variant="outline">
                              Activa / Vigente
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-400">
                              Histórica
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="inline-flex rounded-lg border bg-slate-100 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveBomSubTab("estructura")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                        activeBomSubTab === "estructura"
                          ? "bg-white text-slate-900 shadow-xs font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      <span>Estructura Multinivel Vigente ({filteredEstructura.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveBomSubTab("sets")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                        activeBomSubTab === "sets"
                          ? "bg-white text-slate-900 shadow-xs font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <GitFork className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Sets y Componentes TASA ({filteredRelations.length})</span>
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {activeBomSubTab === "estructura"
                    ? `Desglose jerárquico multinivel importado desde receta BOM en dbo.bom_estructura para la versión #${activeVersion?.id_version || "—"}`
                    : "Mapeo maestro directo entre sets de demanda y materiales componentes con multiplicador de uso en dbo.set_componente"}
                </p>
              </div>
              {activeBomSubTab === "sets" && (
                <Button onClick={openNewRelationDialog} className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Nueva Relación
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {activeBomSubTab === "estructura" ? (
                <>
                  <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Buscar por producto raíz, padre, componente hijo o descripción..."
                        className="pl-9"
                        value={searchEstructura}
                        onChange={(e) => setSearchEstructura(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20 text-center">Nivel</TableHead>
                          <TableHead>Producto Raíz</TableHead>
                          <TableHead>Código Padre</TableHead>
                          <TableHead>Componente Hijo</TableHead>
                          <TableHead>Descripción Hijo</TableHead>
                          <TableHead className="text-right">Cantidad / Uso</TableHead>
                          <TableHead>Unidad</TableHead>
                          <TableHead className="text-center w-20">Secuencia</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEstructura.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-slate-400 py-8">
                              {loading ? "Cargando estructura de BOM..." : "No se encontraron componentes en la versión activa de BOM"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredEstructura.map((it) => (
                            <TableRow key={it.id_bom}>
                              <TableCell className="text-center">
                                <Badge
                                  variant="outline"
                                  className={`text-[11px] font-mono px-2 py-0.5 ${
                                    it.nivel === 0
                                      ? "bg-slate-900 text-white font-bold"
                                      : it.nivel === 1
                                      ? "bg-blue-100 text-blue-800 border-blue-200 font-semibold"
                                      : it.nivel === 2
                                      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                      : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  Nv. {it.nivel}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs font-semibold text-slate-900">
                                {it.id_producto_raiz}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-slate-600">
                                {it.id_padre}
                              </TableCell>
                              <TableCell className="font-mono text-xs font-bold text-blue-700">
                                {it.id_hijo}
                              </TableCell>
                              <TableCell className="text-xs text-slate-700 max-w-[240px] truncate" title={it.descripcion_hijo || ""}>
                                {it.descripcion_hijo || it.id_hijo}
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-slate-900">
                                {it.cantidad.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                              </TableCell>
                              <TableCell className="text-xs text-slate-600">{it.unidad}</TableCell>
                              <TableCell className="text-center font-mono text-xs text-slate-400">{it.orden}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Buscar por código padre, componente hijo o descripción..."
                        className="pl-9"
                        value={searchRelation}
                        onChange={(e) => setSearchRelation(e.target.value)}
                      />
                    </div>
                    <div className="w-full sm:w-48">
                      <Select value={filterSector} onValueChange={setFilterSector}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sector" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos los sectores</SelectItem>
                          {sectorsList.map((sec) => (
                            <SelectItem key={sec} value={sec}>
                              {sec}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Sector</TableHead>
                          <TableHead>SD</TableHead>
                          <TableHead>Código TASA (Padre)</TableHead>
                          <TableHead>Padre SAP</TableHead>
                          <TableHead>Componente Hijo</TableHead>
                          <TableHead>Descripción Hijo</TableHead>
                          <TableHead className="text-right">Uso / Cant.</TableHead>
                          <TableHead>Unidad</TableHead>
                          <TableHead className="text-center">Estado</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRelations.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={10} className="text-center text-slate-400 py-8">
                              {loading ? "Cargando relaciones desde base de datos..." : "No se encontraron relaciones"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredRelations.map((rel) => (
                            <TableRow key={rel.id_set_componente} className={!rel.activo ? "opacity-50" : ""}>
                              <TableCell className="font-medium text-xs">{rel.sector || "—"}</TableCell>
                              <TableCell className="text-xs text-slate-600">{rel.sd || "—"}</TableCell>
                              <TableCell className="font-mono text-xs font-semibold">{rel.codigo_tasa}</TableCell>
                              <TableCell className="font-mono text-xs text-slate-600">{rel.codigo_sap_padre}</TableCell>
                              <TableCell className="font-mono text-xs font-semibold text-slate-900">{rel.id_material_hijo}</TableCell>
                              <TableCell className="text-xs text-slate-700 max-w-[220px] truncate" title={rel.descripcion_hijo || ""}>
                                {rel.descripcion_hijo || rel.id_material_hijo}
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-slate-900">
                                {rel.cantidad.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-xs">{rel.unidad}</TableCell>
                              <TableCell className="text-center">
                                <span
                                  onClick={() => handleToggleRelationActive(rel.id_set_componente)}
                                  className="cursor-pointer"
                                >
                                  {rel.activo ? (
                                    <Badge className="bg-green-100 text-green-700" variant="outline">
                                      Activo
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-slate-400">
                                      Inactivo
                                    </Badge>
                                  )}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditRelationDialog(rel)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggleRelationActive(rel.id_set_componente)}
                                    className="h-8 w-8 p-0 text-red-600"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={relationDialogOpen} onOpenChange={setRelationDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRelation ? "Editar Relación Set / Componente" : "Nueva Relación Set / Componente"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Sector</Label>
                <Input
                  value={relationForm.sector}
                  onChange={(e) => setRelationForm({ ...relationForm, sector: e.target.value })}
                  placeholder="ej. Seat"
                />
              </div>
              <div className="space-y-1">
                <Label>SD</Label>
                <Input
                  value={relationForm.sd}
                  onChange={(e) => setRelationForm({ ...relationForm, sd: e.target.value })}
                  placeholder="ej. SD-01"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Código TASA (Padre)</Label>
                <Input
                  value={relationForm.codigo_tasa}
                  onChange={(e) => setRelationForm({ ...relationForm, codigo_tasa: e.target.value })}
                  placeholder="ej. 71010-0K310"
                />
                {relationErrors.codigo_tasa && (
                  <p className="text-xs text-red-600">{relationErrors.codigo_tasa}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Padre SAP</Label>
                <Input
                  value={relationForm.codigo_sap_padre}
                  onChange={(e) => setRelationForm({ ...relationForm, codigo_sap_padre: e.target.value })}
                  placeholder="ej. 71010-0K310-C0"
                />
                {relationErrors.codigo_sap_padre && (
                  <p className="text-xs text-red-600">{relationErrors.codigo_sap_padre}</p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Componente Hijo (Código Material)</Label>
              <Input
                value={relationForm.id_material_hijo}
                onChange={(e) => setRelationForm({ ...relationForm, id_material_hijo: e.target.value })}
                placeholder="ej. 71611-0K080-00"
              />
              {relationErrors.id_material_hijo && (
                <p className="text-xs text-red-600">{relationErrors.id_material_hijo}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Cantidad / Uso Unitario</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={relationForm.cantidad}
                  onChange={(e) => setRelationForm({ ...relationForm, cantidad: e.target.value })}
                />
                {relationErrors.cantidad && (
                  <p className="text-xs text-red-600">{relationErrors.cantidad}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Unidad</Label>
                <Select
                  value={relationForm.unidad}
                  onValueChange={(val) => setRelationForm({ ...relationForm, unidad: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UN">UN</SelectItem>
                    <SelectItem value="KG">KG</SelectItem>
                    <SelectItem value="MT">MT</SelectItem>
                    <SelectItem value="M2">M2</SelectItem>
                    <SelectItem value="LT">LT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRelationDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveRelation} disabled={isSavingRelation}>
              {isSavingRelation ? "Guardando..." : editingRelation ? "Guardar Cambios" : "Crear Relación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CalendarioLaboralModal
        open={calModalOpen}
        onOpenChange={setCalModalOpen}
        initialAnio={calAnio}
        initialMes={calMes}
        onSaved={fetchData}
      />

      {/* MODAL EXPORTACIÓN SAP PIR CON CORTE DE FECHA */}
      <Dialog open={sapModalOpen} onOpenChange={setSapModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>Exportar Demanda a SAP PIR (.txt)</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-blue-900 space-y-1.5">
              <p className="font-semibold flex items-center gap-1.5 text-xs text-blue-950">
                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Actualización a SAP a mitad de período:</span>
              </p>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                Al cargar una actualización en SAP (por ejemplo, tras agregar un sábado o reajustar turnos),
                SAP requiere recibir las fechas pasadas con <b>cantidad 0</b> para evitar duplicar consumos
                ya ejecutados.
              </p>
              <p className="text-[11px] text-emerald-800 font-medium">
                ✓ El Rundown Vivo y la base de datos permanecerán intactos, conservando su histórico real sin alteraciones.
              </p>
            </div>

            <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sapAplicarCorte}
                  onChange={(e) => setSapAplicarCorte(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <div className="space-y-0.5">
                  <span className="font-semibold text-slate-900 text-xs block">
                    Poner en 0 los días anteriores a la fecha de corte
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Exporta con 0 los días ya consumidos y envía la producción planificada completa desde la fecha elegida hasta fin de mes.
                  </span>
                </div>
              </label>

              {sapAplicarCorte && (
                <div className="pl-6 pt-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                      Fecha de corte (desde):
                    </Label>
                    <Input
                      type="date"
                      value={sapFechaCorte}
                      onChange={(e) => setSapFechaCorte(e.target.value)}
                      className="h-8 text-xs font-mono max-w-[160px] bg-white"
                    />
                  </div>
                  <div className="p-2 bg-amber-50/70 border border-amber-200 rounded text-[11px] text-amber-900">
                    • <b>Días anteriores al {sapFechaCorte}:</b> se exportarán con cantidad <code>0</code> a SAP.<br />
                    • <b>Días desde el {sapFechaCorte}:</b> se exportarán con las cantidades planificadas completas.
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setSapModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmDownloadSapPir}
              disabled={isDownloadingSap}
              className="bg-blue-600 text-white hover:bg-blue-700 gap-1.5"
            >
              <FileText className={`w-3.5 h-3.5 ${isDownloadingSap ? "animate-spin" : ""}`} />
              <span>{isDownloadingSap ? "Generando TXT..." : "Descargar TXT SAP PIR"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
