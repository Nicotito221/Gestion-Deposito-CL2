import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router";
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
  Menu,
  X,
} from "lucide-react";
import { cn } from "./ui/utils";

const navGroups = [
  {
    label: "Solicitudes",
    items: [
      { path: "/inicio", label: "Inicio", icon: Home, exact: true },
      { path: "/nuevo-pedido", label: "Nuevo pedido", icon: FilePlus },
      { path: "/pedidos", label: "Mis pedidos", icon: FileText },
    ],
  },
  {
    label: "Planning",
    items: [
      { path: "/rundown", label: "Rundown", icon: BarChart2 },
      { path: "/suministro-bom", label: "Suministro y BOM", icon: FileSpreadsheet },
      { path: "/conteo", label: "Conteo de planta", icon: ClipboardList },
      { path: "/stock", label: "Gestión de stock", icon: Layers },
    ],
  },
  {
    label: "Depósito",
    items: [
      { path: "/deposito", label: "Pedidos depósito", icon: Warehouse },
      { path: "/materiales", label: "Stock en CL2", icon: Package },
      { path: "/conteo-ciclico", label: "Conteo Cíclico", icon: RefreshCw },
    ],
  },
  {
    label: "Documentos",
    items: [
      { path: "/remitos", label: "Remitos", icon: Receipt },
    ],
  },
  {
    label: "Sistema",
    items: [
      { path: "/trazabilidad", label: "Auditoría", icon: Shield },
    ],
  },
];

function NavContent({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const location = useLocation();

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  return (
    <>
      <nav className="flex-1 p-3">
        {navGroups.map((group) => (
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
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-slate-700">N</span>
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-900 text-sm leading-none">Nicolás</p>
            <p className="text-xs text-slate-500 mt-0.5">Operario</p>
          </div>
        </div>
      </div>
    </>
  );
}

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Mobile top bar */}
      <header className="lg:hidden flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 z-30">
        <button
          onClick={() => setMobileOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5 text-slate-700" />
        </button>
        <span className="font-semibold text-slate-900 text-sm">Sistema de Pedidos</span>
        <div className="w-9" />
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile overlay sidebar */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative w-72 bg-white h-full flex flex-col overflow-y-auto shadow-xl z-10">
              <div className="flex items-center justify-between p-5 border-b border-slate-200 flex-shrink-0">
                <div>
                  <h1 className="font-semibold text-slate-900 leading-tight">Sistema de Pedidos</h1>
                  <p className="text-xs text-slate-500 mt-0.5">Gestión de Materiales</p>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4 text-slate-600" />
                </button>
              </div>
              <NavContent onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-60 bg-white border-r border-slate-200 flex-col overflow-y-auto flex-shrink-0">
          <div className="p-5 border-b border-slate-200 flex-shrink-0">
            <h1 className="font-semibold text-slate-900 leading-tight">Sistema de Pedidos</h1>
            <p className="text-xs text-slate-500 mt-0.5">Gestión de Materiales</p>
          </div>
          <NavContent />
        </aside>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
