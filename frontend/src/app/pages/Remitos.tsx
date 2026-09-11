import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
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
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  User,
  Calendar,
  Truck,
  Package,
} from "lucide-react";
import { toast } from "sonner";

type RemitoStatus = "pendiente" | "parcial" | "completo";

interface RemitoMaterial {
  code: string;
  name: string;
  quantity: number;
  unit: string;
}

interface Remito {
  id: string;
  number: string;
  proveedor: string;
  fecha: string;
  fechaRecepcion: string | null;
  estado: RemitoStatus;
  usuario: string;
  observaciones: string;
  materials: RemitoMaterial[];
}

const PROVEEDORES = [
  "Proveedor 1",
  "Proveedor 2",
  "Proveedor 3",
  "Proveedor 4",
];

const CATALOG = [
  { code: "Código 001", name: "Material 1", unit: "UN" },
  { code: "Código 002", name: "Material 2", unit: "KG" },
  { code: "Código 003", name: "Material 3", unit: "MT" },
  { code: "Código 004", name: "Material 4", unit: "LT" },
  { code: "Código 005", name: "Material 5", unit: "UN" },
  { code: "Código 006", name: "Material 6", unit: "KG" },
];

const initialRemitos: Remito[] = [
  {
    id: "1", number: "RI-2341", proveedor: "Proveedor 1", fecha: "29/06/2026",
    fechaRecepcion: "29/06/2026 10:45", estado: "completo", usuario: "Usuario 1",
    observaciones: "",
    materials: [
      { code: "Código 001", name: "Material 1", quantity: 50, unit: "UN" },
      { code: "Código 005", name: "Material 5", quantity: 10, unit: "UN" },
    ],
  },
  {
    id: "2", number: "RI-2340", proveedor: "Proveedor 2", fecha: "28/06/2026",
    fechaRecepcion: "28/06/2026 14:00", estado: "parcial", usuario: "Usuario 1",
    observaciones: "Faltaron 5 LT de Material 4",
    materials: [
      { code: "Código 004", name: "Material 4", quantity: 25, unit: "LT" },
    ],
  },
  {
    id: "3", number: "RI-2339", proveedor: "Proveedor 3", fecha: "27/06/2026",
    fechaRecepcion: "27/06/2026 09:00", estado: "completo", usuario: "Usuario 1",
    observaciones: "",
    materials: [
      { code: "Código 002", name: "Material 2", quantity: 20, unit: "KG" },
      { code: "Código 006", name: "Material 6", quantity: 30, unit: "KG" },
    ],
  },
  {
    id: "4", number: "RI-2338", proveedor: "Proveedor 4", fecha: "25/06/2026",
    fechaRecepcion: null, estado: "pendiente", usuario: "Nicolás",
    observaciones: "Pendiente de recepción en depósito",
    materials: [
      { code: "Código 001", name: "Material 1", quantity: 100, unit: "UN" },
      { code: "Código 003", name: "Material 3", quantity: 80, unit: "MT" },
    ],
  },
];

const statusConfig: Record<RemitoStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pendiente: { label: "Pendiente de recepción", color: "bg-slate-100 text-slate-700", icon: <Clock className="w-3 h-3 mr-1" /> },
  parcial: { label: "Recibido parcialmente", color: "bg-amber-100 text-amber-700", icon: <AlertCircle className="w-3 h-3 mr-1" /> },
  completo: { label: "Recibido completo", color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="w-3 h-3 mr-1" /> },
};

type View = "list" | "detail" | "new";

