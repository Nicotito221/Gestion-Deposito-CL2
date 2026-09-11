import { useState } from "react";
import { formatDate } from "../components/ui/format";
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
  DialogFooter,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Search,
  AlertCircle,
  TrendingDown,
  Plus,
  ArrowUpCircle,
  ArrowDownCircle,
  Minus,
  RefreshCw,
  Upload,
  CheckCircle2,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface StockItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  category: string;
  stockInicial: number;
  ingresos: number;
  consumos: number;
  stockTeorico: number;
  stockReal: number;
}

interface Movement {
  id: string;
  date: string;
  material: string;
  type: "ingreso" | "egreso" | "ajuste";
  quantity: number;
  unit: string;
  user: string;
  reason: string;
}

const stockItems: StockItem[] = [
  { id: "1", code: "Código 001", name: "Material 1", unit: "UN", category: "Insumos", stockInicial: 180, ingresos: 50, consumos: 78, stockTeorico: 152, stockReal: 152 },
  { id: "2", code: "Código 002", name: "Material 2", unit: "KG", category: "Materia Prima", stockInicial: 100, ingresos: 20, consumos: 45, stockTeorico: 75, stockReal: 75 },
  { id: "3", code: "Código 003", name: "Material 3", unit: "MT", category: "Insumos", stockInicial: 250, ingresos: 0, consumos: 55, stockTeorico: 195, stockReal: 190 },
  { id: "4", code: "Código 004", name: "Material 4", unit: "LT", category: "Químicos", stockInicial: 60, ingresos: 0, consumos: 52, stockTeorico: 8, stockReal: 8 },
  { id: "5", code: "Código 005", name: "Material 5", unit: "UN", category: "Herramientas", stockInicial: 320, ingresos: 10, consumos: 32, stockTeorico: 298, stockReal: 296 },
  { id: "6", code: "Código 006", name: "Material 6", unit: "KG", category: "Materia Prima", stockInicial: 140, ingresos: 30, consumos: 52, stockTeorico: 118, stockReal: 118 },
];

const movements: Movement[] = [
  { id: "1", date: "29/06/2026 10:45", material: "Material 1", type: "ingreso", quantity: 50, unit: "UN", user: "Carlos", reason: "Ingreso proveedor RI-2341" },
  { id: "2", date: "29/06/2026 09:15", material: "Material 3", type: "egreso", quantity: 25, unit: "MT", user: "Nicolás", reason: "Pedido #000153" },
  { id: "3", date: "28/06/2026 16:30", material: "Material 1", type: "egreso", quantity: 30, unit: "UN", user: "Nicolás", reason: "Pedido #000152" },
  { id: "4", date: "28/06/2026 14:00", material: "Material 2", type: "ingreso", quantity: 20, unit: "KG", user: "Carlos", reason: "Ingreso proveedor RI-2340" },
  { id: "5", date: "28/06/2026 11:20", material: "Material 5", type: "ajuste", quantity: -2, unit: "UN", user: "Supervisor", reason: "Diferencia de conteo" },
  { id: "6", date: "27/06/2026 15:00", material: "Material 3", type: "egreso", quantity: 30, unit: "MT", user: "Juan", reason: "Pedido #000149" },
  { id: "7", date: "27/06/2026 09:00", material: "Material 6", type: "ingreso", quantity: 30, unit: "KG", user: "Carlos", reason: "Ingreso proveedor RI-2339" },
];

type DesvioStatus = "ok" | "minor" | "critical";

function getDesvioStatus(teorico: number, real: number): DesvioStatus {
  const abs = Math.abs(real - teorico);
  if (abs === 0) return "ok";
  if (abs <= 5) return "minor";
  return "critical";
}

const desvioConfig: Record<DesvioStatus, { label: string; color: string }> = {
  ok: { label: "Correcto", color: "bg-green-100 text-green-700" },
  minor: { label: "Dif. menor", color: "bg-amber-100 text-amber-700" },
  critical: { label: "Dif. crítica", color: "bg-red-100 text-red-700" },
};

