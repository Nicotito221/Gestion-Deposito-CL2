import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
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
  DialogFooter,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Search, Plus } from "lucide-react";

interface Material {
  id: string;
  code: string;
  name: string;
  stock: number;
  unit: string;
  category: string;
}

const initialMaterials: Material[] = [
  { id: "1", code: "Código 001", name: "Material 1", stock: 150, unit: "UN", category: "Insumos" },
  { id: "2", code: "Código 002", name: "Material 2", stock: 75, unit: "KG", category: "Materia Prima" },
  { id: "3", code: "Código 003", name: "Material 3", stock: 200, unit: "MT", category: "Insumos" },
  { id: "4", code: "Código 004", name: "Material 4", stock: 45, unit: "LT", category: "Químicos" },
  { id: "5", code: "Código 005", name: "Material 5", stock: 300, unit: "UN", category: "Herramientas" },
];

const CATEGORIES = ["Insumos", "Materia Prima", "Químicos", "Herramientas", "Otros"];
const UNITS = ["UN", "KG", "MT", "LT", "M2", "GR"];

export function Materials() {
  const [materials, setMaterials] = useState<Material[]>(initialMaterials);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", stock: "", unit: "", category: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered = materials.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.code.toLowerCase().includes(search.toLowerCase())
  );

  function validate() {
    const e: Record<string, string> = {};
    if (!form.code.trim()) e.code = "Requerido";
    if (!form.name.trim()) e.name = "Requerido";
    if (!form.stock || isNaN(Number(form.stock)) || Number(form.stock) < 0) e.stock = "Ingrese un número válido";
    if (!form.unit) e.unit = "Requerido";
    if (!form.category) e.category = "Requerido";
    return e;
  }

  function handleAdd() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const next: Material = {
      id: String(Date.now()),
      code: form.code.trim(),
      name: form.name.trim(),
      stock: Number(form.stock),
      unit: form.unit,
      category: form.category,
    };
    setMaterials((prev) => [...prev, next]);
    setOpen(false);
    setForm({ code: "", name: "", stock: "", unit: "", category: "" });
    setErrors({});
  }

  function handleClose() {
    setOpen(false);
    setForm({ code: "", name: "", stock: "", unit: "", category: "" });
    setErrors({});
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 mb-2">
            Stock en CL2
          </h1>
          <p className="text-slate-600">
            Listado completo de materiales disponibles en depósito
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nuevo material
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por código o nombre de material"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-slate-900">
            Materiales disponibles{" "}
            <span className="text-slate-400 font-normal text-base">({filtered.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Unidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-slate-400 py-8">
                      No se encontraron materiales
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((material) => (
                    <TableRow key={material.id}>
                      <TableCell className="font-mono text-sm">{material.code}</TableCell>
                      <TableCell className="font-medium">{material.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{material.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{material.stock}</TableCell>
                      <TableCell>{material.unit}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar nuevo material</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="code">Código</Label>
                <Input
                  id="code"
                  placeholder="Ej: Código 006"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                />
                {errors.code && <p className="text-xs text-red-500">{errors.code}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  placeholder="Ej: Material 6"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
                {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="stock">Stock inicial</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.stock}
                  onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                />
                {errors.stock && <p className="text-xs text-red-500">{errors.stock}</p>}
              </div>
              <div className="space-y-1">
                <Label>Unidad</Label>
                <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.unit && <p className="text-xs text-red-500">{errors.unit}</p>}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Categoría</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-red-500">{errors.category}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button onClick={handleAdd}>Agregar material</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