export function Remitos() {
  const [remitos, setRemitos] = useState<Remito[]>(initialRemitos);
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("all");
  const [filterProveedor, setFilterProveedor] = useState("all");

  // Form state for new remito
  const [form, setForm] = useState({
    number: "",
    proveedor: "",
    fecha: new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }),
    observaciones: "",
  });
  const [formMaterials, setFormMaterials] = useState<(RemitoMaterial & { id: string })[]>([]);
  const [matSearch, setMatSearch] = useState("");
  const [showMatDropdown, setShowMatDropdown] = useState(false);

  const selected = remitos.find((r) => r.id === selectedId);

  // Filters
  const filtered = remitos.filter((r) => {
    const matchSearch =
      search === "" ||
      r.number.toLowerCase().includes(search.toLowerCase()) ||
      r.proveedor.toLowerCase().includes(search.toLowerCase());
    const matchEstado = filterEstado === "all" || r.estado === filterEstado;
    const matchProv = filterProveedor === "all" || r.proveedor === filterProveedor;
    return matchSearch && matchEstado && matchProv;
  });

  // Catalog dropdown
  const alreadyAdded = new Set(formMaterials.map((m) => m.code));
  const catalogFiltered = CATALOG.filter(
    (c) =>
      !alreadyAdded.has(c.code) &&
      (c.name.toLowerCase().includes(matSearch.toLowerCase()) ||
        c.code.toLowerCase().includes(matSearch.toLowerCase()))
  ).slice(0, 5);

  const handleAddMaterial = (item: (typeof CATALOG)[0]) => {
    setFormMaterials((prev) => [
      ...prev,
      { id: String(Date.now()), code: item.code, name: item.name, unit: item.unit, quantity: 1 },
    ]);
    setMatSearch("");
    setShowMatDropdown(false);
  };

  const handleRemoveMaterial = (id: string) => {
    setFormMaterials((prev) => prev.filter((m) => m.id !== id));
  };

  const handleQtyChange = (id: string, qty: number) => {
    setFormMaterials((prev) =>
      prev.map((m) => (m.id === id ? { ...m, quantity: Math.max(1, qty) } : m))
    );
  };

  const handleSaveRemito = () => {
    if (!form.number.trim()) { toast.error("Ingrese el número de remito"); return; }
    if (!form.proveedor) { toast.error("Seleccione un proveedor"); return; }
    if (formMaterials.length === 0) { toast.error("Agregue al menos un material"); return; }

    const newRemito: Remito = {
      id: String(Date.now()),
      number: form.number.trim(),
      proveedor: form.proveedor,
      fecha: form.fecha,
      fechaRecepcion: null,
      estado: "pendiente",
      usuario: "Nicolás",
      observaciones: form.observaciones,
      materials: formMaterials.map(({ code, name, quantity, unit }) => ({ code, name, quantity, unit })),
    };
    setRemitos((prev) => [newRemito, ...prev]);
    toast.success("Remito cargado correctamente");
    setForm({ number: "", proveedor: "", fecha: new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }), observaciones: "" });
    setFormMaterials([]);
    setView("list");
  };

  const handleConfirmReception = (id: string) => {
    const now = new Date().toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    setRemitos((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, estado: "completo", fechaRecepcion: now } : r
      )
    );
    toast.success("Recepción confirmada. Stock actualizado automáticamente.");
  };

  // ─── DETAIL VIEW ───────────────────────────────────────────────────
  if (view === "detail" && selected) {
    const cfg = statusConfig[selected.estado];
    return (
      <div className="p-8">
        <Button variant="ghost" onClick={() => setView("list")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al historial
        </Button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 mb-1">{selected.number}</h1>
            <p className="text-slate-600">{selected.proveedor}</p>
          </div>
          <Badge className={`${cfg.color} px-3 py-1.5 text-sm`} variant="outline">
            {cfg.icon}
            {cfg.label}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Datos generales */}
            <Card>
              <CardHeader>
                <CardTitle className="text-slate-900">Datos generales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Truck className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Proveedor</p>
                      <p className="font-semibold text-slate-900">{selected.proveedor}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Fecha del remito</p>
                      <p className="font-semibold text-slate-900">{selected.fecha}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Cargado por</p>
                      <p className="font-semibold text-slate-900">{selected.usuario}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Fecha de recepción</p>
                      <p className="font-semibold text-slate-900">
                        {selected.fechaRecepcion ?? "Pendiente"}
                      </p>
                    </div>
                  </div>
                </div>
                {selected.observaciones && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-sm text-slate-500 mb-1">Observaciones</p>
                    <p className="text-slate-700 text-sm">{selected.observaciones}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Materiales */}
            <Card>
              <CardHeader>
                <CardTitle className="text-slate-900">Detalle de materiales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="text-center">Cantidad</TableHead>
                        <TableHead>Unidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selected.materials.map((mat, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-sm text-slate-600">{mat.code}</TableCell>
                          <TableCell className="font-medium">{mat.name}</TableCell>
                          <TableCell className="text-center font-bold text-slate-900">{mat.quantity}</TableCell>
                          <TableCell className="text-slate-500">{mat.unit}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Panel lateral */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-slate-900">Resumen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">N.º de remito</span>
                  <span className="font-mono font-bold text-slate-900">{selected.number}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Materiales</span>
                  <Badge variant="outline">{selected.materials.length} ítems</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Estado</span>
                  <Badge className={cfg.color} variant="outline">
                    {cfg.icon}
                    {cfg.label}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {selected.estado === "pendiente" && (
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="pt-5">
                  <div className="flex gap-2 mb-4">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-amber-900 text-sm mb-1">Pendiente de recepción</p>
                      <p className="text-xs text-amber-800">
                        Al confirmar la recepción se actualizará el stock automáticamente y se registrará el usuario y la fecha.
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => { handleConfirmReception(selected.id); setView("list"); }}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Confirmar recepción
                  </Button>
                </CardContent>
              </Card>
            )}

            {selected.estado !== "pendiente" && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-5 pb-5">
                  <div className="flex gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-green-900 text-sm">Remito recibido</p>
                      <p className="text-xs text-green-800 mt-0.5">
                        Stock actualizado el {selected.fechaRecepcion}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── NEW REMITO VIEW ────────────────────────────────────────────────
  if (view === "new") {
    return (
      <div className="p-8">
        <Button variant="ghost" onClick={() => setView("list")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al historial
        </Button>

        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-slate-900 mb-2">Nuevo remito</h1>
          <p className="text-slate-600">Cargá los datos del remito de proveedor</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Datos del remito */}
            <Card>
              <CardHeader>
                <CardTitle className="text-slate-900">Datos del remito</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Número de remito *</Label>
                    <Input
                      placeholder="Ej: RI-2342"
                      value={form.number}
                      onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Input
                      value={form.fecha}
                      onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Proveedor *</Label>
                  <Select value={form.proveedor} onValueChange={(v) => setForm((f) => ({ ...f, proveedor: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVEEDORES.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Observaciones</Label>
                  <Textarea
                    placeholder="Observaciones opcionales sobre el remito..."
                    value={form.observaciones}
                    onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Materiales */}
            <Card>
              <CardHeader>
                <CardTitle className="text-slate-900">Materiales incluidos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Buscador de catálogo */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Buscar material para agregar..."
                    value={matSearch}
                    onChange={(e) => { setMatSearch(e.target.value); setShowMatDropdown(true); }}
                    onFocus={() => setShowMatDropdown(true)}
                    className="pl-9"
                  />
                  {showMatDropdown && matSearch.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden">
                      {catalogFiltered.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-400">No se encontraron materiales</div>
                      ) : (
                        catalogFiltered.map((item) => (
                          <button
                            key={item.code}
                            onClick={() => handleAddMaterial(item)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0 text-sm transition-colors"
                          >
                            <Plus className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-slate-900">{item.name}</span>
                            <span className="text-slate-400 font-mono text-xs">{item.code}</span>
                            <span className="text-slate-400 text-xs ml-auto">{item.unit}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Lista de materiales */}
                {formMaterials.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 rounded-lg py-8 text-center">
                    <Package className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">Buscá un material arriba para agregarlo</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Material</TableHead>
                          <TableHead className="text-center w-28">Cantidad</TableHead>
                          <TableHead className="w-16">Unidad</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formMaterials.map((mat) => (
                          <TableRow key={mat.id}>
                            <TableCell className="font-mono text-sm text-slate-500">{mat.code}</TableCell>
                            <TableCell className="font-medium">{mat.name}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                value={mat.quantity}
                                onChange={(e) => handleQtyChange(mat.id, parseInt(e.target.value) || 1)}
                                className="w-20 mx-auto text-center"
                              />
                            </TableCell>
                            <TableCell className="text-slate-500">{mat.unit}</TableCell>
                            <TableCell>
                              <button
                                onClick={() => handleRemoveMaterial(mat.id)}
                                className="w-8 h-8 rounded flex items-center justify-center hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
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

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setView("list")}>Cancelar</Button>
              <Button onClick={handleSaveRemito}>Guardar remito</Button>
            </div>
          </div>

          {/* Resumen lateral */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-slate-900">Resumen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Materiales</span>
                  <Badge variant="secondary">{formMaterials.length} ítems</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Estado inicial</span>
                  <Badge className="bg-slate-100 text-slate-700" variant="outline">Pendiente de recepción</Badge>
                </div>
                {form.proveedor && (
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-sm text-slate-500 mb-1">Proveedor</p>
                    <p className="font-medium text-slate-900 text-sm">{form.proveedor}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ─── LIST VIEW ──────────────────────────────────────────────────────
  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 mb-2">Remitos</h1>
          <p className="text-slate-600">Historial de ingresos de mercadería de proveedores</p>
        </div>
        <Button onClick={() => setView("new")}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo remito
        </Button>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por N.º o proveedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterProveedor} onValueChange={setFilterProveedor}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los proveedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los proveedores</SelectItem>
                {PROVEEDORES.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pendiente">Pendiente de recepción</SelectItem>
                <SelectItem value="parcial">Recibido parcialmente</SelectItem>
                <SelectItem value="completo">Recibido completo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle className="text-slate-900">Historial de remitos ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N.º Remito</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Cargado por</TableHead>
                  <TableHead>Fecha recepción</TableHead>
                  <TableHead className="text-center">Materiales</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const cfg = statusConfig[r.estado];
                  return (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => { setSelectedId(r.id); setView("detail"); }}>
                      <TableCell className="font-mono font-bold text-slate-900">{r.number}</TableCell>
                      <TableCell className="text-slate-700">{r.proveedor}</TableCell>
                      <TableCell className="text-slate-600">{r.fecha}</TableCell>
                      <TableCell>
                        <Badge className={cfg.color} variant="outline">
                          {cfg.icon}
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600">{r.usuario}</TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {r.fechaRecepcion ?? <span className="text-slate-300">—</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{r.materials.length} ítems</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedId(r.id); setView("detail"); }}>
                          Ver detalle
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
