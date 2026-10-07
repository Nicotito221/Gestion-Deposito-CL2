import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { CalendarDays, RefreshCw, AlertCircle, Percent, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  getRundownCalendarioMes,
  saveRundownCalendarioMes,
  type RundownCalendarioMesOut,
  type RundownCalendarioDia,
} from "../services/api";

interface MesDisponibleItem {
  periodo: string;
  anio: number;
  mes: number;
  label: string;
  es_firme?: boolean;
}

interface CalendarioLaboralModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAnio?: number;
  initialMes?: number;
  mesesDisponibles?: MesDisponibleItem[];
  onSaved?: () => Promise<void> | void;
}

export function CalendarioLaboralModal({
  open,
  onOpenChange,
  initialAnio,
  initialMes,
  mesesDisponibles,
  onSaved,
}: CalendarioLaboralModalProps) {
  const [selectedAnio, setSelectedAnio] = useState<number>(initialAnio || 2026);
  const [selectedMes, setSelectedMes] = useState<number>(initialMes || 10);
  const [calData, setCalData] = useState<RundownCalendarioMesOut | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const [diasFactoresMap, setDiasFactoresMap] = useState<Record<string, number>>({});
  const [factorModalOpen, setFactorModalOpen] = useState<boolean>(false);
  const [targetDia, setTargetDia] = useState<RundownCalendarioDia | null>(null);
  const [inputFactor, setInputFactor] = useState<number>(1.0);

  const loadCalendario = useCallback(async (anio: number, mes: number) => {
    setLoading(true);
    try {
      const res = await getRundownCalendarioMes(anio, mes);
      setCalData(res);
      setSelectedAnio(res.anio);
      setSelectedMes(res.mes);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar calendario mensual");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      const a = initialAnio || 2026;
      const m = initialMes || 10;
      setSelectedAnio(a);
      setSelectedMes(m);
      loadCalendario(a, m);
    }
  }, [open, initialAnio, initialMes, loadCalendario]);

  const handleDiaClick = (dia: RundownCalendarioDia) => {
    if (dia.es_laboral) {
      setCalData((prev) => {
        if (!prev) return prev;
        const newDias = prev.dias.map((d) =>
          d.fecha === dia.fecha ? { ...d, es_laboral: false, observacion: "No laboral" } : d
        );
        const count = newDias.filter((d) => d.es_laboral).length;
        return { ...prev, dias: newDias, dias_laborales_count: count };
      });
      setDiasFactoresMap((prev) => {
        const copy = { ...prev };
        delete copy[dia.fecha];
        return copy;
      });
    } else {
      setTargetDia(dia);
      setInputFactor(1.0);
      setFactorModalOpen(true);
    }
  };

  const handleConfirmarFactor = () => {
    if (!targetDia) return;
    if (isNaN(inputFactor) || inputFactor <= 0 || inputFactor > 1) {
      toast.error("El porcentaje/factor debe ser un valor mayor a 0 y menor o igual a 1 (ej: 0.5, 1.0)");
      return;
    }
    const fecha = targetDia.fecha;
    const factorNum = Number(inputFactor);

    setCalData((prev) => {
      if (!prev) return prev;
      const newDias = prev.dias.map((d) =>
        d.fecha === fecha
          ? { ...d, es_laboral: true, observacion: `Factor ${Math.round(factorNum * 100)}%` }
          : d
      );
      const count = newDias.filter((d) => d.es_laboral).length;
      return { ...prev, dias: newDias, dias_laborales_count: count };
    });

    setDiasFactoresMap((prev) => ({
      ...prev,
      [fecha]: factorNum,
    }));

    setFactorModalOpen(false);
    setTargetDia(null);
    toast.info(`Día ${targetDia.dia_nombre} configurado con factor ${(factorNum * 100).toFixed(0)}%`);
  };

  const handlePresetDias = (preset: "lun_vie" | "todos_sabados" | "sin_sabados") => {
    if (!calData) return;
    const newDias = calData.dias.map((d) => {
      if (preset === "lun_vie") {
        const lab = d.dia_semana < 5;
        return { ...d, es_laboral: lab, observacion: lab ? null : "Descanso" };
      }
      if (preset === "todos_sabados") {
        if (d.dia_semana === 5) return { ...d, es_laboral: true, observacion: "Sábado laboral" };
        return d;
      }
      if (preset === "sin_sabados") {
        if (d.dia_semana === 5) return { ...d, es_laboral: false, observacion: "Descanso" };
        return d;
      }
      return d;
    });
    const count = newDias.filter((d) => d.es_laboral).length;
    setCalData({ ...calData, dias: newDias, dias_laborales_count: count });
  };

  const handleSave = async () => {
    if (!calData) return;
    setSaving(true);
    try {
      const payloadDias = calData.dias.map((d) => ({
        fecha: d.fecha,
        es_laboral: d.es_laboral,
        observacion: d.observacion,
        factor: diasFactoresMap[d.fecha] ?? 1.0,
      }));

      await saveRundownCalendarioMes({
        anio: calData.anio,
        mes: calData.mes,
        dias: payloadDias,
      });

      toast.success(`Calendario de ${calData.mes_nombre} guardado y sincronizado`);
      onOpenChange(false);
      if (onSaved) {
        await onSaved();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar calendario");
    } finally {
      setSaving(false);
    }
  };

  const listaMeses: MesDisponibleItem[] = mesesDisponibles || [
    { periodo: "2026-09", anio: 2026, mes: 9, label: "Septiembre 2026", es_firme: true },
    { periodo: "2026-10", anio: 2026, mes: 10, label: "Octubre 2026", es_firme: false },
    { periodo: "2026-11", anio: 2026, mes: 11, label: "Noviembre 2026", es_firme: false },
    { periodo: "2026-12", anio: 2026, mes: 12, label: "Diciembre 2026", es_firme: false },
    { periodo: "2027-01", anio: 2027, mes: 1, label: "Enero 2027", es_firme: false },
    { periodo: "2027-02", anio: 2027, mes: 2, label: "Febrero 2027", es_firme: false },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pr-6">
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                <CalendarDays className="w-5 h-5 text-indigo-600" />
                <span>Calendario Productivo — Días Laborales</span>
              </DialogTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Mes:</span>
                <Select
                  value={`${selectedAnio}-${selectedMes.toString().padStart(2, "0")}`}
                  onValueChange={(val) => {
                    const [a, m] = val.split("-").map(Number);
                    loadCalendario(a, m);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs w-44 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {listaMeses.map((m) => (
                      <SelectItem key={m.periodo} value={m.periodo} className="text-xs">
                        {m.label} {m.es_firme ? "(Firme)" : "(Proyección)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogHeader>

          {loading ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
              <p className="text-xs">Cargando días del calendario laboral...</p>
            </div>
          ) : calData ? (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-lg">
                  <span className="text-[10px] font-semibold uppercase text-emerald-700">Días Laborales</span>
                  <p className="text-xl font-black text-emerald-900 mt-0.5">{calData.dias_laborales_count}</p>
                  <p className="text-[10px] text-emerald-600">Días con producción activa</p>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] font-semibold uppercase text-slate-500">Días No Laborales</span>
                  <p className="text-xl font-black text-slate-800 mt-0.5">
                    {calData.dias.length - calData.dias_laborales_count}
                  </p>
                  <p className="text-[10px] text-slate-500">Descansos o feriados</p>
                </div>
                <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-lg">
                  <span className="text-[10px] font-semibold uppercase text-blue-700">Volumen Planificado</span>
                  <p className="text-xl font-black text-blue-950 mt-0.5">
                    {calData.volumen_total_planificado.toLocaleString("es-AR")}
                  </p>
                  <p className="text-[10px] text-blue-600">Unidades vehiculares</p>
                </div>
                <div className="p-2.5 bg-indigo-50/60 border border-indigo-200 rounded-lg">
                  <span className="text-[10px] font-semibold uppercase text-indigo-700">Promedio Diario</span>
                  <p className="text-xl font-black text-indigo-950 mt-0.5">
                    {calData.promedio_diario_estimado.toLocaleString("es-AR")}
                  </p>
                  <p className="text-[10px] text-indigo-600">Vehículos / día laboral</p>
                </div>
              </div>

              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Regla unificada para Rundown y Orden de Suministro:</span>
                </p>
                <p className="text-[11px] text-amber-800 pl-5">
                  • <b>Al agregar un día:</b> Los días existentes se mantienen idénticos (no se recalculan). El nuevo día se calcula como <i>(Día promedio del producto × Factor configurado)</i>.
                </p>
                <p className="text-[11px] text-amber-800 pl-5">
                  • <b>Al quitar un día:</b> Se remueve su columna de demanda en la orden de suministro.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 rounded-lg border text-xs">
                <span className="text-slate-600 font-medium">Ajustes rápidos:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetDias("lun_vie")}
                    className="h-7 text-xs bg-white"
                  >
                    Solo Lun-Vie
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetDias("todos_sabados")}
                    className="h-7 text-xs bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  >
                    + Todos los Sábados
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetDias("sin_sabados")}
                    className="h-7 text-xs bg-white text-slate-700"
                  >
                    - Quitar Sábados
                  </Button>
                </div>
              </div>

              <div>
                <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-slate-500 mb-1">
                  <div>LUN</div>
                  <div>MAR</div>
                  <div>MIÉ</div>
                  <div>JUE</div>
                  <div>VIE</div>
                  <div className="text-blue-600">SÁB</div>
                  <div className="text-red-500">DOM</div>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {calData.dias.length > 0 && Array.from({ length: calData.dias[0].dia_semana }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="h-16 rounded border border-transparent bg-slate-50/30" />
                  ))}

                  {calData.dias.map((d) => {
                    const isSaturday = d.dia_semana === 5;
                    const isSunday = d.dia_semana === 6;
                    const factorConfigurado = diasFactoresMap[d.fecha];
                    return (
                      <button
                        key={d.fecha}
                        type="button"
                        onClick={() => handleDiaClick(d)}
                        className={`h-16 p-1.5 rounded-lg border text-left flex flex-col justify-between transition-all select-none ${
                          d.es_laboral
                            ? "border-emerald-400 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-950 shadow-xs"
                            : "border-slate-200 bg-slate-100/80 hover:bg-slate-200/70 text-slate-400"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`text-xs font-black ${d.es_laboral ? "text-emerald-950" : "text-slate-500"}`}>
                            {d.dia}
                          </span>
                          {isSaturday && (
                            <span className="text-[9px] font-bold px-1 rounded bg-blue-100 text-blue-700">Sáb</span>
                          )}
                          {isSunday && (
                            <span className="text-[9px] font-bold px-1 rounded bg-red-100 text-red-700">Dom</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between w-full">
                          <span className={`text-[10px] font-bold ${d.es_laboral ? "text-emerald-700" : "text-slate-400"}`}>
                            {d.es_laboral ? (factorConfigurado ? `×${factorConfigurado}` : "Laboral") : "No lab."}
                          </span>
                          <span
                            className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold ${
                              d.es_laboral ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-600"
                            }`}
                          >
                            {d.es_laboral ? "✓" : "—"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="pt-2 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || loading}
              className="bg-indigo-600 text-white hover:bg-indigo-700 gap-1.5"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Sincronizando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Guardar y Sincronizar</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={factorModalOpen} onOpenChange={setFactorModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Percent className="w-5 h-5 text-indigo-600" />
              <span>Habilitar Día de Producción</span>
            </DialogTitle>
          </DialogHeader>

          {targetDia && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-xs text-slate-500 font-medium">Día seleccionado:</p>
                <p className="text-sm font-bold text-slate-900 capitalize">
                  {targetDia.dia_nombre} ({targetDia.fecha})
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700">
                  Porcentaje / Factor de Producción (&gt; 0 y &le; 1)
                </Label>
                <p className="text-[11px] text-slate-500">
                  Indica qué proporción de un día promedio se asignará a cada producto en esta fecha:
                </p>

                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: "100%", val: 1.0 },
                    { label: "75%", val: 0.75 },
                    { label: "50%", val: 0.5 },
                    { label: "25%", val: 0.25 },
                  ].map((p) => (
                    <Button
                      key={p.val}
                      type="button"
                      variant={inputFactor === p.val ? "default" : "outline"}
                      size="sm"
                      onClick={() => setInputFactor(p.val)}
                      className={`text-xs h-8 ${inputFactor === p.val ? "bg-indigo-600 text-white" : ""}`}
                    >
                      {p.label} ({p.val})
                    </Button>
                  ))}
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <Input
                    type="number"
                    min="0.01"
                    max="1"
                    step="0.05"
                    value={inputFactor}
                    onChange={(e) => setInputFactor(parseFloat(e.target.value) || 0)}
                    className="h-9 text-xs font-mono font-bold"
                  />
                  <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                    = {Math.round((inputFactor || 0) * 100)}% de jornada promedio
                  </span>
                </div>
              </div>

              <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-lg text-[11px] text-indigo-900">
                Los días ya planificados permanecerán intactos. Cada producto recibirá: <b>(Promedio diario × {inputFactor})</b> en esta nueva fecha.
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setFactorModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmarFactor}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Habilitar Día
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
