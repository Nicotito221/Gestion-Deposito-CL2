import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { formatDate, formatDateLong } from "../components/ui/format";
import {
  FilePlus,
  Warehouse,
  TrendingUp,
  Clock,
  Package,
  Truck,
  CheckCircle2,
  ArrowRight,
  ClipboardList,
  Layers,
} from "lucide-react";

const recentOrders = [
  { number: "000154", sector: "Producción", status: "pendiente", priority: "urgente", date: "10/06/2026" },
  { number: "000153", sector: "Mantenimiento", status: "en-preparacion", priority: "normal", date: "10/06/2026" },
  { number: "000152", sector: "Administración", status: "parcial", priority: "normal", date: "09/06/2026" },
  { number: "000151", sector: "Logística", status: "completo", priority: "normal", date: "09/06/2026" },
];

const statusConfig = {
  pendiente: { label: "Pendiente", color: "bg-slate-100 text-slate-700" },
  "en-preparacion": { label: "En preparación", color: "bg-blue-100 text-blue-700" },
  parcial: { label: "Parcial", color: "bg-amber-100 text-amber-700" },
  completo: { label: "Completo", color: "bg-green-100 text-green-700" },
};

export function Home() {
  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-1">
          Bienvenido, Nicolás
        </h1>
        <p className="text-slate-600 text-sm capitalize">{formatDateLong()}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-600">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">5</div>
            <p className="text-xs text-amber-600 mt-1 font-medium">Requieren atención</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-600">En preparación</CardTitle>
            <Warehouse className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">3</div>
            <p className="text-xs text-blue-600 mt-1 font-medium">En proceso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-600">Completados hoy</CardTitle>
            <TrendingUp className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">8</div>
            <p className="text-xs text-green-600 mt-1 font-medium">+2 vs ayer</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-600">Stock crítico</CardTitle>
            <Package className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">2</div>
            <p className="text-xs text-red-500 mt-1 font-medium">Materiales bajos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-600">Ingresos del día</CardTitle>
            <Truck className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">3</div>
            <p className="text-xs text-slate-500 mt-1">Recepciones</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-600">Entregas pend.</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">4</div>
            <p className="text-xs text-slate-500 mt-1">Sin confirmar</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Pedidos recientes */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-slate-900">Pedidos recientes</CardTitle>
              <Link to="/deposito">
                <Button variant="ghost" size="sm" className="text-slate-600">
                  Ver todos
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {recentOrders.map((order) => {
                  const cfg = statusConfig[order.status as keyof typeof statusConfig];
                  return (
                    <div
                      key={order.number}
                      className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0 gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-slate-900 text-sm flex-shrink-0">
                          #{order.number}
                        </span>
                        <span className="text-sm text-slate-600 hidden sm:inline truncate">{order.sector}</span>
                        {order.priority === "urgente" && (
                          <Badge variant="destructive" className="text-xs flex-shrink-0">Urgente</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-slate-400 hidden sm:inline">{formatDate(order.date)}</span>
                        <Badge className={`${cfg.color} text-xs`} variant="outline">
                          {cfg.label}
                        </Badge>
                        <Link to={`/deposito/preparacion/${order.number}`}>
                          <Button variant="outline" size="sm">Ver</Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Acciones rápidas + Fill rate */}
        <div className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-slate-900">Acciones rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/nuevo-pedido">
                <Button className="w-full justify-start" size="lg">
                  <FilePlus className="w-5 h-5 mr-3" />
                  Crear nuevo pedido
                </Button>
              </Link>
              <Link to="/deposito">
                <Button variant="outline" className="w-full justify-start" size="lg">
                  <Warehouse className="w-5 h-5 mr-3" />
                  Ver pedidos depósito
                </Button>
              </Link>
              <Link to="/conteo">
                <Button variant="outline" className="w-full justify-start" size="lg">
                  <ClipboardList className="w-5 h-5 mr-3" />
                  Conteo de planta
                </Button>
              </Link>
              <Link to="/stock">
                <Button variant="outline" className="w-full justify-start" size="lg">
                  <Layers className="w-5 h-5 mr-3" />
                  Gestión de stock
                </Button>
              </Link>
              <Link to="/remitos">
                <Button variant="outline" className="w-full justify-start" size="lg">
                  Ver remitos
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-slate-900">Fill rate hoy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-2">
                <div className="text-4xl font-bold text-slate-900 mb-1">94%</div>
                <p className="text-sm text-slate-500 mb-4">Ítems entregados vs solicitados</p>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div className="bg-green-500 h-3 rounded-full" style={{ width: "94%" }} />
                </div>
                <p className="text-xs text-slate-400 mt-2">Meta: 95%</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
