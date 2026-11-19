import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { AUTH_EXPIRED_EVENT, getMe, loginUser, type UsuarioItem } from "../services/api";

interface AuthContextType {
  user: UsuarioItem | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (roles: string[]) => boolean;
  canAccessSector: (sector: string) => boolean;
  canModifyPedidoDeposito: boolean;
  canModifyStockCL2: boolean;
  canAssignCyclic: boolean;
  canManageUsers: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UsuarioItem | null>(() => {
    const saved = localStorage.getItem("auth_user");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("auth_token"));
  const [loading, setLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setUser(null);
    setToken(null);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem("auth_token");
      if (!storedToken) {
        setLoading(false);
        return;
      }
      try {
        const me = await getMe();
        setUser(me);
        localStorage.setItem("auth_user", JSON.stringify(me));
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [logout]);

  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, logout);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, logout);
  }, [logout]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await loginUser(username, password);
    localStorage.setItem("auth_token", res.token);
    localStorage.setItem("auth_user", JSON.stringify(res.usuario));
    setToken(res.token);
    setUser(res.usuario);
  }, []);

  const hasRole = useCallback(
    (roles: string[]) => {
      if (!user) return false;
      if (user.rol === "administrador") return true;
      return roles.includes(user.rol);
    },
    [user]
  );

  const canAccessSector = useCallback(
    (targetSector: string) => {
      if (!user) return false;
      if (user.rol === "administrador" || user.rol === "supervisor" || user.sector === "TODOS") {
        return true;
      }
      return user.sector.toLowerCase() === targetSector.toLowerCase();
    },
    [user]
  );

  const canModifyPedidoDeposito = hasRole(["administrador", "deposito", "operario_deposito"]);
  const canModifyStockCL2 = hasRole(["administrador", "gerente", "jefe"]);
  const canAssignCyclic = hasRole(["administrador", "gerente", "jefe"]);
  const canManageUsers = user?.rol === "administrador";

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      hasRole,
      canAccessSector,
      canModifyPedidoDeposito,
      canModifyStockCL2,
      canAssignCyclic,
      canManageUsers,
    }),
    [user, token, loading, login, logout, hasRole, canAccessSector, canModifyPedidoDeposito, canModifyStockCL2, canAssignCyclic, canManageUsers]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
