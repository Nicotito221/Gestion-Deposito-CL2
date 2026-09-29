import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Search,
  Trash2,
  CheckCircle2,
  ClipboardList,
  ShoppingCart,
  User,
  Clock,
  X,
  Plus,
  RefreshCw,
  Calendar,
  Layers,
  History,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  Smartphone,
  LayoutList,
  LayoutGrid,
  Split,
  Sun,
  Moon,
  Sparkles,
  Send,
  Package,
  Pencil,
  Lock,
  Building,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { getTodayISODate } from "../components/ui/format";
import {
  searchMaterialesConteo,
  createConteo,
  getHistoricoConteos,
  getDetalleConteo,
  getRundownSecciones,
  calcularSugerenciaPedido,
  createPedido,
  createPedidosMultiples,
  updateLoteMaterial,
  type ConteoMaterialSearchItem,
  type ConteoHistoricoItem,
  type ConteoResponse,
  type RundownSeccionItem,
  type CalcularSugerenciaResponse,
  type SugerenciaMaterialDetalle,
  type PedidoCreate,
  type PedidoItemInput,
} from "../services/api";

interface SheetRow {
  id_material: string;
  nombre: string;
  unidad: string;
  id_proveedor?: number | null;
  nombre_proveedor?: string | null;
  deposito_en_planta: boolean;
  stock_teorico: number;
  stock_contado: number;
  observacion: string;
}

const getArgentinaTodayStr = (): string => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());
};

const getArgentinaYesterdayStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(d);
};

const formatFechaAR = (fechaStr: string): string => {
  try {
    const dt = new Date(fechaStr);
    return dt.toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return fechaStr;
  }
};

const formatSoloFechaAR = (fechaStr: string): string => {
  try {
    const parts = fechaStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return fechaStr;
  } catch {
    return fechaStr;
  }
};

