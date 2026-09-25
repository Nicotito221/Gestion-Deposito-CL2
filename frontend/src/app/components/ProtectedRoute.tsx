import { ReactNode, useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

interface ProtectedRouteProps {
  roles?: string[];
  blockedRoles?: string[];
  blockedSectors?: string[];
  allowedSectors?: string[];
  children: ReactNode;
}

export function ProtectedRoute({
  roles,
  blockedRoles,
  blockedSectors,
  allowedSectors,
  children,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.rol === "administrador") {
    return <>{children}</>;
  }

  const userSector = user.sector?.toUpperCase() || "";

  if (blockedSectors?.some((s) => s.toUpperCase() === userSector)) {
    return <AccessDeniedRedirect />;
  }

  if (blockedRoles?.includes(user.rol)) {
    return <AccessDeniedRedirect />;
  }

  if (roles && roles.length > 0 && !roles.includes(user.rol)) {
    return <AccessDeniedRedirect />;
  }

  if (allowedSectors && allowedSectors.length > 0 && !allowedSectors.some((s) => s.toUpperCase() === userSector)) {
    return <AccessDeniedRedirect />;
  }

  return <>{children}</>;
}

function AccessDeniedRedirect() {
  const toastShown = useRef(false);

  useEffect(() => {
    if (!toastShown.current) {
      toast.error("Acceso restringido: no tienes permisos para ingresar a esta sección.");
      toastShown.current = true;
    }
  }, []);

  return <Navigate to="/inicio" replace />;
}
