import { useState } from "react";
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
import { Plus, Trash2, Calendar, User, ClipboardList, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

interface Material {
  id: string;
  code: string;
  name: string;
  suggestedQuantity?: number;
  quantity: number;
  unit: string;
  observations: string;
}

const CATALOG = [
  { code: "Código 001", name: "Material 1", unit: "UN" },
  { code: "Código 002", name: "Material 2", unit: "KG" },
  { code: "Código 003", name: "Material 3", unit: "MT" },
  { code: "Código 004", name: "Material 4", unit: "LT" },
  { code: "Código 005", name: "Material 5", unit: "UN" },
  { code: "Código 006", name: "Material 6", unit: "KG" },
];

export function NewOrder() {
  const navigate = useNavigate();
  const location = useLocation();

  // Detect if coming from conteo with pre-loaded materials
  const fromConteo = location.state?.fromConteo === true;
  const suggestedMaterials: Material[] = location.state?.suggestedMaterials ?? [];

  const [sector, setSector] = useState("");
  const [priority, setPriority] = useState("normal");
  const [materials, setMaterials] = useState<Material[]>(
    fromConteo && suggestedMaterials.length > 0
      ? suggestedMaterials
      : []
  );
  const [searchValue, setSearchValue] = useState("");
  const [showCatalog, setShowCatalog] = useState(false);

  const alreadyAdded = new Set(materials.map((m) => m.code));
  const catalogFiltered = CATALOG.filter(
    (c) =>
      !alreadyAdded.has(c.code) &&
      (c.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        c.code.toLowerCase().includes(searchValue.toLowerCase()))
  ).slice(0, 5);

  const handleAddFromCatalog = (item: (typeof CATALOG)[0]) => {
    setMaterials((prev) => [
      ...prev,
      { id: String(Date.now()), code: item.code, name: item.name, unit: item.unit, quantity: 1, observations: "" },
    ]);
    setSearchValue("");
    setShowCatalog(false);
  };

  const handleRemoveMaterial = (id: string) => {
    setMaterials(materials.filter((m) => m.id !== id));
  };

  const handleUpdateMaterial = (id: string, field: keyof Material, value: string | number) => {
    setMaterials(materials.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const handleSubmit = () => {
    if (!sector) {
      toast.error("Por favor seleccione un sector solicitante");
      return;
    }
    if (materials.length === 0) {
      toast.error("Debe agregar al menos un material");
      return;
    }
    toast.success("Pedido enviado correctamente");
    setTimeout(() => navigate("/pedidos"), 1500);
  };

  const currentDate = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900 mb-2">
          Nuevo pedido de materiales
        </h1>
        <p className="text-slate-600">
          Complete el formulario para solicitar materiales al depósito
        </p>
      </div>

      {/* Banner de origen del pedido */}
      {fromConteo ? (
        <Card className="mb-6 bg-blue-50 border-blue-300 border-2">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <ClipboardList className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-900 text-sm">
                  Pedido sugerido desde Conteo de Planta
                </p>
                <p className="text-sm text-blue-700 mt-0.5">
                  Los materiales y cantidades fueron precargados desde el conteo. Podés
                  editar cualquier cantidad antes de confirmar el pedido.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6 bg-slate-50 border-slate-200">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <ShoppingCart className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-700 text-sm">Pedido manual</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  Buscá materiales del catálogo y definí las cantidades manualmente.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos generales */}
          <Card>
            <CardHeader>
              <CardTitle className="text-slate-900">Datos del pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sector">Sector solicitante *</Label>
                  <Select value={sector} onValueChange={setSector}>
                    <SelectTrigger id="sector">
                      <SelectValue placeholder="Seleccione un sector" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="produccion">Producción</SelectItem>
                      <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                      <SelectItem value="administracion">Administración</SelectItem>
                      <SelectItem value="logistica">Logística</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Prioridad</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Materiales */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-slate-900">Materiales solicitados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Buscador de catálogo */}
              <div className="relative">
                <div className="relative">
                  <Input
                    placeholder="Buscar material por código o nombre para agregar..."
                    value={searchValue}
                    onChange={(e) => { setSearchValue(e.target.value); setShowCatalog(true); }}
                    onFocus={() => setShowCatalog(true)}
                    className="pr-10"
                  />
                  <Plus className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
                {showCatalog && searchValue.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden">
                    {catalogFiltered.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-400">No se encontraron materiales</div>
                    ) : (
                      catalogFiltered.map((item) => (
                        <button
                          key={item.code}
                          onClick={() => handleAddFromCatalog(item)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0 text-sm transition-colors"
                        >
                          <span className="font-medium text-slate-900">{item.name}</span>
                          <span className="text-slate-400 font-mono text-xs">{item.code}</span>
                          <span className="text-slate-400 text-xs ml-auto">{item.unit}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Tabla de materiales */}
              {materials.length === 0 ? (
                <div className="border-2 border-dashed border-slate-200 rounded-lg py-10 text-center">
                  <p className="text-slate-400 text-sm">
                    Buscá un material arriba para agregarlo al pedido
                  </p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Material</TableHead>
                        {fromConteo && (
                          <TableHead className="text-center w-28">Cant. sugerida</TableHead>
                        )}
                        <TableHead className="text-center w-28">
                          {fromConteo ? "Cant. final" : "Cantidad"}
                        </TableHead>
                        <TableHead className="w-20">Unidad</TableHead>
                        <TableHead>Observaciones</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materials.map((material) => (
                        <TableRow key={material.id}>
                          <TableCell className="font-mono text-sm text-slate-600">
                            {material.code}
                          </TableCell>
                          <TableCell className="font-medium">{material.name}</TableCell>
                          {fromConteo && (
                            <TableCell className="text-center">
                              <span className="text-slate-500 font-semibold">
                                {material.suggestedQuantity ?? material.quantity}
                              </span>
                              <span className="text-xs text-slate-400 ml-1">{material.unit}</span>
                            </TableCell>
                          )}
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={material.quantity}
                              onChange={(e) =>
                                handleUpdateMaterial(material.id, "quantity", parseInt(e.target.value) || 1)
                              }
                              className="w-20 mx-auto text-center font-semibold"
                            />
                          </TableCell>
                          <TableCell className="text-slate-500">{material.unit}</TableCell>
                          <TableCell>
                            <Input
                              placeholder="Opcional"
                              value={material.observations}
                              onChange={(e) =>
                                handleUpdateMaterial(material.id, "observations", e.target.value)
                              }
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => handleRemoveMaterial(material.id)}
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

          {/* Botones */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => navigate("/")}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>Enviar pedido</Button>
          </div>
        </div>

        {/* Resumen */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-slate-900">Resumen del pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Usuario solicitante</p>
                  <p className="font-semibold text-slate-900">Nicolás</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Fecha del pedido</p>
                  <p className="font-semibold text-slate-900">{currentDate}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Cantidad de ítems</span>
                  <Badge variant="secondary" className="text-base px-3 py-1">
                    {materials.length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Prioridad</span>
                  <Badge variant={priority === "urgente" ? "destructive" : "outline"}>
                    {priority === "urgente" ? "Urgente" : "Normal"}
                  </Badge>
                </div>
                {fromConteo && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Origen</span>
                    <Badge className="bg-blue-100 text-blue-700" variant="outline">
                      Desde conteo
                    </Badge>
                  </div>
                )}
              </div>
              {sector && (
                <div className="pt-3 border-t border-slate-200">
                  <p className="text-sm text-slate-500 mb-1">Sector</p>
                  <p className="font-medium text-slate-900 capitalize">{sector}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <p className="text-sm text-blue-900">
                <strong>Importante:</strong> Una vez enviado el pedido, será procesado
                por el depósito. Recibirá una notificación cuando esté listo para retiro.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
