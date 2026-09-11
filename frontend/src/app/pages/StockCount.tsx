import { useState, useRef } from "react";
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
} from "lucide-react";
import { toast } from "sonner";

// Catálogo disponible para búsqueda
const CATALOG = [
  { code: "Código 001", name: "Material 1", unit: "UN" },
  { code: "Código 002", name: "Material 2", unit: "KG" },
  { code: "Código 003", name: "Material 3", unit: "MT" },
  { code: "Código 004", name: "Material 4", unit: "LT" },
  { code: "Código 005", name: "Material 5", unit: "UN" },
  { code: "Código 006", name: "Material 6", unit: "KG" },
  { code: "Código 007", name: "Material 7", unit: "M2" },
  { code: "Código 008", name: "Material 8", unit: "GR" },
];

interface CountRow {
  id: string;
  code: string;
  name: string;
  unit: string;
  counted: number;
}

export function StockCount() {
  const navigate = useNavigate();
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionTime] = useState(new Date());
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<CountRow[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const alreadyAdded = new Set(rows.map((r) => r.code));

  const suggestions = CATALOG.filter(
    (m) =>
      !alreadyAdded.has(m.code) &&
      (m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.code.toLowerCase().includes(search.toLowerCase()))
  ).slice(0, 6);

  const handleAddMaterial = (item: (typeof CATALOG)[0]) => {
    setRows((prev) => [
      ...prev,
      { id: String(Date.now()), code: item.code, name: item.name, unit: item.unit, counted: 0 },
    ]);
    setSearch("");
    setShowDropdown(false);
    searchRef.current?.focus();
  };

  const handleRemoveRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleCountChange = (id: string, value: number) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, counted: Math.max(0, value) } : r))
    );
  };

  const handleGenerateSuggestedOrder = () => {
    if (rows.length === 0) {
      toast.error("Agregue al menos un material al conteo");
      return;
    }
    // Pass rows as state to NewOrder
    navigate("/nuevo-pedido", {
      state: {
        fromConteo: true,
        suggestedMaterials: rows.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          unit: r.unit,
          suggestedQuantity: r.counted,
          quantity: r.counted,
          observations: "",
        })),
      },
    });
  };

  if (!sessionStarted) {
    return (
      <div className="p-4 sm:p-8 max-w-lg mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-slate-900 mb-2 flex items-center gap-3">
            <ClipboardList className="w-8 h-8" />
            Conteo de planta
          </h1>
          <p className="text-slate-600">Registro de conteo físico de materiales</p>
        </div>
        <Card className="border-2 border-slate-200">
          <CardContent className="pt-8 pb-8">
            <div className="text-center space-y-5">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                <ClipboardList className="w-8 h-8 text-slate-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-1">
                  Iniciar sesión de conteo
                </h2>
                <p className="text-slate-500 text-sm">
                  Se registrarán fecha, hora y usuario responsable
                </p>
              </div>
              <div className="flex items-center justify-center gap-6 text-sm text-slate-500 border border-slate-100 rounded-lg bg-slate-50 py-3 px-4">
                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  <span className="font-medium">Nicolás</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>
                    {new Date().toLocaleString("es-AR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
              <Button
                size="lg"
                className="w-full py-6 text-base"
                onClick={() => setSessionStarted(true)}
              >
                Iniciar conteo
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900 mb-2 flex items-center gap-3">
          <ClipboardList className="w-7 h-7" />
          Conteo de planta
        </h1>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="font-medium text-slate-700">Sesión activa</span>
          </div>
          <span>Nicolás</span>
          <span>·</span>
          <span>
            {sessionTime.toLocaleString("es-AR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <Badge variant="outline">{rows.length} materiales</Badge>
        </div>
      </div>

      {/* Buscador de materiales */}
      <Card className="mb-4">
        <CardContent className="pt-5 pb-5">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-slate-700">
              Agregar material al conteo
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                ref={searchRef}
                placeholder="Buscar por código o nombre de material..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="pl-10 py-5 text-base"
              />
              {search && (
                <button
                  onClick={() => { setSearch(""); setShowDropdown(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {/* Dropdown */}
              {showDropdown && search.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden">
                  {suggestions.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-400">
                      {alreadyAdded.size > 0 && CATALOG.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.code.toLowerCase().includes(search.toLowerCase())).every(m => alreadyAdded.has(m.code))
                        ? "Material ya agregado al conteo"
                        : "No se encontraron materiales"}
                    </div>
                  ) : (
                    suggestions.map((item) => (
                      <button
                        key={item.code}
                        onClick={() => handleAddMaterial(item)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                      >
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Plus className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-900 text-sm">{item.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{item.code} · {item.unit}</p>
                        </div>
                        <span className="text-xs text-slate-400">Agregar</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de conteo */}
      {rows.length === 0 ? (
        <Card className="mb-4">
          <CardContent className="py-16">
            <div className="text-center">
              <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">La lista de conteo está vacía</p>
              <p className="text-slate-400 text-sm mt-1">
                Buscá un material arriba para comenzar el conteo
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-900 text-base">
              Materiales en conteo ({rows.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="border-t border-slate-100">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Código</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-center w-36">Cantidad contada</TableHead>
                    <TableHead className="w-20">Unidad</TableHead>
                    <TableHead className="w-12 pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="pl-6 font-mono text-sm text-slate-600">
                        {row.code}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {row.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleCountChange(row.id, row.counted - 1)}
                            className="w-8 h-8 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-600 flex-shrink-0"
                          >
                            −
                          </button>
                          <Input
                            type="number"
                            min="0"
                            value={row.counted}
                            onChange={(e) =>
                              handleCountChange(row.id, parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center font-semibold text-lg py-1 h-8"
                          />
                          <button
                            onClick={() => handleCountChange(row.id, row.counted + 1)}
                            className="w-8 h-8 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-600 flex-shrink-0"
                          >
                            +
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500 font-medium">
                        {row.unit}
                      </TableCell>
                      <TableCell className="pr-4">
                        <button
                          onClick={() => handleRemoveRow(row.id)}
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
          </CardContent>
        </Card>
      )}

      {/* Acciones */}
      {rows.length > 0 && (
        <div className="space-y-3">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <ShoppingCart className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-900 text-sm mb-0.5">
                    Generar Pedido Sugerido
                  </p>
                  <p className="text-sm text-blue-700">
                    Al finalizar el conteo, podés generar un pedido precargado con los
                    materiales y cantidades contadas. Las cantidades son editables antes
                    de confirmar.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                toast.success("Conteo guardado correctamente");
              }}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Guardar conteo
            </Button>
            <Button
              className="flex-1"
              onClick={handleGenerateSuggestedOrder}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Generar Pedido Sugerido
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
