import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Star,
  BarChart2,
  TrendingUp,
  Link as LinkIcon,
  Clock,
} from "lucide-react";

const features = [
  {
    icon: <Star className="w-6 h-6 text-slate-400" />,
    name: "Evaluación de proveedores",
    description:
      "Registro de métricas de cumplimiento, puntualidad y calidad por proveedor. Historial de entregas con seguimiento detallado.",
  },
  {
    icon: <TrendingUp className="w-6 h-6 text-slate-400" />,
    name: "Ranking de proveedores",
    description:
      "Score consolidado por proveedor, comparativas y confiabilidad histórica. Identificación automática de proveedores de bajo desempeño.",
  },
  {
    icon: <BarChart2 className="w-6 h-6 text-slate-400" />,
    name: "Métricas de cumplimiento",
    description:
      "Dashboard ejecutivo de KPIs de proveedores: fill rate por proveedor, lead time, tasa de rechazo y exactitud de cantidades.",
  },
  {
    icon: <LinkIcon className="w-6 h-6 text-slate-400" />,
    name: "Integración SAP",
    description:
      "Sincronización bidireccional con SAP para ingresos, órdenes de compra y movimientos de stock. Elimina la carga manual duplicada.",
  },
  {
    icon: <LinkIcon className="w-6 h-6 text-slate-400" />,
    name: "Integraciones corporativas",
    description:
      "Conexión con otros sistemas corporativos: ERP, sistemas de compras, plataformas de planificación de producción y BI.",
  },
];

export function FutureFeatures() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900 mb-2">Próximas mejoras</h1>
        <p className="text-slate-600">
          Funcionalidades planificadas para versiones futuras del sistema. No forman parte del MVP actual.
        </p>
      </div>

      <Card className="mb-6 bg-amber-50 border-amber-200">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 mb-1">Estas funcionalidades están fuera del alcance del MVP</p>
              <p className="text-sm text-amber-800">
                El sistema actual se enfoca en digitalizar los procesos operativos diarios: pedidos, conteo, stock, preparación y documentación. Las integraciones y métricas avanzadas de proveedores serán incorporadas en etapas posteriores.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((f) => (
          <Card key={f.name} className="border-slate-200 opacity-75">
            <CardHeader className="flex flex-row items-start gap-4 pb-3">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                {f.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-slate-600 text-base">{f.name}</CardTitle>
                  <Badge className="bg-slate-100 text-slate-500" variant="outline">
                    Próximamente
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">{f.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
