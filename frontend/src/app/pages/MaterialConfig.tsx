import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Switch } from "../components/ui/switch";
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
  SlidersHorizontal,
  Package,
  Layers,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Boxes,
  ScrollText,
  Building2,
  Calendar,
  Scale,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import {
  getMaterialesConfiguracion,
  updateMaterialConfiguracion,
  getRundownSecciones,
  type MaterialConfigItem,
  type MaterialConfigListResponse,
  type RundownSeccionItem,
} from "../services/api";

export function MaterialConfig() {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<MaterialConfigListResponse>({
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
  const [selectedEmpaque, setSelectedEmpaque] = useState<string>("all");
  const [selectedEnCl2, setSelectedEnCl2] = useState<string>("all");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialConfigItem | null>(null);

  const [formState, setFormState] = useState<{
    id_proveedor: string;
    deposito_en_planta: boolean;
    tipo_empaque: "pallet" | "rollo" | "unidad";
    piezas_por_pallet: string;
    unidad_por_bulto: string;
    bultos_por_pallet: string;
    doh_sugerido_planta: string;
    unidad: string;
    en_cl2: boolean;
  }>({
    id_proveedor: "",
    deposito_en_planta: false,
    tipo_empaque: "pallet",
    piezas_por_pallet: "1",
    unidad_por_bulto: "1",
    bultos_por_pallet: "1",
    doh_sugerido_planta: "1.0",
    unidad: "UN",
    en_cl2: true,
  });

  const proveedoresList = useMemo(() => {
    const list: { id_proveedor: number; nombre: string; deposito_en_planta?: boolean }[] = [];
    secciones.forEach((sec) => {
      sec.proveedores.forEach((p) => {
        if (!list.some((it) => it.id_proveedor === p.id_proveedor)) {
          list.push({
            id_proveedor: p.id_proveedor,
            nombre: p.nombre,
            deposito_en_planta: p.deposito_en_planta,
          });
        }
      });
    });
    return list.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [secciones]);

  const fetchProveedores = useCallback(async () => {
    try {
      const secs = await getRundownSecciones();
      setSecciones(secs);
    } catch {
      toast.error("Error al cargar listado de proveedores");
    }
  }, []);

  const fetchConfigList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMaterialesConfiguracion({
        search: activeSearch || undefined,
        id_proveedor: selectedProvId !== "all" ? parseInt(selectedProvId, 10) : undefined,
        tipo_empaque: selectedEmpaque !== "all" ? selectedEmpaque : undefined,
        en_cl2: selectedEnCl2 === "all" ? undefined : selectedEnCl2 === "true",
        page,
        page_size: pageSize,
      });
      setData(res);
    } catch {
      toast.error("Error al cargar configuración de materiales");
    } finally {
      setLoading(false);
    }
  }, [activeSearch, selectedProvId, selectedEmpaque, selectedEnCl2, page, pageSize]);

  useEffect(() => {
    fetchProveedores();
  }, [fetchProveedores]);

  useEffect(() => {
    fetchConfigList();
  }, [fetchConfigList]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchInput.trim());
    setPage(1);
  };

  const handleOpenEdit = (mat: MaterialConfigItem) => {
    setSelectedMaterial(mat);
    setFormState({
      id_proveedor: mat.id_proveedor ? String(mat.id_proveedor) : "none",
      deposito_en_planta: mat.deposito_en_planta,
      tipo_empaque: mat.tipo_empaque || "pallet",
      piezas_por_pallet: mat.lote_mts && mat.lote_mts > 0 ? String(mat.lote_mts) : "1",
      unidad_por_bulto: mat.unidad_por_bulto && mat.unidad_por_bulto > 0 ? String(mat.unidad_por_bulto) : "50",
      bultos_por_pallet: mat.bultos_por_pallet && mat.bultos_por_pallet > 0 ? String(mat.bultos_por_pallet) : "6",
      doh_sugerido_planta: String(mat.doh_sugerido_planta || 1.0),
      unidad: mat.unidad || "UN",
      en_cl2: mat.en_cl2 ?? true,
    });
    setEditModalOpen(true);
  };

  const handleSaveConfig = async () => {
    if (!selectedMaterial) return;

    const dohVal = parseFloat(formState.doh_sugerido_planta);
    if (isNaN(dohVal) || dohVal < 0) {
      toast.error("Ingrese un valor de DOH sugerido válido (>= 0)");
      return;
    }

    let loteMtsFinal: number | null = null;
    let bultoVal: number | null = null;
    let bultosPorPalletVal: number | null = null;

    if (formState.tipo_empaque === "pallet") {
      const pz = parseFloat(formState.piezas_por_pallet);
      if (isNaN(pz) || pz <= 0) {
        toast.error("Ingrese una cantidad válida de piezas por pallet (> 0)");
        return;
      }
      loteMtsFinal = pz;
    } else if (formState.tipo_empaque === "rollo") {
      bultoVal = parseFloat(formState.unidad_por_bulto);
      bultosPorPalletVal = parseInt(formState.bultos_por_pallet, 10);
      if (isNaN(bultoVal) || bultoVal <= 0) {
        toast.error("Ingrese la cantidad de unidades/metros por rollo (> 0)");
        return;
      }
      if (isNaN(bultosPorPalletVal) || bultosPorPalletVal <= 0) {
        toast.error("Ingrese la cantidad de rollos que componen un pallet (> 0)");
        return;
      }
      loteMtsFinal = bultoVal * bultosPorPalletVal;
    } else {
      loteMtsFinal = 1.0;
    }

    const provIdFinal = formState.id_proveedor !== "none" ? parseInt(formState.id_proveedor, 10) : null;
    const unidadFinal = formState.unidad.trim().toUpperCase() || "UN";

    setIsSaving(true);
    try {
      await updateMaterialConfiguracion({
        id_material: selectedMaterial.id_material,
        id_proveedor: provIdFinal,
        deposito_en_planta: formState.deposito_en_planta,
        tipo_empaque: formState.tipo_empaque,
        lote_mts: loteMtsFinal,
        unidad_por_bulto: bultoVal,
        bultos_por_pallet: bultosPorPalletVal,
        doh_sugerido_planta: dohVal,
        unidad: unidadFinal,
        en_cl2: formState.en_cl2,
      });

      toast.success(`Configuración de ${selectedMaterial.id_material} guardada con éxito`);
      setEditModalOpen(false);
      await fetchConfigList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar configuración");
    } finally {
      setIsSaving(false);
    }
  };

  const calculatedPalletMts = useMemo(() => {
    if (formState.tipo_empaque !== "rollo") return 0;
    const u = parseFloat(formState.unidad_por_bulto) || 0;
    const r = parseInt(formState.bultos_por_pallet, 10) || 0;
    return u * r;
  }, [formState.tipo_empaque, formState.unidad_por_bulto, formState.bultos_por_pallet]);

  const startRecord = data.total > 0 ? (data.page - 1) * data.page_size + 1 : 0;
  const endRecord = Math.min(data.page * data.page_size, data.total);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Configuración de Materiales
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Gestión de empaque (rollos, pallets o unidades), lotes de reposición, proveedor y DOH objetivo
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchConfigList}
            disabled={loading}
            className="text-xs h-9 gap-1.5 border-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="shadow-xs border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 rounded-lg text-slate-600">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Catálogo</p>
              <p className="text-xl font-bold text-slate-900">{data.total.toLocaleString("es-AR")}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-lg text-amber-700">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Empaque en Pallet</p>
              <p className="text-xl font-bold text-amber-700">
                {data.items.filter((it) => it.tipo_empaque === "pallet").length}{" "}
                <span className="text-xs font-normal text-slate-400">(en pág.)</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 rounded-lg text-purple-700">
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Empaque en Rollos</p>
              <p className="text-xl font-bold text-purple-700">
                {data.items.filter((it) => it.tipo_empaque === "rollo").length}{" "}
                <span className="text-xs font-normal text-slate-400">(en pág.)</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-lg text-blue-700">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Unidades Sueltas</p>
              <p className="text-xl font-bold text-blue-700">
                {data.items.filter((it) => it.tipo_empaque === "unidad").length}{" "}
                <span className="text-xs font-normal text-slate-400">(en pág.)</span>
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

              <div className="w-44">
                <Select
                  value={selectedEmpaque}
                  onValueChange={(val) => {
                    setSelectedEmpaque(val);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Tipo de Empaque" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los empaques</SelectItem>
                    <SelectItem value="pallet">Pallet directo</SelectItem>
                    <SelectItem value="rollo">Rollos por pallet</SelectItem>
                    <SelectItem value="unidad">Unidades sueltas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-36">
                <Select
                  value={selectedEnCl2}
                  onValueChange={(val) => {
                    setSelectedEnCl2(val);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Gestión CL2" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todo CL2</SelectItem>
                    <SelectItem value="true">Solo en CL2</SelectItem>
                    <SelectItem value="false">Sin CL2</SelectItem>
                  </SelectContent>
                </Select>
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
                  <TableHead className="w-20 text-xs font-semibold text-slate-700 text-center">Unidad</TableHead>
                  <TableHead className="w-40 text-xs font-semibold text-slate-700">Proveedor</TableHead>
                  <TableHead className="w-32 text-xs font-semibold text-slate-700 text-center">Modalidad Empaque</TableHead>
                  <TableHead className="w-48 text-xs font-semibold text-slate-700 text-center">Detalle de Presentación</TableHead>
                  <TableHead className="w-28 text-xs font-semibold text-slate-700 text-center">DOH Sugerido</TableHead>
                  <TableHead className="w-24 text-xs font-semibold text-slate-700 text-center">Gestión CL2</TableHead>
                  <TableHead className="w-24 text-xs font-semibold text-slate-700 text-center">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                        <span>Cargando configuración de materiales...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                      No se encontraron materiales con los filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((mat) => {
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
                        <TableCell className="text-center">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {mat.unidad}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {mat.nombre_proveedor ? (
                            <span className="font-medium text-slate-800">{mat.nombre_proveedor}</span>
                          ) : (
                            <span className="text-slate-400 italic">Sin asignar</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {mat.tipo_empaque === "rollo" ? (
                            <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 text-[10px] font-semibold">
                              Rollos
                            </Badge>
                          ) : mat.tipo_empaque === "pallet" ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-semibold">
                              Pallet
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">
                              Unidades
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs font-mono">
                          {mat.tipo_empaque === "rollo" ? (
                            <span className="text-purple-900 bg-purple-50/70 px-2 py-0.5 rounded border border-purple-200 font-medium text-[11px]">
                              {mat.unidad_por_bulto || 0} {mat.unidad}/rol × {mat.bultos_por_pallet || 0} rol ={" "}
                              <span className="font-bold">{mat.lote_mts || 0} {mat.unidad}</span>/pal
                            </span>
                          ) : mat.tipo_empaque === "pallet" ? (
                            <span className="text-amber-900 bg-amber-50/70 px-2 py-0.5 rounded border border-amber-200 font-bold text-[11px]">
                              {mat.lote_mts ? `${mat.lote_mts.toLocaleString("es-AR")} ${mat.unidad}/pal` : "—"}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Piezas individuales</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs font-mono font-semibold text-slate-700">
                          {mat.doh_sugerido_planta ? `${mat.doh_sugerido_planta} d` : "1.0 d"}
                        </TableCell>
                        <TableCell className="text-center">
                          {mat.en_cl2 ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold">
                              En CL2
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-50 text-slate-400 border-slate-200 text-[10px]">
                              Sin CL2
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(mat)}
                            className="h-7 px-2.5 text-[11px] border-slate-300 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-1 mx-auto"
                          >
                            <SlidersHorizontal className="w-3 h-3 text-indigo-600" />
                            <span>Configurar</span>
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
              Mostrando <span className="font-semibold text-slate-700">{startRecord}</span> a{" "}
              <span className="font-semibold text-slate-700">{endRecord}</span> de{" "}
              <span className="font-semibold text-slate-700">{data.total.toLocaleString("es-AR")}</span> materiales
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
                Página {data.page} de {data.total_pages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                disabled={page >= data.total_pages || loading}
                className="h-8 px-2.5 text-xs border-slate-300"
              >
                Siguiente
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
              <span>Configuración de Material</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Ajuste de parámetros de empaque, proveedor asignado y DOH sugerido en planta.
            </DialogDescription>
          </DialogHeader>

          {selectedMaterial && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Código SAP:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedMaterial.id_material}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Descripción:</span>
                  <span className="font-medium text-slate-800 text-right max-w-[280px] truncate">
                    {selectedMaterial.nombre}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Unidad Configurada:</span>
                  <span className="font-mono font-bold text-indigo-700">{formState.unidad || selectedMaterial.unidad}</span>
                </div>
              </div>

              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-slate-500" />
                      <span>Unidad de Medida</span>
                    </Label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Original: <strong className="text-slate-600">{selectedMaterial.unidad}</strong>
                    </span>
                  </div>
                  <Input
                    type="text"
                    value={formState.unidad}
                    onChange={(e) => setFormState({ ...formState, unidad: e.target.value.toUpperCase() })}
                    placeholder="Ej: MTS, CM, M2, CM2, UN, KG, L"
                    className="h-9 text-xs font-mono font-bold uppercase bg-white"
                    maxLength={20}
                  />
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {["MTS", "CM", "MM", "M2", "CM2", "UN", "C/U", "KG", "G", "L", "ML"].map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setFormState({ ...formState, unidad: u })}
                        className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold transition-colors ${
                          formState.unidad === u
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Proveedor Principal</span>
                  </Label>
                  <Select
                    value={formState.id_proveedor}
                    onValueChange={(val) => setFormState({ ...formState, id_proveedor: val })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Seleccionar proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin proveedor asignado</SelectItem>
                      {proveedoresList.map((p) => (
                        <SelectItem key={p.id_proveedor} value={String(p.id_proveedor)}>
                          {p.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Modalidad de Empaque / Presentación</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormState({ ...formState, tipo_empaque: "pallet" })}
                      className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                        formState.tipo_empaque === "pallet"
                          ? "border-amber-500 bg-amber-50/60 ring-1 ring-amber-500"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <Boxes className="w-3.5 h-3.5 text-amber-600" />
                        <span>Pallet</span>
                      </div>
                      <span className="text-[10px] text-slate-500">Piezas directas por pallet</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormState({ ...formState, tipo_empaque: "rollo" })}
                      className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                        formState.tipo_empaque === "rollo"
                          ? "border-purple-500 bg-purple-50/60 ring-1 ring-purple-500"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <ScrollText className="w-3.5 h-3.5 text-purple-600" />
                        <span>Rollos</span>
                      </div>
                      <span className="text-[10px] text-slate-500">Rollos que componen 1 pallet</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormState({ ...formState, tipo_empaque: "unidad" })}
                      className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                        formState.tipo_empaque === "unidad"
                          ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <Layers className="w-3.5 h-3.5 text-blue-600" />
                        <span>Unidades</span>
                      </div>
                      <span className="text-[10px] text-slate-500">Piezas individuales</span>
                    </button>
                  </div>
                </div>

                {formState.tipo_empaque === "pallet" && (
                  <div className="space-y-1.5 p-3 bg-amber-50/50 rounded-lg border border-amber-200">
                    <Label className="text-xs font-semibold text-amber-900">
                      Tamaño de Pallet ({formState.unidad || selectedMaterial.unidad} por pallet)
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      step="any"
                      value={formState.piezas_por_pallet}
                      onChange={(e) => setFormState({ ...formState, piezas_por_pallet: e.target.value })}
                      className="h-9 text-xs font-mono font-bold bg-white"
                      placeholder="Ej: 182"
                    />
                    <p className="text-[11px] text-slate-600">
                      Los pedidos sugeridos se redondearán siempre a múltiplos enteros de pallets de {formState.unidad || selectedMaterial.unidad}.
                    </p>
                  </div>
                )}

                {formState.tipo_empaque === "rollo" && (
                  <div className="space-y-3 p-3 bg-purple-50/50 rounded-lg border border-purple-200">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-purple-900">
                          Medida por Rollo ({formState.unidad || selectedMaterial.unidad})
                        </Label>
                        <Input
                          type="number"
                          min="0.1"
                          step="any"
                          value={formState.unidad_por_bulto}
                          onChange={(e) => setFormState({ ...formState, unidad_por_bulto: e.target.value })}
                          className="h-9 text-xs font-mono font-bold bg-white"
                          placeholder="Ej: 50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-purple-900">
                          Rollos por Pallet
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={formState.bultos_por_pallet}
                          onChange={(e) => setFormState({ ...formState, bultos_por_pallet: e.target.value })}
                          className="h-9 text-xs font-mono font-bold bg-white"
                          placeholder="Ej: 6"
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-white rounded border border-purple-100 flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">Equivalencia 1 Pallet Completo:</span>
                      <span className="font-mono font-bold text-purple-900">
                        {calculatedPalletMts.toLocaleString("es-AR")} {formState.unidad || selectedMaterial.unidad}
                        <span className="text-[11px] text-slate-400 font-normal ml-1">
                          ({formState.bultos_por_pallet} rollos de {formState.unidad_por_bulto} {formState.unidad || selectedMaterial.unidad})
                        </span>
                      </span>
                    </div>
                  </div>
                )}

                {formState.tipo_empaque === "unidad" && (
                  <div className="p-3 bg-slate-100/70 rounded-lg border border-slate-200 text-xs text-slate-600">
                    Material configurado por unidades individuales sin agrupación obligatoria en pallets.
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>DOH Sugerido en Planta (Días de Cobertura Objetivo)</span>
                  </Label>
                  <Input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={formState.doh_sugerido_planta}
                    onChange={(e) => setFormState({ ...formState, doh_sugerido_planta: e.target.value })}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <p className="text-[11px] text-slate-500">
                    Días de consumo a mantener en planta para la sugerencia automática de pedidos diarios.
                  </p>
                </div>

                <div className="space-y-1.5 p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Warehouse className="w-4 h-4 text-indigo-600" />
                      <div>
                        <Label htmlFor="en_cl2_switch" className="text-xs font-bold text-slate-800 cursor-pointer">
                          Gestión en Depósito CL2
                        </Label>
                        <p className="text-[11px] text-slate-500">
                          {formState.en_cl2
                            ? "Habilitado: El material se almacena en CL2 y genera sugerencias de pedidos diarios."
                            : "Deshabilitado: Material directo a planta o sin CL2. No se sugerirán pedidos a depósito."}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="en_cl2_switch"
                      checked={formState.en_cl2}
                      onCheckedChange={(checked) => setFormState({ ...formState, en_cl2: checked })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setEditModalOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveConfig}
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Guardar Configuración</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