export function StockCount() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const orderSector =
    currentUser?.sector && currentUser.sector !== "TODOS"
      ? currentUser.sector
      : "PC";
  const isSectorLocked = Boolean(currentUser?.sector && currentUser.sector !== "TODOS");
  const [activeTab, setActiveTab] = useState<string>("planilla");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const [fechaImpacto, setFechaImpacto] = useState<string>(getArgentinaYesterdayStr());
  const [generalObs, setGeneralObs] = useState<string>("");
  const [rows, setRows] = useState<SheetRow[]>([]);

  const [search, setSearch] = useState<string>("");
  const [searchResults, setSearchResults] = useState<ConteoMaterialSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [secciones, setSecciones] = useState<RundownSeccionItem[]>([]);
  const [selectedProvId, setSelectedProvId] = useState<string>("all");
  const [loadingPreload, setLoadingPreload] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lastSavedConteo, setLastSavedConteo] = useState<ConteoResponse | null>(null);
  const [successModalOpen, setSuccessModalOpen] = useState<boolean>(false);

  const [historico, setHistorico] = useState<ConteoHistoricoItem[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState<boolean>(false);
  const [selectedConteoDetalle, setSelectedConteoDetalle] = useState<ConteoResponse | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Sugerencia de Pedidos Modal State
  const [sugerenciaModalOpen, setSugerenciaModalOpen] = useState<boolean>(false);
  const [sugerenciaLoading, setSugerenciaLoading] = useState<boolean>(false);
  const [sugerenciaFecha, setSugerenciaFecha] = useState<string>(() => getArgentinaTodayStr());
  const [sugerenciaModalidad, setSugerenciaModalidad] = useState<"completo" | "2_turnos" | "3_turnos">("completo");
  const [sugerenciaData, setSugerenciaData] = useState<CalcularSugerenciaResponse | null>(null);
  const [sugerenciaTargetConteoId, setSugerenciaTargetConteoId] = useState<number | undefined>(undefined);
  const [editedQuantities, setEditedQuantities] = useState<Record<string, Record<string, number>>>({});
  const [isCreatingOrders, setIsCreatingOrders] = useState<boolean>(false);
  const [loteEditModalOpen, setLoteEditModalOpen] = useState<boolean>(false);
  const [editingLoteItem, setEditingLoteItem] = useState<{
    id_parametro: number;
    id_material: string;
    nombre: string;
    tipo_empaque: string;
    lote_mts: number;
  } | null>(null);
  const [savingLote, setSavingLote] = useState<boolean>(false);

  const currentTimeStr = useMemo(() => {
    return new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());
  }, []);

  const proveedoresList = useMemo(() => {
    const list: { id_proveedor: number; nombre: string }[] = [];
    secciones.forEach((sec) => {
      sec.proveedores.forEach((p) => {
        if (!list.some((it) => it.id_proveedor === p.id_proveedor)) {
          list.push({ id_proveedor: p.id_proveedor, nombre: p.nombre });
        }
      });
    });
    return list.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [secciones]);

  const fetchSecciones = useCallback(async () => {
    try {
      const data = await getRundownSecciones();
      setSecciones(data);
    } catch {
      toast.error("Error al cargar proveedores para conteo");
    }
  }, []);

  const fetchHistorico = useCallback(async () => {
    setLoadingHistorico(true);
    try {
      const res = await getHistoricoConteos({ page: 1, page_size: 30 });
      setHistorico(res.items);
    } catch {
      toast.error("Error al cargar histórico de conteos");
    } finally {
      setLoadingHistorico(false);
    }
  }, []);

  useEffect(() => {
    fetchSecciones();
  }, [fetchSecciones]);

  useEffect(() => {
    if (activeTab === "historico") {
      fetchHistorico();
    }
  }, [activeTab, fetchHistorico]);

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const provNum = selectedProvId !== "all" ? parseInt(selectedProvId, 10) : undefined;
        const res = await searchMaterialesConteo({
          search: search.trim(),
          id_proveedor: provNum,
          target_date: fechaImpacto,
          limit: 10,
        });
        setSearchResults(res);
      } catch {
        // Silently catch search errors
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [search, selectedProvId, fechaImpacto]);

  const alreadyAddedCodes = useMemo(() => new Set(rows.map((r) => r.id_material)), [rows]);

  const handleAddMaterial = (item: ConteoMaterialSearchItem) => {
    if (alreadyAddedCodes.has(item.id_material)) {
      toast.info(`El material ${item.id_material} ya está en la planilla.`);
      setSearch("");
      setShowDropdown(false);
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        id_material: item.id_material,
        nombre: item.nombre,
        unidad: item.unidad,
        id_proveedor: item.id_proveedor,
        nombre_proveedor: item.nombre_proveedor,
        deposito_en_planta: item.deposito_en_planta,
        stock_teorico: item.stock_teorico,
        stock_contado: item.stock_teorico,
        observacion: "",
      },
    ]);
    setSearch("");
    setShowDropdown(false);
    searchRef.current?.focus();
  };

  const handlePreloadProvider = async () => {
    if (selectedProvId === "all") {
      toast.warning("Seleccione un proveedor para precargar sus materiales.");
      return;
    }
    setLoadingPreload(true);
    try {
      const pId = parseInt(selectedProvId, 10);
      const items = await searchMaterialesConteo({
        id_proveedor: pId,
        target_date: fechaImpacto,
        limit: 150,
      });
      if (items.length === 0) {
        toast.info("No se encontraron materiales configurados para este proveedor.");
        return;
      }
      let addedCount = 0;
      setRows((prev) => {
        const existingMap = new Set(prev.map((r) => r.id_material));
        const newRows = [...prev];
        items.forEach((item) => {
          if (!existingMap.has(item.id_material)) {
            newRows.push({
              id_material: item.id_material,
              nombre: item.nombre,
              unidad: item.unidad,
              id_proveedor: item.id_proveedor,
              nombre_proveedor: item.nombre_proveedor,
              deposito_en_planta: item.deposito_en_planta,
              stock_teorico: item.stock_teorico,
              stock_contado: item.stock_teorico,
              observacion: "",
            });
            addedCount++;
          }
        });
        return newRows;
      });
      toast.success(`Se precargaron ${addedCount} materiales a la planilla.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al precargar materiales");
    } finally {
      setLoadingPreload(false);
    }
  };

  const handleRemoveRow = (matId: string) => {
    setRows((prev) => prev.filter((r) => r.id_material !== matId));
  };

  const handleCountChange = (matId: string, val: number) => {
    const safeVal = Math.max(0, isNaN(val) ? 0 : val);
    setRows((prev) =>
      prev.map((r) => (r.id_material === matId ? { ...r, stock_contado: safeVal } : r))
    );
  };

  const handleRowObsChange = (matId: string, obs: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id_material === matId ? { ...r, observacion: obs } : r))
    );
  };

  const handleSaveConteo = async () => {
    if (rows.length === 0) {
      toast.error("La planilla de conteo está vacía.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        fecha_impacto: fechaImpacto,
        observacion: generalObs.trim() || undefined,
        items: rows.map((r) => ({
          id_material: r.id_material,
          stock_contado: r.stock_contado,
          observacion: r.observacion.trim() || undefined,
        })),
      };

      const res = await createConteo(payload);
      setLastSavedConteo(res);
      setRows([]);
      setGeneralObs("");
      toast.success(
        `Conteo #${res.id_conteo} guardado. Sincronizado con Rundown Planta para el ${formatSoloFechaAR(res.fecha_impacto)}.`
      );
      handleOpenSugerencia(res.id_conteo);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar conteo");
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadSugerencia = useCallback(
    async (
      fecha: string,
      modalidad: "completo" | "2_turnos" | "3_turnos",
      id_conteo?: number
    ) => {
      setSugerenciaLoading(true);
      try {
        const payload: {
          fecha_requerida: string;
          fecha_conteo?: string;
          modalidad_turnos: "completo" | "2_turnos" | "3_turnos";
          id_conteo?: number;
          solo_conteo?: boolean;
          materiales?: { id_material: string; stock_contado: number }[];
        } = {
          fecha_requerida: fecha,
          fecha_conteo: fechaImpacto,
          modalidad_turnos: modalidad,
          solo_conteo: true,
        };
        if (id_conteo) {
          payload.id_conteo = id_conteo;
        } else if (rows.length > 0) {
          payload.materiales = rows.map((r) => ({
            id_material: r.id_material,
            stock_contado: r.stock_contado,
          }));
        } else {
          toast.error("No hay materiales en el conteo para sugerir pedidos.");
          setSugerenciaModalOpen(false);
          return;
        }

        const res = await calcularSugerenciaPedido(payload);
        setSugerenciaData(res);

        const initialMap: Record<string, Record<string, number>> = {};
        res.items.forEach((it) => {
          initialMap[it.id_material] = { ...it.sugerido_por_turno };
        });
        setEditedQuantities(initialMap);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al calcular sugerencia");
      } finally {
        setSugerenciaLoading(false);
      }
    },
    [rows]
  );

  const handleOpenSugerencia = (id_conteo?: number) => {
    if (!id_conteo && rows.length === 0) {
      toast.error("La planilla de conteo está vacía. Cargue materiales antes de solicitar la sugerencia.");
      return;
    }
    setSugerenciaTargetConteoId(id_conteo);
    setSugerenciaModalOpen(true);
    loadSugerencia(sugerenciaFecha, sugerenciaModalidad, id_conteo);
  };

  const handleSaveLote = async () => {
    if (!editingLoteItem) return;
    setSavingLote(true);
    try {
      await updateLoteMaterial({
        id_parametro: editingLoteItem.id_parametro,
        lote_mts: editingLoteItem.lote_mts,
        tipo_empaque: editingLoteItem.tipo_empaque,
      });
      toast.success(`Lote de ${editingLoteItem.id_material} actualizado.`);
      setLoteEditModalOpen(false);
      loadSugerencia(sugerenciaFecha, sugerenciaModalidad, sugerenciaTargetConteoId);
    } catch {
      toast.error("Error al actualizar el lote del material");
    } finally {
      setSavingLote(false);
    }
  };

  const handleConfirmCreateOrders = async () => {
    if (!sugerenciaData) return;
    const todayStr = getTodayISODate();
    const targetFecha = sugerenciaFecha && sugerenciaFecha >= todayStr ? sugerenciaFecha : todayStr;
    setIsCreatingOrders(true);
    try {
      const ordersToCreate: PedidoCreate[] = [];

      sugerenciaData.turnos.forEach((turno) => {
        const items: PedidoItemInput[] = [];
        sugerenciaData.items.forEach((it) => {
          const qty = editedQuantities[it.id_material]?.[turno] ?? 0;
          if (qty > 0) {
            items.push({
              id_material: it.id_material,
              cantidad: qty,
              comentario: `DOH Planta: ${it.doh_sugerido_planta}d | Consumo: ${it.consumo_diario}`,
            });
          }
        });

        if (items.length > 0) {
          ordersToCreate.push({
            sector: orderSector,
            prioridad: "normal",
            origen: "conteo_planta",
            fecha_requerida: targetFecha,
            turno: turno === "Completo" ? undefined : turno,
            id_conteo: sugerenciaTargetConteoId,
            id_usuario_solicitante: currentUser?.id_usuario,
            comentario: `Pedido sugerido Conteo (${turno}) para el ${formatSoloFechaAR(targetFecha)}`,
            items: items,
          });
        }
      });

      if (ordersToCreate.length === 0) {
        toast.info("No hay materiales con cantidad sugerida mayor a 0 para pedir.");
        return;
      }

      if (ordersToCreate.length === 1) {
        const created = await createPedido(ordersToCreate[0]);
        toast.success(`Pedido #${created.id_pedido} creado exitosamente.`);
      } else {
        const created = await createPedidosMultiples(ordersToCreate);
        toast.success(
          `${created.length} pedidos creados exitosamente (${ordersToCreate
            .map((o) => o.turno || "Completo")
            .join(", ")}).`
        );
      }

      setSugerenciaModalOpen(false);
      navigate("/pedidos");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear pedidos");
    } finally {
      setIsCreatingOrders(false);
    }
  };

  const handleTransferToNewOrder = (selectedTurno?: string) => {
    if (!sugerenciaData) return;
    const isSpecificTurno = Boolean(selectedTurno && selectedTurno !== "todos" && selectedTurno !== "Completo");
    const suggestedMats = sugerenciaData.items
      .map((it) => {
        let totalNet = 0;
        if (isSpecificTurno) {
          totalNet = editedQuantities[it.id_material]?.[selectedTurno!] ?? (it.sugerido_por_turno[selectedTurno!] ?? 0);
        } else {
          totalNet = Object.values(editedQuantities[it.id_material] || {}).reduce(
            (a, b) => a + b,
            0
          );
        }

        const lotSize = it.tamanio_lote && it.tamanio_lote > 1 ? it.tamanio_lote : 1;
        const isPallet = it.tipo_empaque === "pallet" && lotSize > 1;
        const palletsCount = isPallet
          ? (isSpecificTurno && it.pallets_por_turno?.[selectedTurno!]
              ? it.pallets_por_turno[selectedTurno!]
              : Math.ceil(totalNet / lotSize))
          : undefined;

        return {
          id: it.id_material,
          code: it.id_material,
          name: it.nombre,
          unit: it.unidad,
          suggestedQuantity: totalNet,
          suggestedPallets: palletsCount,
          quantity: totalNet,
          pallets: palletsCount,
          tipo_empaque: it.tipo_empaque || (isPallet ? "pallet" : "unidad"),
          tamanio_lote: lotSize,
          observations: `Consumo día: ${it.consumo_diario} ${it.unidad} | DOH Planta: ${it.doh_sugerido_planta}d`,
        };
      })
      .filter((m) => m.quantity > 0);

    if (suggestedMats.length === 0) {
      toast.info("No hay materiales con cantidad sugerida mayor a 0 para pedir.");
      return;
    }

    setSugerenciaModalOpen(false);
    const todayStr = getTodayISODate();
    const targetFecha = sugerenciaFecha && sugerenciaFecha >= todayStr ? sugerenciaFecha : todayStr;
    navigate("/nuevo-pedido", {
      state: {
        fromConteo: true,
        id_conteo: sugerenciaTargetConteoId,
        fecha_requerida: targetFecha,
        modalidad_turnos: sugerenciaModalidad,
        turno: isSpecificTurno ? selectedTurno : (sugerenciaModalidad === "2_turnos" ? "Turno Mañana" : "Turno Mañana"),
        suggestedMaterials: suggestedMats,
        sector: orderSector,
      },
    });
  };

  const handleOpenDetail = async (id_conteo: number) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const det = await getDetalleConteo(id_conteo);
      setSelectedConteoDetalle(det);
    } catch {
      toast.error("Error al cargar detalle del conteo");
      setDetailModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const summary = useMemo(() => {
    let withDev = 0;
    let totalDev = 0;
    rows.forEach((r) => {
      const dev = r.stock_contado - r.stock_teorico;
      if (dev !== 0) withDev++;
      totalDev += dev;
    });
    return {
      totalItems: rows.length,
      itemsWithDeviation: withDev,
      netDeviation: totalDev,
    };
  }, [rows]);

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-4 pb-32 md:pb-8">
      {/* Cabecera Móvil y Título */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-tight">
                Conteo en Planta
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Verificación física y sincronización con Rundown Planta
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-800">Nicolás</span>
            <span className="text-slate-300">·</span>
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono">{currentTimeStr}</span>
            <span className="text-[10px] bg-slate-200/70 text-slate-600 font-semibold px-1 rounded">
              -03
            </span>
          </div>

          <div className="hidden md:flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                viewMode === "cards" ? "bg-white text-slate-800 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Tarjetas</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                viewMode === "table" ? "bg-white text-slate-800 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutList className="w-3 h-3" />
              <span>Tabla</span>
            </button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-100 p-1 border border-slate-200 w-full grid grid-cols-2">
          <TabsTrigger
            value="planilla"
            className="text-xs py-2 gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-2xs font-semibold"
          >
            <Smartphone className="w-3.5 h-3.5 text-blue-600" />
            <span>Planilla Móvil</span>
            {rows.length > 0 && (
              <Badge className="ml-1 px-1.5 py-0 text-[10px] bg-blue-600 text-white">
                {rows.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="historico"
            className="text-xs py-2 gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-2xs font-semibold"
          >
            <History className="w-3.5 h-3.5" />
            <span>Historial ({historico.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PLANILLA MÓVIL */}
        <TabsContent value="planilla" className="space-y-4">
          {/* Card de Parámetros de la Sesión */}
          <Card className="border-slate-200 shadow-2xs relative z-20 overflow-visible">
            <CardContent className="p-3.5 sm:p-4 space-y-3.5 overflow-visible">
              {/* Selector de Fecha de Cierre */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="fecha-impacto" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    Fecha de Cierre a Ajustar
                  </Label>
                  <span className="text-[11px] font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {formatSoloFechaAR(fechaImpacto)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={fechaImpacto === getArgentinaYesterdayStr() ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFechaImpacto(getArgentinaYesterdayStr())}
                    className={`flex-1 h-9 text-xs font-semibold ${
                      fechaImpacto === getArgentinaYesterdayStr()
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Ayer (Recomendado)
                  </Button>
                  <Button
                    type="button"
                    variant={fechaImpacto === getArgentinaTodayStr() ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFechaImpacto(getArgentinaTodayStr())}
                    className={`flex-1 h-9 text-xs font-semibold ${
                      fechaImpacto === getArgentinaTodayStr()
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Hoy
                  </Button>
                  <Input
                    id="fecha-impacto"
                    type="date"
                    value={fechaImpacto}
                    onChange={(e) => setFechaImpacto(e.target.value)}
                    className="w-32 sm:w-36 h-9 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Filtro y Precarga por Proveedor */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  Precarga Rápida de Materiales por Proveedor
                </Label>
                <div className="flex gap-2">
                  <Select value={selectedProvId} onValueChange={setSelectedProvId}>
                    <SelectTrigger className="h-9 text-xs flex-1">
                      <SelectValue placeholder="Elegir proveedor..." />
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={selectedProvId === "all" || loadingPreload}
                    onClick={handlePreloadProvider}
                    className="h-9 px-3 text-xs border-blue-300 text-blue-700 bg-blue-50/50 hover:bg-blue-100 font-semibold flex items-center gap-1 flex-shrink-0"
                  >
                    {loadingPreload ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Cargar Todo</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Buscador reactivo individual */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <Label className="text-xs font-bold text-slate-800">
                  Buscar Material Individual
                </Label>
                <div className="relative z-30">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10 pointer-events-none" />
                  <Input
                    ref={searchRef}
                    placeholder="Código SAP (ej: PU188) o nombre..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="pl-9 pr-9 h-10 text-xs sm:text-sm shadow-2xs"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setShowDropdown(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 z-10"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  {showDropdown && search.trim().length > 0 && (
                    <>
                      <div
                        className="fixed inset-0 z-40 bg-transparent"
                        onClick={() => setShowDropdown(false)}
                      />
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 overflow-hidden max-h-72 overflow-y-auto ring-1 ring-black/10">
                        {isSearching ? (
                          <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                            <span>Buscando catálogo...</span>
                          </div>
                        ) : searchResults.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400">
                            No se encontraron materiales.
                          </div>
                        ) : (
                        searchResults.map((item) => {
                          const isAdded = alreadyAddedCodes.has(item.id_material);
                          return (
                            <button
                              key={item.id_material}
                              type="button"
                              disabled={isAdded}
                              onClick={() => handleAddMaterial(item)}
                              className={`w-full flex items-center justify-between p-3 text-left border-b border-slate-100 last:border-0 transition-colors ${
                                isAdded
                                  ? "bg-slate-50 opacity-40 cursor-not-allowed"
                                  : "hover:bg-blue-50/70 active:bg-blue-100"
                              }`}
                            >
                              <div className="min-w-0 flex-1 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-xs sm:text-sm text-slate-900">
                                    {item.id_material}
                                  </span>
                                  {item.nombre_proveedor && (
                                    <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-200">
                                      {item.nombre_proveedor}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-slate-600 truncate mt-0.5">{item.nombre}</p>
                                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                                  Teórico: {item.stock_teorico.toLocaleString("es-AR")} {item.unidad}
                                </p>
                              </div>
                              <div className="flex-shrink-0">
                                <span className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 ${
                                  isAdded ? "text-slate-400" : "bg-blue-600 text-white"
                                }`}>
                                  <Plus className="w-3 h-3" />
                                  {isAdded ? "Listo" : "Agregar"}
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* LISTADO DE MATERIALES EN CONTEO */}
          {rows.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
              <CardContent className="py-14 text-center">
                <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-700 font-bold text-sm">Planilla vacía</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Precargá los materiales de un proveedor o buscá códigos individuales para comenzar a contar en planta.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {/* Selector de vista en mobile / summary header */}
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-800">
                  Materiales cargados ({rows.length})
                </span>
                <span className="text-[11px] text-slate-500">
                  {summary.itemsWithDeviation > 0 ? (
                    <span className="text-amber-600 font-semibold">{summary.itemsWithDeviation} con desvío</span>
                  ) : (
                    <span className="text-emerald-600 font-semibold">Todos coinciden</span>
                  )}
                </span>
              </div>

              {/* VISTA 1: TARJETAS MÓVILES ERGONÓMICAS (Default en mobile) */}
              <div className={viewMode === "cards" ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "hidden md:hidden"}>
                {rows.map((row) => {
                  const desvio = row.stock_contado - row.stock_teorico;
                  return (
                    <Card
                      key={row.id_material}
                      className="border-slate-200 shadow-2xs hover:border-blue-300 transition-all overflow-hidden"
                    >
                      <CardContent className="p-3.5 space-y-3">
                        {/* Cabecera de la Tarjeta */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-sm text-slate-900">
                                {row.id_material}
                              </span>
                              {row.nombre_proveedor && (
                                <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-200">
                                  {row.nombre_proveedor}
                                </Badge>
                              )}
                              {row.deposito_en_planta && (
                                <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 px-1 py-0.2 rounded font-normal">
                                  Dep. Planta
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-2 mt-0.5 leading-snug">
                              {row.nombre}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.id_material)}
                            title="Quitar"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Comparación Teórico vs Contado */}
                        <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                              Stock Teórico
                            </span>
                            <span className="font-mono font-bold text-slate-700 text-sm">
                              {row.stock_teorico.toLocaleString("es-AR")}
                            </span>{" "}
                            <span className="text-[11px] text-slate-400">{row.unidad}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                              Desvío
                            </span>
                            {desvio === 0 ? (
                              <Badge className="bg-slate-200/80 text-slate-700 border-slate-300 text-[10px] font-bold hover:bg-slate-200">
                                Coincide (0)
                              </Badge>
                            ) : desvio > 0 ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold hover:bg-emerald-100 gap-0.5">
                                <TrendingUp className="w-3 h-3 text-emerald-600" />
                                +{desvio.toLocaleString("es-AR")}
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 border-red-300 text-[10px] font-bold hover:bg-red-100 gap-0.5">
                                <TrendingDown className="w-3 h-3 text-red-600" />
                                {desvio.toLocaleString("es-AR")}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Botones Grandes de Conteo Táctil */}
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 font-semibold block">
                            Cantidad Contada en Planta:
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCountChange(row.id_material, row.stock_contado - 1)}
                              className="h-11 w-12 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-lg font-bold flex items-center justify-center border border-slate-200 transition-colors flex-shrink-0"
                            >
                              −
                            </button>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              value={row.stock_contado}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) =>
                                handleCountChange(row.id_material, parseFloat(e.target.value) || 0)
                              }
                              className="h-11 text-center font-mono font-bold text-lg border-slate-300 focus:ring-2 focus:ring-blue-500 shadow-2xs"
                            />
                            <button
                              type="button"
                              onClick={() => handleCountChange(row.id_material, row.stock_contado + 1)}
                              className="h-11 w-12 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-lg font-bold flex items-center justify-center border border-slate-200 transition-colors flex-shrink-0"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Nota opcional por material */}
                        <Input
                          placeholder="Nota (opcional, ej: bulto abierto)..."
                          value={row.observacion}
                          onChange={(e) => handleRowObsChange(row.id_material, e.target.value)}
                          className="h-8 text-[11px] bg-white border-slate-200"
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* VISTA 2: TABLA EXPANDIDA (Para desktop o pantallas anchas) */}
              <div className={viewMode === "table" ? "border rounded-lg overflow-hidden border-slate-200 bg-white shadow-2xs" : "hidden"}>
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-32 text-xs font-semibold text-slate-700">Código SAP</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-700">Descripción</TableHead>
                      <TableHead className="w-28 text-xs font-semibold text-slate-700 text-right">Teórico</TableHead>
                      <TableHead className="w-40 text-xs font-semibold text-blue-700 text-center">Contado</TableHead>
                      <TableHead className="w-28 text-xs font-semibold text-slate-700 text-center">Desvío</TableHead>
                      <TableHead className="w-16 text-xs font-semibold text-slate-700 text-center">Unidad</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-700">Observación</TableHead>
                      <TableHead className="w-10 text-center" />
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100">
                    {rows.map((row) => {
                      const desvio = row.stock_contado - row.stock_teorico;
                      return (
                        <TableRow key={row.id_material} className="hover:bg-slate-50/80">
                          <TableCell className="font-mono text-xs font-bold text-slate-800">
                            {row.id_material}
                          </TableCell>
                          <TableCell className="text-xs text-slate-700 max-w-[200px] truncate">
                            {row.nombre}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-slate-600">
                            {row.stock_teorico.toLocaleString("es-AR")}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleCountChange(row.id_material, row.stock_contado - 1)}
                                className="w-7 h-7 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-600 font-bold"
                              >
                                −
                              </button>
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                value={row.stock_contado}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) =>
                                  handleCountChange(row.id_material, parseFloat(e.target.value) || 0)
                                }
                                className="w-20 text-center font-mono font-bold text-xs h-7.5 px-1"
                              />
                              <button
                                type="button"
                                onClick={() => handleCountChange(row.id_material, row.stock_contado + 1)}
                                className="w-7 h-7 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-600 font-bold"
                              >
                                +
                              </button>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">
                            {desvio === 0 ? (
                              <span className="text-slate-400">0</span>
                            ) : desvio > 0 ? (
                              <span className="font-bold text-emerald-700">+{desvio.toLocaleString("es-AR")}</span>
                            ) : (
                              <span className="font-bold text-red-700">{desvio.toLocaleString("es-AR")}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-xs font-mono text-slate-500">
                            {row.unidad}
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder="Observación..."
                              value={row.observacion}
                              onChange={(e) => handleRowObsChange(row.id_material, e.target.value)}
                              className="h-7 text-xs"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(row.id_material)}
                              className="p-1 text-slate-400 hover:text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* BARRA FLOTANTE FIJA EN MÓVIL (Sticky Bottom Action Bar) */}
          {rows.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl z-30 md:static md:bg-transparent md:border-0 md:p-0 md:shadow-none">
              <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-4 p-0 md:p-4 md:bg-slate-50 md:border md:border-slate-200 md:rounded-xl">
                <div className="flex items-center justify-between sm:justify-start gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Total:</span>
                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded font-mono">
                      {summary.totalItems} ítems
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Desvío:</span>
                    <span
                      className={`font-bold font-mono px-2 py-0.5 rounded ${
                        summary.netDeviation === 0
                          ? "bg-slate-100 text-slate-700"
                          : summary.netDeviation > 0
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {summary.netDeviation > 0 ? `+${summary.netDeviation.toLocaleString("es-AR")}` : summary.netDeviation.toLocaleString("es-AR")}
                    </span>
                  </div>
                  {summary.itemsWithDeviation > 0 && (
                    <span className="text-[11px] text-amber-600 font-semibold hidden sm:inline">
                      ({summary.itemsWithDeviation} con desvío)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenSugerencia()}
                    className="h-10 text-xs border-slate-300 gap-1.5 px-3 flex"
                  >
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>Sugerir Pedido</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={handleSaveConteo}
                    className="flex-1 sm:flex-initial h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirmar Conteo ({rows.length})</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* TAB 2: HISTORIAL DE CONTEOS */}
        <TabsContent value="historico" className="space-y-4">
          <div className="space-y-2.5">
            {loadingHistorico ? (
              <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                <span>Cargando sesiones...</span>
              </div>
            ) : historico.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No hay sesiones de conteo registradas todavía.
              </div>
            ) : (
              historico.map((item) => (
                <Card
                  key={item.id_conteo}
                  className="border-slate-200 shadow-2xs hover:border-blue-300 transition-all"
                >
                  <CardContent className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          Conteo #{item.id_conteo}
                        </span>
                        <Badge variant="outline" className="text-blue-700 border-blue-200 text-[10px]">
                          Cierre {item.fecha_impacto ? formatSoloFechaAR(item.fecha_impacto) : "N/A"}
                        </Badge>
                      </div>
                      <p className="text-slate-500 text-[11px]">
                        Registrado: {item.fecha_finalizacion ? formatFechaAR(item.fecha_finalizacion) : "N/A"} por{" "}
                        <strong className="text-slate-700">{item.nombre_usuario || `Usuario #${item.id_usuario}`}</strong>
                      </p>
                      {item.observacion && (
                        <p className="text-slate-600 text-[11px] italic">"{item.observacion}"</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-right sm:text-center">
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                          Materiales
                        </span>
                        <span className="font-mono font-bold text-slate-800">{item.total_items}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                          Desvío Neto
                        </span>
                        <span
                          className={`font-mono font-bold ${
                            item.total_desvio === 0
                              ? "text-slate-600"
                              : item.total_desvio > 0
                              ? "text-emerald-700"
                              : "text-red-700"
                          }`}
                        >
                          {item.total_desvio > 0 ? `+${item.total_desvio.toLocaleString("es-AR")}` : item.total_desvio.toLocaleString("es-AR")}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDetail(item.id_conteo)}
                        className="h-8 px-3 text-xs border-slate-300 font-semibold"
                      >
                        Ver Detalle
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL DE ÉXITO TRAS GUARDAR */}
      <Dialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <DialogContent className="max-w-md w-[92vw] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Conteo Registrado con Éxito
            </DialogTitle>
          </DialogHeader>

          {lastSavedConteo && (
            <div className="space-y-3 py-2 text-xs text-slate-600">
              <p>
                La sesión <strong className="text-slate-900">#{lastSavedConteo.id_conteo}</strong> se guardó correctamente y ya está sincronizada con el Rundown.
              </p>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Fecha impacto:</span>
                  <span className="font-bold text-blue-700">
                    {formatSoloFechaAR(lastSavedConteo.fecha_impacto)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Total materiales:</span>
                  <span className="font-bold text-slate-800">{lastSavedConteo.total_items}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Responsable:</span>
                  <span className="text-slate-800 font-sans font-medium">{lastSavedConteo.nombre_usuario}</span>
                </div>
              </div>

              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-600" />
                <span>
                  El stock de cierre de ayer y el saldo de arranque de hoy en el Rundown de Planta ya se actualizaron automáticamente.
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" onClick={() => setSuccessModalOpen(false)} className="w-full sm:w-auto">
              Cerrar
            </Button>
            {lastSavedConteo && (
              <Button
                size="sm"
                onClick={() => {
                  const idConteo = lastSavedConteo.id_conteo;
                  setSuccessModalOpen(false);
                  handleOpenSugerencia(idConteo);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 w-full sm:w-auto font-bold"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sugerir Pedido</span>
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                setSuccessModalOpen(false);
                navigate("/rundown");
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 w-full sm:w-auto"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ver Rundown</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DETALLE DE CONTEO HISTÓRICO */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-xl w-[94vw] max-h-[85vh] flex flex-col rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <ClipboardList className="w-4 h-4 text-blue-600" />
              Detalle Conteo #{selectedConteoDetalle?.id_conteo}
            </DialogTitle>
          </DialogHeader>

          {loadingDetail ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              <span>Cargando...</span>
            </div>
          ) : selectedConteoDetalle ? (
            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Fecha Cierre:</span>
                  <span className="font-mono font-bold text-blue-700">
                    {formatSoloFechaAR(selectedConteoDetalle.fecha_impacto)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Responsable:</span>
                  <span className="font-medium text-slate-800">{selectedConteoDetalle.nombre_usuario}</span>
                </div>
              </div>

              <div className="space-y-2">
                {selectedConteoDetalle.items.map((item) => (
                  <div
                    key={item.id_material}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">{item.id_material}</span>
                      <span className="font-mono font-bold text-blue-700">
                        Contado: {item.stock_contado.toLocaleString("es-AR")} {item.unidad}
                      </span>
                    </div>
                    <p className="text-slate-600 truncate">{item.nombre_material || item.id_material}</p>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                      <span className="text-slate-400">
                        Teórico: {item.stock_teorico.toLocaleString("es-AR")}
                      </span>
                      <span
                        className={`font-bold font-mono ${
                          item.desvio === 0
                            ? "text-slate-500"
                            : item.desvio > 0
                            ? "text-emerald-700"
                            : "text-red-700"
                        }`}
                      >
                        Desvío: {item.desvio > 0 ? `+${item.desvio.toLocaleString("es-AR")}` : item.desvio.toLocaleString("es-AR")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setDetailModalOpen(false)} className="w-full">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE SUGERENCIA INTELIGENTE DE PEDIDOS */}
      <Dialog open={sugerenciaModalOpen} onOpenChange={setSugerenciaModalOpen}>
        <DialogContent className="max-w-4xl w-[96vw] max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden rounded-2xl">
          <DialogHeader className="flex-shrink-0 pb-2">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-900">
              <Sparkles className="w-5 h-5 text-blue-600" />
              Sugerencia de Pedidos (DOH Planta)
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Calcula las cantidades a pedir al depósito para alcanzar el DOH configurado en planta, analiza pedidos previos y permite particionar por turnos.
            </p>
          </DialogHeader>

          {lastSavedConteo && lastSavedConteo.id_conteo === sugerenciaTargetConteoId && (
            <div className="flex-shrink-0 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <span className="font-bold">Conteo #{lastSavedConteo.id_conteo} registrado y sincronizado.</span>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    {lastSavedConteo.total_items} materiales actualizados para el {formatSoloFechaAR(lastSavedConteo.fecha_impacto)}. A continuación se detalla la propuesta de reposición:
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* BARRA DE CONFIGURACIÓN DE LA SUGERENCIA */}
          <div className="flex-shrink-0 bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <Label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Sector Solicitante
                </Label>
                <div className="h-8 px-2.5 bg-white border border-slate-200 rounded-lg flex items-center gap-1.5 shadow-2xs">
                  <Building className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800">{orderSector}</span>
                  {isSectorLocked && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 bg-slate-100 px-1 py-0.5 rounded font-medium" title="Sector asignado automáticamente a tu perfil">
                      <Lock className="w-2.5 h-2.5" /> Fijo
                    </span>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Fecha Requerida
                </Label>
                <Input
                  type="date"
                  value={sugerenciaFecha}
                  onChange={(e) => {
                    setSugerenciaFecha(e.target.value);
                    loadSugerencia(e.target.value, sugerenciaModalidad, sugerenciaTargetConteoId);
                  }}
                  className="h-8 text-xs font-mono bg-white w-36"
                />
              </div>

              <div>
                <Label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Partición por Turnos
                </Label>
                <div className="flex rounded-lg border border-slate-200 p-0.5 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setSugerenciaModalidad("completo");
                      loadSugerencia(sugerenciaFecha, "completo", sugerenciaTargetConteoId);
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                      sugerenciaModalidad === "completo"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Día Completo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSugerenciaModalidad("2_turnos");
                      loadSugerencia(sugerenciaFecha, "2_turnos", sugerenciaTargetConteoId);
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                      sugerenciaModalidad === "2_turnos"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Split className="w-3 h-3" />
                    Mañana / Tarde
                  </button>
                  <button
                    type="button"
                    disabled
                    className="px-2.5 py-1 text-xs font-semibold rounded-md text-slate-400 bg-slate-100 flex items-center gap-1 cursor-not-allowed opacity-60"
                    title="Turno Noche actualmente bloqueado / no operativo"
                  >
                    <Lock className="w-3 h-3 text-slate-400" />
                    Turno Noche (Bloqueado)
                  </button>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadSugerencia(sugerenciaFecha, sugerenciaModalidad, sugerenciaTargetConteoId)}
              disabled={sugerenciaLoading}
              className="h-8 text-xs gap-1.5 self-end md:self-center"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${sugerenciaLoading ? "animate-spin" : ""}`} />
              Recalcular
            </Button>
          </div>

          {/* CONTENIDO SCROLLABLE DE MATERIALES SUGERIDOS */}
          <div className="flex-1 overflow-y-auto py-2 space-y-3 pr-1">
            {sugerenciaLoading ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                <p className="text-xs">Calculando demanda con BOM, DOH planta y pedidos previos...</p>
              </div>
            ) : !sugerenciaData ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                No se obtuvieron datos de sugerencia.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs px-1 text-slate-600 font-medium">
                  <span>
                    Objetivo: <strong className="text-slate-900">{formatSoloFechaAR(sugerenciaData.fecha_requerida)}</strong>
                  </span>
                  <span className="text-blue-700 font-bold">
                    {sugerenciaData.materiales_a_pedir} materiales con requerimiento neto
                  </span>
                </div>

                {sugerenciaData.items.map((item) => {
                  const hasExisting = item.pedidos_existentes.length > 0;
                  const totalNetoMat = Object.values(
                    editedQuantities[item.id_material] || {}
                  ).reduce((a, b) => a + b, 0);

                  return (
                    <div
                      key={item.id_material}
                      className={`p-3.5 rounded-xl border transition-all ${
                        totalNetoMat > 0
                          ? "bg-white border-blue-200 shadow-xs"
                          : "bg-slate-50/70 border-slate-200 opacity-80"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-slate-900 text-sm">
                              {item.id_material}
                            </span>
                            <Badge variant="outline" className="text-[10px] bg-slate-50 font-normal">
                              {item.unidad}
                            </Badge>
                            {item.tipo_empaque === "pallet" && item.tamanio_lote && item.tamanio_lote > 1 ? (
                              <Badge className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 gap-1 font-semibold">
                                <Package className="w-2.5 h-2.5" />
                                Pallet ({item.tamanio_lote} {item.unidad})
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600">
                                Unidades
                              </Badge>
                            )}
                            {item.id_parametro && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLoteItem({
                                    id_parametro: item.id_parametro!,
                                    id_material: item.id_material,
                                    nombre: item.nombre,
                                    tipo_empaque: item.tipo_empaque || "pallet",
                                    lote_mts: item.tamanio_lote || item.lote_minimo || 1,
                                  });
                                  setLoteEditModalOpen(true);
                                }}
                                className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition-colors"
                                title="Editar tamaño de lote y empaque"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                            <span className="text-xs text-slate-600 font-medium truncate max-w-[200px] sm:max-w-none">
                              {item.nombre}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Proveedor: {item.nombre_proveedor}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">DOH Planta</span>
                            <span className="font-mono font-bold text-blue-700">
                              {item.doh_sugerido_planta} d
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">Consumo Día</span>
                            <span className="font-mono font-bold text-slate-800">
                              {item.consumo_diario}
                            </span>
                          </div>
                          {item.consumo_sig !== undefined && item.consumo_sig > 0 && (
                            <div className="text-right hidden sm:block">
                              <span className="text-[10px] text-slate-400 block">Consumo Día Sig</span>
                              <span className="font-mono font-medium text-slate-600">
                                {item.consumo_sig}
                              </span>
                            </div>
                          )}
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">Stock Planta</span>
                            <span className={`font-mono font-semibold ${item.stock_contado < 0 ? "text-rose-600 font-bold" : "text-slate-700"}`}>
                              {item.stock_contado}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">Stock CL2</span>
                            <span className={`font-mono font-semibold ${(item.stock_cl2 ?? 0) > 0 ? "text-slate-900 font-bold" : "text-amber-600"}`}>
                              {(item.stock_cl2 ?? 0).toLocaleString("es-AR")}
                            </span>
                          </div>
                          <div className="text-right border-l pl-2.5 border-slate-100 hidden sm:block">
                            <span className="text-[10px] text-slate-400 block">Meta Objetivo</span>
                            <span className="font-mono font-semibold text-indigo-700">
                              {item.stock_objetivo}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ALERTA DE PEDIDOS YA REGISTRADOS */}
                      {hasExisting && (
                        <div className="mt-2.5 p-2 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 font-medium">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                            <span>Pedidos ya registrados para esta fecha:</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {item.pedidos_existentes.map((pe) => (
                              <Badge
                                key={pe.id_pedido}
                                variant="outline"
                                className="bg-white text-amber-800 border-amber-300 font-mono text-[10px] py-0"
                              >
                                #{pe.id_pedido} ({pe.turno || "Completo"}): {pe.cantidad_pedida} {item.unidad}
                              </Badge>
                            ))}
                            <span className="text-[11px] font-bold text-amber-800 self-center">
                              Total: -{item.cantidad_ya_pedida_total} {item.unidad}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* INPUTS DE CANTIDAD A PEDIR SEGÚN MODALIDAD */}
                      <div className="mt-3 pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60 p-2.5 rounded-lg">
                        <div className="text-xs text-slate-500">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>Sugerencia neta: </span>
                            {item.tipo_empaque === "pallet" && item.tamanio_lote && item.tamanio_lote > 1 ? (
                              <Badge className="bg-blue-100 text-blue-900 border-blue-200 text-xs font-bold py-0.5">
                                {item.cantidad_pallets_sugerida} {item.cantidad_pallets_sugerida === 1 ? "Pallet" : "Pallets"} ({item.cantidad_sugerida_neta} {item.unidad})
                              </Badge>
                            ) : (
                              <strong className="text-slate-900 font-bold">{item.cantidad_sugerida_neta} {item.unidad}</strong>
                            )}
                            {item.cantidad_ya_pedida_total > 0 && (
                              <span className="text-amber-700 font-medium">(-{item.cantidad_ya_pedida_total} ya pedidos)</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            Proyectado al inicio: {item.stock_proyectado_inicio} {item.unidad} • Mínimo 50% DOH: {item.stock_minimo_inicio} {item.unidad}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap justify-end">
                          {sugerenciaData.turnos.map((turno) => {
                            const isPalletMat = item.tipo_empaque === "pallet" && item.tamanio_lote && item.tamanio_lote > 1;
                            const currentVal = editedQuantities[item.id_material]?.[turno] ?? 0;
                            const currentPallets = isPalletMat ? Math.round(currentVal / item.tamanio_lote!) : 0;
                            const pedidosTurno = item.pedidos_por_turno[turno] ?? 0;

                            return (
                              <div key={turno} className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
                                <Label className="text-[11px] font-bold text-slate-700 flex items-center gap-1 px-1">
                                  {(turno === "Turno Mañana" || turno === "T1") && <Sun className="w-3 h-3 text-amber-500" />}
                                  {(turno === "Turno Tarde" || turno === "T2") && <Moon className="w-3 h-3 text-indigo-500" />}
                                  {(turno === "Turno Noche" || turno === "T3") && <Lock className="w-3 h-3 text-slate-400" />}
                                  {turno}:
                                </Label>
                                {isPalletMat ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={currentPallets}
                                      onChange={(e) => {
                                        const pVal = Math.max(0, parseInt(e.target.value, 10) || 0);
                                        const unitsVal = pVal * item.tamanio_lote!;
                                        setEditedQuantities((prev) => ({
                                          ...prev,
                                          [item.id_material]: {
                                            ...(prev[item.id_material] || {}),
                                            [turno]: unitsVal,
                                          },
                                        }));
                                      }}
                                      className="h-7 w-16 font-mono font-bold text-right text-xs bg-white border-slate-300 focus:border-blue-500"
                                    />
                                    <span className="text-[11px] text-indigo-700 font-semibold pr-1">
                                      pal ({currentVal} {item.unidad})
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={currentVal}
                                      onChange={(e) => {
                                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                                        setEditedQuantities((prev) => ({
                                          ...prev,
                                          [item.id_material]: {
                                            ...(prev[item.id_material] || {}),
                                            [turno]: val,
                                          },
                                        }));
                                      }}
                                      className="h-7 w-20 font-mono font-bold text-right text-xs bg-white border-slate-300 focus:border-blue-500"
                                    />
                                    <span className="text-[11px] text-slate-400 pr-1">{item.unidad}</span>
                                  </div>
                                )}
                                {pedidosTurno > 0 && (
                                  <span className="text-[10px] text-amber-600 font-medium">
                                    (-{pedidosTurno})
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* FOOTER CON BOTONES DE ACCIÓN */}
          <DialogFooter className="flex-shrink-0 pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSugerenciaModalOpen(false)}
              className="w-full sm:w-auto text-slate-500 hover:text-slate-800"
            >
              Cancelar
            </Button>

            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto justify-end">
              {sugerenciaModalidad === "2_turnos" ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTransferToNewOrder("Turno Mañana")}
                    disabled={!sugerenciaData || sugerenciaLoading}
                    className="w-full sm:w-auto text-blue-700 border-blue-200 hover:bg-blue-50 font-semibold gap-1.5"
                  >
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span>Revisar Turno Mañana</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTransferToNewOrder("Turno Tarde")}
                    disabled={!sugerenciaData || sugerenciaLoading}
                    className="w-full sm:w-auto text-indigo-700 border-indigo-200 hover:bg-indigo-50 font-semibold gap-1.5"
                  >
                    <Moon className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Revisar Turno Tarde</span>
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleTransferToNewOrder()}
                  disabled={!sugerenciaData || sugerenciaLoading}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1.5 shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-white" />
                  <span>Revisar y Confirmar en Nuevo Pedido</span>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleConfirmCreateOrders}
                disabled={!sugerenciaData || sugerenciaLoading || isCreatingOrders}
                className="w-full sm:w-auto text-slate-700 border-slate-300 gap-1.5 text-xs"
                title="Generar los pedidos de forma directa sin pasar por la pantalla de revisión"
              >
                {isCreatingOrders ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Emitiendo...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      Crear Directo ({sugerenciaData?.turnos.length && sugerenciaData.turnos.length > 1 ? `${sugerenciaData.turnos.length} pedidos` : "1 pedido"})
                    </span>
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE EDICIÓN RÁPIDA DE LOTE Y PRESENTACIÓN */}
      <Dialog open={loteEditModalOpen} onOpenChange={setLoteEditModalOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Package className="w-5 h-5 text-indigo-600" />
              Configurar Lote y Empaque
            </DialogTitle>
          </DialogHeader>

          {editingLoteItem && (
            <div className="space-y-4 py-2">
              <div>
                <span className="text-xs text-slate-400 block">Material</span>
                <span className="font-mono font-bold text-sm text-slate-800">
                  {editingLoteItem.id_material} - {editingLoteItem.nombre}
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Tipo de Empaque</Label>
                <Select
                  value={editingLoteItem.tipo_empaque}
                  onValueChange={(val) =>
                    setEditingLoteItem({ ...editingLoteItem, tipo_empaque: val })
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

              {editingLoteItem.tipo_empaque === "pallet" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Tamaño de Lote (Piezas por Pallet)
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={editingLoteItem.lote_mts}
                    onChange={(e) =>
                      setEditingLoteItem({
                        ...editingLoteItem,
                        lote_mts: Math.max(1, parseFloat(e.target.value) || 1),
                      })
                    }
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[11px] text-slate-500">
                    Ej: Para espumas, 182 piezas forman un pallet completo. Los pedidos sugeridos se redondearán a pallets enteros.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLoteEditModalOpen(false)}
              disabled={savingLote}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveLote}
              disabled={savingLote}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              {savingLote && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Guardar y Recalcular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
