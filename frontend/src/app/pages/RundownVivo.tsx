import { useState } from "react";
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
  Upload,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  BarChart2,
  ShoppingCart,
  Info,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface RundownRow {
  id: string;
  code: string;
  name: string;
  stockInicial: number;
  conteoFisico: number | null;
  consumoEstimado: number;
  produccionSiguiente: number;
  cantidadSugerida: number;
  unit: string;
}

const initialRundown: RundownRow[] = [
  { id: "1", code: "Código 001", name: "Material 1", stockInicial: 152, conteoFisico: null, consumoEstimado: 40, produccionSiguiente: 180, cantidadSugerida: 68, unit: "UN" },
  { id: "2", code: "Código 002", name: "Material 2", stockInicial: 75, conteoFisico: null, consumoEstimado: 20, produccionSiguiente: 90, cantidadSugerida: 35, unit: "KG" },
  { id: "3", code: "Código 003", name: "Material 3", stockInicial: 195, conteoFisico: null, consumoEstimado: 50, produccionSiguiente: 200, cantidadSugerida: 55, unit: "MT" },
  { id: "4", code: "Código 004", name: "Material 4", stockInicial: 8, conteoFisico: null, consumoEstimado: 8, produccionSiguiente: 60, cantidadSugerida: 60, unit: "LT" },
  { id: "5", code: "Código 005", name: "Material 5", stockInicial: 298, conteoFisico: null, consumoEstimado: 30, produccionSiguiente: 150, cantidadSugerida: 0, unit: "UN" },
  { id: "6", code: "Código 006", name: "Material 6", stockInicial: 118, conteoFisico: null, consumoEstimado: 45, produccionSiguiente: 120, cantidadSugerida: 47, unit: "KG" },
];

