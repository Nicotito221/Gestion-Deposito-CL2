import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import {
  Plus,
  Trash2,
  Calendar,
  User,
  ClipboardList,
  ShoppingCart,
  RefreshCw,
  Sun,
  Moon,
  Lock,
  Building,
  ArrowLeft,
  Layers,
  AlertCircle,
  CheckCircle2,
  Minus,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import {
  createPedido,
  searchMaterialesCatalogo,
  calcularSugerenciaPedido,
  type MaterialCatalogoItem,
  type CalcularSugerenciaResponse,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { formatSoloFechaAR, getTodayISODate, getTurnoSugeridoActual } from "../components/ui/format";

interface Material {
  id: string;
  code: string;
  name: string;
  suggestedQuantity?: number;
  suggestedPallets?: number;
  quantity: number;
  unit: string;
  observations: string;
  tipo_empaque?: string;
  tamanio_lote?: number;
  unidad_por_bulto?: number;
  bultos_por_pallet?: number;
  pallets?: number;
  suggestedBultos?: number;
  bultos?: number;
}

const SECTORES_PLANTA = [
  "Despacho",
  "PC",
  "CL2",
  "Recepcion",
  "Administracion",
];

const ROLES_BADGES: Record<string, { label: string; color: string }> = {
  administrador: { label: "Administrador", color: "bg-purple-100 text-purple-700 border-purple-200" },
  gerente: { label: "Gerente", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  jefe: { label: "Jefe", color: "bg-blue-100 text-blue-700 border-blue-200" },
  analista: { label: "Analista", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  deposito: { label: "Depósito", color: "bg-amber-100 text-amber-700 border-amber-200" },
  contador_ciclico: { label: "Contador Cíclico", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  supervisor: { label: "Supervisor", color: "bg-slate-100 text-slate-700 border-slate-200" },
  operario_deposito: { label: "Operario Depósito", color: "bg-amber-100 text-amber-700 border-amber-200" },
  operario_planta: { label: "Operario Planta", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  solicitante: { label: "Solicitante", color: "bg-slate-100 text-slate-700 border-slate-200" },
};

export function NewOrder() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser } = useAuth();

  const [fromConteo, setFromConteo] = useState<boolean>(location.state?.fromConteo === true);
  const idConteo: number | undefined = location.state?.id_conteo ? Number(location.state.id_conteo) : undefined;
  const suggestedMaterials: Material[] = location.state?.suggestedMaterials ?? [];
  const todayStr = useMemo(() => getTodayISODate(), []);
  const initialFechaReq =
    location.state?.fecha_requerida && location.state.fecha_requerida >= todayStr
      ? location.state.fecha_requerida
      : todayStr;
  const initialTurno = location.state?.turno || getTurnoSugeridoActual();

  const isSectorLocked = Boolean(currentUser?.sector && currentUser.sector !== "TODOS");
  const initialSector = isSectorLocked
    ? (currentUser?.sector as string)
    : location.state?.sector || (currentUser?.sector === "TODOS" ? "Despacho" : "PC");

  const [sector, setSector] = useState<string>(initialSector);
  const [priority, setPriority] = useState<"normal" | "urgente">("normal");
  const [fechaRequerida, setFechaRequerida] = useState<string>(initialFechaReq);
  const [turno, setTurno] = useState<string>(initialTurno);
  const [materials, setMaterials] = useState<Material[]>(() => {
    if (suggestedMaterials.length > 0) {
      return suggestedMaterials.map((m) => {
        const lotSize = m.tamanio_lote && m.tamanio_lote > 1 ? m.tamanio_lote : 1;
        const isPackagingLot = (m.tipo_empaque === "pallet" || m.tipo_empaque === "rollo" || (!m.tipo_empaque && lotSize > 1)) && lotSize > 1;
        const pCount = isPackagingLot ? (m.pallets ?? Math.ceil(m.quantity / lotSize)) : undefined;
        const suggPCount = isPackagingLot ? (m.suggestedPallets ?? Math.ceil((m.suggestedQuantity ?? m.quantity) / lotSize)) : undefined;
        const bCount = (m.tipo_empaque === "rollo" && pCount && m.bultos_por_pallet) ? pCount * m.bultos_por_pallet : m.bultos;
        const suggBCount = (m.tipo_empaque === "rollo" && suggPCount && m.bultos_por_pallet) ? suggPCount * m.bultos_por_pallet : m.suggestedBultos;
        return {
          ...m,
          tipo_empaque: m.tipo_empaque || (isPackagingLot ? "pallet" : "unidad"),
          tamanio_lote: lotSize,
          pallets: pCount,
          suggestedPallets: suggPCount,
          bultos: bCount,
          suggestedBultos: suggBCount,
        };
      });
    }
    return [];
  });
  const [loadingSuggestion, setLoadingSuggestion] = useState<boolean>(false);

  const [searchValue, setSearchValue] = useState("");
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogResults, setCatalogResults] = useState<MaterialCatalogoItem[]>([]);
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isSectorLocked && currentUser?.sector) {
      setSector(currentUser.sector);
    }
  }, [isSectorLocked, currentUser?.sector]);

  useEffect(() => {
    if (!searchValue.trim()) {
      setCatalogResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingCatalog(true);
      try {
        const res = await searchMaterialesCatalogo(searchValue.trim());
        setCatalogResults(res);
      } catch {
        setCatalogResults([]);
      } finally {
        setIsSearchingCatalog(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchValue]);

  const alreadyAdded = useMemo(() => new Set(materials.map((m) => m.code)), [materials]);
  const catalogFiltered = useMemo(
    () => catalogResults.filter((c) => !alreadyAdded.has(c.id_material)).slice(0, 8),
    [catalogResults, alreadyAdded]
  );

  const totalQuantity = useMemo(
    () => materials.reduce((acc, m) => acc + (Number(m.quantity) || 0), 0),
    [materials]
  );

  const totalPallets = useMemo(
    () =>
      materials.reduce((acc, m) => {
        const isPackaging = (m.tipo_empaque === "pallet" || m.tipo_empaque === "rollo") && (m.tamanio_lote || 1) > 1;
        if (!isPackaging) return acc;
        return acc + (m.pallets ?? Math.ceil(m.quantity / (m.tamanio_lote || 1)));
      }, 0),
    [materials]
  );

  const [suggestionPreview, setSuggestionPreview] = useState<CalcularSugerenciaResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [previewExpanded, setPreviewExpanded] = useState<boolean>(true);

  useEffect(() => {
    let isCancelled = false;
    const loadPreview = async () => {
      const finalSector = isSectorLocked ? (currentUser?.sector as string) : sector;
      if (!finalSector) return;
      setLoadingPreview(true);
      try {
        const res = await calcularSugerenciaPedido({
          sector: finalSector,
          fecha_requerida: fechaRequerida,
          turno: turno,
          modalidad_turnos: "completo",
          id_conteo: idConteo,
        });
        if (!isCancelled) {
          setSuggestionPreview(res);
        }
      } catch {
        if (!isCancelled) {
          setSuggestionPreview(null);
        }
      } finally {
        if (!isCancelled) {
          setLoadingPreview(false);
        }
      }
    };
    loadPreview();
    return () => {
      isCancelled = true;
    };
  }, [fechaRequerida, turno, sector, isSectorLocked, currentUser?.sector, idConteo]);

  const previewEvaluatedItems = useMemo(() => {
    if (!suggestionPreview) return [];
    return suggestionPreview.items.map((it) => {
      const qty = it.cantidad_sugerida_neta;
      const lotSize = it.tamanio_lote && it.tamanio_lote > 1 ? it.tamanio_lote : 1;
      const isPackaging = (it.tipo_empaque === "pallet" || it.tipo_empaque === "rollo" || (!it.tipo_empaque && lotSize > 1)) && lotSize > 1;
      const finalTipo = it.tipo_empaque || (isPackaging ? "pallet" : "unidad");
      const pCount = isPackaging ? (it.cantidad_pallets_sugerida ?? Math.ceil(qty / lotSize)) : undefined;
      const bCount = (finalTipo === "rollo" && it.bultos_por_pallet && pCount) ? pCount * it.bultos_por_pallet : it.cantidad_bultos_sugerida;
      return {
        material: {
          id: it.id_material,
          code: it.id_material,
          name: it.nombre,
          unit: it.unidad,
          suggestedQuantity: qty,
          suggestedPallets: pCount,
          suggestedBultos: bCount,
          quantity: qty,
          pallets: pCount,
          bultos: bCount,
          bultos_por_pallet: it.bultos_por_pallet,
          unidad_por_bulto: it.unidad_por_bulto,
          tipo_empaque: finalTipo,
          tamanio_lote: lotSize,
          observations: `Sugerido por Conteo | Consumo: ${it.consumo_diario} ${it.unidad} | DOH Planta: ${it.doh_sugerido_planta}d`,
        } as Material,
        raw: it,
        qtySugerida: qty,
        palletsSugeridos: pCount,
        isPallet: isPackaging,
        lotSize,
        tieneDeficit: qty > 0,
      };
    });
  }, [suggestionPreview, turno]);

  const previewItemsConDeficit = useMemo(() => {
    return previewEvaluatedItems.filter((it) => it.tieneDeficit);
  }, [previewEvaluatedItems]);

  const applySuggestionItems = (itemsToLoad: Material[]) => {
    if (itemsToLoad.length === 0) {
      toast.info("No hay materiales para cargar.");
      return;
    }
    setMaterials(itemsToLoad);
    setFromConteo(true);
    toast.success(`${itemsToLoad.length} materiales sugeridos cargados correctamente.`);
  };

  const handleLoadSuggestion = async () => {
    const finalSector = isSectorLocked ? (currentUser?.sector as string) : sector;
    if (!finalSector) {
      toast.error("Seleccione un sector antes de recalcular la sugerencia.");
      return;
    }
    setLoadingSuggestion(true);
    try {
      const res = await calcularSugerenciaPedido({
        sector: finalSector,
        fecha_requerida: fechaRequerida,
        turno: turno,
        modalidad_turnos: "completo",
      });
      setSuggestionPreview(res);
      toast.success("Sugerencias recalculadas correctamente.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al recalcular sugerencia de pedido");
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const handleAddFromCatalog = (item: MaterialCatalogoItem) => {
    const lotSize = item.tamanio_lote && item.tamanio_lote > 1 ? item.tamanio_lote : 1;
    const isPackaging = (item.tipo_empaque === "rollo" || item.tipo_empaque === "pallet" || (!item.tipo_empaque && lotSize > 1)) && lotSize > 1;
    const finalTipoEmpaque = item.tipo_empaque || (isPackaging ? "pallet" : "unidad");
    const bpp = item.bultos_por_pallet ?? undefined;
    const initialPallets = isPackaging ? 1 : undefined;
    const initialBultos = (finalTipoEmpaque === "rollo" && bpp) ? bpp : undefined;
    const initialQty = isPackaging ? lotSize : 1;
    setMaterials((prev) => [
      ...prev,
      {
        id: String(Date.now()) + Math.random().toString(36).substring(2, 6),
        code: item.id_material,
        name: item.nombre || item.id_material,
        unit: item.unidad || "UN",
        quantity: initialQty,
        pallets: initialPallets,
        bultos: initialBultos,
        bultos_por_pallet: bpp,
        unidad_por_bulto: item.unidad_por_bulto ?? undefined,
        tipo_empaque: finalTipoEmpaque,
        tamanio_lote: lotSize,
        observations: "",
      },
    ]);
    setSearchValue("");
    setShowCatalog(false);
  };

  const handleRemoveMaterial = (id: string) => {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  };

  const handleUpdateMaterial = (id: string, field: keyof Material, value: string | number) => {
    setMaterials((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleStepQuantity = (id: string, delta: number) => {
    setMaterials((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const lotSize = (m.tamanio_lote && m.tamanio_lote > 1) ? m.tamanio_lote : 1;
          const isPackagingLot = (m.tipo_empaque === "pallet" || m.tipo_empaque === "rollo") && lotSize > 1;
          if (isPackagingLot) {
            const currentPallets = m.pallets ?? Math.ceil(m.quantity / lotSize);
            const updatedPallets = Math.max(1, currentPallets + delta);
            const updatedBultos = (m.tipo_empaque === "rollo" && m.bultos_por_pallet)
              ? updatedPallets * m.bultos_por_pallet
              : undefined;
            return {
              ...m,
              pallets: updatedPallets,
              bultos: updatedBultos,
              quantity: updatedPallets * lotSize,
            };
          }
          const updated = Math.max(1, (Number(m.quantity) || 0) + delta);
          return { ...m, quantity: updated };
        }
        return m;
      })
    );
  };

  const handleSubmit = async () => {
    const finalSector = isSectorLocked ? (currentUser?.sector as string) : sector;
    if (!finalSector) {
      toast.error("Por favor seleccione un sector solicitante");
      return;
    }
    if (materials.length === 0) {
      toast.error("Debe agregar al menos un material");
      return;
    }
    if (!fechaRequerida || fechaRequerida < todayStr) {
      toast.error("La fecha requerida no puede ser anterior a la fecha actual.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        sector: finalSector,
        prioridad: priority,
        origen: (fromConteo ? "conteo_planta" : "manual") as "conteo_planta" | "manual",
        fecha_requerida: fechaRequerida,
        turno: turno === "Completo" ? undefined : turno,
        id_conteo: idConteo,
        id_usuario_solicitante: currentUser?.id_usuario,
        comentario: `Pedido ${fromConteo ? "sugerido desde conteo" : "manual"} para el ${formatSoloFechaAR(fechaRequerida)}${turno && turno !== "Completo" ? ` (${turno})` : ""}`,
        items: materials.map((m) => ({
          id_material: m.code,
          cantidad: m.quantity,
          comentario: m.observations || undefined,
        })),
      };

      const res = await createPedido(payload);
      toast.success(`Pedido #${res.id_pedido} registrado y enviado exitosamente.`);
      setTimeout(() => navigate("/pedidos"), 800);
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
      else toast.error("Error al registrar pedido");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentDate = new Date().toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const rolCfg = currentUser?.rol ? ROLES_BADGES[currentUser.rol] : undefined;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6">
      {/* Header & Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/pedidos")}
            className="h-9 w-9 p-0 text-slate-500 hover:text-slate-800"
            title="Volver a Mis Pedidos"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Nuevo Pedido de Materiales
              </h1>
              {fromConteo ? (
                <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                  Desde Conteo
                </Badge>
              ) : (
                <Badge variant="outline" className="text-slate-600 bg-slate-50 text-xs">
                  Carga Manual
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500">
              Solicitud interna de insumos hacia el depósito general
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/pedidos")}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={isSubmitting || materials.length === 0}
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 text-xs shadow-xs"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Registrando...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirmar y Enviar Pedido</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Sugerencia Inteligente Preview & Banner */}
      <Card className="border-blue-200/80 bg-linear-to-b from-blue-50/50 to-white shadow-2xs overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-blue-100 flex flex-row items-center justify-between gap-3 bg-blue-50/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 rounded-md text-blue-700">
              <Sparkles className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold text-blue-950">
                  Sugerencia Inteligente de Pedidos (Preview)
                </CardTitle>
                {loadingPreview && <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />}
              </div>
              <p className="text-[11px] text-blue-700">
                Calculado en vivo para <strong>{formatSoloFechaAR(fechaRequerida)}</strong> &bull; <strong>{turno}</strong> &bull; Sector <strong>{isSectorLocked ? (currentUser?.sector as string) : sector}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {previewItemsConDeficit.length > 0 ? (
              <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-semibold text-xs">
                {previewItemsConDeficit.length} {previewItemsConDeficit.length === 1 ? "material con déficit" : "materiales con déficit"}
              </Badge>
            ) : (
              <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-semibold text-xs">
                Planta con stock suficiente (0 déficit)
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewExpanded((prev) => !prev)}
              className="h-8 px-2 text-blue-700 hover:bg-blue-100/60 text-xs gap-1"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{previewExpanded ? "Ocultar tabla" : "Ver tabla"}</span>
              {previewExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-600 leading-relaxed">
              {fromConteo
                ? "Las cantidades sugeridas se calcularon según el inventario físico de planta, el consumo planificado y los pedidos ya registrados para este día."
                : "A continuación se muestra el requerimiento calculado en base al inventario de planta y la producción."}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {previewItemsConDeficit.length > 0 ? (
                <Button
                  size="sm"
                  onClick={() => applySuggestionItems(previewItemsConDeficit.map((it) => it.material))}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1.5 text-xs shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Cargar {previewItemsConDeficit.length} {previewItemsConDeficit.length === 1 ? "sugerido" : "sugeridos"} al pedido</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applySuggestionItems(previewEvaluatedItems.map((it) => it.material))}
                  className="text-xs text-slate-700 border-slate-300 hover:bg-slate-50 gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  <span>Cargar todos para ajuste manual</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadSuggestion}
                disabled={loadingSuggestion || loadingPreview}
                className="text-blue-700 border-blue-200 hover:bg-blue-50 font-semibold gap-1.5 text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingSuggestion || loadingPreview ? "animate-spin" : ""}`} />
                <span>Recalcular</span>
              </Button>
            </div>
          </div>

          {previewExpanded && (
            <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white shadow-2xs">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 text-[11px]">
                    <TableHead className="py-2 px-3 font-semibold text-slate-700">Material</TableHead>
                    <TableHead className="py-2 px-3 text-right font-semibold text-slate-700">Stock Planta</TableHead>
                    <TableHead className="py-2 px-3 text-right font-semibold text-slate-700">Stock CL2</TableHead>
                    <TableHead className="py-2 px-3 text-right font-semibold text-slate-700">Consumo Previsto</TableHead>
                    <TableHead className="py-2 px-3 text-right font-semibold text-slate-700">Stock Objetivo</TableHead>
                    <TableHead className="py-2 px-3 text-right font-semibold text-slate-700">Ya Pedido</TableHead>
                    <TableHead className="py-2 px-3 text-right font-semibold text-slate-700">Sugerencia Neta</TableHead>
                    <TableHead className="py-2 px-3 text-center font-semibold text-slate-700">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs divide-y divide-slate-100">
                  {previewEvaluatedItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-4 text-slate-400">
                        {loadingPreview ? "Calculando sugerencias de pedidos..." : "No se hallaron materiales configurados para el cálculo."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    previewEvaluatedItems.map((it) => (
                      <TableRow
                        key={it.raw.id_material}
                        className={it.tieneDeficit ? "bg-blue-50/40 font-medium" : "hover:bg-slate-50/60"}
                      >
                        <TableCell className="py-2 px-3">
                          <div className="font-mono font-bold text-slate-800">{it.raw.id_material}</div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{it.raw.nombre}</div>
                        </TableCell>
                        <TableCell className={`py-2 px-3 text-right font-mono ${it.raw.stock_contado < 0 ? "text-rose-600 font-bold" : "text-slate-700"}`}>
                          {it.raw.stock_contado.toLocaleString()} {it.raw.unidad}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono text-slate-700">
                          <span className={it.raw.stock_cl2 && it.raw.stock_cl2 > 0 ? "font-bold text-slate-900" : "text-amber-600"}>
                            {(it.raw.stock_cl2 ?? 0).toLocaleString()} {it.raw.unidad}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono text-slate-600">
                          {it.raw.consumo_diario.toLocaleString()} {it.raw.unidad}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono text-slate-600">
                          {it.raw.stock_objetivo.toLocaleString()} {it.raw.unidad}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono text-slate-600">
                          {it.raw.cantidad_ya_pedida_total > 0 ? (
                            <span className="text-blue-700 font-semibold">
                              {it.raw.cantidad_ya_pedida_total.toLocaleString()} {it.raw.unidad}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono">
                          {it.tieneDeficit ? (
                            <span className="font-bold text-blue-700">
                              +{it.qtySugerida.toLocaleString()} {it.raw.unidad}
                              {it.palletsSugeridos !== undefined && (
                                <span className="text-[10px] text-blue-900 block font-normal">
                                  ({it.palletsSugeridos} {it.palletsSugeridos === 1 ? "pallet" : "pallets"})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400">0 {it.raw.unidad}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-center">
                          {it.tieneDeficit ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] font-bold">
                              Déficit
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                              Cubierto
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* Columna Izquierda: Formulario y Materiales (más ancha) */}
        <div className="xl:col-span-3 space-y-6">
          {/* Parámetros Operativos del Pedido */}
          <Card className="shadow-2xs">
            <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Building className="w-4 h-4 text-blue-600" />
                Parámetros de Entrega y Sector
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Sector solicitante (Automático y no editable si está asociado) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">
                      Sector Solicitante
                    </Label>
                    {isSectorLocked ? (
                      <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        <Lock className="w-2.5 h-2.5 text-slate-400" />
                        Bloqueado por perfil
                      </span>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-purple-700 border-purple-200 bg-purple-50">
                        Acceso Global
                      </Badge>
                    )}
                  </div>

                  {isSectorLocked ? (
                    <div className="h-9 px-3 bg-slate-100/80 border border-slate-300 rounded-md flex items-center justify-between text-slate-900 select-none">
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-bold">{currentUser?.sector}</span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        @{currentUser?.username}
                      </span>
                    </div>
                  ) : (
                    <Select value={sector} onValueChange={setSector}>
                      <SelectTrigger className="h-9 text-xs font-medium">
                        <SelectValue placeholder="Seleccione sector" />
                      </SelectTrigger>
                      <SelectContent>
                        {SECTORES_PLANTA.map((sec) => (
                          <SelectItem key={sec} value={sec} className="text-xs">
                            {sec}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-[11px] text-slate-400">
                    {isSectorLocked
                      ? "Asignado automáticamente según la configuración de tu cuenta."
                      : "Seleccione la línea o sector destino para este pedido."}
                  </p>
                </div>

                {/* Prioridad */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Prioridad</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPriority("normal")}
                      className={`h-9 rounded-md border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        priority === "normal"
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriority("urgente")}
                      className={`h-9 rounded-md border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        priority === "urgente"
                          ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-700"
                      }`}
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      Urgente
                    </button>
                  </div>
                </div>

                {/* Fecha Requerida */}
                <div className="space-y-1.5">
                  <Label htmlFor="fecha-req" className="text-xs font-semibold text-slate-700">
                    Fecha Requerida de Entrega
                  </Label>
                  <Input
                    id="fecha-req"
                    type="date"
                    min={todayStr}
                    value={fechaRequerida}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v && v < todayStr) {
                        toast.error("La fecha requerida no puede ser anterior a la fecha actual.");
                        return;
                      }
                      setFechaRequerida(v);
                    }}
                    className="h-9 font-mono text-xs"
                  />
                </div>

                {/* Turno Operativo */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Turno de Abastecimiento</Label>
                  <Select value={turno} onValueChange={setTurno}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Seleccione turno" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Turno Mañana" className="text-xs">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Sun className="w-3.5 h-3.5 text-amber-500" /> Turno Mañana
                        </span>
                      </SelectItem>
                      <SelectItem value="Turno Tarde" className="text-xs">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Moon className="w-3.5 h-3.5 text-indigo-500" /> Turno Tarde
                        </span>
                      </SelectItem>
                      <SelectItem value="Turno Noche" disabled className="text-xs text-slate-400 opacity-50 cursor-not-allowed">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Lock className="w-3 h-3 text-slate-400" /> Turno Noche (Bloqueado)
                        </span>
                      </SelectItem>
                      <SelectItem value="Completo" className="text-xs font-medium">
                        Jornada Completa
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Buscador y Tabla de Materiales */}
          <Card className="shadow-2xs">
            <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <CardTitle className="text-sm font-bold text-slate-800">
                  Materiales Solicitados
                </CardTitle>
                <Badge variant="secondary" className="text-xs px-2 py-0.5 ml-1">
                  {materials.length} {materials.length === 1 ? "ítem" : "ítems"}
                </Badge>
              </div>
              {materials.length > 0 && (
                <span className="text-xs font-semibold text-slate-500">
                  Total acumulado: <strong className="text-slate-900 font-mono">{totalQuantity.toLocaleString("es-AR")}</strong> uds/mts
                </span>
              )}
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Buscador de Catálogo */}
              <div className="relative">
                <div className="relative">
                  <Input
                    placeholder="Escriba código SAP o descripción para buscar material..."
                    value={searchValue}
                    onChange={(e) => {
                      setSearchValue(e.target.value);
                      setShowCatalog(true);
                    }}
                    onFocus={() => setShowCatalog(true)}
                    className="pr-10 text-xs h-9"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isSearchingCatalog ? (
                      <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {showCatalog && searchValue.trim().length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden divide-y divide-slate-100 max-h-64 overflow-y-auto">
                    {catalogFiltered.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-slate-400 text-center">
                        {isSearchingCatalog
                          ? "Buscando en catálogo..."
                          : "No se encontraron materiales que coincidan con la búsqueda."}
                      </div>
                    ) : (
                      catalogFiltered.map((item) => (
                        <button
                          key={item.id_material}
                          type="button"
                          onClick={() => handleAddFromCatalog(item)}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-blue-50/60 transition-colors group"
                        >
                          <div className="flex flex-col">
                            <span className="font-semibold text-xs text-slate-900 group-hover:text-blue-700">
                              {item.nombre || item.id_material}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {item.id_material}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.tipo_empaque === "rollo" && (item.tamanio_lote || 1) > 1 ? (
                              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200 font-semibold">
                                {item.bultos_por_pallet ? `${item.bultos_por_pallet} Rollos/Pal (${item.tamanio_lote} ${item.unidad})` : `Rollo (${item.tamanio_lote} ${item.unidad})`}
                              </Badge>
                            ) : item.tipo_empaque === "pallet" && (item.tamanio_lote || 1) > 1 ? (
                              <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold">
                                Pallet ({item.tamanio_lote} {item.unidad})
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-slate-50 font-mono text-slate-600">
                                {item.unidad || "UN"}
                              </Badge>
                            )}
                            <span className="text-xs font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                              <Plus className="w-3.5 h-3.5" /> Agregar
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Grilla de Materiales */}
              {materials.length === 0 ? (
                <div className="border-2 border-dashed border-slate-200 rounded-xl py-12 text-center space-y-2">
                  <div className="p-3 bg-slate-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-slate-400">
                    <Layers className="w-6 h-6" />
                  </div>
                  <p className="text-slate-600 font-medium text-xs">
                    No hay materiales en el pedido.
                  </p>
                  <p className="text-slate-400 text-[11px] max-w-sm mx-auto">
                    Utilice el buscador superior para agregar materiales o genere el pedido automáticamente desde la pantalla de Conteo de Planta.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <Table>
                    <TableHeader className="bg-slate-50/75">
                      <TableRow>
                        <TableHead className="text-xs font-semibold text-slate-700">Código</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-700">Material</TableHead>
                        <TableHead className="text-center w-28 text-xs font-semibold text-slate-700">Presentación</TableHead>
                        {fromConteo && (
                          <TableHead className="text-center w-32 text-xs font-semibold text-slate-700">
                            Sugerido
                          </TableHead>
                        )}
                        <TableHead className="text-center w-40 text-xs font-semibold text-slate-700">
                          {fromConteo ? "Cant. Final a Pedir" : "Cantidad a Pedir"}
                        </TableHead>
                        <TableHead className="w-20 text-xs font-semibold text-slate-700">Unidad</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-700">Observaciones</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materials.map((m) => (
                        <TableRow key={m.id} className="hover:bg-slate-50/50">
                          <TableCell className="font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">
                            {m.code}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-slate-900">
                            {m.name}
                          </TableCell>

                          <TableCell className="text-center">
                            {m.tipo_empaque === "rollo" && (m.tamanio_lote || 1) > 1 ? (
                              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200 font-semibold gap-1 whitespace-nowrap">
                                <Layers className="w-2.5 h-2.5 text-amber-600" />
                                {m.bultos_por_pallet ? `${m.bultos_por_pallet} Rollos / Pallet` : `Rollo (${m.tamanio_lote} ${m.unit})`}
                              </Badge>
                            ) : m.tipo_empaque === "pallet" && (m.tamanio_lote || 1) > 1 ? (
                              <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold gap-1 whitespace-nowrap">
                                <Layers className="w-2.5 h-2.5 text-indigo-500" />
                                Pallet ({m.tamanio_lote} {m.unit})
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 border-slate-200 whitespace-nowrap">
                                Unidad ({m.unit})
                              </Badge>
                            )}
                          </TableCell>

                          {fromConteo && (
                            <TableCell className="text-center whitespace-nowrap">
                              {(m.tipo_empaque === "pallet" || m.tipo_empaque === "rollo") && (m.tamanio_lote || 1) > 1 ? (
                                <div className="flex flex-col items-center justify-center">
                                  <span className="font-mono font-bold text-slate-800 text-xs">
                                    {m.suggestedPallets ?? Math.ceil((m.suggestedQuantity ?? m.quantity) / (m.tamanio_lote || 1))} {((m.suggestedPallets ?? Math.ceil((m.suggestedQuantity ?? m.quantity) / (m.tamanio_lote || 1))) === 1) ? "Pallet" : "Pallets"}
                                  </span>
                                  {m.tipo_empaque === "rollo" && m.bultos_por_pallet ? (
                                    <span className="text-[11px] text-amber-700 font-semibold block">
                                      ({(m.suggestedBultos ?? ((m.suggestedPallets ?? Math.ceil((m.suggestedQuantity ?? m.quantity) / (m.tamanio_lote || 1))) * m.bultos_por_pallet))} Rollos)
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-mono block">
                                      ({(m.suggestedQuantity ?? m.quantity).toLocaleString("es-AR")} {m.unit})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center justify-center">
                                  <span className="font-mono font-bold text-slate-800 text-xs">
                                    {(m.suggestedQuantity ?? m.quantity).toLocaleString("es-AR")}
                                  </span>
                                  <span className="text-[10px] text-slate-400 ml-1">{m.unit}</span>
                                </div>
                              )}
                            </TableCell>
                          )}

                          <TableCell>
                            {(m.tipo_empaque === "pallet" || m.tipo_empaque === "rollo") && (m.tamanio_lote || 1) > 1 ? (
                              <div className="flex flex-col items-center justify-center gap-0.5">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleStepQuantity(m.id, -1)}
                                    className="w-6 h-7 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors"
                                    title="Restar 1 pallet"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      min="1"
                                      value={m.pallets ?? Math.ceil(m.quantity / (m.tamanio_lote || 1))}
                                      onChange={(e) => {
                                        const p = Math.max(1, parseInt(e.target.value, 10) || 1);
                                        const lot = m.tamanio_lote || 1;
                                        const bCount = (m.tipo_empaque === "rollo" && m.bultos_por_pallet) ? p * m.bultos_por_pallet : undefined;
                                        setMaterials((prev) =>
                                          prev.map((item) =>
                                            item.id === m.id
                                              ? { ...item, pallets: p, bultos: bCount, quantity: p * lot }
                                              : item
                                          )
                                        );
                                      }}
                                      className="w-14 h-7 text-center font-mono font-bold text-xs p-1"
                                    />
                                    <span className="text-xs font-semibold text-indigo-700">pal</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleStepQuantity(m.id, 1)}
                                    className="w-6 h-7 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors"
                                    title="Sumar 1 pallet"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                                {m.tipo_empaque === "rollo" && m.bultos_por_pallet ? (
                                  <span className="text-[11px] text-amber-800 font-bold block">
                                    ={(m.pallets ?? Math.ceil(m.quantity / (m.tamanio_lote || 1))) * m.bultos_por_pallet} Rollos
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-500 font-mono block">
                                    ({m.quantity.toLocaleString("es-AR")} {m.unit})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStepQuantity(m.id, -1)}
                                  className="w-6 h-7 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors"
                                  title="Restar 1 unidad"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <Input
                                  type="number"
                                  min="1"
                                  value={m.quantity}
                                  onChange={(e) =>
                                    handleUpdateMaterial(
                                      m.id,
                                      "quantity",
                                      Math.max(1, parseFloat(e.target.value) || 1)
                                    )
                                  }
                                  className="w-20 h-7 text-center font-mono font-bold text-xs p-1"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleStepQuantity(m.id, 1)}
                                  className="w-6 h-7 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors"
                                  title="Sumar 1 unidad"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="text-xs text-slate-500 font-mono">
                            {m.unit}
                          </TableCell>

                          <TableCell>
                            <Input
                              placeholder="Detalle o nota interna..."
                              value={m.observations}
                              onChange={(e) =>
                                handleUpdateMaterial(m.id, "observations", e.target.value)
                              }
                              className="h-7 text-xs"
                            />
                          </TableCell>

                          <TableCell className="text-right pr-3">
                            <button
                              type="button"
                              onClick={() => handleRemoveMaterial(m.id)}
                              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                              title="Quitar material"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Columna Derecha: Tarjeta de Resumen */}
        <div className="space-y-4">
          <Card className="shadow-2xs">
            <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-sm font-bold text-slate-800">
                Resumen del Pedido
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              {/* Solicitante Real */}
              <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                  {currentUser?.nombre ? currentUser.nombre.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-slate-400 font-medium">Usuario Solicitante</p>
                  <p className="font-bold text-slate-900 truncate">
                    {currentUser ? `${currentUser.nombre} ${currentUser.apellido}` : "Nicolás"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {rolCfg && (
                      <Badge variant="outline" className={`text-[10px] py-0 px-1 font-semibold ${rolCfg.color}`}>
                        {rolCfg.label}
                      </Badge>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">
                      @{currentUser?.username || "solicitante"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Indicadores Clave */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-slate-500">Sector destino:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-slate-900">
                      {isSectorLocked ? currentUser?.sector : sector}
                    </span>
                    {isSectorLocked && <Lock className="w-3 h-3 text-slate-400" />}
                  </div>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-slate-500">Fecha de entrega:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatSoloFechaAR(fechaRequerida)}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-slate-500">Turno:</span>
                  <Badge variant="outline" className="text-[10px] font-semibold bg-slate-50">
                    {turno === "Completo" ? "Jornada Completa" : turno}
                  </Badge>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-slate-500">Prioridad:</span>
                  <Badge
                    variant={priority === "urgente" ? "destructive" : "outline"}
                    className="text-[10px] font-semibold"
                  >
                    {priority === "urgente" ? "Urgente" : "Normal"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-slate-500">Total materiales:</span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {materials.length}
                  </Badge>
                </div>

                {totalPallets > 0 && (
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-slate-500">Total pallets:</span>
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold font-mono text-xs gap-1">
                      <Layers className="w-3 h-3 text-indigo-600" />
                      {totalPallets} {totalPallets === 1 ? "Pallet" : "Pallets"}
                    </Badge>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-700 font-semibold">Total unidades/mts:</span>
                  <span className="font-mono font-bold text-sm text-blue-700">
                    {totalQuantity.toLocaleString("es-AR")}
                  </span>
                </div>
              </div>

              {/* Botón de Envío */}
              <div className="pt-3">
                <Button
                  disabled={isSubmitting || materials.length === 0}
                  onClick={handleSubmit}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 gap-2 shadow-sm text-xs"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Registrando pedido...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar y Enviar Pedido</span>
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-50/70 border-slate-200">
            <CardContent className="p-4 text-[11px] text-slate-500 space-y-1">
              <p className="font-semibold text-slate-700">Trazabilidad operativa:</p>
              <p>
                Al confirmar, el pedido ingresa con estado <strong>Pendiente</strong> en la cola del depósito CL2 para preparación de materiales y emisión de remito.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
