import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Progress } from "../components/ui/progress";
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
  Search,
  Star,
  ArrowLeft,
  Truck,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Package,
} from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  cuit: string;
  category: string;
  score: number;
  deliveries: number;
  compliance: number;
  punctuality: number;
  quality: number;
  quantityAccuracy: number;
  lastDelivery: string;
  status: "activo" | "suspendido";
}

interface Delivery {
  id: string;
  supplierId: string;
  date: string;
  materials: string;
  ordered: number;
  received: number;
  unit: string;
  punctuality: "on-time" | "late" | "early";
  quality: "buena" | "regular" | "rechazada";
  notes: string;
}

const suppliers: Supplier[] = [
  {
    id: "1",
    name: "Distribuidora Central S.A.",
    cuit: "30-71234567-8",
    category: "Insumos",
    score: 94,
    deliveries: 32,
    compliance: 97,
    punctuality: 94,
    quality: 98,
    quantityAccuracy: 96,
    lastDelivery: "28/06/2026",
    status: "activo",
  },
  {
    id: "2",
    name: "Química del Norte S.R.L.",
    cuit: "30-68901234-5",
    category: "Químicos",
    score: 79,
    deliveries: 18,
    compliance: 78,
    punctuality: 72,
    quality: 89,
    quantityAccuracy: 81,
    lastDelivery: "25/06/2026",
    status: "activo",
  },
  {
    id: "3",
    name: "Materiales del Sur S.A.",
    cuit: "30-70456789-1",
    category: "Materia Prima",
    score: 91,
    deliveries: 24,
    compliance: 92,
    punctuality: 90,
    quality: 94,
    quantityAccuracy: 88,
    lastDelivery: "29/06/2026",
    status: "activo",
  },
  {
    id: "4",
    name: "Suministros del Norte",
    cuit: "20-35678901-4",
    category: "Herramientas",
    score: 61,
    deliveries: 9,
    compliance: 56,
    punctuality: 67,
    quality: 72,
    quantityAccuracy: 60,
    lastDelivery: "20/06/2026",
    status: "activo",
  },
];

const deliveries: Delivery[] = [
  { id: "1", supplierId: "1", date: "28/06/2026", materials: "Material 1, Material 5", ordered: 100, received: 100, unit: "UN", punctuality: "on-time", quality: "buena", notes: "" },
  { id: "2", supplierId: "1", date: "20/06/2026", materials: "Material 1", ordered: 50, received: 48, unit: "UN", punctuality: "on-time", quality: "buena", notes: "Faltaron 2 unidades" },
  { id: "3", supplierId: "2", date: "25/06/2026", materials: "Material 4", ordered: 30, received: 30, unit: "LT", punctuality: "late", quality: "regular", notes: "Entregado con 2 días de demora" },
  { id: "4", supplierId: "3", date: "29/06/2026", materials: "Material 2, Material 6", ordered: 80, received: 80, unit: "KG", punctuality: "on-time", quality: "buena", notes: "" },
  { id: "5", supplierId: "4", date: "20/06/2026", materials: "Material 5", ordered: 20, received: 12, unit: "UN", punctuality: "late", quality: "regular", notes: "Entrega parcial, calidad aceptable" },
];

function getScoreColor(score: number) {
  if (score >= 90) return "text-green-600";
  if (score >= 75) return "text-amber-600";
  return "text-red-600";
}

function getScoreBadge(score: number) {
  if (score >= 90) return <Badge className="bg-green-100 text-green-700" variant="outline">Excelente</Badge>;
  if (score >= 75) return <Badge className="bg-amber-100 text-amber-700" variant="outline">Regular</Badge>;
  return <Badge className="bg-red-100 text-red-700" variant="outline">Deficiente</Badge>;
}

function getPunctualityBadge(p: Delivery["punctuality"]) {
  if (p === "on-time") return <Badge className="bg-green-100 text-green-700" variant="outline"><Clock className="w-3 h-3 mr-1" />A tiempo</Badge>;
  if (p === "early") return <Badge className="bg-blue-100 text-blue-700" variant="outline">Anticipada</Badge>;
  return <Badge className="bg-red-100 text-red-700" variant="outline"><AlertCircle className="w-3 h-3 mr-1" />Demorada</Badge>;
}

function getQualityBadge(q: Delivery["quality"]) {
  if (q === "buena") return <Badge className="bg-green-100 text-green-700" variant="outline"><CheckCircle2 className="w-3 h-3 mr-1" />Buena</Badge>;
  if (q === "regular") return <Badge className="bg-amber-100 text-amber-700" variant="outline">Regular</Badge>;
  return <Badge className="bg-red-100 text-red-700" variant="outline">Rechazada</Badge>;
}

