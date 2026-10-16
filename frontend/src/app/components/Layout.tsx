import { useState, useMemo } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router";
import {
  Home,
  FilePlus,
  FileText,
  Warehouse,
  Receipt,
  Package,
  ClipboardList,
  Layers,
  BarChart2,
  Shield,
  RefreshCw,
  FileSpreadsheet,
  SlidersHorizontal,
  Users,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "./ui/utils";
import { useAuth } from "../context/AuthContext";
import tbarLogo from "../../assets/tbar-logo.png";

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  roles?: string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Pedidos & Solicitudes",
    items: [
      { path: "/inicio", label: "Inicio", icon: Home, exact: true },
      { path: "/nuevo-pedido", label: "Nuevo pedido", icon: FilePlus, roles: ["administrador", "gerente", "jefe", "analista", "contador_ciclico", "solicitante"] },
      { path: "/pedidos", label: "Mis pedidos", icon: FileText },
    ],
  },
  {
    label: "Planta & Producción",
    items: [
      { path: "/conteo", label: "Conteo de planta", icon: ClipboardList, roles: ["administrador", "gerente", "jefe", "analista", "contador_ciclico", "operario_planta"] },
      { path: "/rundown", label: "Rundown vivo", icon: BarChart2, roles: ["administrador", "gerente", "jefe", "analista", "operario_planta"] },
      { path: "/suministro-bom", label: "Suministro y BOM", icon: FileSpreadsheet, roles: ["administrador", "gerente", "jefe", "analista", "operario_planta"] },
      { path: "/stock", label: "Control Stock TBAR", icon: Layers, roles: ["administrador", "gerente", "jefe", "analista", "operario_planta"] },
    ],
  },
  {
    label: "Depósito & Despacho",
    items: [
      { path: "/deposito", label: "Preparación pedidos", icon: Warehouse, roles: ["administrador", "gerente", "jefe", "analista", "deposito", "operario_deposito"] },
      { path: "/materiales", label: "Control Stock CL2", icon: Package, roles: ["administrador", "gerente", "jefe", "analista", "deposito", "operario_deposito"] },
      { path: "/remitos", label: "Remitos", icon: Receipt, roles: ["administrador", "gerente", "jefe", "analista", "deposito", "operario_deposito"] },
      { path: "/conteo-ciclico", label: "Conteo cíclico", icon: RefreshCw, roles: ["administrador", "gerente", "jefe", "analista", "contador_ciclico"] },
    ],
  },
  {
    label: "Configuración & Control",
    items: [
      { path: "/configuracion-materiales", label: "Config. Materiales", icon: SlidersHorizontal, roles: ["administrador", "gerente", "jefe", "analista", "supervisor"] },
      { path: "/usuarios", label: "Usuarios", icon: Users, roles: ["administrador"] },
      { path: "/trazabilidad", label: "Auditoría", icon: Shield, roles: ["administrador", "gerente", "jefe", "analista", "supervisor"] },
    ],
  },
];

const ROLES_LABELS: Record<string, string> = {
  administrador: "Administrador",
  gerente: "Gerente",
  jefe: "Jefe",
  analista: "Analista",
  deposito: "Depósito",
  contador_ciclico: "Contador Cíclico",
  supervisor: "Supervisor",
  operario_deposito: "Operario Depósito",
  operario_planta: "Operario Planta",
  solicitante: "Solicitante",
};

function NavContent({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const filteredGroups = useMemo(() => {
    return navGroups
      .map((group) => {
        const visibleItems = group.items.filter((item) => {
          if (!user) return false;
          if (user.rol === "administrador") return true;

          const isDepositoOrCL2 =
            user.rol === "deposito" ||
            user.rol === "operario_deposito" ||
            user.sector?.toUpperCase() === "CL2";

          if (isDepositoOrCL2) {
            if (
              item.path === "/conteo-ciclico" ||
              item.path === "/conteo" ||
              item.path === "/rundown" ||
              item.path === "/suministro-bom" ||
              item.path === "/stock" ||
              item.path === "/nuevo-pedido" ||
              item.path === "/materiales"
            ) {
              return false;
            }
          }

          if (!item.roles || item.roles.length === 0) return true;
          return item.roles.includes(user.rol);
        });
        return { ...group, items: visibleItems };
      })
      .filter((group) => group.items.length > 0);
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <>
      <nav className="flex-1 p-3">
        {filteredGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-1">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path, item.exact);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors text-sm",
                      active
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-200 flex-shrink-0">
        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center flex-shrink-0 font-bold text-xs">
              {user?.nombre ? user.nombre.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-slate-900 text-xs leading-none truncate">
                {user ? `${user.nombre} ${user.apellido}` : "Usuario"}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-slate-500 font-medium truncate">
                  {user ? ROLES_LABELS[user.rol] || user.rol : "Operario"}
                </span>
                {user?.sector && (
                  <span className="text-[9px] bg-slate-200 text-slate-700 px-1 py-0.2 rounded font-semibold truncate max-w-[80px]">
                    {user.sector}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-slate-50 print:h-auto print:bg-white">
      {/* Mobile top bar */}
      <header className="lg:hidden flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200 z-30 print:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5 text-slate-700" />
        </button>
        <div className="flex items-center gap-2.5">
          <img src={tbarLogo} alt="TBAR" className="h-8 w-auto object-contain" />
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-extrabold tracking-widest text-slate-900">FLOW</span>
            <span className="text-[10px] text-slate-500 font-medium">Forecast &amp; Logistics Operations Workspace</span>
          </div>
        </div>
        <div className="w-9" />
      </header>

      <div className="flex flex-1 overflow-hidden print:overflow-visible print:h-auto">
        {/* Mobile overlay sidebar */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex print:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative w-72 bg-white h-full flex flex-col overflow-y-auto shadow-xl z-10">
              <div className="relative p-5 border-b border-slate-200 flex-shrink-0 flex flex-col items-center text-center">
                <button
                  onClick={() => setMobileOpen(false)}
                  className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4 text-slate-600" />
                </button>
                <img src={tbarLogo} alt="Toyota Boshoku" className="h-16 w-auto object-contain mx-auto" />
                <p className="text-sm font-extrabold tracking-widest text-slate-900 mt-2">FLOW</p>
                <p className="text-[10px] font-medium text-slate-500 leading-tight mt-0.5">
                  Forecast &amp; Logistics Operations Workspace
                </p>
              </div>
              <NavContent onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-60 bg-white border-r border-slate-200 flex-col overflow-y-auto flex-shrink-0 print:hidden">
          <div className="py-5 px-4 border-b border-slate-200 flex-shrink-0 flex flex-col items-center text-center">
            <img src={tbarLogo} alt="Toyota Boshoku" className="h-20 w-auto object-contain mx-auto" />
            <p className="text-sm font-extrabold tracking-widest text-slate-900 mt-2">FLOW</p>
            <p className="text-[10px] font-medium text-slate-500 leading-tight mt-0.5">
              Forecast &amp; Logistics Operations Workspace
            </p>
          </div>
          <NavContent />
        </aside>

        <main className="flex-1 overflow-auto print:overflow-visible print:h-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
