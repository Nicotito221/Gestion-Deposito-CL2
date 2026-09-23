import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  Star,
  Truck,
} from "lucide-react";

const weeklyOrders = [
  { day: "Lun", pendiente: 4, preparacion: 6, completo: 8 },
  { day: "Mar", pendiente: 3, preparacion: 5, completo: 10 },
  { day: "Mié", pendiente: 6, preparacion: 7, completo: 7 },
  { day: "Jue", pendiente: 2, preparacion: 4, completo: 12 },
  { day: "Vie", pendiente: 5, preparacion: 8, completo: 9 },
  { day: "Sáb", pendiente: 1, preparacion: 2, completo: 5 },
  { day: "Hoy", pendiente: 5, preparacion: 3, completo: 8 },
];

const fillRateTrend = [
  { week: "Sem 1", value: 88 },
  { week: "Sem 2", value: 91 },
  { week: "Sem 3", value: 89 },
  { week: "Sem 4", value: 93 },
  { week: "Sem 5", value: 90 },
  { week: "Sem 6", value: 94 },
];

const stockStatus = [
  { name: "Normal", value: 18, color: "#22c55e" },
  { name: "Bajo", value: 4, color: "#f59e0b" },
  { name: "Crítico", value: 2, color: "#ef4444" },
];

const supplierScores = [
  { name: "Dist. Central", score: 94 },
  { name: "Mat. del Sur", score: 91 },
  { name: "Química Norte", score: 79 },
  { name: "Sums. del Norte", score: 61 },
];

const kpis = [
  {
    label: "Fill Rate",
    value: "94%",
    target: "95%",
    trend: "up",
    delta: "+2% vs sem anterior",
    icon: <CheckCircle2 className="w-5 h-5 text-slate-400" />,
    ok: true,
  },
  {
    label: "Lead Time promedio",
    value: "3.2 hs",
    target: "< 4 hs",
    trend: "up",
    delta: "-0.4 hs vs sem anterior",
    icon: <Clock className="w-5 h-5 text-slate-400" />,
    ok: true,
  },
  {
    label: "Pedidos demorados",
    value: "7%",
    target: "< 5%",
    trend: "down",
    delta: "+2% vs sem anterior",
    icon: <AlertCircle className="w-5 h-5 text-slate-400" />,
    ok: false,
  },
  {
    label: "Exactitud de stock",
    value: "96%",
    target: "98%",
    trend: "up",
    delta: "+1% vs sem anterior",
    icon: <Package className="w-5 h-5 text-slate-400" />,
    ok: false,
  },
  {
    label: "Score prov. promedio",
    value: "81",
    target: "> 85",
    trend: "up",
    delta: "+3 vs mes anterior",
    icon: <Star className="w-5 h-5 text-slate-400" />,
    ok: false,
  },
  {
    label: "Tasa de rechazo",
    value: "1.8%",
    target: "< 2%",
    trend: "up",
    delta: "-0.4% vs mes anterior",
    icon: <Truck className="w-5 h-5 text-slate-400" />,
    ok: true,
  },
];

const criticalStock = [
  { name: "Material 4", stock: 8, unit: "LT", min: 20 },
  { name: "Material 7", stock: 0, unit: "UN", min: 15 },
];

const topDelayed = [
  { number: "000148", sector: "PC", hours: 5.2 },
  { number: "000145", sector: "Despacho", hours: 3.8 },
  { number: "000143", sector: "CL2", hours: 2.9 },
];

export function ExecutiveDashboard() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900 mb-2">Dashboard ejecutivo</h1>
        <p className="text-slate-600">
          KPIs consolidados · Semana del {new Date().toLocaleDateString("es-AR")}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className={!kpi.ok ? "border-red-200 bg-red-50/30" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-slate-600">{kpi.label}</CardTitle>
              {kpi.icon}
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <div className={`text-2xl font-bold ${kpi.ok ? "text-slate-900" : "text-red-600"}`}>
                  {kpi.value}
                </div>
                {kpi.trend === "up" ? (
                  <TrendingUp className={`w-4 h-4 mb-1 ${kpi.ok ? "text-green-500" : "text-red-400"}`} />
                ) : (
                  <TrendingDown className="w-4 h-4 mb-1 text-red-500" />
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Meta: {kpi.target}</p>
              <p className="text-xs text-slate-500 mt-1">{kpi.delta}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Pedidos por día */}
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-900">Pedidos por día — última semana</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyOrders} barSize={12}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <Tooltip
                  contentStyle={{ border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px" }}
                />
                <Bar dataKey="pendiente" name="Pendiente" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="preparacion" name="En preparación" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completo" name="Completo" fill="#86efac" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 justify-center">
              {[{ color: "#cbd5e1", label: "Pendiente" }, { color: "#93c5fd", label: "En preparación" }, { color: "#86efac", label: "Completo" }].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <div className="w-3 h-3 rounded" style={{ background: l.color }} />
                  {l.label}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Fill rate trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-900">Fill Rate — últimas 6 semanas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={fillRateTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <YAxis domain={[80, 100]} tick={{ fontSize: 12, fill: "#94a3b8" }} unit="%" />
                <Tooltip
                  contentStyle={{ border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v) => [`${v}%`, "Fill Rate"]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#0f172a"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#0f172a" }}
                />
                {/* Meta line */}
                <Line
                  type="monotone"
                  data={fillRateTrend.map((d) => ({ ...d, target: 95 }))}
                  dataKey="target"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Meta (95%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Estado de stock */}
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-900">Estado de stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={stockStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {stockStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {stockStatus.map((s) => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                    <span className="text-slate-700">{s.name}</span>
                  </div>
                  <span className="font-semibold text-slate-900">{s.value} materiales</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Ranking proveedores */}
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-900">Ranking de proveedores</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={supplierScores} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} unit="%" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#64748b" }} width={90} />
                <Tooltip
                  contentStyle={{ border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v) => [`${v} pts`, "Score"]}
                />
                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                  {supplierScores.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.score >= 90 ? "#22c55e" : entry.score >= 75 ? "#f59e0b" : "#ef4444"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tablas de acción */}
        <div className="space-y-4">
          {/* Stock crítico */}
          <Card className="border-red-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-slate-900 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                Stock crítico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {criticalStock.map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-2.5 bg-red-50 rounded-lg border border-red-200">
                    <span className="text-sm font-medium text-red-900">{item.name}</span>
                    <div className="text-right">
                      <Badge className="bg-red-100 text-red-700" variant="outline">
                        {item.stock} {item.unit}
                      </Badge>
                      <p className="text-xs text-red-500 mt-0.5">Mín: {item.min} {item.unit}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pedidos más demorados */}
          <Card className="border-amber-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-slate-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Pedidos más demorados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topDelayed.map((item) => (
                  <div key={item.number} className="flex items-center justify-between p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                    <div>
                      <span className="text-sm font-semibold text-slate-900 font-mono">#{item.number}</span>
                      <p className="text-xs text-slate-500">{item.sector}</p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-700" variant="outline">
                      {item.hours} hs
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
