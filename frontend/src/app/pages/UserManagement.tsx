import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  UserPlus,
  Search,
  KeyRound,
  Edit2,
  Trash2,
  UserX,
  UserCheck,
  Shield,
  Building,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "../components/ui/card";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  getUsuarios,
  createUsuario,
  updateUsuario,
  changeUsuarioPassword,
  deleteUsuario,
  type UsuarioItem,
  type UsuarioCreateInput,
  type UsuarioUpdateInput,
} from "../services/api";
import { useAuth } from "../context/AuthContext";

const SECTORES_DISPONIBLES = [
  "TODOS",
  "Despacho",
  "PC",
  "CL2",
  "Recepcion",
  "Administracion",
];

const ROLES_CONFIG: Record<string, { label: string; color: string }> = {
  administrador: { label: "Administrador", color: "bg-purple-100 text-purple-700 border-purple-200" },
  gerente: { label: "Gerente", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  jefe: { label: "Jefe", color: "bg-blue-100 text-blue-700 border-blue-200" },
  analista: { label: "Analista", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  deposito: { label: "Depósito", color: "bg-amber-100 text-amber-700 border-amber-200" },
  contador_ciclico: { label: "Contador Cíclico", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  supervisor: { label: "Supervisor", color: "bg-slate-100 text-slate-700 border-slate-200" },
  operario_deposito: { label: "Operario Depósito", color: "bg-amber-100 text-amber-700 border-amber-200" },
  operario_planta: { label: "Operario Planta", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  solicitante: { label: "Solicitante", color: "bg-slate-100 text-slate-700 border-slate-200" },
};

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [filterRol, setFilterRol] = useState<string>("TODOS");
  const [filterSector, setFilterSector] = useState<string>("TODOS");

  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState<boolean>(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<UsuarioItem | null>(null);
  const [userToDelete, setUserToDelete] = useState<UsuarioItem | null>(null);

  const [createForm, setCreateForm] = useState<UsuarioCreateInput>({
    username: "",
    password: "",
    nombre: "",
    apellido: "",
    rol: "solicitante",
    sector: "TODOS",
    email: "",
    activo: true,
  });

  const [editForm, setEditForm] = useState<UsuarioUpdateInput>({
    nombre: "",
    apellido: "",
    rol: "solicitante",
    sector: "TODOS",
    email: "",
    activo: true,
  });

  const [newPassword, setNewPassword] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUsuarios();
      setUsuarios(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  const filteredUsuarios = useMemo(() => {
    return usuarios.filter((u) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        u.username.toLowerCase().includes(q) ||
        u.nombre.toLowerCase().includes(q) ||
        u.apellido.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q));

      const matchRol = filterRol === "TODOS" || u.rol === filterRol;
      const matchSector = filterSector === "TODOS" || u.sector === filterSector;

      return matchSearch && matchRol && matchSector;
    });
  }, [usuarios, search, filterRol, filterSector]);

  const handleOpenCreate = () => {
    setCreateForm({
      username: "",
      password: "",
      nombre: "",
      apellido: "",
      rol: "solicitante",
      sector: "TODOS",
      email: "",
      activo: true,
    });
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.username || !createForm.password || !createForm.nombre || !createForm.apellido) {
      toast.error("Por favor complete todos los campos obligatorios.");
      return;
    }
    setIsSubmitting(true);
    try {
      await createUsuario(createForm);
      toast.success("Usuario creado exitosamente.");
      setCreateModalOpen(false);
      fetchUsuarios();
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (u: UsuarioItem) => {
    setSelectedUser(u);
    setEditForm({
      nombre: u.nombre,
      apellido: u.apellido,
      rol: u.rol,
      sector: u.sector,
      email: u.email || "",
      activo: u.activo,
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      await updateUsuario(selectedUser.id_usuario, editForm);
      toast.success("Usuario actualizado exitosamente.");
      setEditModalOpen(false);
      fetchUsuarios();
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenPassword = (u: UsuarioItem) => {
    setSelectedUser(u);
    setNewPassword("");
    setPasswordModalOpen(true);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPassword.trim()) {
      toast.error("Ingrese una contraseña válida.");
      return;
    }
    setIsSubmitting(true);
    try {
      await changeUsuarioPassword(selectedUser.id_usuario, newPassword.trim());
      toast.success("Contraseña actualizada exitosamente.");
      setPasswordModalOpen(false);
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActivo = async (u: UsuarioItem) => {
    try {
      if (u.activo) {
        await updateUsuario(u.id_usuario, { activo: false });
        toast.info(`Usuario ${u.username} desactivado.`);
      } else {
        await updateUsuario(u.id_usuario, { activo: true });
        toast.success(`Usuario ${u.username} activado.`);
      }
      fetchUsuarios();
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
    }
  };

  const handleOpenDelete = (u: UsuarioItem) => {
    setUserToDelete(u);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteUsuario(userToDelete.id_usuario);
      toast.success(`Usuario ${userToDelete.username} eliminado correctamente.`);
      setDeleteModalOpen(false);
      setUserToDelete(null);
      fetchUsuarios();
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-xs">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Gestión de Usuarios</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Administración de cuentas, roles, permisos y asignación de sectores de acceso
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchUsuarios}
            disabled={loading}
            className="text-xs h-9 gap-1.5 border-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </Button>
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="text-xs h-9 gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Nuevo Usuario</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-xs border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 rounded-lg text-slate-700">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total de Usuarios</p>
              <p className="text-xl font-bold text-slate-900">{usuarios.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-700">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Usuarios Activos</p>
              <p className="text-xl font-bold text-emerald-700">
                {usuarios.filter((u) => u.activo).length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-lg text-blue-700">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Sectores Configurados</p>
              <p className="text-xl font-bold text-blue-700">
                {new Set(usuarios.map((u) => u.sector)).size}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xs border-slate-200">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por usuario, nombre o email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select value={filterRol} onValueChange={setFilterRol}>
                <SelectTrigger className="h-9 w-[160px] text-xs">
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los roles</SelectItem>
                  <SelectItem value="administrador">Administrador</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="jefe">Jefe</SelectItem>
                  <SelectItem value="analista">Analista</SelectItem>
                  <SelectItem value="deposito">Depósito</SelectItem>
                  <SelectItem value="contador_ciclico">Contador Cíclico</SelectItem>
                  <SelectItem value="solicitante">Solicitante</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterSector} onValueChange={setFilterSector}>
                <SelectTrigger className="h-9 w-[160px] text-xs">
                  <SelectValue placeholder="Sector" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los sectores</SelectItem>
                  {SECTORES_DISPONIBLES.filter((s) => s !== "TODOS").map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/75">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-slate-700">Usuario</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Nombre Completo</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Rol</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Sector Asignado</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Estado</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Último Acceso</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-xs text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
                        <span>Cargando usuarios...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredUsuarios.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-xs text-slate-500">
                      No se encontraron usuarios con los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsuarios.map((u) => {
                    const rolCfg = ROLES_CONFIG[u.rol] || { label: u.rol, color: "bg-slate-100 text-slate-700 border-slate-200" };
                    const isSelf = currentUser?.id_usuario === u.id_usuario;
                    return (
                      <TableRow key={u.id_usuario} className="hover:bg-slate-50/50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                              {u.nombre.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900">{u.username}</p>
                              {u.email && <p className="text-[11px] text-slate-400">{u.email}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-800">
                          {u.nombre} {u.apellido}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] font-semibold ${rolCfg.color}`}>
                            {rolCfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                            <Building className="w-3.5 h-3.5 text-slate-400" />
                            <span>{u.sector}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {u.activo ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                              Activo
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">
                              Inactivo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-[11px] text-slate-500">
                          {u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString("es-AR") : "Nunca"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(u)}
                              className="h-7 w-7 p-0 text-slate-600 hover:text-slate-900"
                              title="Editar usuario"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenPassword(u)}
                              className="h-7 w-7 p-0 text-amber-600 hover:text-amber-800"
                              title="Cambiar contraseña"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </Button>
                            {!isSelf && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleActivo(u)}
                                  className={`h-7 w-7 p-0 ${
                                    u.activo ? "text-amber-600 hover:text-amber-800" : "text-emerald-600 hover:text-emerald-800"
                                  }`}
                                  title={u.activo ? "Desactivar usuario" : "Activar usuario"}
                                >
                                  {u.activo ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenDelete(u)}
                                  className="h-7 w-7 p-0 text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                                  title="Eliminar usuario"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Crear Usuario */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">Nuevo Usuario</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Complete los datos requeridos para habilitar un nuevo usuario en el sistema.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre *</Label>
                <Input
                  required
                  value={createForm.nombre}
                  onChange={(e) => setCreateForm({ ...createForm, nombre: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Apellido *</Label>
                <Input
                  required
                  value={createForm.apellido}
                  onChange={(e) => setCreateForm({ ...createForm, apellido: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Username *</Label>
                <Input
                  required
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  placeholder="ej. nicolas"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Contraseña Inicial *</Label>
                <Input
                  type="password"
                  required
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Email (Opcional)</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="ej. usuario@gestiondeposito.com"
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Rol *</Label>
                <Select
                  value={createForm.rol}
                  onValueChange={(val: UsuarioCreateInput["rol"]) => setCreateForm({ ...createForm, rol: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="administrador">Administrador</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    <SelectItem value="jefe">Jefe</SelectItem>
                    <SelectItem value="analista">Analista</SelectItem>
                    <SelectItem value="deposito">Depósito</SelectItem>
                    <SelectItem value="contador_ciclico">Contador Cíclico</SelectItem>
                    <SelectItem value="solicitante">Solicitante</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Sector Asignado *</Label>
                <Select
                  value={createForm.sector}
                  onValueChange={(val: string) => setCreateForm({ ...createForm, sector: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORES_DISPONIBLES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting} className="bg-slate-900 text-white">
                {isSubmitting ? "Creando..." : "Crear Usuario"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Usuario */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Editar Usuario: {selectedUser?.username}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Modifique los roles, sectores o datos de contacto del usuario.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre *</Label>
                <Input
                  required
                  value={editForm.nombre}
                  onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Apellido *</Label>
                <Input
                  required
                  value={editForm.apellido}
                  onChange={(e) => setEditForm({ ...editForm, apellido: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={editForm.email || ""}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Rol *</Label>
                <Select
                  value={editForm.rol}
                  onValueChange={(val: UsuarioUpdateInput["rol"]) => setEditForm({ ...editForm, rol: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="administrador">Administrador</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    <SelectItem value="jefe">Jefe</SelectItem>
                    <SelectItem value="analista">Analista</SelectItem>
                    <SelectItem value="deposito">Depósito</SelectItem>
                    <SelectItem value="contador_ciclico">Contador Cíclico</SelectItem>
                    <SelectItem value="solicitante">Solicitante</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Sector Asignado *</Label>
                <Select
                  value={editForm.sector}
                  onValueChange={(val: string) => setEditForm({ ...editForm, sector: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORES_DISPONIBLES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting} className="bg-slate-900 text-white">
                {isSubmitting ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Cambiar Contraseña */}
      <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Resetear Contraseña
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Establezca una nueva clave de acceso para <strong>{selectedUser?.username}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs">Nueva Contraseña *</Label>
              <Input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="h-8 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPasswordModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting} className="bg-amber-600 text-white hover:bg-amber-700">
                {isSubmitting ? "Actualizando..." : "Actualizar Contraseña"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmación de Eliminación Lógica */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              ¿Eliminar usuario?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Esta acción dará de baja definitiva al usuario y ya no será visible en el sistema. Los registros históricos asociados (pedidos, remitos, conteos) se preservarán para trazabilidad y auditoría.
            </DialogDescription>
          </DialogHeader>

          {userToDelete && (
            <div className="py-2 space-y-2 text-xs">
              <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-lg text-rose-800 flex flex-col gap-1">
                <div className="font-semibold text-rose-900">
                  {userToDelete.nombre} {userToDelete.apellido} (@{userToDelete.username})
                </div>
                <div className="text-[11px] text-rose-700">
                  Rol: <span className="font-medium">{ROLES_CONFIG[userToDelete.rol]?.label || userToDelete.rol}</span> | Sector: <span className="font-medium">{userToDelete.sector}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteModalOpen(false)}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isSubmitting}
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isSubmitting ? "Eliminando..." : "Eliminar Definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
