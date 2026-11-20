import { useState, useEffect, useCallback, useMemo } from "react";
import { Building2, Plus, Edit2, Power, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import {
  createRundownProveedor,
  getProveedoresAdmin,
  getRundownSecciones,
  updateRundownProveedor,
  type ProveedorAdminItem,
  type RundownSeccionItem,
} from "../services/api";

interface FormularioProveedor {
  codigo_proveedor: string;
  nombre: string;
  pais: string;
  id_seccion: string;
  dias_alerta_rojo: string;
  dias_alerta_amarillo: string;
  doh_sugerido_planta: string;
  deposito_en_planta: boolean;
}

const FORMULARIO_VACIO: FormularioProveedor = {
  codigo_proveedor: "",
  nombre: "",
  pais: "",
  id_seccion: "none",
  dias_alerta_rojo: "5",
  dias_alerta_amarillo: "15",
  doh_sugerido_planta: "1",
  deposito_en_planta: false,
};

export function Proveedores() {
  const [proveedores, setProveedores] = useState<ProveedorAdminItem[]>([]);
  const [secciones, setSecciones] = useState<RundownSeccionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busqueda, setBusqueda] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<"activos" | "inactivos" | "todos">("activos");
  const [dialogoAbierto, setDialogoAbierto] = useState<boolean>(false);
  const [editando, setEditando] = useState<ProveedorAdminItem | null>(null);
  const [formulario, setFormulario] = useState<FormularioProveedor>(FORMULARIO_VACIO);
  const [guardando, setGuardando] = useState<boolean>(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [lista, secs] = await Promise.all([getProveedoresAdmin(), getRundownSecciones()]);
      setProveedores(lista);
      setSecciones(secs);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar proveedores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return proveedores.filter((p) => {
      const coincideEstado =
        filtroEstado === "todos" || (filtroEstado === "activos" ? p.activo : !p.activo);
      const coincideBusqueda =
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        p.codigo_proveedor.toLowerCase().includes(q) ||
        (p.pais ?? "").toLowerCase().includes(q);
      return coincideEstado && coincideBusqueda;
    });
  }, [proveedores, busqueda, filtroEstado]);

  const abrirAlta = () => {
    setEditando(null);
    setFormulario(FORMULARIO_VACIO);
    setDialogoAbierto(true);
  };

  const abrirEdicion = (p: ProveedorAdminItem) => {
    setEditando(p);
    setFormulario({
      codigo_proveedor: p.codigo_proveedor,
      nombre: p.nombre,
      pais: p.pais ?? "",
      id_seccion: p.id_seccion != null ? String(p.id_seccion) : "none",
      dias_alerta_rojo: String(p.dias_alerta_rojo),
      dias_alerta_amarillo: String(p.dias_alerta_amarillo),
      doh_sugerido_planta: String(p.doh_sugerido_planta),
      deposito_en_planta: p.deposito_en_planta,
    });
    setDialogoAbierto(true);
  };

  const numero = (valor: string, porDefecto: number): number => {
    const n = parseFloat(valor.replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : porDefecto;
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formulario.nombre.trim() || (!editando && !formulario.codigo_proveedor.trim())) {
      toast.error("Completá el código y el nombre del proveedor.");
      return;
    }
    const idSeccion = formulario.id_seccion !== "none" ? parseInt(formulario.id_seccion, 10) : undefined;
    const comunes = {
      nombre: formulario.nombre.trim(),
      pais: formulario.pais.trim(),
      dias_alerta_rojo: numero(formulario.dias_alerta_rojo, 5),
      dias_alerta_amarillo: numero(formulario.dias_alerta_amarillo, 15),
      doh_sugerido_planta: numero(formulario.doh_sugerido_planta, 1),
      deposito_en_planta: formulario.deposito_en_planta,
    };
    setGuardando(true);
    try {
      if (editando) {
        await updateRundownProveedor(editando.id_proveedor, { ...comunes, id_seccion: idSeccion ?? 0 });
        toast.success(`Proveedor ${comunes.nombre} actualizado.`);
      } else {
        await createRundownProveedor({
          ...comunes,
          codigo_proveedor: formulario.codigo_proveedor.trim().toUpperCase(),
          id_seccion: idSeccion,
        });
        toast.success(`Proveedor ${comunes.nombre} creado.`);
      }
      setDialogoAbierto(false);
      await cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el proveedor");
    } finally {
      setGuardando(false);
    }
  };

  const alternarActivo = async (p: ProveedorAdminItem) => {
    if (p.activo && p.materiales_activos > 0) {
      const confirmar = window.confirm(
        `${p.nombre} tiene ${p.materiales_activos} materiales asignados. Al desactivarlo deja de aparecer para asignar, pero los materiales siguen asignados hasta que los cambies. ¿Desactivar igual?`
      );
      if (!confirmar) return;
    }
    try {
      await updateRundownProveedor(p.id_proveedor, { activo: !p.activo });
      toast.success(`${p.nombre} ${p.activo ? "desactivado" : "activado"}.`);
      await cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar el estado del proveedor");
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Proveedores</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Alta, edición y activación de proveedores, alertas de rundown y DOH sugerido
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={cargar} disabled={loading} className="h-9 gap-1.5 text-xs">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Recargar
          </Button>
          <Button size="sm" onClick={abrirAlta} className="h-9 gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="w-4 h-4" />
            Nuevo proveedor
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por código, nombre o país"
                className="pl-8 h-9 text-xs"
              />
            </div>
            <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as "activos" | "inactivos" | "todos")}>
              <SelectTrigger className="h-9 text-xs w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activos" className="text-xs">Activos</SelectItem>
                <SelectItem value="inactivos" className="text-xs">Inactivos</SelectItem>
                <SelectItem value="todos" className="text-xs">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead>Sección</TableHead>
                  <TableHead className="text-right">Alerta roja / amarilla</TableHead>
                  <TableHead className="text-right">DOH</TableHead>
                  <TableHead className="text-center">Depósito en planta</TableHead>
                  <TableHead className="text-right">Materiales</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-sm text-slate-500 py-8">
                      {loading ? "Cargando proveedores..." : "No hay proveedores para mostrar."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtrados.map((p) => (
                    <TableRow key={p.id_proveedor} className={p.activo ? "" : "opacity-60"}>
                      <TableCell className="font-mono text-xs">{p.codigo_proveedor || "—"}</TableCell>
                      <TableCell className="text-xs font-medium">{p.nombre}</TableCell>
                      <TableCell className="text-xs">{p.pais || "—"}</TableCell>
                      <TableCell className="text-xs">{p.nombre_seccion || "—"}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {p.dias_alerta_rojo} / {p.dias_alerta_amarillo}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{p.doh_sugerido_planta}</TableCell>
                      <TableCell className="text-center text-xs">{p.deposito_en_planta ? "Sí" : "No"}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{p.materiales_activos}</TableCell>
                      <TableCell className="text-center">
                        {p.activo ? (
                          <Badge variant="outline" className="bg-green-100 text-green-700">Activo</Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-500">Inactivo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => abrirEdicion(p)} className="h-8 w-8 p-0" title="Editar">
                            <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => alternarActivo(p)}
                            className={`h-8 w-8 p-0 ${p.activo ? "text-red-600" : "text-green-600"}`}
                            title={p.activo ? "Desactivar" : "Activar"}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? `Editar ${editando.nombre}` : "Nuevo proveedor"}</DialogTitle>
            <DialogDescription>
              Los días de alerta y el DOH se usan en el rundown y en la sugerencia de pedidos.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={guardar} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Código *</Label>
                <Input
                  value={formulario.codigo_proveedor}
                  onChange={(e) => setFormulario({ ...formulario, codigo_proveedor: e.target.value })}
                  disabled={editando !== null}
                  className="h-8 text-xs uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">País</Label>
                <Input
                  value={formulario.pais}
                  onChange={(e) => setFormulario({ ...formulario, pais: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre *</Label>
              <Input
                value={formulario.nombre}
                onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sección del rundown</Label>
              <Select value={formulario.id_seccion} onValueChange={(v) => setFormulario({ ...formulario, id_seccion: v })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">Sin sección</SelectItem>
                  {secciones.map((s) => (
                    <SelectItem key={s.id_seccion} value={String(s.id_seccion)} className="text-xs">
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Alerta roja (días)</Label>
                <Input
                  value={formulario.dias_alerta_rojo}
                  onChange={(e) => setFormulario({ ...formulario, dias_alerta_rojo: e.target.value })}
                  inputMode="decimal"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Alerta amarilla (días)</Label>
                <Input
                  value={formulario.dias_alerta_amarillo}
                  onChange={(e) => setFormulario({ ...formulario, dias_alerta_amarillo: e.target.value })}
                  inputMode="decimal"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">DOH sugerido planta</Label>
                <Input
                  value={formulario.doh_sugerido_planta}
                  onChange={(e) => setFormulario({ ...formulario, doh_sugerido_planta: e.target.value })}
                  inputMode="decimal"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-xs font-medium text-slate-800">Depósito en planta</p>
                <p className="text-[11px] text-slate-500">
                  El proveedor entrega directo en planta, sin pasar por CL2.
                </p>
              </div>
              <Switch
                checked={formulario.deposito_en_planta}
                onCheckedChange={(v) => setFormulario({ ...formulario, deposito_en_planta: v })}
              />
            </div>
            {formulario.deposito_en_planta && !(editando?.deposito_en_planta ?? false) && (
              <p className="text-[11px] text-amber-700">
                Al activarlo, el stock CL2 de los materiales de este proveedor pasa a 0 y el stock inicial total se iguala al de planta.
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogoAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
