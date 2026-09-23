import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  RefreshCw,
  Warehouse,
  Package,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Boxes,
  Edit3,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import {
  getStockDeposito,
  updateStockDeposito,
  getRundownSecciones,
  type StockMaterialItem,
  type StockListResponse,
  type RundownSeccionItem,
} from "../services/api";
import { useAuth } from "../context/AuthContext";

export function Materials() {
  const navigate = useNavigate();
  const { canModifyStockCL2 } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [stockData, setStockData] = useState<StockListResponse>({
    items: [],
    total: 0,
    page: 1,
    page_size: 50,
    total_pages: 1,
  });

  const [secciones, setSecciones] = useState<RundownSeccionItem[]>([]);
  const [searchInput, setSearchInput] = useState<string>("");
  const [activeSearch, setActiveSearch] = useState<string>("");
  const [selectedProvId, setSelectedProvId] = useState<string>("all");
  const [soloConStock, setSoloConStock] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const [ajusteModalOpen, setAjusteModalOpen] = useState<boolean>(false);
  const [isSavingAjuste, setIsSavingAjuste] = useState<boolean>(false);
  const [selectedMaterial, setSelectedMaterial] = useState<StockMaterialItem | null>(null);
  const [ajusteForm, setAjusteForm] = useState<{
    nuevo_stock: string;
    observacion: string;
  }>({
    nuevo_stock: "",
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
      toast.error("Error al cargar lista de proveedores");
    }
  }, []);

  const fetchStock = useCallback(async () => {
    setLoading(true);
    try {
      const provIdNum = selectedProvId !== "all" ? parseInt(selectedProvId, 10) : undefined;
      const res = await getStockDeposito({
        search: activeSearch.trim() || undefined,
        id_proveedor: provIdNum,
        solo_con_stock: soloConStock,
        tipo_almacen: "cl2",
        page,
        page_size: pageSize,
      });
      setStockData(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar stock en CL2");
    } finally {
      setLoading(false);
    }
  }, [activeSearch, selectedProvId, soloConStock, page, pageSize]);

  useEffect(() => {
    fetchSeccionesList();
  }, [fetchSeccionesList]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(searchInput);
  };

  const handleOpenAjuste = (material: StockMaterialItem) => {
    if (material.deposito_en_planta) {
      toast.warning("Este proveedor opera exclusivamente con stock en planta. En CL2 el stock es siempre 0.");
      return;
    }
    setSelectedMaterial(material);
    setAjusteForm({
      nuevo_stock: String(material.stock_cl2 ?? material.stock_actual),
      observacion: "",
    });
    setAjusteModalOpen(true);
  };

  const handleSaveAjuste = async () => {
    if (!selectedMaterial) return;
    const val = parseFloat(ajusteForm.nuevo_stock);
    if (isNaN(val) || val < 0) {
      toast.error("Ingrese una cantidad válida mayor o igual a 0");
      return;
    }

    setIsSavingAjuste(true);
    try {
      await updateStockDeposito(selectedMaterial.id_material, {
        nuevo_stock_cl2: val,
        observacion: ajusteForm.observacion.trim() || undefined,
      });
      toast.success(`Stock en CL2 de ${selectedMaterial.id_material} actualizado a ${val.toLocaleString("es-AR")}`);
      setAjusteModalOpen(false);
      await fetchStock();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar stock");
    } finally {
      setIsSavingAjuste(false);
    }
  };

  const startRecord = stockData.total > 0 ? (stockData.page - 1) * stockData.page_size + 1 : 0;
  const endRecord = Math.min(stockData.page * stockData.page_size, stockData.total);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <Warehouse className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Control Stock CL2</h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Inventario físico y gestión de existencias en el depósito externo CL2
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStock}
            disabled={loading}
            className="text-xs h-9 gap-1.5 border-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      </div>

      <Card className="shadow-xs border-slate-200">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por código SAP o descripción..."
                className="pl-9 h-9 text-xs"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </form>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="w-48">
                <Select
                  value={selectedProvId}
                  onValueChange={(val) => {
                    setSelectedProvId(val);
                    setPage(1);
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
                  id="filter-solo-stock"
                  checked={soloConStock}
                  onChange={(e) => {
                    setSoloConStock(e.target.checked);
                    setPage(1);
                  }}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                />
                <Label htmlFor="filter-solo-stock" className="text-xs text-slate-700 cursor-pointer font-medium select-none">
                  Solo con stock (&gt; 0)
                </Label>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>Filas:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(parseInt(val, 10));
                    setPage(1);
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
                  <TableHead className="text-xs font-semibold text-slate-700">Descripción del Material</TableHead>
                  <TableHead className="w-36 text-xs font-semibold text-slate-700">Proveedor</TableHead>
                  <TableHead className="w-40 text-xs font-semibold text-slate-700 text-center">Tipo Depósito</TableHead>
                  <TableHead className="w-28 text-xs font-semibold text-slate-700 text-right">Stock en CL2</TableHead>
                  <TableHead className="w-20 text-xs font-semibold text-slate-700 text-center">Unidad</TableHead>
                  <TableHead className="w-28 text-xs font-semibold text-slate-700 text-center">Empaque / Lote</TableHead>
                  <TableHead className="w-36 text-xs font-semibold text-slate-700 text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Cargando inventario de CL2...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : stockData.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">
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
                        <TableCell className="text-center">
                          {isPlantaOnly ? (
                            <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-medium hover:bg-blue-100">
                              En Planta (Stock 0)
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-600 border-slate-300 text-[10px]">
                              Depósito CL2
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {isPlantaOnly ? (
                            <span className="text-slate-400">0</span>
                          ) : mat.stock_actual > 0 ? (
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              {mat.stock_actual.toLocaleString("es-AR")}
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
                          {canModifyStockCL2 ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isPlantaOnly}
                              onClick={() => handleOpenAjuste(mat)}
                              title={
                                isPlantaOnly
                                  ? "Proveedor con depósito en planta: stock en CL2 no aplicable"
                                  : "Ajustar o cargar stock en depósito CL2"
                              }
                              className="h-7 px-2.5 text-[11px] border-slate-300 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-1 mx-auto"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Ajustar</span>
                            </Button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Solo lectura</span>
                          )}
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
              Mostrando <span className="font-semibold text-slate-700">{startRecord}</span> a{" "}
              <span className="font-semibold text-slate-700">{endRecord}</span> de{" "}
              <span className="font-semibold text-slate-700">{stockData.total.toLocaleString("es-AR")}</span> materiales
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
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
                onClick={() => setPage((p) => Math.min(stockData.total_pages, p + 1))}
                disabled={page >= stockData.total_pages || loading}
                className="h-8 px-2.5 text-xs border-slate-300"
              >
                Siguiente
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={ajusteModalOpen} onOpenChange={setAjusteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Warehouse className="w-4 h-4 text-blue-600" />
              Ajuste de Stock en Depósito CL2
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Modifique la cantidad disponible de este material en el depósito central.
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
                  <span className="text-slate-500">Stock Actual en CL2:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedMaterial.stock_actual.toLocaleString("es-AR")} {selectedMaterial.unidad}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nuevo-stock-cl2" className="text-xs font-semibold text-slate-700">
                  Nuevo Stock en CL2 ({selectedMaterial.unidad})
                </Label>
                <Input
                  id="nuevo-stock-cl2"
                  type="number"
                  min="0"
                  step="any"
                  value={ajusteForm.nuevo_stock}
                  onChange={(e) => setAjusteForm({ ...ajusteForm, nuevo_stock: e.target.value })}
                  placeholder="0"
                  className="font-mono text-sm h-9"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="obs-stock-cl2" className="text-xs font-semibold text-slate-700">
                  Motivo / Observación
                </Label>
                <Input
                  id="obs-stock-cl2"
                  value={ajusteForm.observacion}
                  onChange={(e) => setAjusteForm({ ...ajusteForm, observacion: e.target.value })}
                  placeholder="Ej: Reconteo físico, Carga inicial, Corrección de lote..."
                  className="text-xs h-9"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setAjusteModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAjuste}
              disabled={isSavingAjuste || !ajusteForm.nuevo_stock}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {isSavingAjuste ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirmar Stock</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