export function Suppliers() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase())
  );

  const selected = suppliers.find((s) => s.id === selectedId);
  const supplierDeliveries = deliveries.filter((d) => d.supplierId === selectedId);

  const sortedByScore = [...suppliers].sort((a, b) => b.score - a.score);

  if (selectedId && selected) {
    return (
      <div className="p-8">
        <Button
          variant="ghost"
          onClick={() => setSelectedId(null)}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a proveedores
        </Button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 mb-1">{selected.name}</h1>
            <p className="text-slate-500 font-mono text-sm">CUIT: {selected.cuit} · {selected.category}</p>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${getScoreColor(selected.score)}`}>{selected.score}</div>
            <div className="flex justify-end mt-1">{getScoreBadge(selected.score)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Métricas */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-slate-900">Métricas de desempeño</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {[
                  { label: "Cumplimiento de entrega", value: selected.compliance, icon: <CheckCircle2 className="w-4 h-4 text-slate-400" /> },
                  { label: "Puntualidad", value: selected.punctuality, icon: <Clock className="w-4 h-4 text-slate-400" /> },
                  { label: "Calidad de entrega", value: selected.quality, icon: <Star className="w-4 h-4 text-slate-400" /> },
                  { label: "Exactitud de cantidades", value: selected.quantityAccuracy, icon: <Package className="w-4 h-4 text-slate-400" /> },
                ].map((metric) => (
                  <div key={metric.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {metric.icon}
                        <span className="text-sm text-slate-700">{metric.label}</span>
                      </div>
                      <span className={`font-bold ${getScoreColor(metric.value)}`}>{metric.value}%</span>
                    </div>
                    <Progress value={metric.value} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Historial de entregas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-slate-900">Historial de entregas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Materiales</TableHead>
                        <TableHead className="text-center">Pedido</TableHead>
                        <TableHead className="text-center">Recibido</TableHead>
                        <TableHead>Puntualidad</TableHead>
                        <TableHead>Calidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierDeliveries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                            Sin entregas registradas
                          </TableCell>
                        </TableRow>
                      ) : (
                        supplierDeliveries.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="font-mono text-sm">{d.date}</TableCell>
                            <TableCell className="text-sm">{d.materials}</TableCell>
                            <TableCell className="text-center font-semibold">{d.ordered} {d.unit}</TableCell>
                            <TableCell className="text-center">
                              <span className={d.received === d.ordered ? "text-green-700 font-semibold" : "text-amber-700 font-semibold"}>
                                {d.received} {d.unit}
                              </span>
                            </TableCell>
                            <TableCell>{getPunctualityBadge(d.punctuality)}</TableCell>
                            <TableCell>{getQualityBadge(d.quality)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar info */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-slate-900">Resumen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total entregas</p>
                    <p className="font-bold text-slate-900">{selected.deliveries}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Última entrega</p>
                    <p className="font-bold text-slate-900">{selected.lastDelivery}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Package className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Categoría</p>
                    <p className="font-bold text-slate-900">{selected.category}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className={selected.score < 70 ? "border-red-200 bg-red-50" : selected.score < 85 ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}
            >
              <CardContent className="pt-6">
                <div className="flex gap-2">
                  {selected.score < 70 ? (
                    <TrendingDown className="w-5 h-5 text-red-500 flex-shrink-0" />
                  ) : (
                    <TrendingUp className="w-5 h-5 text-green-500 flex-shrink-0" />
                  )}
                  <div>
                    <p className={`font-semibold mb-1 ${selected.score < 70 ? "text-red-900" : selected.score < 85 ? "text-amber-900" : "text-green-900"}`}>
                      {selected.score >= 90 ? "Proveedor confiable" : selected.score >= 75 ? "Desempeño moderado" : "Requiere atención"}
                    </p>
                    <p className={`text-sm ${selected.score < 70 ? "text-red-800" : selected.score < 85 ? "text-amber-800" : "text-green-800"}`}>
                      {selected.score < 70
                        ? "Se recomienda revisar términos contractuales."
                        : selected.score < 85
                        ? "Existe margen de mejora en puntualidad."
                        : "Historial consistente de entregas correctas."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900 mb-2">Gestión de proveedores</h1>
        <p className="text-slate-600">Listado, historial y métricas de desempeño</p>
      </div>

      <Tabs defaultValue="listado">
        <TabsList className="mb-6">
          <TabsTrigger value="listado">Listado</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
        </TabsList>

        <TabsContent value="listado">
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar proveedor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-slate-900">Proveedores ({filtered.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-center">Score</TableHead>
                      <TableHead className="text-center">Entregas</TableHead>
                      <TableHead>Última entrega</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-900">{s.name}</p>
                            <p className="text-xs text-slate-400 font-mono">{s.cuit}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{s.category}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`font-bold text-lg ${getScoreColor(s.score)}`}>{s.score}</span>
                            {getScoreBadge(s.score)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">{s.deliveries}</TableCell>
                        <TableCell className="text-slate-600 text-sm">{s.lastDelivery}</TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-700" variant="outline">Activo</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedId(s.id)}
                          >
                            Ver perfil
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ranking">
          <div className="space-y-4">
            {sortedByScore.map((s, index) => (
              <Card key={s.id} className={index === 0 ? "border-2 border-green-300" : ""}>
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0 ${
                        index === 0 ? "bg-yellow-100 text-yellow-700" :
                        index === 1 ? "bg-slate-100 text-slate-600" :
                        index === 2 ? "bg-orange-100 text-orange-700" :
                        "bg-slate-50 text-slate-400"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-slate-900">{s.name}</p>
                        <Badge variant="outline" className="text-xs">{s.category}</Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-3 mt-2">
                        {[
                          { label: "Cumplimiento", value: s.compliance },
                          { label: "Puntualidad", value: s.punctuality },
                          { label: "Calidad", value: s.quality },
                          { label: "Exactitud", value: s.quantityAccuracy },
                        ].map((m) => (
                          <div key={m.label}>
                            <p className="text-xs text-slate-500 mb-1">{m.label}</p>
                            <Progress value={m.value} className="h-1.5" />
                            <p className="text-xs font-semibold text-slate-700 mt-0.5">{m.value}%</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-3xl font-bold ${getScoreColor(s.score)}`}>{s.score}</div>
                      <div className="mt-1">{getScoreBadge(s.score)}</div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => setSelectedId(s.id)}
                      >
                        Ver detalle
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
