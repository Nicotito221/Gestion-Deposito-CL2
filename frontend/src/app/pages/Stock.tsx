import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
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
  DialogDescription,
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
  Search,
  RefreshCw,
  Plus,
  ArrowUpCircle,
  ArrowDownCircle,
  Minus,
  CheckCircle2,
  Boxes,
  History,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Package,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import {
  getStockDeposito,
  updateStockDeposito,
  getStockMovimientos,
  getRundownSecciones,
  type StockMaterialItem,
  type StockListResponse,
  type StockMovimientoItem,
  type StockMovimientosResponse,
  type RundownSeccionItem,
} from "../services/api";

export function Stock() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("stock");

  const [loadingStock, setLoadingStock] = useState<boolean>(true);
  const [stockData, setStockData] = useState<StockListResponse>({
    items: [],
    total: 0,
    page: 1,
    page_size: 50,
    total_pages: 1,
  });
  const [searchStockInput, setSearchStockInput] = useState<string>("");
  const [activeSearchStock, setActiveSearchStock] = useState<string>("");
  const [selectedProvId, setSelectedProvId] = useState<string>("all");
  const [soloConStock, setSoloConStock] = useState<boolean>(false);
  const [pageStock, setPageStock] = useState<number>(1);
  const [pageSizeStock, setPageSizeStock] = useState<number>(50);

  const [loadingMovs, setLoadingMovs] = useState<boolean>(false);
  const [movsData, setMovsData] = useState<StockMovimientosResponse>({
    items: [],
    total: 0,
    page: 1,
    page_size: 50,
    total_pages: 1,
  });
  const [searchMovInput, setSearchMovInput] = useState<string>("");
  const [activeSearchMov, setActiveSearchMov] = useState<string>("");
  const [tipoMovFilter, setTipoMovFilter] = useState<string>("all");
  const [pageMov, setPageMov] = useState<number>(1);
  const [pageSizeMov, setPageSizeMov] = useState<number>(50);

  const [secciones, setSecciones] = useState<RundownSeccionItem[]>([]);

  const [adjustOpen, setAdjustOpen] = useState<boolean>(false);
  const [isSavingAdjust, setIsSavingAdjust] = useState<boolean>(false);
  const [selectedMaterial, setSelectedMaterial] = useState<StockMaterialItem | null>(null);
  const [adjustForm, setAdjustForm] = useState<{
    nuevo_stock_planta: string;
    nuevo_stock_cl2: string;
    observacion: string;
  }>({
    nuevo_stock_planta: "",
    nuevo_stock_cl2: "",
    observacion: "",
  });

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

  const fetchSeccionesList = useCallback(async () => {
    try {
      const data = await getRundownSecciones();
      setSecciones(data);
    } catch {
      toast.error("Error al cargar proveedores");
    }
  }, []);

  const fetchStock = useCallback(async () => {
    setLoadingStock(true);
    try {
      const provIdNum = selectedProvId !== "all" ? parseInt(selectedProvId, 10) : undefined;
      const res = await getStockDeposito({
        search: activeSearchStock.trim() || undefined,
        id_proveedor: provIdNum,
        solo_con_stock: soloConStock,
        page: pageStock,
        page_size: pageSizeStock,
      });
      setStockData(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar stock");
    } finally {
      setLoadingStock(false);
    }
  }, [activeSearchStock, selectedProvId, soloConStock, pageStock, pageSizeStock]);

  const fetchMovimientos = useCallback(async () => {
    setLoadingMovs(true);
    try {
      const res = await getStockMovimientos({
        search: activeSearchMov.trim() || undefined,
        tipo: tipoMovFilter !== "all" ? tipoMovFilter : undefined,
        page: pageMov,
        page_size: pageSizeMov,
      });
      setMovsData(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar movimientos");
    } finally {
      setLoadingMovs(false);
    }
  }, [activeSearchMov, tipoMovFilter, pageMov, pageSizeMov]);

  useEffect(() => {
    fetchSeccionesList();
  }, [fetchSeccionesList]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  useEffect(() => {
    if (activeTab === "movimientos") {
      fetchMovimientos();
    }
  }, [activeTab, fetchMovimientos]);

  const handleSearchStockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPageStock(1);
    setActiveSearchStock(searchStockInput);
  };

  const handleSearchMovSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPageMov(1);
    setActiveSearchMov(searchMovInput);
  };

  const handleOpenAdjust = (mat: StockMaterialItem) => {
    setSelectedMaterial(mat);
    setAdjustForm({
      nuevo_stock_planta: String(mat.stock_planta),
      nuevo_stock_cl2: String(mat.stock_cl2),
      observacion: "",
    });
    setAdjustOpen(true);
  };

  const handleSaveAdjust = async () => {
    if (!selectedMaterial) return;
    const valPlanta = parseFloat(adjustForm.nuevo_stock_planta);
    const valCl2 = selectedMaterial.deposito_en_planta ? 0 : parseFloat(adjustForm.nuevo_stock_cl2);

    if (isNaN(valPlanta) || valPlanta < 0) {
      toast.error("Ingrese una cantidad válida para Stock en Planta (>= 0)");
      return;
    }
    if (!selectedMaterial.deposito_en_planta && (isNaN(valCl2) || valCl2 < 0)) {
      toast.error("Ingrese una cantidad válida para Stock en CL2 (>= 0)");
      return;
    }

    setIsSavingAdjust(true);
    try {
      await updateStockDeposito(selectedMaterial.id_material, {
        nuevo_stock_planta: valPlanta,
        nuevo_stock_cl2: selectedMaterial.deposito_en_planta ? 0 : valCl2,
        observacion: adjustForm.observacion.trim() || undefined,
      });
      const tot = valPlanta + (selectedMaterial.deposito_en_planta ? 0 : valCl2);
      toast.success(`Stock de ${selectedMaterial.id_material} actualizado (Total: ${tot.toLocaleString("es-AR")})`);
      setAdjustOpen(false);
      await fetchStock();
      if (activeTab === "movimientos") {
        await fetchMovimientos();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar stock");
    } finally {
      setIsSavingAdjust(false);
    }
  };

  const formatFechaMov = (fechaStr: string) => {
    try {
      const dt = new Date(fechaStr);
      return dt.toLocaleString("es-AR", {
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

  const getTipoMovBadge = (tipo: string) => {
    switch (tipo) {
      case "ingreso":
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] gap-1">
            <ArrowUpCircle className="w-3 h-3 text-emerald-600" />
            Ingreso
          </Badge>
        );
      case "egreso":
        return (
          <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] gap-1">
            <ArrowDownCircle className="w-3 h-3 text-red-600" />
            Egreso
          </Badge>
        );
      case "ajuste_manual":
      case "ajuste":
      default:
        return (
          <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] gap-1">
            <Minus className="w-3 h-3 text-blue-600" />
            Ajuste
          </Badge>
        );
    }
  };

  const startStockRecord = stockData.total > 0 ? (stockData.page - 1) * stockData.page_size + 1 : 0;
  const endStockRecord = Math.min(stockData.page * stockData.page_size, stockData.total);

  const startMovRecord = movsData.total > 0 ? (movsData.page - 1) * movsData.page_size + 1 : 0;
  const endMovRecord = Math.min(movsData.page * movsData.page_size, movsData.total);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Control Stock TBAR</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Control integral de existencias en planta TBAR, movimientos y sincronización con el Rundown
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchStock();
              if (activeTab === "movimientos") fetchMovimientos();
            }}
            disabled={loadingStock || loadingMovs}
            className="text-xs h-9 gap-1.5 border-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStock || loadingMovs ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/configuracion-materiales")}
            className="text-xs h-9 gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Configuración de Materiales</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-xs border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 rounded-lg text-slate-600">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Materiales en Catálogo</p>
              <p className="text-xl font-bold text-slate-900">{stockData.total.toLocaleString("es-AR")}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-lg text-emerald-700">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Con Stock en Depósito</p>
              <p className="text-xl font-bold text-emerald-700">
                {stockData.items.filter((it) => it.stock_actual > 0).length}{" "}
                <span className="text-xs font-normal text-slate-500">(en página activa)</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-lg text-blue-700">
              <History className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Movimientos Auditados</p>
              <p className="text-xl font-bold text-blue-700">{movsData.total.toLocaleString("es-AR")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-100 p-1 border border-slate-200">
          <TabsTrigger value="stock" className="text-xs gap-1.5">
            <Boxes className="w-3.5 h-3.5" />
            <span>Inventario de Materiales</span>
          </TabsTrigger>
          <TabsTrigger value="movimientos" className="text-xs gap-1.5">
            <History className="w-3.5 h-3.5" />
            <span>Historial de Movimientos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4">
          <Card className="shadow-xs border-slate-200">
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <form onSubmit={handleSearchStockSubmit} className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por código SAP o descripción..."
                    className="pl-9 h-9 text-xs"
                    value={searchStockInput}
                    onChange={(e) => setSearchStockInput(e.target.value)}
                  />
                </form>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="w-48">
                    <Select
                      value={selectedProvId}
                      onValueChange={(val) => {
                        setSelectedProvId(val);
                        setPageStock(1);
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
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

                  <div className="flex items-center gap-2 px-3 py-1.5 border rounded-lg bg-slate-50/50">
                    <input
                      type="checkbox"
                      id="stock-filter-solo-stock"
                      checked={soloConStock}
                      onChange={(e) => {
                        setSoloConStock(e.target.checked);
                        setPageStock(1);
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                    />
                    <Label htmlFor="stock-filter-solo-stock" className="text-xs text-slate-700 cursor-pointer font-medium select-none">
                      Solo con stock (&gt; 0)
                    </Label>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span>Filas:</span>
                    <Select
                      value={String(pageSizeStock)}
                      onValueChange={(val) => {
                        setPageSizeStock(parseInt(val, 10));
                        setPageStock(1);
                      }}
                    >
                      <SelectTrigger className="h-9 w-18 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden border-slate-200">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-32 text-xs font-semibold text-slate-700">Código SAP</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-700">Descripción</TableHead>
                      <TableHead className="w-36 text-xs font-semibold text-slate-700">Proveedor</TableHead>
                      <TableHead className="w-28 text-xs font-semibold text-blue-700 text-right">Stock Planta</TableHead>
                      <TableHead className="w-28 text-xs font-semibold text-amber-700 text-right">Stock CL2</TableHead>
                      <TableHead className="w-28 text-xs font-semibold text-slate-900 text-right">Stock Total</TableHead>
                      <TableHead className="w-20 text-xs font-semibold text-slate-700 text-center">Unidad</TableHead>
                      <TableHead className="w-28 text-xs font-semibold text-slate-700 text-center">Empaque / Lote</TableHead>
                      <TableHead className="w-36 text-xs font-semibold text-slate-700 text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100">
                    {loadingStock ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                          <div className="flex items-center justify-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                            <span>Cargando inventario...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : stockData.items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                          No se encontraron materiales con los filtros aplicados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      stockData.items.map((mat) => {
                        const isPlantaOnly = mat.deposito_en_planta;
                        return (
                          <TableRow key={mat.id_material} className="hover:bg-slate-50/80 transition-colors">
                            <TableCell className="font-mono text-xs font-bold text-slate-800">
                              {mat.id_material}
                            </TableCell>
                            <TableCell className="text-xs font-medium text-slate-700">
                              {mat.nombre}
                              {mat.categoria && (
                                <span className="ml-2 text-[10px] text-slate-400 font-normal">({mat.categoria})</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">
                              {mat.nombre_proveedor ? (
                                <span className="font-medium text-slate-800">{mat.nombre_proveedor}</span>
                              ) : (
                                <span className="text-slate-400 italic">Sin asignar</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {mat.stock_planta > 0 ? (
                                <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  {mat.stock_planta.toLocaleString("es-AR")}
                                </span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {isPlantaOnly ? (
                                <span className="text-slate-400 italic" title="Depósito exclusivo en planta">—</span>
                              ) : mat.stock_cl2 > 0 ? (
                                <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  {mat.stock_cl2.toLocaleString("es-AR")}
                                </span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {mat.stock_total > 0 ? (
                                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  {mat.stock_total.toLocaleString("es-AR")}
                                </span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center text-xs font-mono text-slate-500">
                              {mat.unidad}
                            </TableCell>
                            <TableCell className="text-center">
                              {mat.tipo_empaque === "rollo" ? (
                                <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 font-mono text-[10px]">
                                  {mat.unidad_por_bulto && mat.bultos_por_pallet
                                    ? `${mat.unidad_por_bulto} × ${mat.bultos_por_pallet} rol`
                                    : "Rollo"}
                                </Badge>
                              ) : mat.tipo_empaque === "pallet" ? (
                                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-mono text-[10px] font-semibold">
                                  {mat.lote_mts ? `${mat.lote_mts.toLocaleString("es-AR")} u/pal` : "Pallet"}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">
                                  Unidades
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenAdjust(mat)}
                                title="Ajustar stock (sincronizado con Rundown)"
                                className="h-7 px-2.5 text-[11px] border-slate-300 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-1 mx-auto"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Ajustar</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-500">
                <div>
                  Mostrando <span className="font-semibold text-slate-700">{startStockRecord}</span> a{" "}
                  <span className="font-semibold text-slate-700">{endStockRecord}</span> de{" "}
                  <span className="font-semibold text-slate-700">{stockData.total.toLocaleString("es-AR")}</span> materiales
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageStock((p) => Math.max(1, p - 1))}
                    disabled={pageStock <= 1 || loadingStock}
                    className="h-8 px-2.5 text-xs border-slate-300"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Anterior
                  </Button>
                  <span className="font-mono text-slate-700 px-2">
                    Página {stockData.page} de {stockData.total_pages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageStock((p) => Math.min(stockData.total_pages, p + 1))}
                    disabled={pageStock >= stockData.total_pages || loadingStock}
                    className="h-8 px-2.5 text-xs border-slate-300"
                  >
                    Siguiente
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movimientos" className="space-y-4">
          <Card className="shadow-xs border-slate-200">
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <form onSubmit={handleSearchMovSubmit} className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por código, descripción u observación..."
                    className="pl-9 h-9 text-xs"
                    value={searchMovInput}
                    onChange={(e) => setSearchMovInput(e.target.value)}
                  />
                </form>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="w-44">
                    <Select
                      value={tipoMovFilter}
                      onValueChange={(val) => {
                        setTipoMovFilter(val);
                        setPageMov(1);
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Tipo de movimiento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los tipos</SelectItem>
                        <SelectItem value="ajuste_manual">Ajuste manual</SelectItem>
                        <SelectItem value="ingreso">Ingreso</SelectItem>
                        <SelectItem value="egreso">Egreso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span>Filas:</span>
                    <Select
                      value={String(pageSizeMov)}
                      onValueChange={(val) => {
                        setPageSizeMov(parseInt(val, 10));
                        setPageMov(1);
                      }}
                    >
                      <SelectTrigger className="h-9 w-18 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden border-slate-200">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-36 text-xs font-semibold text-slate-700">Fecha y Hora</TableHead>
                      <TableHead className="w-28 text-xs font-semibold text-slate-700">Tipo</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-700">Material</TableHead>
                      <TableHead className="w-28 text-xs font-semibold text-slate-700 text-right">Cantidad</TableHead>
                      <TableHead className="w-36 text-xs font-semibold text-slate-700 text-center">Saldo (Ant $\rightarrow$ Post)</TableHead>
                      <TableHead className="w-36 text-xs font-semibold text-slate-700">Usuario</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-700">Motivo / Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100">
                    {loadingMovs ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                          <div className="flex items-center justify-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                            <span>Cargando movimientos...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : movsData.items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                          No se registraron movimientos con los filtros aplicados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      movsData.items.map((mov) => (
                        <TableRow key={mov.id_movimiento} className="hover:bg-slate-50/80 transition-colors">
                          <TableCell className="text-xs font-mono text-slate-600">
                            {formatFechaMov(mov.fecha)}
                          </TableCell>
                          <TableCell>{getTipoMovBadge(mov.tipo)}</TableCell>
                          <TableCell className="text-xs">
                            <span className="font-mono font-bold text-slate-800">{mov.id_material}</span>
                            {mov.nombre_material && (
                              <span className="block text-[11px] text-slate-500 truncate max-w-xs">{mov.nombre_material}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold text-slate-800">
                            {mov.cantidad.toLocaleString("es-AR")} {mov.unidad}
                          </TableCell>
                          <TableCell className="text-center font-mono text-[11px] text-slate-600">
                            <span>{mov.stock_anterior.toLocaleString("es-AR")}</span>
                            <span className="mx-1 text-slate-400">→</span>
                            <span className="font-bold text-slate-900">{mov.stock_posterior.toLocaleString("es-AR")}</span>
                          </TableCell>
                          <TableCell className="text-xs text-slate-700 font-medium">
                            {mov.nombre_usuario || "Sistema"}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {mov.observacion || "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-500">
                <div>
                  Mostrando <span className="font-semibold text-slate-700">{startMovRecord}</span> a{" "}
                  <span className="font-semibold text-slate-700">{endMovRecord}</span> de{" "}
                  <span className="font-semibold text-slate-700">{movsData.total.toLocaleString("es-AR")}</span> movimientos
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageMov((p) => Math.max(1, p - 1))}
                    disabled={pageMov <= 1 || loadingMovs}
                    className="h-8 px-2.5 text-xs border-slate-300"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Anterior
                  </Button>
                  <span className="font-mono text-slate-700 px-2">
                    Página {movsData.page} de {movsData.total_pages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageMov((p) => Math.min(movsData.total_pages, p + 1))}
                    disabled={pageMov >= movsData.total_pages || loadingMovs}
                    className="h-8 px-2.5 text-xs border-slate-300"
                  >
                    Siguiente
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Boxes className="w-4 h-4 text-blue-600" />
              Ajustar Stock de Material
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Ingrese los nuevos valores de stock físico para Planta y Depósito CL2.
            </DialogDescription>
          </DialogHeader>

          {selectedMaterial && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Código SAP:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedMaterial.id_material}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Descripción:</span>
                  <span className="font-medium text-slate-800 text-right max-w-[240px] truncate">
                    {selectedMaterial.nombre}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Proveedor:</span>
                  <span className="font-semibold text-blue-700">{selectedMaterial.nombre_proveedor || "N/A"}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Stock Actual Planta:</span>
                  <span className="font-mono font-semibold text-blue-700">
                    {selectedMaterial.stock_planta.toLocaleString("es-AR")} {selectedMaterial.unidad}
                  </span>
                </div>
                {!selectedMaterial.deposito_en_planta && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Stock Actual CL2:</span>
                    <span className="font-mono font-semibold text-amber-700">
                      {selectedMaterial.stock_cl2.toLocaleString("es-AR")} {selectedMaterial.unidad}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-700 font-medium">Stock Total Actual:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {selectedMaterial.stock_total.toLocaleString("es-AR")} {selectedMaterial.unidad}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="stock-planta-val" className="text-xs font-semibold text-slate-700 flex justify-between">
                    <span>Nuevo Stock en Planta ({selectedMaterial.unidad})</span>
                    <span className="text-[10px] text-blue-600 font-normal">Sincroniza con Rundown Planta</span>
                  </Label>
                  <Input
                    id="stock-planta-val"
                    type="number"
                    min="0"
                    step="any"
                    value={adjustForm.nuevo_stock_planta}
                    onChange={(e) => setAdjustForm({ ...adjustForm, nuevo_stock_planta: e.target.value })}
                    placeholder="0"
                    className="font-mono text-sm h-9"
                    autoFocus
                  />
                </div>

                {!selectedMaterial.deposito_en_planta ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="stock-cl2-val" className="text-xs font-semibold text-slate-700 flex justify-between">
                      <span>Nuevo Stock en CL2 ({selectedMaterial.unidad})</span>
                      <span className="text-[10px] text-amber-600 font-normal">Depósito CL2</span>
                    </Label>
                    <Input
                      id="stock-cl2-val"
                      type="number"
                      min="0"
                      step="any"
                      value={adjustForm.nuevo_stock_cl2}
                      onChange={(e) => setAdjustForm({ ...adjustForm, nuevo_stock_cl2: e.target.value })}
                      placeholder="0"
                      className="font-mono text-sm h-9"
                    />
                  </div>
                ) : (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800">
                    Proveedor configurado con depósito exclusivo en planta. Stock en CL2 = 0.
                  </div>
                )}

                <div className="p-2.5 bg-slate-100/70 rounded-md border border-slate-200 flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700">Total Consolidado Resultante:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {(
                      (parseFloat(adjustForm.nuevo_stock_planta) || 0) +
                      (selectedMaterial.deposito_en_planta ? 0 : (parseFloat(adjustForm.nuevo_stock_cl2) || 0))
                    ).toLocaleString("es-AR")}{" "}
                    {selectedMaterial.unidad}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stock-obs-val" className="text-xs font-semibold text-slate-700">
                  Motivo / Observación
                </Label>
                <Input
                  id="stock-obs-val"
                  value={adjustForm.observacion}
                  onChange={(e) => setAdjustForm({ ...adjustForm, observacion: e.target.value })}
                  placeholder="Ej: Conteo físico, Corrección de saldo, Carga inicial..."
                  className="text-xs h-9"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setAdjustOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAdjust}
              disabled={
                isSavingAdjust ||
                adjustForm.nuevo_stock_planta.trim() === "" ||
                (!selectedMaterial?.deposito_en_planta && adjustForm.nuevo_stock_cl2.trim() === "")
              }
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {isSavingAdjust ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirmar Ajuste</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
