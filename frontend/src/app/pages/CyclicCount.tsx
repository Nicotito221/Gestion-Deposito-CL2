import { RefreshCw } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";

export function CyclicCount() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900 mb-2">Conteo Cíclico</h1>
        <p className="text-slate-600">Módulo de conteo físico de materiales en depósito</p>
      </div>

      <Card className="border-dashed border-2 border-slate-200">
        <CardContent className="py-20">
          <div className="text-center">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="w-7 h-7 text-slate-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-700 mb-2">
              Funcionalidad en desarrollo
            </h2>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
