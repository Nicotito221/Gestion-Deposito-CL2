import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, GitBranchPlus, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  eliminarBomExtension,
  getBomExtension,
  guardarBomExtension,
  importarBomExtension,
  type BomExtensionItem,
} from "../services/api";

interface BomExtensionPanelProps {
  puedeEditar: boolean;
  onCambio?: () => void;
}

interface FormularioExtension {
  idPadre: string;
  nombrePadre: string;
  idHijo: string;
  nombreHijo: string;
  cantidad: string;
  unidad: string;
}

const FORMULARIO_VACIO: FormularioExtension = {
  idPadre: "",
  nombrePadre: "",
  idHijo: "",
  nombreHijo: "",
  cantidad: "",
  unidad: "UN",
};

export function BomExtensionPanel({ puedeEditar, onCambio }: BomExtensionPanelProps) {
  const [lineas, setLineas] = useState<BomExtensionItem[]>([]);
  const [form, setForm] = useState<FormularioExtension>(FORMULARIO_VACIO);
  const [trabajando, setTrabajando] = useState<boolean>(false);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const alternarPadre = (padre: string) => {
    setExpandidos((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(padre)) nuevo.delete(padre);
      else nuevo.add(padre);
      return nuevo;
    });
  };
  const inputArchivo = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    try {
      setLineas(await getBomExtension());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar la extensión de BOM");
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const porPadre = useMemo(() => {
    const grupos = new Map<string, BomExtensionItem[]>();
    for (const l of lineas) {
      const lista = grupos.get(l.id_padre) ?? [];
      lista.push(l);
      grupos.set(l.id_padre, lista);
    }
    return Array.from(grupos.entries());
  }, [lineas]);

  const actualizar = (campo: keyof FormularioExtension, valor: string) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const guardar = async () => {
    const cantidad = parseFloat(form.cantidad.replace(",", "."));
    if (!form.idPadre.trim() || !form.idHijo.trim() || !Number.isFinite(cantidad) || cantidad <= 0) {
      toast.error("Completá padre, componente y una cantidad mayor a 0.");
      return;
    }
    setTrabajando(true);
    try {
      const res = await guardarBomExtension({
        id_padre: form.idPadre.trim(),
        nombre_padre: form.nombrePadre.trim() || null,
        id_hijo: form.idHijo.trim(),
        nombre_hijo: form.nombreHijo.trim() || null,
        cantidad,
        unidad: form.unidad.trim() || "UN",
      });
      toast.success(`Extensión guardada. Explosión recalculada (${res.filas_explosion.toLocaleString("es-AR")} filas).`);
      setExpandidos((prev) => new Set(prev).add(form.idPadre.trim().toUpperCase()));
      setForm((prev) => ({ ...FORMULARIO_VACIO, idPadre: prev.idPadre, nombrePadre: prev.nombrePadre }));
      await cargar();
      onCambio?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar la extensión");
    } finally {
      setTrabajando(false);
    }
  };

  const eliminar = async (linea: BomExtensionItem) => {
    setTrabajando(true);
    try {
      await eliminarBomExtension(linea.id_extension);
      toast.success(`Se quitó ${linea.id_hijo} de ${linea.id_padre}.`);
      await cargar();
      onCambio?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar la línea");
    } finally {
      setTrabajando(false);
    }
  };

  const importarArchivo = async (archivo: File) => {
    setTrabajando(true);
    try {
      const res = await importarBomExtension(archivo);
      toast.success(
        `${res.nombre_archivo}: ${res.productos_importados} productos, ${res.lineas_importadas} líneas, ` +
          `${res.nuevos_materiales_registrados} materiales nuevos. Explosión recalculada.`
      );
      await cargar();
      onCambio?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al importar la BOM complementaria");
    } finally {
      setTrabajando(false);
      if (inputArchivo.current) inputArchivo.current.value = "";
    }
  };

  const editar = (linea: BomExtensionItem) => {
    setForm({
      idPadre: linea.id_padre,
      nombrePadre: "",
      idHijo: linea.id_hijo,
      nombreHijo: "",
      cantidad: String(linea.cantidad),
      unidad: linea.unidad,
    });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-md">
            <GitBranchPlus className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-slate-900">Extensión de BOM</h2>
            <p className="text-xs text-slate-500">
              BOM complementaria de SAP o componentes cargados a mano. Se suma a la BOM general y se mantiene al reimportarla. Archivo: A = PN padre, B = componente, C = descripción, D = cantidad, E = unidad (sin encabezado). El padre
              puede ser un PN que no está en la BOM; si el componente es un subconjunto de la BOM, se sigue
              explotando hacia abajo.
            </p>
          </div>
          {puedeEditar && (
            <>
              <input
                ref={inputArchivo}
                type="file"
                accept=".xls,.xlsx,.txt,.tsv,.csv"
                className="hidden"
                onChange={(e) => {
                  const archivo = e.target.files?.[0];
                  if (archivo) importarArchivo(archivo);
                }}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={trabajando}
                onClick={() => inputArchivo.current?.click()}
                className="h-9 gap-1.5 text-xs shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                Importar BOM complementaria
              </Button>
            </>
          )}
        </div>

        {puedeEditar && (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
            <div className="col-span-1">
              <label className="text-xs font-medium text-slate-600">PN padre</label>
              <Input value={form.idPadre} onChange={(e) => actualizar("idPadre", e.target.value)} className="h-9 text-sm font-mono" />
            </div>
            <div className="col-span-1">
              <label className="text-xs font-medium text-slate-600">Descripción padre</label>
              <Input value={form.nombrePadre} onChange={(e) => actualizar("nombrePadre", e.target.value)} placeholder="Si es nuevo" className="h-9 text-sm" />
            </div>
            <div className="col-span-1">
              <label className="text-xs font-medium text-slate-600">PN componente</label>
              <Input value={form.idHijo} onChange={(e) => actualizar("idHijo", e.target.value)} className="h-9 text-sm font-mono" />
            </div>
            <div className="col-span-1">
              <label className="text-xs font-medium text-slate-600">Descripción comp.</label>
              <Input value={form.nombreHijo} onChange={(e) => actualizar("nombreHijo", e.target.value)} placeholder="Si es nuevo" className="h-9 text-sm" />
            </div>
            <div className="col-span-1 grid grid-cols-2 gap-1">
              <div>
                <label className="text-xs font-medium text-slate-600">Cantidad</label>
                <Input inputMode="decimal" value={form.cantidad} onChange={(e) => actualizar("cantidad", e.target.value)} className="h-9 text-sm text-right" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Unidad</label>
                <Input value={form.unidad} onChange={(e) => actualizar("unidad", e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
            <Button size="sm" onClick={guardar} disabled={trabajando} className="h-9 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="w-3.5 h-3.5" />
              Guardar línea
            </Button>
          </div>
        )}

        {porPadre.length > 0 && (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-[11px] text-slate-600"
              onClick={() => setExpandidos(new Set(porPadre.map(([padre]) => padre)))}
            >
              <ChevronsUpDown className="w-3.5 h-3.5" />
              Desplegar todo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-[11px] text-slate-600"
              onClick={() => setExpandidos(new Set())}
            >
              <ChevronsDownUp className="w-3.5 h-3.5" />
              Contraer todo
            </Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Padre</TableHead>
                <TableHead className="text-xs">Componente</TableHead>
                <TableHead className="text-xs text-right">Cantidad</TableHead>
                <TableHead className="text-xs">Unidad</TableHead>
                {puedeEditar && <TableHead className="w-[48px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {porPadre.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-slate-500 py-6">
                    No hay componentes cargados en la extensión.
                  </TableCell>
                </TableRow>
              )}
              {porPadre.map(([padre, hijos]) => {
                const abierto = expandidos.has(padre);
                const nombrePadre = hijos[0]?.nombre_padre;
                return (
                  <Fragment key={padre}>
                    <TableRow className="bg-slate-50 hover:bg-slate-100 cursor-pointer" onClick={() => alternarPadre(padre)}>
                      <TableCell colSpan={puedeEditar ? 5 : 4} className="text-xs py-2">
                        <div className="flex items-center gap-2">
                          {abierto ? (
                            <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                          )}
                          <span className="font-mono font-semibold text-slate-900">{padre}</span>
                          {nombrePadre && nombrePadre !== padre && <span className="text-slate-500">{nombrePadre}</span>}
                          <span className="ml-auto text-[11px] text-slate-500">
                            {hijos.length} {hijos.length === 1 ? "componente" : "componentes"}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {abierto &&
                      hijos.map((l) => (
                        <TableRow
                          key={l.id_extension}
                          className={puedeEditar ? "cursor-pointer" : ""}
                          onClick={() => puedeEditar && editar(l)}
                        >
                          <TableCell className="text-xs" />
                          <TableCell className="text-xs">
                            <div className="font-mono">{l.id_hijo}</div>
                            {l.nombre_hijo !== l.id_hijo && <div className="text-slate-500">{l.nombre_hijo}</div>}
                          </TableCell>
                          <TableCell className="text-xs text-right">{l.cantidad.toLocaleString("es-AR")}</TableCell>
                          <TableCell className="text-xs">{l.unidad}</TableCell>
                          {puedeEditar && (
                            <TableCell className="p-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-600"
                                disabled={trabajando}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  eliminar(l);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