export function Stock() {
  const [search, setSearch] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ material: "", quantity: "", reason: "", type: "ajuste" });
  const [syncing, setSyncing] = useState(false);

  const filtered = stockItems.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.code.toLowerCase().includes(search.toLowerCase())
  );

  const criticalItems = stockItems.filter((i) => i.stockReal < 20);
  const itemsWithDiff = stockItems.filter((i) => i.stockTeorico !== i.stockReal);

  const getMovementIcon = (type: Movement["type"]) => {
    if (type === "ingreso") return <ArrowUpCircle className="w-4 h-4 text-green-500" />;
    if (type === "egreso") return <ArrowDownCircle className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-blue-500" />;
  };

  const getMovementBadge = (type: Movement["type"]) => {
    if (type === "ingreso") return <Badge className="bg-green-100 text-green-700" variant="outline">Ingreso</Badge>;
    if (type === "egreso") return <Badge className="bg-red-100 text-red-700" variant="outline">Egreso</Badge>;
    return <Badge className="bg-blue-100 text-blue-700" variant="outline">Ajuste</Badge>;
  };

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => { setSyncing(false); toast.success("Datos actualizados"); }, 1500);
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 mb-2">Gestión de stock</h1>
          <p className="text-slate-600">Control de movimientos, fórmulas y sincronización</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.success("Seleccione el archivo Excel")}>
            <Upload className="w-4 h-4 mr-2" />
            Importar Excel
          </Button>
          <Button size="sm" onClick={() => setAdjustOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Registrar ajuste
          </Button>
        </div>
      </div>

      {/* Estado de sincronización */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-2 border-slate-900 bg-slate-900 text-white">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white/60 text-xs">Producción vigente</p>
                <p className="font-bold text-white">Semana 28 · 2026</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-slate-500 text-xs">Última importación</p>
                <p className="font-semibold text-slate-900">29/06/2026 · 08:30</p>
                <Badge className="bg-green-100 text-green-700 mt-1 text-xs" variant="outline">Sincronizado</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                <strong>Excel es la fuente oficial.</strong> El sistema importa materiales, estructura
                de producción y fórmulas periódicamente.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total en sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{stockItems.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Con diferencias</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{itemsWithDiff.length}</div>
            <p className="text-xs text-slate-500 mt-1">Teórico ≠ real</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Stock crítico</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalItems.length}</div>
            <p className="text-xs text-slate-500 mt-1">Requieren reposición</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="stock">
        <TabsList className="mb-6">
          <TabsTrigger value="stock">Stock teórico vs real</TabsTrigger>
          <TabsTrigger value="movimientos">Historial de movimientos</TabsTrigger>
          <TabsTrigger value="arrastre">Arrastre diario</TabsTrigger>
        </TabsList>

        {/* Stock teórico vs real */}
        <TabsContent value="stock">
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Buscar material..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
            </CardContent>
          </Card>

          {/* Fórmula visual */}
          <Card className="mb-4 bg-slate-50 border-slate-200">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-6 flex-wrap">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cálculo del stock teórico</p>
                  <div className="flex items-center gap-2 text-sm font-mono flex-wrap">
                    <span className="font-bold text-slate-900">Stock Inicial</span>
                    <span className="text-green-600 font-bold">+ Ingresos</span>
                    <span className="text-red-600 font-bold">− Consumos</span>
                    <span className="text-slate-400">=</span>
                    <span className="font-bold text-slate-900 bg-slate-200 px-2 py-0.5 rounded">Stock Teórico</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Comparación</p>
                  <div className="flex items-center gap-2 text-sm font-mono flex-wrap">
                    <span className="font-bold text-slate-900">Stock Teórico</span>
                    <span className="text-slate-400">vs</span>
                    <span className="font-bold text-slate-900">Conteo Físico</span>
                    <span className="text-slate-400">=</span>
                    <span className="font-bold text-slate-900 bg-slate-200 px-2 py-0.5 rounded">Desvío</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Estado</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-green-100 text-green-700" variant="outline">Correcto · = 0</Badge>
                    <Badge className="bg-amber-100 text-amber-700" variant="outline">Dif. menor · 1-5</Badge>
                    <Badge className="bg-red-100 text-red-700" variant="outline">Dif. crítica · &gt;5</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-slate-900">Comparativo de stock ({filtered.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-center">Stock teórico</TableHead>
                      <TableHead className="text-center">Conteo físico</TableHead>
                      <TableHead className="text-center">Desvío</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((item) => {
                      const diff = item.stockReal - item.stockTeorico;
                      const status = getDesvioStatus(item.stockTeorico, item.stockReal);
                      const cfg = desvioConfig[status];
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-slate-900">{item.name}</p>
                              <p className="text-xs text-slate-400 font-mono">{item.code}</p>
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
                          <TableCell className="text-center font-semibold text-slate-600">
                            {item.stockTeorico} {item.unit}
                          </TableCell>
                          <TableCell className="text-center font-bold text-slate-900">
                            {item.stockReal} {item.unit}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-bold ${diff === 0 ? "text-green-600" : Math.abs(diff) <= 5 ? "text-amber-600" : "text-red-600"}`}>
                              {diff > 0 ? "+" : ""}{diff} {item.unit}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge className={cfg.color} variant="outline">{cfg.label}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Movimientos */}
        <TabsContent value="movimientos">
          <Card>
            <CardHeader><CardTitle className="text-slate-900">Historial de movimientos</CardTitle></CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha y hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-center">Cantidad</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell className="text-sm font-mono text-slate-600">{mov.date}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getMovementIcon(mov.type)}
                            {getMovementBadge(mov.type)}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{mov.material}</TableCell>
                        <TableCell className="text-center">
                          <span className={`font-semibold ${mov.type === "ingreso" ? "text-green-700" : mov.type === "egreso" ? "text-red-700" : "text-blue-700"}`}>
                            {mov.type === "ingreso" ? "+" : ""}{mov.quantity} {mov.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-700">{mov.user}</TableCell>
                        <TableCell className="text-slate-600 text-sm">{mov.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Arrastre diario */}
        <TabsContent value="arrastre">
          <Card className="mb-4 bg-slate-50 border-slate-200">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm font-mono font-semibold">
                  <span className="bg-white border border-slate-200 px-2 py-1 rounded text-slate-700">Stock Inicial</span>
                  <span className="text-green-600">+ Ingresos</span>
                  <span className="text-red-600">− Consumos</span>
                  <span className="text-slate-400">=</span>
                  <span className="bg-slate-900 text-white px-2 py-1 rounded">Stock Final</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-slate-900">
                Arrastre de stock · {formatDate(new Date().toLocaleDateString("es-AR").split("/").map((p, i) => p.padStart(2,"0")).join("/"))}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-center bg-slate-50">Stock inicial</TableHead>
                      <TableHead className="text-center bg-green-50">+ Ingresos</TableHead>
                      <TableHead className="text-center bg-red-50">− Consumos</TableHead>
                      <TableHead className="text-center font-semibold">= Stock final</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p className="font-medium text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-400">{item.unit}</p>
                        </TableCell>
                        <TableCell className="text-center bg-slate-50/50 text-slate-700 font-semibold">{item.stockInicial}</TableCell>
                        <TableCell className="text-center bg-green-50/50">
                          <span className="text-green-700 font-semibold">+{item.ingresos}</span>
                        </TableCell>
                        <TableCell className="text-center bg-red-50/50">
                          <span className="text-red-700 font-semibold">−{item.consumos}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-bold text-xl ${item.stockTeorico < 20 ? "text-red-600" : "text-slate-900"}`}>
                            {item.stockTeorico}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog ajuste */}
      <Dialog open={adjustOpen} onOpenChange={(v) => { if (!v) setAdjustOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Registrar ajuste de stock</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Material</Label>
              <Select value={adjustForm.material} onValueChange={(v) => setAdjustForm((f) => ({ ...f, material: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar material" /></SelectTrigger>
                <SelectContent>
                  {stockItems.map((i) => (<SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={adjustForm.type} onValueChange={(v) => setAdjustForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ingreso">Ingreso</SelectItem>
                    <SelectItem value="egreso">Egreso</SelectItem>
                    <SelectItem value="ajuste">Ajuste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Cantidad</Label>
                <Input type="number" placeholder="0" value={adjustForm.quantity} onChange={(e) => setAdjustForm((f) => ({ ...f, quantity: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Motivo / Observación</Label>
              <Textarea placeholder="Describa el motivo del ajuste..." value={adjustForm.reason} onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancelar</Button>
            <Button onClick={() => { setAdjustOpen(false); toast.success("Ajuste registrado correctamente"); }}>
              Registrar ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
