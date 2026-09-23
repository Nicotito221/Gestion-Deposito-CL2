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
} from "lucide-react";
import { toast } from "sonner";
import {
  createPedido,
  searchMaterialesCatalogo,
  type MaterialCatalogoItem,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { formatSoloFechaAR } from "../components/ui/format";

interface Material {
  id: string;
  code: string;
  name: string;
  suggestedQuantity?: number;
  quantity: number;
  unit: string;
  observations: string;
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

  const fromConteo = location.state?.fromConteo === true;
  const suggestedMaterials: Material[] = location.state?.suggestedMaterials ?? [];
  const initialFechaReq =
    location.state?.fecha_requerida ||
    (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().split("T")[0];
    })();
  const initialTurno = location.state?.turno || "Turno Mañana";

  const isSectorLocked = Boolean(currentUser?.sector && currentUser.sector !== "TODOS");
  const initialSector = isSectorLocked
    ? (currentUser?.sector as string)
    : location.state?.sector || (currentUser?.sector === "TODOS" ? "Despacho" : "PC");

  const [sector, setSector] = useState<string>(initialSector);
  const [priority, setPriority] = useState<"normal" | "urgente">("normal");
  const [fechaRequerida, setFechaRequerida] = useState<string>(initialFechaReq);
  const [turno, setTurno] = useState<string>(initialTurno);
  const [materials, setMaterials] = useState<Material[]>(
    fromConteo && suggestedMaterials.length > 0 ? suggestedMaterials : []
  );

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

  const handleAddFromCatalog = (item: MaterialCatalogoItem) => {
    setMaterials((prev) => [
      ...prev,
      {
        id: String(Date.now()) + Math.random().toString(36).substring(2, 6),
        code: item.id_material,
        name: item.nombre || item.id_material,
        unit: item.unidad || "MTS",
        quantity: 1,
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

    setIsSubmitting(true);
    try {
      const payload = {
        sector: finalSector,
        prioridad: priority,
        origen: (fromConteo ? "conteo_planta" : "manual") as "conteo_planta" | "manual",
        fecha_requerida: fechaRequerida,
        turno: turno === "Completo" ? undefined : turno,
        id_conteo: location.state?.id_conteo,
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
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const rolCfg = currentUser?.rol ? ROLES_BADGES[currentUser.rol] : undefined;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
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

      {/* Banner de Origen */}
      {fromConteo ? (
        <Card className="bg-blue-50/80 border-blue-200 shadow-2xs">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-700 flex-shrink-0 mt-0.5">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div className="flex-1 text-xs">
              <p className="font-bold text-blue-900 text-sm">
                Pedido sugerido a partir de Conteo Físico de Planta
              </p>
              <p className="text-blue-700 mt-0.5 leading-relaxed">
                Los materiales y cantidades sugeridas fueron precargados automáticamente para alcanzar el DOH objetivo de planta. Puede ajustar las cantidades finales antes de confirmar.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-50 border-slate-200/80 shadow-2xs">
          <CardContent className="p-3.5 flex items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-slate-200/70 rounded-md text-slate-700">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <span>
                <strong>Modo manual:</strong> Busque materiales en el catálogo para agregarlos directamente a la solicitud.
              </span>
            </div>
            <span className="text-slate-400 hidden sm:inline text-[11px]">
              Los pedidos cargados impactan en tiempo real en la cola del depósito.
            </span>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Columna Izquierda: Formulario y Materiales */}
        <div className="lg:col-span-2 space-y-6">
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
                    value={fechaRequerida}
                    onChange={(e) => setFechaRequerida(e.target.value)}
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
                            <Badge variant="outline" className="text-[10px] bg-slate-50 font-mono text-slate-600">
                              {item.unidad || "MTS"}
                            </Badge>
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
                        {fromConteo && (
                          <TableHead className="text-center w-28 text-xs font-semibold text-slate-700">
                            Sugerido
                          </TableHead>
                        )}
                        <TableHead className="text-center w-36 text-xs font-semibold text-slate-700">
                          {fromConteo ? "Cant. Final" : "Cantidad"}
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

                          {fromConteo && (
                            <TableCell className="text-center whitespace-nowrap">
                              <span className="font-mono font-bold text-slate-500 text-xs">
                                {(m.suggestedQuantity ?? m.quantity).toLocaleString("es-AR")}
                              </span>
                              <span className="text-[10px] text-slate-400 ml-1">{m.unit}</span>
                            </TableCell>
                          )}

                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStepQuantity(m.id, -1)}
                                className="w-6 h-7 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors"
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
                                className="w-16 h-7 text-center font-mono font-bold text-xs p-1"
                              />
                              <button
                                type="button"
                                onClick={() => handleStepQuantity(m.id, 1)}
                                className="w-6 h-7 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
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