// Weekly planning data per material per day
type DayKey = "lun" | "mar" | "mie" | "jue" | "vie" | "sab" | "dom";
const DAYS: { key: DayKey; label: string }[] = [
  { key: "lun", label: "Lunes" },
  { key: "mar", label: "Martes" },
  { key: "mie", label: "Miércoles" },
  { key: "jue", label: "Jueves" },
  { key: "vie", label: "Viernes" },
  { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
];

type WeekPlan = Record<DayKey, { produccion: number; consumo: number }>;
type MaterialWeekPlan = Record<string, WeekPlan>;

// Semana actual (offsetWeek=0) y semana siguiente (offsetWeek=1)
function generateWeekPlan(materialId: string, weekOffset: number): WeekPlan {
  const base: Record<string, number[]> = {
    "1": [180, 175, 190, 185, 160, 80, 0],
    "2": [90, 85, 95, 88, 78, 40, 0],
    "3": [200, 195, 205, 198, 180, 90, 0],
    "4": [60, 55, 65, 58, 50, 25, 0],
    "5": [150, 145, 155, 148, 135, 70, 0],
    "6": [120, 115, 125, 118, 108, 55, 0],
  };
  const consumoRatio = 0.22;
  const variation = weekOffset === 1 ? 1.05 : 1;
  const prods = (base[materialId] ?? [100, 100, 100, 100, 100, 50, 0]).map(
    (v) => Math.round(v * variation)
  );
  const plan: WeekPlan = {} as WeekPlan;
  DAYS.forEach(({ key }, i) => {
    plan[key] = {
      produccion: prods[i],
      consumo: Math.round(prods[i] * consumoRatio),
    };
  });
  return plan;
}

function getDesvio(row: RundownRow): number | null {
  if (row.conteoFisico === null) return null;
  return row.conteoFisico - row.stockInicial;
}

function getDesvioStatus(desvio: number | null): "none" | "ok" | "minor" | "critical" {
  if (desvio === null) return "none";
  const abs = Math.abs(desvio);
  if (abs === 0) return "ok";
  if (abs <= 5) return "minor";
  return "critical";
}

const desvioConfig = {
  none: { label: "Sin contar", color: "bg-slate-100 text-slate-500", row: "" },
  ok: { label: "Correcto", color: "bg-green-100 text-green-700", row: "" },
  minor: { label: "Dif. menor", color: "bg-amber-100 text-amber-700", row: "bg-amber-50" },
  critical: { label: "Dif. crítica", color: "bg-red-100 text-red-700", row: "bg-red-50" },
};

const LAST_SYNC = "29/06/2026 · 08:30";
const WEEK_LABELS = ["Semana 28", "Semana 29", "Semana 27", "Semana 26"];

function getStockImpactColor(stockFinal: number): string {
  if (stockFinal < 0) return "text-red-600 font-bold";
  if (stockFinal < 20) return "text-amber-600 font-semibold";
  return "text-slate-700";
}

export function RundownVivo() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RundownRow[]>(initialRundown);
  const [syncing, setSyncing] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current, 1 = next, -1 = prev

  const weekLabel = weekOffset === 0
    ? `Semana 28 — Producción vigente`
    : weekOffset > 0
    ? `Semana ${28 + weekOffset} — Próxima semana`
    : `Semana ${28 + weekOffset} — Semana anterior`;

  const handleConteoChange = (id: string, value: string) => {
    const num = value === "" ? null : Math.max(0, parseInt(value) || 0);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, conteoFisico: num } : r)));
  };

  const handleSugeridaChange = (id: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, cantidadSugerida: Math.max(0, parseInt(value) || 0) } : r))
    );
  };

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => { setSyncing(false); toast.success("Datos actualizados correctamente"); }, 1500);
  };

  const handleGenerateOrder = () => {
    const withSuggested = rows.filter((r) => r.cantidadSugerida > 0);
    if (withSuggested.length === 0) { toast.error("No hay cantidades sugeridas para generar un pedido"); return; }
    navigate("/nuevo-pedido", {
      state: {
        fromConteo: true,
        suggestedMaterials: withSuggested.map((r) => ({
          id: r.id, code: r.code, name: r.name, unit: r.unit,
          suggestedQuantity: r.cantidadSugerida, quantity: r.cantidadSugerida, observations: "",
        })),
      },
    });
  };

  const countedRows = rows.filter((r) => r.conteoFisico !== null);
  const criticalRows = countedRows.filter((r) => getDesvioStatus(getDesvio(r)) === "critical");

  // Week plan data
  const weekPlan: MaterialWeekPlan = {};
  rows.forEach((r) => { weekPlan[r.id] = generateWeekPlan(r.id, weekOffset); });

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 mb-2 flex items-center gap-3">
            <BarChart2 className="w-7 h-7" />
            Rundown
          </h1>
          <p className="text-slate-600">Seguimiento diario de stock y planificación semanal</p>
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
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-2 border-slate-900 bg-slate-900 text-white">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <BarChart2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white/60 text-xs uppercase tracking-wider">Producción cargada</p>
                <p className="font-bold text-white">Semana 28 — Producción vigente</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-slate-500 text-xs">Última importación</p>
                <p className="font-semibold text-slate-900">{LAST_SYNC}</p>
                <Badge className="bg-green-100 text-green-700 mt-1 text-xs" variant="outline">Sincronizado</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                <strong>Excel es la fuente oficial.</strong> El sistema importa datos periódicamente. La estructura se configura una sola vez.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {criticalRows.length > 0 && (
        <Card className="mb-4 border-red-200 bg-red-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900 text-sm">
                  {criticalRows.length} diferencia{criticalRows.length > 1 ? "s" : ""} crítica{criticalRows.length > 1 ? "s" : ""} detectada{criticalRows.length > 1 ? "s" : ""}
                </p>
                <p className="text-xs text-red-700 mt-0.5">{criticalRows.map((r) => r.name).join(", ")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leyenda */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="text-xs text-slate-500 font-medium">Desvío:</span>
        {(["ok", "minor", "critical"] as const).map((s) => (
          <Badge key={s} className={`${desvioConfig[s].color} text-xs`} variant="outline">
            {desvioConfig[s].label}
          </Badge>
        ))}
      </div>

      {/* ── TABLA RUNDOWN DIARIO ────────────────────────────────────── */}
      <Card className="mb-8">
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 border-b-2 border-slate-200">
                  <TableHead className="pl-5 font-semibold text-slate-700 whitespace-nowrap">Código</TableHead>
                  <TableHead className="font-semibold text-slate-700 whitespace-nowrap">Material</TableHead>
                  <TableHead className="text-center font-semibold text-slate-700 whitespace-nowrap bg-slate-100">Stock inicial</TableHead>
                  <TableHead className="text-center font-semibold text-slate-700 whitespace-nowrap bg-blue-50">
                    Conteo físico
                    <span className="block text-xs font-normal text-blue-500">editable</span>
                  </TableHead>
                  <TableHead className="text-center font-semibold text-slate-700 whitespace-nowrap">Desvío</TableHead>
                  <TableHead className="text-center font-semibold text-slate-700 whitespace-nowrap bg-slate-100">Consumo est.</TableHead>
                  <TableHead className="text-center font-semibold text-slate-700 whitespace-nowrap bg-slate-100">Prod. día sig.</TableHead>
                  <TableHead className="text-center font-semibold text-slate-700 whitespace-nowrap bg-amber-50">
                    Cant. sugerida
                    <span className="block text-xs font-normal text-amber-500">editable</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const desvio = getDesvio(row);
                  const status = getDesvioStatus(desvio);
                  const cfg = desvioConfig[status];
                  return (
                    <TableRow key={row.id} className={`border-b border-slate-100 ${cfg.row}`}>
                      <TableCell className="pl-5 font-mono text-xs text-slate-500 whitespace-nowrap">{row.code}</TableCell>
                      <TableCell className="font-medium text-slate-900 whitespace-nowrap">{row.name}</TableCell>
                      <TableCell className="text-center bg-slate-50/50">
                        <span className="font-semibold text-slate-700">{row.stockInicial}</span>
                        <span className="text-xs text-slate-400 ml-1">{row.unit}</span>
                      </TableCell>
                      <TableCell className="text-center bg-blue-50/40">
                        <Input
                          type="number" min="0" placeholder="—"
                          value={row.conteoFisico ?? ""}
                          onChange={(e) => handleConteoChange(row.id, e.target.value)}
                          className="w-20 mx-auto text-center font-semibold border-blue-200 focus:border-blue-400 h-8"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        {desvio === null ? (
                          <span className="text-slate-300 text-lg">—</span>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <span className={`font-bold ${desvio === 0 ? "text-green-600" : Math.abs(desvio) <= 5 ? "text-amber-600" : "text-red-600"}`}>
                              {desvio > 0 ? "+" : ""}{desvio}
                            </span>
                            <Badge className={`${cfg.color} text-xs py-0`} variant="outline">{cfg.label}</Badge>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center bg-slate-50/50">
                        <span className="font-semibold text-slate-600">{row.consumoEstimado}</span>
                        <span className="text-xs text-slate-400 ml-1">{row.unit}</span>
                      </TableCell>
                      <TableCell className="text-center bg-slate-50/50">
                        <span className="font-semibold text-slate-600">{row.produccionSiguiente}</span>
                        <span className="text-xs text-slate-400 ml-1">{row.unit}</span>
                      </TableCell>
                      <TableCell className="text-center bg-amber-50/40">
                        <Input
                          type="number" min="0"
                          value={row.cantidadSugerida}
                          onChange={(e) => handleSugeridaChange(row.id, e.target.value)}
                          className="w-20 mx-auto text-center font-bold border-amber-200 focus:border-amber-400 h-8"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── PREVISUALIZACIÓN SEMANAL ─────────────────────────────────── */}
      <div className="mb-6">
        {/* Header semanal con selector */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Previsualización de producción</h2>
            <p className="text-slate-500 text-sm mt-0.5">
              Producción programada, consumo estimado e impacto en stock por día
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset((w) => w - 1)}
              disabled={weekOffset <= -1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-48 text-center">
              <span className="text-sm font-semibold text-slate-900">{weekLabel}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset((w) => w + 1)}
              disabled={weekOffset >= 2}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {weekOffset === 0 && (
          <div className="mb-3">
            <Badge className="bg-slate-900 text-white">Semana actual</Badge>
          </div>
        )}
        {weekOffset === 1 && (
          <div className="mb-3">
            <Badge className="bg-blue-100 text-blue-700" variant="outline">Próxima semana</Badge>
          </div>
        )}

        <Card>
          <CardContent className="px-0 pb-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b-2 border-slate-200">
                    <TableHead className="pl-5 font-semibold text-slate-700 whitespace-nowrap sticky left-0 bg-slate-50 z-10">
                      Material
                    </TableHead>
                    {DAYS.map(({ key, label }) => (
                      <TableHead key={key} className="text-center font-semibold text-slate-700 whitespace-nowrap min-w-28">
                        {label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, rowIdx) => {
                    const plan = weekPlan[row.id];
                    // Calculate cumulative stock impact across week
                    let runningStock = row.stockReal ?? row.stockInicial;

                    return (
                      <TableRow key={row.id} className={rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                        <TableCell className="pl-5 sticky left-0 bg-inherit z-10 border-r border-slate-100">
                          <p className="font-medium text-slate-900 text-sm whitespace-nowrap">{row.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{row.unit}</p>
                        </TableCell>
                        {DAYS.map(({ key }) => {
                          const day = plan[key];
                          runningStock = runningStock - day.consumo;
                          const stockFinal = runningStock;
                          const isWeekend = key === "sab" || key === "dom";
                          return (
                            <TableCell
                              key={key}
                              className={`text-center align-top py-2 ${isWeekend ? "bg-slate-50" : ""}`}
                            >
                              {day.produccion > 0 ? (
                                <div className="space-y-1">
                                  <div>
                                    <p className="text-xs text-slate-400 leading-none">Prod.</p>
                                    <p className="font-semibold text-slate-800 text-sm">{day.produccion}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-400 leading-none">Consumo</p>
                                    <p className="text-sm text-red-600 font-medium">−{day.consumo}</p>
                                  </div>
                                  <div className="border-t border-slate-100 pt-1">
                                    <p className="text-xs text-slate-400 leading-none">Stock</p>
                                    <p className={`text-sm ${getStockImpactColor(stockFinal)}`}>
                                      {stockFinal}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-300 text-sm">—</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Leyenda stock impact */}
        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 flex-wrap">
          <span className="font-medium">Stock proyectado:</span>
          <div className="flex items-center gap-1"><span className="text-slate-700 font-medium">normal</span><span>≥ 20 unidades</span></div>
          <div className="flex items-center gap-1"><span className="text-amber-600 font-semibold">bajo</span><span>&lt; 20 unidades</span></div>
          <div className="flex items-center gap-1"><span className="text-red-600 font-bold">crítico</span><span>&lt; 0 — stock insuficiente</span></div>
        </div>
      </div>

      {/* Acción generar pedido */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-slate-50 border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-700 text-sm flex items-center gap-2">
              <Info className="w-4 h-4" />
              Cálculo del desvío
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex items-center gap-3">
                <span className="w-4 text-slate-400"> </span>
                <span className="text-slate-700">Conteo físico</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-4 text-red-500 text-center">−</span>
                <span className="text-slate-700">Stock inicial del día</span>
              </div>
              <div className="border-t border-slate-300 pt-2 flex items-center gap-3">
                <span className="w-4 text-slate-900 text-center font-bold">=</span>
                <span className="font-bold text-slate-900">Desvío</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-900 text-sm">Generar pedido desde Rundown</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-4">
              Las cantidades sugeridas consideran la producción del día siguiente. Revisalas antes de generar el pedido.
            </p>
            <div className="flex items-center justify-between mb-4 text-sm">
              <span className="text-slate-500">Materiales con cantidad &gt; 0</span>
              <Badge variant="outline">{rows.filter((r) => r.cantidadSugerida > 0).length}</Badge>
            </div>
            <Button className="w-full" onClick={handleGenerateOrder}>
              <ShoppingCart className="w-4 h-4 mr-2" />
              Generar Pedido Sugerido
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
