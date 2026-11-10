import { useCallback, useEffect, useMemo, useState } from "react";
import { Truck, RefreshCw, Save, Plus, Trash2, ChevronsRight, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { getDespachos, guardarDespachos, type DespachoUpsertInput } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { BomExtensionPanel } from "../components/BomExtensionPanel";

const HORIZONTE_MESES = 12;
const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

interface Periodo {
  anio: number;
  mes: number;
  clave: string;
}

interface FilaDespacho {
  empresa: string;
  pn: string;
  valores: Record<string, string>;
}

function claveFila(empresa: string, pn: string): string {
  return `${empresa}||${pn}`;
}

function construirPeriodos(anio: number, mes: number): Periodo[] {
  const periodos: Periodo[] = [];
  for (let i = 0; i < HORIZONTE_MESES; i++) {
    const total = mes - 1 + i;
    const a = anio + Math.floor(total / 12);
    const m = (total % 12) + 1;
    periodos.push({ anio: a, mes: m, clave: `${a}-${String(m).padStart(2, "0")}` });
  }
  return periodos;
}

function aNumero(valor: string | undefined): number {
  const n = parseFloat((valor ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function DespachosTerceros() {
  const { user } = useAuth();
  const puedeEditar = Boolean(
    user && ["administrador", "gerente", "jefe", "analista"].includes(user.rol?.toLowerCase() || "")
  );

  const hoy = new Date();
  const [inicio, setInicio] = useState<{ anio: number; mes: number }>({
    anio: hoy.getFullYear(),
    mes: hoy.getMonth() + 1,
  });
  const periodos = useMemo(() => construirPeriodos(inicio.anio, inicio.mes), [inicio]);

  const [filas, setFilas] = useState<Record<string, FilaDespacho>>({});
  const [originales, setOriginales] = useState<Record<string, Record<string, number>>>({});
  const [cargando, setCargando] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [nuevaEmpresa, setNuevaEmpresa] = useState<string>("");
  const [nuevoPn, setNuevoPn] = useState<string>("");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const ultimo = periodos[periodos.length - 1];
      const data = await getDespachos(periodos[0].anio, periodos[0].mes, ultimo.anio, ultimo.mes);
      const nuevasFilas: Record<string, FilaDespacho> = {};
      const nuevosOriginales: Record<string, Record<string, number>> = {};
      for (const d of data) {
        const k = claveFila(d.empresa_destino, d.id_producto);
        const periodo = `${d.anio}-${String(d.mes).padStart(2, "0")}`;
        if (!nuevasFilas[k]) {
          nuevasFilas[k] = { empresa: d.empresa_destino, pn: d.id_producto, valores: {} };
          nuevosOriginales[k] = {};
        }
        nuevasFilas[k].valores[periodo] = String(d.cantidad);
        nuevosOriginales[k][periodo] = d.cantidad;
      }
      setFilas(nuevasFilas);
      setOriginales(nuevosOriginales);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar despachos");
    } finally {
      setCargando(false);
    }
  }, [periodos]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambios = useMemo<DespachoUpsertInput[]>(() => {
    const items: DespachoUpsertInput[] = [];
    for (const [k, fila] of Object.entries(filas)) {
      for (const p of periodos) {
        const actual = aNumero(fila.valores[p.clave]);
        const original = originales[k]?.[p.clave] ?? 0;
        if (actual !== original) {
          items.push({
            id_producto: fila.pn,
            empresa_destino: fila.empresa,
            anio: p.anio,
            mes: p.mes,
            cantidad: actual,
          });
        }
      }
    }
    return items;
  }, [filas, originales, periodos]);

  const empresas = useMemo(
    () => Array.from(new Set(Object.values(filas).map((f) => f.empresa))).sort(),
    [filas]
  );

  const filasOrdenadas = useMemo(
    () =>
      Object.entries(filas).sort(([, a], [, b]) =>
        a.empresa === b.empresa ? a.pn.localeCompare(b.pn) : a.empresa.localeCompare(b.empresa)
      ),
    [filas]
  );

  const totalesPorPeriodo = useMemo(() => {
    const totales: Record<string, number> = {};
    for (const fila of Object.values(filas)) {
      for (const p of periodos) {
        totales[p.clave] = (totales[p.clave] ?? 0) + aNumero(fila.valores[p.clave]);
      }
    }
    return totales;
  }, [filas, periodos]);

  const setValor = (k: string, periodo: string, valor: string) => {
    setFilas((prev) => ({
      ...prev,
      [k]: { ...prev[k], valores: { ...prev[k].valores, [periodo]: valor } },
    }));
  };

  const repetirHaciaAdelante = (k: string) => {
    setFilas((prev) => {
      const fila = prev[k];
      const primero = periodos.find((p) => aNumero(fila.valores[p.clave]) > 0);
      if (!primero) return prev;
      const valor = fila.valores[primero.clave];
      const valores = { ...fila.valores };
      let activo = false;
      for (const p of periodos) {
        if (p.clave === primero.clave) activo = true;
        if (activo) valores[p.clave] = valor;
      }
      return { ...prev, [k]: { ...fila, valores } };
    });
  };

  const vaciarFila = (k: string) => {
    setFilas((prev) => ({ ...prev, [k]: { ...prev[k], valores: {} } }));
  };

  const agregarFila = () => {
    const empresa = nuevaEmpresa.trim();
    const pn = nuevoPn.trim().toUpperCase();
    if (!empresa || !pn) {
      toast.error("Completá la empresa y el PN.");
      return;
    }
    const k = claveFila(empresa, pn);
    if (filas[k]) {
      toast.error("Ese PN ya está cargado para esa empresa.");
      return;
    }
    setFilas((prev) => ({ ...prev, [k]: { empresa, pn, valores: {} } }));
    setNuevoPn("");
  };

  const guardar = async () => {
    if (cambios.length === 0) return;
    setGuardando(true);
    try {
      const res = await guardarDespachos(cambios);
      if (res.productos_no_encontrados.length > 0) {
        toast.error(
          `No existen en la BOM vigente y no se guardaron: ${res.productos_no_encontrados.join(", ")}`
        );
      }
      toast.success(`Despachos guardados (${res.guardados} actualizados, ${res.eliminados} eliminados).`);
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar despachos");
    } finally {
      setGuardando(false);
    }
  };

  const moverInicio = (delta: number) => {
    setInicio((prev) => {
      const total = prev.mes - 1 + delta;
      return { anio: prev.anio + Math.floor(total / 12), mes: ((total % 12) + 12) % 12 + 1 };
    });
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Despachos a terceros</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Cantidades mensuales que se producen para otras empresas. Se reparten en los días laborales y
              suman al rundown, a los pedidos sugeridos y al TXT de SAP PIR.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={cargar} disabled={cargando} className="text-xs h-9 gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          {puedeEditar && (
            <Button
              size="sm"
              onClick={guardar}
              disabled={guardando || cambios.length === 0}
              className="text-xs h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar{cambios.length > 0 ? ` (${cambios.length})` : ""}
            </Button>
          )}
        </div>
      </div>

      <BomExtensionPanel puedeEditar={puedeEditar} />

      {puedeEditar && (
        <Card>
          <CardContent className="p-4 flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-600">Empresa destino</label>
              <Input
                list="empresas-despacho"
                value={nuevaEmpresa}
                onChange={(e) => setNuevaEmpresa(e.target.value)}
                placeholder="Nombre de la empresa"
                className="h-9 text-sm"
              />
              <datalist id="empresas-despacho">
                {empresas.map((e) => (
                  <option key={e} value={e} />
                ))}
              </datalist>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-600">PN (de la BOM o de la extensión)</label>
              <Input
                value={nuevoPn}
                onChange={(e) => setNuevoPn(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") agregarFila();
                }}
                placeholder="Ej: 79110-0KY30"
                className="h-9 text-sm font-mono"
              />
            </div>
            <Button size="sm" variant="outline" onClick={agregarFila} className="h-9 gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" />
              Agregar fila
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200">
            <span className="text-xs text-slate-500">
              {periodos[0] && `${MESES_CORTOS[periodos[0].mes - 1]} ${periodos[0].anio}`} –{" "}
              {periodos[periodos.length - 1] &&
                `${MESES_CORTOS[periodos[periodos.length - 1].mes - 1]} ${periodos[periodos.length - 1].anio}`}
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moverInicio(-1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moverInicio(1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs min-w-[140px]">Empresa</TableHead>
                  <TableHead className="text-xs min-w-[130px]">PN</TableHead>
                  {periodos.map((p) => (
                    <TableHead key={p.clave} className="text-xs text-right min-w-[84px]">
                      {MESES_CORTOS[p.mes - 1]} {String(p.anio).slice(2)}
                    </TableHead>
                  ))}
                  {puedeEditar && <TableHead className="w-[72px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filasOrdenadas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={periodos.length + 3} className="text-center text-sm text-slate-500 py-8">
                      {cargando ? "Cargando…" : "No hay despachos cargados en este período."}
                    </TableCell>
                  </TableRow>
                )}
                {filasOrdenadas.map(([k, fila]) => (
                  <TableRow key={k}>
                    <TableCell className="text-xs font-medium">{fila.empresa}</TableCell>
                    <TableCell className="text-xs font-mono">{fila.pn}</TableCell>
                    {periodos.map((p) => {
                      const modificado = aNumero(fila.valores[p.clave]) !== (originales[k]?.[p.clave] ?? 0);
                      return (
                        <TableCell key={p.clave} className="p-1">
                          <Input
                            inputMode="decimal"
                            value={fila.valores[p.clave] ?? ""}
                            disabled={!puedeEditar}
                            onChange={(e) => setValor(k, p.clave, e.target.value)}
                            className={`h-8 text-xs text-right px-2 ${modificado ? "border-amber-400 bg-amber-50" : ""}`}
                          />
                        </TableCell>
                      );
                    })}
                    {puedeEditar && (
                      <TableCell className="p-1">
                        <div className="flex gap-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="Repetir el primer valor en los meses siguientes"
                            onClick={() => repetirHaciaAdelante(k)}
                          >
                            <ChevronsRight className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-600"
                            title="Vaciar la fila (se elimina al guardar)"
                            onClick={() => vaciarFila(k)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {filasOrdenadas.length > 0 && (
                  <TableRow className="bg-slate-50">
                    <TableCell colSpan={2} className="text-xs font-semibold">
                      Total
                    </TableCell>
                    {periodos.map((p) => (
                      <TableCell key={p.clave} className="text-xs text-right font-semibold pr-3">
                        {(totalesPorPeriodo[p.clave] ?? 0).toLocaleString("es-AR")}
                      </TableCell>
                    ))}
                    {puedeEditar && <TableCell />}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
